import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import type { Archetype, CreateMoffyParams } from '../types';
import { ARCHETYPE_DEFAULTS } from '../data/personalityQuestions';
import { analyzeMoffyWishWithGemini } from '../services/api';

interface MoffyCustomizeScreenProps {
  archetype: Archetype;
  discordUserId: string;
  onSubmit: (params: CreateMoffyParams) => void;
  isSubmitting?: boolean;
}

const COLOR_PRESETS = [
  '純白',
  'ディープパープル',
  'パステルピンク',
  'スカイブルー',
  'ミントグリーン',
  'ロイヤルゴールド',
];

const WISH_INSPIRATIONS = [
  'プログラミングを一緒に頑張りたい',
  '疲れた時に優しく癒やしてほしい',
  '新しいアイデアをたくさん閃きたい',
  'みんなを笑顔にする元気を分けてほしい',
];

export const MoffyCustomizeScreen: React.FC<MoffyCustomizeScreenProps> = ({
  archetype,
  discordUserId: _discordUserId,
  onSubmit,
  isSubmitting = false,
}) => {
  const defaults = ARCHETYPE_DEFAULTS[archetype.mbtiCode] || ARCHETYPE_DEFAULTS.INTJ;

  const [color, setColor] = useState(defaults.color);
  const [wish, setWish] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // マウント時に確実に画面最上部へスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const handleResetDefaults = () => {
    setColor(defaults.color);
    setWish('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing || isSubmitting) return;

    setIsAnalyzing(true);
    try {
      // Geminiで願い事と毛色を分析し、モッフィー作成API用パラメータに変換
      const structuredParams = await analyzeMoffyWishWithGemini({
        wish: wish.trim(),
        color: color.trim() || defaults.color,
        archetype,
      });

      onSubmit(structuredParams);
    } catch (err) {
      console.error('Failed to analyze wish with Gemini:', err);
      // 万が一の例外時もデフォルト値でフォールバックして進行
      onSubmit({
        color: color.trim() || defaults.color,
        expression: defaults.expression,
        hair_features: defaults.hair_features,
        body_shape: defaults.body_shape,
        body_features: defaults.body_features,
        mouth_features: defaults.mouth_features,
        accessories: 'なし',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isLoading = isAnalyzing || isSubmitting;

  return (
    <div className="w-full min-h-screen bg-black text-white px-6 pt-6 pb-16 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col">
        {/* ヘッダーエリア */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-google-blue mb-3">
            <span>{archetype.mbtiCode}</span>
            <span className="text-white/30">|</span>
            <span className="text-gray-300">{archetype.title}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
            あなたの妖精を創造する
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
            診断された性格特性とあなたの願いをもとに、AIが世界に一匹だけのモッフィーをデザインします。
          </p>
        </div>

        {/* 2問のシンプルフォーム */}
        <form onSubmit={handleSubmit} className="w-full animate-fade-in">
          {/* コントロールヘッダー */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400 font-semibold">
              CUSTOMIZE
            </span>
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={isLoading}
              className="text-xs font-mono text-gray-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1 disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              <span>初期値に戻す</span>
            </button>
          </div>

          {/* 質問リスト */}
          <div className="divide-y divide-white/10">
            {/* 1問目: あなたの望む妖精の毛色はナニ？ */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-color" className="text-sm font-medium tracking-wide text-gray-200">
                  あなたの望む妖精の毛色はナニ？
                </label>
                <span className="text-[11px] text-gray-500 font-mono">Q1</span>
              </div>
              <input
                id="field-color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="例: 純白、ディープパープル、パステルピンク"
                className="w-full h-12 px-4 rounded-xl border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
                disabled={isLoading}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {COLOR_PRESETS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    disabled={isLoading}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                      color === c
                        ? 'bg-google-blue/20 text-blue-300 border-google-blue/50'
                        : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border-white/10'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 2問目: あなたの妖精への願い事はナニ？ */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-wish" className="text-sm font-medium tracking-wide text-gray-200">
                  あなたの妖精への願い事はナニ？
                </label>
                <span className="text-[11px] text-gray-500 font-mono">Q2</span>
              </div>
              <textarea
                id="field-wish"
                rows={3}
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="例: プログラミングや勉強を隣で見守ってほしい、疲れたときに優しく癒やしてほしい"
                className="w-full p-4 rounded-xl border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600 resize-none leading-relaxed"
                required
                disabled={isLoading}
              />
              <div className="mt-3">
                <div className="text-[11px] text-gray-500 mb-2 font-mono">願い事のヒント:</div>
                <div className="flex flex-col gap-1.5">
                  {WISH_INSPIRATIONS.map((insp) => (
                    <button
                      type="button"
                      key={insp}
                      onClick={() => setWish(insp)}
                      disabled={isLoading}
                      className="min-h-[38px] text-left px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 hover:text-gray-200 transition-colors border border-white/10 cursor-pointer"
                    >
                      {insp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 公式ガイドライン注記 */}
          <div className="py-4 text-[11px] text-gray-500 font-sans leading-relaxed">
            ※ 鼻を描かないこと（NO NOSE）、瞳孔中央の白い四芒星ハイライト、2頭身ぬいぐるみの公式黄金ルールが厳格に守られて生成されます。
          </div>

          {/* 送信ボタン */}
          <div className="pt-6 pb-16">
            <button
              type="submit"
              disabled={isLoading || !color.trim() || !wish.trim()}
              className="w-full h-14 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>{isAnalyzing ? '願い事を分析中...' : '生成中...'}</span>
                </>
              ) : (
                <>
                  <span>モッフィーを誕生させる</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoffyCustomizeScreen;

