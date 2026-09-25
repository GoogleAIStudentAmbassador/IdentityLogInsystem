import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { MoffyAuthClient } from './utils/oauthClient';
import type { AuthUser } from './utils/oauthClient';
import type { UserMoffySession, MoffyIconStyle, FriendItem } from './types';
import { PassportTab } from './components/home/PassportTab';
import { MoffyDexTab } from './components/home/MoffyDexTab';
import { FriendExchangeTab } from './components/home/FriendExchangeTab';
import { ProfileTab } from './components/home/ProfileTab';
import { FriendsTab } from './components/home/FriendsTab';
import { FloatingBottomNav } from './components/home/FloatingBottomNav';
import type { MainTab } from './components/home/FloatingBottomNav';
import { getFriendList, getTutorialStatus, saveTutorialCompleted, getPublicProfile, getMoffyQuizData } from './services/api';
import { getDiscordAvatarUrl, fetchDiscordAvatarBlobUrl } from './services/discordApi';
import { TUTORIAL_STEPS } from './types';
import { TutorialOverlay } from './components/home/TutorialOverlay';

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

  // 🌟 初回起動インタラクティブ・チュートリアル管理ステート
  const [isTutorialActive, setIsTutorialActive] = useState<boolean>(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState<number>(1);

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

  // 🌟 DB上の回答データ存在フラグ（画像未生成でも再生成可能とするため）
  const [hasDbQuizData, setHasDbQuizData] = useState<boolean>(false);

  // 🌟 アバター画像（Discord/Googleアイコン）の誤判定除外関数
  const isAvatarUrl = useCallback((url?: string | null): boolean => {
    if (!url) return false;
    if (user?.photo_url && url === user.photo_url) return true;
    return false;
  }, [user?.photo_url]);

  // 🌟 性格診断受講・モッフィー作成済み判定（アバター誤爆を除外しDB回答データも包含）
  const validDefaultPhoto = (!isAvatarUrl(session?.defaultPhotoUrl) ? session?.defaultPhotoUrl : null) ||
                            (!isAvatarUrl(user?.default_photo_url) ? user?.default_photo_url : null);
  const hasMoffy = Boolean(
    hasDbQuizData ||
    session?.mbti ||
    user?.mbti ||
    validDefaultPhoto ||
    session?.arrangedPhotoUrl ||
    user?.arranged_photo_url
  );

  // 🌟 DBを真実の源泉（Single Source of Truth）としてプロフィールおよび画像状態を最新同期
  useEffect(() => {
    if (!discordUserId || discordUserId === 'Ambassador') return;
    let isMounted = true;

    // 1. 最新のDBプロフィールを取得し、画像の存在状況を厳格に同期
    getPublicProfile(discordUserId)
      .then((dbProfile) => {
        if (!isMounted || !dbProfile) return;

        const dbDefault = dbProfile.default_photo_url || null;
        const dbArranged = dbProfile.arranged_photo_url || null;

        // DB側で画像が検出されない場合、ローカルストレージに残った古いキャッシュを物理的にパージ
        setSession((prev) => {
          if (!prev) return prev;
          if (prev.defaultPhotoUrl === dbDefault && prev.arrangedPhotoUrl === dbArranged) {
            return prev;
          }
          const updated = {
            ...prev,
            defaultPhotoUrl: dbDefault,
            arrangedPhotoUrl: dbArranged,
          };
          try {
            localStorage.setItem(`moffy_user_session_${discordUserId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setUser((prev) => {
          if (!prev) return prev;
          if (prev.default_photo_url === dbDefault && prev.arranged_photo_url === dbArranged) {
            return prev;
          }
          return {
            ...prev,
            default_photo_url: dbDefault,
            arranged_photo_url: dbArranged,
          };
        });
      })
      .catch((err) => {
        console.warn('[HomeApp] Failed to sync profile with DB:', err);
      });

    // 2. DB上に過去の回答データが存在するか確認
    getMoffyQuizData(discordUserId)
      .then((quizData) => {
        if (isMounted && quizData && quizData.answers && Object.keys(quizData.answers).length > 0) {
          setHasDbQuizData(true);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [discordUserId]);

  // 🌟 Discord プロフィール画像 (Blob URL 自動取得・キャッシュ)
  const [discordAvatarUrl, setDiscordAvatarUrl] = useState<string>(() => getDiscordAvatarUrl(discordUserId, 128));

  useEffect(() => {
    if (!discordUserId || discordUserId === 'Ambassador') return;
    let isMounted = true;

    fetchDiscordAvatarBlobUrl(discordUserId)
      .then((blobUrl) => {
        if (isMounted && blobUrl) {
          setDiscordAvatarUrl(blobUrl);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [discordUserId]);

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

  // 🌟 初回起動フラグ（チュートリアル完了状態）の判定と同期
  useEffect(() => {
    if (!discordUserId) return;
    let isMounted = true;

    // 1. ローカルキャッシュのチェック（すでに完了済みの場合は通信を待たずに終了）
    try {
      const localKey = `moffy_game_progress_moffy_tutorial_state_${discordUserId}`;
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.tutorialCompleted) {
          return;
        }
      }
    } catch {
      // ignore
    }

    // 2. クラウドDBから初回起動フラグを取得（非同期コールバック内でsetState）
    getTutorialStatus(discordUserId)
      .then((status) => {
        if (!isMounted) return;
        // モッフィー未作成時は、ホーム画面の「チュートリアル：性格診断を受ける」を最優先とし、操作チュートリアルオーバーレイは起動しない
        if (!hasMoffy) {
          setIsTutorialActive(false);
          return;
        }
        if (!status || !status.tutorialCompleted) {
          // 初回起動！チュートリアルを開始
          setIsTutorialActive(true);
          setCurrentTutorialStep(1);
          setActiveTab('home');
        } else {
          setIsTutorialActive(false);
        }
      })
      .catch((err) => {
        console.warn('[HomeApp] Failed to check tutorial status:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [discordUserId, hasMoffy]);

  const [preferredStyle, setPreferredStyle] = useState<MoffyIconStyle>(() => {
    try {
      const saved = localStorage.getItem('moffy_preferred_style');
      if (saved === 'normal' || saved === 'equipped' || saved === 'discord') {
        return saved as MoffyIconStyle;
      }
    } catch {
      // ignore
    }
    return 'equipped';
  });

  const handleStyleChange = useCallback((style: MoffyIconStyle) => {
    setPreferredStyle(style);
    setSession((prev) => (prev ? { ...prev, preferredStyle: style } : null));
  }, []);

  // チュートリアル: 次ステップへの進行（fromStepガード付きで二重進行を完全に防止）
  const handleNextTutorialStep = useCallback((fromStep: number) => {
    setCurrentTutorialStep((prev) => {
      // 既に進んでいる場合は二重進行を完全にブロック
      if (prev !== fromStep) return prev;

      const next = prev + 1;
      if (next > TUTORIAL_STEPS.length) {
        // チュートリアル完了！DBにフラグを永続化
        setIsTutorialActive(false);
        if (discordUserId) {
          saveTutorialCompleted(discordUserId, true).catch((err) => {
            console.warn('[HomeApp] Failed to save tutorial completed state:', err);
          });
        }
        return 1;
      }

      // 次ステップで特定のタブが要求されている場合は自動で切り替え
      const nextConfig = TUTORIAL_STEPS[next - 1];
      if (nextConfig && nextConfig.tabRequirement) {
        setActiveTab(nextConfig.tabRequirement);
      }

      return next;
    });
  }, [discordUserId]);

  // チュートリアル: スキップ
  const handleSkipTutorial = useCallback(() => {
    setIsTutorialActive(false);
    if (discordUserId) {
      saveTutorialCompleted(discordUserId, true).catch((err) => {
        console.warn('[HomeApp] Failed to save tutorial skip state:', err);
      });
    }
  }, [discordUserId]);

  // チュートリアル: 再開（ProfileTabから呼び出し可能）
  const handleRestartTutorial = useCallback(() => {
    setActiveTab('home');
    setCurrentTutorialStep(1);
    setIsTutorialActive(true);
  }, []);

  // タブ切り替え（TutorialOverlayのクリック検知と競合しないよう純粋なタブ更新に一元化）
  const handleTabChange = useCallback((tab: MainTab) => {
    setActiveTab(tab);
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
    window.location.href = './index.html?retake=true';
  };

  const handleLogout = () => {
    authClient.logout();
    window.location.href = './oauth.html';
  };

  // 🌟 下部ナビゲーションのプロフィールアイコン（未診断時はDiscord、診断済み時はpreferredStyleに連動）
  const avatarUrl = (() => {
    if (!hasMoffy) {
      return discordAvatarUrl || null;
    }
    if (preferredStyle === 'discord') {
      return discordAvatarUrl || null;
    }
    if (preferredStyle === 'normal') {
      return session?.defaultPhotoUrl || user?.default_photo_url || null;
    }
    // 'equipped'
    return (
      session?.arrangedPhotoUrl ||
      user?.arranged_photo_url ||
      session?.defaultPhotoUrl ||
      user?.default_photo_url ||
      null
    );
  })();

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
            preferredStyle={preferredStyle}
            discordAvatarUrl={discordAvatarUrl}
            hasDbQuizData={hasDbQuizData}
            onStyleChange={handleStyleChange}
            onGoToProfile={() => setActiveTab('profile')}
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
            discordAvatarUrl={discordAvatarUrl}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            session={session}
            onLogout={handleLogout}
            onBackToQuiz={handleBackToQuiz}
            isDarkMode={isDarkMode}
            preferredStyle={preferredStyle}
            discordAvatarUrl={discordAvatarUrl}
            onUpdateSession={handleUpdateSession}
            onRestartTutorial={handleRestartTutorial}
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
        onChangeTab={handleTabChange}
        avatarUrl={avatarUrl}
        isDarkMode={isDarkMode}
      />

      {/* 🌟 初回起動インタラクティブ・チュートリアルオーバーレイ（モッフィー作成済みユーザーのみ） */}
      {hasMoffy && isTutorialActive && (
        <TutorialOverlay
          currentStep={currentTutorialStep}
          onNextStep={handleNextTutorialStep}
          onSkip={handleSkipTutorial}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

export default HomeApp;
