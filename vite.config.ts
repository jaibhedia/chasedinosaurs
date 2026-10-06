import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Precaches the whole game (code, sprites, tiles, audio, fonts) so an installed app
    // plays solo in airplane mode. `prompt`: a new version waits for the player to accept
    // it (src/components/UpdatePrompt.tsx) instead of swapping code mid-match.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Chase Dinosaurs',
        // "Chase" alone read like a bank's app on the home screen.
        short_name: 'Chase Dinos',
        description:
          'Grab the golden egg and survive everyone hunting you for it. A fast pixel chase game: one-minute solo rounds against bots, two-minute online matches with friends. Solo plays offline.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#14141f',
        theme_color: '#261309',
        categories: ['games', 'entertainment'],
        prefer_related_applications: false,
        // Opening the app while it's already running brings that window back, mid-match
        // included, instead of starting it over at the home screen.
        launch_handler: { client_mode: ['focus-existing', 'auto'] },
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // The install sheet's preview (Android and desktop Chrome). "wide" ones show on
        // desktop, the others on phones. Not precached: they're only for installing.
        screenshots: [
          { src: '/screenshots/play-wide.jpg', sizes: '1280x720', type: 'image/jpeg', form_factor: 'wide', label: 'Grab the golden egg and outrun the pack' },
          { src: '/screenshots/home-wide.jpg', sizes: '1280x720', type: 'image/jpeg', form_factor: 'wide', label: 'Solo against bots, or online with friends' },
          { src: '/screenshots/play-phone.jpg', sizes: '1688x780', type: 'image/jpeg', label: 'Touch controls: joystick and power button' },
          { src: '/screenshots/room-phone.jpg', sizes: '1688x780', type: 'image/jpeg', label: 'Play with friends using a room code' },
        ],
        // Long-press the app icon to jump straight in.
        shortcuts: [
          { name: 'Solo against bots', short_name: 'Solo', description: 'A one-minute round against three bots', url: '/solo', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Quick Play', short_name: 'Quick Play', description: 'Jump into an online match', url: '/quick', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Play with friends', short_name: 'Friends', description: 'Create or join a room', url: '/lobby', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,mp3,woff,woff2,svg}'],
        // The social-share image is for link previews, not for playing.
        globIgnores: ['og-image.jpg'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Phaser is most of the bundle and changes rarely; its own chunk means a
        // menu-only update doesn't make returning players re-download it.
        manualChunks: { phaser: ['phaser'] },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
