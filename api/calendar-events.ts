import { handleCalendarEvents } from '../server/calendarEvents.js'

/**
 * Função da Vercel: eventos dos calendários .ics do usuário.
 * Usa as mesmas variáveis de ambiente do app (já cadastradas na Vercel).
 */
export function GET(request: Request): Promise<Response> {
  return handleCalendarEvents(request, {
    supabaseUrl: process.env.VITE_SUPABASE_URL ?? '',
    supabaseKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  })
}
