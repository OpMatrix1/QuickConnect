import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/QuickConnect/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' avoids silent reloads that feel like random logouts; pair with registerSW in main.tsx
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'QuickConnect',
        short_name: 'QuickConnect',
        description: 'Find trusted local service providers across Botswana',
        theme_color: '#261CC1',
        background_color: '#F0EFFF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/QuickConnect/',
        start_url: '/QuickConnect/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['push-handler.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/QuickConnect/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // Do not cache Supabase (auth/token refresh + PostgREST). SW-cached API responses
          // can break sessions and look like unexpected logouts after a "refresh".
          {
            // Google Fonts and other CDN assets
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Default provider avatars (migration / profile fallbacks)
            urlPattern: /^https:\/\/ui-avatars\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ui-avatars-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Default category banner placeholders
            urlPattern: /^https:\/\/placehold\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'placehold-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      // Service worker in dev causes frequent updates/reloads with HMR; keep off unless debugging PWA
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
