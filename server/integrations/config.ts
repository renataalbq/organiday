import type { IntegrationsConfig } from './handleIntegrations.js'

/** Mesmas variáveis do app, mais ORGANIDAY_SECRET_KEY (só no servidor, nunca com prefixo VITE_). */
export function integrationsConfigFrom(env: Record<string, string | undefined>): IntegrationsConfig {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL ?? '',
    supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    secretKey: env.ORGANIDAY_SECRET_KEY ?? '',
  }
}
