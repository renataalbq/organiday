import { timingSafeEqual } from 'node:crypto'
import webpush from 'web-push'
import { reminderMessage, type DueReminder, type PushMessage } from './reminderMessage.js'

/**
 * POST /api/send-reminders   (pg_cron do Supabase a cada 5 min, com Authorization: Bearer CRON_SECRET)
 *   pega os lembretes que venceram (claim_due_reminders, com a service role) e manda o push pra
 *   cada aparelho do dono. Aparelho que não existe mais (404/410) sai da tabela.
 *
 * POST /api/push-test        (o próprio usuário, com o token de sessão)
 *   manda uma notificação de teste pros aparelhos dele.
 *
 * GET  /api/push-public-key   chave pública VAPID, que o navegador usa pra se inscrever.
 *   É pública de propósito; fica no servidor só pra não precisar do prefixo VITE_.
 */

export interface RemindersConfig {
  supabaseUrl: string
  supabaseKey: string
  serviceRoleKey: string
  cronSecret: string
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
}

interface SubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function rest(config: RemindersConfig, token: string, path: string, init: RequestInit = {}) {
  // chave secreta (sb_secret_…) não é JWT: vai só no apikey, sem Authorization, e o Supabase
  // trata como service_role. Também funciona com a service_role antiga (JWT).
  const auth =
    token === config.serviceRoleKey
      ? { apikey: config.serviceRoleKey }
      : { apikey: config.supabaseKey, authorization: `Bearer ${token}` }
  return fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...auth, 'content-type': 'application/json', ...init.headers },
  })
}

const missingVapid = (config: RemindersConfig) => !config.vapidPublicKey || !config.vapidPrivateKey

type SendResult = 'sent' | 'gone' | 'failed'

async function send(config: RemindersConfig, subscription: SubscriptionRow, message: PushMessage): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(message),
      {
        TTL: 30 * 60, // se o aparelho estiver desligado, depois de 30 min não adianta mais
        urgency: 'high',
        vapidDetails: {
          subject: config.vapidSubject,
          publicKey: config.vapidPublicKey,
          privateKey: config.vapidPrivateKey,
        },
      },
    )
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    return status === 404 || status === 410 ? 'gone' : 'failed'
  }
}

async function removeGone(config: RemindersConfig, token: string, ids: string[]) {
  if (ids.length === 0) return
  await rest(config, token, `push_subscriptions?id=in.(${ids.join(',')})`, { method: 'DELETE' })
}

export async function handleSendReminders(request: Request, config: RemindersConfig): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' })
  if (!config.cronSecret || !sameSecret(bearer(request), config.cronSecret)) return json(401, { error: 'Não autorizado.' })
  if (!config.serviceRoleKey || missingVapid(config)) return json(500, { error: 'Faltam variáveis dos lembretes no servidor.' })

  const claimed = await rest(config, config.serviceRoleKey, 'rpc/claim_due_reminders', { method: 'POST', body: '{}' })
  if (!claimed.ok) return json(502, { error: `Não deu pra buscar os lembretes (${claimed.status}).` })
  const reminders = (await claimed.json()) as DueReminder[]
  if (reminders.length === 0) return json(200, { reminders: 0, sent: 0, failed: 0, removed: 0 })

  const userIds = [...new Set(reminders.map((reminder) => reminder.user_id))]
  const subsResponse = await rest(
    config,
    config.serviceRoleKey,
    `push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${userIds.join(',')})`,
  )
  if (!subsResponse.ok) return json(502, { error: 'Não deu pra ler os aparelhos.' })
  const subscriptions = (await subsResponse.json()) as SubscriptionRow[]

  const deliveries = reminders.flatMap((reminder) =>
    subscriptions
      .filter((subscription) => subscription.user_id === reminder.user_id)
      .map(async (subscription) => ({ subscription, result: await send(config, subscription, reminderMessage(reminder)) })),
  )
  const results = await Promise.all(deliveries)
  const gone = [...new Set(results.filter((item) => item.result === 'gone').map((item) => item.subscription.id))]
  await removeGone(config, config.serviceRoleKey, gone)

  return json(200, {
    reminders: reminders.length,
    sent: results.filter((item) => item.result === 'sent').length,
    failed: results.filter((item) => item.result === 'failed').length,
    removed: gone.length,
  })
}

export async function handlePushTest(request: Request, config: RemindersConfig): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' })
  const token = bearer(request)
  if (!token) return json(401, { error: 'Faça login de novo.' })
  if (missingVapid(config)) return json(500, { error: 'Faltam as chaves VAPID no servidor.' })

  // RLS: com o token do usuário, só vêm os aparelhos dele
  const subsResponse = await rest(config, token, 'push_subscriptions?select=id,user_id,endpoint,p256dh,auth')
  if (subsResponse.status === 401) return json(401, { error: 'Faça login de novo.' })
  if (!subsResponse.ok) return json(502, { error: 'Não deu pra ler seus aparelhos.' })
  const subscriptions = (await subsResponse.json()) as SubscriptionRow[]
  if (subscriptions.length === 0) return json(400, { error: 'Nenhum aparelho com lembretes ativos.' })

  const message: PushMessage = {
    title: 'Lembretes ligados',
    body: 'É assim que o Organiday vai te avisar quando um prazo estiver chegando.',
    tag: 'organiday-test',
    url: '/ajustes',
  }
  const results = await Promise.all(subscriptions.map((subscription) => send(config, subscription, message)))
  await removeGone(
    config,
    token,
    subscriptions.filter((_, index) => results[index] === 'gone').map((subscription) => subscription.id),
  )
  const sent = results.filter((result) => result === 'sent').length
  if (sent === 0) return json(502, { error: 'Não deu pra enviar. Tente desativar e ativar de novo.' })
  return json(200, { sent })
}

export function handlePushPublicKey(request: Request, config: RemindersConfig): Response {
  if (request.method !== 'GET') return json(405, { error: 'Método não permitido.' })
  if (!config.vapidPublicKey) return json(503, { error: 'Os lembretes ainda não foram configurados no servidor.' })
  return new Response(JSON.stringify({ publicKey: config.vapidPublicKey }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
