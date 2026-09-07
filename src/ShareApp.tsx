import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  ExternalLink,
  CheckCircle2,
  Calendar,
  GraduationCap,
  Home,
  UserPlus,
} from 'lucide-react';
import type { MbtiType, SnsPlatform, SnsLinkItem, FriendItem } from './types';
import { MBTI_ARCHETYPES } from './data/personalityQuestions';
import { resolveSnsUrl } from './utils/snsUtils';
import { MoffyAuthClient } from './utils/oauthClient';
import { getPublicProfile, getGameProgress, addFriend, extractMbtiFromUrl } from './services/api';

const THEME_STORAGE_KEY = 'moffy_theme_mode';

export const ShareApp: React.FC = () => {
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

  // 表示ステップ: 'discover' (新しいアンバサダーを見つけたよ！！) -> 'profile' (相手の公開ページ)
  const [step, setStep] = useState<'discover' | 'profile'>('discover');

  // URLパラメータからのパース
  const queryParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const targetDiscordId = queryParams.get('id') || queryParams.get('discord_id') || 'Ambassador';
  const initialMbti = (queryParams.get('mbti') || 'INTJ').toUpperCase() as MbtiType;
  const initialNickname = queryParams.get('nick') || queryParams.get('nickname') || '';
  const initialName = queryParams.get('name') || '';
  const initialLastName = queryParams.get('last_name') || '';
  const initialFirstName = queryParams.get('first_name') || '';
  const initialUniv = queryParams.get('univ') || queryParams.get('university') || '';
  const initialGrade = queryParams.get('grade') || '';
  const initialPhoto = queryParams.get('photo') || queryParams.get('photo_url') || '';
  const initialBirthday = queryParams.get('bday') || '';
  const initialShowBirthday = queryParams.get('showBday') === '1';

  // プロフィールステート
  const [mbti, setMbti] = useState<MbtiType>(initialMbti);
  const [nickname, setNickname] = useState<string>(initialNickname);
  const [name, setName] = useState<string>(initialName);
  const [university, setUniversity] = useState<string>(initialUniv);
  const [grade, setGrade] = useState<string>(initialGrade);
  const [photoUrl, setPhotoUrl] = useState<string>(initialPhoto);
  const [birthday, setBirthday] = useState<string>(initialBirthday);
  const [showBirthday, setShowBirthday] = useState<boolean>(initialShowBirthday);
  const [snsLinks, setSnsLinks] = useState<SnsLinkItem[]>(() => {
    const rawSns = queryParams.get('sns');
    if (!rawSns) return [];
    try {
      const parsed = JSON.parse(rawSns);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          id: `sns_${idx}`,
          platform: (item.p || item.platform || 'website') as SnsPlatform,
          value: String(item.v || item.value || ''),
        }));
      }
    } catch {
      // ignore
    }
    return [];
  });

  // フレンド追加完了ステート
  const [friendAdded, setFriendAdded] = useState<boolean>(false);

  const authClient = useMemo(() => new MoffyAuthClient({ clientId: 'moffy-share' }), []);
  const currentUser = authClient.getUser();
  const currentUserId = currentUser?.discord_user_id || null;

  // 最新プロフィールおよび追加情報の非同期取得 ＆ 自動フレンド登録
  useEffect(() => {
    let isMounted = true;

    async function syncAndFriend() {
      if (!targetDiscordId || targetDiscordId === 'Ambassador') return;

      // 1. APIから最新プロフィール取得
      try {
        const publicProfile = await getPublicProfile(targetDiscordId);
        if (publicProfile && isMounted) {
          if (publicProfile.nickname) setNickname(publicProfile.nickname);
          if (publicProfile.name) setName(publicProfile.name);
          if (publicProfile.university) setUniversity(publicProfile.university);
          if (publicProfile.grade) setGrade(String(publicProfile.grade));

          const bestPhoto =
            publicProfile.arranged_photo_url ||
            publicProfile.default_photo_url ||
            publicProfile.photo_url;
          if (bestPhoto) {
            setPhotoUrl(bestPhoto);
            const extracted = extractMbtiFromUrl(bestPhoto);
            if (extracted) setMbti(extracted);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch public profile:', err);
      }

      // 2. クラウドDB (game_progress: moffy_profile_ext) から誕生日・SNS設定を取得
      try {
        const profileExt = await getGameProgress<any>('moffy_profile_ext', targetDiscordId);
        if (profileExt && isMounted) {
          if (profileExt.birthday) setBirthday(profileExt.birthday);
          if (typeof profileExt.showBirthday === 'boolean') setShowBirthday(profileExt.showBirthday);
          if (Array.isArray(profileExt.snsLinks) && profileExt.snsLinks.length > 0) {
            setSnsLinks(profileExt.snsLinks);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch profile ext:', err);
      }

      // 3. ログイン中の閲覧者がいる場合、DBにフレンド関係を自動永続化
      if (currentUserId && currentUserId !== targetDiscordId) {
        try {
          const hasNick = !!(nickname && nickname.trim());
          const friendPayload: FriendItem = {
            discord_user_id: targetDiscordId,
            name: hasNick ? null : (name || null),
            lastName: hasNick ? null : (initialLastName || null),
            firstName: hasNick ? null : (initialFirstName || null),
            nickname: nickname || null,
            mbti,
            photoUrl: photoUrl || null,
            university: university || null,
            grade: grade || null,
            birthday: birthday || null,
            showBirthday,
            snsLinks,
            addedAt: new Date().toISOString(),
          };

          const ok = await addFriend(currentUserId, friendPayload);
          if (ok && isMounted) {
            setFriendAdded(true);
          }
        } catch (e) {
          console.warn('Auto add friend failed:', e);
        }
      }
    }

    syncAndFriend();

    return () => {
      isMounted = false;
    };
  }, [targetDiscordId, currentUserId, name, nickname, mbti, photoUrl, university, grade, birthday, showBirthday, snsLinks, initialLastName, initialFirstName]);

  const archetype = MBTI_ARCHETYPES[mbti] || MBTI_ARCHETYPES.INTJ;
  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';

  const finalPhotoUrl =
    photoUrl ||
    (archetype.officialImageUrl
      ? archetype.officialImageUrl.startsWith('http')
        ? archetype.officialImageUrl
        : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
      : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`);

  // 表示名: ニックネームが設定されている場合は名前（本名）を一切出さず、ニックネームのみを表示
  const hasNickname = !!nickname.trim();
  const displayName = hasNickname
    ? nickname.trim()
    : name.trim() || [initialLastName, initialFirstName].filter(Boolean).join(' ') || `@${targetDiscordId}`;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 select-none ${
        isDarkMode
          ? 'bg-neutral-950 text-neutral-100 selection:bg-neutral-800'
          : 'bg-neutral-50 text-neutral-900 selection:bg-neutral-200'
      }`}
    >
      {/* 画面トップバー */}
      <header
        className={`sticky top-0 z-30 px-4 py-3 border-b backdrop-blur-md transition-colors ${
          isDarkMode ? 'border-neutral-900 bg-neutral-950/85' : 'border-neutral-200 bg-white/85 shadow-xs'
        }`}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-google-blue flex items-center justify-center text-white text-xs font-bold shadow-xs">
              G
            </div>
            <span className="text-xs font-semibold tracking-tight">Google AI Ambassador</span>
          </div>

          <button
            onClick={toggleTheme}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer border ${
              isDarkMode
                ? 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white'
                : 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:text-neutral-900'
            }`}
            aria-label="テーマ切替"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-neutral-600" />}
          </button>
        </div>
      </header>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        {step === 'discover' ? (
          // ======================================================================
          // ステップ 1: アニメーション演出（「新しいアンバサダーを見つけたよ！！」）
          // ======================================================================
          <div className="w-full flex flex-col items-center text-center animate-fade-in space-y-6 py-6">
            {/* Googleカラーのオーラバースト */}
            <div className="relative flex flex-col items-center">
              {/* 背景の光彩エフェクト */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[90px] pointer-events-none opacity-40 animate-pulse"
                style={{
                  background: 'linear-gradient(135deg, #4285f4 0%, #ea4335 35%, #fbbc04 65%, #34a853 100%)',
                }}
              />

              {/* 祝福バッジ */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase shadow-lg bg-gradient-to-r from-google-blue via-google-red to-google-yellow text-white mb-2 animate-bounce">
                <Sparkles className="w-4 h-4" />
                <span>新しいアンバサダーを見つけたよ！！</span>
              </div>

              {/* 水晶玉の中で浮遊する相手のモッフィー */}
              <div className="relative my-4 flex items-center justify-center w-64 h-64">
                {/* 外周リング */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-dashed pointer-events-none animate-spin-slow"
                  style={{ borderColor: `${archetype.accentColor}77` }}
                />
                <div
                  className={`absolute -inset-2.5 rounded-full border pointer-events-none animate-spin-slow-reverse ${
                    isDarkMode ? 'border-white/10' : 'border-neutral-300/80'
                  }`}
                />

                {/* 水晶玉本体 */}
                <div
                  className={`relative w-56 h-56 rounded-full overflow-hidden flex items-center justify-center border backdrop-blur-xl shadow-2xl transition-all ${
                    isDarkMode
                      ? 'border-white/30 bg-gradient-to-b from-white/15 via-transparent to-black/60 shadow-black/80'
                      : 'border-white/90 bg-gradient-to-b from-white/70 via-transparent to-neutral-200/50 shadow-blue-500/10'
                  }`}
                  style={{
                    boxShadow: isDarkMode
                      ? `0 0 50px ${archetype.primaryColor}55, inset 0 0 35px rgba(255,255,255,0.25)`
                      : `0 0 40px ${archetype.primaryColor}33, inset 0 0 30px rgba(255,255,255,0.8)`,
                  }}
                >
                  {/* 水晶内部の光 */}
                  <div
                    className="absolute inset-0 rounded-full blur-md pointer-events-none opacity-30"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${archetype.accentColor} 40%, ${archetype.primaryColor} 70%, transparent 95%)`,
                    }}
                  />

                  {/* 浮遊モッフィー */}
                  <div className="relative z-10 w-44 h-44 flex items-center justify-center animate-crystal-float">
                    <img
                      src={finalPhotoUrl}
                      alt={displayName}
                      className="w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                </div>
              </div>

              {/* 名前（ニックネーム最優先！） */}
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {displayName}
                </h1>
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {archetype.title}
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-500">
                    {mbti}
                  </span>
                </div>
              </div>
            </div>

            {/* 「次へ」ボタン */}
            <div className="w-full pt-4">
              <button
                type="button"
                onClick={() => setStep('profile')}
                className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:opacity-95 active:scale-[0.98] bg-gradient-to-r from-google-blue via-google-green to-google-yellow"
              >
                <span>プロフィールを見る (次へ)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          // ======================================================================
          // ステップ 2: 相手の公開プロフィール画面
          // ======================================================================
          <div className="w-full flex flex-col items-center animate-fade-in space-y-6 py-4">
            {/* プロフィールカード */}
            <div
              className={`w-full rounded-3xl p-6 border shadow-xl transition-all relative overflow-hidden ${
                isDarkMode
                  ? 'border-neutral-800 bg-neutral-900/90 text-neutral-100'
                  : 'border-neutral-200 bg-white text-neutral-900'
              }`}
            >
              {/* カード上部環境光 */}
              <div
                className="absolute top-0 inset-x-0 h-28 blur-3xl opacity-25 pointer-events-none"
                style={{ backgroundColor: archetype.primaryColor }}
              />

              {/* 中央：水晶玉モッフィー */}
              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center my-2">
                  <div
                    className="absolute inset-0 rounded-full border border-dashed pointer-events-none animate-spin-slow opacity-60"
                    style={{ borderColor: archetype.accentColor }}
                  />
                  <div
                    className={`relative w-40 h-40 sm:w-44 sm:h-44 rounded-full overflow-hidden flex items-center justify-center border backdrop-blur-md shadow-xl ${
                      isDarkMode
                        ? 'border-white/20 bg-gradient-to-b from-white/10 via-transparent to-black/60'
                        : 'border-white/80 bg-gradient-to-b from-white/60 via-transparent to-neutral-200/50'
                    }`}
                  >
                    <div className="w-32 h-32 flex items-center justify-center animate-crystal-float">
                      <img
                        src={finalPhotoUrl}
                        alt={displayName}
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                  </div>
                </div>

                {/* 名前（ニックネーム最優先！） */}
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-3 text-center">
                  {displayName}
                </h2>

                {/* 性格タイプのモッフィー名 */}
                <div className="mt-2 text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-google-blue/15 text-google-blue border border-google-blue/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{archetype.title}</span>
                  </div>
                  <p className={`text-[11px] max-w-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {archetype.subtitle}
                  </p>
                </div>

                {/* 所属大学・学年 */}
                {(university || grade) && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{[university, grade].filter(Boolean).join(' ')}</span>
                  </div>
                )}

                {/* 🌟 誕生日（※デフォルト非表示、本人が公開設定にした場合のみ表示） */}
                {showBirthday && birthday && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-500 dark:text-pink-400 border border-pink-500/20">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{birthday}</span>
                  </div>
                )}
              </div>

              {/* 🌟 設定したSNS（各外部リンクボタン） */}
              {snsLinks && snsLinks.length > 0 && (
                <div className="mt-6 pt-5 border-t border-neutral-200/60 dark:border-neutral-800">
                  <span className={`block text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${
                    isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                  }`}>
                    Social Links
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {snsLinks.map((sns, index) => {
                      const resolvedUrl = resolveSnsUrl(sns.platform, sns.value);
                      if (!resolvedUrl) return null;

                      return (
                        <a
                          key={`${sns.id || index}`}
                          href={resolvedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition border cursor-pointer ${
                            isDarkMode
                              ? 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800 hover:text-white text-neutral-200'
                              : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:text-neutral-900 text-neutral-700'
                          }`}
                        >
                          <span className="capitalize font-semibold">{sns.platform}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* フレンド登録完了バッジ */}
              {friendAdded && (
                <div className="mt-5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>フレンドに追加されました</span>
                </div>
              )}
            </div>

            {/* ナビゲーションリンク */}
            <div className="w-full space-y-2 pt-2">
              <a
                href="./home.html"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Home className="w-4 h-4" />
                <span>自分のアンバサダーポータルを開く</span>
              </a>

              {!currentUserId && (
                <a
                  href="./index.html"
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer bg-google-blue text-white hover:opacity-95 shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>自分も性格診断を受けてモッフィーを作る</span>
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* フッター（※フォロー数・フォロワー数は絶対に表示しない） */}
      <footer className="w-full py-6 text-center border-t border-neutral-200/50 dark:border-neutral-800/50 text-[11px] text-neutral-500">
        <p>Google AI Student Ambassador Official Profile</p>
      </footer>
    </div>
  );
};

export default ShareApp;
