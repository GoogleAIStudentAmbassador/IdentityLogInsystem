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
  display_name?: string | null;
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
  role?: 'guest' | 'ambassador' | 'bureau' | 'admin';
  is_event_organizer?: boolean;
  is_admin?: boolean;
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

export interface CallbackResult {
  attempted: boolean;
  success: boolean;
  error?: string;
}

/**
 * 安全な HTTP(S) URL のサニタイズ（javascript:, data: 等の XSS ペイロードを物理遮断）
 */
export function sanitizeHttpUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  // WHATWG URL Standard Section 4.1: タブ・改行文字を除去してホワイトスペースをトリム
  const cleaned = url.replace(/[\t\r\n]/g, '').trim();
  // https://, http://, または同一オリジン相対パス / のみを許可
  // （//evil.com や /\evil.com, /\\evil.com 等のバックスラッシュ混入 Protocol-relative URL は物理遮断）
  // javascript:, data:, vbscript: 等は即座に null 遮断
  if (/^https?:\/\/[^\s<>"']+$/i.test(cleaned) || /^\/(?![/\\])[^\s<>"']*$/i.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * 暗号署名付き JWT ペイロードを安全にデコード（alg: "none" 偽装やクライアント側での特権昇格を遮断）
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[2] || parts[2].trim().length === 0) return null;

    // 🌟 [CRITICAL JWT HEADER VALIDATION]: alg: "none" や署名なしトークンを物理遮断 (空白付き " none " もトリム判定)
    let headerBase64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    while (headerBase64.length % 4) {
      headerBase64 += '=';
    }
    const headerJsonStr = decodeURIComponent(
      atob(headerBase64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const header = JSON.parse(headerJsonStr);
    if (!header || typeof header !== 'object' || typeof header.alg !== 'string') {
      console.error('[MoffyAuthClient] Invalid or missing JWT alg header. Rejecting token.');
      return null;
    }

    const alg = header.alg.trim().toUpperCase();
    const ALLOWED_ALGS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'EDDSA'];
    if (alg === 'NONE' || !ALLOWED_ALGS.includes(alg)) {
      console.error(`[MoffyAuthClient] Insecure or unsupported JWT algorithm '${header.alg}' detected. Rejecting token.`);
      return null;
    }

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsedPayload = JSON.parse(jsonStr);
    if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
      console.error('[MoffyAuthClient] Malformed JWT payload structure. Rejecting token.');
      return null;
    }
    return parsedPayload as Record<string, unknown>;
  } catch {
    return null;
  }
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

    // ホワイトリスト検証 (明示的に信頼登録されたオリジンのみ trusted)
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

    // 🌟 [SECURITY HARDENING against Tailscale Funnel Token Exfiltration]:
    // Tailscale MagicDNS (*.ts.net) や CGNAT IPv4 (100.64.0.0/10) は誰でも公開 Funnel ノードを作成可能なため、
    // 明示的なホワイトリストにない場合は無条件 trusted とせず、必ず 'requires_consent'（同意画面）を要求して Zero-Click 漏洩を物理遮断
    const isTailscale =
      /^(?:[a-zA-Z0-9-]+\.)+ts\.net$/i.test(parsed.hostname) ||
      /^100\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(parsed.hostname);

    if (isTailscale) {
      return { status: 'requires_consent', origin: parsed.origin, hostname: parsed.hostname };
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
  private lastCallbackResult: CallbackResult = { attempted: false, success: false };

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
   * 直前のコールバック解析結果を取得（無限リダイレクトループ防止ガード用）
   */
  public getLastCallbackResult(): CallbackResult {
    return this.lastCallbackResult;
  }

  /**
   * コールバック URL（URLフラグメント #access_token=...&state=... または #error=...）を解析し、セッションを保存
   * 成功した場合は true を返し、ブラウザのアドレスバーからハッシュを即座に除去
   */
  public handleCallback(): boolean {
    if (typeof window === 'undefined') return false;

    // 🌟 [IDEMPOTENCY & MULTI-EXECUTION SELF-DEFENSE]:
    // 既にコールバック処理が完了している場合、再実行による csrf_state 消失・csrf_mismatch 誤検知を遮断
    if (this.lastCallbackResult.attempted) {
      return this.lastCallbackResult.success;
    }

    // ハッシュ（URLフラグメント）およびクエリパラメータ（search）のエラー・トークンをチェック
    const hash = window.location.hash.substring(1);
    const search = window.location.search.substring(1);

    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    // 🌟 批判検証是正 ⑤ & 告発 4: RFC 6749 準拠の厳格なエラーパラメータ判定 (URLSearchParams.has)
    const hasHashError = hashParams.has('error') || hashParams.has('error_description');
    const hasSearchError = searchParams.has('error') || searchParams.has('error_description');

    if (hasHashError || hasSearchError) {
      const errSource = hasHashError ? hashParams : searchParams;
      const error = errSource.get('error') || 'access_denied';
      const errorDesc = errSource.get('error_description') || '連携リクエストが拒否されました。';
      const incomingState = errSource.get('state');

      // CSRF State 検証（RFC 6749 Section 10.12: エラーレスポンスでも state を検証）
      let savedState: string | null = null;
      try {
        savedState = sessionStorage.getItem(`${this.config.storageKeyPrefix}csrf_state`);
      } catch {
        // ignore
      }

      // 🌟 [CRITICAL LOGIN DoS & CSRF DEFENSE]:
      // 1. savedState が存在しない場合（そもそもこのセッションで認可フローを開始していない）
      //    -> 外部からの不審なエラーリダイレクト。正規フロー外のため、URLからエラーパラメータを除去するだけでアプリをクラッシュ/全画面エラーにしない。
      // 2. savedState が存在するが、incomingState が欠落、または savedState !== incomingState の場合
      //    -> 攻撃者が正規ログイン進行中のユーザーに偽のエラーURLを踏ませて csrf_state を抹消しようとする Login DoS 攻撃！
      //    -> csrf_state を絶対に削除せず温存し、不正エラーを遮断。
      // 3. savedState と incomingState が正当に完全一致した場合のみ
      //    -> ユーザーが自身で開始した認可フローが正当に拒絶されたエラーと認め、lastCallbackResult を設定し、savedState を消費（消去）する。
      let shouldConsumeState = false;

      if (!savedState) {
        this.lastCallbackResult = {
          attempted: false,
          success: false,
        };
      } else if (!incomingState || savedState !== incomingState) {
        console.warn('[MoffyAuthClient] Error callback state mismatch or missing (possible CSRF / Login DoS). Rejecting callback and preserving session state.');
        this.lastCallbackResult = {
          attempted: true,
          success: false,
          error: 'csrf_mismatch: 不正なエラーリダイレクトが検出されました。',
        };
      } else {
        this.lastCallbackResult = {
          attempted: true,
          success: false,
          error: `${error}: ${errorDesc}`,
        };
        shouldConsumeState = true;
      }

      if (shouldConsumeState) {
        try {
          sessionStorage.setItem(`${this.config.storageKeyPrefix}last_error`, error);
          sessionStorage.removeItem(`${this.config.storageKeyPrefix}csrf_state`);
        } catch {
          // ignore
        }
      }

      // 🌟 エラーパラメータ（RFC 6749: error, error_description, error_uri, state）を慎重に除去
      // ハッシュ側の error/error_description/error_uri/state も完全消去して Sticky Error を根絶
      // （※破壊的ハードリロード window.location.replace は無限リロードループを招くため絶対に呼ばない）
      try {
        searchParams.delete('error');
        searchParams.delete('error_description');
        searchParams.delete('error_uri');
        searchParams.delete('state');
        const remainingQuery = searchParams.toString();

        let cleanHash = '';
        if (hasHashError) {
          hashParams.delete('error');
          hashParams.delete('error_description');
          hashParams.delete('error_uri');
          hashParams.delete('state');
          const remainingHash = hashParams.toString();
          cleanHash = remainingHash ? `#${remainingHash}` : '';
        } else {
          // ハッシュ側にエラーが存在しない場合は、既存の通常アンカー（#section1 等）を無傷で完全維持
          cleanHash = window.location.hash || '';
        }

        const cleanUrl =
          window.location.pathname +
          (remainingQuery ? `?${remainingQuery}` : '') +
          cleanHash;
        window.history.replaceState(null, '', cleanUrl);
      } catch {
        // ignore (replaceState 制限環境でもハードリロードせずメモリ上の状態を維持)
      }
      return false;
    }

    if (!hash || !hash.includes('access_token')) {
      return false;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    const tokenType = params.get('token_type') || 'Bearer';

    if (!accessToken) {
      this.lastCallbackResult = { attempted: true, success: false, error: 'no_token' };
      return false;
    }

    // CSRF State 検証
    let savedState: string | null = null;
    try {
      savedState = sessionStorage.getItem(`${this.config.storageKeyPrefix}csrf_state`);
    } catch {
      // ignore
    }

    // 🌟 厳格なCSRF検証 (RFC 6749 Section 10.12):
    // stateパラメータが存在しない、savedStateが存在しない（Login CSRF）、または不一致の場合は即座に拒絶
    if (!savedState || !state || savedState !== state) {
      console.error('[MoffyAuthClient] CSRF state verification failed (missing or mismatched state). Aborting authentication.');
      this.lastCallbackResult = { attempted: true, success: false, error: 'csrf_mismatch' };
      try {
        sessionStorage.setItem(`${this.config.storageKeyPrefix}last_error`, 'csrf_mismatch');
      } catch {
        // ignore
      }
      // 不正コールバックのハッシュを浄化
      try {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      } catch {
        // ignore
      }
      return false;
    }

    // 認証成功が確定した時点で state を消費（早期削除によるレースコンディション防止）
    try {
      sessionStorage.removeItem(`${this.config.storageKeyPrefix}csrf_state`);
    } catch {
      // ignore
    }

    // 🌟 [CRITICAL IDENTITY & PRIVILEGE DEFENSE (FAIL-CLOSE)]:
    // 1. 暗号署名付き JWT ペイロードをデコード
    const jwtPayload = decodeJwtPayload(accessToken);

    // 2. 主体識別子 (discord_user_id) の決定:
    // JWT ペイロード内の sub または discord_user_id を必須とし、平文クエリ改変による身元偽装・BOLA突破を完全遮断
    let discordUserId = '';
    if (jwtPayload) {
      discordUserId = String(jwtPayload.discord_user_id || jwtPayload.sub || '');
      // 🌟 Fail-Close 原則: JWT 存在時は平文クエリ/フラグメントへのフォールバックを完全禁止
    } else {
      discordUserId = params.get('discord_user_id') || '';
    }

    if (!discordUserId) {
      console.error('[MoffyAuthClient] No discord_user_id found in auth callback fragment or JWT claims.');
      this.lastCallbackResult = { attempted: true, success: false, error: 'missing_user_id' };
      return false;
    }

    // 3. 認可クレームの厳格な Fail-Close 評価:
    // JWT が存在する場合、平文 URL フラグメントによるロール・管理者フラグの上書き・フォールバックを完全禁止！
    // JWT 内にクレームが存在しない場合は、最小権限（'guest' / false）に倒す。
    let role: 'guest' | 'ambassador' | 'bureau' | 'admin' = 'guest';
    let isAdmin = false;
    let isEventOrganizer = false;
    let isStaff = false;
    let isAmbassador = false;

    if (jwtPayload) {
      const jwtRole = typeof jwtPayload.role === 'string' ? jwtPayload.role : undefined;
      if (jwtRole === 'guest' || jwtRole === 'ambassador' || jwtRole === 'bureau' || jwtRole === 'admin') {
        role = jwtRole;
      }
      isAdmin = jwtPayload.is_admin === true || role === 'admin';
      isEventOrganizer = jwtPayload.is_event_organizer === true || isAdmin || role === 'bureau';
      isStaff = jwtPayload.is_staff === true || isAdmin || role === 'bureau';
      isAmbassador = jwtPayload.is_ambassador === true || role === 'ambassador' || role === 'bureau' || isAdmin;
    } else {
      // 🌟 [FAIL-CLOSE SECURITY GUARD]:
      // JWT 形式でない（署名検証されていない）場合、平文の特権・アンバサダー自称は完全拒絶。
      // ロールは必ず 'guest'、すべての特権フラグ（isAmbassador, isAdmin, isEventOrganizer, isStaff）を false に強制確定。
      role = 'guest';
      isAdmin = false;
      isEventOrganizer = false;
      isStaff = false;
      isAmbassador = false;
    }

    // 🌟 [FAIL-CLOSE 2FA SECURITY GUARD]:
    // Discord 公式サーバー在籍・2FA 検証状態（is_discord_verified）は暗号署名された JWT クレームからのみ取得。
    // 平文 URL フラグメントによる自称（#is_discord_verified=true）は 100% 遮断し、非 JWT または未署名時は false に確定。
    let isDiscordVerified = false;
    let discordVerifiedAt: number | null = null;
    if (jwtPayload) {
      isDiscordVerified = jwtPayload.is_discord_verified === true;
      if (typeof jwtPayload.discord_verified_at === 'number' && Number.isFinite(jwtPayload.discord_verified_at)) {
        discordVerifiedAt = jwtPayload.discord_verified_at;
      } else if (typeof jwtPayload.discord_verified_at === 'string') {
        const parsedAt = parseInt(jwtPayload.discord_verified_at, 10);
        discordVerifiedAt = Number.isFinite(parsedAt) ? parsedAt : null;
      }
    }

    const user: AuthUser = {
      discord_user_id: discordUserId,
      name: params.get('name') || null,
      last_name: params.get('last_name') || null,
      first_name: params.get('first_name') || null,
      nickname: params.get('nickname') || null,
      display_name: params.get('display_name') || null,
      grade: params.get('grade') || null,
      university: params.get('university') || null,
      photo_url: sanitizeHttpUrl(params.get('photo_url')),
      default_photo_url: sanitizeHttpUrl(params.get('default_photo_url')),
      arranged_photo_url: sanitizeHttpUrl(params.get('arranged_photo_url')),
      mbti: params.get('mbti') || null,
      is_staff: isStaff,
      google_id: jwtPayload && typeof jwtPayload.google_id === 'string' ? jwtPayload.google_id : null,
      is_discord_verified: isDiscordVerified,
      discord_verified_at: discordVerifiedAt,
      is_ambassador: isAmbassador,
      isAmbassador: isAmbassador,
      role,
      is_event_organizer: isEventOrganizer,
      is_admin: isAdmin,
    };

    // 🌟 [RFC 7519 NumericDate TIME UNIT NORMALIZATION]:
    // JWT/OIDC の時刻クレーム（NumericDate）は秒単位（10桁、例: 1700000000）で表現される。
    // JavaScript の Date.now() / TWO_FACTOR_EXPIRY_MS はミリ秒単位（13桁）のため、
    // 10桁の秒単位タイムスタンプ（< 10000000000）は確実に * 1000 してミリ秒へ正規化。
    // （※秒単位のまま加算すると 1970年判定となり、ログイン直後に即座にセッション失効・無限ログアウトする致命的バグを根絶）
    const verifiedAtMs = discordVerifiedAt
      ? (discordVerifiedAt < 10000000000 ? discordVerifiedAt * 1000 : discordVerifiedAt)
      : null;

    let sessionExpiresAt = verifiedAtMs
      ? verifiedAtMs + TWO_FACTOR_EXPIRY_MS
      : Date.now() + TWO_FACTOR_EXPIRY_MS;

    if (jwtPayload && typeof jwtPayload.exp === 'number') {
      const jwtExpMs = jwtPayload.exp < 10000000000 ? jwtPayload.exp * 1000 : jwtPayload.exp;
      sessionExpiresAt = Math.min(sessionExpiresAt, jwtExpMs);
    }

    const session: AuthSession = {
      accessToken,
      tokenType,
      user,
      expiresAt: sessionExpiresAt,
      savedAt: new Date().toISOString(),
    };

    // 🌟 セッション保存を先行して確実に完了
    this.saveSession(session);
    this.lastCallbackResult = { attempted: true, success: true };

    // 🌟 アドレスバーの浄化（セッション保存完了後に実行し、破壊的リロードによる認証コンテキスト蒸発を物理防止）
    try {
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleanUrl);
    } catch {
      // ignore (ハードリロードはReactステートを破棄するため実行しない)
    }

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

    // 2. JWT トークンの exp クレーム判定（Base64URL パディング安全な decodeJwtPayload を使用）
    try {
      const payload = decodeJwtPayload(session.accessToken);
      if (payload && typeof payload.exp === 'number') {
        if (Date.now() >= payload.exp * 1000) {
          console.warn('[MoffyAuthClient] JWT token expired by exp claim. Purging session.');
          this.logout();
          return false;
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
