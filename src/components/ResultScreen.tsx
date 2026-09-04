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
import type { Archetype, RegistrationResult } from '../types';

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
  onReset: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  archetype,
  cardDataUrl,
  discordUserId,
  traitScores,
  regResult,
  customImageUrl,
  normalImageUrl,
  equippedImageUrl,
  onReset,
}) => {
  // 星の破片から水晶球体への結晶化フェーズ ('fracturing' -> 'crystallized')
  const [phase, setPhase] = useState<'fracturing' | 'crystallized'>('fracturing');
  // 水晶球体内のスタイルモード: 'equipped' (アクセサリー装備) | 'normal' (ノーマル)
  const [activeMode, setActiveMode] = useState<'equipped' | 'normal'>('equipped');

  // スワイプ / ドラッグ判定用の参照
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const mouseStartX = React.useRef<number | null>(null);
  const isDragging = React.useRef<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('crystallized');
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.5 },
      });
    }, 1300);

    return () => clearTimeout(timer);
  }, []);

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
      {/* PHASE 1: 星の破片が中央へ引き寄せられ結晶化するオープニング演出 */}
      {/* ==================================================================== */}
      {phase === 'fracturing' && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center pointer-events-none">
          <div
            className="absolute w-96 h-96 rounded-full blur-3xl opacity-30 animate-pulse"
            style={{ backgroundColor: archetype.primaryColor }}
          />

          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* 欠けた幾何学星の本体 */}
            <svg
              viewBox="0 0 24 24"
              className="w-24 h-24 text-white/20 animate-pulse absolute"
            >
              <path
                d="M 12 2 Q 12 12 2 12 Q 12 12 12 22 Q 12 12 22 12 Q 12 12 12 2 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 2"
              />
            </svg>

            {/* 欠けて中央へと飛び込んでくる光る結晶の破片 */}
            <div className="animate-shard-gather absolute flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-16 h-16 fill-white drop-shadow-[0_0_24px_rgba(255,255,255,0.9)]"
              >
                <path d="M 12 2 Q 12 12 2 12 Q 12 12 12 22 Z" />
              </svg>
            </div>

            <div className="absolute w-32 h-32 rounded-full border border-white/40 animate-ping" />
          </div>

          <p className="mt-8 text-xs font-mono tracking-widest text-gray-400">
            CRYSTALLIZING ARCHETYPE...
          </p>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 2: 水晶の中に浮かぶモッフィー（ファーストビュー） */}
      {/* ボックスで囲わず、空間を贅沢に使った Google のミニマルデザイン */}
      {/* ==================================================================== */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center px-6 pt-12 pb-8 text-center overflow-hidden">
        {/* 背景の柔らかな環境光 */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] rounded-full blur-[120px] opacity-25 pointer-events-none transition-all duration-1000"
          style={{ backgroundColor: archetype.primaryColor }}
        />

        {/* MBTI コード */}
        <div className="relative z-10 mb-4 animate-fade-in">
          <span className="inline-block text-xs font-mono font-medium tracking-widest text-gray-400 uppercase">
            ARCHETYPE // {archetype.mbtiCode}
          </span>
        </div>

        {/* 水晶球体（クリスタルオーブ） ＆ 内部で無重力浮遊するモッフィー */}
        <div className="relative z-10 w-64 h-64 sm:w-72 sm:h-72 my-2 flex items-center justify-center animate-fade-in">
          {/* 外周を旋回する繊細な幾何学リング */}
          <div className="absolute inset-0 rounded-full border border-dashed border-white/20 animate-spin-slow pointer-events-none" />
          <div className="absolute -inset-2.5 rounded-full border border-white/10 animate-spin-slow-reverse pointer-events-none" />

          {/* 水晶球体 */}
          <div
            onTouchStart={canToggle ? handleTouchStart : undefined}
            onTouchEnd={canToggle ? handleTouchEnd : undefined}
            onMouseDown={canToggle ? handleMouseDown : undefined}
            onMouseUp={canToggle ? handleMouseUp : undefined}
            className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_0_35px_rgba(255,255,255,0.3)] border border-white/40 backdrop-blur-xl bg-gradient-to-b from-white/15 via-transparent to-black/60 select-none ${
              canToggle ? 'cursor-grab active:cursor-grabbing hover:border-white/60 transition-colors' : ''
            }`}
            title={canToggle ? 'スワイプまたはタップでスタイル切替' : undefined}
          >
            {/* 内部の微細な環境カラー */}
            <div
              className="absolute inset-0 rounded-full opacity-35 blur-md pointer-events-none"
              style={{
                background: `radial-gradient(circle at 35% 30%, ${archetype.accentColor} 0%, ${archetype.primaryColor} 50%, transparent 80%)`,
              }}
            />

            {/* 水晶の内部で優雅に浮遊するモッフィー（スワイプによるスライド＆クロスフェード遷移） */}
            <div className="relative z-10 animate-crystal-float w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
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
            <div className="absolute top-2 left-6 right-6 h-20 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none blur-[1px]" />
          </div>
        </div>

        {/* スタイル切替コントロール（Google流ミニマル・ピルタブ） */}
        {canToggle && (
          <div className="relative z-20 flex flex-col items-center gap-1 animate-fade-in mt-1 mb-3">
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
        <div className="relative z-10 mt-5 max-w-md mx-auto animate-fade-in">
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

        {/* スクロール案内 */}
        <div className="relative z-10 mt-12 flex flex-col items-center gap-1 animate-bounce text-gray-400 select-none">
          <span className="text-[11px] font-medium tracking-wider text-gray-500">
            スクロールして詳細を見る
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </section>

      {/* ==================================================================== */}
      {/* SECTION 3: スクロールで現れる詳細リザルト（ボックス全廃・Google流フラット） */}
      {/* ==================================================================== */}
      <main className="max-w-xl mx-auto px-6 divide-y divide-white/10">
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
    </div>
  );
};

export default ResultScreen;
