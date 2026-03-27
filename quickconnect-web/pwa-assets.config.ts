import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon-48x48.png']],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0.1,
      background: '#261CC1',
    },
    apple: {
      sizes: [180],
      padding: 0,
      background: '#261CC1',
    },
  },
  images: ['public/logo.svg'],
})
