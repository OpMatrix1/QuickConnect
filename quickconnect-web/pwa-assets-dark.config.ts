import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    transparent: { sizes: [], favicons: [] },
    maskable: { sizes: [], padding: 0, background: '#000000' },
    apple: {
      sizes: [180],
      padding: 0,
      background: '#000000',
    },
  },
  images: ['public/logo-dark.svg'],
})
