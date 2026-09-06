import React from 'react';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  apiStatus: {
    authenticated: boolean;
    name: string;
    canCreate: boolean;
  } | null;
  isDark?: boolean;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ apiStatus, isDark = false, onLogout }) => {
  return (
    <header className={`w-full sticky top-0 z-40 transition-colors duration-700 ${
      isDark ? 'bg-transparent border-transparent' : 'bg-white/90 backdrop-blur-sm border-b border-gray-100'
    }`}>
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* 左側：性格診断中のログアウトボタン */}
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
              isDark
                ? 'border-white/15 bg-white/10 text-neutral-200 hover:bg-white/20 hover:text-white'
                : 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900'
            }`}
            title="途中経過を保存してログアウト"
            aria-label="ログアウト"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ログアウト</span>
          </button>
        ) : (
          <div className="w-6 h-6" />
        )}

        {/* 右側：認知負荷のない極小ステータス */}
        <div className="flex items-center">
          {apiStatus?.authenticated && apiStatus.canCreate ? (
            <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all duration-700 ${
              isDark 
                ? 'text-gray-300 bg-white/5 border-white/10' 
                : 'text-gray-500 bg-gray-50 border-gray-200/60'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span className="font-medium truncate max-w-[120px]">{apiStatus.name || 'Connected'}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-[11px] transition-colors duration-700 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></span>
              <span>Ready</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

