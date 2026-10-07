/**
 * Event & Check-in API Client Service
 * 
 * SOLID 原則（単一責任・依存性逆転）およびセキュアコーディングガードに準拠した
 * イベント管理 & ペルソナQRチェックインのドメインサービスです。
 */

import type {
  EventItem,
  CreateEventPayload,
  CheckinResponse,
  EventAttendeesResponse,
} from '../types';

export interface IEventService {
  getEvents(activeOnly?: boolean): Promise<EventItem[]>;
  getEvent(eventId: string): Promise<EventItem>;
  createEvent(payload: CreateEventPayload): Promise<EventItem>;
  deleteEvent(eventId: string): Promise<void>;
  getEventAttendees(eventId: string, signal?: AbortSignal): Promise<EventAttendeesResponse>;
  checkinAttendee(eventId: string, qrPayload: string, note?: string): Promise<CheckinResponse>;
  deleteCheckin(eventId: string, attendeeId: string): Promise<void>;
}

export class EventService implements IEventService {
  private baseUrl: string;
  private tokenProvider: () => string | null;

  constructor(tokenProvider?: () => string | null, customBaseUrl?: string) {
    this.baseUrl = customBaseUrl || (import.meta.env.VITE_MOFFY_API_BASE_URL || '');
    this.tokenProvider =
      tokenProvider ||
      (() => {
        try {
          return (
            localStorage.getItem('moffy_user_jwt_token') ||
            localStorage.getItem('moffy_user_token') ||
            null
          );
        } catch {
          return null;
        }
      });
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.tokenProvider();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * タイムアウト・エラーマスキング・非同期安全管理を統括する内部通信メソッド
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    customSignal?: AbortSignal,
    timeoutMs: number = 8000
  ): Promise<T> {
    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, timeoutMs);

    // 外部から signal が渡された場合、それと連動して abort
    const onCustomSignalAbort = () => {
      controller.abort();
    };

    if (customSignal) {
      if (customSignal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Aborted', 'AbortError');
      }
      customSignal.addEventListener('abort', onCustomSignalAbort);
    }

    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error('サーバー内部で一時的なエラーが発生しました。時間をおいて再度お試しください。');
        }

        let safeMsg = 'サーバーとの通信でエラーが発生しました。';
        try {
          const errBody = await response.json();
          if (errBody && typeof errBody.detail === 'string') {
            const detail = errBody.detail.trim();
            // 内部SQLやスタックトレース、GCP/Firestore内部構文の露出を遮断
            if (
              !detail.includes('Traceback') &&
              !detail.includes('File "') &&
              !detail.includes('SELECT ') &&
              !detail.includes('projects/') &&
              !detail.includes('PERMISSION_DENIED') &&
              detail.length <= 120
            ) {
              safeMsg = detail;
            }
          }
        } catch {
          // jsonパース失敗時はデフォルト安全メッセージ
        }

        if (response.status === 401) {
          safeMsg = '認証の有効期限が切れたか、ログインしていません。再ログインしてください。';
        } else if (response.status === 403) {
          if (safeMsg === 'サーバーとの通信でエラーが発生しました。') {
            safeMsg = 'この操作を実行する権限がありません（主催者または管理者限定）。';
          }
        } else if (response.status === 404) {
          if (safeMsg === 'サーバーとの通信でエラーが発生しました。') {
            safeMsg = '指定されたイベントまたは参加者が見つかりません。';
          }
        }

        throw new Error(safeMsg);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name;
      if ((err instanceof DOMException && err.name === 'AbortError') || errName === 'AbortError') {
        if (isTimeout) {
          throw new Error('通信がタイムアウトしました。電波の良い場所で再度お試しください。');
        }
        if (customSignal?.aborted) {
          throw err;
        }
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (customSignal) {
        customSignal.removeEventListener('abort', onCustomSignalAbort);
      }
    }
  }

  /**
   * イベント一覧を取得（公開）
   */
  public async getEvents(activeOnly: boolean = true, signal?: AbortSignal): Promise<EventItem[]> {
    return this.request<EventItem[]>(`/api/events?active_only=${activeOnly}`, { method: 'GET' }, signal);
  }

  /**
   * イベント詳細を取得（公開）
   */
  public async getEvent(eventId: string, signal?: AbortSignal): Promise<EventItem> {
    validateEventId(eventId);
    return this.request<EventItem>(`/api/events/${encodeURIComponent(eventId)}`, { method: 'GET' }, signal);
  }

  /**
   * 新規イベントを作成（スタッフ/アンバサダー/管理者限定）
   */
  public async createEvent(payload: CreateEventPayload): Promise<EventItem> {
    return this.request<EventItem>('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * イベントを削除（主催者/管理者限定）
   */
  public async deleteEvent(eventId: string): Promise<void> {
    validateEventId(eventId);
    await this.request<void>(`/api/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * イベントの出席者名簿一覧を取得（スタッフ/管理者限定）
   */
  public async getEventAttendees(eventId: string, signal?: AbortSignal): Promise<EventAttendeesResponse> {
    validateEventId(eventId);
    return this.request<EventAttendeesResponse>(
      `/api/events/${encodeURIComponent(eventId)}/attendees`,
      { method: 'GET' },
      signal
    );
  }

  /**
   * ペルソナQRコードによる高速チェックインを実行（スタッフ/管理者限定）
   * 二重スキャン時は already_checked_in: true と既存時刻が返却されます。
   */
  public async checkinAttendee(
    eventId: string,
    attendeeIdOrPayload: string,
    note?: string
  ): Promise<CheckinResponse> {
    validateEventId(eventId);
    if (!attendeeIdOrPayload) throw new Error('参加者データが空です。');

    return this.request<CheckinResponse>(`/api/events/${encodeURIComponent(eventId)}/checkin`, {
      method: 'POST',
      body: JSON.stringify({
        qr_payload: attendeeIdOrPayload,
        note: note || undefined,
      }),
    });
  }

  /**
   * チェックイン取り消し（誤スキャン解除・スタッフ限定）
   */
  public async deleteCheckin(eventId: string, attendeeId: string): Promise<void> {
    validateEventId(eventId);
    validateAttendeeId(attendeeId);
    await this.request<void>(
      `/api/events/${encodeURIComponent(eventId)}/checkin/${encodeURIComponent(attendeeId)}`,
      { method: 'DELETE' }
    );
  }
}

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function validateEventId(eventId: string): void {
  if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
    throw new Error('イベントIDが指定されていません。');
  }
  const trimmed = eventId.trim();
  if (!SAFE_ID_REGEX.test(trimmed)) {
    throw new Error('イベントIDの形式が不正です（英数字、ハイフン、アンダースコア1〜128文字限定）。');
  }
}

function validateAttendeeId(attendeeId: string): void {
  if (!attendeeId || typeof attendeeId !== 'string' || !attendeeId.trim()) {
    throw new Error('参加者IDが指定されていません。');
  }
  const trimmed = attendeeId.trim();
  if (!SAFE_ID_REGEX.test(trimmed)) {
    throw new Error('参加者IDの形式が不正です（英数字、ハイフン、アンダースコア1〜128文字限定）。');
  }
}

export const eventService = new EventService();
