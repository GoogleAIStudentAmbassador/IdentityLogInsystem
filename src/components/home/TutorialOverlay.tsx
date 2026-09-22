import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, Check } from 'lucide-react';
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
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        setIsReady(true);
        return;
      }
    }
    setIsReady(false);
  }, [stepConfig]);

  useEffect(() => {
    const initRaf = requestAnimationFrame(() => {
      updateTargetRect();
    });

    // 画面外またはスクロール対象の場合は自動でスムーズスクロール
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

    // DOM変化・タブ遷移の監視
    const observer = new MutationObserver(() => {
      updateTargetRect();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    // 定期ポーリング（スクロール完了やレンダリング追従）
    const interval = setInterval(updateTargetRect, 200);

    return () => {
      cancelAnimationFrame(initRaf);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      observer.disconnect();
      clearInterval(interval);
    };
  }, [stepConfig, updateTargetRect]);

  // ターゲット要素への実クリックをキャプチャ（Step 1 でプロフィールアイコン直接タップを検知）
  useEffect(() => {
    if (!stepConfig) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleGlobalClick = (e: MouseEvent) => {
      // Step 1 などの実クリック誘導時
      const targetEl = document.querySelector(stepConfig.selector);
      if (!targetEl) return;

      const clickTarget = e.target as Node | null;
      if (clickTarget && (targetEl === clickTarget || targetEl.contains(clickTarget))) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          onNextStep(stepConfig.id);
        }, 250);
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, [stepConfig, onNextStep]);

  // スポットライト位置・サイズ（余白付加）
  const padding = 6;
  const spotStyle = targetRect
    ? {
        top: Math.max(0, targetRect.top - padding),
        left: Math.max(0, targetRect.left - padding),
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  // ポップオーバーの上下配置判定（ターゲットが画面下部にあれば上部に表示）
  const isTargetInLowerHalf = targetRect ? targetRect.top > window.innerHeight * 0.45 : false;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none transition-all duration-300">
      {/* 1. 背景暗幕マスク（ターゲット要素のスポットライトくり抜き） */}
      {spotStyle && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
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
            e.stopPropagation();
          }}
        />
      )}

      {!spotStyle && (
        <div className="absolute inset-0 bg-black/65 pointer-events-auto" />
      )}

      {/* 2. ターゲット枠線ハイライト（単色・端正なフォーカスリング） */}
      {spotStyle && isReady && (
        <div
          style={{
            position: 'absolute',
            top: spotStyle.top,
            left: spotStyle.left,
            width: spotStyle.width,
            height: spotStyle.height,
            borderRadius: '16px',
          }}
          className="pointer-events-none transition-all duration-200 ring-2 ring-[#1a73e8] dark:ring-[#8ab4f8] shadow-sm"
        />
      )}

      {/* 3. ガイドポップオーバー（低認知負荷・脱AIスロップ設計） */}
      <div
        className="absolute inset-x-0 mx-auto max-w-sm px-4 pointer-events-none flex justify-center"
        style={{
          ...(isTargetInLowerHalf
            ? { top: '32px' }
            : { bottom: '40px' }),
        }}
      >
        <div
          className={`pointer-events-auto w-full rounded-2xl p-5 border shadow-xl transition-all duration-200 ${
            isDarkMode
              ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
              : 'bg-white border-neutral-200 text-neutral-900'
          }`}
        >
          {/* 上部: ステップ進行 & スキップボタン */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
              <span className="text-[11px] font-mono font-medium tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
                チュートリアル {currentStep} / {TUTORIAL_STEPS.length}
              </span>
            </div>
            <button
              onClick={onSkip}
              className={`text-xs font-medium px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                isDarkMode
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
              title="チュートリアルを終了"
            >
              スキップ
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* タイトルと説明文（端正なタイポグラフィ・絵文字ゼロ） */}
          <div className="space-y-1.5">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight">
              {stepConfig.title}
            </h3>
            <p className={`text-xs leading-relaxed ${
              isDarkMode ? 'text-neutral-300' : 'text-neutral-600'
            }`}>
              {stepConfig.description}
            </p>
          </div>

          {/* 下部アクション */}
          <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {stepConfig.actionPrompt}
            </span>

            {/* 最終ステップ（Step 3）: 完了ボタン */}
            {stepConfig.id === 3 ? (
              <button
                onClick={() => onNextStep(stepConfig.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1a73e8] hover:bg-[#1557b0] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>完了</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : stepConfig.id === 2 ? (
              /* Step 2: 次へ進むボタン */
              <button
                onClick={() => onNextStep(stepConfig.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1a73e8] hover:bg-[#1557b0] transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>次へ</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              /* Step 1: 実タップ誘導（手動進行補助ボタン付き） */
              <button
                onClick={() => onNextStep(stepConfig.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                  isDarkMode
                    ? 'text-neutral-300 bg-neutral-800 hover:bg-neutral-700'
                    : 'text-neutral-600 bg-neutral-100 hover:bg-neutral-200'
                }`}
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
