import type {
  RegistrationResult,
  VerifyMoffyResponse,
  CreateMoffyParams,
  CreateMoffyResponse,
  EditImageResponse,
  PartnerProfileResponse,
} from '../types';

const DEFAULT_BASE_URL = 'https://moffy-profile-287701603412.asia-northeast1.run.app';

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_MOFFY_API_BASE_URL) {
    return import.meta.env.VITE_MOFFY_API_BASE_URL.replace(/\/+$/, '');
  }
  // Vite開発サーバー（ローカル環境）ではプロキシ経由でCORSを完全回避
  if (import.meta.env.DEV) {
    return '';
  }
  return DEFAULT_BASE_URL;
}

export function getApiKey(): string {
  return import.meta.env.VITE_MOFFY_API_KEY || '';
}

export async function checkApiHealth(): Promise<{ authenticated: boolean; name: string; canCreate: boolean }> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('VITE_MOFFY_API_KEY is not set. API calls will not be authenticated.');
    return { authenticated: false, name: '', canCreate: false };
  }
  try {
    const res = await fetch(`${baseUrl}/api/v1/ping`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });
    if (!res.ok) {
      return { authenticated: false, name: '', canCreate: false };
    }
    const data = await res.json();
    return {
      authenticated: data.status === 'authenticated',
      name: data.authenticated_as || '',
      canCreate: !!data.can_create_user,
    };
  } catch (err) {
    console.error('API ping error:', err);
    return { authenticated: false, name: '', canCreate: false };
  }
}

export async function registerUserProfile(
  discordUserId: string,
  password: string,
  photoBlob: Blob
): Promise<RegistrationResult> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。GitHub Secrets の VITE_MOFFY_API_KEY を設定してください。');
  }
  const formData = new FormData();
  formData.append('discord_user_id', discordUserId);
  formData.append('password', password);
  formData.append('photo', photoBlob, `${discordUserId}_card.png`);

  const res = await fetch(`${baseUrl}/api/v1/profile`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = '登録に失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string'
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const result: RegistrationResult = await res.json();
  return result;
}

export async function fetchUserProfile(discordUserId: string): Promise<RegistrationResult | null> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(`${baseUrl}/api/v1/getProfile?discord_user_id=${encodeURIComponent(discordUserId)}`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function verifyMoffyImage(imageBlob: Blob | File): Promise<VerifyMoffyResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('image', imageBlob, imageBlob instanceof File ? imageBlob.name : 'upload.png');
  if (apiKey) {
    formData.append('api_key', apiKey);
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(`${baseUrl}/api/v1/verify_moffy`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = 'モッフィー鑑定リクエストに失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string'
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data: VerifyMoffyResponse = await res.json();
  return data;
}

/**
 * ユーザー入力テキストに基づき、ベースモッフィー（通常のモッフィー）を生成します。
 * POST /api/v1/create_moffy
 */
export async function createMoffy(params: CreateMoffyParams): Promise<CreateMoffyResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('color', params.color || '白');
  formData.append('expression', params.expression || 'にっこり微笑んでいる');
  formData.append('hair_features', params.hair_features || '長毛で綿毛のように細かくふわふわした毛並み');
  formData.append('body_shape', params.body_shape || '丸っこい2頭身でぽってりした形');
  formData.append('body_features', params.body_features || '小さな手足、背中に小さな白い羽');
  formData.append('mouth_features', params.mouth_features || '小さく開いたかわいい口、ちょこんと出た小さな八重歯');
  formData.append('accessories', params.accessories || 'なし');

  if (apiKey) {
    formData.append('api_key', apiKey);
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(`${baseUrl}/api/v1/create_moffy`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = 'モッフィー生成リクエストに失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string'
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return await res.json();
}

/**
 * 新エンドポイント: 複数画像（ベースモッフィー ＋ アイテム）と指示プロンプトをもとに合成編集します。
 * POST /api/v1/edit_image
 */
export async function editMoffyImage(
  prompt: string,
  images: (Blob | File)[]
): Promise<EditImageResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('prompt', prompt);

  images.forEach((img, idx) => {
    const filename = img instanceof File ? img.name : `source_${idx + 1}.png`;
    formData.append('images', img, filename);
  });

  if (apiKey) {
    formData.append('api_key', apiKey);
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(`${baseUrl}/api/v1/edit_image`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = 'モッフィー画像合成リクエストに失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string'
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return await res.json();
}

/**
 * 2枚目のアレンジ画像（生成されたモッフィー）をアカウントプロファイルに登録します。
 * POST /api/v1/profile/arranged_photo
 */
export async function updateArrangedPhoto(
  discordUserId: string,
  photoOrUrl: Blob | File | string
): Promise<PartnerProfileResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('discord_user_id', discordUserId);

  if (typeof photoOrUrl === 'string') {
    formData.append('arranged_photo_url', photoOrUrl);
  } else {
    const filename = photoOrUrl instanceof File ? photoOrUrl.name : `${discordUserId}_arranged.png`;
    formData.append('arranged_photo', photoOrUrl, filename);
  }

  if (apiKey) {
    formData.append('api_key', apiKey);
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(`${baseUrl}/api/v1/profile/arranged_photo`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = 'アレンジ画像更新に失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string'
          ? errJson.detail
          : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return await res.json();
}

/**
 * Base64文字列またはData URLをBlobオブジェクトに変換します。
 */
export function base64ToBlob(base64Data: string, mimeType = 'image/png'): Blob {
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * URLから画像をfetchしてBlobとして取得します。
 */
export async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`画像の取得に失敗しました: ${url}`);
  }
  return await res.blob();
}

