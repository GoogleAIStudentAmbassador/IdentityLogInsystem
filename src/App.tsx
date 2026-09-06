import React, { useState, useEffect, useMemo } from 'react';
import type {
  GameStage,
  Archetype,
  RegistrationResult,
  MbtiType,
  CreateMoffyParams,
  ShardPalette,
  UserMoffySession,
} from './types';
import { MBTI_ARCHETYPES, PERSONALITY_QUESTIONS, ARCHETYPE_EQUIP_INSTRUCTIONS } from './data/personalityQuestions';
import { SHARD_PALETTES } from './types';
import { generateProfileCardBlob } from './utils/cardGenerator';
import {
  checkApiHealth,
  extractMbtiFromUrl,
  createMoffy,
  editMoffyImage,
  updateArrangedPhoto,
  updateProfilePhotos,
  base64ToBlob,
  urlToBlob,
} from './services/api';
import { MoffyAuthClient } from './utils/oauthClient';
import { Header } from './components/Header';
import { QuizScreen } from './components/QuizScreen';
import { MoffyCustomizeScreen } from './components/MoffyCustomizeScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { AlertTriangle, Loader2 } from 'lucide-react';

const USER_STORAGE_PREFIX = 'moffy_user_session_';

function saveUserSession(session: UserMoffySession): void {
  try {
    localStorage.setItem(`${USER_STORAGE_PREFIX}${session.discordUserId}`, JSON.stringify(session));
  } catch (e) {
    console.warn('Could not save user session to localStorage:', e);
  }
}

function loadUserSession(discordUserId: string): UserMoffySession | null {
  try {
    const raw = localStorage.getItem(`${USER_STORAGE_PREFIX}${discordUserId}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserMoffySession;
  } catch (e) {
    console.warn('Could not load user session from localStorage:', e);
    return null;
  }
}

export const App: React.FC = () => {
  // 認証ガード状態: 初期は checking_auth
  const [stage, setStage] = useState<GameStage>('checking_auth');
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

  // モッフィー未所持フラグ
  const [hasMoffy, setHasMoffy] = useState<boolean>(false);
  const [uploadedPhoto] = useState<File | Blob | null>(null);

  // ノーマル（ベース）モッフィー画像URL & アクセサリー装備モッフィー画像URL
  const [normalMoffyImageUrl, setNormalMoffyImageUrl] = useState<string | null>(null);
  const [equippedMoffyImageUrl, setEquippedMoffyImageUrl] = useState<string | null>(null);

  // 2段階生成で得られた最終モッフィー画像URL
  const [customMoffyImageUrl, setCustomMoffyImageUrl] = useState<string | null>(null);
  // ローディング画面のカスタムタイトル・メッセージ
  const [pipelineTitle, setPipelineTitle] = useState<string>('');
  const [pipelineMessage, setPipelineMessage] = useState<string>('');

  // ロード画面の中央星・水晶玉発光色（Google 4色パレットから同期）
  const [chosenShard, setChosenShard] = useState<ShardPalette>(SHARD_PALETTES[0]);
  // ロード完了時の中央星収束アニメーショントリガー
  const [isLoadingEnding, setIsLoadingEnding] = useState(false);

  // アカウント作成成功後の星バーストアニメーション
  const [isBursting, setIsBursting] = useState(false);
  // クイズ移行までは暗い背景を維持
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  // ローディング画面のメッセージモード ('signin' | 'signup' | 'generating')
  const [loadingMode, setLoadingMode] = useState<'signin' | 'signup' | 'generating'>('generating');

  // 診断された4次元生スコア
  const [traitScores, setTraitScores] = useState<Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> | null>(null);

  // OAuth 2.0 クライアントの初期化
  const authClient = useMemo(() => {
    return new MoffyAuthClient({
      clientId: 'moffy-personality-quiz',
    });
  }, []);

  // 初期ロード時：OAuth認証ガード & セッション検証
  useEffect(() => {
    // 🌟 批判検証是正 B: コールバックハッシュの存在を物理的に検出し、認証失敗時の無限リダイレクトループを完全に遮断
    const hasCallbackHash = typeof window !== 'undefined' && window.location.hash.includes('access_token');
    authClient.handleCallback();

    const initAuth = async () => {
      // 2. 認証状態の確認
      if (!authClient.isAuthenticated()) {
        // コールバックハッシュが存在したにもかかわらず認証が不成立だった場合はループを遮断
        if (hasCallbackHash) {
          console.error('[Auth Guard] Callback processing failed or storage access denied. Halting redirect loop.');
          setErrorMsg('認証トークンの検証に失敗したか、ブラウザのCookie/LocalStorageアクセスが無効化されています。プライベートブラウズ設定をご確認ください。');
          try {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch {
            // ignore
          }
          return;
        }

        console.log('[Auth Guard] Unauthenticated access detected. Redirecting to OAuth hub...');
        authClient.login();
        return;
      }

      // 3. APIヘルスチェック（非同期）
      try {
        const status = await checkApiHealth();
        setApiStatus(status);
      } catch {
        // ignore
      }

      // 4. 認証済み: ユーザー情報・モッフィー保持状況の復元
      const authUser = authClient.getUser();
      if (!authUser || !authUser.discord_user_id) {
        console.log('[Auth Guard] Invalid user in session. Redirecting to OAuth hub...');
        authClient.login();
        return;
      }

      const resolvedUserId = authUser.discord_user_id;
      setDiscordUserId(resolvedUserId);

      const userResult: RegistrationResult = {
        discord_user_id: resolvedUserId,
        photo_url: authUser.photo_url || null,
        default_photo_url: authUser.default_photo_url || null,
        arranged_photo_url: authUser.arranged_photo_url || null,
        grade: authUser.grade || null,
        university: authUser.university || null,
        is_staff: !!authUser.is_staff,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        google_id: authUser.google_id || null,
      };

      const extractedMbti =
        extractMbtiFromUrl(userResult.arranged_photo_url) ||
        extractMbtiFromUrl(userResult.default_photo_url) ||
        extractMbtiFromUrl(userResult.photo_url) ||
        (authUser.mbti as MbtiType | null);

      if (extractedMbti) {
        userResult.mbti = extractedMbti;
      }
      setRegResult(userResult);

      const localSession = loadUserSession(resolvedUserId);
      if (!userResult.grade && localSession?.grade) userResult.grade = localSession.grade;
      if (!userResult.university && localSession?.university) userResult.university = localSession.university;

      const arrangedPhoto = userResult.arranged_photo_url || localSession?.arrangedPhotoUrl || null;
      const defaultPhoto = userResult.default_photo_url || userResult.photo_url || localSession?.defaultPhotoUrl || arrangedPhoto;
      const existingPhoto = arrangedPhoto || defaultPhoto;

      if (existingPhoto) {
        setCustomMoffyImageUrl(existingPhoto);
        setNormalMoffyImageUrl(defaultPhoto);
        setEquippedMoffyImageUrl(arrangedPhoto || existingPhoto);
      }

      const hasArrangedMoffy = !!(arrangedPhoto && arrangedPhoto.trim());
      setHasMoffy(hasArrangedMoffy);

      if (hasArrangedMoffy) {
        const resolvedMbti = (localSession?.mbti || userResult.mbti || 'INTJ') as MbtiType;
        const archetypeToUse = MBTI_ARCHETYPES[resolvedMbti] || MBTI_ARCHETYPES.INTJ;
        setSelectedArchetype(archetypeToUse);

        if (localSession?.traitScores) {
          setTraitScores(localSession.traitScores);
        }

        if (localSession?.cardDataUrl) {
          setCardDataUrl(localSession.cardDataUrl);
          const restoredBlob = base64ToBlob(localSession.cardDataUrl);
          setCardBlob(restoredBlob);
        } else {
          const { blob, dataUrl } = await generateProfileCardBlob(
            archetypeToUse,
            resolvedUserId,
            arrangedPhoto
          );
          setCardBlob(blob);
          setCardDataUrl(dataUrl);

          saveUserSession({
            discordUserId: resolvedUserId,
            mbti: archetypeToUse.mbtiCode,
            cardDataUrl: dataUrl,
            arrangedPhotoUrl: arrangedPhoto,
            defaultPhotoUrl: defaultPhoto,
            grade: userResult.grade,
            university: userResult.university,
            updatedAt: new Date().toISOString(),
          });
        }

        if (hasCallbackHash) {
          setLoadingMode('signin');
          setPipelineTitle('ログイン成功');
          setPipelineMessage('モッフィーパートナーカードを展開中...');
          setStage('generating');
          setIsBursting(true);

          setTimeout(() => {
            setIsBursting(false);
            setIsDarkTheme(true);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            setStage('result');
          }, 1200);
        } else {
          setIsDarkTheme(true);
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
          setStage('result');
        }
        return;
      }

      // モッフィー未所持: クイズ画面へ遷移
      if (hasCallbackHash) {
        setLoadingMode('signin');
        setPipelineTitle('認証完了');
        setPipelineMessage('性格診断ステージを準備しています...');
        setStage('generating');
        setIsBursting(true);

        setTimeout(() => {
          setIsBursting(false);
          setIsDarkTheme(false);
          setStage('quiz');
        }, 1200);
      } else {
        setIsDarkTheme(false);
        setStage('quiz');
      }
    };

    initAuth();
  }, [authClient]);

  const isDarkOpening = isDarkTheme;

  // ======================================================================
  // 性格診断終了 → 4次元集計 & 16タイプ判定
  // ======================================================================
  const handleQuizFinish = async (answers: Record<number, number>) => {
    const scores: Record<'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P', number> = {
      E: 0, I: 0,
      S: 0, N: 0,
      T: 0, F: 0,
      J: 0, P: 0,
    };

    PERSONALITY_QUESTIONS.forEach((q) => {
      const score = answers[q.id] ?? 0;
      if (score > 0) {
        scores[q.positive] += score;
      } else if (score < 0) {
        scores[q.negative] += Math.abs(score);
      }
    });

    const eOrI = scores.E >= scores.I ? 'E' : 'I';
    const sOrN = scores.S >= scores.N ? 'S' : 'N';
    const tOrF = scores.T >= scores.F ? 'T' : 'F';
    const jOrP = scores.J >= scores.P ? 'J' : 'P';

    const calculatedMbti = `${eOrI}${sOrN}${tOrF}${jOrP}` as MbtiType;
    const targetArchetype = MBTI_ARCHETYPES[calculatedMbti] || MBTI_ARCHETYPES.INTJ;

    setTraitScores(scores);
    setSelectedArchetype(targetArchetype);

    if (!hasMoffy) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      setIsDarkTheme(true);
      setStage('customize');
      return;
    }

    const randomShard = SHARD_PALETTES[Math.floor(Math.random() * SHARD_PALETTES.length)];
    setChosenShard(randomShard);
    setIsLoadingEnding(false);
    setLoadingMode('generating');
    setPipelineTitle('ロード中...');
    setPipelineMessage('');
    setStage('generating');

    try {
      const photoToUse = uploadedPhoto || customMoffyImageUrl;
      const { blob, dataUrl } = await generateProfileCardBlob(
        targetArchetype,
        discordUserId,
        photoToUse
      );
      setCardBlob(blob);
      setCardDataUrl(dataUrl);

      saveUserSession({
        discordUserId,
        mbti: targetArchetype.mbtiCode,
        traitScores: scores,
        cardDataUrl: dataUrl,
        arrangedPhotoUrl: customMoffyImageUrl,
        defaultPhotoUrl: normalMoffyImageUrl,
        grade: regResult?.grade,
        university: regResult?.university,
        updatedAt: new Date().toISOString(),
      });

      setIsLoadingEnding(true);
    } catch (err: unknown) {
      console.error('Card generation failed:', err);
      const message = err instanceof Error ? err.message : 'カード生成中にエラーが発生しました';
      setErrorMsg(message);
      setIsLoadingEnding(false);
      setStage('quiz');
    }
  };

  // ======================================================================
  // モッフィーカスタマイズ完了 ➔ 2段階画像生成パイプライン実行！
  // ======================================================================
  const handleCustomizeSubmit = async (params: CreateMoffyParams) => {
    const randomShard = SHARD_PALETTES[Math.floor(Math.random() * SHARD_PALETTES.length)];
    setChosenShard(randomShard);
    setIsLoadingEnding(false);
    setStage('generating');
    setLoadingMode('generating');
    setIsDarkTheme(true);
    setPipelineTitle('ロード中...');
    setPipelineMessage('Step 1/2: ベースデータを生成中...');
    setErrorMsg(null);

    try {
      console.log('Step 1: Creating base Moffy with params:', params);
      const createRes = await createMoffy({
        ...params,
        accessories: 'なし',
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

      setPipelineMessage(`Step 2/2: アイテム「${selectedArchetype.luckyItem}」を合成中...`);

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

      let finalMoffyBlob: Blob;
      if (editRes.base64_data) {
        finalMoffyBlob = base64ToBlob(editRes.base64_data);
      } else {
        finalMoffyBlob = await urlToBlob(editRes.image_url);
      }

      const finalMoffyLocalUrl = URL.createObjectURL(finalMoffyBlob);
      setEquippedMoffyImageUrl(finalMoffyLocalUrl);
      setCustomMoffyImageUrl(finalMoffyLocalUrl);

      setPipelineMessage('プロフィール写真を更新中...');
      try {
        await updateProfilePhotos(discordUserId, {
          defaultPhoto: createRes.image_url,
          arrangedPhoto: editRes.image_url,
          mbti: selectedArchetype.mbtiCode,
        });
      } catch (err) {
        console.warn('Could not update profile photos via /api/v1/profile/photo:', err);
        try {
          await updateArrangedPhoto(discordUserId, editRes.image_url, selectedArchetype.mbtiCode);
        } catch (fallbackErr) {
          console.warn('Fallback arranged photo update also failed:', fallbackErr);
        }
      }

      const { blob, dataUrl } = await generateProfileCardBlob(
        selectedArchetype,
        discordUserId,
        finalMoffyBlob
      );
      setCardBlob(blob);
      setCardDataUrl(dataUrl);

      saveUserSession({
        discordUserId,
        mbti: selectedArchetype.mbtiCode,
        traitScores,
        cardDataUrl: dataUrl,
        arrangedPhotoUrl: editRes.image_url,
        defaultPhotoUrl: createRes.image_url,
        grade: regResult?.grade,
        university: regResult?.university,
        updatedAt: new Date().toISOString(),
      });

      setIsLoadingEnding(true);
    } catch (err: unknown) {
      console.error('2-step Moffy generation error:', err);
      const msg = err instanceof Error ? err.message : 'モッフィーの生成中にエラーが発生しました';
      setErrorMsg(`${msg}（公式モッフィー画像でカードを生成します）`);

      try {
        const { blob, dataUrl } = await generateProfileCardBlob(selectedArchetype, discordUserId);
        setCardBlob(blob);
        setCardDataUrl(dataUrl);
        saveUserSession({
          discordUserId,
          mbti: selectedArchetype.mbtiCode,
          traitScores,
          cardDataUrl: dataUrl,
          arrangedPhotoUrl: null,
          defaultPhotoUrl: null,
          updatedAt: new Date().toISOString(),
        });
        setIsLoadingEnding(true);
      } catch (fallbackErr) {
        console.error('Fallback card generation also failed:', fallbackErr);
        setIsLoadingEnding(false);
        setStage('customize');
      }
    }
  };

  // ログアウト（OAuth画面へリダイレクト）
  const handleReset = () => {
    authClient.logout({ redirectToLogin: true });
  };

  // このアカウントで性格診断をやり直す
  const handleRetakeQuiz = () => {
    setSelectedArchetype(MBTI_ARCHETYPES.INTJ);
    setCardDataUrl('');
    setCardBlob(null);
    setTraitScores(null);
    setErrorMsg(null);
    setIsBursting(false);
    setHasMoffy(false);
    setNormalMoffyImageUrl(null);
    setEquippedMoffyImageUrl(null);
    setCustomMoffyImageUrl(null);
    setIsDarkTheme(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setStage('quiz');
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-700 ${
        isDarkOpening
          ? 'bg-black text-white selection:bg-white/20 selection:text-white'
          : 'bg-white text-gray-900 selection:bg-blue-100 selection:text-blue-600'
      }`}
    >
      {/* ===== 星バースト演出オーバーレイ ===== */}
      {isBursting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div
            className="absolute inset-0 bg-white"
            style={{
              animation: 'burstFlash 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          />
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
      <main className="flex-1 flex flex-col">
        {/* 認証チェック中スピナー */}
        {stage === 'checking_auth' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-white">
            <Loader2 className="w-10 h-10 text-google-blue animate-spin mb-4" />
            <p className="text-sm font-medium text-gray-300">ログイン状態を確認中...</p>
          </div>
        )}

        {stage === 'generating' && (
          <LoadingScreen
            key={`${loadingMode}-${pipelineTitle}`}
            isDark={isDarkOpening}
            mode={loadingMode}
            customTitle={pipelineTitle}
            customMessage={pipelineMessage}
            chosenShard={chosenShard}
            isEnding={isLoadingEnding}
            onFinishTransition={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              setStage('result');
              setIsLoadingEnding(false);
            }}
          />
        )}

        {stage === 'quiz' && (
          <QuizScreen
            key={`quiz_${discordUserId}`}
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
            chosenShard={chosenShard}
            onReset={handleReset}
            onRetakeQuiz={handleRetakeQuiz}
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

export default App;
