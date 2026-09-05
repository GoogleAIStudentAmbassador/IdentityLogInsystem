import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Upload,
  Check,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  XCircle,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { OrbitingStars } from './OrbitingStars';
import { verifyMoffyImage, fetchAuthConfig } from '../services/api';
import type { VerifyMoffyResponse, GradeType } from '../types';
import { GRADE_OPTIONS } from '../types';

export interface OnboardingData {
  discordUserId: string;
  password?: string;
  hasMoffy: boolean;
  uploadedPhoto: File | Blob | null;
  authMode: 'signin' | 'signup' | 'google_onboarding';
  grade: GradeType;
  university: string;
  tempToken?: string;
}

export interface GoogleOnboardingInfo {
  tempToken: string;
  email: string;
  name: string;
}

interface IntroScreenProps {
  onContinue: (data: OnboardingData) => void;
  onGoogleSignIn?: (credential: string) => void;
  onCancelGoogleOnboarding?: () => void;
  googleOnboardingInfo?: GoogleOnboardingInfo | null;
  initialId?: string;
  onStateChange?: (isSignedIn: boolean) => void;
  isSubmitting?: boolean;
}

function getInitialDiscordId(initialId: string): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('discord_id') || params.get('user_id') || initialId;
  }
  return initialId;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  onContinue,
  onGoogleSignIn,
  onCancelGoogleOnboarding,
  googleOnboardingInfo,
  initialId = '',
  onStateChange,
  isSubmitting = false,
}) => {
  const [internalIsSignedInOrUp, setInternalIsSignedInOrUp] = useState(false);
  const [internalAuthMode, setInternalAuthMode] = useState<'signin' | 'signup'>('signup');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isGisReady, setIsGisReady] = useState(false);
  const submitting = isSubmitting;

  const authMode: 'signin' | 'signup' | 'google_onboarding' = googleOnboardingInfo
    ? 'google_onboarding'
    : internalAuthMode;
  const isSignedInOrUp = !!googleOnboardingInfo || internalIsSignedInOrUp;

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // 入力フォームステート
  // 🌟 批判検証是正 1: Googleの表示名（実名）を Discord ID に自動代入せず、常にクリーンなDiscord ID入力を促す
  const defaultInitialId = React.useMemo(() => getInitialDiscordId(initialId), [initialId]);
  const [discordId, setDiscordId] = useState(defaultInitialId);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [grade, setGrade] = useState<GradeType>('B1');
  const [university, setUniversity] = useState('');
  const [hasMoffy, setHasMoffy] = useState<boolean | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 🌟 批判検証是正 4: 一度アンロックされたセクションの保持フラグ（入力中の突然の消失・CLSを防止）
  const [reachedSections, setReachedSections] = useState<{
    academic: boolean;
    moffy: boolean;
  }>({
    academic: false,
    moffy: false,
  });
  const [prevAuthMode, setPrevAuthMode] = useState(authMode);

  // モッフィーAI画像鑑定ステート (Gemini 3.8 Flash)
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyMoffyResponse | null>(null);
  const [verifyWarning, setVerifyWarning] = useState<string | null>(null);

  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 各セクション参照（自動スクロール用）
  const inputSectionRef = useRef<HTMLDivElement>(null);
  const passwordSectionRef = useRef<HTMLDivElement>(null);
  const confirmPasswordSectionRef = useRef<HTMLDivElement>(null);
  const academicSectionRef = useRef<HTMLDivElement>(null);
  const moffySectionRef = useRef<HTMLDivElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const continueSectionRef = useRef<HTMLDivElement>(null);

  // Google 初回登録オンボーディング情報が与えられた場合、自動でフォームへ遷移
  useEffect(() => {
    if (googleOnboardingInfo) {
      onStateChange?.(true);
      const timer = setTimeout(() => {
        inputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [googleOnboardingInfo, onStateChange]);

  // Google Identity Services (GIS) の初期化 & ボタンレンダリング
  // 🌟 批判検証是正 5: タイマーIDを確実に保持し、cleanup 関数で多重ポーリング・リソースリークを防止
  useEffect(() => {
    let isMounted = true;
    let checkGisInterval: ReturnType<typeof setInterval> | null = null;
    let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupGoogleGis = async () => {
      try {
        const config = await fetchAuthConfig();
        if (!isMounted) return;
        const clientId = config.google_client_id;

        checkGisInterval = setInterval(() => {
          if (window.google?.accounts?.id && googleBtnRef.current) {
            if (checkGisInterval) {
              clearInterval(checkGisInterval);
              checkGisInterval = null;
            }
            if (!isMounted) return;

            window.google.accounts.id.initialize({
              client_id: clientId,
              callback: (response) => {
                if (response?.credential && onGoogleSignIn) {
                  onGoogleSignIn(response.credential);
                }
              },
            });

            // 公式GISボタンのレンダリング
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'pill',
              width: 280,
              locale: 'ja',
            });

            setIsGisReady(true);
          }
        }, 100);

        fallbackTimeout = setTimeout(() => {
          if (checkGisInterval) {
            clearInterval(checkGisInterval);
            checkGisInterval = null;
          }
        }, 10000);
      } catch (err) {
        console.warn('GIS setup error:', err);
      }
    };

    setupGoogleGis();

    return () => {
      isMounted = false;
      if (checkGisInterval) clearInterval(checkGisInterval);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [onGoogleSignIn]);

  // 🌟 批判検証是正 6: GISスクリプト未ロード時の親切なエラー案内
  const handleFallbackGoogleClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError(
        'Google連携スクリプトの読み込みが制限されているか、オフライン環境です。広告ブロッカーの設定をご確認いただくか、通常のサインイン / サインアップをご利用ください。'
      );
    }
  };

  // --- パスワード強度バリデーション ---
  // 1. 8文字以上
  const hasMinLength = password.length >= 8;
  // 2. 英語大文字 (A-Z) 含有
  const hasUppercase = /[A-Z]/.test(password);
  // 3. 数字 (0-9) 含有
  const hasNumber = /[0-9]/.test(password);
  // 総合強度スコア (0〜3)
  const passwordStrengthScore =
    (hasMinLength ? 1 : 0) + (hasUppercase ? 1 : 0) + (hasNumber ? 1 : 0);
  const isPasswordStrong = hasMinLength && hasUppercase && hasNumber;

  // --- 入力完了判定 ---
  // 1. UserID完了（3文字以上の英数字）
  const isIdCompleted = discordId.trim().length >= 3;

  // 2. パスワード完了（サインアップ時は強度3条件すべて必須、サインイン時は8文字以上、google_onboarding時は不要）
  const isPasswordCompleted =
    authMode === 'google_onboarding'
      ? true
      : authMode === 'signup'
      ? isPasswordStrong
      : password.length >= 8;

  // 3. 確認用パスワード完了（サインアップ時は一致、サインイン・google_onboarding時は不要）
  const isConfirmPasswordCompleted =
    authMode === 'signup'
      ? confirmPassword.length >= 8 && confirmPassword === password
      : true;

  // パスワード認証フェーズ全体の完了
  const isAuthCompleted =
    authMode === 'google_onboarding'
      ? isIdCompleted
      : isIdCompleted && isPasswordCompleted && isConfirmPasswordCompleted;

  // 4. 大学名・学年完了判定（サインアップまたはgoogle_onboarding時は1文字以上入力必須）
  const isUniversityCompleted =
    authMode === 'signin' ? true : university.trim().length >= 1;

  const isProfileCompleted =
    authMode === 'signin' ? isAuthCompleted : isAuthCompleted && isUniversityCompleted;

  // 🌟 批判検証是正 4: 一度アンロックされたセクションの保持（入力中の突然の消失・CLSを防止）
  // React公式推奨パターン（Adjusting state during rendering）で余計なEffectやカスケードレンダリングを完全排除
  if (authMode !== prevAuthMode) {
    setPrevAuthMode(authMode);
    setReachedSections({ academic: false, moffy: false });
  }

  const canUnlockAcademic =
    (authMode === 'signup' && isConfirmPasswordCompleted) ||
    (authMode === 'google_onboarding' && isIdCompleted);
  if (!reachedSections.academic && canUnlockAcademic) {
    setReachedSections((prev) => ({ ...prev, academic: true }));
  }

  const canUnlockMoffy =
    (authMode === 'signup' || authMode === 'google_onboarding') && isProfileCompleted;
  if (!reachedSections.moffy && canUnlockMoffy) {
    setReachedSections((prev) => ({ ...prev, moffy: true }));
  }

  // 5. モッフィー所持ステップ完了判定
  const isMoffyStepCompleted =
    authMode === 'signin'
      ? true
      : hasMoffy === false ||
        (hasMoffy === true &&
          uploadedFile !== null &&
          !isVerifying &&
          (verifyResult?.is_moffy === true || verifyWarning !== null));

  // 続行可能かどうかの判定
  const isContinueAvailable =
    authMode === 'signin'
      ? isIdCompleted && isPasswordCompleted
      : isProfileCompleted && isMoffyStepCompleted;

  // 🌟 現在フォーカスすべきターゲット（星々が周回する対象）
  const getActiveTarget = (): 'id' | 'password' | 'confirmPassword' | 'academic' | 'moffy' | 'upload' | 'continue' => {
    if (!isIdCompleted) return 'id';
    if (authMode !== 'google_onboarding') {
      if (!isPasswordCompleted) return 'password';
      if (authMode === 'signup' && !isConfirmPasswordCompleted) return 'confirmPassword';
    }
    if (authMode !== 'signin') {
      if (!isUniversityCompleted) return 'academic';
      if (hasMoffy === null) return 'moffy';
      if (
        hasMoffy === true &&
        (!uploadedFile || isVerifying || (verifyResult && !verifyResult.is_moffy && !verifyWarning))
      ) {
        return 'upload';
      }
    }
    return 'continue';
  };
  const activeTarget = getActiveTarget();

  // ヒーローのサインイン / サインアップ押下時
  const handleSelectAuthMode = (mode: 'signin' | 'signup') => {
    if (isTransitioning) return;
    setInternalAuthMode(mode);
    setIsTransitioning(true);

    setTimeout(() => {
      setInternalIsSignedInOrUp(true);
      onStateChange?.(true);

      setTimeout(() => {
        inputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }, 400);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 1000);
  };

  // 新しい項目が出現した際に、視線を自然に下へスクロール誘導
  useEffect(() => {
    if (isIdCompleted && !isPasswordCompleted) {
      passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isIdCompleted, isPasswordCompleted]);

  useEffect(() => {
    if (authMode === 'signup' && isPasswordCompleted && !isConfirmPasswordCompleted) {
      confirmPasswordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [authMode, isPasswordCompleted, isConfirmPasswordCompleted]);

  useEffect(() => {
    if (authMode === 'signup' && isConfirmPasswordCompleted && !isUniversityCompleted) {
      academicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [authMode, isConfirmPasswordCompleted, isUniversityCompleted]);

  useEffect(() => {
    if (authMode === 'signup' && isProfileCompleted && hasMoffy === null) {
      moffySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [authMode, isProfileCompleted, hasMoffy]);

  useEffect(() => {
    if (authMode === 'signup') {
      if (hasMoffy === true && !uploadedFile) {
        uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (isMoffyStepCompleted) {
        continueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else if (authMode === 'signin' && isPasswordCompleted) {
      continueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [authMode, hasMoffy, uploadedFile, isMoffyStepCompleted, isPasswordCompleted]);

  // 画像アップロードハンドラ（Gemini 3.8 Flash によるリアルタイムAI画像鑑定つき）
  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('画像ファイル（PNG, JPG, WEBP等）を選択してください');
      return;
    }
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError('ファイルサイズは10MB以下にしてください');
      return;
    }
    setError(null);
    setVerifyWarning(null);
    setVerifyResult(null);
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // AI鑑定の開始
    setIsVerifying(true);
    try {
      const result = await verifyMoffyImage(file);
      setVerifyResult(result);
      if (!result.is_moffy) {
        setError('アップロードされた画像はモッフィーの公式特徴を満たしていません');
      }
    } catch (err: unknown) {
      console.warn('AI verification fallback:', err);
      // APIキー未設定やネットワークエラー時は開発を止めないよう警告付きでフォールバック
      setVerifyWarning('※AI鑑定サーバーに接続できませんでした（オフライン承認モード）');
    } finally {
      setIsVerifying(false);
    }
  };


  // 続行するボタン押下
  const handleContinueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!isIdCompleted) {
      setError('Discord User IDを入力してください');
      return;
    }

    const cleanUniversity = university.replace(/[\r\n\t]/g, ' ').trim().slice(0, 50);

    if (authMode === 'google_onboarding') {
      if (!cleanUniversity) {
        setError('大学名または所属機関を入力してください');
        return;
      }
      if (hasMoffy === null) {
        setError('モッフィーを所持しているか選択してください');
        return;
      }
      if (hasMoffy === true) {
        if (!uploadedFile) {
          setError('モッフィー画像をアップロードしてください');
          return;
        }
        if (isVerifying) {
          setError('AIがモッフィー画像を鑑定中です。完了まで少しお待ちください');
          return;
        }
        if (verifyResult && !verifyResult.is_moffy && !verifyWarning) {
          setError('モッフィーの公式特徴（鼻なし・四芒星瞳など）を満たした画像をアップロードしてください');
          return;
        }
      }

      setError(null);
      onContinue({
        discordUserId: discordId.trim(),
        hasMoffy: !!hasMoffy,
        uploadedPhoto: uploadedFile,
        authMode: 'google_onboarding',
        grade,
        university: cleanUniversity,
        tempToken: googleOnboardingInfo?.tempToken,
      });
      return;
    }

    if (authMode === 'signin') {
      if (!isPasswordCompleted) {
        setError('パスワードを入力してください');
        return;
      }
    } else if (authMode === 'signup') {
      if (!isPasswordStrong) {
        setError('パスワードは大文字・数字を含む8文字以上で設定してください');
        return;
      }
      if (!isConfirmPasswordCompleted) {
        setError('確認用パスワードが一致していません');
        return;
      }
      if (!cleanUniversity) {
        setError('大学名または所属機関を入力してください');
        return;
      }
      if (hasMoffy === null) {
        setError('モッフィーを所持しているか選択してください');
        return;
      }
      if (hasMoffy === true) {
        if (!uploadedFile) {
          setError('モッフィー画像をアップロードしてください');
          return;
        }
        if (isVerifying) {
          setError('AIがモッフィー画像を鑑定中です。完了まで少しお待ちください');
          return;
        }
        if (verifyResult && !verifyResult.is_moffy && !verifyWarning) {
          setError('モッフィーの公式特徴（鼻なし・四芒星瞳など）を満たした画像をアップロードしてください');
          return;
        }
      }
    }

    setError(null);

    onContinue({
      discordUserId: discordId.trim(),
      password,
      hasMoffy: !!hasMoffy,
      uploadedPhoto: uploadedFile,
      authMode,
      grade,
      university: cleanUniversity,
    });
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* ============================================================ */}
      {/* セクション1：ファーストビュー（黒背景・タイトル・発光星・2択ボタン） */}
      {/* ============================================================ */}
      <section className="min-h-[85dvh] sm:min-h-[90dvh] w-full max-w-sm px-6 flex flex-col items-center justify-center text-center relative py-12">
        {/* メインタイトルエリア（フェードイン表示） */}
        <div className="animate-fade-in mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.25] mb-2 text-white">
            Google AI<br />
            Student Ambassador
          </h1>

          <p className="text-xs sm:text-sm font-medium tracking-wide text-gray-400">
            EVENT CHECK-IN SYSTEM
          </p>
        </div>

        {/* 中央の星（白く発光するGeminiスター） */}
        <div className="my-6 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* 星の背後のオーラ光彩 */}
            <div className="absolute w-36 h-36 rounded-full blur-2xl transition-all duration-700 bg-white/20 animate-pulse" />

            {/* 白く発光するGeminiスター */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 transition-transform duration-500 animate-star-breathe">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full transition-all duration-700 fill-white drop-shadow-[0_0_25px_rgba(255,255,255,0.95)]"
              >
                <path d="M 50 5 Q 50 50 5 50 Q 50 50 50 95 Q 50 50 95 50 Q 50 50 50 5 Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 認証アクションエリア */}
        <div className="w-full flex flex-col items-center gap-3 mt-4">
          {/* ============================================================ */}
          {/* Googleアカウントで連携 (推奨) */}
          {/* ============================================================ */}
          <div className="w-full flex flex-col items-center">
            {/* 推奨バッジ */}
            <div className="mb-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-[11px] font-bold text-blue-300 shadow-sm flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Googleアカウントで連携 (推奨)</span>
            </div>

            <div className="relative w-full flex justify-center items-center">
              {/* GIS公式ボタン描画コンテナ */}
              <div
                ref={googleBtnRef}
                className="min-h-[44px] flex items-center justify-center transition-opacity duration-300"
              />

              {/* GISスクリプト読み込み中または未描画時のフォールバックボタン */}
              {!isGisReady && (
                <button
                  type="button"
                  onClick={handleFallbackGoogleClick}
                  disabled={submitting}
                  className="w-full max-w-[280px] h-11 px-4 rounded-full bg-white hover:bg-gray-100 active:scale-[0.98] text-gray-800 font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-3 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Googleでログイン・連携</span>
                </button>
              )}
            </div>
          </div>

          {/* 区切り線（または） */}
          <div className="w-full flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-700/80" />
            <span className="text-[11px] font-medium text-gray-400">または</span>
            <div className="flex-1 h-px bg-gray-700/80" />
          </div>

          {/* サインイン ＆ サインアップ 2つのボタン */}
          <div className="w-full grid grid-cols-2 gap-3">
            {/* サインインボタン */}
            <button
              type="button"
              onClick={() => handleSelectAuthMode('signin')}
              disabled={isTransitioning}
              className={`h-14 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                isSignedInOrUp && authMode === 'signin'
                  ? 'bg-google-blue text-white shadow-md'
                  : isSignedInOrUp
                  ? 'bg-gray-800 text-gray-300 border border-gray-700'
                  : 'bg-white/10 text-white border border-white/20 hover:bg-white hover:text-black hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>サインイン</span>
            </button>

            {/* サインアップボタン */}
            <button
              type="button"
              onClick={() => handleSelectAuthMode('signup')}
              disabled={isTransitioning}
              className={`h-14 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                isSignedInOrUp && authMode === 'signup'
                  ? 'bg-google-blue text-white shadow-md'
                  : isSignedInOrUp
                  ? 'bg-gray-800 text-gray-300 border border-gray-700'
                  : 'bg-white text-black shadow-[0_0_35px_rgba(255,255,255,0.6)] hover:shadow-[0_0_50px_rgba(255,255,255,0.9)] hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>サインアップ</span>
            </button>
          </div>

          {/* サインイン後に下スクロールを促すインジケータ */}
          {isSignedInOrUp && (
            <div className="mt-8 flex flex-col items-center animate-bounce text-gray-300 text-xs gap-1">
              <span>下へスクロールして入力を進めてください</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* セクション2：縦スクロールで自動フェードイン連鎖する入力エリア */}
      {/* ============================================================ */}
      {isSignedInOrUp && (
        <section
          ref={inputSectionRef}
          className="min-h-screen w-full max-w-sm px-6 py-16 flex flex-col items-center text-center animate-fade-in"
        >
          {/* フォームヘッダー */}
          <div className="w-full text-left mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/50 text-[11px] font-semibold text-blue-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping" />
                <span>
                  {authMode === 'google_onboarding'
                    ? 'GOOGLE ACCOUNT LINKED'
                    : authMode === 'signup'
                    ? 'NEW AMBASSADOR'
                    : 'AMBASSADOR SIGN-IN'}
                </span>
              </div>
              {authMode === 'google_onboarding' && onCancelGoogleOnboarding && (
                <button
                  type="button"
                  onClick={onCancelGoogleOnboarding}
                  className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 hover:border-gray-500 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Google連携を解除</span>
                </button>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {authMode === 'signin' ? 'チェックイン認証' : 'あなたについて聞かせて？'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {authMode === 'google_onboarding'
                ? `Google連携中: ${googleOnboardingInfo?.email || ''} (パスワード入力は不要です)`
                : authMode === 'signup'
                ? '入力が完了すると自動的に次の項目が開きます'
                : '登録済みのDiscord IDとパスワードでサインインします'}
            </p>
          </div>

          <form onSubmit={handleContinueSubmit} className="w-full space-y-8 text-left">
            {/* ------------------------------------------------------------ */}
            {/* 1. Discord User ID */}
            {/* ------------------------------------------------------------ */}
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="discordId" className="text-xs font-bold text-gray-300">
                  1. Discord User ID
                </label>
                {isIdCompleted && (
                  <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 animate-fade-in">
                    <Check className="w-3.5 h-3.5" />
                    入力済み
                  </span>
                )}
              </div>

              <div className="relative w-full">
                {/* 🌟 星々は現在アクティブな項目の周りを周回 */}
                {activeTarget === 'id' && <OrbitingStars count={5} isDark={true} />}

                <input
                  id="discordId"
                  type="text"
                  value={discordId}
                  onChange={(e) => {
                    setDiscordId(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Discord User ID を入力"
                  autoComplete="off"
                  autoFocus
                  className={`relative z-10 w-full h-14 px-5 rounded-full border-2 bg-gray-900/80 text-white placeholder-gray-500 text-base font-medium transition shadow-sm focus:outline-none ${
                    isIdCompleted ? 'border-gray-600 ring-2 ring-emerald-500/20' : 'border-gray-600 focus:border-google-blue'
                  }`}
                />
              </div>

              {/* 控えめなヘルプ */}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-[11px] text-gray-400 hover:text-gray-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>IDの調べ方</span>
                </button>
              </div>

              {showGuide && (
                <div className="p-3.5 rounded-2xl bg-gray-800 border border-gray-700 text-left text-xs text-gray-300 space-y-1 mt-2 animate-fade-in">
                  <p className="font-semibold text-gray-200">Discord User IDの確認手順:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-gray-400">
                    <li>Discordの「ユーザー設定 ⚙️」を開く</li>
                    <li>「詳細設定」で「開発者モード」をON</li>
                    <li>自分のアイコンを右クリック →「ユーザーIDをコピー」</li>
                  </ol>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------ */}
            {/* 2. パスワード入力（Googleオンボーディング時はスキップ） */}
            {/* ------------------------------------------------------------ */}
            {authMode !== 'google_onboarding' && isIdCompleted && (
              <div ref={passwordSectionRef} className="animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="pass" className="text-xs font-bold text-gray-300">
                    2. パスワード {authMode === 'signup' ? '(8文字以上・大文字・数字)' : '(8文字以上)'}
                  </label>
                  {isPasswordCompleted && (
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 animate-fade-in">
                      <Check className="w-3.5 h-3.5" />
                      OK
                    </span>
                  )}
                </div>

                <div className="relative w-full">
                  {/* 🌟 パスワード入力中は星がここを周回 */}
                  {activeTarget === 'password' && <OrbitingStars count={5} isDark={true} />}

                  <input
                    id="pass"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={authMode === 'signup' ? "8文字以上（英大文字・数字を含む）" : "8文字以上のパスワード"}
                    className="relative z-10 w-full h-14 pl-5 pr-12 rounded-full border border-gray-600 bg-gray-900/80 text-white placeholder-gray-500 text-base font-medium focus:bg-gray-900 focus:border-google-blue focus:ring-4 focus:ring-google-blue/10 focus:outline-none transition shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-gray-400 hover:text-gray-200 p-1.5 cursor-pointer transition-colors"
                    title={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* サインアップ時のパスワード強度インジケーター */}
                {authMode === 'signup' && (
                  <div className="mt-2.5 space-y-2 animate-fade-in">
                    {/* 強度バー */}
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex gap-1">
                      <div
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          passwordStrengthScore >= 1
                            ? passwordStrengthScore === 1
                              ? 'bg-red-500'
                              : passwordStrengthScore === 2
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                            : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          passwordStrengthScore >= 2
                            ? passwordStrengthScore === 2
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                            : 'bg-transparent'
                        }`}
                      />
                      <div
                        className={`h-full flex-1 rounded-full transition-all duration-300 ${
                          passwordStrengthScore >= 3 ? 'bg-emerald-500' : 'bg-transparent'
                        }`}
                      />
                    </div>

                    {/* 要件チェックマーク */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 transition-colors ${
                          hasMinLength ? 'text-emerald-400 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {hasMinLength ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
                        )}
                        8文字以上
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 transition-colors ${
                          hasUppercase ? 'text-emerald-400 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {hasUppercase ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
                        )}
                        英大文字 (A-Z)
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 transition-colors ${
                          hasNumber ? 'text-emerald-400 font-medium' : 'text-gray-400'
                        }`}
                      >
                        {hasNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
                        )}
                        数字 (0-9)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 3. 確認用パスワード（サインアップ時のみ自動フェードイン） */}
            {/* ------------------------------------------------------------ */}
            {authMode === 'signup' && isPasswordCompleted && (
              <div ref={confirmPasswordSectionRef} className="animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="confirmPass" className="text-xs font-bold text-gray-300">
                    3. パスワード（確認用）
                  </label>
                  {isConfirmPasswordCompleted && confirmPassword.length > 0 && (
                    <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 animate-fade-in">
                      <Check className="w-3.5 h-3.5" />
                      一致
                    </span>
                  )}
                </div>

                <div className="relative w-full">
                  {/* 🌟 確認用パスワード入力中は星がここを周回 */}
                  {activeTarget === 'confirmPassword' && <OrbitingStars count={5} isDark={true} />}

                  <input
                    id="confirmPass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="もう一度パスワードを入力"
                    className="relative z-10 w-full h-14 pl-5 pr-12 rounded-full border border-gray-600 bg-gray-900/80 text-white placeholder-gray-500 text-base font-medium focus:bg-gray-900 focus:border-google-blue focus:ring-4 focus:ring-google-blue/10 focus:outline-none transition shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-gray-400 hover:text-gray-200 p-1.5 cursor-pointer transition-colors"
                    title={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 4. 大学名・学年入力（サインアップまたはGoogleオンボーディング時） */}
            {/* ------------------------------------------------------------ */}
            {((authMode === 'signup' && (isAuthCompleted || reachedSections.academic)) ||
              (authMode === 'google_onboarding' && isIdCompleted)) && (
              <div ref={academicSectionRef} className="animate-fade-in pt-4 border-t border-gray-700 space-y-4">
                {/* 大学名 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="universityInput" className="text-xs font-bold text-gray-300">
                      {authMode === 'google_onboarding' ? '2. 大学名 / 所属機関' : '4. 大学名 / 所属機関'}
                    </label>
                    {isUniversityCompleted && (
                      <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1 animate-fade-in">
                        <Check className="w-3.5 h-3.5" />
                        OK
                      </span>
                    )}
                  </div>

                  <div className="relative w-full">
                    {/* 🌟 所属情報入力中は星がここを周回 */}
                    {activeTarget === 'academic' && <OrbitingStars count={5} isDark={true} />}

                    <input
                      id="universityInput"
                      type="text"
                      maxLength={50}
                      value={university}
                      onChange={(e) => {
                        setUniversity(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="例: 東京大学 / 日本大学"
                      className="relative z-10 w-full h-14 px-5 rounded-full border border-gray-600 bg-gray-900/80 text-white placeholder-gray-500 text-base font-medium focus:bg-gray-900 focus:border-google-blue focus:ring-4 focus:ring-google-blue/10 focus:outline-none transition shadow-sm"
                    />
                  </div>
                </div>

                {/* 学年選択 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="gradeSelect" className="text-xs font-bold text-gray-300">
                      学年
                    </label>
                    <span className="text-[11px] font-mono text-gray-400">{grade}</span>
                  </div>

                  <div className="relative w-full">
                    <select
                      id="gradeSelect"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value as GradeType)}
                      className="relative z-10 w-full h-14 px-5 pr-10 rounded-full border border-gray-600 bg-gray-900/80 text-white text-sm font-medium focus:bg-gray-900 focus:border-google-blue focus:ring-4 focus:ring-google-blue/10 focus:outline-none transition shadow-sm appearance-none cursor-pointer"
                    >
                      {GRADE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 z-20">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 5. 「モッフィーをすでに持っていますか？」（サインアップまたはGoogleオンボーディング時） */}
            {/* ------------------------------------------------------------ */}
            {(authMode === 'signup' || authMode === 'google_onboarding') &&
              (isProfileCompleted || reachedSections.moffy) && (
              <div ref={moffySectionRef} className="animate-fade-in pt-4 border-t border-gray-700">
                <label className="text-xs font-bold text-gray-300 block mb-3 text-center">
                  {authMode === 'google_onboarding' ? '3. モッフィーをすでに持っていますか？' : '5. モッフィーをすでに持っていますか？'}
                </label>

                <div className="relative w-full">
                  {/* 🌟 モッフィー選択時は星が2択ボタンの周りを周回 */}
                  {activeTarget === 'moffy' && <OrbitingStars count={5} isDark={true} />}

                  <div className="relative z-10 grid grid-cols-2 gap-3">
                    {/* 「はい」ボタン */}
                    <button
                      type="button"
                      onClick={() => setHasMoffy(true)}
                      className={`h-13 rounded-2xl font-medium text-sm transition-all duration-200 border cursor-pointer ${
                        hasMoffy === true
                          ? 'bg-google-blue text-white border-google-blue shadow-sm'
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      はい
                    </button>

                    {/* 「いいえ」ボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        setHasMoffy(false);
                        setUploadedFile(null);
                        setPreviewUrl(null);
                        setVerifyResult(null);
                        setVerifyWarning(null);
                        setError(null);
                      }}
                      className={`h-13 rounded-2xl font-medium text-sm transition-all duration-200 border cursor-pointer ${
                        hasMoffy === false
                          ? 'bg-google-blue text-white border-google-blue shadow-sm'
                          : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      いいえ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 6. 画像アップロードフォーム（サインアップまたはGoogleオンボーディングで「はい」の場合） */}
            {/* ------------------------------------------------------------ */}
            {(authMode === 'signup' || authMode === 'google_onboarding') && hasMoffy === true && (
              <div ref={uploadSectionRef} className="animate-fade-in pt-2">
                <label className="text-xs font-bold text-gray-300 block mb-2">
                  {authMode === 'google_onboarding' ? '4. モッフィー画像をアップロード' : '6. モッフィー画像をアップロード'}
                </label>

                <div className="relative w-full">
                  {/* 🌟 アップロード待ちのときは星がここを周回 */}
                  {activeTarget === 'upload' && <OrbitingStars count={5} isDark={true} />}

                  {previewUrl ? (
                    <div className="relative z-10 rounded-3xl border border-gray-700 bg-gray-800 p-4 flex flex-col gap-3 animate-fade-in">
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 shrink-0">
                          <img
                            src={previewUrl}
                            alt="Uploaded preview"
                            className="w-16 h-16 rounded-2xl object-cover border border-gray-600 shadow-sm"
                          />
                          {isVerifying && (
                            <div className="absolute inset-0 rounded-2xl bg-black/60 backdrop-blur-xs flex items-center justify-center">
                              <Loader2 className="w-6 h-6 text-google-blue animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 text-left truncate">
                          <p className="text-xs font-semibold text-gray-300 truncate">
                            {uploadedFile instanceof File ? uploadedFile.name : 'uploaded_photo.png'}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </div>
                        <label className="px-3 py-1.5 rounded-full bg-gray-700 border border-gray-600 text-xs font-medium text-gray-300 hover:bg-gray-600 cursor-pointer shadow-xs">
                          変更
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>

                      {/* AI鑑定中 */}
                      {isVerifying && (
                        <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-800/60 text-xs text-blue-200 flex items-center gap-2.5 animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                          <div className="flex-1">
                            <span className="font-semibold">Gemini 3.8 Flash で鑑定中...</span>
                            <p className="text-[10px] text-blue-300/80">モッフィーの公式特徴（鼻なし・四芒星瞳・Geminiカラー）をスキャンしています</p>
                          </div>
                        </div>
                      )}

                      {/* AI鑑定結果: 合格 */}
                      {!isVerifying && verifyResult?.is_moffy && (
                        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span>公式モッフィー認定！</span>
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
                              適合度 {Math.round(verifyResult.confidence_score * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                            {verifyResult.reason}
                          </p>
                          {/* 5大チェック項目のパス一覧 */}
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-emerald-300/90 pt-1 border-t border-emerald-800/40">
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>鼻なし（規約準拠）</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>四芒星ハイライト</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>Geminiカラー虹彩</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>ふわふわ3DCG質感</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI鑑定結果: 不合格 */}
                      {!isVerifying && verifyResult && !verifyResult.is_moffy && (
                        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-red-300">
                              <XCircle className="w-4 h-4 text-red-400" />
                              <span>モッフィーとして認識されませんでした</span>
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/50">
                              適合度 {Math.round(verifyResult.confidence_score * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-red-200/90 leading-relaxed">
                            {verifyResult.reason}
                          </p>
                          {/* 未達項目の明示 */}
                          <div className="space-y-1 text-[10px] text-red-300/90 pt-1 border-t border-red-800/40">
                            {verifyResult.checks && !verifyResult.checks.has_no_nose && (
                              <div className="flex items-center gap-1 text-red-400">
                                <span>⚠️ 鼻が検出されました（モッフィーは鼻なしが公式ルールです）</span>
                              </div>
                            )}
                            {verifyResult.checks && !verifyResult.checks.has_four_pointed_star_pupils && (
                              <div className="flex items-center gap-1 text-red-400">
                                <span>⚠️ 瞳に白い四芒星ハイライトがありません</span>
                              </div>
                            )}
                            {verifyResult.checks && !verifyResult.checks.has_gemini_or_magical_eyes && (
                              <div className="flex items-center gap-1 text-red-400">
                                <span>⚠️ Geminiブランドカラーの瞳が確認できません</span>
                              </div>
                            )}
                            {verifyResult.checks && !verifyResult.checks.is_fluffy_3dcg && (
                              <div className="flex items-center gap-1 text-red-400">
                                <span>⚠️ ふわふわの3DCGぬいぐるみ質感が確認できません</span>
                              </div>
                            )}
                          </div>
                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setHasMoffy(false);
                                setUploadedFile(null);
                                setPreviewUrl(null);
                                setVerifyResult(null);
                                setVerifyWarning(null);
                                setError(null);
                              }}
                              className="text-[11px] text-red-300 underline hover:text-white cursor-pointer"
                            >
                              モッフィーを持っていない（後で生成する）に変更
                            </button>
                          </div>
                        </div>
                      )}

                      {/* オフライン/フォールバック警告 */}
                      {!isVerifying && verifyWarning && (
                        <div className="p-2.5 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-[11px]">{verifyWarning}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className="relative z-10 flex flex-col items-center justify-center w-full h-36 rounded-3xl border-2 border-dashed border-gray-600 hover:border-google-blue bg-gray-800/60 hover:bg-gray-800/80 transition-all cursor-pointer p-4 group">
                      <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-google-blue" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300">
                        タップして画像を選択
                      </span>
                      <span className="text-[11px] text-gray-500 mt-0.5">
                        PNG, JPG, WEBP (最大 5MB)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* エラーメッセージ */}
            {error && (
              <div className="p-3 rounded-2xl bg-red-900/50 border border-red-800 text-red-300 text-xs font-medium text-center animate-fade-in mt-4">
                {error}
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 6. 続行 / サインイン ボタン（自動フェードイン） */}
            {/* ------------------------------------------------------------ */}
            {isContinueAvailable && (
              <div ref={continueSectionRef} className="animate-fade-in pt-4">
                <div className="relative w-full">
                  {/* 🌟 最後のボタン押下時は星がボタンの周囲を周回 */}
                  {activeTarget === 'continue' && <OrbitingStars count={5} isDark={true} />}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="relative z-10 w-full h-14 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none text-white font-semibold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>処理中...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {authMode === 'signin'
                            ? 'サインインする'
                            : authMode === 'google_onboarding'
                            ? '登録を完了してはじめる'
                            : '続行する'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>
      )}
    </div>
  );
};

export default IntroScreen;
