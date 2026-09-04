import React, { useState, useEffect, useRef } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import type { LikertQuestion } from '../types';
import { StarField } from './StarField';

interface QuizScreenProps {
  questions: LikertQuestion[];
  onFinish: (answers: Record<number, number>) => void;
  onDarknessChange?: (isDark: boolean) => void;
}

// 5段階の選択肢定義 (+2: 当てはまる(赤) 〜 0: 中立(青) 〜 -2: 当てはまらない(黄))
const LIKERT_OPTIONS = [
  {
    score: 2,
    label: '強く当てはまる',
    sizeClass: 'w-12 h-12 sm:w-14 sm:h-14',
    activeBg: 'bg-[#ea4335] text-white shadow-md scale-105',
    inactiveLight: 'border-[2.5px] border-[#ea4335] hover:bg-red-50 text-[#ea4335]',
    inactiveDark: 'border-[2.5px] border-[#ea4335] hover:bg-red-950/40 text-[#ea4335]',
  },
  {
    score: 1,
    label: 'やや当てはまる',
    sizeClass: 'w-10 h-10 sm:w-11 sm:h-11',
    activeBg: 'bg-[#ea4335]/85 text-white shadow-sm scale-105',
    inactiveLight: 'border-2 border-[#ea4335]/70 hover:bg-red-50/50 text-[#ea4335]/80',
    inactiveDark: 'border-2 border-[#ea4335]/70 hover:bg-red-950/30 text-[#ea4335]/80',
  },
  {
    score: 0,
    label: '中立',
    sizeClass: 'w-8 h-8 sm:w-9 sm:h-9',
    /* 🌟 中立は完全な Google Blue (#1a73e8) */
    activeBg: 'bg-[#1a73e8] text-white shadow-md shadow-blue-500/30 scale-105',
    inactiveLight: 'border-[2.5px] border-[#1a73e8] hover:bg-blue-50 text-[#1a73e8]',
    inactiveDark: 'border-[2.5px] border-[#1a73e8] hover:bg-blue-950/40 text-[#1a73e8] shadow-[0_0_8px_rgba(26,115,232,0.4)]',
  },
  {
    score: -1,
    label: 'やや当てはまらない',
    sizeClass: 'w-10 h-10 sm:w-11 sm:h-11',
    activeBg: 'bg-[#fbbc04]/90 text-white shadow-sm scale-105',
    inactiveLight: 'border-2 border-[#fbbc04]/80 hover:bg-yellow-50/50 text-[#fbbc04]',
    inactiveDark: 'border-2 border-[#fbbc04]/80 hover:bg-yellow-950/30 text-[#fbbc04]',
  },
  {
    score: -2,
    label: '全く当てはまらない',
    sizeClass: 'w-12 h-12 sm:w-14 sm:h-14',
    activeBg: 'bg-[#fbbc04] text-white shadow-md scale-105',
    inactiveLight: 'border-[2.5px] border-[#fbbc04] hover:bg-yellow-50 text-[#fbbc04]',
    inactiveDark: 'border-[2.5px] border-[#fbbc04] hover:bg-yellow-950/40 text-[#fbbc04]',
  },
];
export const QuizScreen: React.FC<QuizScreenProps> = ({ questions, onFinish, onDarknessChange }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [revealedCount, setRevealedCount] = useState(1);
  const [scrollY, setScrollY] = useState(0);
  const [answerPulse, setAnswerPulse] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // マウント時に確実にトップへスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  // スクロール検知
  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const totalQ = questions.length;
  const lastQuestionId = questions[totalQ - 1]?.id;
  const isLastQuestionRevealed = revealedCount === totalQ;
  const isLastQuestionAnswered = lastQuestionId !== undefined && touched.has(lastQuestionId);

  // ヘッダー・フッターの明暗切り替え：
  // 序盤（1〜10問目等）は全域が白〜極めて薄いグレーのため、スクロールしてもダーク化しない。
  // 実際に深層ダークゾーンに突入した時、またはラスト問題回答後にのみダーク化。
  const isHeaderDark =
    isLastQuestionAnswered ||
    (revealedCount >= 20 && scrollY > 2000) ||
    (isLastQuestionRevealed && scrollY > 1200);

  useEffect(() => {
    onDarknessChange?.(isHeaderDark);
  }, [isHeaderDark, onDarknessChange]);

  // 次の質問開放時にスムーズに下へスクロール
  useEffect(() => {
    if (scrollRef.current && revealedCount > 1) {
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [revealedCount]);

  const handleSelectScore = (questionId: number, score: number, index: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));

    // 🌟 回答した瞬間に中央の星へ推進パルスを発火（下へ移動したかのような残像を生成）
    setAnswerPulse((prev) => prev + 1);

    if (!touched.has(questionId)) {
      setTouched((prev) => {
        const newSet = new Set(prev);
        newSet.add(questionId);
        return newSet;
      });

      // 次の質問を開放
      if (index + 1 === revealedCount && revealedCount < totalQ) {
        setRevealedCount((prev) => prev + 1);
      }
    }
  };

  const handleFinish = () => {
    onFinish(answers);
  };

  const progress = Math.min((touched.size / totalQ) * 100, 100);

  // 🌟 背景グラデーションの動的生成：
  // 1問目（revealedCount === 1）の時は 100% 純白 (#ffffff)！
  // 質問が増えて下へ進むほど、下部が徐々にグレー〜黒へと広がる縦グラデーションになります。
  // ラスト問題に回答した瞬間、全体が #000000（漆黒）になります。
  const getBackground = (): string => {
    if (isLastQuestionAnswered) {
      return '#000000';
    }
    if (revealedCount <= 1) {
      return '#ffffff';
    }
    // 進行度 p (0.0 〜 1.0)
    const p = Math.min((revealedCount - 1) / Math.max(totalQ - 1, 1), 1.0);
    // 最下部の色: 進行度に応じて 255 (白) -> 0 (黒)
    const endRgb = Math.round(255 * (1 - p));
    // 中間点の色: 50%地点
    const midRgb = Math.round(255 * (1 - p * 0.45));
    return `linear-gradient(180deg, #ffffff 0%, rgb(${midRgb}, ${midRgb}, ${midRgb}) 50%, rgb(${endRgb}, ${endRgb}, ${endRgb}) 100%)`;
  };

  // 🌟 降下テレメトリ：高度（月軌道 384,400km 〜 地球地表 0km）
  const getAltitudeText = (ansCount: number, isLastAnswered: boolean): string => {
    if (isLastAnswered) return '0 km (TERRA SURFACE)';
    const altTable = [
      '384,400 km', // 0
      '320,000 km', // 1
      '240,000 km', // 2
      '160,000 km', // 3
      '90,000 km',  // 4
      '50,000 km',  // 5
      '35,786 km (GEO)', // 6
      '15,000 km',  // 7
      '5,000 km',   // 8
      '2,000 km (LEO)',  // 9
      '500 km',     // 10
      '100 km (KÁRMÁN)', // 11
      '0 km (TERRA)',    // 12
    ];
    return altTable[Math.min(ansCount, altTable.length - 1)];
  };

  // 🌟 生存残存シグナル（精子の3億個から唯一の受精 1個へ収束する伏線）
  const getSurvivalText = (ansCount: number, isLastAnswered: boolean): string => {
    if (isLastAnswered) return '1 / 300,000,000 (0.0000003%)';
    const survivalTable = [
      '300,000,000', // 0 (100%)
      '120,000,000', // 1
      '45,000,000',  // 2
      '10,000,000',  // 3
      '2,000,000',   // 4
      '350,000',     // 5
      '50,000',      // 6
      '5,000',       // 7
      '600',         // 8
      '80',          // 9
      '12',          // 10
      '2',           // 11
      '1 / 300,000,000', // 12
    ];
    return survivalTable[Math.min(ansCount, survivalTable.length - 1)];
  };

  return (
    <div
      className="relative w-full min-h-screen flex flex-col items-center pb-32 transition-all duration-700 ease-out"
      style={{ background: getBackground() }}
    >
      {/* 🌟 超軽量 Canvas 星空（周囲の星はスクロール追従、中央の星は固定＋回答時に下への推進残像を上空へ放つ） */}
      <StarField
        revealedCount={revealedCount}
        totalCount={totalQ}
        isBlackout={isLastQuestionAnswered}
        answerPulse={answerPulse}
        answerIndex={touched.size}
      />

      {/* スティッキー進捗ヘッダー */}
      <div
        className={`sticky top-12 left-0 right-0 z-30 px-6 py-2.5 flex justify-center w-full transition-colors duration-500 border-b ${
          isHeaderDark
            ? 'bg-black/85 border-white/10 text-white backdrop-blur-md'
            : 'bg-white/90 border-gray-100 text-gray-900 backdrop-blur-md'
        }`}
      >
        <div className="w-full max-w-sm">
          <div className="flex justify-between items-center mb-1">
            <span
              className={`text-xs font-semibold transition-colors duration-500 ${
                isHeaderDark ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              性格診断クイズ ({touched.size} / {totalQ})
            </span>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#1a73e8]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden transition-colors duration-500 ${
              isHeaderDark ? 'bg-white/15' : 'bg-gray-100'
            }`}
          >
            <div
              className="h-full bg-[#1a73e8] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 🌟 さりげない環境テレメトリ（高度計 ＆ 3億分の1生存率） */}
          <div
            className={`flex justify-between items-center mt-1.5 font-mono text-[9.5px] tracking-tight transition-colors duration-500 select-none ${
              isHeaderDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className={isHeaderDark ? 'text-gray-500' : 'text-gray-400'}>ALT:</span>
              <span className={`font-semibold ${isHeaderDark ? 'text-cyan-300' : 'text-blue-600'}`}>
                {getAltitudeText(touched.size, isLastQuestionAnswered)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className={isHeaderDark ? 'text-gray-500' : 'text-gray-400'}>SIGNALS:</span>
              <span
                className={`font-semibold ${
                  isLastQuestionAnswered
                    ? 'text-emerald-400 font-bold drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : isHeaderDark
                    ? 'text-amber-300'
                    : 'text-amber-600'
                }`}
              >
                {getSurvivalText(touched.size, isLastQuestionAnswered)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* イントロ案内（白ゾーンのトップ） */}
      <div className="relative z-10 w-full max-w-sm px-6 pt-6 text-left animate-fade-in">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          あなたの気質を診断
        </h2>
        <p className="text-xs text-gray-500">
          直感で最も近い丸をタップしてください。当てはまるほど赤、中立は青、当てはまらないほど黄色です。
        </p>
      </div>

      {/* 質問リスト（縦グラデーションに沿って展開） */}
      <div className="relative z-10 w-full max-w-sm px-6 mt-4" ref={scrollRef}>
        {questions.slice(0, revealedCount).map((q, index) => {
          const isAnswered = touched.has(q.id);
          const isLast = index === totalQ - 1;

          // 縦グラデーションにおける深さ比率 (0.0〜1.0)
          const depthRatio = index / Math.max(totalQ - 1, 1);
          // 45% 以降（中盤以降の濃いグレー〜黒ゾーン）またはラスト回答後はダークゾーン
          const isDarkZone = (depthRatio >= 0.45 && revealedCount >= 14) || isLastQuestionAnswered;

          return (
            <React.Fragment key={q.id}>
              {/* ============================================================ */}
              {/* ラスト問題の手前：「世界の境目」（グレーっぽい白と真っ黒の境界） */}
              {/* ============================================================ */}
              {isLast && isLastQuestionRevealed && (
                <div className="relative my-8 py-5 animate-fade-in flex flex-col items-center justify-center">
                  {/* 上部グレー白から下部真っ黒への境界グラデーション */}
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-400/20 via-gray-800/40 to-black/80 rounded-2xl pointer-events-none" />

                  {/* 境界ライン */}
                  <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent shadow-sm" />

                  {/* 境界バッジ */}
                  <div className="relative -top-3 px-3.5 py-0.5 rounded-full bg-black/90 border border-white/25 text-[10px] font-mono tracking-wider text-white uppercase shadow-md flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-yellow-300 animate-spin" />
                    <span>世界の境目 (KÁRMÁN LINE) — FINAL QUESTION</span>
                  </div>
                </div>
              )}

              {/* 質問本体 */}
              <div
                className={`animate-fade-in py-8 border-b transition-colors duration-500 ${
                  isDarkZone ? 'border-white/10' : 'border-gray-200/60'
                } ${isLast && !isLastQuestionAnswered ? 'bg-black/30 rounded-3xl p-5 border border-white/15 my-2' : ''}`}
              >
                {/* 質問ヘッダー */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-xs font-bold tracking-wider uppercase transition-colors duration-500 ${
                      isDarkZone ? 'text-blue-300' : 'text-[#1a73e8]'
                    }`}
                  >
                    QUESTION {index + 1}
                  </span>
                  {isAnswered && (
                    <span className="animate-fade-in inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      回答済み
                    </span>
                  )}
                </div>

                {/* 質問文 */}
                <h3
                  className={`text-base sm:text-lg font-bold mb-6 leading-snug transition-colors duration-500 ${
                    isDarkZone ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {q.text}
                </h3>

                {/* 5個の丸が並ぶエリア（赤＝当てはまる、青＝中立、黄＝当てはまらない） */}
                <div className="space-y-3">
                  {/* 補助ラベル */}
                  <div className="flex justify-between items-center text-xs font-semibold px-1 select-none">
                    <span className="text-[#ea4335] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#ea4335]" />
                      当てはまる
                    </span>
                    <span className="text-[#1a73e8] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1a73e8]" />
                      中立
                    </span>
                    <span className="text-[#fbbc04] flex items-center gap-1">
                      当てはまらない
                      <span className="w-2 h-2 rounded-full bg-[#fbbc04]" />
                    </span>
                  </div>

                  {/* 5つの丸ボタン（Googleカラーのふち） */}
                  <div className="flex items-center justify-between gap-2 sm:gap-3 py-2 px-1">
                    {LIKERT_OPTIONS.map((opt) => {
                      const isSelected = isAnswered && answers[q.id] === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => handleSelectScore(q.id, opt.score, index)}
                          className={`rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer ${opt.sizeClass} ${
                            isSelected
                              ? opt.activeBg
                              : isDarkZone
                              ? opt.inactiveDark
                              : opt.inactiveLight
                          }`}
                          aria-label={opt.label}
                        >
                          {isSelected && (
                            <Check className="w-4 h-4 text-white animate-fade-in" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* 診断結果を見るボタン */}
        {touched.size === totalQ && (
          <div className="animate-fade-in pt-10 pb-8 flex justify-center">
            <button
              type="button"
              onClick={handleFinish}
              className="group relative flex items-center justify-center space-x-2 bg-[#1a73e8] hover:bg-blue-600 text-white px-8 py-4 rounded-full font-semibold shadow-lg shadow-blue-500/40 active:scale-98 transition-all w-full h-14 cursor-pointer"
            >
              <span>診断結果を見る</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizScreen;
