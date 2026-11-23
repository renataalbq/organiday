import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { QuickAdd } from '../components/QuickAdd'
import { useTaskEditor } from '../components/TaskEditor'
import { useAreas } from '../data/areas'
import { useDeleteTask, useTasks, useUpdateTask } from '../data/tasks'
import { useNow } from '../hooks/useNow'
import { daysFromToday, formatRelativeDate } from '../lib/dates'
import type { Area, Task, TaskKind } from '../types'
import { KIND_TABS } from './TasksPage'

function addedLabel(task: Task, now: Date): string {
  const days = -daysFromToday(task.created_at.slice(0, 10), now)
  if (days <= 0) return 'adicionada hoje'
  if (days === 1) return 'adicionada ontem'
  return `adicionada há ${days} dias`
}

/** O que entrou sem área. Cada item ganha um destino com um clique. */
export function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { now } = useNow()
  const { data: tasks = [], isLoading } = useTasks()
  const { areas } = useAreas()
  const kind = (searchParams.get('tipo') as TaskKind | null) ?? 'task'

  const items = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'open' && task.area_id === null && task.kind === kind)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [tasks, kind],
  )

  return (
    <div>
      <PageHeader
        eyebrow="O que entrou sem área. Dê um destino pra cada item."
        title="Inbox"
        aside={<QuickAdd placeholder="anota rápido, organiza depois" />}
      />

      <div className="segmented mb-5" role="group" aria-label="Tipo">
        {KIND_TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            aria-pressed={kind === tab.kind}
            onClick={() => setSearchParams(tab.kind === 'task' ? {} : { tipo: tab.kind }, { replace: true })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-ink-soft">Carregando…</p>
      ) : items.length === 0 ? (
        <section className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="inboxCheck" size={26} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold tracking-[-0.01em]">Inbox zerada. Tudo tem lugar.</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Tudo que você adicionar sem <strong className="font-semibold text-ink">#área</strong> cai aqui. Quando
            aparecer algo, é só escolher o destino com um clique.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {items.map((task) => (
            <InboxItem key={task.id} task={task} areas={areas} now={now} />
          ))}
        </ul>
      )}
    </div>
  )
}

function InboxItem({ task, areas, now }: { task: Task; areas: Area[]; now: Date }) {
  const { openTask } = useTaskEditor()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  return (
    <li className="card flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
      <button type="button" onClick={() => openTask(task)} className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] [overflow-wrap:anywhere]">{task.title}</span>
        <span className="mt-1 block text-xs text-ink-soft">
          {addedLabel(task, now)}
          {task.due_date && ` · vence ${formatRelativeDate(task.due_date)}`}
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Mover "${task.title}" para`}>
        <span className="mr-1 text-xs text-ink-soft">Mover para</span>
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            className="pill"
            onClick={() => updateTask.mutate({ id: task.id, changes: { area_id: area.id } })}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
            {area.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => window.confirm(`Excluir "${task.title}"?`) && deleteTask.mutate(task.id)}
          className="grid size-9 place-items-center rounded-lg text-ink-faint hover:bg-hover-strong hover:text-alert"
          aria-label={`Excluir "${task.title}"`}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
    </li>
  )
}
