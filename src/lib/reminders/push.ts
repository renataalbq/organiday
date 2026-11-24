import { supabase } from '../supabase'

/** Liga e desliga os lembretes (web push) neste aparelho. */

export type PushSupport = 'ok' | 'unsupported' | 'needs-install'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushSupport(): PushSupport {
  // no iPhone, notificação só funciona com o app instalado na Tela de Início (iOS 16.4+)
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

function deviceLabel(): string {
  const agent = navigator.userAgent
  const device = /iphone/i.test(agent)
    ? 'iPhone'
    : /ipad/i.test(agent)
      ? 'iPad'
      : /android/i.test(agent)
        ? 'Android'
        : /mac os/i.test(agent)
          ? 'Mac'
          : /windows/i.test(agent)
            ? 'Windows'
            : 'Computador'
  const browser = /edg\//i.test(agent)
    ? 'Edge'
    : /firefox/i.test(agent)
      ? 'Firefox'
      : /chrome|crios/i.test(agent)
        ? 'Chrome'
        : /safari/i.test(agent)
          ? 'Safari'
          : null
  return browser ? `${device} · ${browser}` : device
}

/** a chave pública VAPID vem do servidor (VAPID_PUBLIC_KEY), não do build */
async function vapidPublicKey(): Promise<string> {
  const response = await fetch('/api/push-public-key')
  const body = (await response.json().catch(() => ({}))) as { publicKey?: string; error?: string }
  if (!response.ok || !body.publicKey) throw new Error(body.error ?? 'Os lembretes ainda não foram configurados no servidor.')
  return body.publicKey
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function enablePush(): Promise<void> {
  if (pushSupport() !== 'ok') throw new Error('Este aparelho não aceita notificações.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    throw new Error('As notificações estão bloqueadas. Libere nas configurações do navegador ou do aparelho.')

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(await vapidPublicKey()),
    }))

  const json = subscription.toJSON()
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId || !json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Não deu pra ativar.')

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, device: deviceLabel() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error

  // o servidor precisa do fuso pra saber quando é "15h" pra você
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  await supabase.from('user_settings').update({ time_zone: timeZone }).eq('user_id', userId)
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

export async function sendTestPush(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Faça login de novo.')
  const response = await fetch('/api/push-test', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Não deu pra enviar o teste.')
}
