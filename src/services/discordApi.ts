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

const DIRECT_API_URL = (
  import.meta.env.VITE_DISCORD_API_URL || 'http://100.92.228.70:8000'
).replace(/\/+$/, '');
const PROXY_API_URL = '/discord-api';

/**
 * APIのベースURLを判定して取得します。
 * 開発環境 (import.meta.env.DEV) では CORS を回避するため Vite proxy (/discord-api) を優先し、
 * 本番環境・スタンドアロン実行時は環境変数または DIRECT_API_URL を使用します。
 */
function getDiscordApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return PROXY_API_URL;
  }
  return DIRECT_API_URL;
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
