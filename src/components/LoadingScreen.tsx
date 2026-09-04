import React, { useEffect, useState, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import type { Archetype } from '../types';

interface LoadingScreenProps {
  archetype?: Archetype;
  isDark?: boolean;
  mode?: 'signin' | 'signup' | 'generating';
}

const SIGNIN_MESSAGES = [
  'アカウント情報を照合中...',
  'MoffyProfile API（Cloud Run）と安全に通信中...',
  'パートナープロファイルを取得中...',
  '認証完了間近です...',
];

const SIGNUP_MESSAGES = [
  'アカウント認証プロファイルを暗号化中...',
  'モッフィープロフィール画像を最適化処理中...',
  'MoffyProfile API（Cloud Run）へ安全に送信中...',
  'Firebase Firestore & Storage と同期中...',
  'アカウントの作成が完了間近です...',
];

const GENERATING_MESSAGES = [
  '32問の深層心理パラメータを統合中...',
  '幾何学星域を高速降下中...',
  '魂のアーキタイプと同調中...',
  '守護モッフィーの結晶核を発見...',
  'クリスタルオーブへ結晶化中...',
];

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
  xOffset: number;
  y: number;
  radius: number;
  rot: number;
  rotSpeed: number;
  speedY: number;
  color: string;
  glowColor: string;
  phase: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isDark = true,
  mode = 'generating',
}) => {
  const [msgIndex, setMsgIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isDiveMode = mode === 'generating';

  const messages =
    mode === 'signin'
      ? SIGNIN_MESSAGES
      : mode === 'generating'
      ? GENERATING_MESSAGES
      : SIGNUP_MESSAGES;

  const badgeText =
    mode === 'signin'
      ? 'AUTHENTICATING'
      : mode === 'generating'
      ? 'HYPER-DIVE // MBTI SYNTHESIS'
      : 'CREATING ACCOUNT';

  const titleText =
    mode === 'signin'
      ? 'サインイン中'
      : mode === 'generating'
      ? '深層宇宙へダイブ中'
      : 'アカウントを作成中';

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

    // 🌟 2. 中央を上から下へ幾何学的に流れる3大星
    // Google / Gemini を象徴する3色（コズミックブルー、ソーラーアンバー、ルビーレッド）
    const bigStars: BigGeometricStar[] = [
      {
        xOffset: -45,
        y: -60,
        radius: 38,
        rot: 0,
        rotSpeed: 0.018,
        speedY: 2.2,
        color: '#4285f4', // Google Blue
        glowColor: 'rgba(66, 133, 244, 0.45)',
        phase: 0,
      },
      {
        xOffset: 40,
        y: -height * 0.45,
        radius: 34,
        rot: Math.PI / 4,
        rotSpeed: -0.022,
        speedY: 2.5,
        color: '#ea4335', // Google Red
        glowColor: 'rgba(234, 67, 53, 0.45)',
        phase: Math.PI * 0.7,
      },
      {
        xOffset: 0,
        y: -height * 0.9,
        radius: 44,
        rot: 0,
        rotSpeed: 0.015,
        speedY: 2.0,
        color: '#fbbc04', // Google Yellow
        glowColor: 'rgba(251, 188, 4, 0.45)',
        phase: Math.PI * 1.4,
      },
    ];

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // --- 小星描画 (上方向へストリーク) ---
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y -= s.speed;

        // 画面上端を超えたら下端へリセット
        if (s.y < -s.length) {
          s.y = height + s.length + Math.random() * 20;
          s.x = Math.random() * width;
        }

        ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
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

      // --- 幾何学3大星の描画 (上から下へ優雅に降下) ---
      if (isDiveMode) {
        const centerX = width / 2;

        for (let i = 0; i < bigStars.length; i++) {
          const bs = bigStars[i];
          bs.y += bs.speedY;
          bs.rot += bs.rotSpeed;
          bs.phase += dt * 1.5;

          // 画面最下部を超えたら上部へループ
          if (bs.y > height + bs.radius * 2) {
            bs.y = -bs.radius * 2.5;
          }

          // 幾何学的な左右の微細な揺らぎ（メビウス／二重螺旋軌道）
          const curX = centerX + bs.xOffset + Math.sin(bs.phase) * 35;
          const curY = bs.y;

          ctx.save();
          ctx.translate(curX, curY);
          ctx.rotate(bs.rot);

          // 1. 同心円の幾何学リング（破線）
          ctx.strokeStyle = bs.color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, bs.radius * 1.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 2. 外周の幾何学サークル
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(0, 0, bs.radius * 0.9, 0, Math.PI * 2);
          ctx.stroke();

          // 3. 放射オーラグロー
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, bs.radius * 1.6);
          grad.addColorStop(0, bs.glowColor);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, bs.radius * 1.6, 0, Math.PI * 2);
          ctx.fill();

          // 4. Gemini 4点ダイヤモンド星
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

          // 5. 純白の中心核
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
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

      {/* 🌟 スタイリッシュな近未来 HUD オーバーレイ */}
      <div className="relative z-10 max-w-sm mx-auto px-6 text-center flex flex-col items-center animate-fade-in pointer-events-none">
        {/* オーラパルスリング */}
        <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl animate-pulse" />
          {/* 回転する極細サークル */}
          <div className="w-24 h-24 rounded-full border border-white/20 border-t-google-blue border-r-cyan-400 animate-spin" />
          <div className="absolute w-16 h-16 rounded-full border border-dashed border-white/30 animate-spin-slow-reverse" />
          {/* 中心コア */}
          <div className="absolute flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-8 h-8 fill-white animate-pulse drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]"
            >
              <path d="M 12 2 Q 12 12 2 12 Q 12 12 12 22 Q 12 12 22 12 Q 12 12 12 2 Z" />
            </svg>
          </div>
        </div>

        {/* バッジ */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold mb-3 bg-blue-950/70 border border-blue-400/40 text-blue-300 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-3 h-3 text-cyan-300 animate-spin" />
          <span>{badgeText}</span>
        </div>

        {/* メインタイトル */}
        <h3 className="text-2xl font-black mb-2 tracking-wide text-white drop-shadow-md">
          {titleText}
        </h3>

        {/* 状態メッセージ */}
        <p className="text-xs sm:text-sm font-medium h-6 text-cyan-200/90 tracking-wide transition-all">
          {messages[msgIndex]}
        </p>

        {/* プログレスバー ＆ ドット */}
        <div className="flex justify-center gap-1.5 mt-8 items-center">
          {messages.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === msgIndex
                  ? 'w-7 bg-google-blue shadow-[0_0_8px_rgba(26,115,232,0.8)]'
                  : i < msgIndex
                  ? 'w-2 bg-cyan-400'
                  : 'w-2 bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
