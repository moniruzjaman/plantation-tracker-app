import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,txt}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/unpkg\.com\/leaflet@[\d\.]+\/dist\/leaflet\.(js|css)/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'leaflet-assets',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'openstreetmap-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache NASA GIBS NDVI/EVI tiles (public, updated every 8 days)
            {
              urlPattern: /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/.+/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gibs-tiles',
                expiration: {
                  maxEntries: 1000,
                  maxAgeSeconds: 60 * 60 * 24 * 10, // 10 days (matches 8-day composite)
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // Cache Esri World Imagery satellite tiles
            {
              urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/.+/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'esri-satellite-tiles',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days (satellite imagery changes slowly)
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        manifest: {
          name: 'plantation-tracker',
          short_name: 'বৃক্ষরোপণ ট্র্যাকার',
          description: '“০৫ বছরে ২৫ কোটি বৃক্ষরোপণ” কর্মসূচির আওতাভুক্ত তথ্য সংগ্রহ ও ট্র্যাকিং অ্যাপ',
          theme_color: '#15803d',
          background_color: '#15803d',
          display: 'standalone',
          orientation: 'any',
          icons: [
            {
              src: 'logo.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: 'pwa-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: 'pwa-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
