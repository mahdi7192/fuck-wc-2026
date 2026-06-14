import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: process.env.VERCEL ? vercel() : node({
    mode: 'standalone'
  }),
  integrations: [react()],
  vite: {
    server: {
      proxy: {
        '/api-football': {
          target: 'https://api.football-data.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-football/, '')
        }
      }
    }
  }
});