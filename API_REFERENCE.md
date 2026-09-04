# MoffyProfile API リファレンス

本ドキュメントは **MoffyProfile** のバックエンド API 仕様書です。  
提携サービス向け API、および管理コンソール用内部 API の仕様を記載しています。

- **本番 Base URL**: `https://moffy-profile-287701603412.asia-northeast1.run.app`
- **インタラクティブドキュメント (Swagger UI)**: `https://moffy-profile-287701603412.asia-northeast1.run.app/docs`

---

## 1. 提携サービス向け API (Partner API)

外部連携サービス（Discord Bot、ウェブポータル等）から安全にプロフィール情報を取得するための API です。  
管理画面で発行した専用の API キーを `X-API-Key` ヘッダーに設定してリクエストします。

### 1.1. API キーの有効性チェック (Ping)
API キーが正しく設定されており、現在有効（アクティブ）か確認します。

- **メソッド**: `GET`
- **エンドポイント**: `/api/v1/ping`
- **リクエストヘッダー**:
  | ヘッダー名 | 必須 | 説明 |
  | :--- | :---: | :--- |
  | `X-API-Key` | ○ | 発行された API キー (`mp_live_...`) |

#### cURL リクエスト例
```bash
curl -X GET "https://moffy-profile-287701603412.asia-northeast1.run.app/api/v1/ping" \
  -H "X-API-Key: mp_live_your_secret_api_key"
```

#### レスポンス (200 OK)
```json
{
  "status": "ok",
  "authenticated_as": "Discord-Bot-Service",
  "message": "APIキーは有効です。"
}
```

---

### 1.2. プロフィール情報取得
Discord ユーザー ID を指定して、登録済みのプロフィール写真 URL や登録日時を取得します。  
※ パスワードやハッシュ値などの機密情報はレスポンスから 100% 除外されます。

- **メソッド**: `GET`
- **エンドポイント**: `/api/v1/profile/{discord_user_id}`
- **パスパラメータ**:
  | パラメータ | 型 | 説明 |
  | :--- | :---: | :--- |
  | `discord_user_id` | `string` | 検索対象の Discord ユーザー ID |
- **リクエストヘッダー**:
  | ヘッダー名 | 必須 | 説明 |
  | :--- | :---: | :--- |
  | `X-API-Key` | ○ | 発行された API キー (`mp_live_...`) |

#### cURL リクエスト例
```bash
curl -X GET "https://moffy-profile-287701603412.asia-northeast1.run.app/api/v1/profile/123456789012345678" \
  -H "X-API-Key: mp_live_your_secret_api_key"
```

#### レスポンス (200 OK)
```json
{
  "discord_user_id": "123456789012345678",
  "photo_url": "https://firebasestorage.googleapis.com/v0/b/bubbly-card-507518-t8.firebasestorage.app/o/profiles%2F...",
  "created_at": "2026-09-04T04:20:00.000000",
  "updated_at": "2026-09-04T04:20:00.000000"
}
```

#### 主なエラーステータスコード
| ステータスコード | 理由 | 説明 |
| :---: | :--- | :--- |
| `401 Unauthorized` | 認証失敗 | `X-API-Key` ヘッダーが未指定、または不正なキー |
| `403 Forbidden` | アクセス禁止 | API キーが管理画面で一時停止（Revoke）されている |
| `404 Not Found` | 未登録 | 指定された `discord_user_id` のプロフィールが存在しない |

---

## 2. 管理コンソール用 API (Admin API)

管理画面の内部操作用 API です。ログイン認証によりアクセストークン（JWT）を取得し、`Authorization: Bearer <token>` ヘッダーを付与してリクエストします。

### 2.1. 管理者ログイン
- **メソッド**: `POST`
- **エンドポイント**: `/api/admin/login`
- **リクエストボディ**:
  ```json
  {
    "password": "管理者マスターパスワード"
  }
  ```
- **レスポンス (200 OK)**:
  ```json
  {
    "access_token": "eyJyb2xlIj...",
    "token_type": "bearer",
    "expires_in": 86400
  }
  ```

### 2.2. プロフィール登録・保管
- **メソッド**: `POST`
- **エンドポイント**: `/api/profile`
- **認証**: `Authorization: Bearer <token>`
- **Content-Type**: `multipart/form-data`
- **フォームデータ**:
  | フィールド名 | 型 | 説明 |
  | :--- | :---: | :--- |
  | `discord_user_id` | `string` | Discord ユーザー ID（重複時は `409 Conflict`） |
  | `password` | `string` | ユーザーパスワード（8文字以上。bcrypt 暗号化保存） |
  | `photo` | `file` | プロフィール画像（JPG, PNG, GIF, WEBP） |

### 2.3. プロフィール一覧取得
- **メソッド**: `GET`
- **エンドポイント**: `/api/profiles`
- **認証**: `Authorization: Bearer <token>`
- **説明**: 登録済み全プロフィールのリストを取得（パスワード除外）。

### 2.4. 提携 API キーの発行
- **メソッド**: `POST`
- **エンドポイント**: `/api/admin/keys`
- **認証**: `Authorization: Bearer <token>`
- **リクエストボディ**:
  ```json
  {
    "service_name": "連携サービス名 (例: Discord-Auto-Bot)"
  }
  ```
- **レスポンス (201 Created)**:
  ※ `raw_key` はこのレスポンスでのみ 1 度だけ返却され、DB には SHA-256 ハッシュ値のみが保管されます。
  ```json
  {
    "key_id": "xxxx-xxxx-xxxx-xxxx",
    "service_name": "Discord-Auto-Bot",
    "masked_key": "mp_live_abcd...****",
    "raw_key": "mp_live_abcdef1234567890...",
    "is_active": true,
    "created_at": "2026-09-04T04:30:00.000000",
    "updated_at": "2026-09-04T04:30:00.000000"
  }
  ```

### 2.5. 提携 API キー一覧取得
- **メソッド**: `GET`
- **エンドポイント**: `/api/admin/keys`
- **認証**: `Authorization: Bearer <token>`
- **説明**: 発行済みキー一覧を取得（キー本体は伏字）。

### 2.6. API キーの有効化 / 無効化切り替え
- **メソッド**: `PATCH`
- **エンドポイント**: `/api/admin/keys/{key_id}/toggle`
- **認証**: `Authorization: Bearer <token>`
- **リクエストボディ**:
  ```json
  {
    "is_active": false
  }
  ```

### 2.7. API キーの削除
- **メソッド**: `DELETE`
- **エンドポイント**: `/api/admin/keys/{key_id}`
- **認証**: `Authorization: Bearer <token>`

---

## 3. システムステータス API

- **メソッド**: `GET`
- **エンドポイント**: `/api/status`
- **認証**: 不要
- **レスポンス (200 OK)**:
  ```json
  {
    "is_firebase": true,
    "storage_mode": "Firebase Firestore"
  }
  ```

---

## 4. セキュリティ仕様の要約

1. **パスワード暗号化**: `bcrypt` (Cost Factor: 12) による不可逆ソルト付きストレッチングハッシュ。
2. **API キー保管**: `SHA-256` 暗号学的ハッシュによるワンウェイ保管。
3. **インジェクション防御**: NoSQL (Firestore) のため SQL インジェクションは無効。Discord ID は正規表現（`^[a-zA-Z0-9_.\#-]{2,64}$`）でサニタイズ。
4. **クラウド認証**: Cloud Run 上で Google Cloud IAM (Application Default Credentials) を利用し、サーバー内に秘密鍵ファイルを一切残さないゼロ・トラスト構成。
