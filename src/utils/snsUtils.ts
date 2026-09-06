import type { SnsPlatform } from '../types';

export const SNS_PLATFORMS: { value: SnsPlatform; label: string }[] = [
  { value: 'x', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'discord', label: 'Discord' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'note', label: 'note' },
  { value: 'qiita', label: 'Qiita' },
  { value: 'zenn', label: 'Zenn' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'website', label: 'その他 / Webサイト' },
];

/**
 * 制御文字を除去して安全なテキストに変換
 */
export function sanitizeTextInput(input: string, maxLength: number): string {
  if (!input) return '';
  return input
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return (code >= 32 && code !== 127) || code > 127;
    })
    .join('')
    .trim()
    .slice(0, maxLength);
}

/**
 * 入力されたURLまたはドメイン文字列からSNSプラットフォームを自動検知
 */
export function detectPlatformFromUrl(input: string): SnsPlatform | null {
  if (!input || typeof input !== 'string') return null;
  const lower = input.trim().toLowerCase();
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x';
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) return 'instagram';
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('discord.com') || lower.includes('discord.gg')) return 'discord';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('threads.net')) return 'threads';
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'facebook';
  if (lower.includes('note.com')) return 'note';
  if (lower.includes('qiita.com')) return 'qiita';
  if (lower.includes('zenn.dev')) return 'zenn';
  if (lower.includes('bsky.app')) return 'bluesky';
  if (/^https?:\/\//.test(lower)) return 'website';
  return null;
}

/**
 * SNS値（URLまたはユーザー名）から安全な外部リンクURLを生成
 * 不正スキーム（javascript:等）は完全遮断
 */
export function resolveSnsUrl(platform: SnsPlatform, rawValue: string): string | null {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  // 危険なスキームを遮断
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const cleanUser = trimmed.replace(/^@/, '');

  switch (platform) {
    case 'x':
      return `https://x.com/${cleanUser}`;
    case 'instagram':
      return `https://instagram.com/${cleanUser}`;
    case 'github':
      return `https://github.com/${cleanUser}`;
    case 'linkedin':
      return `https://www.linkedin.com/in/${cleanUser}`;
    case 'discord':
      return `https://discord.com/users/${cleanUser}`;
    case 'youtube':
      return `https://youtube.com/@${cleanUser}`;
    case 'tiktok':
      return `https://tiktok.com/@${cleanUser}`;
    case 'threads':
      return `https://threads.net/@${cleanUser}`;
    case 'facebook':
      return `https://facebook.com/${cleanUser}`;
    case 'note':
      return `https://note.com/${cleanUser}`;
    case 'qiita':
      return `https://qiita.com/${cleanUser}`;
    case 'zenn':
      return `https://zenn.dev/${cleanUser}`;
    case 'bluesky':
      return `https://bsky.app/profile/${cleanUser}`;
    case 'website':
    default:
      return `https://${trimmed}`;
  }
}
