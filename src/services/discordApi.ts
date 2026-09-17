/**
 * Discord サーバー在籍確認API クライアントサービス
 * Tailscale環境下のAPIサーバー (http://100.92.228.70:8000) または Vite proxy (/discord-api) を介して
 * 指定されたDiscordユーザー名がGoogle AI Student Ambassadorサーバーに在籍しているかを検証します。
 */

export interface DiscordUserVerification {
  isAlive: boolean;
  user_name?: string;
  displayname?: string;
  avatar_url?: string;
  error?: string;
  message?: string;
}

export type Discord2FaAuthStatus = 'pending' | 'approved' | 'expired' | 'none';

export interface AuthRequestResponse {
  status: 'pending' | 'approved' | 'expired';
  user_name: string;
  expires_in?: number | null;
  panel_url?: string | null;
  displayname?: string | null;
  error?: string;
  message?: string;
}

export interface AuthStatusResponse {
  status: Discord2FaAuthStatus;
  user_name: string;
  displayname?: string | null;
  expires_in?: number | null;
  error?: string;
  message?: string;
}

const DIRECT_API_URL = (
  import.meta.env.VITE_DISCORD_API_URL || 'http://100.92.228.70:8000'
).replace(/\/+$/, '');
const PROXY_API_URL = '/discord-api';

/**
 * APIのベースURLを判定して取得します。
 * 開発環境 (import.meta.env.DEV) では CORS を回避するため Vite proxy (/discord-api) を優先し、
 * 本番環境・スタンドアロン実行時は環境変数または DIRECT_API_URL を使用します。
 */
export function getDiscordApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return PROXY_API_URL;
  }
  return DIRECT_API_URL;
}

/**
 * Discord ユーザーのアバター画像 URL を生成
 * API v2.0.0: /api/users/{user_name}/avatar または /api/user/image
 */
export function getDiscordAvatarUrl(
  userName?: string | null,
  size: number = 256,
  format: 'png' | 'webp' | 'jpeg' = 'png'
): string {
  if (!userName) return '';
  const clean = userName.trim().replace(/^@/, '');
  if (!clean) return '';
  const base = getDiscordApiBaseUrl();
  return `${base}/api/users/${encodeURIComponent(clean)}/avatar?size=${size}&format=${format}`;
}

/**
 * Discord サーバーのヘルスチェック（起動ステータスおよびBot接続確認）
 */
export async function checkDiscordBotHealth(): Promise<{
  ok: boolean;
  botReady?: boolean;
  cachedMemberCount?: number;
}> {
  const tryUrls = [getDiscordApiBaseUrl(), DIRECT_API_URL];

  for (const baseUrl of tryUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${baseUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        return {
          ok: data.status === 'ok',
          botReady: !!data.bot_ready,
          cachedMemberCount: data.cached_member_count,
        };
      }
    } catch {
      // 次のURLへフォールバック
    }
  }

  return { ok: false };
}

/**
 * 指定された Discord ユーザー名が公式サーバーに在籍しているかを二段階認証（本人確認）します。
 *
 * @param userName Discord固有のユーザー名（英数字・小文字、先頭の@は自動除去）
 * @returns 検証結果オブジェクト（isAlive, displayname, avatar_url など）
 */
export async function verifyDiscordUser(userName: string): Promise<DiscordUserVerification> {
  const cleanUserName = userName.trim().replace(/^@/, '');

  if (!cleanUserName) {
    return {
      isAlive: false,
      error: 'USERNAME_REQUIRED',
      message: 'Discord ユーザー名を入力してください',
    };
  }

  const endpoints = [
    `${getDiscordApiBaseUrl()}/api/user?user_name=${encodeURIComponent(cleanUserName)}&strict_status=false`,
    `${DIRECT_API_URL}/api/user?user_name=${encodeURIComponent(cleanUserName)}&strict_status=false`,
  ];

  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok && res.status !== 404 && res.status !== 400) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data: DiscordUserVerification = await res.json();
      if (data.isAlive && data.user_name) {
        // API v2.0.0 のアバターURLを自動付与
        if (!data.avatar_url) {
          data.avatar_url = getDiscordAvatarUrl(data.user_name);
        }
      }
      return data;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  console.error('[Discord API] Verification failed across all endpoints:', lastError);
  return {
    isAlive: false,
    error: 'NETWORK_ERROR',
    message: 'Discord 在籍確認サーバーに接続できませんでした。Tailscale接続状態をご確認ください。',
  };
}

/**
 * 常設ボタン式 二段階認証の開始要求 (POST /api/auth)
 *
 * @param userName Discord固有のユーザー名
 * @param timeout 有効期限（秒、デフォルト: 180秒）
 * @returns AuthRequestResponse (status: pending, panel_url など)
 */
export async function startDiscord2FaAuth(
  userName: string,
  timeout: number = 180
): Promise<AuthRequestResponse> {
  const cleanUserName = userName.trim().replace(/^@/, '');
  if (!cleanUserName) {
    return {
      status: 'expired',
      user_name: '',
      error: 'USERNAME_REQUIRED',
      message: 'Discord ユーザー名を入力してください',
    };
  }

  const body = JSON.stringify({
    user_name: cleanUserName,
    timeout,
    wait: false,
  });

  const endpoints = [
    `${getDiscordApiBaseUrl()}/api/auth`,
    `${DIRECT_API_URL}/api/auth`,
  ];

  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok && res.status !== 400 && res.status !== 404) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return data as AuthRequestResponse;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  console.error('[Discord API] startDiscord2FaAuth failed:', lastError);
  return {
    status: 'expired',
    user_name: cleanUserName,
    error: 'NETWORK_ERROR',
    message: '認証サーバーとの接続に失敗しました。Tailscale接続をご確認ください。',
  };
}

/**
 * 常設ボタン式 二段階認証ステータス確認 (GET /api/auth/{user_name})
 *
 * @param userName Discord固有のユーザー名
 * @param wait 承認を同期待機するか (デフォルト: false)
 * @param waitTimeout 同期待機秒数 (デフォルト: 5秒)
 * @returns AuthStatusResponse (status: pending | approved | expired | none)
 */
export async function checkDiscord2FaAuthStatus(
  userName: string,
  wait: boolean = false,
  waitTimeout: number = 5
): Promise<AuthStatusResponse> {
  const cleanUserName = userName.trim().replace(/^@/, '');
  if (!cleanUserName) {
    return {
      status: 'none',
      user_name: '',
    };
  }

  const query = `wait=${wait}&wait_timeout=${waitTimeout}`;
  const endpoints = [
    `${getDiscordApiBaseUrl()}/api/auth/${encodeURIComponent(cleanUserName)}?${query}`,
    `${DIRECT_API_URL}/api/auth/${encodeURIComponent(cleanUserName)}?${query}`,
  ];

  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutSec = wait ? Math.max(8000, (waitTimeout + 3) * 1000) : 5000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutSec);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok && res.status !== 404 && res.status !== 400) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return data as AuthStatusResponse;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  console.warn('[Discord API] checkDiscord2FaAuthStatus warning:', lastError?.message);
  return {
    status: 'none',
    user_name: cleanUserName,
    error: 'NETWORK_ERROR',
    message: 'ステータス確認サーバーへ接続できませんでした。',
  };
}

/**
 * 二段階認証セッションの解除・取り消し (DELETE /api/auth/{user_name})
 */
export async function cancelDiscord2FaAuth(userName: string): Promise<boolean> {
  const cleanUserName = userName.trim().replace(/^@/, '');
  if (!cleanUserName) return false;

  const endpoints = [
    `${getDiscordApiBaseUrl()}/api/auth/${encodeURIComponent(cleanUserName)}`,
    `${DIRECT_API_URL}/api/auth/${encodeURIComponent(cleanUserName)}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}
