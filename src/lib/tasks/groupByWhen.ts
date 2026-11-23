import { daysFromToday } from '../dates.ts'
import type { Task } from '../../types.ts'

export type WhenGroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday'

export interface WhenGroup {
  key: WhenGroupKey
  title: string
  tasks: Task[]
}

const TITLES: Record<WhenGroupKey, string> = {
  overdue: 'Atrasadas',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  week: 'Esta semana',
  later: 'Mais pra frente',
  someday: 'Sem data',
}

const ORDER: WhenGroupKey[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'someday']

function keyFor(task: Task, now: Date): WhenGroupKey {
  if (!task.due_date) return 'someday'
  const days = daysFromToday(task.due_date, now)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  return 'later'
}

/** Agrupa por quando vence, mantendo a ordem de entrada dentro de hoje/atrasadas/sem data e por data nos futuros. */
export function groupByWhen(tasks: Task[], now: Date): WhenGroup[] {
  const groups = new Map<WhenGroupKey, Task[]>(ORDER.map((key) => [key, []]))
  for (const task of tasks) groups.get(keyFor(task, now))!.push(task)

  const byDateTime = (a: Task, b: Task) =>
    (a.due_date! + (a.due_time ?? '99')).localeCompare(b.due_date! + (b.due_time ?? '99'))
  for (const key of ['tomorrow', 'week', 'later'] as const) groups.get(key)!.sort(byDateTime)

  return ORDER.map((key) => ({ key, title: TITLES[key], tasks: groups.get(key)! })).filter(
    (group) => group.tasks.length > 0,
  )
}
