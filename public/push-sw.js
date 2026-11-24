/* Lembretes do Organiday: carregado pelo service worker do PWA (workbox.importScripts no vite.config.ts). */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Organiday', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Organiday', {
      body: data.body || '',
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: data.url || '/' },
    }),
  )
})

// tocar na notificação: volta pra uma janela aberta do app ou abre uma nova
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin))
      if (open) {
        open.focus()
        return open.navigate(target)
      }
      return self.clients.openWindow(target)
    }),
  )
})
