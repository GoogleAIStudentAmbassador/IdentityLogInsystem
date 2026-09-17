import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { MoffyAuthClient } from './utils/oauthClient';
import type { AuthUser } from './utils/oauthClient';
import type { UserMoffySession } from './types';
import { PassportTab } from './components/home/PassportTab';
import { MoffyDexTab } from './components/home/MoffyDexTab';
import { FriendExchangeTab } from './components/home/FriendExchangeTab';
import { ProfileTab } from './components/home/ProfileTab';
import { FriendsTab } from './components/home/FriendsTab';
import { FloatingBottomNav } from './components/home/FloatingBottomNav';
import type { MainTab } from './components/home/FloatingBottomNav';
import { getFriendList } from './services/api';
import type { FriendItem } from './types';

const USER_STORAGE_PREFIX = 'moffy_user_session_';
const THEME_STORAGE_KEY = 'moffy_theme_mode';

function loadLatestUserSession(discordUserId?: string): UserMoffySession | null {
  try {
    if (discordUserId) {
      const target = localStorage.getItem(`${USER_STORAGE_PREFIX}${discordUserId}`);
      if (target) return JSON.parse(target);
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(USER_STORAGE_PREFIX)) {
        const val = localStorage.getItem(key);
        if (val) return JSON.parse(val);
      }
    }
  } catch (e) {
    console.warn('Failed to load user session in HomeApp:', e);
  }
  return null;
}

export const HomeApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as MainTab;
      if (tabParam && ['home', 'dex', 'exchange', 'profile', 'friends'].includes(tabParam)) {
        return tabParam;
      }
      const hash = window.location.hash.replace('#', '') as MainTab;
      if (hash && ['home', 'dex', 'exchange', 'profile', 'friends'].includes(hash)) {
        return hash;
      }
    }
    return 'home';
  });
  const [friends, setFriends] = useState<FriendItem[]>([]);

  // テーマモード: localStorageに保存されている値、またはデフォルトでナイトモード(true)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light') return false;
      if (savedTheme === 'dark') return true;
    } catch {
      // ignore
    }
    return true;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const authClient = useMemo(() => {
    const client = new MoffyAuthClient({
      clientId: 'moffy-community-home',
    });
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      client.handleCallback();
    }
    return client;
  }, []);

  const [user, setUser] = useState<AuthUser | null>(() => authClient.getUser());
  const [session, setSession] = useState<UserMoffySession | null>(() => {
    const authUser = authClient.getUser();
    return loadLatestUserSession(authUser?.discord_user_id);
  });

  // 🌟 認証ガード: 未ログイン状態の場合は即座に OAuth ハブへリダイレクト
  useEffect(() => {
    if (!authClient.isAuthenticated()) {
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        console.error('[HomeApp Auth Guard] Callback token invalid. Stopping redirect loop.');
        return;
      }
      console.log('[HomeApp Auth Guard] Unauthenticated access detected. Redirecting to OAuth hub...');
      authClient.login();
      return;
    }

    const authUser = authClient.getUser();
    if (!authUser || !authUser.discord_user_id) {
      console.log('[HomeApp Auth Guard] No valid user found. Redirecting to OAuth hub...');
      authClient.login();
      return;
    }
  }, [authClient]);

  const discordUserId = user?.discord_user_id || session?.discordUserId || '';

  // フレンド一覧の取得（図鑑の解放状況・フレンドタブで共用）
  useEffect(() => {
    if (!discordUserId) return;
    let isMounted = true;

    getFriendList(discordUserId)
      .then((list) => {
        if (isMounted && list) {
          setFriends(list);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch friend list in HomeApp:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [discordUserId]);

  const [preferredStyle, setPreferredStyle] = useState<'normal' | 'equipped'>(() => {
    try {
      const saved = localStorage.getItem('moffy_preferred_style');
      if (saved === 'normal' || saved === 'equipped') return saved;
    } catch {
      // ignore
    }
    return 'equipped';
  });

  const handleStyleChange = useCallback((style: 'normal' | 'equipped') => {
    setPreferredStyle(style);
    setSession((prev) => (prev ? { ...prev, preferredStyle: style } : null));
  }, []);

  const handleUpdateSession = useCallback((updatedSession: UserMoffySession) => {
    setSession(updatedSession);
    setUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        name: updatedSession.name ?? prev.name,
        last_name: updatedSession.lastName ?? prev.last_name,
        first_name: updatedSession.firstName ?? prev.first_name,
        nickname: updatedSession.nickname ?? prev.nickname,
        university: updatedSession.university ?? prev.university,
        grade: updatedSession.grade ?? prev.grade,
      };
    });
  }, []);

  const handleBackToQuiz = () => {
    window.location.href = './index.html';
  };

  const handleLogout = () => {
    authClient.logout();
    window.location.href = './oauth.html';
  };

  const avatarUrl =
    session?.arrangedPhotoUrl ||
    session?.defaultPhotoUrl ||
    user?.arranged_photo_url ||
    user?.photo_url ||
    null;

  if (!authClient.isAuthenticated() && !(typeof window !== 'undefined' && window.location.hash.includes('access_token'))) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 select-none ${
        isDarkMode ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'
      }`}>
        <Loader2 className="w-8 h-8 text-[#4285f4] animate-spin mb-3" />
        <p className="text-sm font-medium tracking-wide opacity-80">認証状態を確認中...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isDarkMode
          ? 'bg-neutral-950 text-neutral-100 selection:bg-neutral-800 selection:text-neutral-200'
          : 'bg-neutral-50 text-neutral-900 selection:bg-neutral-200 selection:text-neutral-800'
      }`}
    >
      {/* スマホ向けヘッダー */}
      <header
        className={`border-b backdrop-blur sticky top-0 z-30 px-4 py-3 transition-colors ${
          isDarkMode
            ? 'border-neutral-900 bg-neutral-950/85'
            : 'border-neutral-200 bg-white/85 shadow-xs'
        }`}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* 左上: ナイトモード/ライトモード切替ボタン */}
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'ライトモードに切り替え' : 'ナイトモードに切り替え'}
            className={`min-h-[40px] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition cursor-pointer border ${
              isDarkMode
                ? 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:text-white hover:bg-neutral-800'
                : 'border-neutral-200 bg-neutral-100/80 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200'
            }`}
            aria-label={isDarkMode ? 'ライトモードに切り替え' : 'ナイトモードに切り替え'}
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium">ナイト</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-medium">ライト</span>
              </>
            )}
          </button>

          {/* 右側: アプリ名 ＆ ポータルバッジ */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1a73e8]" />
            <span className="text-xs font-semibold tracking-tight">
              Google AI Ambassador
            </span>
            <span
              className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded ${
                isDarkMode
                  ? 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                  : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
              }`}
            >
              Hub
            </span>
          </div>
        </div>
      </header>

      {/* スマホ最適化メインコンテンツ (max-w-md & 下部セレクトバー余白 pb-28) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-5 pb-28">
        {activeTab === 'home' && (
          <PassportTab
            user={user}
            session={session}
            isDarkMode={isDarkMode}
            onStyleChange={handleStyleChange}
          />
        )}
        {activeTab === 'dex' && (
          <MoffyDexTab
            user={user}
            session={session}
            friends={friends}
            isDarkMode={isDarkMode}
            onGoToExchange={() => setActiveTab('exchange')}
          />
        )}
        {activeTab === 'exchange' && (
          <FriendExchangeTab
            user={user}
            session={session}
            isDarkMode={isDarkMode}
            preferredStyle={preferredStyle}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            session={session}
            onLogout={handleLogout}
            onBackToQuiz={handleBackToQuiz}
            isDarkMode={isDarkMode}
            onUpdateSession={handleUpdateSession}
          />
        )}
        {activeTab === 'friends' && (
          <FriendsTab
            user={user}
            session={session}
            isDarkMode={isDarkMode}
            friends={friends}
            onGoToExchange={() => setActiveTab('exchange')}
            onGoToDex={() => setActiveTab('dex')}
          />
        )}
      </main>

      {/* 画面下部カプセル型セレクトバー（ホーム & プロフィール） */}
      <FloatingBottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        avatarUrl={avatarUrl}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default HomeApp;
