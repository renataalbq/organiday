import { useEffect, useState } from 'react'
import { toISODate } from '../lib/dates'

/** Hora atual, atualizada a cada minuto (e quando o app volta pro primeiro plano). */
export function useNow(): { now: Date; todayISO: string } {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    let interval: number | undefined
    const timeout = window.setTimeout(() => {
      refresh()
      interval = window.setInterval(refresh, 60_000)
    }, msToNextMinute)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return { now, todayISO: toISODate(now) }
}
