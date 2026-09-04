import React, { useEffect, useState, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import type { Archetype, ShardPalette } from '../types';

interface LoadingScreenProps {
  archetype?: Archetype;
  isDark?: boolean;
  mode?: 'signin' | 'signup' | 'generating';
  customTitle?: string;
  customMessage?: string;
  badge?: string;
  chosenShard?: ShardPalette;
  isEnding?: boolean;
  onFinishTransition?: () => void;
}

const SIGNIN_MESSAGES = [
  'アカウント情報を照合中...',
  'プロファイルを同期中...',
  'まもなく完了します...',
];

const SIGNUP_MESSAGES = [
  '認証情報を暗号化中...',
  'プロファイルを作成中...',
  'まもなく完了します...',
];

const GENERATING_MESSAGES = [
  '深層心理パラメータを統合中...',
  'カケラの波長を測定中...',
  'シグナル照合完了...',
  '結晶核を生成中...',
  'まもなく完了します...',
];

// 🌟 小さく地味に書かれているから面白い背景テレメトリ観測ログ（伏線）
const TELEMETRY_LOGS: Record<'signin' | 'signup' | 'generating', string[]> = {
  signin: [
    'QUANTUM HANDSHAKE // SECURE CLOUD RUN NODE',
    'VERIFYING IDENTITY MATRIX // TERRA ANCHOR',
    'SYNCHRONIZING HISTORICAL RESONANCE',
    'AUTHENTICATION COMPLETE: LEVEL 4',
  ],
  signup: [
    'OBSERVING CONSCIOUSNESS VECTOR ON TERRA',
    'ENCRYPTING ESSENCE SIGNATURE // AES-GCM-256',
    'ROUTING TO CLOUD RUN PROFILE MATRIX',
    'PREPARING RECEPTACLE VESSEL FOR ARRIVAL',
  ],
  generating: [
    'DESCENT VECTOR: 11.2 KM/S // ATMOSPHERE CONTACT',
    'KÁRMÁN THRESHOLD PENETRATION CONFIRMED',
    'FILTERING: 299,999,999 SIGNALS LOST IN DEEP SPACE',
    'SURVIVING CORE: 1 / 300,000,000 (LOCKED TO USER)',
    'CRYSTALLIZING VESSEL // MORPHOGENESIS COMPLETE',
  ],
};

interface WarpStar {
  x: number;
  y: number;
  speed: number;
  length: number;
  width: number;
  alpha: number;
  isGemini: boolean;
}

interface BigGeometricStar {
  baseYRatio: number; // 画面縦位置の割合 (0..1)
  baseXOffset: number; // 中心からの基準Xオフセット
  ampX: number; // X方向の揺らぎ振幅
  freqX: number; // X方向の振動周波数
  phase: number;
  radius: number;
  rot: number;
  rotSpeed: number;
  color: string;
  glowColor: string;
  trailLength: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isDark = true,
  mode = 'generating',
  customTitle,
  customMessage,
  badge,
  chosenShard,
  isEnding = false,
  onFinishTransition,
}) => {
  const [msgIndex, setMsgIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isEndingRef = useRef(isEnding);
  const onFinishTransitionRef = useRef(onFinishTransition);
  const chosenShardRef = useRef(chosenShard);

  useEffect(() => {
    isEndingRef.current = isEnding;
    onFinishTransitionRef.current = onFinishTransition;
    chosenShardRef.current = chosenShard;
  }, [isEnding, onFinishTransition, chosenShard]);

  const isDiveMode = mode === 'generating';

  const messages =
    mode === 'signin'
      ? SIGNIN_MESSAGES
      : mode === 'generating'
      ? GENERATING_MESSAGES
      : SIGNUP_MESSAGES;

  const defaultBadgeText =
    mode === 'signin'
      ? 'AUTHENTICATING'
      : mode === 'generating'
      ? 'PROCESSING'
      : 'INITIALIZING';
  const badgeText = badge || defaultBadgeText;

  const defaultTitleText = 'ロード中...';
  const titleText = customTitle || defaultTitleText;

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1 < messages.length ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(timer);
  }, [messages.length]);

  // ========================================================================
  // 超軽量 Canvas 2D: 高速上向き小星ストリーム ＆ 中央3大幾何学星の降下アニメーション
  // ========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // 🌟 1. 高速上向き小星（自分が下に急降下している演出）
    const starCount = isDiveMode ? 130 : 60;
    const stars: WarpStar[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: isDiveMode ? 9 + Math.random() * 16 : 2 + Math.random() * 5, // 高速上向き
      length: isDiveMode ? 16 + Math.random() * 32 : 4 + Math.random() * 10,
      width: Math.random() > 0.85 ? 1.6 : 1.0,
      alpha: 0.35 + Math.random() * 0.65,
      isGemini: Math.random() < 0.08,
    }));

    // 🌟 2. 幾何学的にX方向にだけ動き、下へ向かって猛烈に降下している残像を常に引く4大星
    // 自分と一緒に地球へ急降下しているため、Y方向には落ちていかず、左右に幾何学的に揺らめく
    const bigStars: BigGeometricStar[] = [
      {
        baseYRatio: 0.26, // 上部
        baseXOffset: -65,
        ampX: 75,
        freqX: 1.1,
        phase: 0,
        radius: 36,
        rot: 0,
        rotSpeed: 0.018,
        color: '#4285f4', // Google Blue
        glowColor: 'rgba(66, 133, 244, 0.5)',
        trailLength: 190,
      },
      {
        baseYRatio: 0.48, // 中央
        baseXOffset: 50,
        ampX: 85,
        freqX: 0.9,
        phase: Math.PI * 0.6,
        radius: 40,
        rot: Math.PI / 4,
        rotSpeed: -0.016,
        color: '#ea4335', // Google Red
        glowColor: 'rgba(234, 67, 53, 0.5)',
        trailLength: 220,
      },
      {
        baseYRatio: 0.70, // 下部
        baseXOffset: -40,
        ampX: 90,
        freqX: 1.2,
        phase: Math.PI * 1.3,
        radius: 34,
        rot: 0,
        rotSpeed: 0.020,
        color: '#fbbc04', // Google Yellow
        glowColor: 'rgba(251, 188, 4, 0.5)',
        trailLength: 180,
      },
      {
        baseYRatio: 0.88, // 最下部
        baseXOffset: 60,
        ampX: 70,
        freqX: 1.0,
        phase: Math.PI * 0.3,
        radius: 30,
        rot: Math.PI / 6,
        rotSpeed: -0.022,
        color: '#34a853', // Google Green
        glowColor: 'rgba(52, 168, 83, 0.5)',
        trailLength: 160,
      },
    ];

    const startTime = performance.now();
    let convergeStartTime: number | null = null;
    let convergeFromX = 0;
    let convergeFromY = 0;
    let hasCapturedFrom = false;
    let hasFinished = false;

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const isEndingActive = isEndingRef.current && isDiveMode;
      if (isEndingActive && convergeStartTime === null) {
        convergeStartTime = time;
      }

      const convergeElapsed = convergeStartTime !== null ? (time - convergeStartTime) * 0.001 : 0;
      const convergeDuration = 0.65; // 650ms for elegant glide
      const convergeProgress = convergeStartTime !== null ? Math.min(1, convergeElapsed / convergeDuration) : 0;
      // Smooth cubic ease-out
      const easeConverge = 1 - Math.pow(1 - convergeProgress, 3);

      // --- 小星描画 (上方向へストリーク) ---
      const warpFade = isEndingActive ? Math.max(0, 1 - easeConverge * 1.5) : 1;
      if (warpFade > 0.01) {
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          s.y -= s.speed;

          // 画面上端を超えたら下端へリセット
          if (s.y < -s.length) {
            s.y = height + s.length + Math.random() * 20;
            s.x = Math.random() * width;
          }

          const currentAlpha = s.alpha * warpFade;
          ctx.strokeStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.lineWidth = s.width;

          // 光のストリーク線（下方向から上へ突き抜ける光線）
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + s.length);
          ctx.stroke();

          if (s.isGemini) {
            // 先頭に小さな4点星
            const r = 2.5;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y - r);
            ctx.quadraticCurveTo(s.x, s.y, s.x - r, s.y);
            ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r);
            ctx.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
            ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // --- 幾何学4大星の描画 (X方向にだけ優雅に動き、上空へ猛烈な降下残像を引く) ---
      if (isDiveMode) {
        const centerX = width / 2;
        const targetY = height * 0.44; // ResultScreenの水球中心位置と完全同期
        const totalElapsed = (time - startTime) * 0.001; // 秒

        // 選択されたカケラと一致する星を特定
        const targetColor = (chosenShardRef.current?.color || '#ea4335').toLowerCase();
        let targetIndex = bigStars.findIndex((s) => s.color.toLowerCase() === targetColor);
        if (targetIndex === -1) targetIndex = 1;

        // 収束開始瞬間のターゲット星の位置を一度だけスナップショット
        if (isEndingActive && !hasCapturedFrom) {
          const ts = bigStars[targetIndex];
          const waveX = Math.sin(totalElapsed * ts.freqX + ts.phase) * ts.ampX;
          const harmonicX = Math.sin(totalElapsed * ts.freqX * 2 + ts.phase) * 15;
          convergeFromX = centerX + ts.baseXOffset + waveX + harmonicX;
          convergeFromY = ts.baseYRatio * height;
          hasCapturedFrom = true;
        }

        for (let i = 0; i < bigStars.length; i++) {
          const bs = bigStars[i];
          const isTarget = i === targetIndex;

          // 収束中は他3星を素早くフェードアウト
          const otherFade = isEndingActive ? Math.max(0, 1 - easeConverge * 1.6) : 1;
          if (!isTarget && otherFade <= 0.01) {
            continue;
          }

          bs.rot += bs.rotSpeed;

          let curX: number;
          let curY: number;
          let starAlpha = 1.0;
          let trailAlphaMultiplier = 1.0;

          if (isTarget && isEndingActive) {
            // ターゲット星は現在位置から完全中心へと滑らかに滑り込む
            curX = convergeFromX + (centerX - convergeFromX) * easeConverge;
            curY = convergeFromY + (targetY - convergeFromY) * easeConverge;
            trailAlphaMultiplier = Math.max(0, 1 - easeConverge);
          } else {
            const waveX = Math.sin(totalElapsed * bs.freqX + bs.phase) * bs.ampX;
            const harmonicX = Math.sin(totalElapsed * bs.freqX * 2 + bs.phase) * 15;
            curX = centerX + bs.baseXOffset + waveX + harmonicX;
            curY = bs.baseYRatio * height;
            starAlpha = isTarget ? 1.0 : otherFade;
            trailAlphaMultiplier = isTarget ? 1.0 : otherFade;
          }

          // 🌟 3. 下へ向かって猛烈に落ちている残像（上空への垂直光条 & 4段ゴースト）
          // (a) 上空へ伸びる光のワープストリーク（光条）
          const effectiveTrailLength = bs.trailLength * trailAlphaMultiplier;
          if (effectiveTrailLength > 2 && trailAlphaMultiplier > 0.02) {
            const streakGrad = ctx.createLinearGradient(curX, curY, curX, curY - effectiveTrailLength);
            streakGrad.addColorStop(0, bs.glowColor);
            streakGrad.addColorStop(1, 'transparent');
            ctx.save();
            ctx.globalAlpha = trailAlphaMultiplier;
            ctx.strokeStyle = streakGrad;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(curX, curY);
            ctx.lineTo(curX, curY - effectiveTrailLength);
            ctx.stroke();
            ctx.restore();
          }

          // (b) 上空へ尾を引くゴースト幾何学星（残像）
          if (trailAlphaMultiplier > 0.05) {
            const ghostCount = 4;
            for (let k = 1; k <= ghostCount; k++) {
              const ghostY = curY - k * (30 * trailAlphaMultiplier);
              const ghostAlpha = (0.42 - k * 0.09) * trailAlphaMultiplier;
              if (ghostAlpha <= 0) continue;

              const ghostRadius = bs.radius * (1.0 - k * 0.08);
              const ghostRot = bs.rot - k * 0.12;

              ctx.save();
              ctx.translate(curX, ghostY);
              ctx.rotate(ghostRot);

              // ゴースト破線リング
              ctx.strokeStyle = bs.color;
              ctx.globalAlpha = ghostAlpha * 0.75;
              ctx.lineWidth = 1.0;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc(0, 0, ghostRadius * 1.35, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);

              // ゴーストGemini星
              ctx.fillStyle = bs.color;
              ctx.globalAlpha = ghostAlpha;
              const gr = ghostRadius;
              ctx.beginPath();
              ctx.moveTo(0, -gr);
              ctx.quadraticCurveTo(0, 0, -gr, 0);
              ctx.quadraticCurveTo(0, 0, 0, gr);
              ctx.quadraticCurveTo(0, 0, gr, 0);
              ctx.quadraticCurveTo(0, 0, 0, -gr);
              ctx.closePath();
              ctx.fill();

              ctx.restore();
            }
          }

          // 🌟 4. 星本体（現在位置）の描画
          ctx.save();
          ctx.translate(curX, curY);
          ctx.rotate(bs.rot);
          ctx.globalAlpha = starAlpha;

          // 破線リング
          ctx.strokeStyle = bs.color;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, bs.radius * 1.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 外周サークル
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, bs.radius * 0.9, 0, Math.PI * 2);
          ctx.stroke();

          // 放射オーラグロー
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, bs.radius * 1.6);
          grad.addColorStop(0, bs.glowColor);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, bs.radius * 1.6, 0, Math.PI * 2);
          ctx.fill();

          // Gemini 4点ダイヤモンド星
          const r = bs.radius;
          ctx.fillStyle = bs.color;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.quadraticCurveTo(0, 0, -r, 0);
          ctx.quadraticCurveTo(0, 0, 0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.quadraticCurveTo(0, 0, 0, -r);
          ctx.closePath();
          ctx.fill();

          // 純白の中心核
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // 🌟 収束完了通知（ワンカット引き継ぎ）
        if (isEndingActive && convergeProgress >= 1 && !hasFinished) {
          hasFinished = true;
          if (onFinishTransitionRef.current) {
            onFinishTransitionRef.current();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, [isDiveMode]);

  return (
    <div
      className={`fixed inset-0 z-40 bg-black flex flex-col items-center justify-center select-none overflow-hidden ${
        isDark ? 'text-white' : 'text-white'
      }`}
    >
      {/* 🌟 超軽量 Canvas 2D 星空＆幾何学星レンダラー */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* 🌟 洗練された世界観テキストオーバーレイ（真ん中のスピナーを廃止し、背景の残像星空を主役に） */}
      <div
        className={`relative z-10 max-w-sm mx-auto px-6 text-center flex flex-col items-center pointer-events-none transition-all duration-300 ${
          isEnding ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-fade-in'
        }`}
      >
        {/* バッジ */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10.5px] font-mono tracking-wider font-semibold mb-3 bg-blue-950/70 border border-blue-400/40 text-blue-300 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-3 h-3 text-cyan-300 animate-spin" />
          <span>{badgeText}</span>
        </div>

        {/* メインタイトル */}
        <h3 className="text-2xl sm:text-3xl font-black mb-3 tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          {titleText}
        </h3>

        {/* 状態メッセージ */}
        <p className="text-xs sm:text-sm font-medium h-6 text-cyan-200/90 tracking-wide transition-all drop-shadow-md">
          {customMessage || messages[msgIndex]}
        </p>
      </div>

      {/* 🌟 視認性を落とさない控えめな環境テレメトリ観測ログ（最下部・伏線） */}
      <div
        className={`absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-4 pointer-events-none transition-opacity duration-300 ${
          isEnding ? 'opacity-0' : 'opacity-60'
        }`}
      >
        <div className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 backdrop-blur-sm font-mono text-[9px] text-cyan-400/80 leading-relaxed shadow-lg">
          <div className="text-gray-500 text-[8px] tracking-widest uppercase flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>OBSERVATION TELEMETRY</span>
          </div>
          <div className="truncate text-gray-300">
            &gt; {(TELEMETRY_LOGS[mode] || TELEMETRY_LOGS.generating)[Math.min(msgIndex, (TELEMETRY_LOGS[mode] || TELEMETRY_LOGS.generating).length - 1)]}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
