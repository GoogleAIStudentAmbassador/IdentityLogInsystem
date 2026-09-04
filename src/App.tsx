import React, { useState, useEffect } from 'react';
import type { GameStage, Archetype, RegistrationResult, MbtiType, CreateMoffyParams } from './types';
import { MBTI_ARCHETYPES, PERSONALITY_QUESTIONS, ARCHETYPE_EQUIP_INSTRUCTIONS } from './data/personalityQuestions';
import { generateProfileCardBlob } from './utils/cardGenerator';
import {
  checkApiHealth,
  registerUserProfile,
  fetchUserProfile,
  createMoffy,
  editMoffyImage,
  updateArrangedPhoto,
  base64ToBlob,
  urlToBlob,
} from './services/api';
import { Header } from './components/Header';
import { IntroScreen } from './components/IntroScreen';
import type { OnboardingData } from './components/IntroScreen';
import { QuizScreen } from './components/QuizScreen';
import { MoffyCustomizeScreen } from './components/MoffyCustomizeScreen';
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

  // モッフィー未所持フラグ（IntroScreenで「いいえ」を選択した場合に false）
  const [hasMoffy, setHasMoffy] = useState<boolean>(true);
  const [uploadedPhoto, setUploadedPhoto] = useState<File | Blob | null>(null);

  // ノーマル（ベース）モッフィー画像URL & アクセサリー装備モッフィー画像URL
  const [normalMoffyImageUrl, setNormalMoffyImageUrl] = useState<string | null>(null);
  const [equippedMoffyImageUrl, setEquippedMoffyImageUrl] = useState<string | null>(null);

  // 2段階生成で得られた最終モッフィー画像URL
  const [customMoffyImageUrl, setCustomMoffyImageUrl] = useState<string | null>(null);
  // ローディング画面のカスタムタイトル・メッセージ
  const [pipelineTitle, setPipelineTitle] = useState<string>('');
  const [pipelineMessage, setPipelineMessage] = useState<string>('');

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
    setHasMoffy(data.hasMoffy);
    setUploadedPhoto(data.uploadedPhoto);
    setLoadingMode(data.authMode);
    setPipelineTitle(data.authMode === 'signin' ? 'サインイン中' : 'アカウントを作成中');
    setPipelineMessage('');
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

        // 既存ユーザーのプロフィール写真（アレンジ画像を優先）
        const existingPhoto = existingProfile.arranged_photo_url || existingProfile.photo_url;
        if (existingPhoto) {
          setHasMoffy(true);
          setCustomMoffyImageUrl(existingPhoto);
          setNormalMoffyImageUrl(existingProfile.photo_url || existingPhoto);
          setEquippedMoffyImageUrl(existingProfile.arranged_photo_url || existingPhoto);
        }
      } else {
        // === サインアップ処理：新規ユーザーをバックエンドに登録 ===
        // uploadedPhoto はモッフィー画像（はい）か白画像Blob（いいえ）
        const photoBlob: Blob = data.uploadedPhoto ?? createWhiteImageBlob();
        result = await registerUserProfile(data.discordUserId, data.password, photoBlob);

        if (data.uploadedPhoto) {
          const localUrl = URL.createObjectURL(data.uploadedPhoto);
          setCustomMoffyImageUrl(localUrl);
          setNormalMoffyImageUrl(localUrl);
          setEquippedMoffyImageUrl(localUrl);
        }
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
  // 性格診断終了 → 4次元集計 & 16タイプ判定
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

    // モッフィー画像を持っていないユーザーの場合：
    // エンドポイントの引数生成に必要な文字入力画面（MoffyCustomizeScreen）へ遷移！
    if (!hasMoffy) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setIsDarkTheme(true);
      setStage('customize');
      return;
    }

    // モッフィー画像をすでに所持している場合：
    // そのままカード生成を行い、結果画面へ遷移
    setLoadingMode('generating');
    setPipelineTitle('深層宇宙へダイブ中');
    setPipelineMessage('');
    setStage('generating');

    try {
      // ユーザーのモッフィー画像（アップロードしたBlobまたはサインイン時の画像）
      const photoToUse = uploadedPhoto || customMoffyImageUrl;
      if (uploadedPhoto) {
        const localUrl = URL.createObjectURL(uploadedPhoto);
        setCustomMoffyImageUrl(localUrl);
        setNormalMoffyImageUrl(localUrl);
        setEquippedMoffyImageUrl(localUrl);
      }

      // Canvas上で16タイプ専用ステータスカードを動的生成（ユーザーのモッフィーを描画）
      const { blob, dataUrl } = await generateProfileCardBlob(
        targetArchetype,
        discordUserId,
        photoToUse
      );
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

  // ======================================================================
  // モッフィーカスタマイズ完了 ➔ 2段階画像生成パイプライン実行！
  // ======================================================================
  const handleCustomizeSubmit = async (params: CreateMoffyParams) => {
    setStage('generating');
    setLoadingMode('generating');
    setIsDarkTheme(true);
    setPipelineTitle('モッフィー召喚中');
    setPipelineMessage('Step 1/2: 入力パラメータからベースモッフィーを生成中...');
    setErrorMsg(null);

    try {
      // Step 1: 入力テキストをそのまま送信し、まずは普通のモッフィーを作成 (POST /api/v1/create_moffy)
      console.log('Step 1: Creating base Moffy with params:', params);
      const createRes = await createMoffy({
        ...params,
        accessories: 'なし', // まず普通のモッフィーを作る
      });
      console.log('Step 1 complete:', createRes);

      let baseMoffyBlob: Blob;
      if (createRes.base64_data) {
        baseMoffyBlob = base64ToBlob(createRes.base64_data);
      } else {
        baseMoffyBlob = await urlToBlob(createRes.image_url);
      }
      const baseMoffyLocalUrl = URL.createObjectURL(baseMoffyBlob);
      setNormalMoffyImageUrl(baseMoffyLocalUrl);

      // Step 2: 初めに作った人格のアクセサリー（キーアイテム）とベースモッフィーを両方送信して生成 (POST /api/v1/edit_image)
      setPipelineMessage(`Step 2/2: キーアイテム「${selectedArchetype.luckyItem}」を新エンドポイントで合成中...`);

      const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
      const itemUrl = `${baseUrl}items/${selectedArchetype.mbtiCode.toLowerCase()}.jpg`;
      const itemBlob = await urlToBlob(itemUrl);

      const equipInstruction =
        ARCHETYPE_EQUIP_INSTRUCTIONS[selectedArchetype.mbtiCode] ||
        `画像2のキーアイテム「${selectedArchetype.luckyItem}（${selectedArchetype.signatureAccessory}）」を正しく身につけて装備させてください。`;

      const editPrompt = [
        `画像1のふわふわなモッフィーキャラクターに、画像2のキーアイテム「${selectedArchetype.luckyItem}（${selectedArchetype.signatureAccessory}）」を装備させてください。`,
        equipInstruction,
        `【最重要・装着指示】単にアイテムを胸の前で両手で抱きかかえるだけには絶対にしないでください。帽子・王冠・メガネ・ゴーグル・サングラス・冠などの頭部装飾は頭や目元に正しく着用させ、マフラー・ペンダント・サッシュ（たすき）・ストラップなどの装飾品は首や身体に自然に身につけさせ、リュックは背中に背負わせ、手持ち道具（杖・ペン・フラスコ・マグ等）は片手で自然に構えさせてください。アイテムを実際に身につけて装備し、キャラクターと一体化した愛らしい構図にしてください。`,
        `【公式モッフィー特徴の維持】画像1のモッフィーの体色・表情・毛並み・四芒星の瞳・丸っこい2頭身ぬいぐるみ体型・鼻がない公式特徴（NO NOSE）は100%忠実に維持してください。柔らかな光と最高品質の3DCGぬいぐるみ質感。`,
      ].join(' ');

      console.log('Step 2: Sending edit_image request with prompt:', editPrompt);
      const editRes = await editMoffyImage(editPrompt, [baseMoffyBlob, itemBlob]);
      console.log('Step 2 complete:', editRes);

      // 最終モッフィーの Blob オブジェクトを作成（base64またはURLから取得）
      let finalMoffyBlob: Blob;
      if (editRes.base64_data) {
        finalMoffyBlob = base64ToBlob(editRes.base64_data);
      } else {
        finalMoffyBlob = await urlToBlob(editRes.image_url);
      }

      // ローカルBlob URLを作成（CORS汚染・遅延ゼロで水晶球体とCanvasに描画）
      const finalMoffyLocalUrl = URL.createObjectURL(finalMoffyBlob);
      setEquippedMoffyImageUrl(finalMoffyLocalUrl);
      setCustomMoffyImageUrl(finalMoffyLocalUrl);

      // Step 3: バックエンドの arranged_photo を更新 & ステータスカード生成
      setPipelineMessage('公式パートナーカードを結晶化中...');
      try {
        await updateArrangedPhoto(discordUserId, editRes.image_url);
      } catch (err) {
        console.warn('Could not update arranged_photo on backend profile:', err);
      }

      // Canvas上で公式パートナーカードを生成（finalMoffyBlobを直接渡すことでCORS汚染ゼロで確実に描画）
      const { blob, dataUrl } = await generateProfileCardBlob(
        selectedArchetype,
        discordUserId,
        finalMoffyBlob
      );
      setCardBlob(blob);
      setCardDataUrl(dataUrl);

      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setStage('result');
      }, 1500);
    } catch (err: unknown) {
      console.error('2-step Moffy generation error:', err);
      const msg = err instanceof Error ? err.message : 'モッフィーの生成中にエラーが発生しました';
      setErrorMsg(`${msg}（公式モッフィー画像でカードを生成します）`);

      // フォールバック: 公式画像でカード生成して結果画面を表示
      try {
        const { blob, dataUrl } = await generateProfileCardBlob(selectedArchetype, discordUserId);
        setCardBlob(blob);
        setCardDataUrl(dataUrl);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setStage('result');
      } catch (fallbackErr) {
        console.error('Fallback card generation also failed:', fallbackErr);
        setStage('customize');
      }
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
    setHasMoffy(true);
    setUploadedPhoto(null);
    setNormalMoffyImageUrl(null);
    setEquippedMoffyImageUrl(null);
    setCustomMoffyImageUrl(null);
    setPipelineTitle('');
    setPipelineMessage('');
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
      <main className={`flex-1 flex flex-col ${stage === 'intro' ? 'justify-center' : ''}`}>
        {stage === 'intro' && (
          <IntroScreen
            onContinue={handleIntroContinue}
            initialId={discordUserId}
          />
        )}

        {stage === 'generating' && (
          <LoadingScreen
            key={`${loadingMode}-${pipelineTitle}`}
            isDark={isDarkOpening}
            mode={loadingMode}
            customTitle={pipelineTitle}
            customMessage={pipelineMessage}
          />
        )}

        {stage === 'quiz' && (
          <QuizScreen
            questions={PERSONALITY_QUESTIONS}
            onFinish={handleQuizFinish}
            onDarknessChange={(isDark) => setIsDarkTheme(isDark)}
          />
        )}

        {stage === 'customize' && (
          <MoffyCustomizeScreen
            key={selectedArchetype.mbtiCode}
            archetype={selectedArchetype}
            discordUserId={discordUserId}
            onSubmit={handleCustomizeSubmit}
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
            customImageUrl={customMoffyImageUrl || undefined}
            normalImageUrl={normalMoffyImageUrl || undefined}
            equippedImageUrl={equippedMoffyImageUrl || customMoffyImageUrl || undefined}
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
