import { handlePushTest } from '../server/reminders/handleReminders.js'
import { remindersConfigFrom } from '../server/reminders/config.js'

/** Notificação de teste pros aparelhos do usuário logado. */
export function POST(request: Request): Promise<Response> {
  return handlePushTest(request, remindersConfigFrom(process.env))
}
