import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PinButton } from '../components/PinButton'
import { useTaskEditor } from '../components/TaskEditor'
import { TaskRow } from '../components/TaskRow'
import { useAreas } from '../data/areas'
import { useTasks, useUpdateTask } from '../data/tasks'
import { useNow } from '../hooks/useNow'
import { daysFromToday } from '../lib/dates'
import { scoreTask } from '../lib/priority/scoreTask'
import type { Area, Task, TaskKind } from '../types'

const KIND_TABS: Array<{ kind: TaskKind; label: string }> = [
  { kind: 'task', label: 'Tarefas' },
  { kind: 'decision', label: 'Decisões' },
  { kind: 'meeting', label: 'Reuniões' },
]

interface Group {
  title: string
  tasks: Task[]
}

function groupByWhen(tasks: Task[], now: Date): Group[] {
  const overdue: Task[] = []
  const today: Task[] = []
  const upcoming: Task[] = []
  const someday: Task[] = []
  for (const task of tasks) {
    if (!task.due_date) someday.push(task)
    else {
      const days = daysFromToday(task.due_date, now)
      if (days < 0) overdue.push(task)
      else if (days === 0) today.push(task)
      else upcoming.push(task)
    }
  }
  upcoming.sort((a, b) => (a.due_date! + (a.due_time ?? '')).localeCompare(b.due_date! + (b.due_time ?? '')))
  return [
    { title: 'Atrasadas', tasks: overdue },
    { title: 'Hoje', tasks: today },
    { title: 'Próximas', tasks: upcoming },
    { title: 'Sem data', tasks: someday },
  ].filter((group) => group.tasks.length > 0)
}

export function TasksPage({ inboxOnly = false }: { inboxOnly?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { now } = useNow()
  const { data: tasks = [], isLoading } = useTasks()
  const { areas, areasById } = useAreas()
  const { openNewTask } = useTaskEditor()
  const [showDone, setShowDone] = useState(false)

  const areaFilter = inboxOnly ? 'inbox' : searchParams.get('area')
  const kind = (searchParams.get('tipo') as TaskKind | null) ?? 'task'
  const selectedArea = areaFilter && areaFilter !== 'inbox' ? areasById.get(areaFilter) : undefined

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const { groups, done } = useMemo(() => {
    const matchesArea = (task: Task) =>
      !areaFilter || (areaFilter === 'inbox' ? task.area_id === null : task.area_id === areaFilter)
    const filtered = tasks.filter((task) => task.kind === kind && matchesArea(task))
    const open = filtered
      .filter((task) => task.status === 'open')
      .map((task) => ({
        task,
        score: scoreTask(task, task.area_id ? areasById.get(task.area_id) : undefined, now).score,
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ task }) => task)
    const doneTasks = filtered
      .filter((task) => task.status === 'done')
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return { groups: groupByWhen(open, now), done: doneTasks }
  }, [tasks, kind, areaFilter, areasById, now])

  const title = inboxOnly ? 'Inbox' : selectedArea ? selectedArea.name : 'Tudo'
  const openCount = groups.reduce((sum, group) => sum + group.tasks.length, 0)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[2rem] leading-tight font-extrabold tracking-tight">
            {selectedArea && <span className="size-4 rounded-full" style={{ backgroundColor: selectedArea.color }} />}
            {title}
          </h1>
          <p className="text-sm text-navy-soft">
            {inboxOnly ? 'O que entrou sem área. Dê um destino pra cada item.' : `${openCount} em aberto`}
          </p>
        </div>
        <button
          type="button"
          className="button-primary"
          onClick={() => openNewTask({ kind, area_id: selectedArea?.id ?? null })}
        >
          <Icon name="plus" size={16} /> Novo
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-paper p-1">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => setParam('tipo', tab.kind === 'task' ? null : tab.kind)}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${kind === tab.kind ? 'bg-card text-navy shadow-sm' : 'text-navy-soft hover:text-navy'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!inboxOnly && (
          <div className="flex flex-wrap gap-1.5">
            <AreaFilterChip label="Todas" isActive={!areaFilter} onClick={() => setParam('area', null)} />
            {areas.map((area) => (
              <AreaFilterChip
                key={area.id}
                label={area.name}
                color={area.color}
                isActive={areaFilter === area.id}
                onClick={() => setParam('area', area.id)}
              />
            ))}
          </div>
        )}
      </div>

      <section className="rounded-[var(--radius-card)] border border-line bg-card px-4 py-2 sm:px-5">
        {isLoading ? (
          <p className="py-6 text-navy-soft">Carregando…</p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-sm text-navy-soft">
            {inboxOnly ? 'Inbox vazia. Tudo tem lugar.' : 'Nada em aberto aqui. Use o campo de adicionar lá em cima.'}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.title} className="py-2">
              <h2 className={`eyebrow mb-1 ${group.title === 'Atrasadas' ? 'text-alert' : ''}`}>{group.title}</h2>
              <div className="divide-y divide-line/70">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    area={task.area_id ? areasById.get(task.area_id) : undefined}
                    trailing={
                      inboxOnly ? (
                        <AreaPicker task={task} areas={areas} />
                      ) : task.kind === 'task' ? (
                        <PinButton task={task} />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {done.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDone((value) => !value)} className="button-quiet -ml-3">
            {showDone ? 'Esconder concluídas' : `Ver concluídas nas últimas 2 semanas (${done.length})`}
          </button>
          {showDone && (
            <section className="mt-2 rounded-[var(--radius-card)] border border-line bg-card/60 px-4 py-2 sm:px-5">
              {done.map((task) => (
                <TaskRow key={task.id} task={task} area={task.area_id ? areasById.get(task.area_id) : undefined} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function AreaFilterChip({
  label,
  color,
  isActive,
  onClick,
}: {
  label: string
  color?: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
        isActive ? 'border-navy bg-navy text-white' : 'border-line bg-card text-navy-soft hover:border-navy-faint'
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  )
}

function AreaPicker({ task, areas }: { task: Task; areas: Area[] }) {
  const updateTask = useUpdateTask()
  return (
    <div className="flex shrink-0 gap-1" role="group" aria-label={`Mover "${task.title}" para`}>
      {areas.map((area) => (
        <button
          key={area.id}
          type="button"
          onClick={() => updateTask.mutate({ id: task.id, changes: { area_id: area.id } })}
          title={`Mover para ${area.name}`}
          aria-label={`Mover para ${area.name}`}
          className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-white transition-transform hover:scale-110"
          style={{ backgroundColor: area.color }}
        >
          {area.name.slice(0, 1)}
        </button>
      ))}
    </div>
  )
}
