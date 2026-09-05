import type {
  RegistrationResult,
  VerifyMoffyResponse,
  CreateMoffyParams,
  CreateMoffyResponse,
  EditImageResponse,
  PartnerProfileResponse,
  MbtiType,
  LoginResponse,
  AuthConfigResponse,
  GoogleLoginResponse,
  GoogleRegisterPayload,
} from '../types';

/**
 * 画像URLのクエリパラメータ（?mbti=XXXX）からMBTIタイプを抽出します。
 */
export function extractMbtiFromUrl(url?: string | null): MbtiType | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'https://dummy.base');
    const mbti = parsed.searchParams.get('mbti');
    if (mbti && /^(INTJ|INTP|ENTJ|ENTP|INFJ|INFP|ENFJ|ENFP|ISTJ|ISFJ|ESTJ|ESFJ|ISTP|ISFP|ESTP|ESFP)$/i.test(mbti)) {
      return mbti.toUpperCase() as MbtiType;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 画像URLに ?mbti=XXXX パラメータを付加して返します。
 */
export function appendMbtiToUrl(url: string, mbti?: string | null): string {
  if (!mbti || !url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('mbti', mbti.toUpperCase());
    return parsed.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}mbti=${encodeURIComponent(mbti.toUpperCase())}`;
  }
}

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

const AUTH_TOKEN_KEY = 'moffy_user_jwt_token';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
    console.warn('Failed to update auth token in localStorage:', e);
  }
}

export function getApiKey(): string {
  return (import.meta.env.VITE_MOFFY_API_KEY || '').trim();
}

export async function checkApiHealth(): Promise<{ authenticated: boolean; name: string; canCreate: boolean }> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[API Health] VITE_MOFFY_API_KEY is not set. API calls will not be authenticated.');
    return { authenticated: false, name: '', canCreate: false };
  }
  try {
    const targetUrl = `${baseUrl}/api/v1/ping`;
    const res = await fetch(targetUrl, {
      headers: {
        'X-API-Key': apiKey,
      },
    });
    if (!res.ok) {
      console.warn(`[API Health] Ping responded with status ${res.status} (${res.statusText})`);
      return { authenticated: false, name: '', canCreate: false };
    }
    const data = await res.json();
    return {
      authenticated: data.status === 'authenticated',
      name: data.authenticated_as || '',
      canCreate: !!data.can_create_user,
    };
  } catch (err) {
    console.error('[API Health] Ping failed (possible CORS or network error). Base URL:', baseUrl, err);
    return { authenticated: false, name: '', canCreate: false };
  }
}

export interface RegisterProfileOptions {
  grade?: string | null;
  university?: string | null;
  photoBlob?: Blob | File | null;
  arrangedPhotoBlob?: Blob | File | null;
}

export async function registerUserProfile(
  discordUserId: string,
  password: string,
  photoOrOptions?: Blob | File | null | RegisterProfileOptions
): Promise<RegistrationResult> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。GitHub Secrets の VITE_MOFFY_API_KEY を設定してください。');
  }

  let grade = 'B1';
  let university = '未設定';
  let photoBlob: Blob | File | null = null;
  let arrangedPhotoBlob: Blob | File | null = null;

  if (photoOrOptions && ('grade' in photoOrOptions || 'university' in photoOrOptions || 'photoBlob' in photoOrOptions)) {
    const opts = photoOrOptions as RegisterProfileOptions;
    if (opts.grade) grade = opts.grade;
    if (opts.university) university = opts.university;
    if (opts.photoBlob) photoBlob = opts.photoBlob;
    if (opts.arrangedPhotoBlob) arrangedPhotoBlob = opts.arrangedPhotoBlob;
  } else if (photoOrOptions instanceof Blob || photoOrOptions instanceof File) {
    photoBlob = photoOrOptions;
  }

  const formData = new FormData();
  formData.append('discord_user_id', discordUserId);
  formData.append('password', password);
  formData.append('grade', grade);
  formData.append('university', university);

  if (photoBlob) {
    const filename = photoBlob instanceof File ? photoBlob.name : `${discordUserId}_default.png`;
    formData.append('photo', photoBlob, filename);
    formData.append('default_photo', photoBlob, filename);
  }

  if (arrangedPhotoBlob) {
    const filename = arrangedPhotoBlob instanceof File ? arrangedPhotoBlob.name : `${discordUserId}_arranged.png`;
    formData.append('arranged_photo', arrangedPhotoBlob, filename);
  }

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

/**
 * 新エンドポイント: パスワードによる正式なユーザーサインイン
 * POST /api/user/login
 */
export async function loginUser(
  discordUserId: string,
  password: string
): Promise<{ user: RegistrationResult; token?: string | null }> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const res = await fetch(`${baseUrl}/api/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify({
      discord_user_id: discordUserId,
      password: password,
    }),
  });

  if (!res.ok) {
    let errorDetail = 'サインインに失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data: LoginResponse = await res.json();
  if (!data.user) {
    throw new Error('ユーザー情報の取得に失敗しました');
  }

  const userResult: RegistrationResult = {
    discord_user_id: data.user.discord_user_id,
    photo_url: data.user.photo_url || null,
    default_photo_url: data.user.default_photo_url || null,
    arranged_photo_url: data.user.arranged_photo_url || null,
    grade: data.user.grade || null,
    university: data.user.university || null,
    is_staff: !!data.user.is_staff,
    created_at: data.user.created_at,
    updated_at: data.user.updated_at,
    google_id: data.user.google_id || null,
  };

  const extractedMbti =
    extractMbtiFromUrl(userResult.arranged_photo_url) ||
    extractMbtiFromUrl(userResult.default_photo_url) ||
    extractMbtiFromUrl(userResult.photo_url);
  if (extractedMbti) {
    userResult.mbti = extractedMbti;
  }

  if (data.access_token) {
    setStoredAuthToken(data.access_token);
  }

  return { user: userResult, token: data.access_token };
}

/**
 * 公開設定から Google Client ID を取得します
 * GET /api/auth/config
 */
export async function fetchAuthConfig(): Promise<AuthConfigResponse> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/auth/config`);
    if (res.ok) {
      const data: AuthConfigResponse = await res.json();
      if (data.google_client_id) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch auth config from API, falling back to default client ID:', e);
  }
  return {
    google_client_id:
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      '287701603412-6e7r8a8vhl0t8oc117tlgiklnd1letlf.apps.googleusercontent.com',
  };
}

/**
 * Google ID トークンによるパスワードレスログイン / 未登録判定
 * POST /api/googlelogin
 */
export async function loginWithGoogle(credential: string): Promise<GoogleLoginResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const res = await fetch(`${baseUrl}/api/googlelogin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    let errorDetail = 'Google認証に失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data: GoogleLoginResponse = await res.json();
  if (data.access_token) {
    setStoredAuthToken(data.access_token);
  }
  return data;
}

/**
 * Google連携 初回アカウント登録 (オンボーディング)
 * POST /api/google/register
 */
export async function registerGoogleUser(payload: GoogleRegisterPayload): Promise<GoogleLoginResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('temp_token', payload.temp_token);
  formData.append('discord_user_id', payload.discord_user_id);
  formData.append('grade', payload.grade);
  formData.append('university', payload.university);

  if (payload.photo) {
    const filename = payload.photo instanceof File ? payload.photo.name : `${payload.discord_user_id}_default.png`;
    formData.append('photo', payload.photo, filename);
  }
  if (payload.arranged_photo) {
    const filename = payload.arranged_photo instanceof File ? payload.arranged_photo.name : `${payload.discord_user_id}_arranged.png`;
    formData.append('arranged_photo', payload.arranged_photo, filename);
  }

  const res = await fetch(`${baseUrl}/api/google/register`, {
    method: 'POST',
    headers: {
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = 'Google連携アカウントの登録に失敗しました';
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data: GoogleLoginResponse = await res.json();
  if (data.access_token) {
    setStoredAuthToken(data.access_token);
  }
  return data;
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
    const profile: RegistrationResult = await res.json();
    const extractedMbti =
      extractMbtiFromUrl(profile.arranged_photo_url) ||
      extractMbtiFromUrl(profile.default_photo_url) ||
      extractMbtiFromUrl(profile.photo_url);
    if (extractedMbti) {
      profile.mbti = extractedMbti;
    }
    return profile;
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
  photoOrUrl: Blob | File | string,
  mbti?: string | null
): Promise<PartnerProfileResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('discord_user_id', discordUserId);

  if (typeof photoOrUrl === 'string') {
    const finalUrl = appendMbtiToUrl(photoOrUrl, mbti);
    formData.append('arranged_photo_url', finalUrl);
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
 * プロフィール写真（1枚目デフォルト・2枚目アレンジ、または両方）を更新します。
 * POST /api/v1/profile/photo
 */
export async function updateProfilePhotos(
  discordUserId: string,
  params: {
    defaultPhoto?: Blob | File | string | null;
    arrangedPhoto?: Blob | File | string | null;
    mbti?: string | null;
  }
): Promise<PartnerProfileResponse> {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  const formData = new FormData();
  formData.append('discord_user_id', discordUserId);

  if (params.defaultPhoto) {
    if (typeof params.defaultPhoto === 'string') {
      const finalDefault = appendMbtiToUrl(params.defaultPhoto, params.mbti);
      formData.append('default_photo_url', finalDefault);
    } else {
      const filename = params.defaultPhoto instanceof File ? params.defaultPhoto.name : `${discordUserId}_default.png`;
      formData.append('default_photo', params.defaultPhoto, filename);
    }
  }

  if (params.arrangedPhoto) {
    if (typeof params.arrangedPhoto === 'string') {
      const finalArranged = appendMbtiToUrl(params.arrangedPhoto, params.mbti);
      formData.append('arranged_photo_url', finalArranged);
    } else {
      const filename = params.arrangedPhoto instanceof File ? params.arrangedPhoto.name : `${discordUserId}_arranged.png`;
      formData.append('arranged_photo', params.arrangedPhoto, filename);
    }
  }

  if (apiKey) {
    formData.append('api_key_form', apiKey);
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const res = await fetch(`${baseUrl}/api/v1/profile/photo`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = 'プロフィール写真の更新に失敗しました';
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

/**
 * 外部画像URL（Firebase Storage等）をCORSエラーを回避して安全にBlobとして取得します。
 * 1. 直接 fetch を試行
 * 2. 失敗時は CORS プロキシ（images.weserv.nl）経由でフェッチ
 */
export async function fetchImageAsBlob(imageUrl: string): Promise<Blob> {
  // 1. ローカルプロキシまたは直接フェッチ
  let targetUrl = imageUrl;
  if (import.meta.env.DEV && imageUrl.startsWith('https://firebasestorage.googleapis.com')) {
    targetUrl = imageUrl.replace('https://firebasestorage.googleapis.com', '/firebase-storage');
  }

  try {
    const res = await fetch(targetUrl, { mode: 'cors' });
    if (res.ok) {
      return await res.blob();
    }
  } catch (err) {
    console.warn('[fetchImageAsBlob] Direct fetch failed, trying CORS proxy fallback:', err);
  }

  // 2. CORS プロキシ経由
  try {
    const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      return await res.blob();
    }
  } catch (proxyErr) {
    console.warn('[fetchImageAsBlob] Proxy fetch also failed:', proxyErr);
  }

  // 3. 最後のフォールバックとして urlToBlob
  return await urlToBlob(imageUrl);
}

