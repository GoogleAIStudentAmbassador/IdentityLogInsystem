import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, HelpCircle, Sparkles, CheckCircle2, ChevronDown, Upload, Check } from 'lucide-react';
import { OrbitingStars } from './OrbitingStars';

export interface OnboardingData {
  discordUserId: string;
  password: string;
  hasMoffy: boolean;
  uploadedPhoto: File | Blob | null;
  authMode: 'signin' | 'signup';
}

interface IntroScreenProps {
  onContinue: (data: OnboardingData) => void;
  initialId?: string;
  onStateChange?: (isSignedIn: boolean) => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  onContinue,
  initialId = '',
  onStateChange,
}) => {
  const [isSignedInOrUp, setIsSignedInOrUp] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 入力フォームステート
  const [discordId, setDiscordId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('discord_id') || params.get('user_id') || initialId;
    }
    return initialId;
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasMoffy, setHasMoffy] = useState<boolean | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 各セクション参照（自動スクロール用）
  const inputSectionRef = useRef<HTMLDivElement>(null);
  const passwordSectionRef = useRef<HTMLDivElement>(null);
  const confirmPasswordSectionRef = useRef<HTMLDivElement>(null);
  const moffySectionRef = useRef<HTMLDivElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const continueSectionRef = useRef<HTMLDivElement>(null);

  // --- 入力完了判定 ---
  // 1. UserID完了（3文字以上の英数字）
  const isIdCompleted = discordId.trim().length >= 3;

  // 2. パスワード完了（8文字以上）
  const isPasswordCompleted = password.length >= 8;

  // 3. 確認用パスワード完了（サインアップ時は一致、サインイン時は不要）
  const isConfirmPasswordCompleted =
    authMode === 'signup'
      ? confirmPassword.length >= 8 && confirmPassword === password
      : true;

  // パスワード認証フェーズ全体の完了
  const isAuthCompleted = isIdCompleted && isPasswordCompleted && isConfirmPasswordCompleted;

  // 4. モッフィー所持ステップ完了判定（サインアップ時のみ）
  const isMoffyStepCompleted =
    hasMoffy === false || (hasMoffy === true && uploadedFile !== null);

  // 続行可能かどうかの判定
  const isContinueAvailable =
    authMode === 'signin'
      ? isIdCompleted && isPasswordCompleted
      : isAuthCompleted && isMoffyStepCompleted;

  // 🌟 現在フォーカスすべきターゲット（星々が周回する対象）
  const getActiveTarget = (): 'id' | 'password' | 'confirmPassword' | 'moffy' | 'upload' | 'continue' => {
    if (!isIdCompleted) return 'id';
    if (!isPasswordCompleted) return 'password';
    if (authMode === 'signup') {
      if (!isConfirmPasswordCompleted) return 'confirmPassword';
      if (hasMoffy === null) return 'moffy';
      if (hasMoffy === true && !uploadedFile) return 'upload';
    }
    return 'continue';
  };
  const activeTarget = getActiveTarget();

  // ヒーローのサインイン / サインアップ押下時
  const handleSelectAuthMode = (mode: 'signin' | 'signup') => {
    if (isTransitioning) return;
    setAuthMode(mode);
    setIsTransitioning(true);

    setTimeout(() => {
      setIsSignedInOrUp(true);
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
    if (authMode === 'signup' && isAuthCompleted && hasMoffy === null) {
      moffySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [authMode, isAuthCompleted, hasMoffy]);

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

  // 画像アップロードハンドラ
  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('画像ファイル（PNG, JPG, WEBP等）を選択してください');
      return;
    }
    setError(null);
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // 続行するボタン押下
  const handleContinueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isIdCompleted) {
      setError('Discord User IDを入力してください');
      return;
    }
    if (!isPasswordCompleted) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    if (authMode === 'signup') {
      if (!isConfirmPasswordCompleted) {
        setError('確認用パスワードが一致していません');
        return;
      }
      if (hasMoffy === null) {
        setError('モッフィーを所持しているか選択してください');
        return;
      }
      if (hasMoffy === true && !uploadedFile) {
        setError('モッフィー画像をアップロードしてください');
        return;
      }
    }

    setError(null);
    onContinue({
      discordUserId: discordId.trim(),
      password,
      hasMoffy: !!hasMoffy,
      uploadedPhoto: uploadedFile,
      authMode,
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

        {/* サインイン ＆ サインアップ 2つのボタン */}
        <div className="w-full flex flex-col items-center gap-3 mt-4">
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/50 text-[11px] font-semibold text-blue-300 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping" />
              <span>
                {authMode === 'signup' ? 'NEW AMBASSADOR SIGN-UP' : 'AMBASSADOR SIGN-IN'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {authMode === 'signup' ? 'アンバサダー登録' : 'チェックイン認証'}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {authMode === 'signup' 
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
            {/* 2. パスワード入力（ID入力完了で自動フェードイン） */}
            {/* ------------------------------------------------------------ */}
            {isIdCompleted && (
              <div ref={passwordSectionRef} className="animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="pass" className="text-xs font-bold text-gray-300">
                    2. パスワード (8文字以上)
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
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="8文字以上のパスワード"
                    className="relative z-10 w-full h-14 px-5 rounded-full border border-gray-600 bg-gray-900/80 text-white placeholder-gray-500 text-base font-medium focus:bg-gray-900 focus:border-google-blue focus:ring-4 focus:ring-google-blue/10 focus:outline-none transition shadow-sm"
                  />
                </div>
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
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="もう一度パスワードを入力"
                    className="relative z-10 w-full h-14 px-5 rounded-full border border-gray-600 bg-gray-900/80 text-white placeholder-gray-500 text-base font-medium focus:bg-gray-900 focus:border-google-blue focus:ring-4 focus:ring-google-blue/10 focus:outline-none transition shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* 4. 「モッフィーをすでに持っていますか？」（サインアップ時のみ自動フェードイン） */}
            {/* ------------------------------------------------------------ */}
            {authMode === 'signup' && isAuthCompleted && (
              <div ref={moffySectionRef} className="animate-fade-in pt-4 border-t border-gray-700">
                <label className="text-xs font-bold text-gray-300 block mb-3 text-center">
                  モッフィーをすでに持っていますか？
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
                        setPreviewUrl(null);
                        
                        // Generate blank white image for API requirement
                        const canvas = document.createElement('canvas');
                        canvas.width = 800;
                        canvas.height = 800;
                        const ctx = canvas.getContext('2d')!;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, 800, 800);
                        canvas.toBlob((blob) => {
                          if (blob) {
                            setUploadedFile(blob);
                          }
                        }, 'image/png');
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
            {/* 5. 画像アップロードフォーム（サインアップで「はい」の場合に自動フェードイン） */}
            {/* ------------------------------------------------------------ */}
            {authMode === 'signup' && hasMoffy === true && (
              <div ref={uploadSectionRef} className="animate-fade-in pt-2">
                <label className="text-xs font-bold text-gray-300 block mb-2">
                  モッフィー画像をアップロード
                </label>

                <div className="relative w-full">
                  {/* 🌟 アップロード待ちのときは星がここを周回 */}
                  {activeTarget === 'upload' && <OrbitingStars count={5} isDark={true} />}

                  {previewUrl ? (
                    <div className="relative z-10 rounded-3xl border border-gray-700 bg-gray-800 p-4 flex items-center gap-4 animate-fade-in">
                      <img
                        src={previewUrl}
                        alt="Uploaded preview"
                        className="w-16 h-16 rounded-2xl object-cover border border-gray-600 shadow-sm"
                      />
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
                    className="relative z-10 w-full h-14 rounded-full bg-google-blue hover:bg-google-blue-hover active:scale-[0.99] text-white font-semibold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{authMode === 'signup' ? '続行する' : 'サインインする'}</span>
                    <ArrowRight className="w-4 h-4" />
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
