import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  registerUserProfile,
  loginUser,
  loginWithGoogle,
  registerGoogleUser,
  extractMbtiFromUrl,
  setStoredAuthToken,
  createMoffy,
  editMoffyImage,
  updateArrangedPhoto,
  updateProfilePhotos,
  base64ToBlob,
  urlToBlob,
} from './services/api';
import { Header } from './components/Header';
import { IntroScreen } from './components/IntroScreen';
import type { OnboardingData, GoogleOnboardingInfo } from './components/IntroScreen';
import { QuizScreen } from './components/QuizScreen';
import { MoffyCustomizeScreen } from './components/MoffyCustomizeScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultScreen } from './components/ResultScreen';
import { AlertTriangle } from 'lucide-react';

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
  const [stage, setStage] = useState<GameStage>('intro');
  const [discordUserId, setDiscordUserId] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype>(MBTI_ARCHETYPES.INTJ);
  const [cardDataUrl, setCardDataUrl] = useState<string>('');
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [regResult, setRegResult] = useState<RegistrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleOnboardingInfo, setGoogleOnboardingInfo] = useState<GoogleOnboardingInfo | null>(null);
  const [apiStatus, setApiStatus] = useState<{
    authenticated: boolean;
    name: string;
    canCreate: boolean;
  } | null>(null);

  // モッフィー未所持フラグ（未所持をデフォルトにし、前回の残留を防ぐ）
  const [hasMoffy, setHasMoffy] = useState<boolean>(false);
  const [uploadedPhoto, setUploadedPhoto] = useState<File | Blob | null>(null);

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
  const [loadingMode, setLoadingMode] = useState<'signin' | 'signup' | 'generating'>('signup');
  // 認証・登録処理中の連打防止フラグ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(isSubmitting);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

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
  // Google連携のキャンセル（通常サインアップ/サインインへ復帰）
  // ======================================================================
  const handleCancelGoogleOnboarding = useCallback(() => {
    setGoogleOnboardingInfo(null);
    setErrorMsg(null);
  }, []);

  // ======================================================================
  // Google連携ログイン押下時（既存ユーザーの即ログイン or 初回オンボーディング分岐）
  // 🌟 批判検証是正 5: useCallback 化して無駄な再生成および IntroScreen GIS useEffect の暴走・リークを防止
  // ======================================================================
  const handleGoogleSignIn = useCallback(async (credential: string) => {
    if (isSubmittingRef.current) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await loginWithGoogle(credential);

      if (res.needs_registration) {
        // 初回連携：パスワード不要のオンボーディング案内へ
        setGoogleOnboardingInfo({
          tempToken: res.temp_token || '',
          email: res.google_email || '',
          name: res.google_name || '',
        });
        setIsSubmitting(false);
        return;
      }

      // 既存ユーザー：即座にログイン完了！
      if (!res.user) {
        throw new Error('ユーザー情報の取得に失敗しました');
      }

      const userData = res.user;
      const resolvedUserId = userData.discord_user_id;
      setDiscordUserId(resolvedUserId);

      // アカウント間残留防止のクリア
      setSelectedArchetype(MBTI_ARCHETYPES.INTJ);
      setTraitScores(null);
      setCustomMoffyImageUrl(null);
      setNormalMoffyImageUrl(null);
      setEquippedMoffyImageUrl(null);
      setCardDataUrl('');
      setCardBlob(null);

      const userResult: RegistrationResult = {
        discord_user_id: userData.discord_user_id,
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
        }, 1500);
        return;
      }

      setLoadingMode('signin');
      setPipelineTitle('ログイン成功');
      setPipelineMessage('性格診断ステージを準備しています...');
      setStage('generating');
      setIsBursting(true);

      setTimeout(() => {
        setIsBursting(false);
        setIsDarkTheme(false);
        setStage('quiz');
      }, 1500);
    } catch (err: unknown) {
      console.error('Google login error:', err);
      const message = err instanceof Error ? err.message : 'Googleログインに失敗しました';
      setErrorMsg(message);
      setStage('intro');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // ======================================================================
  // IntroScreen から「続行する / サインインする / 登録完了」押下時
  // ======================================================================
  const handleIntroContinue = async (data: OnboardingData) => {
    // 🌟 連打・多重実行ガード（409 Conflict 誘発を完全防止）
    if (isSubmitting) return;
    setIsSubmitting(true);

    // 🌟 前のアカウントの残留ステートを完全にクリアしてアカウント間分離を徹底
    setSelectedArchetype(MBTI_ARCHETYPES.INTJ);
    setTraitScores(null);
    setCustomMoffyImageUrl(null);
    setNormalMoffyImageUrl(null);
    setEquippedMoffyImageUrl(null);
    setCardDataUrl('');
    setCardBlob(null);

    setDiscordUserId(data.discordUserId);
    setHasMoffy(data.hasMoffy);
    setUploadedPhoto(data.uploadedPhoto);
    setLoadingMode(data.authMode === 'google_onboarding' ? 'signup' : data.authMode);
    setPipelineTitle('ロード中...');
    setPipelineMessage('');
    setStage('generating');
    setErrorMsg(null);

    try {
      let result: RegistrationResult;

      if (data.authMode === 'google_onboarding') {
        // === Google初回連携アカウント登録 (POST /api/google/register) ===
        if (!data.tempToken) {
          throw new Error('Google認証トークンが見つかりません。もう一度Googleアカウント連携をお試しください。');
        }

        const registerRes = await registerGoogleUser({
          temp_token: data.tempToken,
          discord_user_id: data.discordUserId,
          grade: data.grade,
          university: data.university,
          photo: data.uploadedPhoto,
        });

        if (!registerRes.user) {
          throw new Error('ユーザー登録情報の取得に失敗しました');
        }

        result = {
          discord_user_id: registerRes.user.discord_user_id,
          photo_url: registerRes.user.photo_url || null,
          default_photo_url: registerRes.user.default_photo_url || null,
          arranged_photo_url: registerRes.user.arranged_photo_url || null,
          grade: registerRes.user.grade || data.grade,
          university: registerRes.user.university || data.university,
          is_staff: !!registerRes.user.is_staff,
          created_at: registerRes.user.created_at,
          updated_at: registerRes.user.updated_at,
          google_id: registerRes.user.google_id || null,
        };

        if (data.uploadedPhoto) {
          const localUrl = URL.createObjectURL(data.uploadedPhoto);
          setCustomMoffyImageUrl(localUrl);
          setNormalMoffyImageUrl(localUrl);
          setEquippedMoffyImageUrl(localUrl);
        }
      } else if (data.authMode === 'signin') {
        // === サインイン処理：正規認証エンドポイント (POST /api/user/login) を実行 ===
        const loginRes = await loginUser(data.discordUserId, data.password || '');
        result = loginRes.user;

        // 1. 同一ブラウザに保存されたアカウント固有のセッションを確認
        const localSession = loadUserSession(data.discordUserId);
        if (!result.grade && localSession?.grade) result.grade = localSession.grade;
        if (!result.university && localSession?.university) result.university = localSession.university;

        // 既存ユーザーのプロフィール写真（アレンジ画像を優先）
        const arrangedPhoto = result.arranged_photo_url || localSession?.arrangedPhotoUrl || null;
        const defaultPhoto = result.default_photo_url || result.photo_url || localSession?.defaultPhotoUrl || arrangedPhoto;
        const existingPhoto = arrangedPhoto || defaultPhoto;

        if (existingPhoto) {
          setCustomMoffyImageUrl(existingPhoto);
          setNormalMoffyImageUrl(defaultPhoto);
          setEquippedMoffyImageUrl(arrangedPhoto || existingPhoto);
        }

        // 🌟 アレンジモッフィー（キーアイテム合成完了済み）が既に存在するなら、即座に復元して結果表示
        const hasArrangedMoffy = !!(arrangedPhoto && arrangedPhoto.trim());
        setHasMoffy(hasArrangedMoffy);

        if (hasArrangedMoffy) {
          setRegResult(result);

          // MBTIタイプの復元優先度:
          // 1. localSession の MBTI
          // 2. result.mbti (API URL パラメータから復元)
          // 3. デフォルト (INTJ)
          const resolvedMbti = (localSession?.mbti || result.mbti || 'INTJ') as MbtiType;
          const archetypeToUse = MBTI_ARCHETYPES[resolvedMbti] || MBTI_ARCHETYPES.INTJ;
          setSelectedArchetype(archetypeToUse);

          if (localSession?.traitScores) {
            setTraitScores(localSession.traitScores);
          }

          // 🌟 パートナーカードの復元:
          // ローカルストレージに cardDataUrl が保存されていれば、生成時の高品質カードを瞬時に復元！
          if (localSession?.cardDataUrl) {
            setCardDataUrl(localSession.cardDataUrl);
            const restoredBlob = base64ToBlob(localSession.cardDataUrl);
            setCardBlob(restoredBlob);
          } else {
            // 別端末などローカルに無い場合は、CORS安全ローダーを備えた generateProfileCardBlob で再生成
            const { blob, dataUrl } = await generateProfileCardBlob(
              archetypeToUse,
              data.discordUserId,
              arrangedPhoto
            );
            setCardBlob(blob);
            setCardDataUrl(dataUrl);

            // 次回復元のためにローカル保存
            saveUserSession({
              discordUserId: data.discordUserId,
              mbti: archetypeToUse.mbtiCode,
              cardDataUrl: dataUrl,
              arrangedPhotoUrl: arrangedPhoto,
              defaultPhotoUrl: defaultPhoto,
              grade: result.grade,
              university: result.university,
              updatedAt: new Date().toISOString(),
            });
          }

          setIsBursting(true);
          setTimeout(() => {
            setIsBursting(false);
            setIsDarkTheme(true);
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            setStage('result');
          }, 1500);
          return;
        }
      } else {
        // === サインアップ処理：新規ユーザーをバックエンドに登録 ===
        result = await registerUserProfile(data.discordUserId, data.password || '', {
          grade: data.grade,
          university: data.university,
          photoBlob: data.uploadedPhoto,
        });

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
    } finally {
      setIsSubmitting(false);
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
    const randomShard = SHARD_PALETTES[Math.floor(Math.random() * SHARD_PALETTES.length)];
    setChosenShard(randomShard);
    setIsLoadingEnding(false);
    setLoadingMode('generating');
    setPipelineTitle('ロード中...');
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

      // 🌟 アカウント固有のセッションを localStorage に保存！
      saveUserSession({
        discordUserId,
        mbti: targetArchetype.mbtiCode,
        traitScores,
        cardDataUrl: dataUrl,
        arrangedPhotoUrl: customMoffyImageUrl,
        defaultPhotoUrl: normalMoffyImageUrl,
        grade: regResult?.grade,
        university: regResult?.university,
        updatedAt: new Date().toISOString(),
      });

      // ロード終了・中央星収束アニメーションを開始（ワンカット長回し）
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

      // Step 3: バックエンドのプロフィール写真（1枚目デフォルト: createRes.image_url, 2枚目アレンジ: editRes.image_url）を更新
      // 🌟 クエリパラメータに ?mbti=XXXX を付加して保存することでクラウド側でもMBTIを保持
      setPipelineMessage('プロフィール写真を更新中...');
      try {
        await updateProfilePhotos(discordUserId, {
          defaultPhoto: createRes.image_url,
          arrangedPhoto: editRes.image_url,
          mbti: selectedArchetype.mbtiCode,
        });
      } catch (err) {
        console.warn('Could not update profile photos via /api/v1/profile/photo:', err);
        // フォールバック: arranged_photo を個別更新
        try {
          await updateArrangedPhoto(discordUserId, editRes.image_url, selectedArchetype.mbtiCode);
        } catch (fallbackErr) {
          console.warn('Fallback arranged photo update also failed:', fallbackErr);
        }
      }

      // Canvas上で公式パートナーカードを生成（finalMoffyBlobを直接渡すことでCORS汚染ゼロで確実に描画）
      const { blob, dataUrl } = await generateProfileCardBlob(
        selectedArchetype,
        discordUserId,
        finalMoffyBlob
      );
      setCardBlob(blob);
      setCardDataUrl(dataUrl);

      // 🌟 アカウント固有のセッションを localStorage に保存！
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

      // ロード終了・中央星収束アニメーションを開始（ワンカット長回し）
      setIsLoadingEnding(true);
    } catch (err: unknown) {
      console.error('2-step Moffy generation error:', err);
      const msg = err instanceof Error ? err.message : 'モッフィーの生成中にエラーが発生しました';
      setErrorMsg(`${msg}（公式モッフィー画像でカードを生成します）`);

      // フォールバック: 公式画像でカード生成して結果画面を表示
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

  // 完全リセット（別のアカウントでログイン / ログアウト）
  const handleReset = () => {
    // 🌟 URLパラメータ (?discord_id=xxx 等) を完全にクリアして次ユーザーへの混入・残留を防止
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    // 🌟 JWT認証トークンをセッションから破棄
    setStoredAuthToken(null);

    setStage('intro');
    setIsDarkTheme(true);
    setDiscordUserId('');
    setSelectedArchetype(MBTI_ARCHETYPES.INTJ);
    setCardDataUrl('');
    setCardBlob(null);
    setTraitScores(null);
    setRegResult(null);
    setErrorMsg(null);
    setIsBursting(false);
    setHasMoffy(false);
    setUploadedPhoto(null);
    setNormalMoffyImageUrl(null);
    setEquippedMoffyImageUrl(null);
    setCustomMoffyImageUrl(null);
    setPipelineTitle('');
    setPipelineMessage('');
    setIsLoadingEnding(false);
    setLoadingMode('signup');
    setGoogleOnboardingInfo(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
    setUploadedPhoto(null);
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
            onGoogleSignIn={handleGoogleSignIn}
            onCancelGoogleOnboarding={handleCancelGoogleOnboarding}
            googleOnboardingInfo={googleOnboardingInfo}
            initialId={discordUserId}
            isSubmitting={isSubmitting}
          />
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
