import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Users,
  FileText,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import type { EventItem, ApplicationInfo } from '../../types';
import { eventService } from '../../services/eventService';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  canManage?: boolean;
  onApplicationChanged?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  isDarkMode,
  canManage = false,
  onApplicationChanged,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 事前申込管理ステート
  const [application, setApplication] = useState<ApplicationInfo | null>(null);
  const [isLoadingApp, setIsLoadingApp] = useState(false);
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const isSubmittingAppRef = useRef(false);
  const isCancellingAppRef = useRef(false);
  const [showMotivationInput, setShowMotivationInput] = useState(false);
  const [motivationText, setMotivationText] = useState('');
  const [appError, setAppError] = useState<string | null>(null);
  const [appSuccessMessage, setAppSuccessMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchMyApplication = useCallback(async (eventId: string, signal?: AbortSignal) => {
    setIsLoadingApp(true);
    setAppError(null);
    try {
      const myApp = await eventService.getMyApplication(eventId, signal);
      if (!signal?.aborted && isMountedRef.current) {
        setApplication(myApp);
      }
    } catch {
      if (signal?.aborted || !isMountedRef.current) return;
      // ログイン前またはネットワークエラー時は未申込扱い
      setApplication(null);
    } finally {
      if (!signal?.aborted && isMountedRef.current) {
        setIsLoadingApp(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !event) {
      setApplication(null);
      setShowMotivationInput(false);
      setMotivationText('');
      setAppError(null);
      setAppSuccessMessage(null);
      return;
    }

    const controller = new AbortController();
    if (event.requires_registration) {
      fetchMyApplication(event.event_id, controller.signal);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      controller.abort();
    };
  }, [isOpen, event, fetchMyApplication]);

  // 参加申込送信
  const handleApply = async () => {
    if (!event || isSubmittingAppRef.current) return;
    const cleanMotivation = motivationText.trim();
    if (cleanMotivation.length > 500) {
      setAppError('志望動機は500文字以内で入力してください。');
      return;
    }
    isSubmittingAppRef.current = true;
    setIsSubmittingApp(true);
    setAppError(null);
    setAppSuccessMessage(null);
    try {
      const res = await eventService.applyToEvent(event.event_id, cleanMotivation);
      if (!isMountedRef.current) return;
      setApplication(res);
      setAppSuccessMessage('イベントへの参加申し込みを完了しました。');
      setShowMotivationInput(false);
      onApplicationChanged?.();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setAppError(err instanceof Error ? err.message : '申し込みに失敗しました。');
    } finally {
      isSubmittingAppRef.current = false;
      if (isMountedRef.current) {
        setIsSubmittingApp(false);
      }
    }
  };

  // 申込キャンセル（辞退）
  const handleCancelApplication = async () => {
    if (!event || isCancellingAppRef.current) return;
    const ok = window.confirm('このイベントへの参加申し込みを取り消しますか？');
    if (!ok || isCancellingAppRef.current) return;

    isCancellingAppRef.current = true;
    setIsSubmittingApp(true);
    setAppError(null);
    setAppSuccessMessage(null);
    try {
      await eventService.cancelApplication(event.event_id);
      if (!isMountedRef.current) return;
      setApplication(null);
      setAppSuccessMessage('参加申し込みを取り消しました。');
      onApplicationChanged?.();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setAppError(err instanceof Error ? err.message : 'キャンセルに失敗しました。');
    } finally {
      isCancellingAppRef.current = false;
      if (isMountedRef.current) {
        setIsSubmittingApp(false);
      }
    }
  };

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

          {/* 事前申込制イベントの参加申込・選考ステータスセクション */}
          {event.requires_registration && (
            <div className="pt-3 border-t border-inherit space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  参加申込ステータス
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                  事前申込・選考制
                </span>
              </div>

              {isLoadingApp ? (
                <div className="p-4 rounded-xl border border-inherit flex items-center justify-center gap-2 text-xs text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1a73e8]" />
                  <span>申込状況を確認中...</span>
                </div>
              ) : application && application.status !== 'cancelled' ? (
                <div className="space-y-2.5">
                  {application.status === 'applied' && (
                    <div className={`p-3.5 rounded-xl border space-y-1 ${
                      isDarkMode ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300' : 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>申込済み（選考中）</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        現在選考中です。主催者による自動抽選または選考結果をお待ちください。
                      </p>
                    </div>
                  )}

                  {application.status === 'selected' && (
                    <div className={`p-3.5 rounded-xl border space-y-1 ${
                      isDarkMode ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>当選しました</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        当日は会場受付にて名刺QRコードをご提示ください。
                      </p>
                    </div>
                  )}

                  {application.status === 'waitlisted' && (
                    <div className={`p-3.5 rounded-xl border space-y-1 ${
                      isDarkMode ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>補欠（繰り上げ対象）</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        辞退者が発生した場合に繰り上げ当選となります。
                      </p>
                    </div>
                  )}

                  {application.status === 'rejected' && (
                    <div className={`p-3.5 rounded-xl border space-y-1 ${
                      isDarkMode ? 'border-neutral-800 bg-neutral-800/50 text-neutral-400' : 'border-neutral-200 bg-neutral-100 text-neutral-600'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <AlertCircle className="w-4 h-4" />
                        <span>今回はご希望に添えませんでした</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        多数のご応募ありがとうございました。
                      </p>
                    </div>
                  )}

                  {/* 応募中または補欠時の辞退ボタン */}
                  {(application.status === 'applied' || application.status === 'waitlisted') && (
                    <button
                      type="button"
                      onClick={handleCancelApplication}
                      disabled={isSubmittingApp}
                      className="w-full min-h-[38px] py-1.5 px-3 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingApp ? '処理中...' : '参加申し込みを取り消す（辞退）'}
                    </button>
                  )}
                </div>
              ) : (
                /* 未申込時の申込フォーム */
                <div className="space-y-2.5">
                  {!showMotivationInput ? (
                    <button
                      type="button"
                      onClick={() => setShowMotivationInput(true)}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
                    >
                      <span>参加を申し込む</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className={`p-3.5 rounded-xl border space-y-3 ${isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-200 bg-neutral-50/70'}`}>
                      <div>
                        <label className={`block text-[11px] font-medium mb-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                          志望動機・一言メッセージ（任意）
                        </label>
                        <textarea
                          value={motivationText}
                          onChange={(e) => setMotivationText(e.target.value)}
                          placeholder="参加希望理由や自己紹介などがあればご自由に入力してください"
                          maxLength={500}
                          rows={3}
                          className={`w-full p-2.5 rounded-lg text-xs border focus:outline-hidden resize-none transition-colors ${
                            isDarkMode
                              ? 'bg-neutral-900 border-neutral-700 text-white focus:border-[#1a73e8]'
                              : 'bg-white border-neutral-300 text-neutral-900 focus:border-[#1a73e8]'
                          }`}
                        />
                        <div className="text-right text-[10px] text-neutral-400 mt-1">
                          {motivationText.length} / 500文字
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowMotivationInput(false)}
                          disabled={isSubmittingApp}
                          className={`flex-1 min-h-[40px] py-2 px-3 rounded-lg text-xs font-medium border transition cursor-pointer ${
                            isDarkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={handleApply}
                          disabled={isSubmittingApp}
                          className="flex-1 min-h-[40px] py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isSubmittingApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          <span>申し込む</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* エラー / 成功メッセージ */}
              {appError && (
                <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{appError}</span>
                </div>
              )}
              {appSuccessMessage && (
                <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{appSuccessMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッターアクション */}
        <div className="pt-2 space-y-2">
          {canManage && (
            <a
              href="./organizer.html"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = `./organizer.html?event_id=${encodeURIComponent(event.event_id)}`;
              }}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span>主催者ダッシュボードで管理</span>
            </a>
          )}
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
