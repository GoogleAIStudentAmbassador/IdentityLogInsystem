import type {
  RegistrationResult,
  VerifyMoffyResponse,
  CreateMoffyParams,
  CreateMoffyResponse,
  EditImageResponse,
  PartnerProfileResponse,
  MbtiType,
  Archetype,
  LoginResponse,
  AuthConfigResponse,
  GoogleLoginResponse,
  GoogleRegisterPayload,
  FriendItem,
  FriendProgressData,
  PersonalityQuizProgressData,
  TutorialState,
  MoffyQuizData,
  MoffyCustomFeatures,
} from '../types';
import { ARCHETYPE_DEFAULTS } from '../data/personalityQuestions';


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
  // Vite開発サーバー（ローカル環境）ではプロキシ経由でCORSを完全回避
  if (import.meta.env.DEV) {
    return '';
  }
  if (import.meta.env.VITE_MOFFY_API_BASE_URL) {
    return import.meta.env.VITE_MOFFY_API_BASE_URL.replace(/\/+$/, '');
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
  name?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  nickname?: string | null;
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

  let name = discordUserId;
  let lastName = '';
  let firstName = '';
  let nickname = '';
  let grade = 'B1';
  let university = '未設定';
  let photoBlob: Blob | File | null = null;
  let arrangedPhotoBlob: Blob | File | null = null;

  if (photoOrOptions && ('name' in photoOrOptions || 'lastName' in photoOrOptions || 'firstName' in photoOrOptions || 'nickname' in photoOrOptions || 'grade' in photoOrOptions || 'university' in photoOrOptions || 'photoBlob' in photoOrOptions)) {
    const opts = photoOrOptions as RegisterProfileOptions;
    if (opts.lastName && opts.lastName.trim()) lastName = opts.lastName.trim();
    if (opts.firstName && opts.firstName.trim()) firstName = opts.firstName.trim();
    if (opts.nickname && opts.nickname.trim()) nickname = opts.nickname.trim();
    if (opts.name && opts.name.trim()) name = opts.name.trim();
    if (opts.grade) grade = opts.grade;
    if (opts.university) university = opts.university;
    if (opts.photoBlob) photoBlob = opts.photoBlob;
    if (opts.arrangedPhotoBlob) arrangedPhotoBlob = opts.arrangedPhotoBlob;
  } else if (photoOrOptions instanceof Blob || photoOrOptions instanceof File) {
    photoBlob = photoOrOptions;
  }

  const fullName = [lastName, firstName].filter(Boolean).join(' ');
  const finalName = fullName || nickname || name || discordUserId;

  const formData = new FormData();
  formData.append('discord_user_id', discordUserId);
  formData.append('name', finalName);
  if (lastName) formData.append('last_name', lastName);
  if (firstName) formData.append('first_name', firstName);
  if (nickname) formData.append('nickname', nickname);
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
  if (!result.name) result.name = finalName;
  if (!result.last_name && lastName) result.last_name = lastName;
  if (!result.first_name && firstName) result.first_name = firstName;
  if (!result.nickname && nickname) result.nickname = nickname;
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
    name: data.user.name || data.user.display_name || null,
    last_name: data.user.last_name || null,
    first_name: data.user.first_name || null,
    nickname: data.user.nickname || null,
    photo_url: data.user.photo_url || null,
    default_photo_url: data.user.default_photo_url || null,
    arranged_photo_url: data.user.arranged_photo_url || null,
    grade: data.user.grade || null,
    university: data.user.university || null,
    is_staff: !!data.user.is_staff,
    created_at: data.user.created_at,
    updated_at: data.user.updated_at,
    google_id: data.user.google_id || null,
    is_ambassador: Boolean(data.user.is_ambassador),
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
  formData.append('name', payload.name.trim());
  if (payload.last_name) formData.append('last_name', payload.last_name.trim());
  if (payload.first_name) formData.append('first_name', payload.first_name.trim());
  if (payload.nickname) formData.append('nickname', payload.nickname.trim());
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
    console.warn('[fetchImageAsBlob] Direct fetch failed, trying urlToBlob fallback:', err);
  }

  // 2. フォールバックとして urlToBlob（Image + Canvas または直接 Blob化）
  return await urlToBlob(imageUrl);
}

/**
 * ユーザーの「願い事」と「希望する毛色」、および診断結果のMBTIアーキタイプをもとに、
 * バックエンドのGeminiテキストAPI（POST /api/v1/gem_text）で深層分析し、
 * モッフィー公式生成API（create_moffy）に投入可能な CreateMoffyParams を構造化生成します。
 * 
 * フェイルセーフ（Fail-Safe）:
 * APIキーに AI生成権限がない場合（403）や通信エラー、JSONパースエラーが発生した場合でも、
 * 診断されたMBTIアーキタイプのデフォルト定義（ARCHETYPE_DEFAULTS）と
 * ユーザーが入力した毛色を安全に合成して即座にフォールバック返却します。
 */
export async function analyzeMoffyWishWithGemini(params: {
  wish: string;
  color: string;
  archetype: Archetype;
}): Promise<CreateMoffyParams> {
  const { wish, color, archetype } = params;
  const mbtiCode = archetype.mbtiCode;
  const defaults = ARCHETYPE_DEFAULTS[mbtiCode] || ARCHETYPE_DEFAULTS.INTJ;

  const fallbackParams: CreateMoffyParams = {
    color: color.trim() || defaults.color,
    expression: defaults.expression,
    hair_features: defaults.hair_features,
    body_shape: defaults.body_shape,
    body_features: defaults.body_features,
    mouth_features: defaults.mouth_features,
    accessories: 'なし',
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[analyzeMoffyWishWithGemini] No API key, using archetype fallback.');
    return fallbackParams;
  }

  const prompt = `あなたは「Google AI 学生アンバサダー」の公式マスコットキャラクター「モッフィー（Moffy）」の専属デザイナーAIです。
ユーザーが性格診断で導き出されたMBTI性格タイプ「${mbtiCode} (${archetype.title})」、希望する毛色、そしてモッフィーへの「願い事」を入力しました。
ユーザーの願い事の本質と感情を受け止め、モッフィー公式生成APIに入力可能なキャラクターデザインパラメータをJSON形式で構築してください。

【ユーザー入力情報】
- 性格タイプ (MBTI): ${mbtiCode} (${archetype.title} - ${archetype.description})
- 希望する毛色: ${color.trim() || defaults.color}
- モッフィーへの願い事: ${wish.trim() || 'いつも隣でそっと寄り添って応援してほしい'}

【モッフィー公式基本ルール（絶対遵守）】
1. NO NOSE（絶対に鼻を描かない）
2. 瞳の中央に白い四芒星（★）のハイライトが入ったキラキラした大きな瞳
3. 丸っこいぽってりとした2頭身のぬいぐるみシルエット
4. 背中には小さな妖精の白い羽、小さな手足

【出力形式】
以下のキーを持つ単一の有効なJSONオブジェクトのみを出力してください。Markdownのコードブロック（\`\`\`json など）で囲んで構いません。
- color: 希望する毛色をベースにした、美しい色彩表現（例: "パステルピンク（柔らかな桜色のふわふわな毛色）"）
- expression: 願い事やMBTIに寄り添った、愛らしい表情（例: "願い事を叶えようと瞳をキラキラ輝かせた、優しく温かな満面の笑顔"）
- hair_features: 願い事に合わせた毛並み・質感（例: "わたあめのように極めて柔らかく、光をまとったふわふわな毛並み"）
- body_shape: "丸っこい2頭身でぽってりした形"
- body_features: "小さな手足、背中に小さな白い羽"
- mouth_features: 表情に合わせた愛らしい口元（例: "小さく開いたかわいい口、ちょこんと出た小さな八重歯"）
- accessories: "なし"`;

  try {
    const baseUrl = getApiBaseUrl();
    const formData = new FormData();
    formData.append('prompt', prompt);

    const res = await fetch(`${baseUrl}/api/v1/gem_text`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
      },
      body: formData,
    });

    if (!res.ok) {
      console.warn(`[analyzeMoffyWishWithGemini] API returned ${res.status}, falling back to defaults.`);
      return fallbackParams;
    }

    const data = await res.json();
    const text: string = data.text || '';
    if (!text) {
      return fallbackParams;
    }

    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonStr = objMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    return {
      color: parsed.color || fallbackParams.color,
      expression: parsed.expression || fallbackParams.expression,
      hair_features: parsed.hair_features || fallbackParams.hair_features,
      body_shape: parsed.body_shape || fallbackParams.body_shape,
      body_features: parsed.body_features || fallbackParams.body_features,
      mouth_features: parsed.mouth_features || fallbackParams.mouth_features,
      accessories: parsed.accessories || 'なし',
    };
  } catch (err) {
    console.warn('[analyzeMoffyWishWithGemini] Analysis failed or parse error, fallback to defaults:', err);
    return fallbackParams;
  }
}

export interface GenerateTalkTopicParams {
  myMbti?: string | null;
  myName?: string | null;
  myUniversity?: string | null;
  myHobbies?: string | null;
  mySkills?: string | null;
  friendMbti?: string | null;
  friendName?: string | null;
  friendUniversity?: string | null;
  friendHobbies?: string | null;
  friendSkills?: string | null;
}

/**
 * 2人のアンバサダーの性格情報（MBTI、名前、所属、趣味、特技等）から、
 * バックエンドのGeminiテキストAPI（POST /api/v1/gem_text）を用いて
 * 初対面でも盛り上がる相性のいいトークテーマを一言（30〜60文字程度）で推定・生成します。
 * 
 * フェイルセーフ（Fail-Safe）:
 * APIキー未設定時、403/500エラー時、タイムアウト時、ネットワーク切断時は
 * 趣味・特技やMBTIの特性に応じた決定論的フォールバックテーマを即座に返却します。
 */
export async function generateTalkTopicWithGemini(
  params: GenerateTalkTopicParams
): Promise<string> {
  const friendMbti = (params.friendMbti || 'INTJ').toUpperCase();
  const myMbti = params.myMbti ? params.myMbti.toUpperCase() : null;

  // 決定論的・バリエーション豊かで自然なフォールバック（Fail-Safe）
  const getFallbackTopic = (): string => {
    // 趣味や特技が判明している場合は、それを活かしたフォールバックを優先
    if (params.friendHobbies && params.myHobbies && params.friendHobbies === params.myHobbies) {
      return `お互いに共通する趣味「${params.friendHobbies}」について普段の楽しみ方を聞いてみよう`;
    }
    if (params.friendHobbies) {
      return `相手の趣味「${params.friendHobbies}」について、始めたきっかけや魅力を聞いてみよう`;
    }
    if (params.friendSkills) {
      return `相手の特技「${params.friendSkills}」について、普段どんな活動で活かしているか聞いてみよう`;
    }

    const pick = (list: string[]): string => {
      const seed = (params.friendName || '') + (params.myName || '') + friendMbti;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
      }
      const idx = Math.abs(hash) % list.length;
      return list[idx];
    };

    if (/^(INTJ|INTP|ENTJ|ENTP)$/i.test(friendMbti)) {
      return pick([
        '最近注目している最新のAIツールや、これから作ってみたいプロジェクトについて聞いてみよう',
        '普段の開発や学習で使っている技術スタックや、自動化の工夫について話してみよう',
        '今後AIを使って解決してみたい課題や、探究しているテーマについて聞いてみよう',
      ]);
    }
    if (/^(INFJ|INFP|ENFJ|ENFP)$/i.test(friendMbti)) {
      return pick([
        '学生アンバサダーとしてやってみたい活動や、普段大切にしている価値観について話してみよう',
        'コミュニティ活動やチームで人と関わる時に、意識していることについて聞いてみよう',
        '周りの人を笑顔にするために、普段から心がけている工夫について話してみては？',
      ]);
    }
    if (/^(ISTJ|ISFJ|ESTJ|ESFJ)$/i.test(friendMbti)) {
      return pick([
        '大学での研究や学業の両立の工夫、日々のスケジュールの組み立て方について聞いてみよう',
        'イベントやプロジェクトを円滑に進めるための、丁寧な準備や段取りについて話してみよう',
        '日頃のルーティンや、習慣化して役に立っていることについて聞いてみよう',
      ]);
    }
    if (/^(ISTP|ISFP|ESTP|ESFP)$/i.test(friendMbti)) {
      return pick([
        '最近一番ハマっている趣味や、今回のイベントで楽しみにしている体験について聞いてみよう',
        '実際に手を動かしてものづくりをした時の、一番楽しかったエピソードについて話してみよう',
        'フットワーク軽く新しく挑戦してみたいことや、最近の面白い発見について聞いてみよう',
      ]);
    }
    return pick([
      'お互いの大学で流行っていることや、普段の活動で関心のあるテーマについて聞いてみよう',
      '学生アンバサダーの活動で、これから一緒に取り組んでみたいことについて話してみよう',
      '普段どんな分野のAI活用や勉強に興味があるか、気軽にお互い共有してみよう',
    ]);
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    return getFallbackTopic();
  }

  const myInfo = [
    myMbti ? `性格タイプ: ${myMbti}` : '',
    params.myName ? `名前: ${params.myName}` : '',
    params.myUniversity && params.myUniversity !== '未設定' ? `所属: ${params.myUniversity}` : '',
    params.myHobbies ? `趣味: ${params.myHobbies}` : '',
    params.mySkills ? `特技: ${params.mySkills}` : '',
  ].filter(Boolean).join('、') || '一般参加者';

  const friendInfo = [
    friendMbti ? `性格タイプ: ${friendMbti}` : '',
    params.friendName ? `名前: ${params.friendName}` : '',
    params.friendUniversity && params.friendUniversity !== '未設定' ? `所属: ${params.friendUniversity}` : '',
    params.friendHobbies ? `趣味: ${params.friendHobbies}` : '',
    params.friendSkills ? `特技: ${params.friendSkills}` : '',
  ].filter(Boolean).join('、');

  const prompt = `あなたは「Google AI 学生アンバサダー」の公式交流ファシリテーターAIです。
二人のアンバサダーがフレンド交換（名刺交換）を行いました。
お互いの性格タイプや情報（趣味・特技・所属大学等）をもとに、二人が初対面で自然に打ち解けられる「相性のいいトークテーマ」を一言で提案してください。

【参加者情報】
- ユーザーA（自分）: ${myInfo}
- ユーザーB（相手）: ${friendInfo}

【ルール】
1. トークテーマは「〜について聞いてみよう」「〜について話してみては？」のような、初対面でも会話が弾む具体的で前向きな一言（30文字〜60文字程度）にしてください。
2. お互いの趣味や特技が入力されている場合は、その共通点や興味深いポイントを会話のフックとして積極的に取り入れた魅力的な話題にしてください。
3. 絵文字や記号（★、✨、！の連続など）、前置き（「トークテーマは〜」など）、引用符（「」や""）は一切出力せず、トークテーマの本文テキストのみを1行で出力してください。
4. 相手の性格タイプ（MBTI）の特性や強みを活かした、親しみやすい話題にしてください。`;

  try {
    const baseUrl = getApiBaseUrl();
    const formData = new FormData();
    formData.append('prompt', prompt);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // コールドスタート対応で10秒保護

    const res = await fetch(`${baseUrl}/api/v1/gem_text`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[generateTalkTopicWithGemini] API returned status ${res.status}, using fallback.`);
      return getFallbackTopic();
    }

    const data = await res.json();
    let text: string = data.text || '';
    if (!text.trim()) {
      return getFallbackTopic();
    }

    text = text.trim()
      .replace(/^["'「『]+|["'」』]+$/g, '')
      .replace(/^(トークテーマ[：:!！\s]*)/i, '')
      .replace(/[*#_~`]/g, '')
      .trim();

    return text || getFallbackTopic();
  } catch (err) {
    console.warn('[generateTalkTopicWithGemini] Failed to generate talk topic, using fallback:', err);
    return getFallbackTopic();
  }
}

// ======================================================================
// ゲーム進捗 (Game Progress) & クラウドDB永続化 API
// ======================================================================

const GAME_STORAGE_PREFIX = 'moffy_game_progress_';

/**
 * アカウントごとのゲーム進捗（スキーマレスJSON）を保存します。
 * クラウドAPIとローカルストレージのハイブリッド永続化を行います。
 */
export async function saveGameProgress(
  gameId: string,
  discordUserId: string,
  data: any
): Promise<boolean> {
  if (!gameId || !discordUserId) return false;

  // 1. ローカルストレージへ即時同期（オフライン・フェイルセーフ対応）
  try {
    const localKey = `${GAME_STORAGE_PREFIX}${gameId}_${discordUserId}`;
    localStorage.setItem(localKey, JSON.stringify(data));
  } catch (e) {
    console.warn('[saveGameProgress] LocalStorage save failed:', e);
  }

  // 2. クラウドDB (API) へ送信
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[saveGameProgress] API key is missing. Kept in local storage only.');
    return true;
  }

  try {
    const formData = new FormData();
    formData.append('discord_user_id', discordUserId);
    formData.append('progress_data', JSON.stringify(data));

    const res = await fetch(`${baseUrl}/api/v1/games/${encodeURIComponent(gameId)}/progress`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[saveGameProgress] Server responded ${res.status}:`, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[saveGameProgress] Network error, progress preserved locally:', err);
    return true;
  }
}

/**
 * アカウントごとのゲーム進捗を取得します。
 * クラウドDBから取得を試み、失敗時はローカルキャッシュを返します。
 */
export async function getGameProgress<T = any>(
  gameId: string,
  discordUserId: string
): Promise<T | null> {
  if (!gameId || !discordUserId) return null;

  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  if (apiKey) {
    try {
      const res = await fetch(
        `${baseUrl}/api/v1/games/${encodeURIComponent(gameId)}/progress?discord_user_id=${encodeURIComponent(discordUserId)}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );

      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          // ローカルキャッシュも同期更新
          try {
            const localKey = `${GAME_STORAGE_PREFIX}${gameId}_${discordUserId}`;
            localStorage.setItem(localKey, JSON.stringify(json.data));
          } catch {
            // ignore
          }
          return json.data as T;
        }
      }
    } catch (err) {
      console.warn('[getGameProgress] Network error, trying local storage:', err);
    }
  }

  // フォールバック: ローカルストレージから復元
  try {
    const localKey = `${GAME_STORAGE_PREFIX}${gameId}_${discordUserId}`;
    const cached = localStorage.getItem(localKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (e) {
    console.warn('[getGameProgress] Failed to read from local storage:', e);
  }

  return null;
}

// ======================================================================
// 性格診断 途中保存・再開ロジック
// ======================================================================

const PERSONALITY_QUIZ_GAME_ID = 'personality_quiz';

export async function savePersonalityQuizProgress(
  discordUserId: string,
  answers: Record<number, number>,
  revealedCount: number
): Promise<boolean> {
  const payload: PersonalityQuizProgressData = {
    answers,
    revealedCount,
    currentStep: 'quiz',
    updatedAt: new Date().toISOString(),
  };
  return saveGameProgress(PERSONALITY_QUIZ_GAME_ID, discordUserId, payload);
}

export async function getPersonalityQuizProgress(
  discordUserId: string
): Promise<PersonalityQuizProgressData | null> {
  return getGameProgress<PersonalityQuizProgressData>(PERSONALITY_QUIZ_GAME_ID, discordUserId);
}

export async function clearPersonalityQuizProgress(discordUserId: string): Promise<void> {
  try {
    const localKey = `${GAME_STORAGE_PREFIX}${PERSONALITY_QUIZ_GAME_ID}_${discordUserId}`;
    localStorage.removeItem(localKey);
  } catch {
    // ignore
  }
}

// 🌟 性格診断の回答データおよびモッフィー特徴データの永続化
const MOFFY_QUIZ_DATA_GAME_ID = 'moffy_quiz_data';
const MOFFY_CUSTOM_FEATURES_GAME_ID = 'moffy_custom_features';

export async function saveMoffyQuizData(
  discordUserId: string,
  data: MoffyQuizData
): Promise<boolean> {
  return saveGameProgress(MOFFY_QUIZ_DATA_GAME_ID, discordUserId, data);
}

export async function getMoffyQuizData(
  discordUserId: string
): Promise<MoffyQuizData | null> {
  return getGameProgress<MoffyQuizData>(MOFFY_QUIZ_DATA_GAME_ID, discordUserId);
}

export async function saveMoffyCustomFeatures(
  discordUserId: string,
  data: MoffyCustomFeatures
): Promise<boolean> {
  return saveGameProgress(MOFFY_CUSTOM_FEATURES_GAME_ID, discordUserId, data);
}

export async function getMoffyCustomFeatures(
  discordUserId: string
): Promise<MoffyCustomFeatures | null> {
  return getGameProgress<MoffyCustomFeatures>(MOFFY_CUSTOM_FEATURES_GAME_ID, discordUserId);
}

// ======================================================================
// フレンド関係 (Moffy Friends) 永続化 & 検索ロジック
// ※【重要】フォロー数・フォロワー数はUIに一切表示してはなりません。
// ======================================================================

const MOFFY_FRIENDS_GAME_ID = 'moffy_friends';

export async function getFriendProgress(discordUserId: string): Promise<FriendProgressData> {
  const defaultData: FriendProgressData = {
    friends: [],
    following: [],
    followers: [],
    updatedAt: new Date().toISOString(),
  };

  const fetched = await getGameProgress<FriendProgressData>(MOFFY_FRIENDS_GAME_ID, discordUserId);
  if (!fetched || !Array.isArray(fetched.friends)) {
    return defaultData;
  }
  return {
    friends: fetched.friends || [],
    following: Array.isArray(fetched.following) ? fetched.following : [],
    followers: Array.isArray(fetched.followers) ? fetched.followers : [],
    updatedAt: fetched.updatedAt || new Date().toISOString(),
  };
}

export async function getFriendList(discordUserId: string): Promise<FriendItem[]> {
  const data = await getFriendProgress(discordUserId);
  return data.friends;
}

/**
 * フレンドを追加し、DBに永続化します。
 */
export async function addFriend(
  myDiscordUserId: string,
  friend: FriendItem
): Promise<boolean> {
  if (!myDiscordUserId || !friend || !friend.discord_user_id) return false;
  if (myDiscordUserId === friend.discord_user_id) return false; // 自分自身は追加しない

  const current = await getFriendProgress(myDiscordUserId);
  const existingIdx = current.friends.findIndex(
    (f) => f.discord_user_id === friend.discord_user_id
  );

  const updatedFriend: FriendItem = {
    ...friend,
    addedAt: friend.addedAt || new Date().toISOString(),
  };

  let newFriends: FriendItem[];
  if (existingIdx >= 0) {
    newFriends = [...current.friends];
    newFriends[existingIdx] = updatedFriend;
  } else {
    newFriends = [updatedFriend, ...current.friends];
  }

  const newFollowing = Array.from(
    new Set([...current.following, friend.discord_user_id])
  );

  const updatedData: FriendProgressData = {
    ...current,
    friends: newFriends,
    following: newFollowing,
    updatedAt: new Date().toISOString(),
  };

  return saveGameProgress(MOFFY_FRIENDS_GAME_ID, myDiscordUserId, updatedData);
}

/**
 * フォロー数を内部集計（※画面UIには表示禁止）
 */
export async function getFollowingCount(discordUserId: string): Promise<number> {
  const data = await getFriendProgress(discordUserId);
  return data.following.length;
}

/**
 * フォロワー数を内部集計（※画面UIには表示禁止）
 */
export async function getFollowersCount(discordUserId: string): Promise<number> {
  const data = await getFriendProgress(discordUserId);
  return data.followers.length;
}

// ======================================================================
// 公開プロフィール取得 API
// ======================================================================

export async function getPublicProfile(discordUserId: string): Promise<PartnerProfileResponse | null> {
  if (!discordUserId) return null;
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/getProfile?discord_user_id=${encodeURIComponent(discordUserId)}`,
      {
        headers: apiKey ? { 'X-API-Key': apiKey } : {},
      }
    );

    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    const profile = data as PartnerProfileResponse;
    // 🌟 プライバシー保護: ニックネームが設定されている場合、公開APIレベルで本名(name, last_name, first_name)を物理的にサニタイズ(null化)
    if (profile && profile.nickname && profile.nickname.trim()) {
      profile.name = null;
      if ('last_name' in profile) (profile as Record<string, unknown>).last_name = null;
      if ('first_name' in profile) (profile as Record<string, unknown>).first_name = null;
    }
    return profile;
  } catch (err) {
    console.warn('[getPublicProfile] Fetch failed:', err);
    return null;
  }
}

// ======================================================================
// 初回チュートリアル進捗 API (moffy_tutorial_state)
// ======================================================================

export const TUTORIAL_GAME_ID = 'moffy_tutorial_state';

/**
 * チュートリアルの進行・完了ステータスを取得します。
 * クラウドDBとローカルストレージの両方からフォールバック取得します。
 */
export async function getTutorialStatus(discordUserId: string): Promise<TutorialState | null> {
  if (!discordUserId) return null;
  return getGameProgress<TutorialState>(TUTORIAL_GAME_ID, discordUserId);
}

/**
 * チュートリアルの完了状態をデータベースおよびローカルストレージに永続化します。
 */
export async function saveTutorialCompleted(
  discordUserId: string,
  completed: boolean = true,
  lastStep?: number
): Promise<boolean> {
  if (!discordUserId) return false;
  const payload: TutorialState = {
    tutorialCompleted: completed,
    completedAt: completed ? new Date().toISOString() : undefined,
    lastStep,
  };
  return saveGameProgress(TUTORIAL_GAME_ID, discordUserId, payload);
}


