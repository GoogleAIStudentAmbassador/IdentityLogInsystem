import React from 'react';
import { X, Calendar, MapPin, Users, FileText } from 'lucide-react';
import type { EventItem } from '../../types';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  isDarkMode,
}) => {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !event) return null;

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'long',
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-xl p-5 sm:p-6 transition-all max-h-[90vh] overflow-y-auto ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-start justify-between gap-3 border-b pb-4 mb-4 border-inherit">
          <div className="space-y-1 pr-2">
            <span
              className={`text-[11px] font-mono tracking-wider font-semibold uppercase px-2 py-0.5 rounded ${
                isDarkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              イベント詳細
            </span>
            <h3 id="event-detail-title" className="text-base sm:text-lg font-semibold tracking-tight leading-snug">
              {event.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
              isDarkMode ? 'text-neutral-400 hover:text-white hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* イベントメタ情報 */}
        <div className="space-y-3.5 mb-5 text-xs sm:text-sm">
          {/* 日時 */}
          <div className="flex items-start gap-2.5">
            <Calendar className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
            <div>
              <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                開催日時
              </span>
              <span className="font-medium tracking-tight">
                {formatDate(event.event_date)}
              </span>
            </div>
          </div>

          {/* 会場 / 場所 */}
          {event.location && (
            <div className="flex items-start gap-2.5">
              <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
              <div>
                <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  開催場所 / URL
                </span>
                <span className="font-medium break-all tracking-tight">
                  {event.location}
                </span>
              </div>
            </div>
          )}

          {/* 定員 */}
          {event.capacity !== undefined && event.capacity !== null && (
            <div className="flex items-start gap-2.5">
              <Users className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
              <div>
                <span className={`block text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  定員
                </span>
                <span className="font-medium tracking-tight">
                  {event.capacity > 0 ? `${event.capacity} 名` : '制限なし'}
                </span>
              </div>
            </div>
          )}

          {/* 説明文 */}
          {event.description && (
            <div className="flex items-start gap-2.5 pt-2 border-t border-inherit">
              <FileText className={`w-4 h-4 mt-0.5 shrink-0 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
              <div className="w-full">
                <span className={`block text-[11px] font-medium mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  概要・説明
                </span>
                <p className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
                }`}>
                  {event.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 閉じるボタン */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-200'
            }`}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
