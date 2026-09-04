import type { RegistrationResult } from '../types';

const DEFAULT_BASE_URL = 'https://moffy-profile-287701603412.asia-northeast1.run.app';

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_MOFFY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
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
