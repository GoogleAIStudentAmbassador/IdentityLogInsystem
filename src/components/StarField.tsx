import React, { useEffect, useRef } from 'react';

interface StarFieldProps {
  revealedCount?: number;
  totalCount?: number;
  isBlackout?: boolean;
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
 * 🌟 ユーザーがスクロールすると、星々が文字・質問コンテンツと完全に同期して上に流れます。
 * 1問目（白背景）では全星が黒く、
 * 質問が進んで下へスクロールするほど、下部の星が自然と白く発光していきます。
 * ラスト問題回答後（ブラックアウト）は全星が一斉に純白に輝きます。
 */
export const StarField: React.FC<StarFieldProps> = ({
  revealedCount = 1,
  totalCount = 32,
  isBlackout = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isBlackoutRef = useRef(isBlackout);
  const revealedCountRef = useRef(revealedCount);
  const totalCountRef = useRef(totalCount);

  useEffect(() => {
    isBlackoutRef.current = isBlackout;
    revealedCountRef.current = revealedCount;
    totalCountRef.current = totalCount;
  }, [isBlackout, revealedCount, totalCount]);

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
