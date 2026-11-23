import { useEffect, useState } from 'react'
import type { FocusTimer } from '../lib/focus/focusTimer'

const STORAGE_KEY = 'organiday:focus-timer'

function readTimer(): FocusTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as FocusTimer) : null
  } catch {
    return null
  }
}

function writeTimer(timer: FocusTimer | null) {
  try {
    if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // sem armazenamento (aba anônima etc.): o cronômetro só vale até recarregar
  }
}

/** Cronômetro do foco, guardado neste aparelho. Atualiza a cada segundo enquanto roda. */
export function useFocusTimer() {
  const [timer, setTimerState] = useState<FocusTimer | null>(readTimer)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timer || timer.pausedAt !== null) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [timer])

  const setTimer = (next: FocusTimer | null) => {
    setTimerState(next)
    setNow(Date.now())
    writeTimer(next)
  }

  return { timer, now, setTimer }
}
