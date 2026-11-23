import { daysFromToday } from '../dates.ts'
import type { Area, Task } from '../../types.ts'

export interface TaskScore {
  score: number
  /** motivos legíveis, do mais forte pro mais fraco */
  reasons: string[]
}

const PRIORITY_POINTS = { 1: 4, 2: 12, 3: 25, 4: 40 } as const

/**
 * Nota de importância de uma tarefa para hoje. Quanto maior, mais cedo ela aparece.
 * Soma prioridade + urgência do prazo + contexto (trabalho em dia útil, vida no fim de semana)
 * + tempo parada. Tarefa fixada no foco de hoje sempre vence.
 */
export function scoreTask(task: Task, area: Area | undefined, today: Date = new Date()): TaskScore {
  const parts: Array<[number, string]> = []

  parts.push([PRIORITY_POINTS[task.priority], `prioridade ${['', 'baixa', 'média', 'alta', 'urgente'][task.priority]}`])

  if (task.due_date) {
    const days = daysFromToday(task.due_date, today)
    if (days < 0)
      parts.push([30 + Math.min(-days * 3, 15), days === -1 ? 'atrasada desde ontem' : `atrasada há ${-days} dias`])
    else if (days === 0) parts.push([25, 'vence hoje'])
    else if (days === 1) parts.push([15, 'vence amanhã'])
    else if (days <= 3) parts.push([10, `vence em ${days} dias`])
    else if (days <= 7) parts.push([5, 'vence esta semana'])
    else parts.push([-5, 'prazo distante'])
  }

  if (area) {
    const isWeekend = today.getDay() === 0 || today.getDay() === 6
    if (area.kind === 'work' && !isWeekend) parts.push([8, 'dia de trabalho'])
    if (area.kind === 'work' && isWeekend) parts.push([-10, 'fim de semana'])
    if (area.kind === 'life' && isWeekend) parts.push([5, 'fim de semana'])
  }

  const ageInDays = -daysFromToday(task.created_at.slice(0, 10), today)
  if (ageInDays >= 3) parts.push([Math.min(Math.floor(ageInDays / 2), 8), `parada há ${ageInDays} dias`])

  if (task.duration_minutes && task.duration_minutes <= 15) parts.push([3, 'rapidinha'])

  const score = parts.reduce((sum, [points]) => sum + points, 0)
  const reasons = parts
    .filter(([points]) => points > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, reason]) => reason)

  return { score, reasons }
}

/** Pode entrar no plano do dia: fixada nele, sem prazo, ou com prazo até ele. Vence depois, fica pra depois. */
export function isPlannableOn(task: Task, dayISO: string): boolean {
  return task.focus_date === dayISO || task.due_date === null || task.due_date <= dayISO
}

export interface RankedTask {
  task: Task
  score: number
  reasons: string[]
  isPinned: boolean
}

/** Ordena tarefas abertas (exceto reuniões) por importância. Fixadas no foco de hoje vêm primeiro. */
export function rankTasks(
  tasks: Task[],
  areasById: Map<string, Area>,
  todayISO: string,
  today: Date = new Date(),
): RankedTask[] {
  return tasks
    .filter((task) => task.status === 'open' && task.kind === 'task')
    .map((task) => {
      const { score, reasons } = scoreTask(task, task.area_id ? areasById.get(task.area_id) : undefined, today)
      return { task, score, reasons, isPinned: task.focus_date === todayISO }
    })
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.score - a.score)
}
