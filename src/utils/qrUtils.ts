import QRCode from 'qrcode';
import type { QrPassportData } from '../types';

/**
 * テキストからQRコードのData URL（PNG）を生成します。
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 360,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR Code:', err);
    throw err;
  }
}

/**
 * 中央にモッフィーアイコンを合成したQRコードのData URLを生成します。
 * 高い誤り訂正レベル(H: 約30%復元可能)を使用するため、読み取り精度を維持します。
 */
export async function generateMoffyQrDataUrl(text: string, moffyImageUrl?: string | null): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, text, {
      width: 400,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });

    if (!moffyImageUrl) {
      return canvas.toDataURL('image/png');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return canvas.toDataURL('image/png');
    }

    // モッフィー画像のロード（ローカル・リモート両対応）
    const img = new Image();
    const isRemote = moffyImageUrl.startsWith('http://') || moffyImageUrl.startsWith('https://');
    if (isRemote) {
      img.crossOrigin = 'anonymous';
    }

    await new Promise<void>((resolve) => {
      let isDone = false;
      img.onload = () => {
        if (!isDone) {
          isDone = true;
          resolve();
        }
      };
      img.onerror = () => {
        if (!isDone) {
          isDone = true;
          // crossOrigin付きで失敗した場合、crossOriginなしで再試行
          if (img.crossOrigin) {
            const retryImg = new Image();
            retryImg.onload = () => {
              try {
                // retryImgが読み込めたらimgを差し替え
                Object.assign(img, retryImg);
              } catch {
                // ignore
              }
              resolve();
            };
            retryImg.onerror = () => resolve();
            retryImg.src = moffyImageUrl;
          } else {
            resolve();
          }
        }
      };
      img.src = moffyImageUrl;
    });

    if (img.complete && img.naturalWidth > 0) {
      const qrSize = canvas.width;
      const logoSize = Math.floor(qrSize * 0.24); // QR全体の約24%
      const x = (qrSize - logoSize) / 2;
      const y = (qrSize - logoSize) / 2;
      const radius = logoSize / 2;
      const centerX = qrSize / 2;
      const centerY = qrSize / 2;

      ctx.save();
      // 外枠の白い円座（QRコードとの境界を明確化）
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#e5e7eb';
      ctx.stroke();

      // 円形クリッピングしてモッフィーを描画
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x, y, logoSize, logoSize);
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Failed to generate Moffy QR Code:', err);
    return generateQrCodeDataUrl(text);
  }
}


/**
 * 自分のアンバサダープロフィールから公開Webページ (share.html) のURLを生成します。
 * スマートフォンのカメラ等でスキャンした際、直接ブラウザで公開Webページを開けます。
 */
export function createPassportShareUrl(passport: Omit<QrPassportData, 'type' | 'timestamp'>): string {
  const isBrowser = typeof window !== 'undefined' && !!window.location;
  let baseUrl = '';
  if (isBrowser) {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/[^/]*$/, '');
    baseUrl = `${origin}${pathname}share.html`;
  } else {
    baseUrl = './share.html';
  }

  const url = new URL(baseUrl, isBrowser ? window.location.href : 'https://moffy-ambassador.local/');
  url.searchParams.set('id', passport.id);
  if (passport.mbti) url.searchParams.set('mbti', passport.mbti);
  // 【最重要セキュリティ要件】ニックネーム設定時は、URLパラメータからも本名を完全に除外してプライバシーを厳格保護
  if (passport.nickname && passport.nickname.trim()) {
    url.searchParams.set('nick', passport.nickname.trim());
  } else {
    if (passport.name) url.searchParams.set('name', passport.name);
    if (passport.lastName) url.searchParams.set('last_name', passport.lastName);
    if (passport.firstName) url.searchParams.set('first_name', passport.firstName);
  }
  if (passport.university) url.searchParams.set('univ', passport.university);
  if (passport.grade) url.searchParams.set('grade', passport.grade);
  if (passport.photoUrl) url.searchParams.set('photo', passport.photoUrl);
  if (passport.birthday) url.searchParams.set('bday', passport.birthday);
  if (passport.showBirthday !== undefined) url.searchParams.set('showBday', passport.showBirthday ? '1' : '0');

  // SNSリンクを安全にコンパクトエンコード
  if (passport.snsLinks && passport.snsLinks.length > 0) {
    try {
      const minimalSns = passport.snsLinks.map((s) => ({ p: s.platform, v: s.value }));
      url.searchParams.set('sns', JSON.stringify(minimalSns));
    } catch {
      // ignore
    }
  }

  return url.toString();
}

/**
 * QRコード用のペイロード文字列を生成します（公開Webページの完全URL）。
 */
export function createPassportQrPayload(passport: Omit<QrPassportData, 'type' | 'timestamp'>): string {
  return createPassportShareUrl(passport);
}

export interface ParsedPassport {
  id: string;
  name?: string;
  lastName?: string;
  firstName?: string;
  nickname?: string;
  mbti: string;
  university: string;
  grade: string;
  photoUrl?: string | null;
  birthday?: string | null;
  showBirthday?: boolean;
  snsLinks?: { platform: string; value: string }[];
}

/**
 * スキャンされたQRコード文字列をパースします。
 */
export function parsePassportQrPayload(text: string): ParsedPassport | null {
  if (!text || typeof text !== 'string') return null;

  try {
    const data = JSON.parse(text.trim());
    if (data && data.type === 'moffy_passport' && data.id && data.mbti) {
      return {
        id: String(data.id),
        name: data.name ? String(data.name) : undefined,
        lastName: data.lastName ? String(data.lastName) : undefined,
        firstName: data.firstName ? String(data.firstName) : undefined,
        nickname: data.nickname ? String(data.nickname) : undefined,
        mbti: data.mbti,
        university: data.university || '未設定',
        grade: data.grade || 'B1',
        photoUrl: data.photoUrl || null,
      };
    }
  } catch {
    // JSON形式でない場合（例: Discord ID文字列単体、またはURLパラメータ）
  }

  // フォールバック: URLパラメータ（share.html?id=...等）または直接文字列の場合
  try {
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const url = new URL(text);
      const discordId = url.searchParams.get('id') || url.searchParams.get('discord_id') || url.searchParams.get('user_id');
      const mbti = url.searchParams.get('mbti') || 'INTJ';
      if (discordId) {
        let parsedSns: { platform: string; value: string }[] | undefined;
        const snsRaw = url.searchParams.get('sns');
        if (snsRaw) {
          try {
            const rawArray = JSON.parse(snsRaw);
            if (Array.isArray(rawArray)) {
              parsedSns = rawArray.map((item: any) => ({
                platform: item.p || item.platform || 'website',
                value: item.v || item.value || '',
              }));
            }
          } catch {
            // ignore
          }
        }

        return {
          id: discordId,
          name: url.searchParams.get('name') || undefined,
          lastName: url.searchParams.get('last_name') || undefined,
          firstName: url.searchParams.get('first_name') || undefined,
          nickname: url.searchParams.get('nick') || url.searchParams.get('nickname') || undefined,
          mbti: (mbti as any) || 'INTJ',
          university: url.searchParams.get('univ') || url.searchParams.get('university') || '未設定',
          grade: url.searchParams.get('grade') || 'B1',
          photoUrl: url.searchParams.get('photo') || url.searchParams.get('photo_url') || null,
          birthday: url.searchParams.get('bday') || null,
          showBirthday: url.searchParams.get('showBday') === '1',
          snsLinks: parsedSns,
        };
      }
    } else if (/^[a-zA-Z0-9_.#-]{2,64}$/.test(text.trim())) {
      // Discord ID直接の場合
      return {
        id: text.trim(),
        mbti: 'INTJ',
        university: '未設定',
        grade: 'B1',
        photoUrl: null,
      };
    }
  } catch {
    // ignore
  }

  return null;
}
