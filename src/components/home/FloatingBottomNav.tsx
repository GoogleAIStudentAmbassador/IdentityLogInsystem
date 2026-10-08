import React from 'react';
import { Home, User, Users, BookOpen } from 'lucide-react';

export type MainTab = 'home' | 'dex' | 'events' | 'exchange' | 'profile' | 'friends';

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
    <div className="fixed bottom-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] inset-x-0 mx-auto w-fit z-40 flex justify-center pointer-events-none px-2 sm:px-4">
      <nav
        aria-label="Navigation Select Bar"
        className={`pointer-events-auto rounded-full p-1 sm:p-1.5 flex items-center gap-1 sm:gap-1.5 transition-all shadow-[0_12px_36px_rgba(0,0,0,0.25)] border backdrop-blur-md ${
          isDarkMode
            ? 'bg-neutral-900/95 border-neutral-800 text-neutral-100'
            : 'bg-white/95 border-neutral-200 text-neutral-900'
        }`}
      >
        {/* 1. ホーム（アイコンのみ: □） */}
        <button
          onClick={() => onChangeTab('home')}
          className={`relative w-11 h-11 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'home'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/20'
                : 'bg-neutral-100 text-neutral-900 shadow-sm ring-1 ring-neutral-300'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
          }`}
          aria-label="ホーム"
          title="ホーム"
        >
          <Home className="w-5 h-5 fill-current" />
        </button>

        {/* 2. モッフィー図鑑（アイコンのみ: □） */}
        <button
          onClick={() => onChangeTab('dex')}
          className={`relative w-11 h-11 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'dex'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/20'
                : 'bg-neutral-100 text-neutral-900 shadow-sm ring-1 ring-neutral-300'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
          }`}
          aria-label="モッフィー図鑑"
          title="モッフィー図鑑"
        >
          <BookOpen className="w-5 h-5" />
        </button>

        {/* 3. QRコード・フレンド交換（中央・他より少し大きく強調表示: 〇） */}
        <button
          data-tutorial-id="tutorial-nav-exchange"
          onClick={() => onChangeTab('exchange')}
          className={`relative w-14 h-14 sm:w-16 sm:h-16 -my-1.5 sm:-my-2 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 border shadow-md active:scale-95 ${
            activeTab === 'exchange'
              ? isDarkMode
                ? 'bg-neutral-800 border-neutral-600 text-white ring-2 ring-white/25 shadow-lg'
                : 'bg-neutral-100 border-neutral-300 text-neutral-900 ring-2 ring-neutral-400/50 shadow-lg'
              : isDarkMode
                ? 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:border-neutral-600'
                : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
          }`}
          aria-label="QRコード・フレンド交換"
          title="QRコード・フレンド交換"
        >
          {/* 公式アンバサダーシンボル（Gemini星＋学帽） */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 overflow-hidden flex items-center justify-center shrink-0">
            <img
              src="./ambassador-symbol.jpg"
              alt="Friend Exchange"
              className={`w-full h-full object-contain ${
                isDarkMode ? 'invert mix-blend-screen brightness-125' : 'mix-blend-multiply'
              }`}
            />
          </div>
        </button>

        {/* 4. プロフィール（アイコンのみ: □） */}
        <button
          data-tutorial-id="tutorial-nav-profile"
          onClick={() => onChangeTab('profile')}
          className={`relative w-11 h-11 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'profile'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/20'
                : 'bg-neutral-100 text-neutral-900 shadow-sm ring-1 ring-neutral-300'
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

        {/* 5. フレンド一覧（プロフィールの右隣・フレンドロゴ Users・アイコンのみ: □） */}
        <button
          onClick={() => onChangeTab('friends')}
          className={`relative w-11 h-11 sm:w-12 sm:h-12 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            activeTab === 'friends'
              ? isDarkMode
                ? 'bg-neutral-800 text-white shadow-sm ring-1 ring-white/20'
                : 'bg-neutral-100 text-neutral-900 shadow-sm ring-1 ring-neutral-300'
              : isDarkMode
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60'
          }`}
          aria-label="フレンド一覧"
          title="フレンド一覧"
        >
          <Users className="w-5 h-5" />
        </button>
      </nav>
    </div>
  );
};

