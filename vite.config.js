import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ command }) => {
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  const basePrefix = (command === 'build' && !isVercel) ? '/' : '/';

  return {
    plugins: [react()],
    base: basePrefix,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    define: {
      CESIUM_BASE_URL: JSON.stringify(basePrefix + 'cesium/'),
    },
  };
}); 