import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.png',
        'apple-touch-icon.png',
        'og.png',
        'icons/*.png',
        'icons/*.svg',
      ],
      manifest: {
        name: 'ControlaTusFinanzas',
        short_name: 'Finanzas',
        description: 'Registra ingresos y gastos y entiende tu dinero desde cualquier dispositivo.',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'es',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Registrar gasto',
            short_name: 'Gasto',
            description: 'Abrir alta rápida de gasto',
            url: '/?quick=expense',
            icons: [{ src: '/icons/shortcut-expense.svg', sizes: '96x96', type: 'image/svg+xml' }],
          },
          {
            name: 'Registrar ingreso',
            short_name: 'Ingreso',
            description: 'Abrir alta rápida de ingreso',
            url: '/?quick=income',
            icons: [{ src: '/icons/shortcut-income.svg', sizes: '96x96', type: 'image/svg+xml' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
})
