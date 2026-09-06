import React, { useState, useEffect } from 'react';
import { Users, ExternalLink, GraduationCap, QrCode } from 'lucide-react';
import type { FriendItem, UserMoffySession } from '../../types';
import type { AuthUser } from '../../utils/oauthClient';
import { MBTI_ARCHETYPES } from '../../data/personalityQuestions';
import { getFriendList } from '../../services/api';

interface FriendsTabProps {
  user: AuthUser | null;
  session: UserMoffySession | null;
  isDarkMode: boolean;
  onGoToExchange: () => void;
}

export const FriendsTab: React.FC<FriendsTabProps> = ({
  user,
  session,
  isDarkMode,
  onGoToExchange,
}) => {
  const discordUserId = user?.discord_user_id || session?.discordUserId || '';
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!discordUserId);

  useEffect(() => {
    let isMounted = true;
    if (!discordUserId) return;

    getFriendList(discordUserId)
      .then((list) => {
        if (isMounted) {
          setFriends(list || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch friend list:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [discordUserId]);

  const baseUrl = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className={`border-b pb-4 ${isDarkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-google-blue" />
          <h2 className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
            アンバサダーフレンド
          </h2>
        </div>
        <p className={`mt-1 text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
          イベントや交流会で出会った仲間たちの一覧です
        </p>
      </div>

      {/* フレンド一覧エリア */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-xs text-neutral-400">
          <div className="w-6 h-6 border-2 border-google-blue border-t-transparent rounded-full animate-spin mb-3" />
          <span>フレンドリストを読み込み中...</span>
        </div>
      ) : friends.length === 0 ? (
        // エンプティステート
        <div className={`rounded-3xl border p-8 flex flex-col items-center text-center shadow-xs transition-colors ${
          isDarkMode ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-white'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-google-blue/10 text-google-blue flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className={`text-base font-bold ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
            まだフレンドがいません
          </h3>
          <p className={`text-xs mt-1.5 max-w-xs leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
            イベント会場で「フレンド交換」タブのQRコードを見せ合って、アンバサダー同士で名刺交換をしてみましょう！
          </p>
          <button
            type="button"
            onClick={onGoToExchange}
            className="mt-5 min-h-[42px] px-5 py-2.5 rounded-full font-semibold text-xs text-white flex items-center gap-2 transition cursor-pointer shadow-sm hover:opacity-95 bg-google-blue"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>フレンド交換用QRを表示</span>
          </button>
        </div>
      ) : (
        // リスト表示
        <div className="space-y-3">
          {friends.map((friend) => {
            const archetype = MBTI_ARCHETYPES[friend.mbti] || MBTI_ARCHETYPES.INTJ;
            const photoSrc =
              friend.photoUrl ||
              (archetype.officialImageUrl
                ? archetype.officialImageUrl.startsWith('http')
                  ? archetype.officialImageUrl
                  : `${baseUrl}${archetype.officialImageUrl.replace(/^\/+/, '')}`
                : `${baseUrl}moffies/${archetype.mbtiCode.toLowerCase()}.jpg`);

            // 【最重要要件】ニックネームがある場合は必ず最優先！
            const displayName =
              friend.nickname?.trim() ||
              friend.name?.trim() ||
              [friend.lastName, friend.firstName].filter(Boolean).join(' ') ||
              `@${friend.discord_user_id}`;

            const shareUrl = `./share.html?id=${encodeURIComponent(friend.discord_user_id)}&mbti=${encodeURIComponent(friend.mbti)}`;

            return (
              <div
                key={friend.discord_user_id}
                className={`rounded-2xl p-4 border transition-all flex items-center justify-between gap-3 shadow-xs ${
                  isDarkMode
                    ? 'border-neutral-800/90 bg-neutral-900/80 hover:border-neutral-700'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                {/* 左側：ミニ水晶玉風アイコン & ユーザー情報 */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/20 bg-gradient-to-b from-white/20 to-black/40 flex items-center justify-center shadow-inner">
                    <img
                      src={photoSrc}
                      alt={displayName}
                      className="w-10 h-10 object-contain drop-shadow-sm"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className={`text-sm font-bold truncate ${isDarkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>
                        {displayName}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-500 shrink-0">
                        {friend.mbti}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] mt-0.5">
                      <span className="text-google-blue font-medium truncate">
                        {archetype.title}
                      </span>
                      {friend.university && (
                        <span className={`flex items-center gap-1 truncate ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          <GraduationCap className="w-3 h-3 shrink-0" />
                          <span className="truncate">{friend.university}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 右側：公開ページを開くボタン */}
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition border cursor-pointer ${
                    isDarkMode
                      ? 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                      : 'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                  }`}
                  title={`${displayName} の公開プロフィールページを開く`}
                >
                  <span>公開ページ</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
