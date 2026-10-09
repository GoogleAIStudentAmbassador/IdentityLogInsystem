import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, MapPin, Users, FileText, Loader2, Edit3, AlertCircle } from 'lucide-react';
import type { EventItem, UpdateEventPayload } from '../../types';
import { eventService } from '../../services/eventService';

interface EditEventModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  isDarkMode: boolean;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  event,
  isOpen,
  onClose,
  onUpdated,
  isDarkMode,
}) => {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState<string>('');
  const [description, setDescription] = useState('');
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ISO日付をローカルdatetime-local入力形式 (YYYY-MM-DDTHH:mm) に安全変換
  const toLocalInputValue = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    if (!isOpen || !event) {
      setErrorMsg(null);
      return;
    }

    setTitle(event.title || '');
    setEventDate(toLocalInputValue(event.event_date));
    setLocation(event.location || '');
    setCapacity(event.capacity ? String(event.capacity) : '');
    setDescription(event.description || '');
    setRequiresRegistration(Boolean(event.requires_registration));
    setErrorMsg(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, event]);

  if (!isOpen || !event) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!title.trim()) {
      setErrorMsg('イベント名を入力してください。');
      return;
    }
    if (!eventDate) {
      setErrorMsg('開催日時を入力してください。');
      return;
    }
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      setErrorMsg('日時の形式が不正です。');
      return;
    }
    if (!location.trim()) {
      setErrorMsg('開催場所またはURLを入力してください。');
      return;
    }

    let parsedCapacity: number | null = null;
    if (capacity.trim()) {
      const num = parseInt(capacity.trim(), 10);
      if (isNaN(num) || num <= 0) {
        setErrorMsg('定員は1以上の正の整数で入力してください。');
        return;
      }
      parsedCapacity = num;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: UpdateEventPayload = {
        title: title.trim(),
        event_date: parsedDate.toISOString(),
        location: location.trim(),
        capacity: parsedCapacity,
        description: description.trim() || null,
        requires_registration: requiresRegistration,
      };

      await eventService.updateEvent(event.event_id, payload);
      if (isMountedRef.current) {
        onUpdated();
        onClose();
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'イベント情報の更新に失敗しました。');
      }
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
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
        <div className="flex items-center justify-between border-b pb-4 mb-4 border-inherit">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#1a73e8]" />
            <h3 id="edit-event-modal-title" className="text-base sm:text-lg font-semibold tracking-tight">
              イベント情報の編集
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 ${
              isDarkMode
                ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* イベント名 */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              イベント名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={128}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 第2回 アンバサダーオフ会"
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm border focus:outline-hidden transition-colors ${
                isDarkMode
                  ? 'bg-neutral-800 border-neutral-700 text-white focus:border-[#1a73e8]'
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-[#1a73e8]'
              }`}
            />
          </div>

          {/* 開催日時 */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              開催日時 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="datetime-local"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl text-xs sm:text-sm border focus:outline-hidden transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800 border-neutral-700 text-white focus:border-[#1a73e8]'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-[#1a73e8]'
                }`}
              />
            </div>
          </div>

          {/* 開催場所 */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              開催場所 / オンラインURL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                required
                maxLength={256}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 渋谷カンファレンスタワー 4F / Discord"
                className={`w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl text-xs sm:text-sm border focus:outline-hidden transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800 border-neutral-700 text-white focus:border-[#1a73e8]'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-[#1a73e8]'
                }`}
              />
            </div>
          </div>

          {/* 定員 */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              定員（任意・空欄で無制限）
            </label>
            <div className="relative">
              <Users className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="number"
                min={1}
                max={100000}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="例: 30"
                className={`w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl text-xs sm:text-sm border focus:outline-hidden transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800 border-neutral-700 text-white focus:border-[#1a73e8]'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-[#1a73e8]'
                }`}
              />
            </div>
          </div>

          {/* 事前申込・選考必須チェックボックス */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-200 bg-neutral-50'
          }`}>
            <input
              type="checkbox"
              id="edit-requires-reg"
              checked={requiresRegistration}
              onChange={(e) => setRequiresRegistration(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="edit-requires-reg" className="text-xs cursor-pointer select-none">
              <span className="font-semibold block mb-0.5">事前申込・選考制イベントにする</span>
              <span className="text-[11px] text-neutral-400 block leading-relaxed">
                チェックを入れると参加者が事前応募可能になり、自動抽選または手動選考での当選者のみが受付可能になります。
              </span>
            </label>
          </div>

          {/* 概要・説明 */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              概要・説明（任意）
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400 pointer-events-none" />
              <textarea
                maxLength={2000}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="イベントの持ち物、タイムテーブル、注意事項などを入力してください"
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm border focus:outline-hidden resize-none transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800 border-neutral-700 text-white focus:border-[#1a73e8]'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900 focus:border-[#1a73e8]'
                }`}
              />
            </div>
          </div>

          {/* アクションボタン */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium border transition cursor-pointer ${
                isDarkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a73e8] hover:bg-[#1557b0] text-white disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
              <span>更新を保存</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
