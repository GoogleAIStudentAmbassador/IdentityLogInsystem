/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOFFY_API_BASE_URL?: string;
  readonly VITE_DISCORD_API_URL?: string;
  readonly VITE_DISCORD_CLIENT_KEY?: string;
  readonly FASTAPI_CLIENT_KEY?: string;
  readonly VITE_FIREBASE_STORAGE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_MOFFY_API_KEY?: string;
  readonly VITE_ALLOWED_REDIRECT_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
