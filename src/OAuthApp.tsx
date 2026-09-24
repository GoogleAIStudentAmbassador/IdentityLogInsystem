import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { IntroScreen } from './components/IntroScreen';
import type { OnboardingData, GoogleOnboardingInfo } from './components/IntroScreen';
import { Header } from './components/Header';
import { StarField } from './components/StarField';
import {
  checkApiHealth,
  loginUser,
  loginWithGoogle,
  registerUserProfile,
  registerGoogleUser,
  extractMbtiFromUrl,
} from './services/api';
import type { RegistrationResult } from './types';
import { isAllowedRedirectUri, generateRandomState } from './utils/oauthClient';
import {
  verifyDiscordUser,
  startDiscord2FaAuth,
  checkDiscord2FaAuthStatus,
  cancelDiscord2FaAuth,
  getDiscordAvatarUrl,
} from './services/discordApi';
import { getDiscord2FaStatus, saveDiscord2FaVerification } from './services/discord2fa';
import { AlertTriangle, ShieldCheck, Loader2, XCircle, ArrowLeft, ArrowRight, ExternalLink, Clock, HelpCircle } from 'lucide-react';
import { DiscordUsernameHelpModal } from './components/DiscordUsernameHelpModal';

interface OAuthParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  responseType: string;
}

function parseOAuthParams(): OAuthParams {
  if (typeof window === 'undefined') {
    return {
      clientId: 'moffy-app',
      redirectUri: './home.html',
      state: '',
      scope: 'profile',
      responseType: 'token',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || 'moffy-personality-quiz';
  
  // デフォルトのリダイレクト先は同階層の home.html (アンバサダーポータル)
  const defaultRedirect = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/home.html`;
  const rawRedirectUri = params.get('redirect_uri') || defaultRedirect;

  // 🌟 state パラメータが明示されない直接アクセスの際も、安全なランダムstateを補填
  const state = params.get('state') || generateRandomState();
  const scope = params.get('scope') || 'profile';
  const responseType = params.get('response_type') || 'token';

  return {
    clientId,
    redirectUri: rawRedirectUri,
    state,
    scope,
    responseType,
  };
}

export const OAuthApp: React.FC = () => {
  const oauthParams = useMemo(() => parseOAuthParams(), []);
  const isRedirectUriValid = useMemo(
    () => isAllowedRedirectUri(oauthParams.redirectUri),
    [oauthParams.redirectUri]
  );
  const [apiStatus, setApiStatus] = useState<{
    authenticated: boolean;
    name: string;
    canCreate: boolean;
  } | null>(null);
  const [googleOnboardingInfo, setGoogleOnboardingInfo] = useState<GoogleOnboardingInfo | null>(null);
  const [pending2FaAuth, setPending2FaAuth] = useState<{
    user: RegistrationResult;
    token: string | null;
    googleEmail?: string | null;
  } | null>(null);
  const [pending2FaDiscordId, setPending2FaDiscordId] = useState('');
  const [is2FaVerifying, setIs2FaVerifying] = useState(false);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [showDiscordHelp, setShowDiscordHelp] = useState(false);

  interface PendingInteractive2Fa {
    userName: string;
    panelUrl: string;
    expiresIn: number;
    expiresAt: number;
    displayname?: string;
    avatarUrl?: string;
  }
  const [pending2FaSession, setPending2FaSession] = useState<PendingInteractive2Fa | null>(null);
  const [pending2FaRemainingSeconds, setPending2FaRemainingSeconds] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isSubmittingRef = useRef(isSubmitting);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // 初期ロード時のヘルスチェック
  useEffect(() => {
    checkApiHealth().then((status) => {
      setApiStatus(status);
    }).catch(() => {
      // ignore
    });
  }, []);

  /**
   * 認証完了後の安全なリダイレクト処理 (URLフラグメントによるトークン・ユーザー情報の返却)
   */
  const handleAuthSuccess = useCallback((user: RegistrationResult, token?: string | null) => {
    if (!isAllowedRedirectUri(oauthParams.redirectUri)) {
      setErrorMsg('セキュリティ保護のため、未許可のドメインへのリダイレクトは遮断されました。');
      setIsSubmitting(false);
      return;
    }

    setIsRedirecting(true);

    try {
      const returnUrl = new URL(oauthParams.redirectUri, window.location.href);
      const fragmentParams = new URLSearchParams();

      fragmentParams.set('access_token', token || 'authenticated_session');
      fragmentParams.set('token_type', 'Bearer');
      if (oauthParams.state) {
        fragmentParams.set('state', oauthParams.state);
        // 🌟 直接アクセス時も同一オリジン間の sessionStorage に state をブリッジ保存
        try {
          sessionStorage.setItem('moffy_oauth_csrf_state', oauthParams.state);
        } catch {
          // ignore
        }
      }
      fragmentParams.set('discord_user_id', user.discord_user_id);
      if (user.name) fragmentParams.set('name', user.name);
      if (user.last_name) fragmentParams.set('last_name', user.last_name);
      if (user.first_name) fragmentParams.set('first_name', user.first_name);
      if (user.nickname) fragmentParams.set('nickname', user.nickname);
      if (user.grade) fragmentParams.set('grade', String(user.grade));
      if (user.university) fragmentParams.set('university', user.university);
      if (user.photo_url) fragmentParams.set('photo_url', user.photo_url);
      if (user.default_photo_url) fragmentParams.set('default_photo_url', user.default_photo_url);
      if (user.arranged_photo_url) fragmentParams.set('arranged_photo_url', user.arranged_photo_url);
      if (user.mbti) fragmentParams.set('mbti', user.mbti);
      if (user.is_staff) fragmentParams.set('is_staff', 'true');
      if (user.google_id) fragmentParams.set('google_id', user.google_id);
      if (user.is_discord_verified !== undefined) {
        fragmentParams.set('is_discord_verified', String(user.is_discord_verified));
      }
      if (user.discord_verified_at) {
        fragmentParams.set('discord_verified_at', String(user.discord_verified_at));
      }
      if (user.is_ambassador !== undefined) {
        fragmentParams.set('is_ambassador', String(user.is_ambassador));
      }

      returnUrl.hash = fragmentParams.toString();

      // 🌟 window.location.replace により、履歴汚染とブラウザ戻るボタントラップを完全に防止
      window.location.replace(returnUrl.toString());
    } catch (err) {
      console.error('Failed to construct redirect URL:', err);
      setErrorMsg('リダイレクトURLの構築に失敗しました。');
      setIsRedirecting(false);
      setIsSubmitting(false);
    }
  }, [oauthParams]);

  // 2FA カウントダウンタイマー
  useEffect(() => {
    if (!pending2FaSession) {
      setPending2FaRemainingSeconds(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((pending2FaSession.expiresAt - Date.now()) / 1000));
      setPending2FaRemainingSeconds(remaining);
      if (remaining <= 0) {
        setPending2FaSession(null);
        setTwoFaError('二段階認証の有効期限が切れました。再度「本人確認へ進む」を押してください。');
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [pending2FaSession]);

  // 常設ボタン押下のリアルタイムポーリング検知
  useEffect(() => {
    if (!pending2FaSession || !pending2FaAuth) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      if (Date.now() >= pending2FaSession.expiresAt) {
        if (isMounted) {
          setPending2FaSession(null);
          setTwoFaError('二段階認証の有効期限が切れました。再度「本人確認へ進む」を押してください。');
        }
        clearInterval(interval);
        return;
      }

      try {
        const statusRes = await checkDiscord2FaAuthStatus(pending2FaSession.userName, false);
        if (!isMounted) return;

        if (statusRes.status === 'approved') {
          clearInterval(interval);
          const avatar = pending2FaSession.avatarUrl || getDiscordAvatarUrl(pending2FaSession.userName);
          saveDiscord2FaVerification(pending2FaSession.userName, {
            isAlive: true,
            user_name: pending2FaSession.userName,
            displayname: statusRes.displayname || pending2FaSession.displayname,
            avatar_url: avatar,
          });
          const updatedUser: RegistrationResult = {
            ...pending2FaAuth.user,
            discord_user_id: pending2FaSession.userName,
            is_discord_verified: true,
            discord_verified_at: Date.now(),
            is_ambassador: Boolean(pending2FaAuth.user.is_ambassador || true),
            photo_url: avatar || pending2FaAuth.user.photo_url || null,
          };
          const token = pending2FaAuth.token;
          setPending2FaSession(null);
          setPending2FaAuth(null);
          handleAuthSuccess(updatedUser, token);
        } else if (statusRes.status === 'expired') {
          clearInterval(interval);
          setPending2FaSession(null);
          setTwoFaError('二段階認証の有効期限が切れました。再度お試しください。');
        }
      } catch (err) {
        console.warn('[OAuth 2FA Poll] Non-fatal polling warning:', err);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pending2FaSession, pending2FaAuth, handleAuthSuccess]);

  /**
   * Google サインイン連携
   */
  const handleGoogleSignIn = useCallback(async (credential: string) => {
    if (isSubmittingRef.current) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await loginWithGoogle(credential);

      if (res.needs_registration) {
        // 初回Google連携: パスワード不要のオンボーディング画面へ
        setGoogleOnboardingInfo({
          tempToken: res.temp_token || '',
          email: res.google_email || '',
          name: res.google_name || '',
        });
        setIsSubmitting(false);
        return;
      }

      if (!res.user) {
        throw new Error('ユーザー情報の取得に失敗しました');
      }

      const userData = res.user;
      const twoFa = getDiscord2FaStatus(userData.discord_user_id);
      const userResult: RegistrationResult = {
        discord_user_id: userData.discord_user_id,
        name: userData.name || userData.display_name || res.google_name || null,
        last_name: userData.last_name || null,
        first_name: userData.first_name || null,
        nickname: userData.nickname || null,
        photo_url: userData.photo_url || null,
        default_photo_url: userData.default_photo_url || null,
        arranged_photo_url: userData.arranged_photo_url || null,
        grade: userData.grade || null,
        university: userData.university || null,
        is_staff: !!userData.is_staff,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        google_id: userData.google_id || null,
        is_discord_verified: twoFa.isVerified,
        discord_verified_at: twoFa.record?.verifiedAt || null,
        is_ambassador: Boolean(userData.is_ambassador || twoFa.isVerified),
      };

      const extractedMbti =
        extractMbtiFromUrl(userResult.arranged_photo_url) ||
        extractMbtiFromUrl(userResult.default_photo_url) ||
        extractMbtiFromUrl(userResult.photo_url);
      if (extractedMbti) {
        userResult.mbti = extractedMbti;
      }

      // 🌟 批判検証是正（無限ループ・ソフトロック防止）:
      // 既存Google連携ユーザーで2FAが未完了または1週間経過している場合、
      // リダイレクトを即座に保留し、画面上で二段階認証（公式サーバー在籍確認）の完了を強制
      if (!twoFa.isVerified) {
        setPending2FaAuth({
          user: userResult,
          token: res.access_token || null,
          googleEmail: res.google_email,
        });
        setPending2FaDiscordId(userResult.discord_user_id || '');
        if (twoFa.isExpired) {
          setTwoFaError('前回の二段階認証から1週間が経過したため、再認証が必要です。');
        } else {
          setTwoFaError(null);
        }
        setIsSubmitting(false);
        return;
      }

      handleAuthSuccess(userResult, res.access_token);
    } catch (err: unknown) {
      console.error('Google login error:', err);
      const message = err instanceof Error ? err.message : 'Googleログインに失敗しました';
      setErrorMsg(message);
      setIsSubmitting(false);
    }
  }, [handleAuthSuccess]);

  /**
   * Google 連携既存ユーザーの二段階認証実行ハンドラ
   */
  const handleVerifyPending2Fa = async () => {
    if (!pending2FaAuth) return;
    const cleanId = pending2FaDiscordId.trim().replace(/^@/, '');
    if (!cleanId) {
      setTwoFaError('Discord ユーザー名を入力してください');
      return;
    }

    setIs2FaVerifying(true);
    setTwoFaError(null);

    try {
      // 1. サーバー在籍確認
      const res = await verifyDiscordUser(cleanId);
      if (!res.isAlive || !res.user_name) {
        const msg =
          res.message ||
          '指定された Discord ユーザー名が見つかりませんでした。Google AI Student Ambassador 公式サーバーに参加しているかご確認ください。';
        setTwoFaError(msg);
        return;
      }

      // 2. 常設ボタン式 2FA セッションの開始要求 (API v2.0.0)
      const authReq = await startDiscord2FaAuth(cleanId, 180);
      if (authReq.status === 'approved') {
        const avatar = res.avatar_url || getDiscordAvatarUrl(res.user_name);
        saveDiscord2FaVerification(res.user_name, {
          ...res,
          avatar_url: avatar,
        });
        const updatedUser: RegistrationResult = {
          ...pending2FaAuth.user,
          discord_user_id: res.user_name,
          is_discord_verified: true,
          discord_verified_at: Date.now(),
          is_ambassador: Boolean(pending2FaAuth.user.is_ambassador || true),
          photo_url: avatar || pending2FaAuth.user.photo_url || null,
        };
        const token = pending2FaAuth.token;
        setPending2FaAuth(null);
        handleAuthSuccess(updatedUser, token);
      } else if (authReq.status === 'pending') {
        setPending2FaSession({
          userName: cleanId,
          panelUrl: authReq.panel_url || '',
          expiresIn: authReq.expires_in || 180,
          expiresAt: Date.now() + (authReq.expires_in || 180) * 1000,
          displayname: res.displayname,
          avatarUrl: res.avatar_url || getDiscordAvatarUrl(cleanId),
        });
        setTwoFaError(null);
      } else {
        setTwoFaError(authReq.message || '二段階認証の開始に失敗しました。');
      }
    } catch (err: unknown) {
      console.error('2FA verification failed:', err);
      setTwoFaError('在籍確認サーバーへの通信に失敗しました。ネットワークまたはTailscale接続をご確認ください。');
    } finally {
      setIs2FaVerifying(false);
    }
  };

  /**
   * 🌟 Discord在籍確認（2FA）をスキップして進行
   */
  const handleSkipPending2FaAsGuest = () => {
    if (!pending2FaAuth) return;
    const guestUser: RegistrationResult = {
      ...pending2FaAuth.user,
      is_ambassador: Boolean(pending2FaAuth.user.is_ambassador),
      is_discord_verified: false,
      discord_verified_at: null,
    };
    const token = pending2FaAuth.token;
    setPending2FaAuth(null);
    setPending2FaSession(null);
    handleAuthSuccess(guestUser, token);
  };

  const handleCancelPending2Fa = async () => {
    if (pending2FaSession) {
      await cancelDiscord2FaAuth(pending2FaSession.userName).catch(() => {});
      setPending2FaSession(null);
    }
    setPending2FaAuth(null);
    setTwoFaError(null);
    setErrorMsg(null);
  };

  /**
   * 通常サインイン / 新規登録 / Googleオンボーディング登録
   */
  const handleIntroContinue = async (data: OnboardingData) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (data.authMode === 'signin') {
        // 既存ユーザー サインイン
        const { user, token } = await loginUser(data.discordUserId, data.password || '');
        if (!user.photo_url && data.discordAvatarUrl) {
          user.photo_url = data.discordAvatarUrl;
        }
        user.is_discord_verified = data.isDiscordVerified !== undefined ? data.isDiscordVerified : !!user.is_discord_verified;
        user.discord_verified_at = data.discordVerifiedAt || null;
        user.is_ambassador = data.isAmbassador !== undefined ? data.isAmbassador : !!user.is_ambassador;
        handleAuthSuccess(user, token);
      } else if (data.authMode === 'google_onboarding') {
        // Google 初回オンボーディング登録
        const res = await registerGoogleUser({
          temp_token: data.tempToken || '',
          discord_user_id: data.discordUserId,
          name: data.name,
          last_name: data.lastName,
          first_name: data.firstName,
          nickname: data.nickname,
          grade: data.grade,
          university: data.university,
          photo: data.uploadedPhoto, // 手動アップロードしたモッフィー画像のみ (DiscordアイコンはFirebase非保存)
        });

        if (!res.user) {
          throw new Error('Google連携登録後のユーザー情報取得に失敗しました');
        }

        const userResult: RegistrationResult = {
          discord_user_id: res.user.discord_user_id,
          name: res.user.name || res.user.display_name || data.name,
          last_name: res.user.last_name || data.lastName || null,
          first_name: res.user.first_name || data.firstName || null,
          nickname: res.user.nickname || data.nickname || null,
          photo_url: res.user.photo_url || data.discordAvatarUrl || null,
          default_photo_url: res.user.default_photo_url || null,
          arranged_photo_url: res.user.arranged_photo_url || null,
          grade: res.user.grade || data.grade || null,
          university: res.user.university || data.university || null,
          is_staff: !!res.user.is_staff,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          google_id: null,
          is_discord_verified: Boolean(data.isDiscordVerified),
          discord_verified_at: data.discordVerifiedAt || null,
          is_ambassador: Boolean(data.isAmbassador),
          mbti: extractMbtiFromUrl(res.user.photo_url || res.user.arranged_photo_url || res.user.default_photo_url),
        };

        handleAuthSuccess(userResult, res.access_token || null);
      } else {
        // 通常新規登録 (サインアップ)
        const result = await registerUserProfile(data.discordUserId, data.password || '', {
          name: data.name,
          lastName: data.lastName,
          firstName: data.firstName,
          nickname: data.nickname,
          grade: data.grade,
          university: data.university,
          photoBlob: data.uploadedPhoto, // 手動アップロードしたモッフィー画像のみ (DiscordアイコンはFirebase非保存)
        });

        if (!result.name && data.name) {
          result.name = data.name;
        }
        if (!result.last_name && data.lastName) {
          result.last_name = data.lastName;
        }
        if (!result.first_name && data.firstName) {
          result.first_name = data.firstName;
        }
        if (!result.nickname && data.nickname) {
          result.nickname = data.nickname;
        }
        if (!result.photo_url && data.discordAvatarUrl) {
          result.photo_url = data.discordAvatarUrl;
        }
        result.is_discord_verified = Boolean(data.isDiscordVerified);
        result.discord_verified_at = data.discordVerifiedAt || null;
        result.is_ambassador = Boolean(data.isAmbassador);

        handleAuthSuccess(result, null);
      }
    } catch (err: unknown) {
      console.error('Auth submit error:', err);
      const message = err instanceof Error ? err.message : '認証処理中にエラーが発生しました';
      setErrorMsg(message);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCancelGoogleOnboarding = useCallback(() => {
    setGoogleOnboardingInfo(null);
    setErrorMsg(null);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col font-sans selection:bg-google-blue/20 selection:text-google-blue bg-black text-white">
      {/* 宇宙・星空背景 */}
      <StarField />

      {/* ヘッダー */}
      <Header apiStatus={apiStatus} isDark={true} />


      {/* Open Redirector 遮断警告 */}
      {!isRedirectUriValid && (
        <div className="w-full max-w-xl mx-auto px-4 mt-4">
          <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300 mb-1">未承認のリダイレクト先が指定されました</p>
              <p className="leading-relaxed">
                指定されたリダイレクト先 (<span className="font-mono underline">{oauthParams.redirectUri}</span>) はセキュリティポリシーにより許可されていません。フィッシングや不正アクセスの防止のため認証を中止します。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* エラーメッセージ */}
      {errorMsg && (
        <div className="w-full max-w-xl mx-auto px-4 mt-4">
          <div className="p-3.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm bg-red-900/30 border border-red-500/30 text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <span>{errorMsg}</span>
            </div>
          </div>
        </div>
      )}

      {/* リダイレクト待機中オーバーレイ */}
      {isRedirecting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
          <Loader2 className="w-10 h-10 text-google-blue animate-spin mb-4" />
          <p className="text-lg font-bold">認証が完了しました</p>
          <p className="text-sm text-gray-400 mt-1">
            元のアプリケーション (<span className="font-mono text-gray-200">{oauthParams.clientId}</span>) へリダイレクトしています...
          </p>
        </div>
      )}

      {/* メインフォーム */}
      <main className="flex-1 flex flex-col justify-center">
        {isRedirectUriValid ? (
          pending2FaAuth ? (
            <div className="w-full max-w-sm mx-auto px-4 py-8 animate-fade-in">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 text-neutral-100 shadow-xl">
                {/* ヘッダー */}
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    本人確認（Discord 連携）
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                    アカウント保護とアンバサダー資格確認のため、Discord の在籍確認を行います。
                  </p>
                </div>

                {/* 連携アカウント要約 */}
                <div className="border-y border-neutral-800 py-3 text-xs space-y-1.5 text-neutral-300">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Google アカウント</span>
                    <span className="font-medium text-white truncate max-w-[180px]">
                      {pending2FaAuth.googleEmail || pending2FaAuth.user.name || '連携アカウント'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">登録ユーザーID</span>
                    <span className="font-mono text-neutral-200">
                      @{pending2FaAuth.user.discord_user_id}
                    </span>
                  </div>
                </div>

                {pending2FaSession ? (
                  /* 常設ボタン式 2FA 待機中カード (API v2.0.0) */
                  <div className="space-y-4 animate-fade-in text-left">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0">
                        <img
                          src={pending2FaSession.avatarUrl || getDiscordAvatarUrl(pending2FaSession.userName)}
                          alt="Discord Avatar"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-white text-xs truncate">
                            {pending2FaSession.displayname || pending2FaSession.userName}
                          </span>
                          <span className="text-[10px] text-google-blue font-mono shrink-0">
                            承認待機中
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 font-mono truncate">
                          @{pending2FaSession.userName}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-800/80 space-y-1 text-xs">
                      <p className="text-white font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-google-blue shrink-0" />
                        <span>Discord公式サーバーで【承認】を押してください</span>
                      </p>
                      <p className="text-neutral-400 text-[11px] leading-relaxed">
                        公式サーバーの常設認証パネルのボタンを押すと、自動的に完了します。
                      </p>
                      {pending2FaRemainingSeconds !== null && (
                        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono pt-1">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          <span>有効期限: 残り約{Math.floor(pending2FaRemainingSeconds / 60)}分{String(pending2FaRemainingSeconds % 60).padStart(2, '0')}秒</span>
                        </div>
                      )}
                    </div>

                    {pending2FaSession.panelUrl && (
                      <a
                        href={pending2FaSession.panelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full min-h-[44px] rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Discord 認証パネルを開く</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={handleSkipPending2FaAsGuest}
                      className="w-full min-h-[44px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <span>認証をスキップして進む（ゲスト）</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCancelPending2Fa}
                      className="w-full py-2.5 text-neutral-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>キャンセルして戻る</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-left">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pending2FaDiscordInput" className="text-xs font-medium text-neutral-300">
                          Discord ユーザー名
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowDiscordHelp(true)}
                          className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                          aria-label="Discord ユーザー名の確認方法"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>確認方法</span>
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 z-20 text-neutral-500 font-mono text-sm pointer-events-none">
                          @
                        </span>
                        <input
                          id="pending2FaDiscordInput"
                          type="text"
                          value={pending2FaDiscordId.replace(/^@/, '')}
                          onChange={(e) => {
                            setPending2FaDiscordId(e.target.value);
                            if (twoFaError) setTwoFaError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleVerifyPending2Fa();
                            }
                          }}
                          placeholder="ユーザー名を入力"
                          autoComplete="off"
                          className="relative z-10 w-full h-11 pl-8 pr-4 rounded-xl border border-neutral-700 bg-neutral-950 text-white placeholder-neutral-500 text-sm font-medium transition focus:outline-none focus:border-google-blue"
                        />
                      </div>
                    </div>

                    {/* 本人確認へ進む ボタン */}
                    <button
                      type="button"
                      onClick={handleVerifyPending2Fa}
                      disabled={is2FaVerifying || pending2FaDiscordId.trim().replace(/^@/, '').length < 2}
                      className="w-full min-h-[44px] rounded-xl bg-google-blue hover:bg-blue-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {is2FaVerifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>サーバー在籍を確認中...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-white" />
                          <span>本人確認へ進む</span>
                        </>
                      )}
                    </button>

                    {/* ゲスト進行リンク */}
                    <div className="pt-0.5 text-center">
                      <button
                        type="button"
                        onClick={handleSkipPending2FaAsGuest}
                        className="text-[11px] text-neutral-400 hover:text-neutral-200 underline underline-offset-4 transition cursor-pointer"
                      >
                        アンバサダー認証をスキップして進む（ゲスト）
                      </button>
                    </div>

                    {twoFaError && (
                      <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex flex-col gap-2.5 animate-fade-in">
                        <div className="flex items-start gap-2.5">
                          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1 leading-relaxed">
                            <p className="font-semibold text-red-300 mb-0.5">本人確認が完了できませんでした</p>
                            <p className="text-red-300/90 text-[11px]">{twoFaError}</p>
                          </div>
                        </div>
                        {/* 🌟 エラー時にゲストとして進行できる導線 */}
                        <button
                          type="button"
                          onClick={handleSkipPending2FaAsGuest}
                          className="w-full min-h-[38px] px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>認証バッジを付与せずにゲストとして進む</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCancelPending2Fa}
                      className="w-full py-2.5 text-neutral-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>キャンセル / 別のアカウントでログイン</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <IntroScreen
              onContinue={handleIntroContinue}
              onGoogleSignIn={handleGoogleSignIn}
              onCancelGoogleOnboarding={handleCancelGoogleOnboarding}
              googleOnboardingInfo={googleOnboardingInfo}
              isSubmitting={isSubmitting || isRedirecting}
            />
          )
        ) : (
          <div className="w-full max-w-md mx-auto p-6 text-center text-gray-400">
            <p>無効なリクエストです。正しい認可リンクからアクセスしてください。</p>
          </div>
        )}
      </main>

      {/* Discord ユーザー名ガイドモーダル */}
      <DiscordUsernameHelpModal
        isOpen={showDiscordHelp}
        onClose={() => setShowDiscordHelp(false)}
      />

      {/* フッター */}
      <footer className="w-full py-8 text-center border-t border-white/10 text-gray-400">
        <div className="flex items-center justify-center gap-2.5 px-4">
          <img
            src={`${(import.meta.env.BASE_URL || './').replace(/\/+$/, '')}/techhub-logo.png`}
            alt="Google AI TechHub"
            className="h-5 w-auto object-contain"
          />
          <span className="text-xs sm:text-sm font-medium tracking-wide">
            powered by Google AI TechHub for Student Ambassador
          </span>
        </div>
      </footer>
    </div>
  );
};
