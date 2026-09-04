import React, { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import type { Archetype, CreateMoffyParams, MbtiType } from '../types';

interface MoffyCustomizeScreenProps {
  archetype: Archetype;
  discordUserId: string;
  onSubmit: (params: CreateMoffyParams) => void;
  isSubmitting?: boolean;
}

interface ArchetypeDefault {
  color: string;
  expression: string;
  hair_features: string;
  body_shape: string;
  body_features: string;
  mouth_features: string;
}

const ARCHETYPE_DEFAULTS: Record<MbtiType, ArchetypeDefault> = {
  INTJ: {
    color: 'ディープパープル（深宇宙のような上品な紫）',
    expression: '冷静沈着で深い洞察と知性に満ちた穏やかな微笑み',
    hair_features: '長毛で綿毛のように細かくふわふわした毛並み、上品なツヤ',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '小さく開いたかわいい口、ちょこんと出た小さな八重歯',
  },
  INTP: {
    color: 'ターコイズブルー（透明感ある知性の水色）',
    expression: '知的好奇心にあふれ、ひらめきで瞳をキラキラ輝かせた思索の表情',
    hair_features: '綿毛のようにふわふわと柔らかいエアリーな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '小さく開いたかわいい口、ちょこんと出た小さな八重歯',
  },
  ENTJ: {
    color: 'ロイヤルゴールド（輝くリーダーシップの黄金色）',
    expression: '自信に満ちあふれた、チームを率いる誇らしげで頼もしい笑顔',
    hair_features: '豊かで上質な、光沢をまとったふわふわの毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: 'にっこりと上がった口角、ちょこんと出た小さな八重歯',
  },
  ENTP: {
    color: 'ネオンオレンジ（ひらめきと活気のビタミンカラー）',
    expression: '遊び心に満ちた、いたずらっぽくも知的なひらめきの笑顔',
    hair_features: '少し毛先が跳ねた元気でふわふわな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '楽しそうに開いたかわいい口、ちょこんと出た小さな八重歯',
  },
  INFJ: {
    color: 'フォレストエメラルドグリーン（深い安らぎと神秘の深緑）',
    expression: '静かで深い慈愛と共感に満ちた、すべてを優しく包み込む穏やかな微笑み',
    hair_features: 'シルクのように繊細で、綿雪のように柔らかな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '小さく微笑むやさしい口元、ちょこんと出た小さな八重歯',
  },
  INFP: {
    color: 'パステルピンク（夢見るイマジネーションの桜色）',
    expression: '夢見るように純粋で、温かいイマジネーションにあふれた優しい微笑み',
    hair_features: 'わたあめのように極めて柔らかくふわふわな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '小さく開いたかわいい口、ちょこんと出た小さな八重歯',
  },
  ENFJ: {
    color: 'ウォームアンバーイエロー（周囲を明るく照らす陽光色）',
    expression: '太陽のように温かく、誰もを歓迎するポジティブな最高の笑顔',
    hair_features: '温もりを感じるふかふかの豊かな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '大きく開いた朗らかな笑顔、ちょこんと出た小さな八重歯',
  },
  ENFP: {
    color: 'スカイブルー（青空のように自由で爽快な水色）',
    expression: '好奇心とワクワクが止まらない、口をいっぱいに開けた満面の笑顔',
    hair_features: '軽やかでぽよぽよ弾むような超ふわふわの毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '元気いっぱいに開いた笑顔、ちょこんと出た小さな八重歯',
  },
  ISTJ: {
    color: 'クラシックネイビーブルー（誠実と信頼の深藍色）',
    expression: '誠実で几帳面、安心感と信頼を与える穏やかで真面目な微笑み',
    hair_features: '整然と美しく整った、きめ細かく上質なふわふわの毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '小さく結ばれた几帳面な口元、ちょこんと出た小さな八重歯',
  },
  ISFJ: {
    color: 'ミントグリーン（心癒やすやわらかなミント色）',
    expression: '心がほっとするような、思いやりと温もりに満ちた優しい笑顔',
    hair_features: '暖かな毛布のようにふんわり包み込む柔らかな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: 'おだやかに微笑むかわいい口、ちょこんと出た小さな八重歯',
  },
  ESTJ: {
    color: 'インディゴブルー（規律と行動力を宿す濃紺色）',
    expression: '仕事ができて頼もしい、テキパキとしたプロフェッショナルな微笑み',
    hair_features: '手入れの行き届いた清潔感あふれるふわふわの毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: 'きりっと引き締まりつつも愛らしい口元、小さな八重歯',
  },
  ESFJ: {
    color: 'コーラルピンク（親しみと華やかさの珊瑚色）',
    expression: '仲間と一緒に過ごせる喜びがあふれる、華やかで明るい笑顔',
    hair_features: 'ふんわりボリューミーで愛嬌たっぷりの毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '嬉しそうに開いた口元、ちょこんと出た小さな八重歯',
  },
  ISTP: {
    color: 'スレートグレー（クールなクラフトマンシップの鋼色）',
    expression: 'クールで職人気質、集中力に研ぎ澄まされた静かな自信の眼差し',
    hair_features: '無駄のないすっきりとした質感のふわふわ毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '控えめに結ばれた口元、ちょこんと出た小さな八重歯',
  },
  ISFP: {
    color: 'ラベンダーパープル（感性豊かなアーティストの藤色）',
    expression: '心地よいリズムに身をゆだねる、リラックスしたマイペースな笑顔',
    hair_features: '波打つように柔らかくふんわりとした毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: 'ほんのり微笑むかわいい口、ちょこんと出た小さな八重歯',
  },
  ESTP: {
    color: 'クリムゾンレッド（情熱的でスリリングな紅赤色）',
    expression: 'どんなチャレンジも受けて立つ、不敵でエネルギッシュな頼もしい笑み',
    hair_features: 'エネルギッシュで躍動感のあるふわふわな毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: 'いたずらっぽくニッと笑った口、ちょこんと出た小さな八重歯',
  },
  ESFP: {
    color: 'ローズピンク（ステージを華やかに彩る薔薇色）',
    expression: 'スポットライトを浴びて心から楽しんでいる、最高に輝くキュートな笑顔',
    hair_features: 'キラキラ光の粒子をまとったような華やかふわふわ毛並み',
    body_shape: '丸っこい2頭身でぽってりした形',
    body_features: '小さな手足、背中に小さな白い羽',
    mouth_features: '大きく開いた楽しげな笑顔、ちょこんと出た小さな八重歯',
  },
};

export const MoffyCustomizeScreen: React.FC<MoffyCustomizeScreenProps> = ({
  archetype,
  discordUserId: _discordUserId,
  onSubmit,
  isSubmitting = false,
}) => {
  const defaults = ARCHETYPE_DEFAULTS[archetype.mbtiCode] || ARCHETYPE_DEFAULTS.INTJ;

  const [color, setColor] = useState(defaults.color);
  const [expression, setExpression] = useState(defaults.expression);
  const [hairFeatures, setHairFeatures] = useState(defaults.hair_features);
  const [bodyShape, setBodyShape] = useState(defaults.body_shape);
  const [bodyFeatures, setBodyFeatures] = useState(defaults.body_features);
  const [mouthFeatures, setMouthFeatures] = useState(defaults.mouth_features);

  // マウント時に確実に画面最上部へスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const handleResetDefaults = () => {
    setColor(defaults.color);
    setExpression(defaults.expression);
    setHairFeatures(defaults.hair_features);
    setBodyShape(defaults.body_shape);
    setBodyFeatures(defaults.body_features);
    setMouthFeatures(defaults.mouth_features);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      color: color.trim() || defaults.color,
      expression: expression.trim() || defaults.expression,
      hair_features: hairFeatures.trim() || defaults.hair_features,
      body_shape: bodyShape.trim() || defaults.body_shape,
      body_features: bodyFeatures.trim() || defaults.body_features,
      mouth_features: mouthFeatures.trim() || defaults.mouth_features,
      accessories: 'なし',
    });
  };

  return (
    <div className="w-full min-h-screen bg-black text-white px-6 pt-6 pb-16 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col">
        {/* 入力フォーム（ボックス全廃・フラットな分割線レイアウト） */}
        <form onSubmit={handleSubmit} className="w-full animate-fade-in">
          {/* リセットボタン */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400 font-semibold">
              PARAMETERS
            </span>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs font-mono text-gray-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>初期値に戻す</span>
            </button>
          </div>

          {/* フィールドリスト（divide-y divide-white/10 による完全フラット構造） */}
          <div className="divide-y divide-white/10">
            {/* 1. モッフィーのカラー */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-color" className="text-xs font-mono tracking-wider uppercase text-gray-300 font-semibold">
                  1. モッフィーのカラー
                </label>
                <span className="text-[11px] text-gray-500 font-sans">色彩</span>
              </div>
              <input
                id="field-color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="例: ディープパープル、パステルピンク、純白"
                className="w-full h-12 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {['純白', 'ディープパープル', 'パステルピンク', 'スカイブルー', 'ミントグリーン', 'ロイヤルゴールド'].map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-gray-400 hover:text-gray-200 transition-colors border border-white/10 cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 表情 */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-expression" className="text-xs font-mono tracking-wider uppercase text-gray-300 font-semibold">
                  2. 表情
                </label>
                <span className="text-[11px] text-gray-500 font-sans">まなざし</span>
              </div>
              <input
                id="field-expression"
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="例: 冷静沈着で穏やかな微笑み、満面の笑顔"
                className="w-full h-12 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {['にっこり微笑んでいる', '満面の元気な笑顔', '冷静沈着で知的な微笑み', 'いたずらっぽいウインク'].map((ex) => (
                  <button
                    type="button"
                    key={ex}
                    onClick={() => setExpression(ex)}
                    className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[11px] text-gray-400 hover:text-gray-200 transition-colors border border-white/10 cursor-pointer"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 毛並み・質感 */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-hair" className="text-xs font-mono tracking-wider uppercase text-gray-300 font-semibold">
                  3. 毛並み・質感
                </label>
                <span className="text-[11px] text-gray-500 font-sans">テクスチャ</span>
              </div>
              <input
                id="field-hair"
                type="text"
                value={hairFeatures}
                onChange={(e) => setHairFeatures(e.target.value)}
                placeholder="例: 長毛で綿毛のように細かくふわふわした毛並み"
                className="w-full h-12 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
              />
            </div>

            {/* 4. 体のシルエット */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-shape" className="text-xs font-mono tracking-wider uppercase text-gray-300 font-semibold">
                  4. 体のシルエット
                </label>
                <span className="text-[11px] text-gray-500 font-sans">フォルム</span>
              </div>
              <input
                id="field-shape"
                type="text"
                value={bodyShape}
                onChange={(e) => setBodyShape(e.target.value)}
                placeholder="例: 丸っこい2頭身でぽってりした形"
                className="w-full h-12 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
              />
            </div>

            {/* 5. 体の特徴 */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-features" className="text-xs font-mono tracking-wider uppercase text-gray-300 font-semibold">
                  5. 体の特徴
                </label>
                <span className="text-[11px] text-gray-500 font-sans">特徴</span>
              </div>
              <input
                id="field-features"
                type="text"
                value={bodyFeatures}
                onChange={(e) => setBodyFeatures(e.target.value)}
                placeholder="例: 小さな手足、背中に小さな白い羽"
                className="w-full h-12 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
              />
            </div>

            {/* 6. 口の特徴 */}
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="field-mouth" className="text-xs font-mono tracking-wider uppercase text-gray-300 font-semibold">
                  6. 口の特徴
                </label>
                <span className="text-[11px] text-gray-500 font-sans">口元</span>
              </div>
              <input
                id="field-mouth"
                type="text"
                value={mouthFeatures}
                onChange={(e) => setMouthFeatures(e.target.value)}
                placeholder="例: 小さく開いたかわいい口、ちょこんと出た小さな八重歯"
                className="w-full h-12 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white text-sm focus:outline-none focus:border-google-blue transition-colors placeholder-gray-600"
                required
              />
            </div>
          </div>

          {/* 公式ガイドライン注記（フラットテキスト） */}
          <div className="py-4 text-[11px] text-gray-500 font-sans leading-relaxed">
            ※ 鼻を描かないこと（NO NOSE）、瞳孔中央の白い四芒星ハイライト、2頭身ぬいぐるみの公式黄金ルールが厳格に守られて生成されます。
          </div>

          {/* 送信ボタン（「結果を見る」・IntroScreenと統一されたGoogle Blueピルボタン） */}
          <div className="pt-6 pb-16">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>結果を見る</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoffyCustomizeScreen;
