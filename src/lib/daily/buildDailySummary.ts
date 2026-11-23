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
  /** o que vou fazer: primeiro as já começadas pelo foco, depois as mais prioritárias */
  plan: Task[]
  /** tarefas marcadas como bloqueadas, com o motivo */
  blocked: Task[]
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
 * Resumo pra daily (ou qualquer reunião), só com o que é de áreas de trabalho:
 * o que já fiz, o que vou fazer e o que está travado.
 * Durante o expediente: feito no último dia útil + plano de hoje.
 * Depois do expediente ou no fim de semana: feito no último dia útil (inclusive hoje) + plano do próximo.
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
  const blocked = openWork.filter((task) => task.kind === 'task' && Boolean(task.blocked_reason))
  // já começadas continuam sendo "vou fazer", e vêm antes das outras
  const started = openWork.filter((task) => task.kind === 'task' && Boolean(task.started_at) && !task.blocked_reason)
  const skipIds = new Set([...blocked, ...started].map((task) => task.id))

  const planDayISO = toISODate(planDay)
  const plannable = openWork.filter((task) => !skipIds.has(task.id) && isPlannableOn(task, planDayISO))
  const ranked = rankTasks(plannable, areasById, planDayISO, planDay)
    .slice(0, Math.max(0, PLAN_SIZE - started.length))
    .map((item) => item.task)
  const plan = [...started, ...ranked]
  const blockers = openWork.filter((task) => task.kind === 'decision')

  const doneLabel = relativeLabel(doneDay, today)
  const planLabel = relativeLabel(planDay, today)

  const lines: string[] = [`Já fiz (${doneLabel.toLowerCase()}):`]
  if (done.length === 0) lines.push('• nada marcado como concluído')
  for (const task of done) lines.push(`• ${task.kind === 'decision' ? `decidi: ${task.title}` : task.title}`)

  lines.push('', `Vou fazer (${planLabel.toLowerCase()}):`)
  if (plan.length === 0) lines.push('• sem tarefas de trabalho abertas')
  for (const task of plan) lines.push(`• ${task.title}`)

  lines.push('')
  const impediments = [
    ...blocked.map((task) => `${task.title} (${task.blocked_reason})`),
    ...(blockers.length > 0
      ? [`aguardando decisão sobre ${blockers.map((task) => task.title.replace(/\?$/, '')).join('; ')}`]
      : []),
  ]
  lines.push(`Impedimentos: ${impediments.length === 0 ? 'nenhum' : impediments.join('; ')}`)

  return { doneDate, doneLabel, planLabel, done, plan, blocked, blockers, text: lines.join('\n') }
}
