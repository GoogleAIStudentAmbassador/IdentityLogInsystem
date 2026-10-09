import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Camera, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Sparkles, User, Keyboard } from 'lucide-react';
import { QrScannerEngine } from '../../utils/qrScanner';
import { audioFeedback } from '../../utils/audioFeedback';
import { eventService } from '../../services/eventService';
import { extractAttendeeIdFromQr } from '../../utils/qrUtils';
import type { EventItem, CheckinResponse } from '../../types';

interface EventScannerModalProps {
  event: EventItem;
  isOpen: boolean;
  onClose: () => void;
  onCheckinSuccess: (response: CheckinResponse) => void;
  isDarkMode: boolean;
}

export const EventScannerModal: React.FC<EventScannerModalProps> = ({
  event,
  isOpen,
  onClose,
  onCheckinSuccess,
  isDarkMode,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScannerEngine | null>(null);
  const isMountedRef = useRef(true);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const facingModeRef = useRef<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [lastCheckin, setLastCheckin] = useState<CheckinResponse | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [activeStrategyName, setActiveStrategyName] = useState<string>('QR Scanner');

  // 手動ID入力モード用
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');

  // マウントライフサイクル管理
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  // ESC キー押下でモーダルを安全に閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // スキャナーインスタンスの初期化
  useEffect(() => {
    if (!scannerRef.current) {
      const engine = new QrScannerEngine();
      engine.setDebounceMs(1500);
      scannerRef.current = engine;
      setActiveStrategyName(engine.getActiveStrategyName());
    }
  }, []);

  const handleQrDetected = useCallback(
    async (rawPayload: string) => {
      if (isProcessingRef.current || !isMountedRef.current) return;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setScanMessage('チェックイン照合中...');

      // 1. セキュリティサニタイザー直結（XSS・パストラバーサル・生データインジェクション遮断）
      const sanitizedId = extractAttendeeIdFromQr(rawPayload);
      if (!sanitizedId) {
        audioFeedback.playErrorSound();
        if (isMountedRef.current) {
          setScanMessage('❌ 無効なQRコード形式です（参加者IDが検出できません）');
        }
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            isProcessingRef.current = false;
            setIsProcessing(false);
            if (scannerRef.current) {
              scannerRef.current.resetCooldown();
            }
          }
        }, 1200);
        return;
      }

      try {
        const res = await eventService.checkinAttendee(event.event_id, sanitizedId, 'QRカメラ受付');
        if (!isMountedRef.current) return;

        if (res.already_checked_in) {
          audioFeedback.playWarningSound();
          setScanMessage(`⚠️ 既にチェックイン済みです（${res.attendee.name} 様）`);
        } else {
          audioFeedback.playSuccessSound();
          setScanMessage(`✅ チェックイン完了！ (${res.attendee.name} 様)`);
        }

        setLastCheckin(res);
        onCheckinSuccess(res);
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        audioFeedback.playErrorSound();
        const msg = err instanceof Error ? err.message : 'QRコードの解析または通信に失敗しました。';
        setScanMessage(`❌ エラー: ${msg}`);
      } finally {
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            isProcessingRef.current = false;
            setIsProcessing(false);
            if (scannerRef.current) {
              scannerRef.current.resetCooldown();
            }
          }
        }, 1200);
      }
    },
    [event.event_id, onCheckinSuccess]
  );

  const startCamera = useCallback(async (mode?: 'environment' | 'user') => {
    setCameraError(null);
    if (!videoRef.current || !scannerRef.current) {
      setIsSwitchingCamera(false);
      return;
    }

    const currentMode = mode || facingModeRef.current;

    try {
      await scannerRef.current.start(
        videoRef.current,
        (result) => {
          if (isMountedRef.current) {
            handleQrDetected(result.data);
          }
        },
        currentMode
      );
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'カメラへのアクセスが拒否されたか、利用可能なカメラが見つかりません。';
      setCameraError(msg);
    } finally {
      if (isMountedRef.current) {
        setIsSwitchingCamera(false);
      }
    }
  }, [handleQrDetected]);

  // モーダル開閉管理（カメラ切替時は割り込ませず、isOpen のみ監視）
  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      setLastCheckin(null);
      setScanMessage(null);
      setCameraError(null);
      return;
    }

    // iOS WebKit User Activation Policy 先行アンロック
    audioFeedback.unlock();
    startCamera(facingModeRef.current);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
      }
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [isOpen, startCamera]);

  // 画面復帰ハンドラ（visibilitychange によるバックグラウンド停止 & フォアグラウンド自動再開）
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (scannerRef.current) {
          scannerRef.current.stop();
        }
      } else if (document.visibilityState === 'visible') {
        if (isMountedRef.current) {
          startCamera(facingModeRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, startCamera]);

  // カメラ切り替え（直列制御。useEffect に割り込ませず二重発火を物理根絶）
  const toggleFacingMode = useCallback(async () => {
    if (!isOpen || isSwitchingCamera || isProcessingRef.current) return;
    audioFeedback.unlock();
    setIsSwitchingCamera(true);

    if (scannerRef.current) {
      scannerRef.current.stop();
    }

    // iOS AVFoundation 解放ラグ待機 (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!isMountedRef.current || !isOpen) return;

    const nextMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    facingModeRef.current = nextMode;
    setFacingMode(nextMode);
    await startCamera(nextMode);
  }, [isOpen, isSwitchingCamera, startCamera]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    audioFeedback.unlock();
    const trimmed = manualId.trim();
    if (!trimmed) return;

    const sanitized = extractAttendeeIdFromQr(trimmed);
    if (!sanitized) {
      audioFeedback.playErrorSound();
      setScanMessage('❌ 不正な参加者ID形式です（半角英数字・記号のみ）');
      return;
    }

    await handleQrDetected(sanitized);
    if (isMountedRef.current) {
      setManualId('');
      setShowManualInput(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border flex flex-col max-h-[92vh] ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-white'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Camera className="w-3.5 h-3.5 animate-pulse" /> 受付カメラ稼働中
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {activeStrategyName}
              </span>
            </div>
            <h3 className="font-bold text-base sm:text-lg mt-0.5 line-clamp-1">{event.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-800/60 transition-colors cursor-pointer text-neutral-400 hover:text-white"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* カメラビュー & スキャンエリア */}
        <div className="relative aspect-square sm:aspect-[4/3] w-full bg-black overflow-hidden flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm">
              <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
              <p className="text-sm text-neutral-200 font-medium mb-4">{cameraError}</p>
              <button
                onClick={() => setShowManualInput(true)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-xl border border-neutral-700"
              >
                手動ID入力へ切り替え
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* 照準ガイドフレーム */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* 四隅のアクセントコーナー */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* スキャンレーザーアニメーション */}
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan shadow-[0_0_12px_#34d399]" />
                </div>
              </div>

              {/* カメラ切り替えボタン */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  onClick={toggleFacingMode}
                  disabled={isSwitchingCamera || isProcessing}
                  className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
                  title={facingMode === 'environment' ? 'インカメラに切り替え' : '背面カメラに切り替え'}
                >
                  <RefreshCw className={`w-4 h-4 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => {
                    audioFeedback.unlock();
                    setShowManualInput((prev) => !prev);
                  }}
                  className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
                  title="手動ID入力"
                >
                  <Keyboard className="w-4 h-4" />
                </button>
              </div>

              {/* 処理中オーバーレイ */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10 animate-fade-in">
                  <div className="text-center p-4">
                    <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-white text-xs font-semibold drop-shadow-md">受付照合中...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 手動入力モーダル（オーバーレイ） */}
        {showManualInput && (
          <form
            onSubmit={handleManualSubmit}
            className="p-4 bg-neutral-900/95 border-b border-neutral-800 animate-slide-down"
          >
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              参加者の Discord User ID または Google ID を直接入力:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="off"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="例: 123456789012345678"
                className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualId.trim() || isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                受付
              </button>
            </div>
          </form>
        )}

        {/* スキャン結果フィードバック */}
        <div className="p-4 overflow-y-auto flex-1">
          {scanMessage && (
            <div
              className={`mb-3 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                scanMessage.startsWith('✅')
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : scanMessage.startsWith('⚠️')
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              {scanMessage}
            </div>
          )}

          {lastCheckin ? (
            <div className="p-3.5 rounded-2xl bg-neutral-800/60 border border-neutral-700/60 animate-scale-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-neutral-400">直前の受付結果:</span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  現在 {lastCheckin.total_attendees} 名出席
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-700 shrink-0 border-2 border-emerald-500/40">
                  {lastCheckin.attendee.photo_url ? (
                    <img
                      src={lastCheckin.attendee.photo_url}
                      alt={lastCheckin.attendee.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  {lastCheckin.attendee.is_ambassador && (
                    <div className="absolute -bottom-1 -right-1 p-0.5 bg-neutral-900 rounded-full">
                      <ShieldCheck className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-white truncate">
                      {lastCheckin.attendee.name}
                    </h4>
                    {lastCheckin.attendee.is_ambassador && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        <Sparkles className="w-2.5 h-2.5" /> AMBASSADOR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 truncate">
                    {lastCheckin.attendee.university || '所属未設定'}
                  </p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    受付時刻: {new Date(lastCheckin.attendee.checked_in_at).toLocaleTimeString('ja-JP')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-neutral-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-neutral-500 opacity-60" />
              <p className="text-xs">参加者のペルソナ名刺QRコードをカメラ枠内にかざしてください。</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                連続スキャンに対応しています（スキャン完了後すぐに次を読み取れます）。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
