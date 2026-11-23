import { registerSW } from 'virtual:pwa-register'

const HOURLY = 60 * 60 * 1000

/**
 * Registra o service worker e procura versão nova do app.
 * O app instalado (principalmente no iPhone) quase nunca é aberto do zero,
 * só volta do segundo plano, então sem isso ele ficava preso numa versão antiga.
 * Com `registerType: 'autoUpdate'`, quando a versão nova termina de baixar a página recarrega sozinha.
 */
export function registerServiceWorker() {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const checkForUpdate = () => {
        if (navigator.onLine) void registration.update()
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setInterval(checkForUpdate, HOURLY)
    },
  })
}
