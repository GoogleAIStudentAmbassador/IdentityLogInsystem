import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Camera,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  QrCode,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Clock,
  User,
  AlertTriangle,
} from 'lucide-react';
import type { EventItem, AttendeeInfo, CheckinResponse } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { eventService } from '../../services/eventService';
import { audioFeedback } from '../../utils/audioFeedback';
import { EventScannerModal } from './EventScannerModal';
import { CreateEventModal } from './CreateEventModal';

interface EventsTabProps {
  user: AuthUser | null;
  isDarkMode: boolean;
  onOpenPersonaQr?: () => void;
}

export const EventsTab: React.FC<EventsTabProps> = ({
  user,
  isDarkMode,
  onOpenPersonaQr,
}) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');

  // モーダル制御 & 確認ダイアログ
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // 判定基準タイムスタンプ（純粋性維持）
  const nowTimestamp = useMemo(() => Date.now(), [events]);

  // スタッフ / 管理者 / アンバサダー判定 (BOLA防御 & UI制御)
  const isStaffOrAmbassador = Boolean(
    user?.is_staff || user?.is_ambassador || user?.isAmbassador
  );

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    setErrorMsg(null);
    try {
      const data = await eventService.getEvents(false);
      setEvents(data);
      setSelectedEvent((prev) => prev ?? (data[0] || null));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'イベント一覧の取得に失敗しました。';
      setErrorMsg(msg);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  const fetchAttendees = useCallback(async (eventId: string, signal?: AbortSignal) => {
    setIsLoadingAttendees(true);
    try {
      const data = await eventService.getEventAttendees(eventId, signal);
      setAttendees(data.attendees || []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // キャンセルされた古い通信は無視
      }
      console.warn('Failed to fetch attendees:', err);
      setAttendees([]);
    } finally {
      if (!signal?.aborted) {
        setIsLoadingAttendees(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // イベント選択変更時の名簿取得（AbortController による Stale Response 競合根絶）
  useEffect(() => {
    if (!selectedEvent) {
      setAttendees([]);
      return;
    }

    const controller = new AbortController();
    fetchAttendees(selectedEvent.event_id, controller.signal);

    return () => {
      controller.abort();
    };
  }, [selectedEvent, fetchAttendees]);

  const handleSelectEvent = (event: EventItem) => {
    setSelectedEvent(event);
  };

  const handleCheckinSuccess = (res: CheckinResponse) => {
    // 参加者リストを即時ローカル更新（N+1 / 再フェッチを回避して最適化）
    setAttendees((prev) => {
      const exists = prev.some((a) => a.attendee_id === res.attendee.attendee_id);
      if (exists) {
        return prev;
      }
      return [res.attendee, ...prev];
    });

    // 選択中イベントの出席者数カウントを即時更新
    if (selectedEvent) {
      setSelectedEvent((prev) => (prev ? { ...prev, total_attendees: res.total_attendees } : null));
    }
    setEvents((prev) =>
      prev.map((ev) =>
        ev.event_id === (selectedEvent?.event_id || '')
          ? { ...ev, total_attendees: res.total_attendees }
          : ev
      )
    );
  };

  const handleDeleteCheckin = (attendeeId: string, attendeeName: string) => {
    if (!selectedEvent) return;
    setConfirmDialog({
      title: 'チェックイン取消',
      message: `「${attendeeName}」様のチェックインを取り消しますか？`,
      onConfirm: async () => {
        try {
          await eventService.deleteCheckin(selectedEvent.event_id, attendeeId);
          setAttendees((prev) => prev.filter((a) => a.attendee_id !== attendeeId));
          setSelectedEvent((prev) =>
            prev ? { ...prev, total_attendees: Math.max(0, prev.total_attendees - 1) } : null
          );
          setEvents((prev) =>
            prev.map((ev) =>
              ev.event_id === selectedEvent.event_id
                ? { ...ev, total_attendees: Math.max(0, ev.total_attendees - 1) }
                : ev
            )
          );
        } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : '取り消しに失敗しました。');
        }
      },
    });
  };

  const handleDeleteEvent = (event: EventItem) => {
    setConfirmDialog({
      title: 'イベント削除',
      message: `イベント「${event.title}」を完全に削除しますか？\n（出席者名簿も削除されます）`,
      onConfirm: async () => {
        try {
          await eventService.deleteEvent(event.event_id);
          setEvents((prev) => prev.filter((e) => e.event_id !== event.event_id));
          if (selectedEvent?.event_id === event.event_id) {
            setSelectedEvent(null);
          }
        } catch (err: unknown) {
          setErrorMsg(err instanceof Error ? err.message : 'イベントの削除に失敗しました。');
        }
      },
    });
  };

  // 出席者検索フィルタ（O(N) インメモリ高速検索）
  const filteredAttendees = useMemo(() => {
    if (!attendeeSearchQuery.trim()) return attendees;
    const q = attendeeSearchQuery.toLowerCase().trim();
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.display_name && a.display_name.toLowerCase().includes(q)) ||
        (a.university && a.university.toLowerCase().includes(q)) ||
        a.attendee_id.toLowerCase().includes(q)
    );
  }, [attendees, attendeeSearchQuery]);

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-28 animate-fade-in">
      {/* ページタイトル & アクションヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Calendar className="w-3.5 h-3.5" /> イベント・チェックイン
            </span>
            {isStaffOrAmbassador && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3 h-3" /> STAFF MODE
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            アンバサダー イベント受付
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            ペルソナ名刺QRを用いた一括高速チェックインとリアルタイム出席管理
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPersonaQr && (
            <button
              onClick={onOpenPersonaQr}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
                  : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800 shadow-xs'
              }`}
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              自分のQRを表示
            </button>
          )}

          {isStaffOrAmbassador && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              イベント作成
            </button>
          )}

          <button
            onClick={fetchEvents}
            disabled={isLoadingEvents}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
                : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-700 shadow-xs'
            }`}
            title="再読み込み"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingEvents ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* メイングリッド: イベント一覧 & 選択中イベント詳細/出席簿 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左ペイン: イベント一覧 (4カラム) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              イベント一覧 ({events.length})
            </h2>
          </div>

          {isLoadingEvents ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-neutral-800/40 animate-pulse border border-neutral-800/60"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div
              className={`p-8 text-center rounded-2xl border ${
                isDarkMode
                  ? 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'
                  : 'bg-white border-neutral-200 text-neutral-500 shadow-xs'
              }`}
            >
              <Calendar className="w-10 h-10 mx-auto mb-2 text-neutral-500 opacity-50" />
              <p className="text-xs font-semibold">開催予定のイベントはありません</p>
              {isStaffOrAmbassador && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-3 text-xs text-emerald-400 font-bold hover:underline"
                >
                  最初のイベントを作成する →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {events.map((event) => {
                const isSelected = selectedEvent?.event_id === event.event_id;
                const dateObj = new Date(event.event_date);
                const isPast = dateObj.getTime() < nowTimestamp;

                return (
                  <div
                    key={event.event_id}
                    onClick={() => handleSelectEvent(event)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-neutral-800/90 border-emerald-500/60 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                          : 'bg-emerald-50/50 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                        : isDarkMode
                        ? 'bg-neutral-900/80 border-neutral-800/80 hover:bg-neutral-800/50 hover:border-neutral-700'
                        : 'bg-white border-neutral-200 hover:bg-neutral-50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isPast
                            ? 'bg-neutral-800 text-neutral-400'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isPast ? '終了' : '開催中・受付可'}
                      </span>

                      <span className="text-xs font-mono font-bold text-neutral-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {event.total_attendees}
                        {event.capacity ? ` / ${event.capacity}` : ' 名'}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base line-clamp-1 group-hover:text-emerald-400 transition-colors">
                      {event.title}
                    </h3>

                    <div className="mt-2 space-y-1 text-xs text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {dateObj.toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                          })}{' '}
                          {dateObj.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右ペイン: 選択中イベント詳細 & 出席者名簿ダッシュボード (8カラム) */}
        <div className="lg:col-span-8">
          {selectedEvent ? (
            <div
              className={`rounded-3xl border overflow-hidden transition-all ${
                isDarkMode
                  ? 'bg-neutral-900/90 border-neutral-800/80 text-white'
                  : 'bg-white border-neutral-200 text-neutral-900 shadow-md'
              }`}
            >
              {/* イベント概要バナー */}
              <div className="p-5 sm:p-6 border-b border-neutral-800/50 bg-gradient-to-br from-neutral-800/30 to-transparent">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        イベント詳細
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        ID: {selectedEvent.event_id}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black">{selectedEvent.title}</h2>
                    {selectedEvent.description && (
                      <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {selectedEvent.description}
                      </p>
                    )}
                  </div>

                  {/* 受付スキャナー起動ボタン */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isStaffOrAmbassador ? (
                      <button
                        onClick={() => {
                          audioFeedback.unlock();
                          setIsScannerOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-5 h-5" />
                        受付カメラを起動
                      </button>
                    ) : (
                      onOpenPersonaQr && (
                        <button
                          onClick={onOpenPersonaQr}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                          名刺QRを提示して受付
                        </button>
                      )
                    )}

                    {isStaffOrAmbassador && (
                      <button
                        onClick={() => handleDeleteEvent(selectedEvent)}
                        className="p-3 rounded-2xl border border-neutral-700 text-neutral-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors cursor-pointer"
                        title="イベントを削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* メタ情報カード */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-neutral-800/40 text-xs">
                  <div>
                    <span className="text-neutral-500 block mb-0.5">開催日時</span>
                    <span className="font-semibold text-neutral-200">
                      {new Date(selectedEvent.event_date).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block mb-0.5">会場</span>
                    <span className="font-semibold text-neutral-200 truncate block">
                      {selectedEvent.location}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block mb-0.5">チェックイン状況</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {selectedEvent.total_attendees}
                      {selectedEvent.capacity ? ` / ${selectedEvent.capacity}` : ' 名出席'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 出席者名簿セクション */}
              <div className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      出席者名簿
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-neutral-800 text-neutral-300">
                      {attendees.length} 名
                    </span>
                  </div>

                  {/* 名簿内検索 & 同期リフレッシュ */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-60">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                      <input
                        type="text"
                        value={attendeeSearchQuery}
                        onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                        placeholder="参加者名・大学名で絞り込み..."
                        className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-hidden focus:border-emerald-500 transition-colors ${
                          isDarkMode
                            ? 'bg-neutral-800 border-neutral-700 text-white'
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                    </div>
                    <button
                      onClick={() => selectedEvent && fetchAttendees(selectedEvent.event_id)}
                      disabled={isLoadingAttendees}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        isDarkMode
                          ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-400 hover:text-white'
                          : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-600 shadow-xs'
                      }`}
                      title="名簿を再取得（他端末のチェックイン同期）"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAttendees ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {isLoadingAttendees ? (
                  <div className="py-12 text-center">
                    <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-neutral-400">出席者名簿を読み込み中...</p>
                  </div>
                ) : filteredAttendees.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400 border border-dashed border-neutral-800 rounded-2xl">
                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-500 opacity-50" />
                    <p className="text-xs font-medium">まだチェックイン済みの参加者はいません</p>
                    {isStaffOrAmbassador && (
                      <p className="text-[11px] text-neutral-500 mt-1">
                        「受付カメラを起動」ボタンから参加者のペルソナ名刺QRをスキャンしてください。
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800/40 border border-neutral-800/50 rounded-2xl overflow-hidden">
                    {filteredAttendees.map((att) => (
                      <div
                        key={att.attendee_id}
                        className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                          isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-700 shrink-0 border border-neutral-600">
                            {att.photo_url ? (
                              <img
                                src={att.photo_url}
                                alt={att.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                            {att.is_ambassador && (
                              <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-neutral-900 rounded-full">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-xs sm:text-sm truncate">{att.name}</h4>
                              {att.display_name && att.display_name !== att.name && (
                                <span className="text-[11px] text-neutral-400 truncate">
                                  ({att.display_name})
                                </span>
                              )}
                              {att.is_ambassador && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                  AMBASSADOR
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate">
                              {att.university || '所属未設定'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[11px] font-mono font-semibold text-emerald-400 block">
                              {new Date(att.checked_in_at).toLocaleTimeString('ja-JP')}
                            </span>
                            <span className="text-[10px] text-neutral-500 block">
                              受付: {att.checked_in_by}
                            </span>
                          </div>

                          {isStaffOrAmbassador && (
                            <button
                              onClick={() => handleDeleteCheckin(att.attendee_id, att.name)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="チェックインを取り消す"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`p-12 text-center rounded-3xl border ${
                isDarkMode
                  ? 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'
                  : 'bg-white border-neutral-200 text-neutral-500 shadow-sm'
              }`}
            >
              <Calendar className="w-12 h-12 mx-auto mb-3 text-neutral-500 opacity-40" />
              <h3 className="font-bold text-sm">イベントを選択してください</h3>
              <p className="text-xs text-neutral-500 mt-1">
                左側の一覧からイベントを選択すると、詳細と出席者名簿が表示されます。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* モーダル */}
      {selectedEvent && (
        <EventScannerModal
          event={selectedEvent}
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onCheckinSuccess={handleCheckinSuccess}
          isDarkMode={isDarkMode}
        />
      )}

      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newEvent) => {
          setEvents((prev) => [newEvent, ...prev]);
          setSelectedEvent(newEvent);
        }}
        isDarkMode={isDarkMode}
      />

      {/* カスタム非同期確認ダイアログ (window.confirm による UI/カメラブロッキングを排除) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border animate-scale-in ${
              isDarkMode
                ? 'bg-neutral-900 border-neutral-800 text-white'
                : 'bg-white border-neutral-200 text-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 text-rose-500 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{confirmDialog.title}</span>
            </div>
            <p className="text-xs text-neutral-400 whitespace-pre-wrap mb-5 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                    : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all cursor-pointer"
              >
                実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
