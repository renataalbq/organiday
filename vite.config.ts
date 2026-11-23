import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { handleCalendarEvents } from './server/calendarEvents.js'

/**
 * Em produção, /api/calendar-events é uma função da Vercel (api/calendar-events.ts).
 * No `npm run dev` não existe Vercel: este plugin serve a mesma rota pelo Vite.
 */
function calendarApiInDev(env: Record<string, string>): Plugin {
  return {
    name: 'organiday-calendar-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/calendar-events', async (req, res) => {
        const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost')
        const request = new Request(url, {
          method: req.method,
          headers: Object.entries(req.headers).flatMap(([key, value]) =>
            value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value] as [string, string]],
          ),
        })
        const response = await handleCalendarEvents(request, {
          supabaseUrl: env.VITE_SUPABASE_URL ?? '',
          supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
        })
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    calendarApiInDev(loadEnv(mode, process.cwd(), 'VITE_')),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registrado em src/registerServiceWorker.ts
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Organiday',
        short_name: 'Organiday',
        description: 'Trabalho, casa, estudos e o que mais couber no seu dia, num lugar só.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#F6F6F4',
        theme_color: '#F6F6F4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
}))
