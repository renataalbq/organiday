import { useUpdateTask } from '../data/tasks'
import { toISODate } from '../lib/dates'
import type { Task } from '../types'
import { Icon } from './Icon'

/** Fixa (ou solta) a tarefa no Foco do dia de hoje. */
export function PinButton({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  const todayISO = toISODate(new Date())
  const isPinned = task.focus_date === todayISO

  return (
    <button
      type="button"
      onClick={() => updateTask.mutate({ id: task.id, changes: { focus_date: isPinned ? null : todayISO } })}
      className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
        isPinned
          ? 'bg-blue-deep text-white'
          : 'text-navy-faint opacity-100 hover:bg-black/5 hover:text-navy sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'
      }`}
      aria-label={isPinned ? `Tirar "${task.title}" do foco` : `Fixar "${task.title}" no foco de hoje`}
      aria-pressed={isPinned}
      title={isPinned ? 'Tirar do foco' : 'Fixar no foco de hoje'}
    >
      <Icon name="pin" size={15} />
    </button>
  )
}
