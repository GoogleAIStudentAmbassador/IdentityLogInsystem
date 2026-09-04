# モッフィー適性診断 - IdentityLogInsystem

Google AI の公式マスコット「**モッフィー（Moffy）**」と **Google AI 学生アンバサダー** の世界観を取り入れた、**16タイプ性格診断連動型オンボーディング＆アカウント登録システム**です。

「新規ユーザーにわざわざフォームを開かせて設定してもらう心理的抵抗感をゼロにする」という課題を解決するため、性格診断（12問の5段階評価）を楽しんでいるうちに、**あなたの中に宿るパートナーモッフィー（16タイプ）**が決定し、オリジナルカードが自動生成され、裏側の **MoffyProfile API** へアカウント登録（Discord User ID / パスワード / 写真）が自然に完了します。

---

## 🌟 特徴と仕組み

1. **性格心理測定データセット（IPIP / 16Personalities準拠）の全12問**
   - 「同意する (True)」〜「同意しない (False)」の直感的な5段階丸ボタンUI。
   - 4つの心理次元（E/I, S/N, T/F, J/P）を測定し、16タイプのモッフィーを導出。
2. **世界観に合わせた16タイプのパートナーモッフィー**
   - `INTJ: ストラテジスト・モッフィー`, `ENFP: スパーク・モッフィー`, `ISTP: デベロッパー・モッフィー` など、十モッフィー十色の個性を完全定義。
3. **写真準備の手間をゼロにする動的カード生成（HTML5 Canvas）**
   - モッフィーの特徴である「星空の瞳とGeminiスター（✦）」、タイプ名、能力値、お気に入りギアが刻印された美麗なカード画像をクライアント側で即座にレンダリング。
   - そのままAPIの `photo` 引数としてバックエンド（Firebase Storage）へ自動保存されます。
4. **ゲーム感覚のパスワード＆Discord ID連携**
   - パスワードは「認証プロファイルを保護する合言葉」として自然に入力。
   - 招待リンク等の `?discord_id=...` パラメータによる自動入力・スキップにも対応。

---

## 🚀 開発環境の起動

```bash
# パッケージインストール
npm install

# 開発サーバー起動（ポート3000）
npm run dev

# プロダクションビルド
npm run build
```

---

## 📡 連携バックエンド API 仕様

* **ベースURL**: `https://moffy-profile-287701603412.asia-northeast1.run.app`
* **認証ヘッダー**: `X-API-Key: mp_live_...`
* **主要エンドポイント**:
  * `GET /api/v1/ping`: 疎通・権限確認（`can_create_user: true`）
  * `POST /api/v1/profile`: ユーザー作成（`discord_user_id`, `password`, `photo`）
  * `GET /api/v1/getProfile`: 登録ユーザー情報取得

---

## 🛠 技術スタック

* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
* **Icons & FX**: Lucide React, canvas-confetti
* **Graphics**: HTML5 Canvas 2D Rendering
* **Storage & Backend**: MoffyProfile API (FastAPI / Google Cloud Run / Firebase Firestore & Storage)

