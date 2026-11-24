import { handlePushPublicKey } from '../server/reminders/handleReminders.js'
import { remindersConfigFrom } from '../server/reminders/config.js'

/** Chave pública VAPID pro navegador se inscrever nos lembretes. */
export function GET(request: Request): Response {
  return handlePushPublicKey(request, remindersConfigFrom(process.env))
}
