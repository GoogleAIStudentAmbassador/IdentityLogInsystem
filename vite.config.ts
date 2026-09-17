import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const moffyApiUrl = env.VITE_MOFFY_API_BASE_URL || 'https://moffy-profile-287701603412.asia-northeast1.run.app';
  const discordApiUrl = env.VITE_DISCORD_API_URL || 'http://100.92.228.70:8000';
  const firebaseStorageUrl = env.VITE_FIREBASE_STORAGE_URL || 'https://firebasestorage.googleapis.com';

  return {
    base: './',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          oauth: resolve(import.meta.dirname, 'oauth.html'),
          home: resolve(import.meta.dirname, 'home.html'),
          share: resolve(import.meta.dirname, 'share.html'),
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/api': {
          target: moffyApiUrl,
          changeOrigin: true,
          secure: true,
        },
        '/firebase-storage': {
          target: firebaseStorageUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/firebase-storage/, ''),
        },
        '/discord-api': {
          target: discordApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/discord-api/, ''),
        },
      },
    },
  };
});
