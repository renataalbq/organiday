/**
 * O que a pessoa preencheu na página de entrada antes de logar (nome, expediente e a primeira
 * tarefa). Fica no aparelho até o login voltar e então é aplicado uma vez só.
 */
export interface PendingSignup {
  displayName: string | null
  workdayStart: string | null
  workdayEnd: string | null
  /** texto do adicionar rápido; só guarda se a pessoa mudou o exemplo */
  firstTask: string | null
  savedAt: number
}

const KEY = 'organiday:pending-signup'
const MAX_AGE_MS = 24 * 60 * 60_000

export function savePendingSignup(pending: Omit<PendingSignup, 'savedAt'>) {
  const hasSomething = pending.displayName || pending.workdayStart || pending.workdayEnd || pending.firstTask
  if (!hasSomething) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(KEY, JSON.stringify({ ...pending, savedAt: Date.now() }))
}

/** lê e apaga: o que foi guardado só vale pra um login */
export function takePendingSignup(now = Date.now()): PendingSignup | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  localStorage.removeItem(KEY)
  try {
    const pending = JSON.parse(raw) as PendingSignup
    return now - pending.savedAt < MAX_AGE_MS ? pending : null
  } catch {
    return null
  }
}
