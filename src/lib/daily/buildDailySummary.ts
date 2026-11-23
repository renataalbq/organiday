import { addDays, toISODate } from '../dates.ts'
import { timeToMinutes } from '../dayBudget/dayBudget.ts'
import { isPlannableOn, rankTasks } from '../priority/scoreTask.ts'
import type { Area, Task, UserSettings } from '../../types.ts'

const PLAN_SIZE = 3
const WEEKDAY_NAME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export interface DailySummary {
  /** dia cujo trabalho está sendo resumido */
  doneDate: string
  doneLabel: string
  /** dia do plano ("Hoje", "Amanhã", "Segunda") */
  planLabel: string
  done: Task[]
  plan: Task[]
  /** decisões de trabalho em aberto, que podem estar travando algo */
  blockers: Task[]
  text: string
}

interface DailySummaryInput {
  tasks: Task[]
  areasById: Map<string, Area>
  settings: UserSettings
  now: Date
}

const isWorkday = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6

function previousWorkday(date: Date): Date {
  let day = addDays(date, -1)
  while (!isWorkday(day)) day = addDays(day, -1)
  return day
}

function nextWorkday(date: Date): Date {
  let day = addDays(date, 1)
  while (!isWorkday(day)) day = addDays(day, 1)
  return day
}

function relativeLabel(date: Date, today: Date): string {
  const diff = Math.round((addDays(date, 0).getTime() - addDays(today, 0).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === -1) return 'Ontem'
  if (diff === 1) return 'Amanhã'
  const name = WEEKDAY_NAME[date.getDay()]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Resumo pra daily, só com o que é de áreas de trabalho.
 * Durante o expediente: o que foi feito no último dia útil + plano de hoje.
 * Depois do expediente ou no fim de semana: o que foi feito no último dia útil (inclusive hoje) + plano do próximo.
 */
export function buildDailySummary({ tasks, areasById, settings, now }: DailySummaryInput): DailySummary {
  const today = addDays(now, 0)
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const isDuringWorkday = isWorkday(today) && nowMinute < timeToMinutes(settings.workday_end)

  const doneDay = isDuringWorkday ? previousWorkday(today) : isWorkday(today) ? today : previousWorkday(today)
  const planDay = isDuringWorkday ? today : nextWorkday(today)
  const doneDate = toISODate(doneDay)

  const isWorkTask = (task: Task) => task.area_id !== null && areasById.get(task.area_id)?.kind === 'work'

  const done = tasks
    .filter(
      (task) =>
        isWorkTask(task) &&
        task.kind !== 'meeting' &&
        task.status === 'done' &&
        task.completed_at !== null &&
        toISODate(new Date(task.completed_at)) === doneDate,
    )
    .sort((a, b) => a.completed_at!.localeCompare(b.completed_at!))

  const openWork = tasks.filter((task) => isWorkTask(task) && task.status === 'open')
  const planDayISO = toISODate(planDay)
  const plannable = openWork.filter((task) => isPlannableOn(task, planDayISO))
  const plan = rankTasks(plannable, areasById, planDayISO, planDay)
    .slice(0, PLAN_SIZE)
    .map((item) => item.task)
  const blockers = openWork.filter((task) => task.kind === 'decision')

  const doneLabel = relativeLabel(doneDay, today)
  const planLabel = relativeLabel(planDay, today)

  const lines: string[] = [`${doneLabel}:`]
  if (done.length === 0) lines.push('• nada marcado como concluído')
  for (const task of done) lines.push(`• ${task.kind === 'decision' ? `decidi: ${task.title}` : task.title}`)

  lines.push('', `${planLabel}:`)
  if (plan.length === 0) lines.push('• sem tarefas de trabalho abertas')
  for (const task of plan) lines.push(`• ${task.title}`)

  lines.push('')
  if (blockers.length === 0) lines.push('Impedimentos: nenhum')
  else
    lines.push(
      `Impedimentos: aguardando decisão sobre ${blockers.map((task) => task.title.replace(/\?$/, '')).join('; ')}`,
    )

  return { doneDate, doneLabel, planLabel, done, plan, blockers, text: lines.join('\n') }
}
