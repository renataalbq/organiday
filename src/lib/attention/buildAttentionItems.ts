import { daysFromToday, formatTime } from '../dates.ts'
import { formatDuration, timeToMinutes, type DayBudget } from '../dayBudget/dayBudget.ts'
import type { Task } from '../../types.ts'

export interface AttentionItem {
  id: string
  tone: 'alert' | 'heads-up'
  text: string
  taskId?: string
}

interface AttentionInput {
  openTasks: Task[]
  todayMeetings: Task[]
  budget: DayBudget
  now: Date
}

const SOON_MINUTES = 30

/** O que merece um olhar agora. Lista vazia = está tudo em dia. */
export function buildAttentionItems({ openTasks, todayMeetings, budget, now }: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []
  const nowMinute = now.getHours() * 60 + now.getMinutes()

  for (const meeting of todayMeetings) {
    const startsIn = timeToMinutes(meeting.due_time!) - nowMinute
    if (startsIn >= 0 && startsIn <= SOON_MINUTES) {
      items.push({
        id: `soon-${meeting.id}`,
        tone: 'alert',
        text: startsIn === 0 ? `${meeting.title} começa agora` : `${meeting.title} começa em ${startsIn}min`,
        taskId: meeting.id,
      })
    }
  }

  const overdue = openTasks.filter(
    (task) => task.kind !== 'meeting' && task.due_date && daysFromToday(task.due_date, now) < 0,
  )
  if (overdue.length === 1) {
    items.push({ id: 'overdue', tone: 'alert', text: `"${overdue[0].title}" está atrasada`, taskId: overdue[0].id })
  } else if (overdue.length > 1) {
    items.push({ id: 'overdue', tone: 'alert', text: `${overdue.length} itens atrasados` })
  }

  const urgentToday = openTasks.filter(
    (task) =>
      task.kind === 'task' && task.priority === 4 && (!task.due_date || daysFromToday(task.due_date, now) === 0),
  )
  for (const task of urgentToday.slice(0, 2)) {
    items.push({ id: `urgent-${task.id}`, tone: 'alert', text: `Urgente: ${task.title}`, taskId: task.id })
  }

  const decisionsDue = openTasks.filter(
    (task) => task.kind === 'decision' && task.due_date && daysFromToday(task.due_date, now) === 0,
  )
  for (const decision of decisionsDue) {
    items.push({
      id: `decision-${decision.id}`,
      tone: 'heads-up',
      text: `Decidir hoje: ${decision.title}`,
      taskId: decision.id,
    })
  }

  if (budget.isWorkday && budget.plannedMinutes > budget.freeFromNowMinutes && nowMinute < budget.workdayEnd) {
    const missing = budget.plannedMinutes - budget.freeFromNowMinutes
    items.push({
      id: 'overbooked',
      tone: 'heads-up',
      text: `Seu dia não fecha: faltam ${formatDuration(missing)} pras tarefas de trabalho de hoje`,
    })
  }

  const nextMeeting = todayMeetings
    .filter((meeting) => timeToMinutes(meeting.due_time!) - nowMinute > SOON_MINUTES)
    .sort((a, b) => a.due_time!.localeCompare(b.due_time!))[0]
  if (items.length === 0 && nextMeeting) {
    items.push({
      id: 'next-meeting',
      tone: 'heads-up',
      text: `Próxima reunião: ${nextMeeting.title} às ${formatTime(nextMeeting.due_time!)}`,
      taskId: nextMeeting.id,
    })
  }

  return items
}
