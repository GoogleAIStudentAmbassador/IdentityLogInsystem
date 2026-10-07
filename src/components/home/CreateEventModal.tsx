import React, { useState } from 'react';
import { X, Calendar, MapPin, Users, FileText, Plus, Loader2 } from 'lucide-react';
import { eventService } from '../../services/eventService';
import type { EventItem, CreateEventPayload } from '../../types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (event: EventItem) => void;
  isDarkMode: boolean;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  isDarkMode,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    const cleanLocation = location.trim();
    if (!cleanTitle) {
      setErrorMsg('イベント名を入力してください。');
      return;
    }
    if (!eventDate) {
      setErrorMsg('開催日時を選択してください。');
      return;
    }
    if (!cleanLocation) {
      setErrorMsg('会場または開催URLを入力してください。');
      return;
    }

    const payload: CreateEventPayload = {
      title: cleanTitle,
      description: description.trim() || undefined,
      event_date: new Date(eventDate).toISOString(),
      location: cleanLocation,
      capacity: capacity ? parseInt(capacity, 10) : undefined,
      is_active: true,
    };

    setIsSubmitting(true);
    try {
      const created = await eventService.createEvent(payload);
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'イベントの作成に失敗しました。';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-white'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">イベント新規作成</h3>
              <p className="text-xs text-neutral-400">新しいイベントとチェックイン受付枠を発行します</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800/60 transition-colors cursor-pointer text-neutral-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              イベント名 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: Google AI 学生アンバサダー 秋期カンファレンス"
              maxLength={128}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-hidden focus:border-emerald-500 transition-colors ${
                isDarkMode
                  ? 'bg-neutral-800/90 border-neutral-700 text-white'
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900'
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                開催日時 <span className="text-rose-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-hidden focus:border-emerald-500 transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800/90 border-neutral-700 text-white'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                }`}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                定員（人数・任意）
              </label>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="例: 100"
                  className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border focus:outline-hidden focus:border-emerald-500 transition-colors ${
                    isDarkMode
                      ? 'bg-neutral-800/90 border-neutral-700 text-white'
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              会場または開催URL <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: Google 渋谷ストリーム / オンライン(Meet)"
                maxLength={256}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border focus:outline-hidden focus:border-emerald-500 transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800/90 border-neutral-700 text-white'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                }`}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              イベント詳細・説明（任意）
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="イベントの趣旨、持ち物、タイムスケジュールなど"
                maxLength={2000}
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border focus:outline-hidden focus:border-emerald-500 transition-colors resize-none ${
                  isDarkMode
                    ? 'bg-neutral-800/90 border-neutral-700 text-white'
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                }`}
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-neutral-800/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 作成中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> イベントを作成
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
