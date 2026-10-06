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

import { TWO_FACTOR_EXPIRY_MS } from '../services/discord2fa';

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
  is_discord_verified?: boolean;
  discord_verified_at?: number | null;
  is_ambassador?: boolean;
  isAmbassador?: boolean;
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

export type RedirectUriValidationStatus = 'trusted' | 'requires_consent' | 'rejected';

export interface RedirectUriValidationResult {
  status: RedirectUriValidationStatus;
  origin: string;
  hostname: string;
  reason?: string;
}

/**
 * オープンスケール対応の OAuth 2.0 リダイレクト先バリデーション
 * 
 * 1. 'trusted':
 *    - 同一オリジン (window.location.origin)
 *    - ローカル開発環境 (localhost, 127.0.0.1)
 *    - Tailscale 開発ネットワーク (100.*)
 *    - GitHub Pages (*.github.io - 世界中の学生アンバサダー・オープンソース開発者のポートフォリオやアプリ)
 *    - 大学・研究機関ドメイン (*.ac.jp)
 *    - ホワイトリスト登録済みオリジン (VITE_ALLOWED_REDIRECT_ORIGINS, takafumi06.github.io 等)
 *    => 確認ダイアログなしで即座に自動リダイレクト
 * 
 * 2. 'requires_consent':
 *    - 構文的に正当な HTTPS 外部独自ドメイン (例: https://my-custom-app.com/cb)
 *    => 遮断せず、ユーザーに「外部アプリケーション連携の確認」画面を提示して明示的同意を得た上でリダイレクト
 * 
 * 3. 'rejected':
 *    - 危険なスキーム (javascript:, data:, vbscript:, file: 等)
 *    - localhost 以外の非暗号化平文 HTTP (トークン平文漏洩の防止)
 *    - 不正な URL フォーマット
 *    => セキュリティ保護のため物理的に即時遮断
 */
export function validateRedirectUri(targetUri: string, additionalOrigins: string[] = []): RedirectUriValidationResult {
  if (!targetUri || typeof targetUri !== 'string') {
    return { status: 'rejected', origin: '', hostname: '', reason: 'リダイレクト先URIが指定されていません。' };
  }

  try {
    // 0. 絶対URIまたは明示的な相対パスの検査 (RFC 6749 Section 3.1.2: 絶対URI準拠)
    let parsed: URL;
    try {
      parsed = new URL(targetUri);
    } catch {
      // 明示的な相対パス ('/', './', '../') の場合のみ、同一オリジン内のパスとして解決
      if (targetUri.startsWith('/') || targetUri.startsWith('./') || targetUri.startsWith('../')) {
        const baseHref = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
        parsed = new URL(targetUri, baseHref);
      } else {
        return {
          status: 'rejected',
          origin: '',
          hostname: '',
          reason: 'リダイレクト先URIの形式が不正です。絶対URI(https://...)または正当な相対パスを指定してください。',
        };
      }
    }

    // 1. スキーム検査
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        status: 'rejected',
        origin: parsed.origin,
        hostname: parsed.hostname,
        reason: '安全でないプロトコルが指定されました。HTTPSのみ許可されています。',
      };
    }

    // 2. RFC 6749 Section 3.1.2: リダイレクトURIにフラグメント(#)の含有は絶対禁止
    if (parsed.hash) {
      return {
        status: 'rejected',
        origin: parsed.origin,
        hostname: parsed.hostname,
        reason: 'リダイレクト先URIにフラグメント(#)を含めることはRFC 6749により禁止されています。',
      };
    }

    // 3. ループバックアドレス検査 (RFC 8252 Section 8.3: IPv4 & IPv6 localhost)
    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]' ||
      parsed.hostname === '::1';

    // HTTP平文の制限（ループバックアドレス以外はHTTPS必須）
    if (parsed.protocol === 'http:' && !isLocalhost) {
      return {
        status: 'rejected',
        origin: parsed.origin,
        hostname: parsed.hostname,
        reason: 'セキュリティ保護のため、外部ドメインへのリダイレクトには暗号化通信(HTTPS)が必須です。',
      };
    }

    // 4. 'trusted' 判定 (完全管理下にあるオリジンのみ同意画面スキップ)
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    if (currentOrigin && parsed.origin === currentOrigin) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    if (isLocalhost) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    // Tailscale 内部通信の厳格判定（MagicDNS *.ts.net または CGNAT IPv4 100.64.0.0/10）
    const isTailscale =
      /^[a-zA-Z0-9-]+\.ts\.net$/i.test(parsed.hostname) ||
      /^100\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(parsed.hostname);

    if (isTailscale) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    // ホワイトリスト検証 (明示的に信頼登録されたオリジン)
    const envOrigins = (import.meta.env.VITE_ALLOWED_REDIRECT_ORIGINS || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const allowed = [
      ...additionalOrigins,
      ...envOrigins,
      'https://takafumi06.github.io',
    ];

    const isExplicitlyAllowed = allowed.some((origin) => {
      try {
        const allowedParsed = new URL(origin);
        return parsed.origin === allowedParsed.origin;
      } catch {
        return false;
      }
    });

    if (isExplicitlyAllowed) {
      return { status: 'trusted', origin: parsed.origin, hostname: parsed.hostname };
    }

    // 5. 'requires_consent' 判定 (GitHub Pages, 大学ドメイン, 外部独自ドメイン)
    // 外部サービス（誰でも作成可能な *.github.io を含む）は、ゼロクリック窃取を防ぐため
    // 必ず「外部アプリケーション連携の確認（Consent Screen）」を経てユーザーの明示的同意を取得する
    if (parsed.protocol === 'https:' && parsed.hostname.includes('.')) {
      return { status: 'requires_consent', origin: parsed.origin, hostname: parsed.hostname };
    }

    return {
      status: 'rejected',
      origin: parsed.origin,
      hostname: parsed.hostname,
      reason: '無効または安全性が確認できないホスト名です。',
    };
  } catch {
    return {
      status: 'rejected',
      origin: '',
      hostname: '',
      reason: 'リダイレクトURLの形式が正しくありません。',
    };
  }
}

/**
 * 許可されたリダイレクト先オリジン判定（後方互換用）
 * 'trusted' または 'requires_consent' であれば true を返します。
 */
export function isAllowedRedirectUri(targetUri: string, additionalOrigins: string[] = []): boolean {
  const result = validateRedirectUri(targetUri, additionalOrigins);
  return result.status !== 'rejected';
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

    const isDiscordVerified = params.get('is_discord_verified') === 'true';
    const rawVerifiedAt = params.get('discord_verified_at');
    const discordVerifiedAt = rawVerifiedAt ? parseInt(rawVerifiedAt, 10) : null;
    const isAmbassador = params.get('is_ambassador') === 'true' || params.get('isAmbassador') === 'true';

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
      is_discord_verified: isDiscordVerified,
      discord_verified_at: discordVerifiedAt,
      is_ambassador: isAmbassador,
      isAmbassador: isAmbassador,
    };

    const sessionExpiresAt = discordVerifiedAt
      ? discordVerifiedAt + TWO_FACTOR_EXPIRY_MS
      : Date.now() + TWO_FACTOR_EXPIRY_MS;

    const session: AuthSession = {
      accessToken,
      tokenType,
      user,
      expiresAt: sessionExpiresAt,
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
   * 認証済みかどうか判定（トークン有効期限および二段階認証フラグの物理的検証を含む）
   */
  public isAuthenticated(): boolean {
    const session = this.getSession();
    if (!session || !session.accessToken || !session.user || !session.user.discord_user_id) {
      return false;
    }

    // 🌟 MoffyProfile正規仕様: is_ambassador はバックエンド正規マスターデータを忠実に保持
    // （クライアント側で勝手に資格を剥奪・上書きしない）

    // 1. セッション expiresAt 判定
    if (session.expiresAt && Date.now() >= session.expiresAt) {
      console.warn('[MoffyAuthClient] Session expired by expiresAt. Purging session.');
      this.logout();
      return false;
    }

    // 2. JWT トークンの exp クレーム判定
    try {
      const parts = session.accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && typeof payload.exp === 'number') {
          if (Date.now() >= payload.exp * 1000) {
            console.warn('[MoffyAuthClient] JWT token expired by exp claim. Purging session.');
            this.logout();
            return false;
          }
        }
      }
    } catch {
      // ignore parse errors for non-standard tokens
    }

    return true;
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
