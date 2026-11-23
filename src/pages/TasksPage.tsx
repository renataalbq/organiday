import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { PinButton } from '../components/PinButton'
import { QuickAdd } from '../components/QuickAdd'
import { useTaskEditor } from '../components/TaskEditor'
import { TaskRow } from '../components/TaskRow'
import { useAreas } from '../data/areas'
import { useTasks } from '../data/tasks'
import { useNow } from '../hooks/useNow'
import { scoreTask } from '../lib/priority/scoreTask'
import { groupByWhen } from '../lib/tasks/groupByWhen'
import type { Task, TaskKind } from '../types'

export const KIND_TABS: Array<{ kind: TaskKind; label: string }> = [
  { kind: 'task', label: 'Tarefas' },
  { kind: 'decision', label: 'Decisões' },
  { kind: 'meeting', label: 'Reuniões' },
]

const NEW_LABEL: Record<TaskKind, string> = { task: 'Nova tarefa', decision: 'Nova decisão', meeting: 'Nova reunião' }

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { now } = useNow()
  const { data: tasks = [], isLoading } = useTasks()
  const { areas, areasById } = useAreas()
  const { openNewTask } = useTaskEditor()
  const [showDone, setShowDone] = useState(false)

  const areaFilter = searchParams.get('area')
  const kind = (searchParams.get('tipo') as TaskKind | null) ?? 'task'
  const selectedArea = areaFilter ? areasById.get(areaFilter) : undefined

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const { groups, done, openCount } = useMemo(() => {
    const filtered = tasks.filter((task) => task.kind === kind && (!areaFilter || task.area_id === areaFilter))
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
    return { groups: groupByWhen(open, now), done: doneTasks, openCount: open.length }
  }, [tasks, kind, areaFilter, areasById, now])

  const areaOf = (task: Task) => (task.area_id ? areasById.get(task.area_id) : undefined)

  return (
    <div>
      <PageHeader
        eyebrow={`${openCount} em aberto · ${done.length} ${done.length === 1 ? 'feita' : 'feitas'} nas últimas 2 semanas`}
        title={
          selectedArea ? (
            <span className="inline-flex items-center gap-3">
              <span className="size-3.5 rounded-full" style={{ backgroundColor: selectedArea.color }} />
              {selectedArea.name}
            </span>
          ) : (
            'Tarefas'
          )
        }
        aside={<QuickAdd placeholder="pagar condomínio todo dia 10 #casa" />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="segmented" role="group" aria-label="Tipo">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              aria-pressed={kind === tab.kind}
              onClick={() => setParam('tipo', tab.kind === 'task' ? null : tab.kind)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="pill" aria-pressed={!areaFilter} onClick={() => setParam('area', null)}>
            Todas
          </button>
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              className="pill"
              aria-pressed={areaFilter === area.id}
              onClick={() => setParam('area', area.id)}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
              {area.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button-dark ml-auto"
          onClick={() => openNewTask({ kind, area_id: selectedArea?.id ?? null })}
        >
          <Icon name="plus" size={16} /> {NEW_LABEL[kind]}
        </button>
      </div>

      <section className="card px-5 py-2 sm:px-6">
        {isLoading ? (
          <p className="py-6 text-ink-soft">Carregando…</p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-sm text-ink-soft">Nada em aberto aqui. Use o campo de adicionar lá em cima.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="pt-4 pb-1">
              <h2 className={`eyebrow border-b border-line pb-2.5 ${group.key === 'overdue' ? 'text-alert' : ''}`}>
                {group.title}
              </h2>
              <div className="divide-y divide-line">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    area={areaOf(task)}
                    showDate={group.key !== 'today' && group.key !== 'tomorrow'}
                    trailing={task.kind === 'task' ? <PinButton task={task} /> : undefined}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {done.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-ink"
            aria-expanded={showDone}
          >
            <Icon name="chevronDown" size={16} className={showDone ? 'rotate-180' : ''} />
            {showDone ? 'Esconder feitas' : `Ver feitas nas últimas 2 semanas (${done.length})`}
          </button>
          {showDone && (
            <section className="card mt-3 px-5 py-1 opacity-90 sm:px-6">
              <div className="divide-y divide-line">
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} area={areaOf(task)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
