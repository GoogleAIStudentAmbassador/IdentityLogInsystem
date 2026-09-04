import React, { useState, useEffect } from 'react';
import type { GameStage, Archetype, RegistrationResult, MbtiType } from './types';
import { MBTI_ARCHETYPES, PERSONALITY_QUESTIONS } from './data/personalityQuestions';
import { generateProfileCardBlob } from './utils/cardGenerator';
import { checkApiHealth, registerUserProfile, fetchUserProfile } from './services/api';
import { Header } from './components/Header';
import { IntroScreen } from './components/IntroScreen';
import type { OnboardingData } from './components/IntroScreen';
import { QuizScreen } from './components/QuizScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  const [stage, setStage] = useState<GameStage>('intro');
  const [discordUserId, setDiscordUserId] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype>(MBTI_ARCHETYPES.INTJ);
  const [cardDataUrl, setCardDataUrl] = useState<string>('');
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [regResult, setRegResult] = useState<RegistrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{
    authenticated: boolean;
    name: string;
    canCreate: boolean;
  } | null>(null);

  // アカウント作成成功後の星バーストアニメーション
  const [isBursting, setIsBursting] = useState(false);
  // クイズ移行までは暗い背景を維持
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  // ローディング画面のメッセージモード ('signin' | 'signup' | 'generating')
  const [loadingMode, setLoadingMode] = useState<'signin' | 'signup' | 'generating'>('signup');
  // 診断された4次元生スコア
  const [traitScores, setTraitScores] = useState<Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> | null>(null);

  // 初期ロード時にAPIヘルスチェック
  useEffect(() => {
    checkApiHealth().then((status) => {
      setApiStatus(status);
    });
  }, []);

  // ======================================================================
  // isDarkOpening: quiz/result 以前（intro, 初回loading）は暗い背景を維持
  // ======================================================================
  const isDarkOpening = isDarkTheme;

  // ======================================================================
  // IntroScreen から「続行する / サインインする」押下時
  // ======================================================================
  const handleIntroContinue = async (data: OnboardingData) => {
    setDiscordUserId(data.discordUserId);
    setLoadingMode(data.authMode);
    setStage('generating');
    setErrorMsg(null);

    try {
      let result: RegistrationResult;

      if (data.authMode === 'signin') {
        // === サインイン処理：登録済みユーザーのプロフィールを取得 ===
        const existingProfile = await fetchUserProfile(data.discordUserId);
        if (!existingProfile) {
          throw new Error(
            `ユーザー「${data.discordUserId}」のアカウントが見つかりませんでした。「サインアップ」から新規登録を行ってください。`
          );
        }
        result = existingProfile;
      } else {
        // === サインアップ処理：新規ユーザーをバックエンドに登録 ===
        // uploadedPhoto はモッフィー画像（はい）か白画像Blob（いいえ）
        const photoBlob: Blob = data.uploadedPhoto ?? createWhiteImageBlob();
        result = await registerUserProfile(data.discordUserId, data.password, photoBlob);
      }

      setRegResult(result);

      // === 認証完了 → 星バースト演出 → quiz 遷移（白背景へ） ===
      setIsBursting(true);

      setTimeout(() => {
        setIsBursting(false);
        setIsDarkTheme(false);
        setStage('quiz');
      }, 1500);
    } catch (err: unknown) {
      console.error('Authentication error:', err);
      const message = err instanceof Error ? err.message : '認証処理中にエラーが発生しました';
      setErrorMsg(message);
      setStage('intro');
    }
  };

  // ======================================================================
  // 性格診断終了 → 4次元集計 & 16タイプ判定 → カード生成 → 結果画面
  // ======================================================================
  const handleQuizFinish = async (answers: Record<number, number>) => {
    const traitScores: Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> = {
      E: 0, I: 0,
      S: 0, N: 0,
      T: 0, F: 0,
      J: 0, P: 0,
    };

    PERSONALITY_QUESTIONS.forEach((q) => {
      const score = answers[q.id] ?? 0;
      if (score > 0) {
        traitScores[q.positive] += score;
      } else if (score < 0) {
        traitScores[q.negative] += Math.abs(score);
      }
    });

    const eOrI = traitScores.E >= traitScores.I ? 'E' : 'I';
    const sOrN = traitScores.S >= traitScores.N ? 'S' : 'N';
    const tOrF = traitScores.T >= traitScores.F ? 'T' : 'F';
    const jOrP = traitScores.J >= traitScores.P ? 'J' : 'P';

    const calculatedMbti = `${eOrI}${sOrN}${tOrF}${jOrP}` as MbtiType;
    const targetArchetype = MBTI_ARCHETYPES[calculatedMbti] || MBTI_ARCHETYPES.INTJ;

    setTraitScores(traitScores);
    setSelectedArchetype(targetArchetype);
    setLoadingMode('generating');
    setStage('generating');

    try {
      // Canvas上で16タイプ専用ステータスカードを動的生成
      const { blob, dataUrl } = await generateProfileCardBlob(targetArchetype, discordUserId);
      setCardBlob(blob);
      setCardDataUrl(dataUrl);

      setTimeout(() => {
        setStage('result');
      }, 2800);
    } catch (err: unknown) {
      console.error('Card generation failed:', err);
      const message = err instanceof Error ? err.message : 'カード生成中にエラーが発生しました';
      setErrorMsg(message);
      setStage('quiz');
    }
  };

  // リセット
  const handleReset = () => {
    setStage('intro');
    setIsDarkTheme(true);
    setDiscordUserId('');
    setCardDataUrl('');
    setCardBlob(null);
    setTraitScores(null);
    setRegResult(null);
    setErrorMsg(null);
    setIsBursting(false);
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-700 ${
        isDarkOpening
          ? 'bg-black text-white selection:bg-white/20 selection:text-white'
          : 'bg-white text-gray-900 selection:bg-blue-100 selection:text-blue-600'
      }`}
    >
      {/* ===== 星バースト演出オーバーレイ（アカウント作成成功後） ===== */}
      {isBursting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          {/* 背景ホワイトフラッシュ */}
          <div
            className="absolute inset-0 bg-white"
            style={{
              animation: 'burstFlash 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          />

          {/* 中央の星バースト */}
          <div className="animate-star-burst">
            <svg
              viewBox="0 0 100 100"
              className="w-28 h-28 fill-white drop-shadow-[0_0_60px_rgba(255,255,255,1)]"
            >
              <path d="M 50 5 Q 50 50 5 50 Q 50 50 50 95 Q 50 50 95 50 Q 50 50 50 5 Z" />
            </svg>
          </div>
        </div>
      )}

      {/* 共通ヘッダー */}
      <Header apiStatus={apiStatus} isDark={isDarkOpening} />

      {/* エラーアラート */}
      {errorMsg && (
        <div className="max-w-md mx-auto mt-4 px-4 w-full">
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm ${
              isDarkOpening
                ? 'bg-red-900/30 border border-red-500/30 text-red-300'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 shrink-0 ${isDarkOpening ? 'text-red-400' : 'text-red-500'}`} />
            <div className="flex-1">
              <span>{errorMsg}</span>
            </div>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col justify-center">
        {stage === 'intro' && (
          <IntroScreen
            onContinue={handleIntroContinue}
            initialId={discordUserId}
          />
        )}

        {stage === 'generating' && (
          <LoadingScreen key={loadingMode} isDark={isDarkOpening} mode={loadingMode} />
        )}

        {stage === 'quiz' && (
          <QuizScreen
            questions={PERSONALITY_QUESTIONS}
            onFinish={handleQuizFinish}
            onDarknessChange={(isDark) => setIsDarkTheme(isDark)}
          />
        )}

        {stage === 'result' && cardBlob && (
          <ResultScreen
            archetype={selectedArchetype}
            cardDataUrl={cardDataUrl}
            cardBlob={cardBlob}
            discordUserId={discordUserId}
            traitScores={traitScores}
            regResult={regResult}
            onReset={handleReset}
          />
        )}
      </main>

      {/* フッター */}
      <footer
        className={`w-full py-8 text-center transition-colors duration-700 ${
          isDarkOpening ? 'border-t border-white/10 text-gray-400' : 'border-t border-gray-100 text-gray-500'
        }`}
      >
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

// ======================================================================
// 真っ白の 800×800 PNG Blob を同期的に生成（フォールバック用）
// ======================================================================
function createWhiteImageBlob(): Blob {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 800);

  // toDataURL → Blob に同期変換
  const dataUrl = canvas.toDataURL('image/png');
  const byteString = atob(dataUrl.split(',')[1]);
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

export default App;
