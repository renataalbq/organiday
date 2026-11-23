import { DEFAULT_TASK_MINUTES, timeToMinutes } from '../dayBudget/dayBudget.ts'
import { formatTime } from '../dates.ts'
import type { RankedTask } from '../priority/scoreTask.ts'
import type { Task } from '../../types.ts'

export interface NextTask {
  task: Task
  /** "A seguir · 15h30", "Agora · 14h", "Em andamento", "Próxima" */
  label: string
  /** minutos até o horário marcado; null quando não tem horário ou já começou */
  startsInMinutes: number | null
}

interface PickNextTaskInput {
  /** tarefas que podem entrar hoje, já ordenadas por importância */
  ranked: RankedTask[]
  todayISO: string
  nowMinute: number
  /** tarefa com o cronômetro rodando, se houver */
  runningTaskId?: string | null
}

/**
 * O que fazer agora, pro card de foco. Ordem:
 * cronômetro rodando → tarefa já começada → próxima com horário hoje que ainda não acabou → a mais importante.
 * Tarefa bloqueada nunca é sugerida.
 */
export function pickNextTask({ ranked, todayISO, nowMinute, runningTaskId }: PickNextTaskInput): NextTask | null {
  const candidates = ranked.map((item) => item.task).filter((task) => !task.blocked_reason)

  const running = runningTaskId ? candidates.find((task) => task.id === runningTaskId) : undefined
  if (running) return { task: running, label: 'Em andamento', startsInMinutes: null }

  const started = candidates.find((task) => task.started_at)
  if (started) return { task: started, label: 'Em andamento', startsInMinutes: null }

  const timed = candidates
    .filter((task) => task.due_date === todayISO && task.due_time)
    .map((task) => {
      const start = timeToMinutes(task.due_time!)
      return { task, start, end: start + (task.duration_minutes ?? DEFAULT_TASK_MINUTES) }
    })
    .filter((item) => item.end > nowMinute)
    .sort((a, b) => a.start - b.start)[0]
  if (timed) {
    const startsIn = timed.start - nowMinute
    return {
      task: timed.task,
      label: `${startsIn > 0 ? 'A seguir' : 'Agora'} · ${formatTime(timed.task.due_time!)}`,
      startsInMinutes: startsIn > 0 ? startsIn : null,
    }
  }

  const top = candidates[0]
  return top ? { task: top, label: 'Próxima', startsInMinutes: null } : null
}
