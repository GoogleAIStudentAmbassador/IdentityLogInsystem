import React, { useEffect, useRef } from 'react';

interface StarFieldProps {
  revealedCount?: number;
  totalCount?: number;
  isBlackout?: boolean;
  answerPulse?: number; // 質問に回答した瞬間にインクリメントされるトリガー
  answerIndex?: number;  // 現在回答済みの数（色のシフト等に使用）
}

interface Star {
  x: number; // 0..1 (横の割合)
  yRatio: number; // 0..1 (ページ縦全体の割合)
  size: number;
  isGemini: boolean;
  baseAlpha: number;
  pulseSpeed: number;
  phase: number;
}

/**
 * 超軽量 Canvas 2D スクロール追従型星空レンダラー。
 * 🌟 周囲の星々（シガイ）はスクロール（降下）に同期して上に流れます。
 * 🌟 中央の星（プレイヤーの魂のカケラ）は常に画面中央に存在し、
 *    質問に答えた瞬間に、下へ推進したような美しい「残像（モーションブラー・ゴーストトレイル）」を上空へ放ちます。
 */
export const StarField: React.FC<StarFieldProps> = ({
  revealedCount = 1,
  totalCount = 32,
  isBlackout = false,
  answerPulse = 0,
  answerIndex = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isBlackoutRef = useRef(isBlackout);
  const revealedCountRef = useRef(revealedCount);
  const totalCountRef = useRef(totalCount);
  const answerPulseRef = useRef(answerPulse);
  const answerIndexRef = useRef(answerIndex);

  // パルス発生時刻
  const pulseAnimRef = useRef<{ active: boolean; startTime: number }>({
    active: false,
    startTime: 0,
  });

  useEffect(() => {
    isBlackoutRef.current = isBlackout;
    revealedCountRef.current = revealedCount;
    totalCountRef.current = totalCount;
  }, [isBlackout, revealedCount, totalCount]);

  useEffect(() => {
    if (answerPulse > 0) {
      pulseAnimRef.current = {
        active: true,
        startTime: performance.now(),
      };
    }
    answerPulseRef.current = answerPulse;
    answerIndexRef.current = answerIndex;
  }, [answerPulse, answerIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // 🌟 Google / Gemini カラーパレット（青・赤・黄・緑）
    const GOOGLE_PALETTES = [
      { color: '#4285f4', glow: 'rgba(66, 133, 244, 0.5)' }, // Google Blue
      { color: '#ea4335', glow: 'rgba(234, 67, 53, 0.5)' }, // Google Red
      { color: '#fbbc04', glow: 'rgba(251, 188, 4, 0.5)' }, // Google Yellow
      { color: '#34a853', glow: 'rgba(52, 168, 83, 0.5)' }, // Google Green
    ];

    let coreRotation = 0;

    // 60個の星：ページ縦全体に散りばめられる
    const count = 60;
    const stars: Star[] = Array.from({ length: count }, (_, i) => {
      const isGemini = i < 4; // 約6% Gemini 4点星
      return {
        x: Math.random() * 0.94 + 0.03, // 3% 〜 97%
        yRatio: Math.random() * 0.96 + 0.02, // ページ全体の縦位置 (0.02 〜 0.98)
        size: isGemini ? Math.random() * 4 + 7 : Math.random() * 1.6 + 1.2,
        isGemini,
        baseAlpha: Math.random() * 0.35 + 0.35,
        pulseSpeed: Math.random() * 1.5 + 0.8,
        phase: Math.random() * Math.PI * 2,
      };
    });

    let animId: number;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) * 0.001, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      const scrollY = window.scrollY || 0;
      // 現在のドキュメントの全体の高さ
      const scrollHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      const blackout = isBlackoutRef.current;
      const rCount = revealedCountRef.current;

      for (let i = 0; i < count; i++) {
        const s = stars[i];
        s.phase += s.pulseSpeed * dt;
        const pulse = 0.75 + 0.25 * Math.sin(s.phase);
        const alpha = Math.min(s.baseAlpha * pulse, 1);

        // 🌟 星のページ絶対Y座標
        const starPageY = s.yRatio * scrollHeight;
        // 🌟 スクロールに連動した画面上のY座標（文字・質問と一緒に上に上がる！）
        const screenY = starPageY - scrollY;

        // 画面外の星は描画をスキップ（高速化）
        if (screenY < -30 || screenY > height + 30) {
          continue;
        }

        const screenX = s.x * width;

        // ページ全体における縦位置比率 (0.0: 上部 〜 1.0: 最下部)
        const verticalRatio = s.yRatio;

        let rgb = 0;
        if (blackout) {
          rgb = 255; // 漆黒時はすべて白星
        } else if (rCount <= 1) {
          rgb = 0; // 1問目は全星が黒
        } else {
          // 縦グラデーション位置に同期して 0 (黒) 〜 255 (白) へ自然に変色
          const progressFactor = Math.min(rCount / Math.max(totalCountRef.current, 1), 1.0);
          const ratio = Math.min(verticalRatio * progressFactor * 1.25, 1.0);
          rgb = Math.round(ratio * 255);
        }

        ctx.fillStyle = `rgba(${rgb}, ${rgb}, ${rgb}, ${alpha})`;

        if (s.isGemini) {
          // Gemini 4点星
          const r = s.size;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - r);
          ctx.quadraticCurveTo(screenX, screenY, screenX - r, screenY);
          ctx.quadraticCurveTo(screenX, screenY, screenX, screenY + r);
          ctx.quadraticCurveTo(screenX, screenY, screenX + r, screenY);
          ctx.quadraticCurveTo(screenX, screenY, screenX, screenY - r);
          ctx.closePath();
          ctx.fill();
        } else {
          // 95% 丸い極小星
          ctx.beginPath();
          ctx.arc(screenX, screenY, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ======================================================================
      // 🌟 画面中央に常に位置する「魂のカケラ（Gemini幾何学星）」
      // 質問に答えた瞬間に、下へ推進したかのような美しい残像（上方向へのゴースト星と光条）を放つ
      // ======================================================================
      const centerX = width / 2;
      const centerY = height / 2;

      // 自転
      coreRotation += dt * 0.45;

      // 現在の回答数に基づくカラーパレット（青・赤・黄・緑の受肉シフト）
      const currentPalette = GOOGLE_PALETTES[answerIndexRef.current % GOOGLE_PALETTES.length];

      // 回答時の推進・残像パルス計算
      let shiftY = 0;
      let pulseIntensity = 0;
      const pulseAnim = pulseAnimRef.current;

      if (pulseAnim.active) {
        const elapsed = (now - pulseAnim.startTime) * 0.001; // 秒
        const duration = 0.85; // 残像がフェードアウトする時間
        if (elapsed >= duration) {
          pulseAnim.active = false;
        } else {
          const p = elapsed / duration;
          // 急峻に立ち上がり、なめらかに減衰（イーズアウト）
          pulseIntensity = Math.pow(1 - p, 2.2);
          // 下への推進バウンス（下へ最大28px沈み込み、中央へ戻る）
          shiftY = Math.sin(p * Math.PI) * 28;
        }
      }

      const mainY = centerY + shiftY;
      const baseRadius = 38 * (1 + 0.04 * Math.sin(now * 0.003));

      // --- 1. 残像（ゴースト星 & ワープ光条）の描画 ---
      if (pulseIntensity > 0.01) {
        // 上空へ伸びる光のワープストリーク（光条）
        const streakLength = 160 * pulseIntensity;
        const streakGrad = ctx.createLinearGradient(centerX, mainY, centerX, mainY - streakLength);
        streakGrad.addColorStop(0, currentPalette.glow);
        streakGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = streakGrad;
        ctx.lineWidth = 3 * pulseIntensity;
        ctx.beginPath();
        ctx.moveTo(centerX, mainY);
        ctx.lineTo(centerX, mainY - streakLength);
        ctx.stroke();

        // 4段階のゴースト残像（上空へ尾を引く）
        const ghostCount = 4;
        for (let k = 1; k <= ghostCount; k++) {
          const ghostY = mainY - k * (32 * pulseIntensity);
          const ghostAlpha = pulseIntensity * (0.5 - k * 0.1);
          if (ghostAlpha <= 0) continue;

          const ghostRadius = baseRadius * (1.0 - k * 0.08);
          const ghostRot = coreRotation - k * 0.12;

          ctx.save();
          ctx.translate(centerX, ghostY);
          ctx.rotate(ghostRot);

          // ゴースト破線リング
          ctx.strokeStyle = currentPalette.color;
          ctx.globalAlpha = ghostAlpha * 0.8;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, ghostRadius * 1.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // ゴーストGemini星
          ctx.fillStyle = currentPalette.color;
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

      // --- 2. 星本体（中央コア）の描画 ---
      ctx.save();
      ctx.translate(centerX, mainY);
      ctx.rotate(coreRotation);

      // 同心円の幾何学破線リング
      ctx.strokeStyle = currentPalette.color;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 外周の幾何学サークル（繊細な境界線）
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = blackout ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.95, 0, Math.PI * 2);
      ctx.stroke();

      // 放射オーラグロー（回答時にブワッと膨張）
      const glowR = baseRadius * (1.6 + 0.6 * pulseIntensity);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
      grad.addColorStop(0, currentPalette.glow);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Gemini 4点ダイヤモンド星
      const r = baseRadius;
      ctx.fillStyle = currentPalette.color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(0, 0, -r, 0);
      ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.quadraticCurveTo(0, 0, 0, -r);
      ctx.closePath();
      ctx.fill();

      // 中心核（純白のハイライト）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};

export default StarField;
