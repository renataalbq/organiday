import type { McpHandlerConfig } from './handleMcp.js'

/** Mesmas variáveis do app (já na Vercel). ORGANIDAY_TIME_ZONE é opcional. */
export function mcpConfigFrom(env: Record<string, string | undefined>): McpHandlerConfig {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL ?? '',
    supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    timeZone: env.ORGANIDAY_TIME_ZONE || 'America/Sao_Paulo',
  }
}
