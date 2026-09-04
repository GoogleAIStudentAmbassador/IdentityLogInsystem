import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import type { Archetype } from '../types';

interface PasswordStepProps {
  archetype: Archetype;
  discordUserId: string;
  onSubmit: (password: string) => void;
}

export const PasswordStep: React.FC<PasswordStepProps> = ({
  archetype,
  discordUserId,
  onSubmit,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('セキュリティのため、8文字以上のパスワードを入力してください');
      return;
    }
    setError('');
    onSubmit(password);
  };

  const isLengthValid = password.length >= 8;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
      <div className="relative rounded-3xl bg-slate-900/85 border border-slate-800 p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
        {/* 光彩エフェクト */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: archetype.primaryColor }}
        />

        {/* アイコン */}
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-lg text-2xl">
            ✨
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300 mb-3 border border-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>最終ステップ：認証プロファイル作成</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            ログインパスワードを設定
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            アンバサダー <span className="text-indigo-300 font-mono font-bold">[{discordUserId}]</span> のモッフィーカードとアカウントを保護するための<strong>8文字以上のパスワード</strong>を決めてください。
          </p>

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto text-left">
            <div>
              <label htmlFor="pass" className="text-xs font-semibold text-slate-300 mb-1.5 block">
                パスワード
              </label>
              <div className="relative">
                <input
                  id="pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="8文字以上のお好きなパスワード"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* バリデーション状態インジケータ */}
              <div className="flex items-center justify-between mt-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      isLengthValid ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  />
                  <span className={isLengthValid ? 'text-emerald-400' : 'text-slate-500'}>
                    8文字以上
                  </span>
                </div>
                <span className="text-slate-500 font-mono">{password.length} 文字</span>
              </div>

              {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={!isLengthValid}
              className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm sm:text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isLengthValid
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-indigo-500/25'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <span>カードを発行してアカウント登録</span>
            </button>
          </form>

          <p className="text-[11px] text-slate-500 mt-6">
            ※ パスワードは暗号化（ハッシュ化）されてMoffyProfileデータベースへ安全に保管されます。
          </p>
        </div>
      </div>
    </div>
  );
};
