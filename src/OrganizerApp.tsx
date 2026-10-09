import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Calendar,
  MapPin,
  Camera,
  Plus,
  Search,
  Trash2,
  ArrowLeft,
  Sun,
  Moon,
  Loader2,
  Shuffle,
  ShieldAlert,
  Edit3,
  UserPlus,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { EventItem, AttendeeInfo, ApplicationInfo } from './types';
import type { AuthUser } from './utils/oauthClient';
import { MoffyAuthClient } from './utils/oauthClient';
import { eventService } from './services/eventService';
import { fetchMyProfile } from './services/api';
import { EventScannerModal } from './components/home/EventScannerModal';
import { CreateEventModal } from './components/home/CreateEventModal';
import { EditEventModal } from './components/home/EditEventModal';
import { CollaboratorModal } from './components/home/CollaboratorModal';

const THEME_STORAGE_KEY = 'moffy_theme_mode';

export const OrganizerApp: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light') return false;
    } catch {}
    return true;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  };

  const authClient = useMemo(() => new MoffyAuthClient({ clientId: 'moffy-organizer-app' }), []);
  const [user, setUser] = useState<AuthUser | null>(() => authClient.getUser());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // イベント・名簿・申込者ステート
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 出席者名簿
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState('');

  // 申込者・選考
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [isLotterySubmitting, setIsLotterySubmitting] = useState(false);
  const isLotterySubmittingRef = useRef(false);
  const [lotteryMessage, setLotteryMessage] = useState<string | null>(null);

  // 抽選詳細オプション
  const [showLotteryOptions, setShowLotteryOptions] = useState(false);
  const [lotteryAmbassadorPriority, setLotteryAmbassadorPriority] = useState(true);
  const [lotteryWaitlistCapacity, setLotteryWaitlistCapacity] = useState<number>(0);
  const [lotteryNote, setLotteryNote] = useState('');
  const [updatingStatusUserId, setUpdatingStatusUserId] = useState<string | null>(null);

  // モーダル
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [activeViewMode, setActiveViewMode] = useState<'attendees' | 'applications'>('attendees');

  // 主催者権限の厳格判定（作成者・管理者・事務局に加え、いずれかのイベントの共同編集者も包含）
  const isAdmin = Boolean(user?.role === 'admin' || user?.is_admin);
  const isBureau = Boolean(user?.role === 'bureau');
  const canCreateEvents = Boolean(user?.is_event_organizer || isAdmin || isBureau);
  const isOrganizer = Boolean(
    canCreateEvents ||
    events.some((e) => e.editors?.includes(user?.discord_user_id || ''))
  );

  // 選択中イベントに対するオーナー権限判定
  const isSelectedEventOwner = Boolean(
    selectedEvent &&
    (selectedEvent.organizer_id === user?.discord_user_id || isAdmin)
  );

  // 選択中イベントに対する共同編集権限判定
  const isSelectedEventEditor = Boolean(
    selectedEvent &&
    selectedEvent.editors?.includes(user?.discord_user_id || '')
  );

  const canManageSelectedEvent = isSelectedEventOwner || isBureau || isSelectedEventEditor;

  // 認証 & 権限確認
  useEffect(() => {
    if (!authClient.isAuthenticated()) {
      window.location.href = './oauth.html';
      return;
    }

    let isMounted = true;
    fetchMyProfile()
      .then((profile) => {
        if (!isMounted) return;
        if (profile) {
          setUser((prev) => ({
            ...(prev || { discord_user_id: profile.discord_user_id }),
            name: profile.name,
            nickname: profile.nickname,
            role: profile.role,
            is_event_organizer: profile.is_event_organizer,
            is_staff: profile.is_staff,
            is_admin: profile.role === 'admin' || profile.role === 'bureau',
          }));
        }
      })
      .finally(() => {
        if (isMounted) setIsCheckingAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authClient]);

  const eventsAbortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  // イベント一覧取得
  const fetchEvents = useCallback(async () => {
    if (eventsAbortRef.current) {
      eventsAbortRef.current.abort();
    }
    const controller = new AbortController();
    eventsAbortRef.current = controller;

    setIsLoadingEvents(true);
    setErrorMsg(null);
    try {
      const data = await eventService.getEvents(false, controller.signal);
      if (!controller.signal.aborted) {
        setEvents(data);
        setSelectedEvent((prev) => {
          // 既存の選択ステート prev を最優先（URLパラメータによる強制引戻し・スナップバックを物理遮断）
          if (prev && data.some((e) => e.event_id === prev.event_id)) {
            return data.find((e) => e.event_id === prev.event_id) || data[0] || null;
          }
          const urlParamEventId = new URLSearchParams(window.location.search).get('event_id');
          if (urlParamEventId && data.some((e) => e.event_id === urlParamEventId)) {
            return data.find((e) => e.event_id === urlParamEventId) || data[0] || null;
          }
          return data[0] || null;
        });
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setErrorMsg(err instanceof Error ? err.message : 'イベント一覧の取得に失敗しました。');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingEvents(false);
      }
    }
  }, []);

  const handleSelectEvent = useCallback((evt: EventItem) => {
    setSelectedEvent(evt);
    if (typeof window !== 'undefined' && window.history.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('event_id', evt.event_id);
        window.history.replaceState({}, document.title, url.toString());
      } catch {
        // sandbox safe
      }
    }
  }, []);

  useEffect(() => {
    // 🌟 [COLLABORATOR DEADLOCK BREAK]: 認証確認完了後、即座にイベント一覧を取得し、
    // 招待された共同編集者（is_event_organizer: false）のロックアウトを物理根絶
    if (!isCheckingAuth) {
      fetchEvents();
    }
    return () => {
      if (eventsAbortRef.current) {
        eventsAbortRef.current.abort();
      }
    };
  }, [isCheckingAuth, fetchEvents]);

  // 選択イベントの出席者名簿取得
  const fetchAttendees = useCallback(async (eventId: string, signal?: AbortSignal) => {
    setIsLoadingAttendees(true);
    try {
      const res = await eventService.getEventAttendees(eventId, signal);
      if (!signal || !signal.aborted) {
        setAttendees(res.attendees || []);
      }
    } catch {
      if (signal && signal.aborted) return;
      setAttendees([]);
    } finally {
      if (!signal || !signal.aborted) {
        setIsLoadingAttendees(false);
      }
    }
  }, []);

  // 選択イベントの申込者一覧取得
  const fetchApplications = useCallback(async (eventId: string, signal?: AbortSignal) => {
    setIsLoadingApplications(true);
    setLotteryMessage(null);
    try {
      const res = await eventService.getApplications(eventId, signal);
      if (!signal || !signal.aborted) {
        setApplications(res || []);
      }
    } catch {
      if (signal && signal.aborted) return;
      setApplications([]);
    } finally {
      if (!signal || !signal.aborted) {
        setIsLoadingApplications(false);
      }
    }
  }, []);

  // 🌟 [CONCURRENT STALE CLOSURE & RACE CONDITION PROOF]:
  // イベント切り替え時に即座に旧イベント名簿をパージし、遅延レスポンスの混入を物理遮断
  const selectedEventId = selectedEvent?.event_id;
  const selectedEventRequiresReg = selectedEvent?.requires_registration;

  useEffect(() => {
    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
    }
    const controller = new AbortController();
    detailAbortRef.current = controller;

    // イベント切り替え時のゴーストデータ即時パージ
    setAttendees([]);
    setLotteryMessage(null);

    if (!selectedEventId) {
      setApplications([]);
      setIsLoadingAttendees(false);
      setIsLoadingApplications(false);
      return;
    }

    fetchAttendees(selectedEventId, controller.signal);

    if (selectedEventRequiresReg) {
      fetchApplications(selectedEventId, controller.signal);
    } else {
      setApplications([]);
      setActiveViewMode('attendees');
    }

    return () => {
      controller.abort();
    };
  }, [selectedEventId, selectedEventRequiresReg, fetchAttendees, fetchApplications]);

  // 自動抽選の実行（同期 Ref ロックによる二重実行・連打競合の完全防御 & アンバサダー優先・補欠枠対応）
  const handleRunLottery = async () => {
    if (!selectedEvent || isLotterySubmittingRef.current) return;
    const confirmRun = window.confirm(
      `「${selectedEvent.title}」の自動抽選を実行しますか？\n定員および設定条件に応じて自動選考されます。`
    );
    if (!confirmRun || isLotterySubmittingRef.current) return;

    isLotterySubmittingRef.current = true;
    const targetEventId = selectedEvent.event_id;
    setIsLotterySubmitting(true);
    setLotteryMessage(null);
    try {
      const res = await eventService.runLotterySelection(targetEventId, {
        capacity: selectedEvent.capacity || 100,
        ambassador_priority: lotteryAmbassadorPriority,
        waitlist_capacity: lotteryWaitlistCapacity,
        note: lotteryNote.trim() || undefined,
      });
      setLotteryMessage(
        `抽選完了: 当選 ${res.selected_count} 名 / 補欠 ${res.waitlisted_count} 名 / 落選 ${res.rejected_count} 名`
      );
      fetchEvents();
      fetchApplications(targetEventId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '抽選の実行に失敗しました。');
    } finally {
      isLotterySubmittingRef.current = false;
      setIsLotterySubmitting(false);
    }
  };

  // 申込者のステータス個別変更（主催者・共同編集者 & 連打防御）
  const handleUpdateApplicationStatus = async (
    userId: string,
    newStatus: 'selected' | 'waitlisted' | 'rejected'
  ) => {
    if (!selectedEvent || updatingStatusUserId) return;
    const targetEventId = selectedEvent.event_id;
    setUpdatingStatusUserId(userId);
    try {
      await eventService.updateApplicationStatus(targetEventId, userId, newStatus);
      // 楽観的UI更新
      setApplications((prev) =>
        prev.map((app) => (app.user_id === userId ? { ...app, status: newStatus } : app))
      );
      fetchEvents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'ステータスの更新に失敗しました。');
      fetchApplications(targetEventId);
    } finally {
      setUpdatingStatusUserId(null);
    }
  };

  // イベント削除（オーナー/管理者のみ）
  const handleDeleteEvent = async () => {
    if (!selectedEvent || !isSelectedEventOwner) return;
    const ok = window.confirm(
      `警告: イベント「${selectedEvent.title}」を完全に削除しますか？\nこの操作は取り消せません。`
    );
    if (!ok) return;

    try {
      await eventService.deleteEvent(selectedEvent.event_id);
      alert('イベントを削除しました。');
      setSelectedEvent(null);
      if (typeof window !== 'undefined' && window.history.replaceState) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('event_id');
          window.history.replaceState({}, document.title, url.toString());
        } catch {
          // sandbox safe
        }
      }
      fetchEvents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'イベントの削除に失敗しました。');
    }
  };

  // チェックイン取り消し（関数型更新 & 厳格なイベントID固定 & 決定論的リコンサイル）
  const handleDeleteCheckin = async (attendeeId: string) => {
    if (!selectedEvent) return;
    const ok = window.confirm('この参加者の受付チェックインを取り消しますか？');
    if (!ok) return;

    const targetEventId = selectedEvent.event_id;
    try {
      await eventService.deleteCheckin(targetEventId, attendeeId);
      // 楽観的関数型更新で即時UI反映
      setAttendees((prev) => prev.filter((a) => a.attendee_id !== attendeeId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'チェックインの取消に失敗しました。');
    } finally {
      // 🌟 [CONCURRENT RECONCILIATION]: 404/競合エラー時でも最新名簿を再取得しゴースト行を完全パージ
      fetchAttendees(targetEventId);
      fetchEvents();
    }
  };

  // フィルタリングされた出席者
  const filteredAttendees = useMemo(() => {
    if (!attendeeSearchQuery.trim()) return attendees;
    const q = attendeeSearchQuery.toLowerCase();
    return attendees.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.display_name && a.display_name.toLowerCase().includes(q)) ||
        a.attendee_id.toLowerCase().includes(q)
    );
  }, [attendees, attendeeSearchQuery]);

  if (isCheckingAuth || isLoadingEvents) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDarkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'}`}>
        <Loader2 className="w-8 h-8 text-[#1a73e8] animate-spin mb-3" />
        <p className="text-sm font-medium">権限とイベント情報を確認中...</p>
      </div>
    );
  }

  // 主催権限がない場合のガード
  if (!isOrganizer) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center ${isDarkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'}`}>
        <div className="max-w-md w-full p-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-semibold">主催者権限がありません</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            この画面はイベント主催者・管理者専用です。主催権限が付与されているアカウントでログインしてください。
          </p>
          <a
            href="./home.html"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ホームへ戻る</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${isDarkMode ? 'bg-neutral-950 text-neutral-100' : 'bg-neutral-50 text-neutral-900'}`}>
      {/* ダッシュボードヘッダー */}
      <header className={`border-b sticky top-0 z-30 px-3 sm:px-4 py-3 backdrop-blur ${isDarkMode ? 'border-neutral-900 bg-neutral-950/85' : 'border-neutral-200 bg-white/85 shadow-xs'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <a
              href="./home.html"
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs font-medium shrink-0 ${
                isDarkMode ? 'border-neutral-800 hover:bg-neutral-900 text-neutral-300' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
              }`}
              title="ホームへ戻る"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">ホーム</span>
            </a>
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#1a73e8] shrink-0" />
              <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">主催者ダッシュボード</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                isDarkMode ? 'border-neutral-800 bg-neutral-900/60 text-neutral-300' : 'border-neutral-200 bg-neutral-100 text-neutral-700'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
            </button>
            {canCreateEvents && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1a73e8] hover:bg-[#1557b0] text-white flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>新規<span className="hidden sm:inline">イベント</span></span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* イベントセレクター & 概要 */}
        {isLoadingEvents ? (
          <div className="p-8 text-center text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1a73e8]" />
            <span className="text-xs">イベント一覧を読み込み中...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl border border-rose-900/40 bg-rose-950/20 text-rose-300 text-xs">
            {errorMsg}
          </div>
        ) : events.length === 0 ? (
          <div className={`p-8 rounded-2xl border text-center space-y-3 ${isDarkMode ? 'border-neutral-800 bg-neutral-900/40' : 'border-neutral-200 bg-white'}`}>
            <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
            <p className="text-sm font-medium">作成されたイベントはまだありません。</p>
            {canCreateEvents && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1a73e8] text-white hover:bg-[#1557b0] transition"
              >
                最初のイベントを作成する
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* イベント選択タブ */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {events.map((evt) => (
                <button
                  key={evt.event_id}
                  onClick={() => handleSelectEvent(evt)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition cursor-pointer shrink-0 ${
                    selectedEvent?.event_id === evt.event_id
                      ? isDarkMode
                        ? 'bg-white text-neutral-900 border-white font-semibold shadow-xs'
                        : 'bg-neutral-900 text-white border-neutral-900 font-semibold shadow-xs'
                      : isDarkMode
                        ? 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  {evt.title}
                </button>
              ))}
            </div>

            {/* 選択中イベントのコントロールカード */}
            {selectedEvent && (
              <div className={`p-5 rounded-2xl border space-y-4 transition-colors ${isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-white shadow-xs'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-inherit">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                        selectedEvent.requires_registration
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {selectedEvent.requires_registration ? '事前申込・抽選制' : '通常イベント'}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {new Date(selectedEvent.event_date).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight">{selectedEvent.title}</h2>
                    {selectedEvent.location && (
                      <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{selectedEvent.location}</span>
                      </p>
                    )}
                  </div>

                  {/* アクションボタン群 */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {/* イベント編集 */}
                    {canManageSelectedEvent && (
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                            : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
                        }`}
                        title="イベント情報を編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>編集</span>
                      </button>
                    )}

                    {/* 共同編集者・スタッフ招待 */}
                    <button
                      type="button"
                      onClick={() => setIsCollaboratorModalOpen(true)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                        isDarkMode
                          ? 'border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-900/30 text-indigo-300'
                          : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                      }`}
                      title="共同運営スタッフを招待"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>スタッフ招待</span>
                    </button>

                    {/* QRスキャン受付 */}
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>QR受付</span>
                    </button>

                    {/* イベント削除（オーナーのみ） */}
                    {isSelectedEventOwner && (
                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        className="min-h-[38px] p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                        title="イベントを削除"
                        aria-label="イベントを削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* KPI カウンター */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-100 bg-neutral-50'}`}>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">定員</span>
                    <span className="text-base font-semibold">{selectedEvent.capacity ? `${selectedEvent.capacity} 名` : '無制限'}</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-100 bg-neutral-50'}`}>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">応募者数</span>
                    <span className="text-base font-semibold">{selectedEvent.total_applications ?? applications.length} 名</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-100 bg-neutral-50'}`}>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">当選者数</span>
                    <span className="text-base font-semibold text-indigo-400">{selectedEvent.selected_count ?? '-'} 名</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-100 bg-neutral-50'}`}>
                    <span className="text-[11px] text-neutral-400 block mb-0.5">チェックイン</span>
                    <span className="text-base font-semibold text-emerald-400">{attendees.length} 名</span>
                  </div>
                </div>

                {/* 抽選ボタン（事前申込制イベントの場合） */}
                {selectedEvent.requires_registration && (
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    isDarkMode ? 'border-indigo-900/40 bg-indigo-950/20' : 'border-indigo-100 bg-indigo-50/70'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                          <Shuffle className="w-3.5 h-3.5" />
                          自動選考・抽選機能
                        </span>
                        <p className="text-xs text-neutral-400">
                          定員に合わせて応募者の中から自動選考を行います。
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLotteryOptions(!showLotteryOptions)}
                          className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center gap-1 ${
                            isDarkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>詳細設定</span>
                          {showLotteryOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={handleRunLottery}
                          disabled={isLotterySubmitting}
                          className="min-h-[36px] px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                          {isLotterySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                          <span>抽選を実行</span>
                        </button>
                      </div>
                    </div>

                    {/* 抽選詳細設定アコーディオン */}
                    {showLotteryOptions && (
                      <div className={`pt-3 border-t border-inherit space-y-3 text-xs ${
                        isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                      }`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="lottery-ambassador-priority"
                              checked={lotteryAmbassadorPriority}
                              onChange={(e) => setLotteryAmbassadorPriority(e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <label htmlFor="lottery-ambassador-priority" className="cursor-pointer select-none">
                              アンバサダー優先当選枠を有効化
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            <label htmlFor="lottery-waitlist-cap" className="whitespace-nowrap text-[11px] text-neutral-400">
                              補欠枠数:
                            </label>
                            <input
                              type="number"
                              id="lottery-waitlist-cap"
                              min={0}
                              max={1000}
                              value={lotteryWaitlistCapacity}
                              onChange={(e) => setLotteryWaitlistCapacity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                              className={`w-20 p-1.5 rounded-lg border text-xs focus:outline-hidden ${
                                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
                              }`}
                            />
                            <span className="text-[11px] text-neutral-400">名</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-neutral-400 mb-1">
                            選考メモ（任意）
                          </label>
                          <input
                            type="text"
                            maxLength={500}
                            placeholder="例: 第1次選考抽選"
                            value={lotteryNote}
                            onChange={(e) => setLotteryNote(e.target.value)}
                            className={`w-full p-2 rounded-lg border text-xs focus:outline-hidden ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {lotteryMessage && (
                  <div className="p-3 rounded-xl border border-indigo-900 bg-indigo-950/40 text-xs text-indigo-200">
                    {lotteryMessage}
                  </div>
                )}
              </div>
            )}

            {/* 一覧ビュー切り替え（出席者名簿 vs 申込者） */}
            {selectedEvent && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-2 border-inherit">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <button
                      onClick={() => setActiveViewMode('attendees')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                        activeViewMode === 'attendees'
                          ? isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-900'
                          : 'text-neutral-400 hover:text-inherit'
                      }`}
                    >
                      受付済み出席者 ({attendees.length})
                    </button>
                    {selectedEvent.requires_registration && (
                      <button
                        onClick={() => setActiveViewMode('applications')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                          activeViewMode === 'applications'
                            ? isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-900'
                            : 'text-neutral-400 hover:text-inherit'
                        }`}
                      >
                        応募者リスト ({applications.length})
                      </button>
                    )}
                  </div>

                  {activeViewMode === 'attendees' && (
                    <div className="relative w-full sm:w-auto">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="出席者検索..."
                        value={attendeeSearchQuery}
                        onChange={(e) => setAttendeeSearchQuery(e.target.value)}
                        className={`w-full sm:w-48 pl-8 pr-3 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                          isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-200 text-neutral-900'
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* 名簿リスト */}
                {activeViewMode === 'attendees' ? (
                  isLoadingAttendees ? (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1a73e8]" />
                      名簿を取得中...
                    </div>
                  ) : filteredAttendees.length === 0 ? (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      まだチェックインした参加者はいません。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAttendees.map((att) => (
                        <div
                          key={att.attendee_id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                            isDarkMode ? 'border-neutral-800/80 bg-neutral-900/40' : 'border-neutral-200 bg-white'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate">{att.name || att.display_name || att.attendee_id}</span>
                              {att.is_ambassador && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1a73e8]/10 text-[#1a73e8] dark:text-[#8ab4f8]">
                                  Ambassador
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400">
                              {att.university || '所属未設定'} • チェックイン: {new Date(att.checked_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <button
                            onClick={() => handleDeleteCheckin(att.attendee_id)}
                            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                            title="チェックイン取消"
                            aria-label="チェックイン取消"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* 応募者リスト */
                  isLoadingApplications ? (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                      応募者を取得中...
                    </div>
                  ) : applications.length === 0 ? (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      現在応募者はいません。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {applications.map((app) => (
                        <div
                          key={app.application_id || app.user_id}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isDarkMode ? 'border-neutral-800/80 bg-neutral-900/40' : 'border-neutral-200 bg-white'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate block">
                                {app.name || app.user_name || app.display_name || app.user_id}
                              </span>
                              {app.is_ambassador && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1a73e8]/10 text-[#1a73e8] dark:text-[#8ab4f8]">
                                  Ambassador
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400">
                              {app.university || '所属未設定'} ({app.grade || '未設定'}) • 応募: {new Date(app.applied_at).toLocaleDateString('ja-JP')}
                            </p>
                            {app.motivation && (
                              <p className={`text-xs p-2 rounded-lg mt-1 whitespace-pre-wrap break-words ${
                                isDarkMode ? 'bg-neutral-950/60 text-neutral-300' : 'bg-neutral-100 text-neutral-700'
                              }`}>
                                {app.motivation}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {/* ステータスバッジ */}
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                              app.status === 'selected'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : app.status === 'waitlisted'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : app.status === 'rejected'
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    : app.status === 'cancelled'
                                      ? 'bg-neutral-800 text-neutral-500 border border-neutral-700/60 line-through'
                                      : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                            }`}>
                              {app.status === 'selected'
                                ? '当選'
                                : app.status === 'waitlisted'
                                  ? '補欠'
                                  : app.status === 'rejected'
                                    ? '落選'
                                    : app.status === 'cancelled'
                                      ? '辞退'
                                      : '応募中'}
                            </span>

                            {/* 手動選考・ステータス切替ボタン: 辞退者は選考対象外としてボタン非表示 */}
                            {app.status === 'cancelled' ? (
                              <span className="text-[11px] text-neutral-500 italic px-2">辞退済み</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                {app.status !== 'selected' && (
                                  <button
                                    type="button"
                                    disabled={updatingStatusUserId === app.user_id}
                                    onClick={() => handleUpdateApplicationStatus(app.user_id, 'selected')}
                                    className="px-2 py-1 rounded text-[11px] font-medium border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 transition cursor-pointer disabled:opacity-50"
                                    title="当選に変更"
                                  >
                                    当選
                                  </button>
                                )}
                                {app.status !== 'waitlisted' && (
                                  <button
                                    type="button"
                                    disabled={updatingStatusUserId === app.user_id}
                                    onClick={() => handleUpdateApplicationStatus(app.user_id, 'waitlisted')}
                                    className="px-2 py-1 rounded text-[11px] font-medium border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 transition cursor-pointer disabled:opacity-50"
                                    title="補欠に変更"
                                  >
                                    補欠
                                  </button>
                                )}
                                {app.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    disabled={updatingStatusUserId === app.user_id}
                                    onClick={() => handleUpdateApplicationStatus(app.user_id, 'rejected')}
                                    className="px-2 py-1 rounded text-[11px] font-medium border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 transition cursor-pointer disabled:opacity-50"
                                    title="落選に変更"
                                  >
                                    落選
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* カメラQRスキャンモーダル */}
      {selectedEvent && (
        <EventScannerModal
          isOpen={isScannerOpen}
          event={selectedEvent}
          onClose={() => {
            setIsScannerOpen(false);
            fetchAttendees(selectedEvent.event_id);
            fetchEvents();
          }}
          onCheckinSuccess={() => {
            fetchAttendees(selectedEvent.event_id);
            fetchEvents();
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* 新規イベント作成モーダル */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          setIsCreateModalOpen(false);
          fetchEvents();
        }}
        isDarkMode={isDarkMode}
      />

      {/* イベント編集モーダル */}
      {selectedEvent && (
        <EditEventModal
          event={selectedEvent}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={() => {
            fetchEvents();
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* 共同編集者・スタッフ招待管理モーダル */}
      {selectedEvent && (
        <CollaboratorModal
          eventId={selectedEvent.event_id}
          eventTitle={selectedEvent.title}
          isOwner={isSelectedEventOwner}
          isOpen={isCollaboratorModalOpen}
          onClose={() => {
            setIsCollaboratorModalOpen(false);
            fetchEvents();
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default OrganizerApp;
