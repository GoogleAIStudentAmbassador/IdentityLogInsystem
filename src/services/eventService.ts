/**
 * Event & Check-in API Client Service
 * 
 * SOLID 原則（単一責任・依存性逆転）およびセキュアコーディングガードに準拠した
 * イベント管理 & ペルソナQRチェックインのドメインサービスです。
 */

import type {
  EventItem,
  CreateEventPayload,
  UpdateEventPayload,
  CheckinResponse,
  EventAttendeesResponse,
  ApplicationInfo,
  EventInvitation,
  CreateInvitationPayload,
  EventCollaboratorsResponse,
  LotterySelectionParams,
  SelectionExecutionResponse,
  UserEventHistoryResponse,
} from '../types';
import { getApiBaseUrl } from './api';

export interface IEventService {
  getEvents(activeOnly?: boolean, signal?: AbortSignal): Promise<EventItem[]>;
  getEvent(eventId: string, signal?: AbortSignal): Promise<EventItem>;
  createEvent(payload: CreateEventPayload): Promise<EventItem>;
  updateEvent(eventId: string, payload: UpdateEventPayload): Promise<EventItem>;
  deleteEvent(eventId: string): Promise<void>;
  getEventAttendees(eventId: string, signal?: AbortSignal): Promise<EventAttendeesResponse>;
  checkinAttendee(eventId: string, qrPayload: string, note?: string): Promise<CheckinResponse>;
  deleteCheckin(eventId: string, attendeeId: string): Promise<void>;
  getApplications(eventId: string, signal?: AbortSignal): Promise<ApplicationInfo[]>;
  applyToEvent(eventId: string, motivation?: string): Promise<ApplicationInfo>;
  cancelApplication(eventId: string): Promise<void>;
  getMyApplication(eventId: string, signal?: AbortSignal): Promise<ApplicationInfo | null>;
  getMyEventHistory(signal?: AbortSignal): Promise<UserEventHistoryResponse>;
  runLotterySelection(eventId: string, params?: LotterySelectionParams | number): Promise<SelectionExecutionResponse>;
  updateApplicationStatus(
    eventId: string,
    userId: string,
    status: 'applied' | 'selected' | 'waitlisted' | 'rejected' | 'cancelled' | string,
    note?: string
  ): Promise<ApplicationInfo>;
  createInvitation(eventId: string, payload?: CreateInvitationPayload): Promise<EventInvitation>;
  acceptInvitation(eventId: string, token: string): Promise<EventItem>;
  getCollaborators(eventId: string, signal?: AbortSignal): Promise<EventCollaboratorsResponse>;
  deleteInvitation(eventId: string, invitationId: string): Promise<void>;
  removeEditor(eventId: string, editorUserId: string): Promise<void>;
}

export class EventService implements IEventService {
  private baseUrl: string;
  private tokenProvider: () => string | null;

  constructor(tokenProvider?: () => string | null, customBaseUrl?: string) {
    this.baseUrl = customBaseUrl !== undefined ? customBaseUrl : getApiBaseUrl();
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

        const errorObj = new Error(safeMsg);
        (errorObj as { status?: number }).status = response.status;
        throw errorObj;
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
   * イベント情報を更新（主催者/共同編集者/管理者限定）
   */
  public async updateEvent(eventId: string, payload: UpdateEventPayload): Promise<EventItem> {
    validateEventId(eventId);
    return this.request<EventItem>(`/api/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
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
   * イベントへの参加事前申し込み（一般ユーザー可）
   */
  public async applyToEvent(eventId: string, motivation?: string): Promise<ApplicationInfo> {
    validateEventId(eventId);
    return this.request<ApplicationInfo>(`/api/events/${encodeURIComponent(eventId)}/apply`, {
      method: 'POST',
      body: JSON.stringify({ motivation: motivation || undefined }),
    });
  }

  /**
   * イベント参加申し込みのキャンセル（一般ユーザー可）
   */
  public async cancelApplication(eventId: string): Promise<void> {
    validateEventId(eventId);
    await this.request<void>(`/api/events/${encodeURIComponent(eventId)}/apply`, {
      method: 'DELETE',
    });
  }

  /**
   * 対象イベントに対する自身の申込状況を取得
   * 未申込時は null を返却
   */
  public async getMyApplication(eventId: string, signal?: AbortSignal): Promise<ApplicationInfo | null> {
    validateEventId(eventId);
    try {
      return await this.request<ApplicationInfo>(
        `/api/events/${encodeURIComponent(eventId)}/my-application`,
        { method: 'GET' },
        signal
      );
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : '';
      if (
        httpStatus === 404 ||
        msg.includes('404') ||
        msg.includes('見つかりません') ||
        msg.includes('not found') ||
        msg.includes('Not Found') ||
        msg.includes('申し込んでいません')
      ) {
        return null;
      }
      // ネットワークやその他エラー時は上位でハンドリング可能にするため再送出
      throw err;
    }
  }

  /**
   * 自身のイベント参加・申込履歴を取得
   */
  public async getMyEventHistory(signal?: AbortSignal): Promise<UserEventHistoryResponse> {
    return this.request<UserEventHistoryResponse>('/api/events/my-history', { method: 'GET' }, signal);
  }

  /**
   * イベントの出席者名簿一覧を取得（スタッフ/共同編集者/管理者限定）
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
   * ペルソナQRコードによる高速チェックインを実行（スタッフ/共同編集者/管理者限定）
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

  /**
   * 申込者一覧の取得（主催者/共同編集者限定）
   */
  public async getApplications(eventId: string, signal?: AbortSignal): Promise<ApplicationInfo[]> {
    validateEventId(eventId);
    const res = await this.request<ApplicationInfo[] | { applications: ApplicationInfo[] }>(
      `/api/events/${encodeURIComponent(eventId)}/applications`,
      { method: 'GET' },
      signal
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.applications)) return res.applications;
    return [];
  }

  /**
   * 自動抽選の実行（主催者/共同編集者限定）
   * OpenAPI スキーマ LotterySelectionRequest (capacity, ambassador_priority, waitlist_capacity, note) に準拠
   */
  public async runLotterySelection(
    eventId: string,
    params?: LotterySelectionParams | number
  ): Promise<SelectionExecutionResponse> {
    validateEventId(eventId);

    let bodyPayload: Record<string, unknown>;
    if (typeof params === 'number') {
      const cap = params > 0 ? params : 100;
      bodyPayload = { capacity: cap, target_count: cap };
    } else if (params && typeof params === 'object') {
      bodyPayload = {
        capacity: params.capacity > 0 ? params.capacity : 100,
        target_count: params.capacity > 0 ? params.capacity : 100,
        ambassador_priority: Boolean(params.ambassador_priority),
        waitlist_capacity: params.waitlist_capacity ?? 0,
        note: params.note || undefined,
      };
    } else {
      bodyPayload = { capacity: 100, target_count: 100 };
    }

    return this.request<SelectionExecutionResponse>(`/api/events/${encodeURIComponent(eventId)}/selection/lottery`, {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
    });
  }

  /**
   * 申込ステータスの手動更新（主催者/共同編集者限定）
   */
  public async updateApplicationStatus(
    eventId: string,
    userId: string,
    status: string,
    note?: string
  ): Promise<ApplicationInfo> {
    validateEventId(eventId);
    validateAttendeeId(userId);
    return this.request<ApplicationInfo>(
      `/api/events/${encodeURIComponent(eventId)}/applications/${encodeURIComponent(userId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, note: note || undefined }),
      }
    );
  }

  /**
   * 共同編集者・スタッフ招待リンクを発行（主催者/管理者限定）
   */
  public async createInvitation(eventId: string, payload?: CreateInvitationPayload): Promise<EventInvitation> {
    validateEventId(eventId);
    return this.request<EventInvitation>(`/api/events/${encodeURIComponent(eventId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({
        role: payload?.role || 'editor',
        expires_in_hours: payload?.expires_in_hours || 168,
        note: payload?.note || undefined,
        invitee_email: payload?.invitee_email || undefined,
      }),
    });
  }

  /**
   * 共同編集者招待を受諾して共同編集者になる
   */
  public async acceptInvitation(eventId: string, token: string): Promise<EventItem> {
    validateEventId(eventId);
    validateToken(token);
    return this.request<EventItem>(`/api/events/${encodeURIComponent(eventId)}/invitations/accept`, {
      method: 'POST',
      body: JSON.stringify({ token: token.trim() }),
    });
  }

  /**
   * 共同編集者一覧および有効な招待一覧を取得
   */
  public async getCollaborators(eventId: string, signal?: AbortSignal): Promise<EventCollaboratorsResponse> {
    validateEventId(eventId);
    return this.request<EventCollaboratorsResponse>(
      `/api/events/${encodeURIComponent(eventId)}/collaborators`,
      { method: 'GET' },
      signal
    );
  }

  /**
   * 発行中招待を取り消し（失効させる）
   */
  public async deleteInvitation(eventId: string, invitationId: string): Promise<void> {
    validateEventId(eventId);
    validateInvitationId(invitationId);
    await this.request<void>(
      `/api/events/${encodeURIComponent(eventId)}/invitations/${encodeURIComponent(invitationId)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * 共同編集者を除名（主催者/管理者限定）
   */
  public async removeEditor(eventId: string, editorUserId: string): Promise<void> {
    validateEventId(eventId);
    validateAttendeeId(editorUserId);
    await this.request<void>(
      `/api/events/${encodeURIComponent(eventId)}/editors/${encodeURIComponent(editorUserId)}`,
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

const SAFE_TOKEN_REGEX = /^[a-zA-Z0-9_-]{10,256}$/;

function validateToken(token: string): void {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('招待トークンが指定されていません。');
  }
  const trimmed = token.trim();
  if (!SAFE_TOKEN_REGEX.test(trimmed)) {
    throw new Error('招待トークンの形式が不正です（英数字、ハイフン、アンダースコア10〜256文字限定）。');
  }
}

function validateInvitationId(invitationId: string): void {
  if (!invitationId || typeof invitationId !== 'string' || !invitationId.trim()) {
    throw new Error('招待IDが指定されていません。');
  }
  const trimmed = invitationId.trim();
  if (!SAFE_ID_REGEX.test(trimmed)) {
    throw new Error('招待IDの形式が不正です（英数字、ハイフン、アンダースコア1〜128文字限定）。');
  }
}

export const eventService = new EventService();
