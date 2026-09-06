import type { Archetype } from '../types';

export interface CardUserInfo {
  discordUserId?: string;
  name?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  nickname?: string | null;
  traitScores?: Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> | null;
}

/**
 * 診断結果(16タイプのモッフィー)とユーザー情報をもとに、
 * Canvas上でアンバサダー自身とパートナーモッフィーを象徴する公式パートナーカード(800x1000)を動的描画し、
 * PNG Blobとして返却します。
 *
 * 表示構成（上から順）：
 * 1. 公式ヘッダー（カテゴリー ＆ MBTI）
 * 2. モッフィー キャラクタービジュアル（中央オーラグロー）
 * 3. ユーザー名（ニックネーム最優先、未設定時はフルネーム）
 * 4. モッフィーの通称（archetype.title）
 * 5. 性格を一言で表したやつ（cleanBadge）
 * 6. リザルト性格分布（4次元心理バランス: E/I, S/N, T/F, J/P）
 * 7. 公式シンボル装備 ＆ TechHub 公式フッター
 */
async function renderProfileCardInternal(
  archetype: Archetype,
  userInfo: CardUserInfo,
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

  // 2. ミニマルな外枠フレーム（Google AI デザイン）
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

  // カテゴリ & MBTI表示
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 12px monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('GOOGLE AI STUDENT AMBASSADOR // OFFICIAL PARTNER', 400, 72);

  ctx.fillStyle = archetype.accentColor;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`CATEGORY: ${archetype.groupName}  |  MBTI: [${archetype.mbtiCode}]`, 400, 95);
  ctx.restore();

  // 4. メイン：モッフィーのキャラクタービジュアル
  ctx.save();
  const centerX = 400;
  const centerY = 245;
  const imgRadius = 125; // 直径 250px の大型ビジュアル

  // 背後の巨大オーラグロー
  const auraGrad = ctx.createRadialGradient(centerX, centerY, 30, centerX, centerY, 185);
  auraGrad.addColorStop(0, `${archetype.primaryColor}aa`);
  auraGrad.addColorStop(0.5, `${archetype.accentColor}44`);
  auraGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 185, 0, Math.PI * 2);
  ctx.fill();

  // 幾何学リング（外周の繊細な軌道）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, imgRadius + 14, 0, Math.PI * 2);
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
      if (!src.startsWith('blob:') && !src.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
      });

      // 円形クリッピングでAIイラストを描画
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
    const bodyGrad = ctx.createRadialGradient(centerX - 25, centerY - 25, 15, centerX, centerY, imgRadius);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.7, archetype.accentColor);
    bodyGrad.addColorStop(1, archetype.primaryColor);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, imgRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(archetype.mbtiCode, centerX, centerY);
  }
  ctx.restore();

  // ====================================================================
  // 5. 【ユーザー指示 ①】名前（ニックネーム最優先）
  // ====================================================================
  ctx.save();
  ctx.textAlign = 'center';

  // ニックネーム優先判定
  const nicknameVal = (userInfo.nickname || '').trim();
  const fullNameVal = [userInfo.lastName, userInfo.firstName].filter(Boolean).join(' ').trim() || (userInfo.name || '').trim();
  let displayName = nicknameVal || fullNameVal || userInfo.discordUserId || 'Ambassador';
  displayName = displayName.replace(/[\r\n\t]/g, ' ').trim();

  // 長大文字列に対する動的フォントサイズ自動調整（はみ出し防止）
  const maxNameWidth = 620;
  let fontSize = 34;
  ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  while (ctx.measureText(displayName).width > maxNameWidth && fontSize > 18) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  }

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = archetype.primaryColor;
  ctx.shadowBlur = 16;
  ctx.fillText(displayName, 400, 420);
  ctx.shadowBlur = 0;

  // ====================================================================
  // 6. 【ユーザー指示 ②】モッフィーの通称 (archetype.title)
  // ====================================================================
  ctx.fillStyle = archetype.accentColor;
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText(archetype.title, 400, 452);

  // ====================================================================
  // 7. 【ユーザー指示 ③】性格を一言で表したやつ (例: 規律と実行の運営モッフィー)
  // ====================================================================
  const cleanBadge = archetype.badge
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .trim();

  if (cleanBadge) {
    ctx.font = '500 13px "Segoe UI", sans-serif';
    const badgeTextWidth = ctx.measureText(cleanBadge).width;
    const pillWidth = Math.min(620, Math.max(220, badgeTextWidth + 36));
    const pillHeight = 28;
    const pillX = 400 - pillWidth / 2;
    const pillY = 472;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanBadge, 400, pillY + pillHeight / 2);
    ctx.textBaseline = 'alphabetic'; // 元に戻す
  }
  ctx.restore();

  // ====================================================================
  // 8. 【ユーザー指示 ④】リザルトで出る性格の分布 (4つの心理次元バランス)
  // ====================================================================
  ctx.save();

  // 心理次元比率の計算（ResultScreen と同一ロジック）
  const calcDimensionRatio = (pos: 'E' | 'S' | 'T' | 'J', neg: 'I' | 'N' | 'F' | 'P') => {
    if (!userInfo.traitScores) {
      const hasPos = archetype.mbtiCode.includes(pos);
      return { posPct: hasPos ? 70 : 30, negPct: hasPos ? 30 : 70 };
    }
    const posScore = userInfo.traitScores[pos] || 0;
    const negScore = userInfo.traitScores[neg] || 0;
    const total = posScore + negScore;
    if (total === 0) return { posPct: 50, negPct: 50 };
    const posPct = Math.round((posScore / total) * 100);
    return { posPct, negPct: 100 - posPct };
  };

  const dimensions = [
    {
      leftName: '外向 [E]',
      rightName: '[I] 内向',
      ratio: calcDimensionRatio('E', 'I'),
      color: '#4285f4', // Google Blue
    },
    {
      leftName: '現実 [S]',
      rightName: '[N] 直観',
      ratio: calcDimensionRatio('S', 'N'),
      color: '#34a853', // Google Green
    },
    {
      leftName: '論理 [T]',
      rightName: '[F] 感情',
      ratio: calcDimensionRatio('T', 'F'),
      color: '#ea4335', // Google Red
    },
    {
      leftName: '計画 [J]',
      rightName: '[P] 柔軟',
      ratio: calcDimensionRatio('J', 'P'),
      color: '#fbbc04', // Google Yellow
    },
  ];

  // セクション見出し
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 11px monospace';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('PERSONALITY SPECTRUM // 4つの心理次元バランス', 400, 532);

  // 4次元バー描画
  const spectrumWidth = 580;
  const spectrumStartX = 400 - spectrumWidth / 2; // 110
  const spectrumStartY = 556;
  const rowHeight = 44; // ラベル + バー + 余白

  dimensions.forEach((dim, idx) => {
    const rowY = spectrumStartY + idx * rowHeight;
    const { posPct, negPct } = dim.ratio;

    // 左側ラベル (外向/現実/論理/計画)
    ctx.textAlign = 'left';
    ctx.font = posPct >= 50 ? 'bold 12px "Segoe UI", sans-serif' : '500 12px "Segoe UI", sans-serif';
    ctx.fillStyle = posPct >= 50 ? '#ffffff' : '#94a3b8';
    ctx.fillText(`${dim.leftName} ${posPct}%`, spectrumStartX, rowY);

    // 右側ラベル (内向/直観/感情/柔軟)
    ctx.textAlign = 'right';
    ctx.font = negPct > 50 ? 'bold 12px "Segoe UI", sans-serif' : '500 12px "Segoe UI", sans-serif';
    ctx.fillStyle = negPct > 50 ? '#ffffff' : '#94a3b8';
    ctx.fillText(`${negPct}% ${dim.rightName}`, spectrumStartX + spectrumWidth, rowY);

    // プログレスバー背景
    const barY = rowY + 6;
    const barHeight = 8;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(spectrumStartX, barY, spectrumWidth, barHeight, 4);
    ctx.fill();

    // プログレスバー（アクティブ側）
    const fillWidth = Math.max(4, Math.min(spectrumWidth, Math.round((spectrumWidth * posPct) / 100)));
    ctx.fillStyle = dim.color;
    ctx.beginPath();
    ctx.roundRect(spectrumStartX, barY, fillWidth, barHeight, 4);
    ctx.fill();

    // 50% のセンターマーカー（微小な縦線）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(spectrumStartX + spectrumWidth / 2, barY - 1);
    ctx.lineTo(spectrumStartX + spectrumWidth / 2, barY + barHeight + 1);
    ctx.stroke();
  });
  ctx.restore();

  // ====================================================================
  // 9. 公式シンボル装備（アクセサリ）
  // ====================================================================
  if (archetype.signatureAccessory) {
    ctx.save();
    ctx.textAlign = 'center';

    const accBoxY = 744;
    const accBoxWidth = 580;
    const accBoxHeight = 44;
    const accBoxX = 400 - accBoxWidth / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = `${archetype.accentColor}44`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(accBoxX, accBoxY, accBoxWidth, accBoxHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px monospace';
    ctx.letterSpacing = '1px';
    ctx.fillText('SIGNATURE ACCESSORY', 400, accBoxY + 16);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.letterSpacing = '0px';

    // 長い場合はカット
    let accText = archetype.signatureAccessory;
    if (ctx.measureText(accText).width > accBoxWidth - 30) {
      while (ctx.measureText(accText + '...').width > accBoxWidth - 30 && accText.length > 5) {
        accText = accText.slice(0, -1);
      }
      accText += '...';
    }
    ctx.fillText(accText, 400, accBoxY + 33);
    ctx.restore();
  }

  // お気に入りギア
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.fillText(`FAVORITE GEAR: ${archetype.luckyItem}`, 400, 814);
  ctx.restore();

  // 10. フッターライン
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 880);
  ctx.lineTo(720, 880);
  ctx.stroke();
  ctx.restore();

  // 11. フッター：TechHub ロゴアイコン ＆ 「powered by Google AI TechHub for Student Ambassador」
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      logoImg.src = `${baseUrl}techhub-logo.png`;
    });

    ctx.save();
    const footerText = 'powered by Google AI TechHub for Student Ambassador';
    ctx.font = '500 13px "Segoe UI", system-ui, sans-serif';
    const textWidth = ctx.measureText(footerText).width;

    const iconHeight = 24;
    const iconWidth = logoImg.width ? (logoImg.width / logoImg.height) * iconHeight : 42;
    const gap = 12;
    const totalWidth = iconWidth + gap + textWidth;
    const startX = (800 - totalWidth) / 2;
    const footerY = 926;

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
 *
 * 第2引数は discordUserId（文字列）または CardUserInfo（オブジェクト）の双方に対応し、
 * 後方互換性を完全に担保しています。
 */
export async function generateProfileCardBlob(
  archetype: Archetype,
  discordUserIdOrUserInfo?: string | CardUserInfo,
  customImage?: string | Blob | null,
  legacyUserInfo?: CardUserInfo
): Promise<{ blob: Blob; dataUrl: string }> {
  const userInfo: CardUserInfo =
    typeof discordUserIdOrUserInfo === 'object' && discordUserIdOrUserInfo !== null
      ? discordUserIdOrUserInfo
      : {
          discordUserId: typeof discordUserIdOrUserInfo === 'string' ? discordUserIdOrUserInfo : undefined,
          name: legacyUserInfo?.name,
          lastName: legacyUserInfo?.lastName,
          firstName: legacyUserInfo?.firstName,
          nickname: legacyUserInfo?.nickname,
          traitScores: legacyUserInfo?.traitScores,
        };

  try {
    return await renderProfileCardInternal(archetype, userInfo, customImage);
  } catch (err) {
    console.warn('Card generation failed with custom image (possible CORS/Tainted Canvas). Falling back to official archetype asset:', err);
    try {
      return await renderProfileCardInternal(archetype, userInfo, null);
    } catch (fallbackErr) {
      console.error('Fatal: even official fallback card generation failed:', fallbackErr);
      throw fallbackErr;
    }
  }
}

