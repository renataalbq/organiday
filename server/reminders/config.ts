import type { RemindersConfig } from './handleReminders.js'

/**
 * Lembretes. Públicas: VITE_SUPABASE_* e VAPID_PUBLIC_KEY (o app busca em /api/push-public-key).
 * Só no servidor: SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, VAPID_PRIVATE_KEY e VAPID_SUBJECT (opcional).
 */
export function remindersConfigFrom(env: Record<string, string | undefined>): RemindersConfig {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL ?? '',
    supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    cronSecret: env.CRON_SECRET ?? '',
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? '',
    vapidPrivateKey: env.VAPID_PRIVATE_KEY ?? '',
    vapidSubject: env.VAPID_SUBJECT || 'https://organiday.vercel.app',
  }
}
