/**
 * Discord 二段階認証（本人確認）フラグ・有効期限管理サービス
 * 
 * 仕様:
 * 1. 二段階認証（公式サーバー在籍確認）完了時にフラグおよび認証日時・有効期限を保存
 * 2. 既存のユーザーは初期状態で False とする（未認証または期限切れ）
 * 3. False の時は必ず Discord 在籍確認（二段階認証）が必須
 * 4. 認証から 1 週間（7日間）が経過するとフラグを自動的に False に更新し、次回のログイン時に再認証を要求
 */

import type { DiscordUserVerification } from './discordApi';

export interface Discord2FaRecord {
  userName: string;
  isVerified: boolean;
  verifiedAt: number;   // 認証タイムスタンプ (ミリ秒)
  expiresAt: number;    // 有効期限タイムスタンプ (ミリ秒: verifiedAt + 7 days)
  displayName?: string;
  avatarUrl?: string;
}

export interface Discord2FaStatus {
  isVerified: boolean;
  record?: Discord2FaRecord | null;
  remainingMs?: number;
  isExpired?: boolean;
}

const STORAGE_KEY_PREFIX = 'moffy_discord_2fa_';
const V2_MIGRATION_KEY = 'moffy_2fa_v2_reset_all_forced_20260917';
export const TWO_FACTOR_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7日間（1週間）

/**
 * 全ユーザーの 2FA フラグを強制的に False（未認証）にリセット
 */
export function resetAllUsers2Fa(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);

    // 1. 全 2FA レコードの isVerified を false に初期化
    for (const key of keys) {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            parsed.isVerified = false;
            parsed.verifiedAt = 0;
            parsed.expiresAt = 0;
            localStorage.setItem(key, JSON.stringify(parsed));
          } catch {
            // ignore
          }
        }
      } else if (key.startsWith('moffy_user_session_')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            parsed.isDiscordVerified = false;
            parsed.discordVerifiedAt = null;
            localStorage.setItem(key, JSON.stringify(parsed));
          } catch {
            // ignore
          }
        }
      }
    }

    // 2. 既存の OAuth セッションの 2FA フラグも確実に false に設定
    const oauthSessionRaw = localStorage.getItem('moffy_oauth_session');
    if (oauthSessionRaw) {
      try {
        const parsed = JSON.parse(oauthSessionRaw);
        if (parsed.user) {
          parsed.user.is_discord_verified = false;
          parsed.user.discord_verified_at = null;
        }
        localStorage.setItem('moffy_oauth_session', JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }

    console.info('[2FA] All users 2FA status successfully reset to False.');
  } catch (e) {
    console.warn('[2FA] Failed to reset all users 2FA status:', e);
  }
}

/**
 * 既存ユーザーの2FAフラグ初期化（全ユーザー初期状態で一旦 False に設定）
 */
export function initializeExistingUsers2Fa(): void {
  if (typeof window === 'undefined') return;
  try {
    const isInitialized = localStorage.getItem(V2_MIGRATION_KEY);
    if (!isInitialized) {
      resetAllUsers2Fa();
      localStorage.setItem(V2_MIGRATION_KEY, 'true');
    }
  } catch (e) {
    console.warn('[2FA] Failed to initialize existing users 2FA flag:', e);
  }
}

/**
 * 指定された Discord ユーザー名の二段階認証ステータスを取得します。
 * 1週間（7日間）が経過している場合は自動的にフラグを False に更新保存します。
 */
export function getDiscord2FaStatus(userName?: string | null): Discord2FaStatus {
  if (typeof window === 'undefined' || !userName) {
    return { isVerified: false };
  }

  // 初回ロード時の既存ユーザー False 初期化を実行
  initializeExistingUsers2Fa();

  const cleanUserName = userName.trim().replace(/^@/, '').toLowerCase();
  if (!cleanUserName) {
    return { isVerified: false };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${cleanUserName}`);
    if (!raw) {
      return { isVerified: false };
    }

    const record = JSON.parse(raw) as Discord2FaRecord;

    // フラグが false の場合
    if (!record.isVerified) {
      return { isVerified: false, record };
    }

    // 1週間（7日間）経過判定
    const now = Date.now();
    const elapsed = now - (record.verifiedAt || 0);

    if (elapsed >= TWO_FACTOR_EXPIRY_MS || (record.expiresAt && now >= record.expiresAt)) {
      // 1週間経過したためフラグを False に更新して保存
      record.isVerified = false;
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanUserName}`, JSON.stringify(record));
      return {
        isVerified: false,
        record,
        isExpired: true,
      };
    }

    // 有効期間内
    const remainingMs = Math.max(0, (record.expiresAt || record.verifiedAt + TWO_FACTOR_EXPIRY_MS) - now);
    return {
      isVerified: true,
      record,
      remainingMs,
      isExpired: false,
    };
  } catch (e) {
    console.warn('[2FA] Failed to read 2FA status:', e);
    return { isVerified: false };
  }
}

/**
 * 二段階認証の成功結果を保存（有効期限 1週間 を付与）
 */
export function saveDiscord2FaVerification(
  userName: string,
  verifiedData?: DiscordUserVerification
): Discord2FaRecord {
  const cleanUserName = (verifiedData?.user_name || userName).trim().replace(/^@/, '').toLowerCase();
  const now = Date.now();

  const record: Discord2FaRecord = {
    userName: cleanUserName,
    isVerified: true,
    verifiedAt: now,
    expiresAt: now + TWO_FACTOR_EXPIRY_MS,
    displayName: verifiedData?.displayname,
    avatarUrl: verifiedData?.avatar_url,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanUserName}`, JSON.stringify(record));
    } catch (e) {
      console.warn('[2FA] Failed to save 2FA verification:', e);
    }
  }

  return record;
}

/**
 * 二段階認証フラグを明示的に False（リセット）に設定
 */
export function resetDiscord2FaStatus(userName: string): void {
  if (typeof window === 'undefined' || !userName) return;
  const cleanUserName = userName.trim().replace(/^@/, '').toLowerCase();

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${cleanUserName}`);
    if (raw) {
      const record = JSON.parse(raw) as Discord2FaRecord;
      record.isVerified = false;
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanUserName}`, JSON.stringify(record));
    } else {
      const record: Discord2FaRecord = {
        userName: cleanUserName,
        isVerified: false,
        verifiedAt: 0,
        expiresAt: 0,
      };
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${cleanUserName}`, JSON.stringify(record));
    }
  } catch (e) {
    console.warn('[2FA] Failed to reset 2FA status:', e);
  }
}

/**
 * 残り有効時間を人間が読める文字列に整形
 */
export function formatRemaining2FaTime(remainingMs?: number): string {
  if (remainingMs === undefined || remainingMs <= 0) return '有効期限切れ';

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `残り約${days}日${hours > 0 ? `${hours}時間` : ''}`;
  }
  if (hours > 0) {
    return `残り約${hours}時間${minutes > 0 ? `${minutes}分` : ''}`;
  }
  return `残り約${Math.max(1, minutes)}分`;
}
