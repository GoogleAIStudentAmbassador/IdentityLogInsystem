import React from 'react';
import { Home, User } from 'lucide-react';

export type MainTab = 'home' | 'exchange' | 'profile';

interface FloatingBottomNavProps {
  activeTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
  avatarUrl?: string | null;
  isDarkMode: boolean;
}

export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = ({
  activeTab,
  onChangeTab,
  avatarUrl,
  isDarkMode,
}) => {
  return (
    <div className="fixed bottom-5 inset-x-0 mx-auto w-fit z-40 flex justify-center pointer-events-none px-4">
      <nav
        aria-label="Navigation Select Bar"
        className={`pointer-events-auto rounded-full p-1.5 flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_12px_36px_rgba(0,0,0,0.25)] border backdrop-blur-md ${
          isDarkMode
            ? 'bg-neutral-900/90 border-neutral-800 text-neutral-100'
            : 'bg-white/90 border-neutral-200 text-neutral-900'
        }`}
      >
        {/* 1. ホーム（アイコンのみ） */}
        <button
          onClick={() => onChangeTab('home')}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'home'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-900 shadow-xs'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
          }`}
          aria-label="ホーム"
          title="ホーム"
        >
          <Home className="w-5 h-5 fill-current" />
        </button>

        {/* 2. フレンド交換（真ん中・Google AI Ambassadorシンボル・アイコンのみ） */}
        <button
          onClick={() => onChangeTab('exchange')}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'exchange'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-900 shadow-xs'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
          }`}
          aria-label="フレンド交換"
          title="フレンド交換"
        >
          {/* 公式アンバサダーシンボル（Gemini星＋学帽） */}
          <div className="w-6 h-6 overflow-hidden flex items-center justify-center shrink-0">
            <img
              src="./ambassador-symbol.jpg"
              alt="Friend Exchange"
              className={`w-full h-full object-contain ${
                isDarkMode ? 'invert mix-blend-screen brightness-125' : 'mix-blend-multiply'
              }`}
            />
          </div>
        </button>

        {/* 3. プロフィール（アイコンのみ） */}
        <button
          onClick={() => onChangeTab('profile')}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'profile'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-900 shadow-xs'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
          }`}
          aria-label="プロフィール"
          title="プロフィール"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-200 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
            )}
          </div>
        </button>
      </nav>
    </div>
  );
};

