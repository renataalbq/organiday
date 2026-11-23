import type { ReactNode } from 'react'
import { useCompleteTask, useReopenTask } from '../data/tasks'
import { daysFromToday, formatRelativeDate, formatTime } from '../lib/dates'
import { formatDuration } from '../lib/dayBudget/dayBudget'
import type { Area, Task } from '../types'
import { Icon } from './Icon'
import { useTaskEditor } from './TaskEditor'

interface TaskRowProps {
  task: Task
  area?: Area
  /** motivos da priorização, mostrados nas Prioridades de hoje */
  reasons?: string[]
  showDate?: boolean
  isPinned?: boolean
  /** ação extra à direita (ex.: fixar nas prioridades) */
  trailing?: ReactNode
}

export function TaskRow({ task, area, reasons, showDate = true, isPinned = false, trailing }: TaskRowProps) {
  const { openTask } = useTaskEditor()
  const completeTask = useCompleteTask()
  const reopenTask = useReopenTask()
  const isDone = task.status === 'done'
  const isOverdue = !isDone && task.due_date !== null && daysFromToday(task.due_date) < 0
  const ringColor = area?.color ?? 'var(--color-ink-faint)'

  const toggle = () => (isDone ? reopenTask.mutate(task.id) : completeTask.mutate(task.id))

  return (
    <div className="group flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={isDone ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
        className="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-md border-2 transition-colors"
        style={{ borderColor: ringColor, backgroundColor: isDone ? ringColor : 'transparent' }}
      >
        {isDone && <Icon name="check" size={14} className="text-white [animation:check-pop_.25s_ease-out]" />}
      </button>

      <button type="button" onClick={() => openTask(task)} className="min-w-0 flex-1 text-left">
        <span className={`block text-[15px] leading-snug font-medium [overflow-wrap:anywhere] ${isDone ? 'text-ink-faint line-through' : ''}`}>
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-soft">
          {isPinned && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-lilac-deep">
              <Icon name="pin" size={12} /> fixada
            </span>
          )}
          {showDate && task.due_date && (
            <span className={`inline-flex items-center gap-1 ${isOverdue ? 'font-semibold text-alert' : ''}`}>
              <Icon name="calendar" size={12} />
              {formatRelativeDate(task.due_date)}
              {task.due_time && `, ${formatTime(task.due_time)}`}
            </span>
          )}
          {!showDate && task.due_time && (
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={12} /> {formatTime(task.due_time)}
            </span>
          )}
          {task.duration_minutes && <span>~{formatDuration(task.duration_minutes)}</span>}
          {task.recurrence && <Icon name="repeat" size={12} />}
          {task.priority >= 3 && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${task.priority === 4 ? 'text-alert' : ''}`}
            >
              <Icon name="flag" size={12} /> {task.priority === 4 ? 'urgente' : 'alta'}
            </span>
          )}
          {area && (
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
              {area.name}
            </span>
          )}
          {reasons && reasons.length > 0 && <span className="text-ink-faint">{reasons.slice(0, 2).join(', ')}</span>}
        </span>
      </button>
      {trailing}
    </div>
  )
}
