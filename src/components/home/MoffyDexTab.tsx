import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  Award,
  Crown,
  ShieldCheck,
  Compass,
  X,
  User,
  Users,
  QrCode,
  ExternalLink,
} from 'lucide-react';
import type { MbtiType, FriendItem, UserMoffySession, DexEntry } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { calculateDexStats, GROUP_LABELS } from '../../utils/dexUtils';

interface MoffyDexTabProps {
  user: AuthUser | null;
  session: UserMoffySession | null;
  friends: FriendItem[];
  isDarkMode: boolean;
  onGoToExchange: () => void;
}

type GroupFilter = 'ALL' | 'ANALYST' | 'DIPLOMAT' | 'SENTINEL' | 'EXPLORER';

export const MoffyDexTab: React.FC<MoffyDexTabProps> = ({
  user,
  session,
  friends,
  isDarkMode,
  onGoToExchange,
}) => {
  const ownMbti = (session?.mbti || user?.mbti || null) as MbtiType | null;

  const { entries, stats } = useMemo(() => {
    return calculateDexStats(ownMbti, friends);
  }, [ownMbti, friends]);

  const [selectedGroup, setSelectedGroup] = useState<GroupFilter>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<DexEntry | null>(null);

  const filteredEntries = useMemo(() => {
    if (selectedGroup === 'ALL') return entries;
    return entries.filter((e) => e.archetype.groupName === selectedGroup);
  }, [entries, selectedGroup]);

  const badgeIcons: Record<string, React.ReactNode> = {
    Sparkles: <Sparkles className="w-3.5 h-3.5" />,
    Award: <Award className="w-3.5 h-3.5" />,
    Compass: <Compass className="w-3.5 h-3.5" />,
    ShieldCheck: <ShieldCheck className="w-3.5 h-3.5" />,
    Crown: <Crown className="w-3.5 h-3.5" />,
  };

  /**
   * 水晶球体（Crystal Orb）を描画。
   * シークレット（未発見）時は水晶玉の中に立ち込める「もや」と神秘的な「？」を表示します。
   */
  const renderCrystalOrb = (entry: DexEntry, isModal = false) => {
    const { archetype, isUnlocked } = entry;
    const containerSize = isModal
      ? 'w-36 h-36 sm:w-40 sm:h-40'
      : 'w-48 h-48 sm:w-56 sm:h-56';
    const orbSize = isModal
      ? 'w-28 h-28 sm:w-32 sm:h-32'
      : 'w-40 h-40 sm:w-48 sm:h-48';
    const imageSize = isModal
      ? 'w-20 h-20 sm:w-24 sm:h-24'
      : 'w-32 h-32 sm:w-36 sm:h-36';
    const silhouetteSize = isModal
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : 'w-24 h-24 sm:w-28 sm:h-28';
    const questionSize = isModal
      ? 'text-3xl sm:text-4xl'
      : 'text-5xl sm:text-6xl';

    return (
      <div className={`relative flex items-center justify-center select-none ${containerSize}`}>
        {/* 背景の柔らかな環境色グロー */}
        <div
          className={`absolute inset-2 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 ${
            isUnlocked ? 'opacity-35' : 'opacity-15'
          }`}
          style={{ backgroundColor: archetype.primaryColor }}
        />

        {/* 外周を旋回する繊細な幾何学リング */}
        <div
          className="absolute inset-0 rounded-full border border-dashed pointer-events-none animate-spin-slow"
          style={{
            borderColor: isUnlocked
              ? `${archetype.accentColor}66`
              : (isDarkMode ? '#ffffff22' : '#00000018'),
          }}
        />
        <div
          className={`absolute -inset-2 rounded-full border pointer-events-none animate-spin-slow-reverse ${
            isDarkMode ? 'border-white/10' : 'border-neutral-300/60'
          }`}
        />

        {/* 水晶球体本体 */}
        <div
          className={`relative rounded-full overflow-hidden flex items-center justify-center border backdrop-blur-xl transition-all duration-500 ${orbSize} ${
            isDarkMode
              ? isUnlocked
                ? 'border-white/30 bg-gradient-to-b from-white/15 via-transparent to-black/70'
                : 'border-white/20 bg-gradient-to-b from-white/10 via-neutral-950/80 to-black'
              : isUnlocked
                ? 'border-white/80 bg-gradient-to-b from-white/60 via-transparent to-neutral-200/50 shadow-lg'
                : 'border-white/70 bg-gradient-to-b from-white/70 via-neutral-100/60 to-neutral-200/80 shadow-md'
          }`}
          style={{
            boxShadow: isDarkMode
              ? isUnlocked
                ? `0 0 45px ${archetype.primaryColor}55, inset 0 0 30px rgba(255,255,255,0.25), 0 10px 40px rgba(0,0,0,0.8)`
                : '0 0 30px rgba(255,255,255,0.08), inset 0 0 25px rgba(255,255,255,0.15), 0 10px 35px rgba(0,0,0,0.8)'
              : isUnlocked
                ? `0 0 35px ${archetype.primaryColor}30, inset 0 0 25px rgba(255,255,255,0.8), 0 10px 30px rgba(0,0,0,0.12)`
                : '0 0 25px rgba(0,0,0,0.06), inset 0 0 20px rgba(255,255,255,0.8), 0 8px 25px rgba(0,0,0,0.08)',
          }}
        >
          {isUnlocked ? (
            <>
              {/* 内部の微細な環境カラーグラデーション */}
              <div
                className="absolute inset-0 rounded-full blur-md pointer-events-none opacity-35"
                style={{
                  background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${archetype.accentColor} 40%, ${archetype.primaryColor} 70%, transparent 95%)`,
                }}
              />

              {/* 水晶の内部で優雅に無重力浮遊するモッフィー */}
              <div className={`relative z-10 flex items-center justify-center animate-crystal-float ${imageSize}`}>
                <img
                  src={entry.imageUrl}
                  alt={archetype.title}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0';
                  }}
                  className="w-full h-full object-contain rounded-full select-none pointer-events-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
                />
              </div>
            </>
          ) : (
            <>
              {/* シークレット：水晶玉の中に立ち込める神秘的な「もや（Mist / Fog）」 */}
              {/* もやレイヤー 1: 呼吸・回転する柔らかな靄 */}
              <div
                className="absolute -inset-2 rounded-full blur-xl pointer-events-none animate-mist-haze"
                style={{
                  background: isDarkMode
                    ? 'radial-gradient(circle at 45% 45%, rgba(255,255,255,0.22), rgba(160,160,160,0.15) 50%, transparent 75%)'
                    : 'radial-gradient(circle at 45% 45%, rgba(180,180,180,0.4), rgba(210,210,210,0.25) 50%, transparent 75%)',
                }}
              />

              {/* もやレイヤー 2: モッフィー属性色のほのかな燐光 */}
              <div
                className="absolute inset-2 rounded-full blur-lg pointer-events-none opacity-40 animate-pulse"
                style={{
                  background: `radial-gradient(circle at 60% 60%, ${archetype.primaryColor}35, transparent 65%)`,
                }}
              />

              {/* もやの奥に微かに佇むモッフィーのシルエット */}
              <div className={`absolute inset-4 flex items-center justify-center pointer-events-none select-none ${silhouetteSize}`}>
                <img
                  src={entry.imageUrl}
                  alt="Secret Moffy Silhouette"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0';
                  }}
                  className="w-full h-full object-contain brightness-0 opacity-10 filter blur-[1.5px]"
                />
              </div>

              {/* もやレイヤー 3: 中心部の濃密な霧 */}
              <div
                className={`absolute inset-3 rounded-full blur-md pointer-events-none ${
                  isDarkMode ? 'bg-neutral-900/50' : 'bg-neutral-200/40'
                }`}
              />

              {/* もやの中に浮かぶ神秘的な「？」 */}
              <div className="relative z-10 flex flex-col items-center justify-center animate-crystal-float select-none">
                <span
                  className={`font-mono font-bold tracking-wider ${questionSize} ${
                    isDarkMode
                      ? 'text-white/85 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]'
                      : 'text-neutral-700 drop-shadow-[0_0_12px_rgba(0,0,0,0.2)]'
                  }`}
                >
                  ?
                </span>
                <span
                  className={`text-[9px] font-mono tracking-widest uppercase mt-0.5 px-2 py-0.5 rounded-full border shadow-xs ${
                    isDarkMode
                      ? 'border-white/20 bg-black/60 text-neutral-300'
                      : 'border-neutral-300 bg-white/80 text-neutral-600'
                  }`}
                >
                  SECRET
                </span>
              </div>
            </>
          )}

          {/* ガラス球体表面の光沢ハイライト */}
          <div className="absolute top-1.5 left-4 right-4 h-12 rounded-full bg-gradient-to-b from-white/35 via-white/10 to-transparent pointer-events-none blur-[0.5px]" />
          <div className="absolute bottom-1.5 left-6 right-6 h-4 rounded-full bg-gradient-to-t from-white/15 to-transparent pointer-events-none blur-[1px]" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 select-none">
      {/* ページヘッダー */}
      <div className={`border-b pb-4 ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-google-blue" />
            <h2 className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
              モッフィー図鑑
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-google-blue px-2.5 py-1 rounded-full bg-google-blue/10 border border-google-blue/20">
            {stats.totalUnlocked} / {stats.totalCount} ({stats.percentage}%)
          </span>
        </div>
        <p className={`mt-1 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          フレンド交換で出会ったアンバサダーのパートナーモッフィーが記録されます
        </p>

        {/* 全体進捗バー */}
        <div className="mt-3.5">
          <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
            <div
              className="h-full rounded-full transition-all duration-500 bg-google-blue"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>

        {/* 4グループ別ミニ進捗 */}
        <div className="grid grid-cols-4 gap-2 mt-3 text-center text-[10px]">
          {(['ANALYST', 'DIPLOMAT', 'SENTINEL', 'EXPLORER'] as const).map((gKey) => {
            const gInfo = GROUP_LABELS[gKey];
            const gStat = stats.groupStats[gKey];
            const isCompleted = gStat.unlocked === gStat.total;
            return (
              <div
                key={gKey}
                className={`p-1.5 rounded-lg border transition ${
                  isDarkMode
                    ? isCompleted
                      ? 'bg-neutral-800/80 border-neutral-700'
                      : 'bg-neutral-900/50 border-neutral-800/80 text-neutral-400'
                    : isCompleted
                      ? 'bg-neutral-100 border-neutral-300'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                }`}
              >
                <div className="font-medium truncate">{gInfo.name}</div>
                <div className="font-mono font-semibold mt-0.5" style={{ color: gInfo.color }}>
                  {gStat.unlocked}/{gStat.total}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* コレクション称号（アチーブメントバッジ一覧） */}
      <div>
        <div className="flex items-center gap-1.5 mb-2.5">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            コレクション称号
          </h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {stats.badges.map((badge) => (
            <div
              key={badge.id}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
                badge.isUnlocked
                  ? isDarkMode
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-xs'
                    : 'border-amber-400/50 bg-amber-50 text-amber-900 shadow-xs'
                  : isDarkMode
                    ? 'border-neutral-800/60 bg-neutral-900/40 text-neutral-500 opacity-60'
                    : 'border-neutral-200 bg-neutral-100/50 text-neutral-400 opacity-60'
              }`}
              title={badge.description}
            >
              <div className={badge.isUnlocked ? 'text-amber-400' : 'text-neutral-400'}>
                {badgeIcons[badge.iconName] || <Award className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left">
                <div className="font-bold text-[11px] leading-tight">{badge.title}</div>
                <div className="text-[9px] opacity-80 leading-tight mt-0.5 truncate max-w-[120px]">
                  {badge.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* グループ切り替えタブ（アンバサダー世界観に準拠） */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'ALL', label: 'すべて' },
          { key: 'ANALYST', label: 'アナリスト' },
          { key: 'DIPLOMAT', label: 'クリエイター' },
          { key: 'SENTINEL', label: 'オーガナイザー' },
          { key: 'EXPLORER', label: 'チャレンジャー' },
        ].map((tab) => {
          const isActive = selectedGroup === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedGroup(tab.key as GroupFilter)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition cursor-pointer border ${
                isActive
                  ? isDarkMode
                    ? 'bg-neutral-100 text-neutral-900 border-neutral-100 font-bold shadow-xs'
                    : 'bg-neutral-900 text-white border-neutral-900 font-bold shadow-xs'
                  : isDarkMode
                    ? 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 16タイプ モッフィー一覧（ボックス枠完全撤廃・オープン中央配置ストリーム） */}
      <div className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
        {filteredEntries.map((entry) => {
          const { archetype, isUnlocked, isOwnPartner, friends: matchedFriends } = entry;
          const group = GROUP_LABELS[archetype.groupName];
          const ambassadorCount = isOwnPartner ? matchedFriends.length + 1 : matchedFriends.length;

          return (
            <div
              key={entry.mbti}
              className="py-10 sm:py-14 flex flex-col items-center text-center first:pt-4 last:pb-10 select-none"
            >
              {/* 中央に水晶玉（Crystal Orb）を表示（シークレット時はもや＆「？」） */}
              <div className="mb-4">
                {renderCrystalOrb(entry, false)}
              </div>

              {/* その下に中央ぞろえで名前 */}
              <div className="flex flex-col items-center gap-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
                    style={{
                      color: archetype.primaryColor,
                      borderColor: isUnlocked ? `${archetype.primaryColor}40` : (isDarkMode ? '#404040' : '#d4d4d4'),
                      backgroundColor: isUnlocked ? `${archetype.primaryColor}15` : (isDarkMode ? '#262626' : '#f5f5f5'),
                    }}
                  >
                    {entry.mbti} • {group.name}
                  </span>
                  {isOwnPartner && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-google-blue text-white shadow-xs">
                      マイ・パートナー
                    </span>
                  )}
                </div>

                <h3
                  className={`text-xl sm:text-2xl font-bold tracking-tight ${
                    isUnlocked
                      ? isDarkMode ? 'text-neutral-100' : 'text-neutral-900'
                      : isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  {isUnlocked ? archetype.title : '??? モッフィー'}
                </h3>
              </div>

              {/* その下にどういう人格化を一言 */}
              <p
                className={`text-xs sm:text-sm max-w-sm sm:max-w-md mx-auto leading-relaxed mb-5 px-3 ${
                  isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                {isUnlocked
                  ? archetype.description
                  : `手がかり: 「${archetype.subtitle}」。まだこの性格のアンバサダーと出会っていません。`}
              </p>

              {/* その下に「この性格のアンバサダー一覧」というボタンを背景黒で表示 */}
              <button
                type="button"
                onClick={() => setSelectedEntry(entry)}
                className="min-h-[44px] px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-black hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-neutral-800"
              >
                <Users className="w-4 h-4" />
                <span>この性格のアンバサダー一覧</span>
                {isUnlocked && ambassadorCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-normal bg-neutral-800 text-neutral-300">
                    {ambassadorCount}人
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 詳細モーダル */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="モッフィー詳細"
          onClick={() => setSelectedEntry(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-3xl border p-5 max-h-[85vh] overflow-y-auto relative shadow-2xl transition-colors ${
              isDarkMode ? 'border-neutral-800 bg-neutral-950 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-900'
            }`}
          >
            {/* 閉じるボタン (44x44px タッチターゲット確保) */}
            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center transition border border-neutral-700/40 text-neutral-400 hover:text-white hover:bg-neutral-800/40 cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedEntry.isUnlocked ? (
              // アンロック済み詳細
              <div className="space-y-4">
                {/* ヘッダー水晶玉 ＆ タイトル */}
                <div className="text-center">
                  <div className="mx-auto mb-3 flex items-center justify-center">
                    {renderCrystalOrb(selectedEntry, true)}
                  </div>

                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold mb-1 border"
                    style={{
                      color: selectedEntry.archetype.primaryColor,
                      borderColor: `${selectedEntry.archetype.primaryColor}50`,
                      backgroundColor: `${selectedEntry.archetype.primaryColor}15`,
                    }}
                  >
                    <span>{selectedEntry.mbti}</span>
                    <span>•</span>
                    <span>{GROUP_LABELS[selectedEntry.archetype.groupName].name}</span>
                  </div>

                  <h3 className="text-base font-bold tracking-tight">
                    {selectedEntry.archetype.title}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {selectedEntry.archetype.subtitle}
                  </p>
                </div>

                {/* 出会ったアンバサダー一覧（最優先表示） */}
                <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50'}`}>
                  <div className="flex items-center justify-between gap-1.5 text-xs font-bold mb-2.5">
                    <div className="flex items-center gap-1.5 text-google-blue">
                      <Users className="w-4 h-4" />
                      <span>この性格のアンバサダー</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-google-blue/10 text-google-blue border border-google-blue/20">
                      {selectedEntry.isOwnPartner ? selectedEntry.friends.length + 1 : selectedEntry.friends.length}人
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {selectedEntry.isOwnPartner && (
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'
                      }`}>
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-google-blue shrink-0" />
                          <span className="font-bold truncate">あなた ({session?.nickname || user?.nickname || user?.name || 'パートナー'})</span>
                        </div>
                        <span className="text-[10px] text-google-blue font-bold px-1.5 py-0.5 rounded bg-google-blue/10">MY MOFFY</span>
                      </div>
                    )}

                    {selectedEntry.friends.map((f) => {
                      const fName = f.nickname?.trim() || f.name?.trim() || `@${f.discord_user_id}`;
                      return (
                        <a
                          key={f.discord_user_id}
                          href={`./share.html?id=${encodeURIComponent(f.discord_user_id)}&mbti=${encodeURIComponent(f.mbti)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                            isDarkMode
                              ? 'border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300'
                              : 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="font-medium truncate">{fName}</span>
                            {f.university && (
                              <span className="text-[10px] text-neutral-500 truncate">({f.university})</span>
                            )}
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        </a>
                      );
                    })}

                    {!selectedEntry.isOwnPartner && selectedEntry.friends.length === 0 && (
                      <div className="text-center py-3 text-xs text-neutral-500">
                        まだこの性格のアンバサダーとはフレンド交換していません
                      </div>
                    )}
                  </div>
                </div>

                {/* シグネチャーアクセサリー（固有装備ギア） */}
                <div className={`p-3 rounded-2xl border text-xs ${isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50'}`}>
                  <div className="flex items-center gap-1.5 text-google-blue font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>愛用シグネチャーギア</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    {selectedEntry.archetype.signatureAccessory || selectedEntry.archetype.luckyItem}
                  </p>
                </div>

                {/* 性格説明 */}
                <div className="text-xs leading-relaxed space-y-1.5">
                  <div className="font-bold text-neutral-400">モッフィーの性格と役割</div>
                  <p className={isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}>
                    {selectedEntry.archetype.description}
                  </p>
                </div>

                {/* 特徴タグ */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntry.archetype.traits.map((trait, idx) => (
                    <span
                      key={idx}
                      className={`text-[11px] px-2 py-0.5 rounded-md border ${
                        isDarkMode
                          ? 'border-neutral-800 bg-neutral-900 text-neutral-300'
                          : 'border-neutral-200 bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {/* パラメータ値 */}
                <div className={`p-3 rounded-2xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50'}`}>
                  <div className="text-[11px] font-bold text-neutral-400 mb-2">能力ステータス</div>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    {[
                      { label: 'INT (知性・分析力)', val: selectedEntry.archetype.stats.int, color: '#8b5cf6' },
                      { label: 'CHA (共感・魅力)', val: selectedEntry.archetype.stats.cha, color: '#ec4899' },
                      { label: 'SPD (機動力・実行)', val: selectedEntry.archetype.stats.spd, color: '#3b82f6' },
                      { label: 'DEF (継続力・信頼)', val: selectedEntry.archetype.stats.def, color: '#10b981' },
                    ].map((st) => (
                      <div key={st.label} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-neutral-400 truncate">{st.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-neutral-700/30 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${st.val}%`, backgroundColor: st.color }}
                            />
                          </div>
                          <span className="w-6 text-right font-bold">{st.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // ロック中詳細
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto mb-3 flex items-center justify-center">
                  {renderCrystalOrb(selectedEntry, true)}
                </div>

                <div>
                  <span className="text-xs font-mono font-bold text-neutral-400 px-2 py-0.5 rounded border border-neutral-700">
                    {selectedEntry.mbti} • {GROUP_LABELS[selectedEntry.archetype.groupName].name}
                  </span>
                  <h3 className="text-base font-bold mt-2 text-neutral-300">
                    まだ出会っていないモッフィー
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    この性格タイプ（{selectedEntry.mbti}）を持つアンバサダーとまだフレンド交換していません。
                  </p>
                </div>

                <div className={`p-3 rounded-2xl border text-left text-xs ${isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-50'}`}>
                  <div className="text-[11px] font-bold text-neutral-400 mb-1">モッフィーの手がかり</div>
                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    「{selectedEntry.archetype.subtitle}」。{selectedEntry.archetype.traits.join('、')}といった特徴を持っています。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEntry(null);
                    onGoToExchange();
                  }}
                  className="w-full min-h-[44px] rounded-full font-bold text-xs text-white bg-google-blue hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <QrCode className="w-4 h-4" />
                  <span>フレンド交換で新しい性格を探す</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoffyDexTab;
