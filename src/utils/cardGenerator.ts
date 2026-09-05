import type { Archetype } from '../types';

/**
 * 診断結果(16タイプのモッフィー)をもとに、
 * Canvas上で各キャラクターを最大限に強調した洗練された公式パートナーカード(800x1000)を動的描画し、
 * PNG Blobとして返却します。
 *
 * ID表示・基本ステータスを全廃し、キャラクタービジュアルを中心とした高品質なカードを生成します。
 */
async function renderProfileCardInternal(
  archetype: Archetype,
  _discordUserId?: string,
  customImage?: string | Blob | null
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // 1. 背景グラデーション（深宇宙からモッフィーのテーマカラーへ）
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 1000);
  bgGrad.addColorStop(0, '#06080f');
  bgGrad.addColorStop(0.4, archetype.bgGradient[0]);
  bgGrad.addColorStop(1, archetype.bgGradient[1]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, 1000);

  // 背景の微小な星屑（ノイズレスな微小点）
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  for (let i = 0; i < 45; i++) {
    const x = (i * 137) % 800;
    const y = (i * 223) % 1000;
    const r = (i % 2) === 0 ? 1.0 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. ミニマルな外枠フレーム（絵文字・過剰装飾を排除したGoogleデザイン）
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(28, 28, 744, 944, 28);
  ctx.stroke();

  // 内側のアクセントライン
  ctx.strokeStyle = `${archetype.accentColor}40`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(38, 38, 724, 924, 20);
  ctx.stroke();
  ctx.restore();

  // 3. ヘッダーエリア
  ctx.save();
  ctx.textAlign = 'center';

  // カテゴリ & クラス表示
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 12px monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('GOOGLE AI STUDENT AMBASSADOR // OFFICIAL PARTNER', 400, 78);

  ctx.fillStyle = archetype.accentColor;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`CATEGORY: ${archetype.groupName}  |  ARCHETYPE: [${archetype.mbtiCode}]`, 400, 102);
  ctx.restore();

  // 4. メイン：モッフィーのキャラクタービジュアル（大幅拡大・最大強調）
  ctx.save();
  const centerX = 400;
  const centerY = 310;
  const imgRadius = 160; // 直径 320px の大型ビジュアルでキャラクターを主役に！

  // 背後の巨大オーラグロー
  const auraGrad = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, 230);
  auraGrad.addColorStop(0, `${archetype.primaryColor}aa`);
  auraGrad.addColorStop(0.5, `${archetype.accentColor}44`);
  auraGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 230, 0, Math.PI * 2);
  ctx.fill();

  // 幾何学リング（外周の繊細な軌道）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, imgRadius + 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // カスタム画像がある場合はBlob URL化してCanvasのCORS汚染を防止
  let customBlobUrl: string | null = null;
  if (customImage instanceof Blob) {
    customBlobUrl = URL.createObjectURL(customImage);
  } else if (typeof customImage === 'string' && customImage.trim()) {
    if (customImage.startsWith('data:') || customImage.startsWith('blob:')) {
      customBlobUrl = customImage;
    } else {
      let loadedBlob: Blob | null = null;
      // 1. ローカルプロキシまたは直接フェッチ試行
      try {
        let fetchUrl = customImage;
        if (import.meta.env.DEV && customImage.startsWith('https://firebasestorage.googleapis.com')) {
          fetchUrl = customImage.replace('https://firebasestorage.googleapis.com', '/firebase-storage');
        }
        const res = await fetch(fetchUrl, { mode: 'cors' });
        if (res.ok) {
          loadedBlob = await res.blob();
        }
      } catch (err) {
        console.warn('Direct image fetch failed, trying CORS proxy:', err);
      }

      // 2. 失敗時は CORS プロキシ経由でフェッチ（Firebase Storage の CORS 未対応を回避）
      if (!loadedBlob) {
        try {
          const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(customImage)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            loadedBlob = await res.blob();
          }
        } catch (proxyErr) {
          console.warn('CORS proxy image fetch failed:', proxyErr);
        }
      }

      if (loadedBlob) {
        customBlobUrl = URL.createObjectURL(loadedBlob);
      } else {
        // 最後の手段として、CORS プロキシ URL をそのまま指定（CORS ヘッダー付きで読み込まれる）
        customBlobUrl = `https://images.weserv.nl/?url=${encodeURIComponent(customImage)}`;
      }
    }
  }

  // 公式AI画像またはユーザーモッフィー画像の読み込み試行
  let imageLoaded = false;
  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
  const imageSources = [
    customBlobUrl,
    `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`,
    archetype.officialImageUrl?.startsWith('/')
      ? `${baseUrl}${archetype.officialImageUrl.slice(1)}`
      : archetype.officialImageUrl,
  ].filter(Boolean) as string[];

  for (const src of imageSources) {
    try {
      const img = new Image();
      // blob: や data: URL には crossOrigin を設定しない（ブラウザエラー防止）
      if (!src.startsWith('blob:') && !src.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
      });

      // 円形クリッピングでAIイラストを高精細に描画
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, imgRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, centerX - imgRadius, centerY - imgRadius, imgRadius * 2, imgRadius * 2);
      ctx.restore();

      // 円形リング枠線
      ctx.strokeStyle = archetype.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, imgRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 内側の繊細なガラス反射リング
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, imgRadius - 4, 0, Math.PI * 2);
      ctx.stroke();

      imageLoaded = true;
      break;
    } catch {
      // 次のソースを試行
    }
  }

  // フォールバック（画像読み込み失敗時）
  if (!imageLoaded) {
    const bodyGrad = ctx.createRadialGradient(centerX - 30, centerY - 30, 20, centerX, centerY, imgRadius);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.7, archetype.accentColor);
    bodyGrad.addColorStop(1, archetype.primaryColor);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, imgRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(archetype.mbtiCode, centerX, centerY);
  }
  ctx.restore();

  // 5. タイトル & サブタイトル & クリーンバッジ
  ctx.save();
  ctx.textAlign = 'center';

  // タイトル（モッフィー名：大きく力強いタイポグラフィ）
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px "Segoe UI", system-ui, sans-serif';
  ctx.shadowColor = archetype.primaryColor;
  ctx.shadowBlur = 18;
  ctx.fillText(archetype.title, 400, 535);

  ctx.shadowBlur = 0;
  // サブタイトル（英語名）
  ctx.fillStyle = archetype.accentColor;
  ctx.font = 'bold 14px monospace';
  ctx.letterSpacing = '1.5px';
  ctx.fillText(archetype.subtitle.toUpperCase(), 400, 566);

  // 絵文字なしのクリーンバッジ
  const cleanBadge = archetype.badge
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .trim();

  if (cleanBadge) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(250, 584, 300, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 12px "Segoe UI", sans-serif';
    ctx.fillText(cleanBadge, 400, 602);
  }
  ctx.restore();

  // 6. 固有アクセサリー（公式シンボル装備）
  if (archetype.signatureAccessory) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = `${archetype.accentColor}55`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(100, 630, 600, 46, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px monospace';
    ctx.fillText('SIGNATURE ACCESSORY', 400, 648);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillText(archetype.signatureAccessory, 400, 666);
    ctx.restore();
  }

  // 7. 特性タグ（絵文字なし・クリーンなピル）
  ctx.save();
  ctx.textAlign = 'center';
  const tagY = 702;
  const tagWidth = 140;
  const spacing = 155;
  const traitsToShow = archetype.traits.slice(0, 4);
  const startX = 400 - (traitsToShow.length * spacing) / 2 + spacing / 2;

  traitsToShow.forEach((trait, i) => {
    const tx = startX + i * spacing;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx - tagWidth / 2, tagY, tagWidth, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 12px "Segoe UI", sans-serif';
    ctx.fillText(trait, tx, tagY + 20);
  });
  ctx.restore();

  // 8. お気に入りギア（ラッキーアイテム）
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillText(`FAVORITE GEAR: ${archetype.luckyItem}`, 400, 772);
  ctx.restore();

  // 9. フッターライン
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 890);
  ctx.lineTo(720, 890);
  ctx.stroke();
  ctx.restore();

  // 10. フッター：TechHub ロゴアイコン ＆ 「powered by Google AI TechHub for Student Ambassador」
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve(); // エラー時もカード生成を阻害しない
      logoImg.src = `${baseUrl}techhub-logo.png`;
    });

    ctx.save();
    const footerText = 'powered by Google AI TechHub for Student Ambassador';
    ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
    const textWidth = ctx.measureText(footerText).width;

    const iconHeight = 26;
    const iconWidth = logoImg.width ? (logoImg.width / logoImg.height) * iconHeight : 46;
    const gap = 12;
    const totalWidth = iconWidth + gap + textWidth;
    const startX = (800 - totalWidth) / 2;
    const footerY = 932;

    if (logoImg.complete && logoImg.naturalWidth !== 0) {
      ctx.drawImage(logoImg, startX, footerY - iconHeight / 2, iconWidth, iconHeight);
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(footerText, startX + iconWidth + gap, footerY);
    ctx.restore();
  } catch (err) {
    console.error('Failed to draw footer logo:', err);
  }

  let dataUrl = '';
  let blob: Blob;
  try {
    dataUrl = canvas.toDataURL('image/png');
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });
  } catch (canvasErr) {
    throw new Error(`Canvas tainted or export failed: ${canvasErr instanceof Error ? canvasErr.message : canvasErr}`);
  }

  return { blob, dataUrl };
}

/**
 * 安全なパートナーカード生成関数
 * 外部画像（Firebase Storage等）によるCORS汚染やSecurityErrorが発生した場合でも、
 * 同一オリジンの公式マスコット画像に自動フォールバックして確実にカードを返却します。
 */
export async function generateProfileCardBlob(
  archetype: Archetype,
  discordUserId?: string,
  customImage?: string | Blob | null
): Promise<{ blob: Blob; dataUrl: string }> {
  try {
    return await renderProfileCardInternal(archetype, discordUserId, customImage);
  } catch (err) {
    console.warn('Card generation failed with custom image (possible CORS/Tainted Canvas). Falling back to official archetype asset:', err);
    try {
      return await renderProfileCardInternal(archetype, discordUserId, null);
    } catch (fallbackErr) {
      console.error('Fatal: even official fallback card generation failed:', fallbackErr);
      throw fallbackErr;
    }
  }
}
