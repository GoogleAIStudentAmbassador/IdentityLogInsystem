import React, { useState, useEffect } from 'react';
import { X, ImageOff } from 'lucide-react';

interface DiscordUsernameHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Discord ユーザー名入力ガイドモーダル
 * 表示名（Display Name）とユーザー名（Username）の違いを画像とともに解説する
 * 規約: anti-ai-web-design (絵文字ゼロ、90/10カラー、低認知負荷)
 */
export const DiscordUsernameHelpModal: React.FC<DiscordUsernameHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [imgError, setImgError] = useState(false);

  // 🌟 批判検証是正 1: サブディレクトリ配備・GitHub Pages に対応したベースパス解決
  const guideImgSrc = `${(import.meta.env.BASE_URL || './').replace(/\/+$/, '')}/images/discord_username_guide.png`;

  // 🌟 批判検証是正 2: モーダル表示中の背景スクロールロック
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discord-username-help-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* 🌟 批判検証是正 3: 小画面端末 (iPhone SE等) やランドスケープ表示での縦はみ出し防止 */}
      <div
        className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-700 p-5 sm:p-6 shadow-xl text-neutral-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <h2
            id="discord-username-help-title"
            className="text-base font-semibold tracking-tight text-white"
          >
            Discord ユーザー名の確認方法
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ガイド画像 */}
        <div className="my-4 flex flex-col items-center shrink-0">
          <div className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 p-2 shadow-inner w-full flex items-center justify-center min-h-[160px]">
            {!imgError ? (
              <img
                src={guideImgSrc}
                alt="Discord プロフィール画面の見本"
                className="max-h-[200px] sm:max-h-[230px] w-auto object-contain rounded-lg"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-neutral-400 gap-2">
                <ImageOff className="w-8 h-8 text-neutral-500" />
                <p className="text-xs">ガイド画像の読み込みに失敗しました</p>
              </div>
            )}
          </div>
          <span className="mt-1.5 text-[11px] text-neutral-400">
            Discord プロフィール画面の見本
          </span>
        </div>

        {/* 解説テキスト */}
        <div className="space-y-2 text-xs leading-relaxed text-neutral-300">
          <p>
            Discord プロフィールに表示される太字の「表示名」（例: <strong className="text-white">Ayato</strong>）ではなく、その下に小さく表示されている<strong className="text-white">英数字のユーザー名</strong>（例: <span className="font-mono text-google-blue dark:text-google-blue font-semibold">ayato964</span>）を入力してください。
          </p>
          <p className="text-[11px] text-neutral-400">
            先頭の「@」記号は自動で処理されるため入力不要です。
          </p>
        </div>

        {/* フッター閉じるボタン */}
        <div className="mt-5 pt-3 border-t border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-neutral-100 text-neutral-900 hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
          >
            確認しました
          </button>
        </div>
      </div>
    </div>
  );
};
