import type { MbtiType, FriendItem, DexEntry, DexStats, DexBadge, Archetype } from '../types';
import { MBTI_ARCHETYPES } from '../data/personalityQuestions';

export const ALL_MBTI_TYPES: MbtiType[] = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

export const GROUP_LABELS: Record<'ANALYST' | 'DIPLOMAT' | 'SENTINEL' | 'EXPLORER', {
  name: string;
  title: string;
  role: string;
  color: string;
  badgeBg: string;
  gradient: string;
}> = {
  ANALYST: {
    name: 'アナリスト',
    title: 'ANALYST (知性・研究)',
    role: '知性・研究',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    gradient: 'from-purple-900/50 to-indigo-950/80',
  },
  DIPLOMAT: {
    name: 'クリエイター',
    title: 'CREATOR (共感・発信)',
    role: '共感・発信',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    gradient: 'from-emerald-900/50 to-teal-950/80',
  },
  SENTINEL: {
    name: 'オーガナイザー',
    title: 'ORGANIZER (運営・支援)',
    role: '運営・支援',
    color: '#3b82f6',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    gradient: 'from-blue-900/50 to-sky-950/80',
  },
  EXPLORER: {
    name: 'チャレンジャー',
    title: 'CHALLENGER (機動・実践)',
    role: '機動・実践',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    gradient: 'from-amber-900/50 to-orange-950/80',
  },
};

/**
 * 自身のMBTIとフレンド一覧からモッフィー図鑑の全エントリおよび統計データを算出します。
 */
export function calculateDexStats(
  ownMbti?: MbtiType | null,
  friends: FriendItem[] = []
): { entries: DexEntry[]; stats: DexStats } {
  const normalizedOwnMbti = (ownMbti && ownMbti in MBTI_ARCHETYPES) ? (ownMbti as MbtiType) : null;
  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';

  const groupStats: DexStats['groupStats'] = {
    ANALYST: { unlocked: 0, total: 4 },
    DIPLOMAT: { unlocked: 0, total: 4 },
    SENTINEL: { unlocked: 0, total: 4 },
    EXPLORER: { unlocked: 0, total: 4 },
  };

  const entries: DexEntry[] = ALL_MBTI_TYPES.map((mbti) => {
    const archetype: Archetype = MBTI_ARCHETYPES[mbti];
    const isOwnPartner = normalizedOwnMbti === mbti;
    const matchingFriends = friends.filter((f) => f.mbti === mbti);
    const isUnlocked = isOwnPartner || matchingFriends.length > 0;

    if (isUnlocked) {
      groupStats[archetype.groupName].unlocked += 1;
    }

    const defaultImg = archetype.officialImageUrl
      ? archetype.officialImageUrl.startsWith('http')
        ? archetype.officialImageUrl
        : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
      : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`;

    return {
      mbti,
      archetype,
      isUnlocked,
      isOwnPartner,
      friends: matchingFriends,
      imageUrl: defaultImg,
    };
  });

  const totalUnlocked = entries.filter((e) => e.isUnlocked).length;
  const totalCount = 16;
  const percentage = Math.round((totalUnlocked / totalCount) * 100);

  const hasCompletedAnyGroup = Object.values(groupStats).some((g) => g.unlocked === g.total);

  const badges: DexBadge[] = [
    {
      id: 'first_step',
      title: '初めの一歩',
      description: '初めてのアンバサダーとフレンド交換を行った',
      iconName: 'Sparkles',
      isUnlocked: totalUnlocked >= 2,
    },
    {
      id: 'quartet',
      title: 'カルテット',
      description: '4種類の異なる性格のモッフィーと出会った',
      iconName: 'Compass',
      isUnlocked: totalUnlocked >= 4,
    },
    {
      id: 'half_master',
      title: 'ハーフマスター',
      description: '半数（8種類）のモッフィー図鑑を解放した',
      iconName: 'Award',
      isUnlocked: totalUnlocked >= 8,
    },
    {
      id: 'group_master',
      title: 'カテゴリーマスター',
      description: 'いずれかのグループ（4体）を完全コンプリートした',
      iconName: 'ShieldCheck',
      isUnlocked: hasCompletedAnyGroup,
    },
    {
      id: 'grand_master',
      title: 'グランドマスター',
      description: '全16種類のモッフィーと出会い図鑑を全制覇した！',
      iconName: 'Crown',
      isUnlocked: totalUnlocked === 16,
    },
  ];

  return {
    entries,
    stats: {
      totalUnlocked,
      totalCount,
      percentage,
      groupStats,
      badges,
    },
  };
}

/**
 * 新しいフレンドの性格が図鑑にとって初遭遇（新規登録）かどうかを判定します。
 */
export function isNewDexDiscovery(
  newFriendMbti: MbtiType,
  ownMbti?: MbtiType | null,
  currentFriends: FriendItem[] = []
): boolean {
  if (!newFriendMbti) return false;
  if (ownMbti && ownMbti === newFriendMbti) return false;
  return !currentFriends.some((f) => f.mbti === newFriendMbti);
}
