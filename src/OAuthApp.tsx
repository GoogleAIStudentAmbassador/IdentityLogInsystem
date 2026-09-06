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
import { AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

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
      redirectUri: './index.html',
      state: '',
      scope: 'profile',
      responseType: 'token',
    };
  }

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || 'moffy-personality-quiz';
  
  // デフォルトのリダイレクト先は同階層の index.html (性格診断ページ)
  const defaultRedirect = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/index.html`;
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
      };

      const extractedMbti =
        extractMbtiFromUrl(userResult.arranged_photo_url) ||
        extractMbtiFromUrl(userResult.default_photo_url) ||
        extractMbtiFromUrl(userResult.photo_url);
      if (extractedMbti) {
        userResult.mbti = extractedMbti;
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
   * 通常サインイン / 新規登録 / Googleオンボーディング登録
   */
  const handleIntroContinue = async (data: OnboardingData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (data.authMode === 'signin') {
        // 既存ユーザー サインイン
        const { user, token } = await loginUser(data.discordUserId, data.password || '');
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
          photo: data.uploadedPhoto,
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
          photo_url: res.user.photo_url || null,
          default_photo_url: res.user.default_photo_url || null,
          arranged_photo_url: res.user.arranged_photo_url || null,
          grade: res.user.grade || data.grade,
          university: res.user.university || data.university,
          is_staff: !!res.user.is_staff,
          created_at: res.user.created_at,
          updated_at: res.user.updated_at,
          google_id: res.user.google_id || null,
        };

        handleAuthSuccess(userResult, res.access_token);
      } else {
        // 通常新規登録 (サインアップ)
        const result = await registerUserProfile(data.discordUserId, data.password || '', {
          name: data.name,
          lastName: data.lastName,
          firstName: data.firstName,
          nickname: data.nickname,
          grade: data.grade,
          university: data.university,
          photoBlob: data.uploadedPhoto,
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

        handleAuthSuccess(result, null);
      }
    } catch (err: unknown) {
      console.error('Auth submit error:', err);
      const message = err instanceof Error ? err.message : '認証処理中にエラーが発生しました';
      setErrorMsg(message);
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

      {/* OAuth認可情報バナー */}
      <div className="w-full max-w-xl mx-auto px-4 pt-4">
        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-google-blue shrink-0" />
            <span>
              アプリケーション <span className="text-white font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded">{oauthParams.clientId}</span> への認可
            </span>
          </div>
          <span className="text-gray-400 text-[11px] hidden sm:inline">OAuth 2.0 Auth Hub</span>
        </div>
      </div>

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
          <IntroScreen
            onContinue={handleIntroContinue}
            onGoogleSignIn={handleGoogleSignIn}
            onCancelGoogleOnboarding={handleCancelGoogleOnboarding}
            googleOnboardingInfo={googleOnboardingInfo}
            isSubmitting={isSubmitting || isRedirecting}
          />
        ) : (
          <div className="w-full max-w-md mx-auto p-6 text-center text-gray-400">
            <p>無効なリクエストです。正しい認可リンクからアクセスしてください。</p>
          </div>
        )}
      </main>

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
