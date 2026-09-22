import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, X, ChevronRight, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { TUTORIAL_STEPS } from '../../types';

interface TutorialOverlayProps {
  currentStep: number;
  onNextStep: (fromStep: number) => void;
  onSkip: () => void;
  isDarkMode: boolean;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  currentStep,
  onNextStep,
  onSkip,
  isDarkMode,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  const stepIndex = Math.min(Math.max(currentStep - 1, 0), TUTORIAL_STEPS.length - 1);
  const stepConfig = TUTORIAL_STEPS[stepIndex];

  // ターゲット要素の位置を取得・追従
  const updateTargetRect = useCallback(() => {
    if (!stepConfig) return;
    const el = document.querySelector(stepConfig.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      // 有効な寸法がある場合のみセット
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        setIsReady(true);
        return;
      }
    }
    // まだ描画されていない場合は待機
    setIsReady(false);
  }, [stepConfig]);

  useEffect(() => {
    const initRaf = requestAnimationFrame(() => {
      updateTargetRect();
    });

    // 画面外の場合はスムーズにスクロール
    const el = document.querySelector(stepConfig.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }

    const handleResizeOrScroll = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        updateTargetRect();
      });
    };

    window.addEventListener('resize', handleResizeOrScroll, { passive: true });
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true, capture: true });

    // DOM変化の監視（タブ遷移や非同期ローディング対応）
    const observer = new MutationObserver(() => {
      updateTargetRect();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    // 定期的な短インターバルポーリング（描画アニメーション追従）
    const interval = setInterval(updateTargetRect, 250);

    return () => {
      cancelAnimationFrame(initRaf);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      observer.disconnect();
      clearInterval(interval);
    };
  }, [stepConfig, updateTargetRect]);

  // ターゲット要素への実クリックをキャプチャして次ステップへ進行
  useEffect(() => {
    if (!stepConfig) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleGlobalClick = (e: MouseEvent) => {
      const targetEl = document.querySelector(stepConfig.selector);
      if (!targetEl) return;

      const clickTarget = e.target as Node | null;
      if (clickTarget && (targetEl === clickTarget || targetEl.contains(clickTarget))) {
        // ターゲットが実際にクリックされた！
        // 少しディレイを設けて、要素本来のクリック処理（タブ遷移・コピー等）が走った後に次ステップへ進める
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          if (stepConfig.id === 5) {
            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#4285f4', '#ea4335', '#fbbc04', '#34a853'],
              });
            } catch {
              // ignore
            }
          }
          onNextStep(stepConfig.id);
        }, 300);
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, [stepConfig, onNextStep]);

  const handleFinalStepComplete = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#4285f4', '#ea4335', '#fbbc04', '#34a853'],
      });
    } catch {
      // ignore
    }
    onNextStep(stepConfig.id);
  };

  // スポットライト位置・サイズ（パディング付加）
  const padding = 8;
  const spotStyle = targetRect
    ? {
        top: Math.max(0, targetRect.top - padding),
        left: Math.max(0, targetRect.left - padding),
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  // ポップオーバーの配置計算（画面上下どちらの空きスペースが大きいかで決定）
  const isTargetInUpperHalf = targetRect ? targetRect.top < window.innerHeight / 2 : true;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none transition-all duration-300">
      {/* 1. 背景暗幕マスク（ターゲットスポットライトのくり抜き） */}
      {spotStyle && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{
            background: 'rgba(0, 0, 0, 0.72)',
            clipPath: `polygon(
              0% 0%, 0% 100%, 100% 100%, 100% 0%,
              0% 0%,
              ${spotStyle.left}px ${spotStyle.top}px,
              ${spotStyle.left}px ${spotStyle.top + spotStyle.height}px,
              ${spotStyle.left + spotStyle.width}px ${spotStyle.top + spotStyle.height}px,
              ${spotStyle.left + spotStyle.width}px ${spotStyle.top}px,
              ${spotStyle.left}px ${spotStyle.top}px
            )`,
          }}
          onClick={(e) => {
            // 暗幕クリック時は背景要素の誤操作を防止
            e.stopPropagation();
          }}
        />
      )}

      {!spotStyle && (
        <div className="absolute inset-0 bg-black/70 pointer-events-auto" />
      )}

      {/* 2. ターゲット要素を強調するハイライト枠 ＆ Googleカラーパルスリング */}
      {spotStyle && isReady && (
        <div
          style={{
            position: 'absolute',
            top: spotStyle.top,
            left: spotStyle.left,
            width: spotStyle.width,
            height: spotStyle.height,
            borderRadius: '24px',
          }}
          className="pointer-events-none transition-all duration-300 ring-2 ring-white/90 shadow-[0_0_24px_rgba(66,133,244,0.7)] animate-pulse"
        >
          {/* 外周のGoogle 4色グラデーションリング */}
          <div
            className="absolute -inset-1 rounded-[28px] opacity-75 blur-[2px] animate-spin-slow pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, #4285f4, #ea4335, #fbbc04, #34a853, #4285f4)',
            }}
          />
        </div>
      )}

      {/* 3. 指アイコン・誘導バウンスポインター */}
      {spotStyle && isReady && (
        <div
          style={{
            position: 'absolute',
            ...(stepConfig.pointerDirection === 'down'
              ? {
                  top: Math.max(12, spotStyle.top - 58),
                  left: spotStyle.left + spotStyle.width / 2 - 24,
                }
              : {
                  top: Math.min(window.innerHeight - 60, spotStyle.top + spotStyle.height + 14),
                  left: spotStyle.left + spotStyle.width / 2 - 24,
                }),
          }}
          className="pointer-events-none z-50 flex flex-col items-center animate-bounce"
        >
          {stepConfig.pointerDirection === 'down' ? (
            <div className="flex flex-col items-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
              <span className="text-3xl filter drop-shadow">👇</span>
              <span className="text-[10px] font-bold text-white bg-[#1a73e8] px-2 py-0.5 rounded-full shadow-md mt-0.5 tracking-wider">
                タップ！
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
              <span className="text-[10px] font-bold text-white bg-[#1a73e8] px-2 py-0.5 rounded-full shadow-md mb-0.5 tracking-wider">
                タップ！
              </span>
              <span className="text-3xl filter drop-shadow">👆</span>
            </div>
          )}
        </div>
      )}

      {/* 4. 説明ポップオーバー（カード） */}
      <div className="absolute inset-x-0 mx-auto max-w-md px-4 pointer-events-none flex justify-center"
        style={{
          ...(isTargetInUpperHalf
            ? { bottom: '84px' }
            : { top: '80px' }),
        }}
      >
        <div
          className={`pointer-events-auto w-full rounded-2xl p-4 sm:p-5 shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
            isDarkMode
              ? 'bg-neutral-900/95 border-neutral-700 text-neutral-100 shadow-black/80'
              : 'bg-white/95 border-neutral-200 text-neutral-900 shadow-xl'
          }`}
        >
          {/* 上部: ステップ進行インジケーター ＆ スキップボタン */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-200/40 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4285f4] animate-ping" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#4285f4]">
                TUTORIAL {currentStep} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            <button
              onClick={onSkip}
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 transition cursor-pointer ${
                isDarkMode
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
              title="チュートリアルをスキップ"
            >
              スキップ
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* タイトルと説明文 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#fbbc04] shrink-0" />
              <h3 className="text-sm sm:text-base font-bold tracking-tight">
                {stepConfig.title}
              </h3>
            </div>
            <p className={`text-xs sm:text-sm leading-relaxed ${
              isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
            }`}>
              {stepConfig.description}
            </p>
          </div>

          {/* 促しガイダンス ＆ アクション補助ボタン */}
          <div className="mt-3 pt-3 border-t border-neutral-200/40 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#1a73e8] dark:text-[#8ab4f8] flex items-center gap-1">
              <span>👉</span>
              <span className="font-semibold">{stepConfig.actionPrompt}</span>
            </span>

            {/* 最終ステップまたは手動フォールバック用「次へ」ボタン */}
            {stepConfig.id === 5 ? (
              <button
                onClick={handleFinalStepComplete}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#4285f4] to-[#34a853] hover:opacity-95 shadow-md flex items-center gap-1 cursor-pointer"
              >
                <span>冒険をはじめる！</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onNextStep(stepConfig.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-0.5 transition cursor-pointer ${
                  isDarkMode
                    ? 'text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800'
                    : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200'
                }`}
                title="次のステップへ"
              >
                <span>次へ</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
