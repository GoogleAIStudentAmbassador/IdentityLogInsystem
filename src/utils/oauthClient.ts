/**
 * Moffy OAuth 2.0 Client SDK
 * 
 * 本リポジトリおよび将来の別リポジトリから共通利用可能な、
 * OAuth 2.0 (Implicit / Token Grant) 準拠の認証クライントライブラリです。
 * 
 * 主なセキュリティ対策:
 * - RFC 6749 準拠の認可フロー
 * - Open Redirector 防御（オリジン検証 & ホワイトリスト照合）
 * - CSRF 攻撃防御（ワンタイム state パラメータの自動生成 & 検証）
 * - URL フラグメントによるセキュアなトークン受け渡し & 即時アドレスバー浄化
 */

export interface AuthUser {
  discord_user_id: string;
  name?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  nickname?: string | null;
  grade?: string | null;
  university?: string | null;
  photo_url?: string | null;
  default_photo_url?: string | null;
  arranged_photo_url?: string | null;
  mbti?: string | null;
  is_staff?: boolean;
  google_id?: string | null;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
  expiresAt?: number;
  savedAt: string;
}

export interface MoffyAuthConfig {
  clientId: string;
  authUrl?: string; // 例: 'https://takafumi06.github.io/IdentityLogInsystem/oauth.html'
  redirectUri?: string; // 認証完了後の戻り先URL
  storageKeyPrefix?: string;
  allowedOrigins?: string[];
}

export function getDefaultAuthUrl(): string {
  if (typeof window === 'undefined') return '/oauth.html';
  const pathname = window.location.pathname;
  const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return `${window.location.origin}${basePath}oauth.html`;
}

const DEFAULT_STORAGE_PREFIX = 'moffy_oauth_';

/**
 * 許可されたリダイレクト先オリジン判定（Open Redirector 防御）
 */
export function isAllowedRedirectUri(targetUri: string, additionalOrigins: string[] = []): boolean {
  if (!targetUri || typeof targetUri !== 'string') return false;

  try {
    const parsed = new URL(targetUri, window.location.href);

    // http / https スキームのみ許可（javascript: や data: などを完全遮断）
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const currentOrigin = window.location.origin;
    if (parsed.origin === currentOrigin) {
      return true;
    }

    // ローカル開発環境の相互乗り入れを許可
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }

    // 環境変数 VITE_ALLOWED_REDIRECT_ORIGINS から追加オリジンを取得
    const envOrigins = (import.meta.env.VITE_ALLOWED_REDIRECT_ORIGINS || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    // ホワイトリスト検証
    const allowed = [
      ...additionalOrigins,
      ...envOrigins,
      'https://takafumi06.github.io',
    ];

    return allowed.some((origin) => {
      try {
        const allowedParsed = new URL(origin);
        return parsed.origin === allowedParsed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * 暗号学的にセキュアなランダム文字列を生成 (CSRF state用)
 */
export function generateRandomState(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export class MoffyAuthClient {
  private config: Required<MoffyAuthConfig>;
  private inMemorySession: AuthSession | null = null;

  constructor(config: MoffyAuthConfig) {
    const authUrl = config.authUrl || getDefaultAuthUrl();
    const redirectUri = config.redirectUri || (typeof window !== 'undefined' ? window.location.href.split('#')[0] : '');
    const storageKeyPrefix = config.storageKeyPrefix || DEFAULT_STORAGE_PREFIX;
    const allowedOrigins = config.allowedOrigins || [];

    this.config = {
      clientId: config.clientId,
      authUrl,
      redirectUri,
      storageKeyPrefix,
      allowedOrigins,
    };
  }

  /**
   * OAuth 認可画面へユーザーを転送
   */
  public login(options?: { redirectUri?: string; state?: string; scope?: string }): void {
    if (typeof window === 'undefined') return;

    const redirectUri = options?.redirectUri || this.config.redirectUri;
    const state = options?.state || generateRandomState();
    const scope = options?.scope || 'profile';

    // CSRF 検証用に sessionStorage に state を一時保存
    try {
      sessionStorage.setItem(`${this.config.storageKeyPrefix}csrf_state`, state);
      sessionStorage.setItem(`${this.config.storageKeyPrefix}expected_redirect`, redirectUri);
    } catch (e) {
      console.warn('Failed to save CSRF state to sessionStorage:', e);
    }

    const authEndpoint = new URL(this.config.authUrl, window.location.href);
    authEndpoint.searchParams.set('client_id', this.config.clientId);
    authEndpoint.searchParams.set('redirect_uri', redirectUri);
    authEndpoint.searchParams.set('response_type', 'token');
    authEndpoint.searchParams.set('state', state);
    authEndpoint.searchParams.set('scope', scope);

    window.location.href = authEndpoint.toString();
  }

  /**
   * コールバック URL（URLフラグメント #access_token=...&state=...）を解析し、セッションを保存
   * 成功した場合は true を返し、ブラウザのアドレスバーからハッシュを即座に除去
   */
  public handleCallback(): boolean {
    if (typeof window === 'undefined') return false;

    // ハッシュ（URLフラグメント）をチェック
    const hash = window.location.hash.substring(1);
    if (!hash || !hash.includes('access_token')) return false;

    // 🌟 批判検証是正 C: コールバック検出時点で直ちにアドレスバーを浄化し、認証成否にかかわらずトークン露出を遮断
    try {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
    } catch {
      // ignore
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    const tokenType = params.get('token_type') || 'Bearer';

    if (!accessToken) {
      return false;
    }

    // CSRF State 検証
    let savedState: string | null = null;
    try {
      savedState = sessionStorage.getItem(`${this.config.storageKeyPrefix}csrf_state`);
      sessionStorage.removeItem(`${this.config.storageKeyPrefix}csrf_state`);
    } catch {
      // ignore
    }

    // 🌟 厳格なCSRF検証 (RFC 6749 Section 10.12):
    // stateパラメータが存在しない、savedStateが存在しない（Login CSRF）、または不一致の場合は即座に拒絶
    if (!savedState || !state || savedState !== state) {
      console.error('[MoffyAuthClient] CSRF state verification failed (missing or mismatched state). Aborting authentication.');
      return false;
    }

    // ユーザー情報のパース
    const discordUserId = params.get('discord_user_id') || '';
    if (!discordUserId) {
      console.error('[MoffyAuthClient] No discord_user_id found in auth callback fragment.');
      return false;
    }

    const user: AuthUser = {
      discord_user_id: discordUserId,
      name: params.get('name') || null,
      last_name: params.get('last_name') || null,
      first_name: params.get('first_name') || null,
      nickname: params.get('nickname') || null,
      grade: params.get('grade') || null,
      university: params.get('university') || null,
      photo_url: params.get('photo_url') || null,
      default_photo_url: params.get('default_photo_url') || null,
      arranged_photo_url: params.get('arranged_photo_url') || null,
      mbti: params.get('mbti') || null,
      is_staff: params.get('is_staff') === 'true',
      google_id: params.get('google_id') || null,
    };

    const session: AuthSession = {
      accessToken,
      tokenType,
      user,
      savedAt: new Date().toISOString(),
    };

    this.saveSession(session);
    return true;
  }

  /**
   * 現在のセッションを取得
   */
  public getSession(): AuthSession | null {
    if (this.inMemorySession) {
      return this.inMemorySession;
    }
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${this.config.storageKeyPrefix}session`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthSession;
      this.inMemorySession = parsed;
      return parsed;
    } catch (e) {
      console.warn('Failed to parse auth session:', e);
      return null;
    }
  }

  /**
   * セッションを保存
   */
  public saveSession(session: AuthSession): void {
    this.inMemorySession = session;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${this.config.storageKeyPrefix}session`, JSON.stringify(session));
      // 後方互換のため、旧来のトークンキー・Discord IDキーにも同期
      localStorage.setItem('moffy_user_jwt_token', session.accessToken);
    } catch (e) {
      console.warn('Failed to persist auth session to localStorage (using in-memory fallback):', e);
    }
  }

  /**
   * 認証済みかどうか判定
   */
  public isAuthenticated(): boolean {
    const session = this.getSession();
    return !!(session && session.accessToken && session.user && session.user.discord_user_id);
  }

  /**
   * 現在のユーザー情報を取得
   */
  public getUser(): AuthUser | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  /**
   * トークンを取得
   */
  public getToken(): string | null {
    const session = this.getSession();
    return session ? session.accessToken : null;
  }

  /**
   * ログアウト（セッション破棄）
   */
  public logout(options?: { redirectToLogin?: boolean }): void {
    this.inMemorySession = null;
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${this.config.storageKeyPrefix}session`);
      localStorage.removeItem('moffy_user_jwt_token');
    } catch (e) {
      console.warn('Failed to remove auth session:', e);
    }

    if (options?.redirectToLogin) {
      this.login();
    }
  }
}
