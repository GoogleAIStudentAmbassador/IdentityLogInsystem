import React, { useEffect, useRef } from 'react';

interface OrbitingStarsProps {
  count?: number;
  isDark?: boolean;
}

/**
 * ユーザーが入力する項目の周囲を、幾何学的な正弦波（Harmonic Wave）で
 * うねうねとリズミカルに波打ちながら周回（公転）する星々。
 * 幾何学的な対称性（6周期の調和波）と立体的なスケール変化を併せ持ちます。
 */
export const OrbitingStars: React.FC<OrbitingStarsProps> = ({ count = 5, isDark = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const starRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current?.parentElement) return;
    const parent = containerRef.current.parentElement;

    let width = parent.clientWidth || 340;
    let height = parent.clientHeight || 56;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          width = w;
          height = h;
        }
      }
    });
    observer.observe(parent);

    let animationFrameId: number;
    const startTime = performance.now();

    // 幾何学的パラメータ
    const baseSpeed = 0.55; // 公転の角速度 (rad/s)
    const waveFreq = 6; // 1周で6回規則正しくうねる幾何学的周期
    const waveAmp = 10; // うねりの振幅 (px)
    const superellipseExp = 2 / 3.4; // カプセル型の角丸に沿う超楕円指数

    const render = (currentTime: number) => {
      const elapsed = (currentTime - startTime) * 0.001; // 秒
      const cx = width / 2;
      const cy = height / 2;

      // 入力枠に沿ったベース半軸長
      const rx = width / 2 + 16;
      const ry = height / 2 + 16;

      const starElements = starRefs.current;

      for (let i = 0; i < count; i++) {
        const el = starElements[i];
        if (!el) continue;

        // 各星の公転位相（等間隔）
        const phaseOffset = (i * 2 * Math.PI) / count;
        const theta = elapsed * baseSpeed + phaseOffset;

        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const signCos = Math.sign(cosT) || 1;
        const signSin = Math.sign(sinT) || 1;

        // 1. カプセル型ベース軌道（超楕円 Lamé Curve）
        const baseX = rx * signCos * Math.pow(Math.abs(cosT), superellipseExp);
        const baseY = ry * signSin * Math.pow(Math.abs(sinT), superellipseExp);

        // 2. 幾何学的な正弦波のうねり（法線方向への高調波振動）
        const primaryWave = Math.sin(waveFreq * theta + elapsed * 1.5);
        const secondaryWave = 0.3 * Math.sin(waveFreq * 2 * theta - elapsed * 1.0);
        const totalWave = (primaryWave + secondaryWave) * waveAmp;

        // うねりベクトルの適用
        const finalX = cx + baseX + cosT * totalWave;
        const finalY = cy + baseY + sinT * totalWave;

        // 3. うねりに同期した立体感（スケール ＆ 傾き）
        const scale = 0.85 + 0.28 * ((primaryWave + 1) / 2); // 0.85 〜 1.13 で伸縮
        const rotation = (theta * 180) / Math.PI + primaryWave * 25; // 軌道角＋うねりチルト

        // DOMへ直接トランスフォーム適用（超軽量・60/120fps維持）
        el.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [count]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-visible z-20"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            starRefs.current[i] = el;
          }}
          className="absolute top-0 left-0 will-change-transform pointer-events-none"
        >
          {/* 小さい星 (Gemini 4点星 ✦) - 暗い背景では白く発光、明るい背景では黒 */}
          <svg
            viewBox="0 0 24 24"
            className={`w-4 h-4 ${
              isDark
                ? 'fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.95)] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                : 'fill-gray-900 drop-shadow-[0_0_3px_rgba(0,0,0,0.4)]'
            }`}
          >
            <path d="M 12 2 Q 12 12 2 12 Q 12 12 12 22 Q 12 12 22 12 Q 12 12 12 2 Z" />
          </svg>
        </div>
      ))}
    </div>
  );
};

export default OrbitingStars;
