import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
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
  BookOpen,
} from 'lucide-react';
import type { MbtiType, SnsPlatform, SnsLinkItem, FriendItem, UserMoffySession } from './types';
import { MBTI_ARCHETYPES } from './data/personalityQuestions';
import { resolveSnsUrl } from './utils/snsUtils';
import { MoffyAuthClient } from './utils/oauthClient';
import { isNewDexDiscovery } from './utils/dexUtils';
import {
  getPublicProfile,
  getGameProgress,
  addFriend,
  getFriendList,
  extractMbtiFromUrl,
  generateTalkTopicWithGemini,
} from './services/api';

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

  // 表示ステップ: 'discover' (新しいアンバサダー発見) -> 'profile' (相手の公開ページ/フレンドリザルト) -> 'topic' (相性トークテーマ)
  const [step, setStep] = useState<'discover' | 'profile' | 'topic'>('discover');
  const [talkTopic, setTalkTopic] = useState<string>('');
  const [isLoadingTopic, setIsLoadingTopic] = useState<boolean>(true);
  const [typingProgress, setTypingProgress] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);

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
  const initialHobbies = queryParams.get('hobbies') || '';
  const initialSkills = queryParams.get('skills') || '';
  const isAmbassador = queryParams.get('ambassador') === '1';

  // プロフィールステート
  const [mbti, setMbti] = useState<MbtiType>(initialMbti);
  const [nickname, setNickname] = useState<string>(initialNickname);
  const [name, setName] = useState<string>(initialName);
  const [university, setUniversity] = useState<string>(initialUniv);
  const [grade, setGrade] = useState<string>(initialGrade);
  const [photoUrl, setPhotoUrl] = useState<string>(initialPhoto);
  const [birthday, setBirthday] = useState<string>(initialBirthday);
  const [showBirthday, setShowBirthday] = useState<boolean>(initialShowBirthday);
  const [hobbies, setHobbies] = useState<string>(initialHobbies);
  const [skills, setSkills] = useState<string>(initialSkills);
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

  // フレンド追加完了ステート ＆ 図鑑新規発見ステート
  const [friendAdded, setFriendAdded] = useState<boolean>(false);
  const [isNewDiscovery, setIsNewDiscovery] = useState<boolean>(false);

  const authClient = useMemo(() => new MoffyAuthClient({ clientId: 'moffy-share' }), []);
  const currentUser = authClient.getUser();
  const currentUserId = currentUser?.discord_user_id || null;
  const currentUserMbti = (currentUser?.mbti || null) as MbtiType | null;

  // ログインユーザー自身のプロフィール・趣味・特技セッション
  const currentUserSession = useMemo<UserMoffySession | null>(() => {
    if (!currentUserId) return null;
    try {
      const raw = localStorage.getItem(`moffy_user_session_${currentUserId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [currentUserId]);

  // 二重実行防止ガード（レースコンディション対策）
  const hasExecutedRef = useRef<boolean>(false);

  // 最新プロフィールおよび追加情報の非同期取得 ＆ 自動フレンド登録
  useEffect(() => {
    let isMounted = true;

    async function syncAndFriend() {
      if (!targetDiscordId || targetDiscordId === 'Ambassador') return;
      if (hasExecutedRef.current) return;
      hasExecutedRef.current = true;

      let finalNick = initialNickname;
      let finalName = initialName;
      let finalUniv = initialUniv;
      let finalGrade = initialGrade;
      let finalPhoto = initialPhoto;
      let finalMbti = initialMbti;
      let finalBirthday = initialBirthday;
      let finalShowBirthday = initialShowBirthday;
      let finalHobbies = initialHobbies;
      let finalSkills = initialSkills;
      let finalSns = snsLinks;

      // 1. APIから最新プロフィール取得
      try {
        const publicProfile = await getPublicProfile(targetDiscordId);
        if (publicProfile && isMounted) {
          if (publicProfile.nickname && publicProfile.nickname.trim()) {
            finalNick = publicProfile.nickname.trim();
            finalName = '';
            setNickname(finalNick);
            // 🌟 ニックネーム設定時は、URLパラメータやAPI由来の本名を即座に消去し非公開を物理的に徹底
            setName('');
          } else if (publicProfile.name) {
            finalName = publicProfile.name;
            setName(finalName);
          }
          if (publicProfile.university) {
            finalUniv = publicProfile.university;
            setUniversity(finalUniv);
          }
          if (publicProfile.grade) {
            finalGrade = String(publicProfile.grade);
            setGrade(finalGrade);
          }

          const bestPhoto =
            publicProfile.arranged_photo_url ||
            publicProfile.default_photo_url ||
            publicProfile.photo_url;
          if (bestPhoto) {
            finalPhoto = bestPhoto;
            setPhotoUrl(bestPhoto);
            const extracted = extractMbtiFromUrl(bestPhoto);
            if (extracted) {
              finalMbti = extracted;
              setMbti(extracted);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch public profile:', err);
      }

      // 2. クラウドDB (game_progress: moffy_profile_ext) から誕生日・SNS設定を取得
      try {
        const profileExt = await getGameProgress<any>('moffy_profile_ext', targetDiscordId);
        if (profileExt && isMounted) {
          if (profileExt.birthday) {
            finalBirthday = profileExt.birthday;
            setBirthday(finalBirthday);
          }
          if (typeof profileExt.showBirthday === 'boolean') {
            finalShowBirthday = profileExt.showBirthday;
            setShowBirthday(finalShowBirthday);
          }
          if (profileExt.hobbies) {
            finalHobbies = profileExt.hobbies;
            setHobbies(finalHobbies);
          }
          if (profileExt.skills) {
            finalSkills = profileExt.skills;
            setSkills(finalSkills);
          }
          if (Array.isArray(profileExt.snsLinks) && profileExt.snsLinks.length > 0) {
            finalSns = profileExt.snsLinks;
            setSnsLinks(finalSns);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch profile ext:', err);
      }

      // 3. ログイン中の閲覧者がいる場合、DBにフレンド関係を自動永続化 ＆ モッフィー図鑑の新規発見判定
      if (currentUserId && currentUserId !== targetDiscordId) {
        try {
          // 既存のフレンド一覧を取得して新規発見判定
          const existingFriends = await getFriendList(currentUserId).catch(() => []);
          const newlyDiscovered = isNewDexDiscovery(finalMbti, currentUserMbti, existingFriends);

          const hasNick = !!(finalNick && finalNick.trim());
          const friendPayload: FriendItem = {
            discord_user_id: targetDiscordId,
            name: hasNick ? null : (finalName || null),
            lastName: hasNick ? null : (initialLastName || null),
            firstName: hasNick ? null : (initialFirstName || null),
            nickname: finalNick || null,
            mbti: finalMbti,
            photoUrl: finalPhoto || null,
            university: finalUniv || null,
            grade: finalGrade || null,
            birthday: finalBirthday || null,
            showBirthday: finalShowBirthday,
            hobbies: finalHobbies || undefined,
            skills: finalSkills || undefined,
            isAmbassador,
            snsLinks: finalSns,
            addedAt: new Date().toISOString(),
          };

          const ok = await addFriend(currentUserId, friendPayload);
          if (ok && isMounted) {
            setFriendAdded(true);
            if (newlyDiscovered) {
              setIsNewDiscovery(true);
              try {
                confetti({
                  particleCount: 75,
                  spread: 60,
                  origin: { y: 0.6 },
                });
              } catch {
                // ignore
              }
            }
          }
        } catch (e) {
          console.warn('Auto add friend or dex discovery check failed:', e);
        }
      }
    }

    syncAndFriend();

    return () => {
      isMounted = false;
    };
  }, [targetDiscordId, currentUserId, currentUserMbti, initialNickname, initialName, initialUniv, initialGrade, initialPhoto, initialMbti, initialBirthday, initialShowBirthday, initialHobbies, initialSkills, snsLinks, initialLastName, initialFirstName, isAmbassador]);

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

  // トークテーマの自動生成（バックグラウンド先行ロード ＆ ローカルキャッシュ）
  useEffect(() => {
    let isMounted = true;

    async function loadTalkTopic() {
      // 🌟 同一ペア間のローカルキャッシュ確認（趣味・特技の変更にも連動）
      const cacheKey = `moffy_talk_topic_v2_${currentUserId || 'guest'}_${targetDiscordId}_${hobbies || ''}_${skills || ''}_${currentUserSession?.hobbies || ''}_${currentUserSession?.skills || ''}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached && cached.trim()) {
          if (isMounted) {
            setTalkTopic(cached.trim());
            setIsLoadingTopic(false);
          }
          return;
        }
      } catch {
        // ignore
      }

      setIsLoadingTopic(true);
      try {
        const topic = await generateTalkTopicWithGemini({
          myMbti: currentUserMbti,
          myName: currentUser?.nickname || currentUser?.name || null,
          myUniversity: currentUser?.university || null,
          myHobbies: currentUserSession?.hobbies || null,
          mySkills: currentUserSession?.skills || null,
          friendMbti: mbti,
          friendName: displayName,
          friendUniversity: university,
          friendHobbies: hobbies || null,
          friendSkills: skills || null,
        });
        if (isMounted) {
          setTalkTopic(topic);
          setIsLoadingTopic(false);
          // キャッシュ保存
          try {
            localStorage.setItem(cacheKey, topic);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        console.warn('Failed to generate talk topic:', e);
        if (isMounted) {
          const fallback = 'お互いの大学で流行っていることや、普段の活動で関心のあるテーマについて聞いてみよう';
          setTalkTopic(fallback);
          setIsLoadingTopic(false);
        }
      }
    }

    if (mbti) {
      loadTalkTopic();
    }

    return () => {
      isMounted = false;
    };
  }, [mbti, currentUserMbti, currentUser?.nickname, currentUser?.name, currentUser?.university, currentUserSession, displayName, university, hobbies, skills, currentUserId, targetDiscordId]);

  // トークテーマのタイピング風文字アニメーション
  useEffect(() => {
    if (step !== 'topic' || !talkTopic) return;

    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      setTypingProgress(idx);
      if (idx >= talkTopic.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 32);

    return () => {
      clearInterval(interval);
    };
  }, [step, talkTopic]);

  // トークテーマ画面への遷移ハンドラー（タイピング初期化）
  const handleGoToTopic = () => {
    setTypingProgress(0);
    setIsTyping(true);
    setStep('topic');
  };

  // タップでタイピング演出を即座にスキップ
  const handleSkipTyping = () => {
    if (isTyping && talkTopic) {
      setTypingProgress(talkTopic.length);
      setIsTyping(false);
    }
  };

  const displayedTopic = isTyping ? talkTopic.slice(0, typingProgress) : talkTopic;

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

              {isNewDiscovery && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>モッフィー図鑑に新性格が登録されたよ！</span>
                </div>
              )}

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
                {isAmbassador && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#8ab4f8]/15 dark:text-[#8ab4f8] border border-[#1a73e8]/20 dark:border-[#8ab4f8]/30">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                      <path fillRule="evenodd" d="M8 0c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm3.22 5.22a.75.75 0 00-1.06-1.06L6.5 7.82 5.34 6.66a.75.75 0 10-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l4.13-4.25z" clipRule="evenodd" />
                    </svg>
                    <span>Google AI 学生アンバサダー</span>
                  </div>
                )}
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
        ) : step === 'profile' ? (
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
                {isAmbassador && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-[#1a73e8]/10 text-[#1a73e8] dark:bg-[#8ab4f8]/15 dark:text-[#8ab4f8] border border-[#1a73e8]/20 dark:border-[#8ab4f8]/30">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0" aria-hidden="true">
                      <path fillRule="evenodd" d="M8 0c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm3.22 5.22a.75.75 0 00-1.06-1.06L6.5 7.82 5.34 6.66a.75.75 0 10-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l4.13-4.25z" clipRule="evenodd" />
                    </svg>
                    <span>Google AI 学生アンバサダー</span>
                  </div>
                )}

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

              {/* 🌟 趣味・特技・SNS セクション (ユーザー要望の縦積みリストレイアウト) */}
              {(hobbies || skills || (snsLinks && snsLinks.length > 0)) && (
                <div className="mt-6 text-left space-y-3.5">
                  {/* 趣味 */}
                  {hobbies && (
                    <div className="border-t border-neutral-200/60 dark:border-neutral-800 pt-3">
                      <span className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
                        isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        趣味
                      </span>
                      <p className={`text-sm font-medium leading-relaxed ${
                        isDarkMode ? 'text-neutral-100' : 'text-neutral-900'
                      }`}>
                        {hobbies}
                      </p>
                    </div>
                  )}

                  {/* 特技 */}
                  {skills && (
                    <div className="border-t border-neutral-200/60 dark:border-neutral-800 pt-3">
                      <span className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
                        isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        特技
                      </span>
                      <p className={`text-sm font-medium leading-relaxed ${
                        isDarkMode ? 'text-neutral-100' : 'text-neutral-900'
                      }`}>
                        {skills}
                      </p>
                    </div>
                  )}

                  {/* SNS */}
                  {snsLinks && snsLinks.length > 0 && (
                    <div className="border-t border-neutral-200/60 dark:border-neutral-800 pt-3">
                      <span className={`block text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                        isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        SNS
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {snsLinks.map((sns, index) => {
                          const resolvedUrl = resolveSnsUrl(sns.platform, sns.value);
                          if (!resolvedUrl) return null;

                          return (
                            <a
                              key={`${sns.id || index}`}
                              href={resolvedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border cursor-pointer ${
                                isDarkMode
                                  ? 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:text-white text-neutral-200'
                                  : 'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 text-neutral-700'
                              }`}
                            >
                              <span className="capitalize">{sns.platform}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* フレンド登録完了バッジ ＆ 図鑑新規登録告知 */}
              {friendAdded && (
                <div className="mt-5 space-y-2.5">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>フレンドに追加されました</span>
                  </div>

                  {isNewDiscovery && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0 text-left">
                          <span className="font-bold block truncate">モッフィー図鑑に新登録！</span>
                          <span className="text-[11px] opacity-80 block truncate">
                            {archetype.title} ({mbti}) が解放されました
                          </span>
                        </div>
                      </div>
                      <a
                        href="./home.html?tab=dex"
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-semibold text-xs hover:bg-amber-600 transition shrink-0 shadow-xs cursor-pointer"
                      >
                        図鑑を見る
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ナビゲーションリンク */}
            <div className="w-full space-y-2 pt-2">
              <button
                type="button"
                onClick={handleGoToTopic}
                className="w-full min-h-[50px] py-3.5 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:opacity-95 active:scale-[0.98] bg-gradient-to-r from-google-blue via-google-green to-google-yellow"
              >
                <span>次へ (トークテーマへ)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="./home.html?tab=dex"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
              >
                <BookOpen className="w-4 h-4 text-google-blue" />
                <span>モッフィー図鑑を確認する</span>
              </a>

              <a
                href="./home.html"
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
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
        ) : (
          // ======================================================================
          // ステップ 3: 相性のいいトークテーマ画面
          // ======================================================================
          <div className="w-full flex flex-col items-center animate-fade-in space-y-6 py-4">
            {/* 二人のアンバサダー ペア情報 */}
            <div className="flex items-center justify-center gap-2 py-1 max-w-full flex-wrap">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs ${
                  isDarkMode
                    ? 'border-neutral-800 bg-neutral-900/60 text-neutral-200'
                    : 'border-neutral-200 bg-white text-neutral-800'
                }`}
              >
                <span className="font-semibold truncate max-w-[120px]">
                  {currentUser?.nickname || currentUser?.name || 'あなた'}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {currentUserMbti ? `(${currentUserMbti})` : '(未診断)'}
                </span>
              </div>
              <span className="text-neutral-400 text-xs font-bold">×</span>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs ${
                  isDarkMode
                    ? 'border-neutral-800 bg-neutral-900/60 text-neutral-200'
                    : 'border-neutral-200 bg-white text-neutral-800'
                }`}
              >
                <span className="font-semibold truncate max-w-[120px]">{displayName}</span>
                <span className="text-[10px] font-mono text-neutral-400">({mbti})</span>
              </div>
            </div>

            {/* トークテーマ表示カード */}
            <div
              onClick={handleSkipTyping}
              title={isTyping ? 'タップで全表示' : undefined}
              className={`w-full rounded-3xl p-6 sm:p-8 border shadow-xl transition-all relative overflow-hidden text-center cursor-pointer select-none ${
                isDarkMode
                  ? 'border-neutral-800 bg-neutral-900/90 text-neutral-100'
                  : 'border-neutral-200 bg-white text-neutral-900'
              }`}
            >
              {/* カード上部環境光 */}
              <div
                className="absolute top-0 inset-x-0 h-24 blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: archetype.primaryColor }}
              />

              {/* 上部 Google カラーバー */}
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4285f4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ea4335]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#fbbc04]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#34a853]" />
              </div>

              {/* 「トークテーマ！」見出し（文字アニメーションで出現） */}
              <h2 className={`text-xl sm:text-2xl font-black tracking-tight animate-fade-in mb-4 ${
                isDarkMode ? 'text-neutral-100' : 'text-neutral-900'
              }`}>
                トークテーマ！
              </h2>

              {/* 改行して「〇〇」 */}
              <div className="min-h-[84px] flex items-center justify-center px-2">
                {isLoadingTopic ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-4">
                    <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#4285f4] rounded-full animate-spin" />
                    <span className={`text-xs font-medium ${
                      isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      相性を分析中...
                    </span>
                  </div>
                ) : (
                  <p className={`text-base sm:text-lg font-medium leading-relaxed tracking-normal max-w-sm mx-auto ${
                    isDarkMode ? 'text-neutral-100' : 'text-neutral-800'
                  }`}>
                    {displayedTopic}
                    {isTyping && (
                      <span className={`inline-block w-0.5 h-5 ml-1 animate-pulse align-middle ${
                        isDarkMode ? 'bg-[#8ab4f8]' : 'bg-[#4285f4]'
                      }`} />
                    )}
                  </p>
                )}
              </div>

              {/* スキップ案内（タイピング中のみ） */}
              {isTyping && (
                <div className={`mt-3 text-[10px] ${
                  isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
                }`}>
                  タップで全表示
                </div>
              )}
            </div>

            {/* その下に「次へ」ボタンを設置。押すことでモッフィー図鑑に戻れる */}
            <div
              className={`w-full pt-2 transition-all duration-500 ${
                !isTyping ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
              }`}
            >
              <a
                href="./home.html?tab=dex"
                className={`w-full min-h-[50px] py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:opacity-95 active:scale-[0.98] ${
                  isDarkMode
                    ? 'bg-neutral-100 text-neutral-950'
                    : 'bg-neutral-900 text-white'
                }`}
              >
                <span>次へ</span>
                <ArrowRight className="w-4 h-4" />
              </a>
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
