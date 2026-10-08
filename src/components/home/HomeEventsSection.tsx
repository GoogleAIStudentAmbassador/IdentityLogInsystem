import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Calendar, MapPin, Plus, ChevronRight, Loader2 } from 'lucide-react';
import type { EventItem } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { eventService } from '../../services/eventService';
import { EventDetailModal } from './EventDetailModal';
import { CreateEventModal } from './CreateEventModal';

interface HomeEventsSectionProps {
  user: AuthUser | null;
  isDarkMode: boolean;
}

export const HomeEventsSection: React.FC<HomeEventsSectionProps> = ({
  user,
  isDarkMode,
}) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // モーダル管理ステート
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // 非同期通信のキャンセル & アンマウント時メモリリーク防止
  const abortControllerRef = useRef<AbortController | null>(null);

  // 主催権限の判定 (RBAC)
  const isAdmin = Boolean(user?.role === 'admin' || user?.is_admin);
  const isBureau = Boolean(user?.role === 'bureau');
  const canCreateEvent = Boolean(user?.is_event_organizer || isAdmin || isBureau);

  // イベント一覧取得
  const fetchEvents = useCallback(async () => {
    // 既存のリクエストが実行中の場合は中断して競合・二重更新を防止
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await eventService.getEvents(false, controller.signal);
      if (!controller.signal.aborted) {
        setEvents(data);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'イベント情報の取得に失敗しました。';
      setErrorMsg(msg);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    return () => {
      // コンポーネントのアンマウント時に通信を即時中断し、非同期ステート更新リークを根絶
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchEvents]);

  // 直近2件のイベントを抽出 (開催日時基準)
  const upcomingEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    const now = Date.now();
    // 24時間前以降（現在進行中または未来）のイベント
    const futureEvents = events
      .filter((e) => {
        const time = new Date(e.event_date).getTime();
        return !isNaN(time) && time >= now - 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    if (futureEvents.length > 0) {
      return futureEvents.slice(0, 2);
    }

    // 未来の予定がない場合は、直近に開催された最新イベントを最大2件表示
    return [...events]
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
      .slice(0, 2);
  }, [events]);

  const formatShortDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className={`mt-4 w-full max-w-sm rounded-2xl p-5 border transition-colors ${
        isDarkMode
          ? 'border-neutral-800 bg-neutral-900/60 text-neutral-100'
          : 'border-neutral-200 bg-white text-neutral-900 shadow-sm'
      }`}
    >
      {/* セクションヘッダー */}
      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#1a73e8] dark:text-[#8ab4f8]" />
          <h3 className="text-sm sm:text-base font-semibold tracking-tight">
            イベント
          </h3>
        </div>

        {/* 2-2 主催権限がある場合の「＋」イベント追加ボタン */}
        {canCreateEvent && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            aria-label="新しいイベントを作成"
            title="新しいイベントを作成"
            className={`min-w-[36px] min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1 border ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>追加</span>
          </button>
        )}
      </div>

      {/* イベントコンテンツ */}
      {isLoading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin text-[#1a73e8]" />
          <span className="text-xs">イベントを確認中...</span>
        </div>
      ) : errorMsg ? (
        <div className="py-4 text-center">
          <p className="text-xs text-neutral-400 mb-2">{errorMsg}</p>
          <button
            type="button"
            onClick={fetchEvents}
            className="text-xs text-[#1a73e8] hover:underline"
          >
            再読み込み
          </button>
        </div>
      ) : upcomingEvents.length === 0 ? (
        <div className="py-5 text-center space-y-1">
          <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
            現在予定されているイベントはありません。
          </p>
          {canCreateEvent && (
            <p className={`text-[11px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              「追加」ボタンから新しいイベントを作成できます。
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {upcomingEvents.map((evt) => (
            <div
              key={evt.event_id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEventForDetail(evt)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedEventForDetail(evt);
                }
              }}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-3 ${
                isDarkMode
                  ? 'border-neutral-800/90 bg-neutral-950/40 hover:bg-neutral-800/60 hover:border-neutral-700'
                  : 'border-neutral-200/80 bg-neutral-50/70 hover:bg-neutral-100 hover:border-neutral-300'
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                {/* 開催日時バッジ */}
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#1a73e8] dark:text-[#8ab4f8]">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{formatShortDate(evt.event_date)}</span>
                </div>

                {/* イベントタイトル */}
                <h4 className="text-xs sm:text-sm font-semibold tracking-tight truncate leading-snug">
                  {evt.title}
                </h4>

                {/* 会場・場所 */}
                {evt.location && (
                  <div className={`flex items-center gap-1 text-[11px] truncate ${
                    isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{evt.location}</span>
                  </div>
                )}
              </div>

              {/* 右矢印アイコン */}
              <div className="shrink-0 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* イベント詳細モーダル */}
      <EventDetailModal
        event={selectedEventForDetail}
        isOpen={Boolean(selectedEventForDetail)}
        onClose={() => setSelectedEventForDetail(null)}
        isDarkMode={isDarkMode}
      />

      {/* イベント作成モーダル (主催権限所持時のみ) */}
      {canCreateEvent && (
        <CreateEventModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => {
            setIsCreateModalOpen(false);
            fetchEvents();
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};
