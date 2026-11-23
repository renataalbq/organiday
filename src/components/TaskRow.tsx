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
  /** motivos da priorização, mostrados nas prioridades */
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
  const ringColor = area?.color ?? 'var(--color-line-strong)'

  const toggle = () => (isDone ? reopenTask.mutate(task.id) : completeTask.mutate(task.id))

  return (
    <div className="group flex items-start gap-3.5 py-3.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={isDone ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
        className="mt-px grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors hover:bg-hover"
        style={{ borderColor: ringColor, backgroundColor: isDone ? ringColor : undefined }}
      >
        {isDone && <Icon name="check" size={13} className="text-white [animation:check-pop_.25s_ease-out]" />}
      </button>

      <button type="button" onClick={() => openTask(task)} className="min-w-0 flex-1 text-left">
        <span
          className={`block text-[15px] leading-snug [overflow-wrap:anywhere] ${isDone ? 'text-ink-faint line-through' : 'text-ink'}`}
        >
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-soft">
          {isPinned && (
            <span className="inline-flex items-center gap-0.5 font-medium text-accent">
              <Icon name="pin" size={12} /> fixada
            </span>
          )}
          {showDate && task.due_date && (
            <span className={isOverdue ? 'font-medium text-alert' : ''}>
              {formatRelativeDate(task.due_date)}
              {task.due_time && `, ${formatTime(task.due_time)}`}
            </span>
          )}
          {!showDate && task.due_time && <span>{formatTime(task.due_time)}</span>}
          {task.duration_minutes && <span>~{formatDuration(task.duration_minutes)}</span>}
          {task.recurrence && <Icon name="repeat" size={12} />}
          {task.priority >= 3 && (
            <span className="font-medium text-alert">{task.priority === 4 ? 'urgente' : 'alta'}</span>
          )}
          {area && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-[7px] rounded-[2px]" style={{ backgroundColor: area.color }} />
              {area.name}
            </span>
          )}
          {task.blocked_reason && !isDone && (
            <span className="inline-flex items-center gap-1 font-medium text-peach-ink">
              <Icon name="lock" size={12} /> {task.blocked_reason}
            </span>
          )}
          {reasons && reasons.length > 0 && <span className="text-ink-faint">{reasons.slice(0, 2).join(', ')}</span>}
        </span>
      </button>
      {trailing}
    </div>
  )
}
