import { handleSendReminders } from '../server/reminders/handleReminders.js'
import { remindersConfigFrom } from '../server/reminders/config.js'

/** Chamada pelo pg_cron do Supabase a cada 5 minutos (ver supabase/migrations/0008_reminders.sql). */
export function POST(request: Request): Promise<Response> {
  return handleSendReminders(request, remindersConfigFrom(process.env))
}
