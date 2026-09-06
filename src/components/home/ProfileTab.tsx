import React, { useState } from 'react';
import { ShieldCheck, RotateCcw, LogOut, Download, Plus, Trash2, Check, Save } from 'lucide-react';
import type { AuthUser } from '../../utils/oauthClient';
import type { UserMoffySession, MbtiType, SnsLinkItem, SnsPlatform } from '../../types';
import { MBTI_ARCHETYPES } from '../../data/personalityQuestions';
import { SNS_PLATFORMS, detectPlatformFromUrl, sanitizeTextInput } from '../../utils/snsUtils';
import { saveGameProgress } from '../../services/api';

interface ProfileTabProps {
  user: AuthUser | null;
  session: UserMoffySession | null;
  onLogout: () => void;
  onBackToQuiz: () => void;
  isDarkMode: boolean;
  onUpdateSession?: (updatedSession: UserMoffySession) => void;
}

const GRADE_OPTIONS = [
  'B1',
  'B2',
  'B3',
  'B4',
  'M1',
  'M2',
  'D1',
  'D2',
  'D3',
  'その他',
];

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  session,
  onLogout,
  onBackToQuiz,
  isDarkMode,
  onUpdateSession,
}) => {
  const discordId = user?.discord_user_id || session?.discordUserId || 'Ambassador';
  const rawMbti = session?.mbti || user?.mbti || 'INTJ';
  const mbti: MbtiType = (rawMbti in MBTI_ARCHETYPES) ? (rawMbti as MbtiType) : 'INTJ';
  const archetype = MBTI_ARCHETYPES[mbti] || MBTI_ARCHETYPES.INTJ;
  const cardDataUrl = session?.cardDataUrl || null;
  const photoUrl = session?.arrangedPhotoUrl || session?.defaultPhotoUrl || user?.arranged_photo_url || user?.photo_url || archetype.officialImageUrl;

  // 編集用ローカルステート
  const [lastName, setLastName] = useState<string>(() => user?.last_name || session?.lastName || '');
  const [firstName, setFirstName] = useState<string>(() => user?.first_name || session?.firstName || '');
  const [nickname, setNickname] = useState<string>(() => user?.nickname || session?.nickname || '');
  const [university, setUniversity] = useState<string>(() => user?.university || session?.university || '');
  const [grade, setGrade] = useState<string>(() => user?.grade || session?.grade || 'B1');
  // 誕生日（デフォルト非表示）
  const [birthday, setBirthday] = useState<string>(() => session?.birthday || '');
  const [showBirthday, setShowBirthday] = useState<boolean>(() => session?.showBirthday ?? false);

  // SNSリンク一覧ステート
  const [snsLinks, setSnsLinks] = useState<SnsLinkItem[]>(() => {
    if (session?.snsLinks && Array.isArray(session.snsLinks) && session.snsLinks.length > 0) {
      return session.snsLinks;
    }
    return [];
  });

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // パートナーカード画像のダウンロード
  const handleDownloadCard = () => {
    if (!cardDataUrl) return;
    const safeName = (nickname || `${lastName}${firstName}` || 'ambassador').replace(/[/\\?%*:|"<>]/g, '_').trim();
    const safeDiscordId = discordId.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const link = document.createElement('a');
    link.href = cardDataUrl;
    link.download = `GoogleAI_Ambassador_Card_${safeName}_${safeDiscordId}.png`;
    link.click();
  };

  // SNSリンク追加
  const handleAddSnsLink = () => {
    const newId = `sns_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setSnsLinks((prev) => [...prev, { id: newId, platform: 'x', value: '' }]);
  };

  // SNSリンク削除
  const handleRemoveSnsLink = (id: string) => {
    setSnsLinks((prev) => prev.filter((item) => item.id !== id));
  };

  // SNSリンク変更（URL入力時のプラットフォーム自動判定含む）
  const handleSnsValueChange = (id: string, value: string) => {
    const detected = detectPlatformFromUrl(value);
    setSnsLinks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          value,
          platform: detected ? detected : item.platform,
        };
      })
    );
  };

  const handleSnsPlatformChange = (id: string, platform: SnsPlatform) => {
    setSnsLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, platform } : item))
    );
  };

  // プロフィール保存処理
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    // サニタイズ（制御文字除去・文字数制限）
    const cleanLastName = sanitizeTextInput(lastName, 30);
    const cleanFirstName = sanitizeTextInput(firstName, 30);
    const cleanNickname = sanitizeTextInput(nickname, 30);
    const cleanUniversity = sanitizeTextInput(university, 50);
    const cleanGrade = sanitizeTextInput(grade, 20);

    const fullName = [cleanLastName, cleanFirstName].filter(Boolean).join(' ') || session?.name || user?.name || discordId;

    // 空白のリンクを除外してサニタイズ
    const cleanSnsLinks: SnsLinkItem[] = snsLinks
      .map((item) => ({
        id: item.id,
        platform: item.platform,
        value: sanitizeTextInput(item.value, 200),
      }))
      .filter((item) => item.value.length > 0);

    const cleanBirthday = birthday ? sanitizeTextInput(birthday, 20) : '';

    const updatedSession: UserMoffySession = {
      ...(session || {
        discordUserId: discordId,
        mbti,
        traitScores: null,
      }),
      discordUserId: discordId,
      mbti,
      name: fullName,
      lastName: cleanLastName,
      firstName: cleanFirstName,
      nickname: cleanNickname,
      university: cleanUniversity,
      grade: cleanGrade,
      snsLinks: cleanSnsLinks,
      birthday: cleanBirthday,
      showBirthday,
      updatedAt: new Date().toISOString(),
    };

    // 1. localStorage に保存 (UserMoffySession)
    try {
      const storageKey = `moffy_user_session_${discordId}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedSession));
    } catch (err) {
      console.warn('Failed to save user session to localStorage:', err);
    }

    // 1-b. クラウドDB (API) の進捗にも保存
    if (discordId) {
      saveGameProgress('moffy_profile_ext', discordId, {
        birthday: cleanBirthday,
        showBirthday,
        snsLinks: cleanSnsLinks,
      }).catch((err) => {
        console.warn('Failed to sync profile ext to cloud:', err);
      });
    }

    // 2. MoffyAuthClient のセッションにも反映
    try {
      const authRaw = localStorage.getItem('moffy_oauth_session');
      if (authRaw) {
        const parsedAuth = JSON.parse(authRaw);
        if (parsedAuth && parsedAuth.user) {
          parsedAuth.user.name = fullName;
          parsedAuth.user.last_name = cleanLastName;
          parsedAuth.user.first_name = cleanFirstName;
          parsedAuth.user.nickname = cleanNickname;
          parsedAuth.user.university = cleanUniversity;
          parsedAuth.user.grade = cleanGrade;
          localStorage.setItem('moffy_oauth_session', JSON.stringify(parsedAuth));
        }
      }
    } catch (err) {
      console.warn('Failed to sync auth session in localStorage:', err);
    }

    // 3. 親コンポーネントへ通知（リアルタイム更新）
    onUpdateSession?.(updatedSession);

    // 4. 保存成功フィードバック
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className={`border-b pb-4 ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <h2 className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
          Partner Card & Profile
        </h2>
        <p className={`mt-0.5 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          公式パートナーカードの確認・保存およびプロフィールの編集・管理
        </p>
      </div>

      {/* 🌟 1. 公式パートナーカード（800x1000 PNG画像） */}
      <div className="flex flex-col items-center">
        {cardDataUrl ? (
          <div className="w-full space-y-3">
            <div className={`w-full rounded-2xl overflow-hidden border shadow-lg transition-colors ${
              isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'
            }`}>
              <img
                src={cardDataUrl}
                alt="Google AI Ambassador Official Partner Card"
                className="w-full h-auto object-cover block"
              />
            </div>

            {/* カード画像保存ボタン */}
            <button
              onClick={handleDownloadCard}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer bg-gradient-to-r from-[#4285f4] to-[#34a853] text-white hover:opacity-95 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>パートナーカードを画像保存 (PNG)</span>
            </button>
          </div>
        ) : (
          <div className={`w-full rounded-2xl border p-6 flex flex-col items-center text-center shadow-sm ${
            isDarkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'
          }`}>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={archetype.title}
                className="w-40 h-40 rounded-2xl object-contain mb-3 drop-shadow-md"
              />
            ) : (
              <div className={`w-40 h-40 rounded-2xl mb-3 flex items-center justify-center text-xs ${
                isDarkMode ? 'bg-neutral-800 text-neutral-500' : 'bg-neutral-100 text-neutral-400'
              }`}>
                No Image
              </div>
            )}
            <span className={`text-xs font-mono uppercase tracking-widest ${
              isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
            }`}>
              {mbti}
            </span>
            <h3 className={`text-base font-bold mt-1 ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
              {archetype.title}
            </h3>
            <p className={`text-xs mt-1 leading-relaxed max-w-xs ${
              isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
            }`}>
              {archetype.subtitle}
            </p>
          </div>
        )}
      </div>

      {/* 🌟 2. 編集可能なプロフィール情報フォーム */}
      <form onSubmit={handleSaveProfile} className={`p-4 sm:p-5 rounded-2xl border space-y-4 text-xs transition-colors ${
        isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-white shadow-sm'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${
          isDarkMode ? 'border-neutral-800/80' : 'border-neutral-100'
        }`}>
          <span className={`text-[11px] font-medium uppercase tracking-wider ${
            isDarkMode ? 'text-neutral-400' : 'text-neutral-500'
          }`}>
            Ambassador Status
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Ambassador
          </span>
        </div>

        {/* 姓・名の横並びグリッド入力 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block mb-1 font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              姓（名字）
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="例: 名越"
              maxLength={30}
              className={`w-full min-h-[40px] px-3 rounded-xl border text-xs transition outline-none ${
                isDarkMode
                  ? 'border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-[#4285f4] placeholder:text-neutral-600'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#4285f4] placeholder:text-neutral-400'
              }`}
            />
          </div>

          <div>
            <label className={`block mb-1 font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              名（名前）
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="例: 崇晃"
              maxLength={30}
              className={`w-full min-h-[40px] px-3 rounded-xl border text-xs transition outline-none ${
                isDarkMode
                  ? 'border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-[#4285f4] placeholder:text-neutral-600'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#4285f4] placeholder:text-neutral-400'
              }`}
            />
          </div>
        </div>

        {/* ニックネーム */}
        <div>
          <label className={`block mb-1 font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            ニックネーム（呼び名）
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例: Ayato"
            maxLength={30}
            className={`w-full min-h-[40px] px-3 rounded-xl border text-xs transition outline-none ${
              isDarkMode
                ? 'border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-[#4285f4] placeholder:text-neutral-600'
                : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#4285f4] placeholder:text-neutral-400'
            }`}
          />
        </div>

        {/* 所属大学 */}
        <div>
          <label className={`block mb-1 font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            所属大学
          </label>
          <input
            type="text"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="例: 日本大学"
            maxLength={50}
            className={`w-full min-h-[40px] px-3 rounded-xl border text-xs transition outline-none ${
              isDarkMode
                ? 'border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-[#4285f4] placeholder:text-neutral-600'
                : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#4285f4] placeholder:text-neutral-400'
            }`}
          />
        </div>

        {/* 学年区分 */}
        <div>
          <label className={`block mb-1 font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
            学年区分
          </label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className={`w-full min-h-[40px] px-3 rounded-xl border text-xs transition outline-none cursor-pointer ${
              isDarkMode
                ? 'border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-[#4285f4]'
                : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#4285f4]'
            }`}
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g} className={isDarkMode ? 'bg-neutral-900' : 'bg-white'}>
                {g}
              </option>
            ))}
            {!GRADE_OPTIONS.includes(grade) && grade && (
              <option value={grade} className={isDarkMode ? 'bg-neutral-900' : 'bg-white'}>
                {grade}
              </option>
            )}
          </select>
        </div>

        {/* 誕生日設定（デフォルト非表示） */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className={`block font-medium ${isDarkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
              誕生日
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBirthday}
                onChange={(e) => setShowBirthday(e.target.checked)}
                className="rounded border-neutral-400 text-google-blue focus:ring-0 cursor-pointer"
              />
              <span className={`text-[11px] ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                公開ページに表示 (デフォルト非公開)
              </span>
            </label>
          </div>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className={`w-full min-h-[40px] px-3 rounded-xl border text-xs transition outline-none ${
              isDarkMode
                ? 'border-neutral-700 bg-neutral-950 text-neutral-100 focus:border-[#4285f4]'
                : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-[#4285f4]'
            }`}
          />
        </div>

        {/* 固定メタデータ（Discord ID & パートナーモッフィー） */}
        <div className={`pt-2 border-t space-y-2 text-[11px] ${isDarkMode ? 'border-neutral-800' : 'border-neutral-100'}`}>
          <div className="flex justify-between items-center py-1">
            <span className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>Discord ID</span>
            <span className={`font-mono font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              @{discordId}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>パートナーモッフィー</span>
            <span className={`font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              {archetype.title} [{mbti}]
            </span>
          </div>
        </div>

        {/* 🌟 3. SNSリンク設定セクション */}
        <div className={`pt-3 border-t space-y-3 ${isDarkMode ? 'border-neutral-800' : 'border-neutral-100'}`}>
          <div className="flex items-center justify-between">
            <label className={`font-semibold text-xs ${isDarkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
              SNS・外部リンク設定
            </label>
            <button
              type="button"
              onClick={handleAddSnsLink}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition cursor-pointer border ${
                isDarkMode
                  ? 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                  : 'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>SNS追加</span>
            </button>
          </div>

          {snsLinks.length === 0 ? (
            <p className={`text-[11px] py-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              登録されているSNSリンクはありません。「+ SNS追加」から追加できます。
            </p>
          ) : (
            <div className="space-y-2.5">
              {snsLinks.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
                    isDarkMode ? 'border-neutral-800 bg-neutral-950/60' : 'border-neutral-200/80 bg-neutral-50/70'
                  }`}
                >
                  {/* プラットフォーム選択 */}
                  <select
                    value={item.platform}
                    onChange={(e) => handleSnsPlatformChange(item.id, e.target.value as SnsPlatform)}
                    className={`min-h-[36px] sm:w-36 px-2.5 rounded-lg border text-xs outline-none cursor-pointer ${
                      isDarkMode
                        ? 'border-neutral-700 bg-neutral-900 text-neutral-200'
                        : 'border-neutral-300 bg-white text-neutral-800'
                    }`}
                  >
                    {SNS_PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value} className={isDarkMode ? 'bg-neutral-900' : 'bg-white'}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  {/* URL / ID 入力欄（ドメイン自動検知） */}
                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => handleSnsValueChange(item.id, e.target.value)}
                      placeholder="URL または @ユーザー名 (URL自動検知)"
                      maxLength={200}
                      className={`w-full min-h-[36px] px-3 rounded-lg border text-xs outline-none transition ${
                        isDarkMode
                          ? 'border-neutral-700 bg-neutral-900 text-neutral-100 placeholder:text-neutral-600 focus:border-[#4285f4]'
                          : 'border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus:border-[#4285f4]'
                      }`}
                    />

                    {/* 削除ボタン */}
                    <button
                      type="button"
                      onClick={() => handleRemoveSnsLink(item.id)}
                      className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/30 transition cursor-pointer flex items-center justify-center shrink-0"
                      title="このSNSを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 保存ボタン */}
        <div className="pt-2">
          <button
            type="submit"
            className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#4285f4] to-[#34a853] text-white hover:opacity-95'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>プロフィールを保存しました</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>プロフィールを保存</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* 4. アカウント管理アクション */}
      <div className="space-y-2.5 pt-1">
        <button
          onClick={onBackToQuiz}
          className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer ${
            isDarkMode
              ? 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200'
              : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 shadow-sm'
          }`}
        >
          <span className="flex items-center gap-2">
            <RotateCcw className={`w-4 h-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`} />
            <span>性格診断（チュートリアル）を再受講</span>
          </span>
          <span className="text-[11px] opacity-60">再診断</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-red-900/30 bg-red-950/10 hover:bg-red-950/25 text-red-400 text-xs font-medium flex items-center justify-between transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-red-400" />
            <span>ログアウト</span>
          </span>
          <span className="text-[11px] opacity-75">セッション終了</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileTab;

