import React, { useState, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import type { UserMoffySession, MbtiType, MoffyIconStyle } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { MBTI_ARCHETYPES } from '../../data/personalityQuestions';

interface PassportTabProps {
  user: AuthUser | null;
  session: UserMoffySession | null;
  isDarkMode: boolean;
  preferredStyle?: MoffyIconStyle;
  discordAvatarUrl?: string;
  onStyleChange?: (style: MoffyIconStyle) => void;
}

export const PassportTab: React.FC<PassportTabProps> = ({
  user,
  session,
  isDarkMode,
  preferredStyle,
  discordAvatarUrl,
  onStyleChange,
}) => {
  // 🌟 性格診断受講・モッフィー作成済み判定
  const hasMoffy = Boolean(
    session?.mbti ||
    user?.mbti ||
    session?.arrangedPhotoUrl ||
    session?.defaultPhotoUrl ||
    user?.arranged_photo_url ||
    user?.default_photo_url
  );

  // 初期スタイル: preferredStyle prop, session または localStorage から復元
  const getInitialStyle = (): MoffyIconStyle => {
    if (preferredStyle) return preferredStyle;
    if (session?.preferredStyle) return session.preferredStyle;
    try {
      const saved = localStorage.getItem('moffy_preferred_style');
      if (saved === 'normal' || saved === 'equipped' || saved === 'discord') {
        return saved as MoffyIconStyle;
      }
    } catch {
      // ignore
    }
    return 'equipped';
  };

  const [localMode, setLocalMode] = useState<MoffyIconStyle>(getInitialStyle);
  const activeMode: MoffyIconStyle = preferredStyle || localMode;
  const [discordImgError, setDiscordImgError] = useState(false);

  // タッチスワイプ / ドラッグ判定用の ref
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  const rawMbti = session?.mbti || user?.mbti || 'INTJ';
  const mbti: MbtiType = (rawMbti in MBTI_ARCHETYPES) ? (rawMbti as MbtiType) : 'INTJ';
  const archetype = MBTI_ARCHETYPES[mbti] || MBTI_ARCHETYPES.INTJ;

  // 🌟 アンバサダー称号判定
  const isAmbassador = Boolean(session?.isAmbassador ?? user?.is_ambassador ?? user?.isAmbassador);

  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
  const defaultMoffyImg = archetype.officialImageUrl
    ? archetype.officialImageUrl.startsWith('http')
      ? archetype.officialImageUrl
      : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
    : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`;

  // 画像ソースの整理（ノーマル vs 装備 vs Discord）
  const normalImgSrc = session?.defaultPhotoUrl || user?.default_photo_url || defaultMoffyImg;
  const equippedImgSrc = session?.arrangedPhotoUrl || user?.arranged_photo_url || normalImgSrc;
  const discordImgSrc = discordAvatarUrl || user?.photo_url || '';
  const canToggle = hasMoffy;

  // モード切替 ＆ 永続化（QR・プロフィール・パートナーカード連動用）
  const handleModeChange = (mode: MoffyIconStyle) => {
    setLocalMode(mode);
    try {
      localStorage.setItem('moffy_preferred_style', mode);
      if (session) {
        const updatedSession = { ...session, preferredStyle: mode };
        const storageKey = `moffy_user_session_${session.discordUserId}`;
        localStorage.setItem(storageKey, JSON.stringify(updatedSession));
      }
    } catch (e) {
      console.warn('Failed to save preferred moffy style:', e);
    }
    onStyleChange?.(mode);
  };

  // 3択ループ切替: normal ➔ equipped ➔ discord ➔ normal
  const toggleModeNext = () => {
    const nextMode: MoffyIconStyle =
      activeMode === 'normal' ? 'equipped' : activeMode === 'equipped' ? 'discord' : 'normal';
    handleModeChange(nextMode);
  };

  const toggleModePrev = () => {
    const prevMode: MoffyIconStyle =
      activeMode === 'normal' ? 'discord' : activeMode === 'discord' ? 'equipped' : 'normal';
    handleModeChange(prevMode);
  };

  // タッチスワイプ処理
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 24 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX > 0) {
        toggleModePrev();
      } else {
        toggleModeNext();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // マウスドラッグ / クリック処理
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    isDragging.current = true;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current || mouseStartX.current === null) return;
    isDragging.current = false;
    const deltaX = e.clientX - mouseStartX.current;
    if (Math.abs(deltaX) > 24) {
      if (deltaX > 0) {
        toggleModePrev();
      } else {
        toggleModeNext();
      }
    } else {
      toggleModeNext();
    }
    mouseStartX.current = null;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[68vh] py-6 select-none">
      {/* 🌟 大型水晶球体（Crystal Orb） ＆ 無重力浮遊モッフィー */}
      <div className={`w-full max-w-sm p-8 rounded-3xl border text-center flex flex-col items-center justify-center relative overflow-hidden shadow-md transition-all ${
        isDarkMode
          ? 'border-neutral-800/90 bg-gradient-to-b from-neutral-900/90 via-neutral-950 to-black text-white shadow-black/40'
          : 'border-neutral-200 bg-gradient-to-b from-white via-neutral-50 to-neutral-100 text-neutral-900 shadow-neutral-200/50'
      }`}>
        {/* 背景の柔らかなモッフィーテーマカラー環境光 */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[110px] pointer-events-none opacity-35 transition-all duration-700"
          style={{ backgroundColor: archetype.primaryColor }}
        />

        {/* 水晶球体コンテナ */}
        <div className="relative z-10 my-6 flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
          {/* 外周を旋回する繊細な幾何学リング */}
          <div
            className="absolute inset-0 rounded-full border border-dashed pointer-events-none animate-spin-slow"
            style={{ borderColor: `${archetype.accentColor}66` }}
          />
          <div
            className={`absolute -inset-3 rounded-full border pointer-events-none animate-spin-slow-reverse ${
              isDarkMode ? 'border-white/10' : 'border-neutral-300/80'
            }`}
          />

          {/* 水晶球体本体 (スワイプ・ドラッグ・タップでスタイル切替) */}
          <div
            data-tutorial-id="tutorial-crystal-orb"
            onClick={canToggle ? toggleModeNext : undefined}
            onTouchStart={canToggle ? handleTouchStart : undefined}
            onTouchEnd={canToggle ? handleTouchEnd : undefined}
            onMouseDown={canToggle ? handleMouseDown : undefined}
            onMouseUp={canToggle ? handleMouseUp : undefined}
            className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden flex items-center justify-center border backdrop-blur-xl transition-all duration-500 ease-out ${
              isDarkMode
                ? 'border-white/30 bg-gradient-to-b from-white/15 via-transparent to-black/60'
                : 'border-white/80 bg-gradient-to-b from-white/60 via-transparent to-neutral-200/50 shadow-xl'
            } ${
              canToggle ? 'cursor-pointer active:scale-[0.98] hover:border-white/60 transition-all' : ''
            }`}
            style={{
              boxShadow: isDarkMode
                ? `0 0 50px ${archetype.primaryColor}55, inset 0 0 35px rgba(255,255,255,0.25), 0 0 70px rgba(0,0,0,0.8)`
                : `0 0 40px ${archetype.primaryColor}33, inset 0 0 30px rgba(255,255,255,0.8), 0 12px 36px rgba(0,0,0,0.12)`,
            }}
            title={canToggle ? 'タップまたはスワイプでアイコン切替' : undefined}
          >
            {/* 内部の微細な環境カラーグラデーション */}
            <div
              className="absolute inset-0 rounded-full blur-md pointer-events-none opacity-30"
              style={{
                background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${archetype.accentColor} 40%, ${archetype.primaryColor} 70%, transparent 95%)`,
              }}
            />

            {/* 水晶の内部で優雅に無重力浮遊するアイコン */}
            <div className="relative z-10 w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center animate-crystal-float">
              {hasMoffy ? (
                <>
                  {/* 1. ノーマルモッフィー */}
                  <img
                    src={normalImgSrc}
                    alt={`${archetype.title} (Normal)`}
                    className={`absolute inset-0 w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] transition-all duration-500 ease-out ${
                      activeMode === 'normal'
                        ? 'opacity-100 scale-100 translate-x-0'
                        : 'opacity-0 scale-90 -translate-x-6 pointer-events-none'
                    }`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`;
                    }}
                  />

                  {/* 2. アクセサリー装備モッフィー */}
                  <img
                    src={equippedImgSrc}
                    alt={`${archetype.title} (Equipped)`}
                    className={`absolute inset-0 w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] transition-all duration-500 ease-out ${
                      activeMode === 'equipped'
                        ? 'opacity-100 scale-100 translate-x-0'
                        : 'opacity-0 scale-90 translate-x-6 pointer-events-none'
                    }`}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = normalImgSrc;
                    }}
                  />

                  {/* 3. Discord プロフィール画像 */}
                  {discordImgSrc && !discordImgError ? (
                    <img
                      src={discordImgSrc}
                      alt="Discord Profile"
                      onError={() => setDiscordImgError(true)}
                      className={`absolute inset-0 w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] ring-2 ring-white/40 transition-all duration-500 ease-out ${
                        activeMode === 'discord'
                          ? 'opacity-100 scale-100 translate-y-0'
                          : 'opacity-0 scale-90 translate-y-6 pointer-events-none'
                      }`}
                    />
                  ) : (
                    <div
                      className={`absolute inset-0 w-full h-full rounded-full flex flex-col items-center justify-center font-mono text-xs transition-all duration-500 ring-2 ring-white/30 ${
                        activeMode === 'discord'
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 scale-90 pointer-events-none'
                      } ${isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200 text-neutral-700'}`}
                    >
                      Discord
                    </div>
                  )}
                </>
              ) : (
                /* 🌟 未診断時: Discordプロフィール画像を表示（万一取得不可時は「？」にフォールバック） */
                discordImgSrc && !discordImgError ? (
                  <img
                    src={discordImgSrc}
                    alt="Discord Profile"
                    onError={() => setDiscordImgError(true)}
                    className="w-36 h-36 sm:w-44 sm:h-44 object-cover rounded-full select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)] ring-2 ring-white/40"
                  />
                ) : (
                  <span className="text-7xl sm:text-8xl font-light font-mono text-neutral-400 dark:text-neutral-500 select-none drop-shadow-sm">
                    ?
                  </span>
                )
              )}
            </div>

            {/* ガラス表面の光沢ハイライト */}
            <div className="absolute top-2 left-6 right-6 h-20 rounded-full bg-gradient-to-b from-white/35 to-transparent pointer-events-none blur-[1px]" />
          </div>
        </div>

        {/* スタイル切替ピルタブ ＆ 操作ガイド（モッフィー作成済みユーザーのみ表示） */}
        {hasMoffy && canToggle && (
          <div className="relative z-20 flex flex-col items-center gap-2 mt-2">
            <div className={`inline-flex items-center p-0.5 rounded-full border backdrop-blur-md ${
              isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-neutral-100 border-neutral-200 shadow-sm'
            }`}>
              <button
                type="button"
                onClick={() => handleModeChange('normal')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                  activeMode === 'normal'
                    ? isDarkMode
                      ? 'bg-white/20 text-white font-semibold shadow-sm'
                      : 'bg-white text-neutral-900 font-semibold shadow-sm'
                    : isDarkMode
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                NORMAL
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('equipped')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                  activeMode === 'equipped'
                    ? isDarkMode
                      ? 'bg-white/20 text-white font-semibold shadow-sm'
                      : 'bg-white text-neutral-900 font-semibold shadow-sm'
                    : isDarkMode
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                EQUIPPED
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('discord')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
                  activeMode === 'discord'
                    ? isDarkMode
                      ? 'bg-white/20 text-white font-semibold shadow-sm'
                      : 'bg-white text-neutral-900 font-semibold shadow-sm'
                    : isDarkMode
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                DISCORD
              </button>
            </div>
            <span className={`text-[11px] font-mono tracking-wider select-none ${
              isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              ‹ 水晶をタップでアイコン切替 ›
            </span>
          </div>
        )}

        {/* 🌟 アンバサダー認証バッジ称号 */}
        {isAmbassador && (
          <div className="relative z-20 mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#8ab4f8]/15 dark:text-[#8ab4f8] border border-[#1a73e8]/20 dark:border-[#8ab4f8]/30 animate-fade-in shadow-xs">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
              <path fillRule="evenodd" d="M8 0c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm3.22 5.22a.75.75 0 00-1.06-1.06L6.5 7.82 5.34 6.66a.75.75 0 10-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l4.13-4.25z" clipRule="evenodd" />
            </svg>
            <span>Google AI 学生アンバサダー</span>
          </div>
        )}
      </div>

      {/* 🌟 未受講時のみ表示されるチュートリアルセクション（受講後は完全非表示） */}
      {!hasMoffy && (
        <div className={`mt-6 w-full max-w-sm rounded-2xl p-5 border text-center space-y-3.5 transition-colors ${
          isDarkMode
            ? 'border-neutral-800 bg-neutral-900/60 text-neutral-100'
            : 'border-neutral-200 bg-white text-neutral-900 shadow-sm'
        }`}>
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#1a73e8] dark:text-[#8ab4f8]">
              チュートリアル
            </span>
            <h3 className="text-sm sm:text-base font-semibold">
              あなただけの相棒を見つけよう
            </h3>
            <p className={`text-xs leading-relaxed ${
              isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
            }`}>
              性格診断（全16問）を受けて、あなたの個性を宿したパートナーモッフィーと出会いましょう。
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = './index.html?start_quiz=true';
            }}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-[#1a73e8] hover:bg-[#1557b0] transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>性格診断を受ける</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
