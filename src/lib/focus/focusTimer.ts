/** Cronômetro do foco. Guarda só marcos de tempo, então sobrevive a recarregar a página. */
export interface FocusTimer {
  taskId: string
  durationSeconds: number
  /** Date.now() de quando começou */
  startedAt: number
  /** Date.now() de quando pausou; null rodando */
  pausedAt: number | null
  /** tempo total parado em pausas já retomadas */
  pausedMs: number
}

export function startTimer(taskId: string, durationMinutes: number, now: number): FocusTimer {
  return { taskId, durationSeconds: durationMinutes * 60, startedAt: now, pausedAt: null, pausedMs: 0 }
}

export function remainingSeconds(timer: FocusTimer, now: number): number {
  const elapsedMs = (timer.pausedAt ?? now) - timer.startedAt - timer.pausedMs
  return Math.max(0, Math.ceil(timer.durationSeconds - elapsedMs / 1000))
}

export function pauseTimer(timer: FocusTimer, now: number): FocusTimer {
  return timer.pausedAt === null ? { ...timer, pausedAt: now } : timer
}

export function resumeTimer(timer: FocusTimer, now: number): FocusTimer {
  if (timer.pausedAt === null) return timer
  return { ...timer, pausedAt: null, pausedMs: timer.pausedMs + (now - timer.pausedAt) }
}

/** Mais tempo: conta a partir do que falta, mesmo que o tempo já tenha acabado. */
export function extendTimer(timer: FocusTimer, minutes: number, now: number): FocusTimer {
  const elapsedSeconds = ((timer.pausedAt ?? now) - timer.startedAt - timer.pausedMs) / 1000
  return { ...timer, durationSeconds: elapsedSeconds + remainingSeconds(timer, now) + minutes * 60 }
}

/** 1500 → "25:00", 3725 → "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
