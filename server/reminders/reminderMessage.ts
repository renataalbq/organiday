/** Lembrete que o banco devolve (claim_due_reminders) e o texto da notificação. */

export interface DueReminder {
  task_id: string
  user_id: string
  title: string
  due_date: string
  /** HH:MM:SS ou null */
  due_time: string | null
  kind: 'task' | 'decision' | 'meeting'
  minutes_before: number | null
}

export interface PushMessage {
  title: string
  body: string
  /** agrupa: o mesmo lembrete não empilha duas notificações */
  tag: string
  url: string
}

const clock = (time: string) => {
  const [hours, minutes] = time.split(':')
  return minutes === '00' ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`
}

const inMinutes = (minutes: number) => {
  if (minutes <= 0) return 'agora'
  if (minutes < 60) return `daqui a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `daqui a ${hours}h${rest ? String(rest).padStart(2, '0') : ''}`
}

export function reminderMessage(reminder: DueReminder): PushMessage {
  const base = { title: reminder.title, tag: `task-${reminder.task_id}`, url: '/' }

  if (reminder.due_time) {
    const what = reminder.kind === 'meeting' ? 'Reunião' : reminder.kind === 'decision' ? 'Decisão' : 'Tarefa'
    const when = inMinutes(reminder.minutes_before ?? 0)
    return { ...base, body: `${what} às ${clock(reminder.due_time)}, ${when}.` }
  }

  const body = reminder.kind === 'decision' ? 'Decisão pra tomar hoje.' : 'Vence hoje.'
  return { ...base, body }
}
