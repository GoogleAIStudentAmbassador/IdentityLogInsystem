import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Download,
  Share2,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import type { Archetype, RegistrationResult, ShardPalette } from '../types';

interface ResultScreenProps {
  archetype: Archetype;
  cardDataUrl: string;
  cardBlob: Blob;
  discordUserId: string;
  traitScores?: Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> | null;
  regResult: RegistrationResult | null;
  customImageUrl?: string;
  normalImageUrl?: string;
  equippedImageUrl?: string;
  chosenShard: ShardPalette;
  onReset: () => void;
}

type AnimationStage = 'shard' | 'expanding' | 'crystallized' | 'revealed';

export const ResultScreen: React.FC<ResultScreenProps> = ({
  archetype,
  cardDataUrl,
  discordUserId,
  traitScores,
  regResult,
  customImageUrl,
  normalImageUrl,
  equippedImageUrl,
  chosenShard,
  onReset,
}) => {
  // 演出ステージ: 'shard' (中央小カケラ) -> 'expanding' (拡大＆受肉) -> 'crystallized' (水晶玉完成) -> 'revealed' (詳細テキスト生成)
  const [animStage, setAnimStage] = useState<AnimationStage>('shard');

  // 水晶球体内のスタイルモード: 'equipped' (アクセサリー装備) | 'normal' (ノーマル)
  const [activeMode, setActiveMode] = useState<'equipped' | 'normal'>('equipped');

  // スワイプ / ドラッグ判定用の参照
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const mouseStartX = React.useRef<number | null>(null);
  const isDragging = React.useRef<boolean>(false);

  useEffect(() => {
    // Step 1 (60ms): CSSトランジションを確実に走らせるために次フレームでexpanding開始
    const t1 = setTimeout(() => {
      setAnimStage('expanding');
    }, 60);

    // Step 2 (1100ms): 水晶玉完成＆モッフィー受肉完了、コンフェッティ発射＆タイトル出現
    const t2 = setTimeout(() => {
      setAnimStage('crystallized');
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.44 },
        colors: [chosenShard.color, '#ffffff', '#ffd700', '#38bdf8'],
      });
    }, 1100);

    // Step 3 (1900ms): 演出完了後、下部に詳細テキストを生成
    const t3 = setTimeout(() => {
      setAnimStage('revealed');
    }, 1900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [chosenShard]);

  const handleDownloadCard = () => {
    const link = document.createElement('a');
    link.href = cardDataUrl;
    link.download = `MoffyCard_${discordUserId}_${archetype.mbtiCode}.png`;
    link.click();
  };

  const handleShareX = () => {
    const text = encodeURIComponent(
      `私のパートナーモッフィーは【${archetype.title}（${archetype.mbtiCode}）】でした。\nGoogle AI 学生アンバサダーのMoffyProfileにも登録完了！\n`
    );
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  // 4次元心理バランスのパーセンテージ計算 (E/I, S/N, T/F, J/P)
  const calcDimensionRatio = (pos: 'E' | 'S' | 'T' | 'J', neg: 'I' | 'N' | 'F' | 'P') => {
    if (!traitScores) {
      const hasPos = archetype.mbtiCode.includes(pos);
      return { posPct: hasPos ? 70 : 30, negPct: hasPos ? 30 : 70 };
    }
    const posScore = traitScores[pos] || 0;
    const negScore = traitScores[neg] || 0;
    const total = posScore + negScore;
    if (total === 0) return { posPct: 50, negPct: 50 };
    const posPct = Math.round((posScore / total) * 100);
    return { posPct, negPct: 100 - posPct };
  };

  const eiRatio = calcDimensionRatio('E', 'I');
  const snRatio = calcDimensionRatio('S', 'N');
  const tfRatio = calcDimensionRatio('T', 'F');
  const jpRatio = calcDimensionRatio('J', 'P');

  // 絵文字を徹底排除したクリーンなバッジ文字列の生成
  const cleanBadge = archetype.badge
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .trim();

  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
  const defaultMoffyImg = archetype.officialImageUrl
    ? archetype.officialImageUrl.startsWith('http')
      ? archetype.officialImageUrl
      : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
    : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`;

  // アクセサリー装備モッフィー（優先: equippedImageUrl -> customImageUrl -> defaultMoffyImg）
  const equippedImgSrc = equippedImageUrl || customImageUrl || defaultMoffyImg;
  // ノーマルモッフィー（優先: normalImageUrl -> defaultMoffyImg）
  const normalImgSrc = normalImageUrl || defaultMoffyImg;

  // 2つのスタイルが異なっていればスワイプ可能
  const canToggle = equippedImgSrc !== normalImgSrc;

  // 水平スワイプ / ドラッグ処理
  const toggleMode = () => {
    setActiveMode((prev) => (prev === 'equipped' ? 'normal' : 'equipped'));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > 28 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX > 0) {
        // 右スワイプ: ノーマルへ
        setActiveMode('normal');
      } else {
        // 左スワイプ: 装備へ
        setActiveMode('equipped');
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    isDragging.current = true;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current || mouseStartX.current === null) return;
    isDragging.current = false;
    const deltaX = e.clientX - mouseStartX.current;
    if (Math.abs(deltaX) > 28) {
      if (deltaX > 0) {
        setActiveMode('normal');
      } else {
        setActiveMode('equipped');
      }
    } else {
      toggleMode();
    }
    mouseStartX.current = null;
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-900 selection:text-white pb-32">
      {/* ==================================================================== */}
      {/* PHASE 1 & 2: ロード画面の中央星からシームレスに拡大し、水晶玉の中にモッフィーが受肉する演出 */}
      {/* 画面切り替えのカットを徹底排除したワンカット長回し演出 */}
      {/* ==================================================================== */}
      <section className="relative min-h-[92vh] sm:min-h-screen flex flex-col items-center justify-center px-6 pt-12 pb-8 text-center overflow-hidden">
        {/* 背景の柔らかな環境光（ロード画面で中央に行った星の色！） */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px] pointer-events-none transition-all duration-1000 ease-out ${
            animStage === 'shard'
              ? 'w-48 h-48 opacity-25'
              : 'w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] opacity-35'
          }`}
          style={{ backgroundColor: chosenShard.color }}
        />

        {/* MBTI コード */}
        <div
          className={`relative z-10 mb-4 transition-all duration-700 ${
            animStage === 'crystallized' || animStage === 'revealed'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <span className="inline-block text-xs font-mono font-medium tracking-widest text-gray-400 uppercase">
            ARCHETYPE // {archetype.mbtiCode}
          </span>
        </div>

        {/* 水晶球体（クリスタルオーブ） ＆ 内部で無重力浮遊するモッフィー */}
        {/* 🌟 ロード画面で完全中央に収束したカケラから、寸分の狂いもなくシームレスに拡大 */}
        <div
          className={`relative z-10 my-2 flex items-center justify-center transition-all duration-1000 ease-out ${
            animStage === 'shard'
              ? 'w-64 h-64 sm:w-72 sm:h-72 scale-[0.28]'
              : 'w-64 h-64 sm:w-72 sm:h-72 scale-100'
          }`}
        >
          {/* 外周を旋回する繊細な幾何学リング（ロード星カラーの薄いアクセント） */}
          <div
            className={`absolute inset-0 rounded-full border border-dashed transition-all duration-1000 pointer-events-none ${
              animStage === 'shard'
                ? 'opacity-0 scale-50'
                : 'opacity-100 scale-100 animate-spin-slow'
            }`}
            style={{ borderColor: `${chosenShard.color}66` }}
          />
          <div
            className={`absolute -inset-2.5 rounded-full border border-white/10 transition-all duration-1000 pointer-events-none ${
              animStage === 'shard'
                ? 'opacity-0 scale-50'
                : 'opacity-100 scale-100 animate-spin-slow-reverse'
            }`}
          />

          {/* 水晶球体本体 */}
          <div
            onTouchStart={canToggle ? handleTouchStart : undefined}
            onTouchEnd={canToggle ? handleTouchEnd : undefined}
            onMouseDown={canToggle ? handleMouseDown : undefined}
            onMouseUp={canToggle ? handleMouseUp : undefined}
            className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden flex items-center justify-center border backdrop-blur-xl transition-all duration-1000 ease-out select-none ${
              animStage === 'shard'
                ? 'border-transparent bg-transparent shadow-none'
                : 'border-white/40 bg-gradient-to-b from-white/15 via-transparent to-black/60'
            } ${
              canToggle && animStage !== 'shard' ? 'cursor-grab active:cursor-grabbing hover:border-white/60 transition-colors' : ''
            }`}
            style={
              animStage !== 'shard'
                ? {
                    boxShadow: `0 0 55px ${chosenShard.glow}, inset 0 0 35px rgba(255,255,255,0.3), 0 0 80px rgba(0,0,0,0.9)`,
                  }
                : undefined
            }
            title={canToggle && animStage !== 'shard' ? 'スワイプまたはタップでスタイル切替' : undefined}
          >
            {/* 🌟 内部の微細な環境カラー（ロード画面で中央に行った星の色！） */}
            <div
              className={`absolute inset-0 rounded-full blur-md pointer-events-none transition-opacity duration-1000 ${
                animStage === 'shard' ? 'opacity-0' : 'opacity-40'
              }`}
              style={{
                background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${chosenShard.color} 40%, ${chosenShard.glow} 70%, transparent 95%)`,
              }}
            />

            {/* 🌟 ロード画面の中央星そのもの（拡大時に光となってモッフィーへ受肉） */}
            <div
              className={`absolute flex items-center justify-center transition-all duration-700 pointer-events-none ${
                animStage === 'shard'
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-150'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-16 h-16 fill-white animate-pulse"
                style={{ filter: `drop-shadow(0 0 20px ${chosenShard.glow})` }}
              >
                <path d="M 12 2 Q 12 12 2 12 Q 12 12 12 22 Q 12 12 22 12 Q 12 12 12 2 Z" />
              </svg>
            </div>

            {/* 水晶の内部で優雅に浮遊するモッフィー（拡大時にフェードイン受肉） */}
            <div
              className={`relative z-10 w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center transition-all duration-1000 ease-out ${
                animStage === 'shard'
                  ? 'opacity-0 scale-30 pointer-events-none'
                  : 'opacity-100 scale-100 animate-crystal-float'
              }`}
            >
              {/* ノーマルモッフィー */}
              <img
                src={normalImgSrc}
                alt={`${archetype.title} (Normal)`}
                className={`absolute inset-0 w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)] transition-all duration-500 ease-out ${
                  activeMode === 'normal'
                    ? 'opacity-100 scale-100 translate-x-0'
                    : 'opacity-0 scale-90 -translate-x-6 pointer-events-none'
                }`}
              />

              {/* アクセサリー装備モッフィー */}
              <img
                src={equippedImgSrc}
                alt={`${archetype.title} (Equipped)`}
                className={`absolute inset-0 w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)] transition-all duration-500 ease-out ${
                  activeMode === 'equipped'
                    ? 'opacity-100 scale-100 translate-x-0'
                    : 'opacity-0 scale-90 translate-x-6 pointer-events-none'
                }`}
              />
            </div>

            {/* ガラス表面の光沢ハイライト */}
            <div
              className={`absolute top-2 left-6 right-6 h-20 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none blur-[1px] transition-opacity duration-1000 ${
                animStage === 'shard' ? 'opacity-0' : 'opacity-100'
              }`}
            />
          </div>
        </div>

        {/* スタイル切替コントロール（Google流ミニマル・ピルタブ） */}
        {canToggle && (
          <div
            className={`relative z-20 flex flex-col items-center gap-1 mt-1 mb-3 transition-all duration-700 ${
              animStage === 'crystallized' || animStage === 'revealed'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <div className="inline-flex items-center p-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveMode('normal')}
                className={`px-3.5 py-1 rounded-full text-xs font-mono tracking-wider transition-all duration-300 cursor-pointer ${
                  activeMode === 'normal'
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                NORMAL
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('equipped')}
                className={`px-3.5 py-1 rounded-full text-xs font-mono tracking-wider transition-all duration-300 cursor-pointer ${
                  activeMode === 'equipped'
                    ? 'bg-white/20 text-white font-semibold shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                EQUIPPED
              </button>
            </div>
            <span className="text-[10px] font-mono tracking-widest text-gray-500 select-none">
              ‹ 水晶をスワイプで切替 ›
            </span>
          </div>
        )}

        {/* モッフィーの名称と称号 */}
        <div
          className={`relative z-10 mt-5 max-w-md mx-auto transition-all duration-700 ${
            animStage === 'crystallized' || animStage === 'revealed'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
            {archetype.title}
          </h1>
          <p className="text-xs sm:text-sm font-mono font-medium tracking-widest text-gray-400 uppercase mb-3">
            {archetype.subtitle}
          </p>
          {cleanBadge && (
            <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 font-medium">
              {cleanBadge}
            </div>
          )}
        </div>

        {/* スクロール案内（演出完了後に下部に生成） */}
        {animStage === 'revealed' && (
          <div className="relative z-10 mt-12 flex flex-col items-center gap-1 animate-fade-in text-gray-400 select-none">
            <span className="text-[11px] font-medium tracking-wider text-gray-500">
              スクロールして詳細を見る
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400 animate-bounce" />
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* SECTION 3: 水晶玉の受肉演出完了後に下部に生成展開される詳細リザルト */}
      {/* ==================================================================== */}
      {animStage === 'revealed' && (
        <main className="max-w-xl mx-auto px-6 divide-y divide-white/10 animate-fade-in">
          {/* 1. モッフィーの本質とストーリー */}
          <div className="py-10">
          <span className="text-xs font-mono tracking-widest uppercase text-[#1a73e8] block mb-3 font-semibold">
            ABOUT THIS MOFFY
          </span>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-sans">
            {archetype.description}
          </p>

          {/* 公式シンボル装備 */}
          {archetype.signatureAccessory && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <span className="text-xs text-gray-400 block mb-1">公式シンボル装備</span>
              <p className="text-base font-semibold text-white tracking-wide">
                {archetype.signatureAccessory}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-normal">
                「これがあるから、{archetype.title}」と直感的に識別できる公式アイテムです。
              </p>
            </div>
          )}
        </div>

        {/* 2. 4次元心理バランス分析 (フラットな比較バー) */}
        <div className="py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-mono tracking-widest uppercase text-[#1a73e8] block mb-1 font-semibold">
                DIMENSION BALANCE
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white">4つの心理次元バランス</h2>
            </div>
            <span className="text-[11px] font-mono text-gray-500">IPIP-32 Scale</span>
          </div>

          <div className="space-y-6 text-xs">
            {/* E vs I */}
            <div>
              <div className="flex justify-between font-medium mb-1.5">
                <span className={eiRatio.posPct >= 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  外向 [E] {eiRatio.posPct}%
                </span>
                <span className={eiRatio.negPct > 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  {eiRatio.negPct}% [I] 内向
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden flex">
                <div
                  className="h-full bg-[#1a73e8] transition-all duration-700 rounded-l-full"
                  style={{ width: `${eiRatio.posPct}%` }}
                />
                <div
                  className="h-full bg-gray-700 transition-all duration-700 rounded-r-full"
                  style={{ width: `${eiRatio.negPct}%` }}
                />
              </div>
            </div>

            {/* S vs N */}
            <div>
              <div className="flex justify-between font-medium mb-1.5">
                <span className={snRatio.posPct >= 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  現実 [S] {snRatio.posPct}%
                </span>
                <span className={snRatio.negPct > 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  {snRatio.negPct}% [N] 直観
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden flex">
                <div
                  className="h-full bg-[#34a853] transition-all duration-700 rounded-l-full"
                  style={{ width: `${snRatio.posPct}%` }}
                />
                <div
                  className="h-full bg-gray-700 transition-all duration-700 rounded-r-full"
                  style={{ width: `${snRatio.negPct}%` }}
                />
              </div>
            </div>

            {/* T vs F */}
            <div>
              <div className="flex justify-between font-medium mb-1.5">
                <span className={tfRatio.posPct >= 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  論理 [T] {tfRatio.posPct}%
                </span>
                <span className={tfRatio.negPct > 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  {tfRatio.negPct}% [F] 感情
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden flex">
                <div
                  className="h-full bg-[#ea4335] transition-all duration-700 rounded-l-full"
                  style={{ width: `${tfRatio.posPct}%` }}
                />
                <div
                  className="h-full bg-gray-700 transition-all duration-700 rounded-r-full"
                  style={{ width: `${tfRatio.negPct}%` }}
                />
              </div>
            </div>

            {/* J vs P */}
            <div>
              <div className="flex justify-between font-medium mb-1.5">
                <span className={jpRatio.posPct >= 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  計画 [J] {jpRatio.posPct}%
                </span>
                <span className={jpRatio.negPct > 50 ? 'text-white font-bold' : 'text-gray-400'}>
                  {jpRatio.negPct}% [P] 柔軟
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden flex">
                <div
                  className="h-full bg-[#fbbc04] transition-all duration-700 rounded-l-full"
                  style={{ width: `${jpRatio.posPct}%` }}
                />
                <div
                  className="h-full bg-gray-700 transition-all duration-700 rounded-r-full"
                  style={{ width: `${jpRatio.negPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. 特性 ＆ お気に入りギア */}
        <div className="py-10">
          <span className="text-xs font-mono tracking-widest uppercase text-[#1a73e8] block mb-3 font-semibold">
            TRAITS & GEAR
          </span>
          <div className="flex flex-wrap gap-2 mb-6">
            {archetype.traits.map((trait, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200"
              >
                {trait}
              </span>
            ))}
          </div>

          <div className="flex items-baseline justify-between text-xs pt-4 border-t border-white/10">
            <span className="text-gray-400">お気に入りギア</span>
            <span className="font-semibold text-white">{archetype.luckyItem}</span>
          </div>
        </div>

        {/* 4. 公式アンバサダー・パートナーカード ＆ アクション */}
        <div className="py-10 flex flex-col items-center">
          <div className="text-center mb-6">
            <span className="text-xs font-mono tracking-widest uppercase text-[#1a73e8] block mb-1 font-semibold">
              PARTNER CARD
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white mb-1">
              公式アンバサダー・パートナーカード
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                MoffyProfile 登録完了
              </span>
              {regResult && (
                <a
                  href={regResult.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white inline-flex items-center ml-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* カード画像（ボックスなし、自然な影のみ） */}
          <div className="w-full max-w-sm mb-6">
            <img
              src={cardDataUrl}
              alt="Moffy Card"
              className="w-full h-auto rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          {/* Googleスタイルのピルボタン */}
          <div className="flex w-full max-w-sm gap-3">
            <button
              onClick={handleDownloadCard}
              className="flex-1 py-3 px-5 rounded-full bg-[#1a73e8] hover:bg-blue-600 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>カードを保存</span>
            </button>
            <button
              onClick={handleShareX}
              className="flex-1 py-3 px-5 rounded-full border border-white/20 hover:bg-white/10 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Xでシェア</span>
            </button>
          </div>

          {/* Powered by TechHub */}
          <div className="flex items-center justify-center gap-2 pt-3 text-xs text-gray-400">
            <img
              src={`${baseUrl}techhub-logo.png`}
              alt="Google AI TechHub"
              className="h-4 w-auto object-contain"
            />
            <span className="text-[11px] sm:text-xs font-medium tracking-wide">
              powered by Google AI TechHub for Student Ambassador
            </span>
          </div>
        </div>

        {/* 5. 再診断 */}
        <div className="pt-10 text-center">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition cursor-pointer py-2 px-4"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>最初からやり直す</span>
          </button>
        </div>
      </main>
      )}
    </div>
  );
};

export default ResultScreen;
