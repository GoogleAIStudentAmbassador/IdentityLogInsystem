import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import type { UserMoffySession, MbtiType } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { MBTI_ARCHETYPES } from '../../data/personalityQuestions';
import { generateMoffyQrDataUrl, createPassportQrPayload } from '../../utils/qrUtils';

interface FriendExchangeTabProps {
  user: AuthUser | null;
  session: UserMoffySession | null;
  isDarkMode: boolean;
  preferredStyle?: 'normal' | 'equipped';
}

export const FriendExchangeTab: React.FC<FriendExchangeTabProps> = ({
  user,
  session,
  isDarkMode,
  preferredStyle,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLoadingQr, setIsLoadingQr] = useState(true);

  const discordUserId = user?.discord_user_id || session?.discordUserId || 'Ambassador';
  const lastName = user?.last_name || session?.lastName || '';
  const firstName = user?.first_name || session?.firstName || '';
  const nickname = user?.nickname || session?.nickname || '';
  const fullName = [lastName, firstName].filter(Boolean).join(' ') || user?.name || session?.name || discordUserId;
  const rawMbti = session?.mbti || user?.mbti || 'INTJ';
  const mbti: MbtiType = (rawMbti in MBTI_ARCHETYPES) ? (rawMbti as MbtiType) : 'INTJ';
  const university = user?.university || session?.university || '未設定';
  const grade = user?.grade || session?.grade || 'B1';
  const archetype = MBTI_ARCHETYPES[mbti] || MBTI_ARCHETYPES.INTJ;

  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
  const defaultMoffyImg = archetype.officialImageUrl
    ? archetype.officialImageUrl.startsWith('http')
      ? archetype.officialImageUrl
      : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
    : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`;

  // スワイプで選択されたモッフィー画像（ノーマル vs 装備）を完全連動
  const activeStyle: 'normal' | 'equipped' =
    preferredStyle ||
    session?.preferredStyle ||
    (() => {
      try {
        const saved = localStorage.getItem('moffy_preferred_style');
        if (saved === 'normal' || saved === 'equipped') return saved;
      } catch {
        // ignore
      }
      return 'equipped';
    })();

  const normalPhoto = session?.defaultPhotoUrl || user?.default_photo_url || defaultMoffyImg;
  const equippedPhoto = session?.arrangedPhotoUrl || user?.arranged_photo_url || normalPhoto;
  const moffyPhotoUrl = activeStyle === 'normal' ? normalPhoto : equippedPhoto;

  const birthday = session?.birthday;
  const showBirthday = session?.showBirthday;
  const snsLinks = session?.snsLinks;

  // QRコード生成（中央に選択されたモッフィー画像を合成）
  useEffect(() => {
    let isMounted = true;

    const payload = createPassportQrPayload({
      id: discordUserId,
      name: fullName,
      lastName,
      firstName,
      nickname,
      mbti,
      university,
      grade: String(grade),
      photoUrl: moffyPhotoUrl || undefined,
      birthday: birthday || undefined,
      showBirthday,
      snsLinks,
    });

    generateMoffyQrDataUrl(payload, moffyPhotoUrl)
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsLoadingQr(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate Moffy QR:', err);
        if (isMounted) {
          setIsLoadingQr(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [discordUserId, fullName, lastName, firstName, nickname, mbti, university, grade, moffyPhotoUrl, birthday, showBirthday, snsLinks]);

  // Discord ID コピー処理
  const handleCopyDiscordId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(discordUserId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy to clipboard:', e);
    }
  }, [discordUserId]);

  return (
    <div className="space-y-6">
      {/* ページタイトル */}
      <div className={`border-b pb-4 ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#4285f4]" />
          <h2 className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
            フレンド交換
          </h2>
        </div>
        <p className={`mt-1 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          イベント会場でQRコードを見せ合って、アンバサダー同士で繋がりましょう
        </p>
      </div>

      {/* 🌟 Googleカラーのボックス */}
      <div className="relative">
        {/* Google 4色グロー背景 (Blue, Red, Yellow, Green) */}
        <div
          className="absolute -inset-1 rounded-3xl opacity-35 blur-md transition duration-500 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, #4285f4 0%, #ea4335 35%, #fbbc04 65%, #34a853 100%)',
          }}
        />

        {/* 外枠（Googleカラーのグラデーションボーダー） */}
        <div
          className="relative rounded-3xl p-[2.5px] transition-all shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #4285f4 0%, #ea4335 33%, #fbbc04 66%, #34a853 100%)',
          }}
        >
          {/* カード本体 */}
          <div
            className={`rounded-[22px] p-5 sm:p-6 transition-colors ${
              isDarkMode ? 'bg-neutral-950 text-neutral-100' : 'bg-white text-neutral-900'
            }`}
          >
            {/* 上部ヘッダー: Googleカラーのミニバーとタイトル */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-5 border-neutral-200/40 dark:border-neutral-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4285f4]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ea4335]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#fbbc04]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#34a853]" />
                <span className="text-[11px] font-mono tracking-wider ml-1.5 uppercase font-semibold text-neutral-500 dark:text-neutral-400">
                  Google AI Ambassador
                </span>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isDarkMode
                    ? 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                    : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                }`}
              >
                Friend Pass
              </span>
            </div>

            {/* アンバサダー名 ＆ MBTIバッジ */}
            <div className="mb-5 flex items-center justify-between">
              <div className="min-w-0 flex-1 mr-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-0.5">
                  Ambassador
                </span>
                <h3 className={`text-base sm:text-lg font-bold tracking-tight truncate ${
                  isDarkMode ? 'text-neutral-100' : 'text-neutral-900'
                }`}>
                  {fullName}
                  {nickname && (
                    <span className="text-xs font-normal opacity-80 ml-1.5 font-sans">
                      ({nickname})
                    </span>
                  )}
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 border ${
                isDarkMode ? 'border-neutral-700 bg-neutral-800 text-neutral-200' : 'border-neutral-200 bg-neutral-100 text-neutral-800'
              }`}>
                {mbti}
              </span>
            </div>

            {/* 1. Discord ID 表示エリア */}
            <div className="mb-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 flex items-center justify-between">
                <span>Discord ID</span>
                <span className="text-[10px] text-neutral-400">タップでコピー</span>
              </div>
              <button
                onClick={handleCopyDiscordId}
                className={`w-full px-4 py-3 rounded-xl border flex items-center justify-between transition-all group cursor-pointer ${
                  isDarkMode
                    ? 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-100'
                    : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100/80 text-neutral-900'
                }`}
                title="Discord IDをコピー"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#5865F2] shrink-0" />
                  <span className="font-mono text-sm sm:text-base font-semibold tracking-tight truncate">
                    {discordUserId}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {copied ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
                      <Check className="w-4 h-4" />
                      コピー済
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200 transition">
                      <Copy className="w-3.5 h-3.5" />
                      コピー
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* 2. QRコード表示エリア（中央に自分のもっふぃー） */}
            <div className="flex flex-col items-center">
              <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                交換用 QR コード
              </div>

              {/* QRコード表示ラッパー（白背景固定でスキャン安定性を確保） */}
              <div className="relative p-4 rounded-2xl bg-white shadow-md border border-neutral-200/80 max-w-[280px] w-full aspect-square flex items-center justify-center overflow-hidden">
                {isLoadingQr ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 border-2 border-neutral-300 border-t-[#4285f4] rounded-full animate-spin" />
                    <span className="text-[11px] text-neutral-500 font-mono">QRコード生成中...</span>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* QRコード画像本体 */}
                    <img
                      src={qrDataUrl}
                      alt="Friend Exchange QR Code"
                      className="w-full h-full object-contain block"
                    />

                    {/* 🌟 QRコード中央に確実に鎮座するパートナーモッフィー */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-0.5 shadow-md border-2 border-white flex items-center justify-center overflow-hidden">
                        <img
                          src={moffyPhotoUrl}
                          alt="Center Moffy"
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/moffies/intj.jpg';
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500">QRコードの生成に失敗しました</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
