import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { handleCalendarEvents } from './server/calendarEvents.js'
import { integrationsConfigFrom } from './server/integrations/config.js'
import { handleConnectIntegration, handleIntegrationItems } from './server/integrations/handleIntegrations.js'
import { mcpConfigFrom } from './server/mcp/config.js'
import { handleMcp, handleProtectedResourceMetadata } from './server/mcp/handleMcp.js'

/**
 * Em produção, /api/* são funções da Vercel (pasta api/). No `npm run dev` não existe Vercel:
 * este plugin serve as mesmas rotas pelo Vite.
 */
function apiInDev(env: Record<string, string>): Plugin {
  const calendarConfig = {
    supabaseUrl: env.VITE_SUPABASE_URL ?? '',
    supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  }
  const mcpConfig = mcpConfigFrom(env)
  const integrationsConfig = integrationsConfigFrom(env)
  const routes: [string, (request: Request) => Response | Promise<Response>][] = [
    ['/api/calendar-events', (request) => handleCalendarEvents(request, calendarConfig)],
    ['/api/mcp', (request) => handleMcp(request, mcpConfig)],
    ['/api/integrations', (request) => handleConnectIntegration(request, integrationsConfig)],
    ['/api/integration-items', (request) => handleIntegrationItems(request, integrationsConfig)],
    ['/.well-known/oauth-protected-resource', (request) => handleProtectedResourceMetadata(request, mcpConfig)],
  ]

  return {
    name: 'organiday-api',
    apply: 'serve',
    configureServer(server) {
      for (const [path, handler] of routes) {
        server.middlewares.use(path, async (req, res) => {
          const url = new URL(req.originalUrl ?? req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const chunks: Buffer[] = []
          if (hasBody) for await (const chunk of req) chunks.push(chunk as Buffer)
          const request = new Request(url, {
            method: req.method,
            headers: Object.entries(req.headers).flatMap(([key, value]) =>
              value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value] as [string, string]],
            ),
            body: hasBody ? Buffer.concat(chunks) : undefined,
          })
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    apiInDev(loadEnv(mode, process.cwd(), ['VITE_', 'ORGANIDAY_'])),
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
        background_color: '#EBEBE7',
        theme_color: '#EBEBE7',
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
