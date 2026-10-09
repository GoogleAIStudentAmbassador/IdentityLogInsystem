import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
  Link2,
} from 'lucide-react';
import type { EventCollaboratorsResponse } from '../../types';
import { eventService } from '../../services/eventService';

interface CollaboratorModalProps {
  eventId: string;
  eventTitle: string;
  isOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
}

export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
  eventId,
  eventTitle,
  isOwner,
  isOpen,
  onClose,
  isDarkMode,
}) => {
  const [data, setData] = useState<EventCollaboratorsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 招待発行フォームステート
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<number>(168); // 7日間
  const [note, setNote] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isMountedRef = useRef(true);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCollaborators = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await eventService.getCollaborators(eventId, signal);
      if (isMountedRef.current) {
        setData(res);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : '共同編集者情報の取得に失敗しました。');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setErrorMsg(null);
      setActionSuccessMsg(null);
      return;
    }

    const controller = new AbortController();
    fetchCollaborators(controller.signal);

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
  }, [isOpen, fetchCollaborators]);

  if (!isOpen) return null;

  // 招待リンク生成ヘルパー (URL API によるハッシュアンカー除去とパス安全置換)
  const getInviteUrl = (token: string): string => {
    if (typeof window === 'undefined') return token;
    try {
      const url = new URL(window.location.href);
      url.pathname = url.pathname.replace(/\/organizer\.html$/, '/home.html');
      if (!url.pathname.endsWith('/home.html')) {
        url.pathname = url.pathname.replace(/\/[^/]*$/, '/home.html');
      }
      url.search = `?accept_invitation=${encodeURIComponent(token)}&event_id=${encodeURIComponent(eventId)}`;
      url.hash = ''; // ハッシュアンカーを除去し searchParams を正常化
      return url.toString();
    } catch {
      const base = window.location.href.split('?')[0].split('#')[0].replace(/organizer\.html$/, 'home.html');
      return `${base}?accept_invitation=${encodeURIComponent(token)}&event_id=${encodeURIComponent(eventId)}`;
    }
  };

  // マルチ層クリップボードフォールバック（HTTPS外・LAN Wi-Fi・モバイル完全対応）
  const handleCopyInviteLink = async (token: string) => {
    const url = getInviteUrl(token);
    let copied = false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch {
        // fallback to execCommand
      }
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        // fallback to prompt
      }
    }

    if (copied) {
      if (isMountedRef.current) {
        setCopiedToken(token);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setCopiedToken(null);
          }
        }, 2500);
      }
    } else {
      window.prompt('招待URLをコピーしてください:', url);
    }
  };

  // 招待状発行
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingInvite) return;
    setIsCreatingInvite(true);
    setErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const newInv = await eventService.createInvitation(eventId, {
        role: 'editor',
        expires_in_hours: expiresInHours,
        note: note.trim() || undefined,
      });
      if (isMountedRef.current) {
        setNote('');
        setActionSuccessMsg('新しい招待リンクを発行しました。');
      }
      await fetchCollaborators();
      // 自動コピー
      handleCopyInviteLink(newInv.token);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : '招待リンクの発行に失敗しました。');
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreatingInvite(false);
      }
    }
  };

  // 招待状取消
  const handleDeleteInvitation = async (invitationId: string) => {
    const ok = window.confirm('この招待リンクを取り消しますか？取り消されたリンクは無効になります。');
    if (!ok) return;

    setErrorMsg(null);
    try {
      await eventService.deleteInvitation(eventId, invitationId);
      if (isMountedRef.current) {
        setActionSuccessMsg('招待リンクを取り消しました。');
      }
      fetchCollaborators();
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : '招待リンクの取り消しに失敗しました。');
      }
    }
  };

  // 共同編集者除名
  const handleRemoveEditor = async (userId: string, name: string) => {
    const ok = window.confirm(`「${name}」を共同編集者から除名しますか？`);
    if (!ok) return;

    setErrorMsg(null);
    try {
      await eventService.removeEditor(eventId, userId);
      if (isMountedRef.current) {
        setActionSuccessMsg(`「${name}」を除名しました。`);
      }
      fetchCollaborators();
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : '共同編集者の除名に失敗しました。');
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="collaborator-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-xl p-5 sm:p-6 transition-all max-h-[90vh] overflow-y-auto space-y-5 ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-neutral-100'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b pb-4 border-inherit">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 id="collaborator-modal-title" className="text-base sm:text-lg font-semibold tracking-tight">
                共同編集者・スタッフ招待
              </h3>
              <p className="text-xs text-neutral-400 truncate max-w-xs">{eventTitle}</p>
            </div>
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
          <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* 招待リンク発行フォーム（オーナーまたは管理者） */}
        {isOwner && (
          <div className={`p-4 rounded-xl border space-y-3 ${isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-200 bg-neutral-50'}`}>
            <span className="text-xs font-semibold flex items-center gap-1.5 text-indigo-400">
              <UserPlus className="w-4 h-4" />
              新しい招待リンクを発行する
            </span>
            <form onSubmit={handleCreateInvitation} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    有効期間
                  </label>
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(parseInt(e.target.value, 10))}
                    className={`w-full p-2 rounded-lg text-xs border focus:outline-hidden ${
                      isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
                    }`}
                  >
                    <option value={24}>24時間 (1日)</option>
                    <option value={72}>72時間 (3日)</option>
                    <option value={168}>168時間 (7日間・推奨)</option>
                    <option value={720}>720時間 (30日間)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    メモ（任意）
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    placeholder="例: 受付スタッフ班向け"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={`w-full p-2 rounded-lg text-xs border focus:outline-hidden ${
                      isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingInvite}
                className="w-full min-h-[40px] py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isCreatingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>招待リンクを発行してコピー</span>
              </button>
            </form>
          </div>
        )}

        {/* 共同編集者一覧 */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold tracking-tight text-neutral-400 uppercase">
            共同編集者 ({data?.editors.length || 0})
          </h4>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1a73e8]" />
              <span>読み込み中...</span>
            </div>
          ) : !data || data.editors.length === 0 ? (
            <div className="py-4 text-center text-xs text-neutral-400 border border-dashed rounded-xl border-neutral-800">
              まだ共同編集者はいません。
            </div>
          ) : (
            <div className="space-y-2">
              {data.editors.map((ed) => (
                <div
                  key={ed.user_id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isDarkMode ? 'border-neutral-800/80 bg-neutral-900/40' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold truncate">{ed.display_name || ed.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Editor
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate">
                      {ed.university || '所属未設定'}
                    </p>
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEditor(ed.user_id, ed.display_name || ed.name)}
                      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                      title="除名する"
                      aria-label="除名する"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 有効な招待状一覧 */}
        {data && data.active_invitations && data.active_invitations.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-inherit">
            <h4 className="text-xs font-semibold tracking-tight text-neutral-400 uppercase">
              発行中の招待リンク ({data.active_invitations.length})
            </h4>

            <div className="space-y-2">
              {data.active_invitations.map((inv) => (
                <div
                  key={inv.invitation_id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                    isDarkMode ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-200 bg-neutral-50'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs font-medium truncate">
                        有効期限: {new Date(inv.expires_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {inv.note && <p className="text-[11px] text-neutral-400 truncate">{inv.note}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyInviteLink(inv.token)}
                      className="px-2.5 py-1.5 min-h-[40px] rounded-lg text-xs font-medium border border-neutral-700 hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1"
                      title="招待リンクをコピー"
                    >
                      {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken === inv.token ? 'コピー済み' : 'コピー'}</span>
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteInvitation(inv.invitation_id)}
                        className="p-1.5 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="招待を取り消す"
                        aria-label="招待を取り消す"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
