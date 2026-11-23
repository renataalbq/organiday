import { useUpdateTask } from '../data/tasks'
import { toISODate } from '../lib/dates'
import type { Task } from '../types'
import { Icon } from './Icon'

/** Fixa (ou solta) a tarefa nas prioridades de hoje. */
export function PinButton({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  const todayISO = toISODate(new Date())
  const isPinned = task.focus_date === todayISO

  return (
    <button
      type="button"
      onClick={() => updateTask.mutate({ id: task.id, changes: { focus_date: isPinned ? null : todayISO } })}
      className={`grid size-10 shrink-0 place-items-center rounded-lg transition-colors ${
        isPinned ? 'bg-accent-soft text-accent' : 'text-ink-faint hover:bg-hover-strong hover:text-ink'
      }`}
      aria-label={isPinned ? `Tirar "${task.title}" das prioridades` : `Fixar "${task.title}" nas prioridades de hoje`}
      aria-pressed={isPinned}
      title={isPinned ? 'Tirar das prioridades' : 'Fixar nas prioridades de hoje'}
    >
      <Icon name="pin" size={16} />
    </button>
  )
}
