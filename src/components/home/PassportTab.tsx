import React, { useState, useRef } from 'react';
import type { UserMoffySession, MbtiType } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { MBTI_ARCHETYPES } from '../../data/personalityQuestions';

interface PassportTabProps {
  user: AuthUser | null;
  session: UserMoffySession | null;
  isDarkMode: boolean;
  onStyleChange?: (style: 'normal' | 'equipped') => void;
}

export const PassportTab: React.FC<PassportTabProps> = ({
  user,
  session,
  isDarkMode,
  onStyleChange,
}) => {
  // 初期スタイル: session または localStorage から復元
  const getInitialStyle = (): 'normal' | 'equipped' => {
    if (session?.preferredStyle) return session.preferredStyle;
    try {
      const saved = localStorage.getItem('moffy_preferred_style');
      if (saved === 'normal' || saved === 'equipped') return saved;
    } catch {
      // ignore
    }
    return 'equipped';
  };

  const [activeMode, setActiveMode] = useState<'normal' | 'equipped'>(getInitialStyle);

  // タッチスワイプ / ドラッグ判定用の ref
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const mouseStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);

  const rawMbti = session?.mbti || user?.mbti || 'INTJ';
  const mbti: MbtiType = (rawMbti in MBTI_ARCHETYPES) ? (rawMbti as MbtiType) : 'INTJ';
  const archetype = MBTI_ARCHETYPES[mbti] || MBTI_ARCHETYPES.INTJ;

  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
  const defaultMoffyImg = archetype.officialImageUrl
    ? archetype.officialImageUrl.startsWith('http')
      ? archetype.officialImageUrl
      : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
    : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`;

  // 画像ソースの整理（ノーマル vs 装備）
  const normalImgSrc = session?.defaultPhotoUrl || user?.default_photo_url || defaultMoffyImg;
  const equippedImgSrc = session?.arrangedPhotoUrl || user?.arranged_photo_url || normalImgSrc;
  const canToggle = equippedImgSrc !== normalImgSrc;

  // モード切替 ＆ 永続化（QR連動用）
  const handleModeChange = (mode: 'normal' | 'equipped') => {
    setActiveMode(mode);
    try {
      localStorage.setItem('moffy_preferred_style', mode);
      // セッションオブジェクトの同期（prop を直接 mutate せずにクローン保存）
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

  const toggleMode = () => {
    const nextMode = activeMode === 'equipped' ? 'normal' : 'equipped';
    handleModeChange(nextMode);
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
        handleModeChange('normal');
      } else {
        handleModeChange('equipped');
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
        handleModeChange('normal');
      } else {
        handleModeChange('equipped');
      }
    } else {
      toggleMode();
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
            onTouchStart={canToggle ? handleTouchStart : undefined}
            onTouchEnd={canToggle ? handleTouchEnd : undefined}
            onMouseDown={canToggle ? handleMouseDown : undefined}
            onMouseUp={canToggle ? handleMouseUp : undefined}
            className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden flex items-center justify-center border backdrop-blur-xl transition-all duration-500 ease-out ${
              isDarkMode
                ? 'border-white/30 bg-gradient-to-b from-white/15 via-transparent to-black/60'
                : 'border-white/80 bg-gradient-to-b from-white/60 via-transparent to-neutral-200/50 shadow-xl'
            } ${
              canToggle ? 'cursor-grab active:cursor-grabbing hover:border-white/60 transition-colors' : ''
            }`}
            style={{
              boxShadow: isDarkMode
                ? `0 0 50px ${archetype.primaryColor}55, inset 0 0 35px rgba(255,255,255,0.25), 0 0 70px rgba(0,0,0,0.8)`
                : `0 0 40px ${archetype.primaryColor}33, inset 0 0 30px rgba(255,255,255,0.8), 0 12px 36px rgba(0,0,0,0.12)`,
            }}
            title={canToggle ? 'スワイプまたはタップでスタイル切替' : undefined}
          >
            {/* 内部の微細な環境カラーグラデーション */}
            <div
              className="absolute inset-0 rounded-full blur-md pointer-events-none opacity-30"
              style={{
                background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${archetype.accentColor} 40%, ${archetype.primaryColor} 70%, transparent 95%)`,
              }}
            />

            {/* 水晶の内部で優雅に無重力浮遊するモッフィー */}
            <div className="relative z-10 w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center animate-crystal-float">
              {/* ノーマルモッフィー */}
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

              {/* アクセサリー装備モッフィー */}
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
            </div>

            {/* ガラス表面の光沢ハイライト */}
            <div className="absolute top-2 left-6 right-6 h-20 rounded-full bg-gradient-to-b from-white/35 to-transparent pointer-events-none blur-[1px]" />
          </div>
        </div>

        {/* スタイル切替ピルタブ ＆ 操作ガイド */}
        {canToggle && (
          <div className="relative z-20 flex flex-col items-center gap-2 mt-2">
            <div className={`inline-flex items-center p-0.5 rounded-full border backdrop-blur-md ${
              isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-neutral-100 border-neutral-200 shadow-sm'
            }`}>
              <button
                type="button"
                onClick={() => handleModeChange('normal')}
                className={`px-4 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
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
                className={`px-4 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all duration-200 cursor-pointer ${
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
            </div>
            <span className={`text-[11px] font-mono tracking-wider select-none ${
              isDarkMode ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              ‹ 水晶をスワイプまたはタップで切替 ›
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
