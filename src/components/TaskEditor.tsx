import { createContext, useCallback, useContext, useState, type FormEvent, type ReactNode } from 'react'
import { useAreas } from '../data/areas'
import { useCreateTask, useDeleteTask, useUpdateTask } from '../data/tasks'
import { DEFAULT_MEETING_MINUTES } from '../lib/dayBudget/dayBudget'
import { toISODate } from '../lib/dates'
import {
  KIND_LABEL,
  PRIORITY_LABEL,
  RECURRENCE_LABEL,
  type NewTask,
  type Priority,
  type Recurrence,
  type Task,
  type TaskKind,
} from '../types'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

interface TaskEditorApi {
  openTask: (task: Task) => void
  openNewTask: (defaults?: Partial<NewTask>) => void
}

const TaskEditorContext = createContext<TaskEditorApi | null>(null)

export function useTaskEditor(): TaskEditorApi {
  const api = useContext(TaskEditorContext)
  if (!api) throw new Error('useTaskEditor precisa estar dentro de <TaskEditorProvider>')
  return api
}

type EditorTarget = { mode: 'edit'; task: Task } | { mode: 'create'; defaults: Partial<NewTask> }

export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<EditorTarget | null>(null)
  const openTask = useCallback((task: Task) => setTarget({ mode: 'edit', task }), [])
  const openNewTask = useCallback((defaults: Partial<NewTask> = {}) => setTarget({ mode: 'create', defaults }), [])

  return (
    <TaskEditorContext.Provider value={{ openTask, openNewTask }}>
      {children}
      {target && <TaskEditorDialog target={target} onClose={() => setTarget(null)} />}
    </TaskEditorContext.Provider>
  )
}

interface Draft {
  kind: TaskKind
  title: string
  notes: string
  areaId: string
  priority: Priority
  dueDate: string
  dueTime: string
  durationMinutes: string
  recurrence: Recurrence | ''
}

function draftFromTarget(target: EditorTarget): Draft {
  const source = target.mode === 'edit' ? target.task : target.defaults
  return {
    kind: source.kind ?? 'task',
    title: source.title ?? '',
    notes: source.notes ?? '',
    areaId: source.area_id ?? '',
    priority: source.priority ?? 2,
    dueDate: source.due_date ?? '',
    dueTime: source.due_time?.slice(0, 5) ?? '',
    durationMinutes: source.duration_minutes ? String(source.duration_minutes) : '',
    recurrence: source.recurrence ?? '',
  }
}

function TaskEditorDialog({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const { areas } = useAreas()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [draft, setDraft] = useState<Draft>(() => draftFromTarget(target))
  const [error, setError] = useState<string | null>(null)

  const set = <Key extends keyof Draft>(key: Key, value: Draft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const isMeeting = draft.kind === 'meeting'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) return setError('Dê um título.')
    if (isMeeting && !draft.dueTime) return setError('Reunião precisa de horário.')
    if (draft.recurrence && !draft.dueDate && !isMeeting) return setError('Para repetir, escolha a primeira data.')

    const dueDate = draft.dueDate || (draft.dueTime || draft.recurrence ? toISODate(new Date()) : null)
    const payload = {
      kind: draft.kind,
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      area_id: draft.areaId || null,
      priority: draft.priority,
      due_date: dueDate,
      due_time: draft.dueTime || null,
      duration_minutes: draft.durationMinutes
        ? Number(draft.durationMinutes)
        : isMeeting
          ? DEFAULT_MEETING_MINUTES
          : null,
      recurrence: draft.recurrence || null,
    }

    try {
      if (target.mode === 'edit') await updateTask.mutateAsync({ id: target.task.id, changes: payload })
      else await createTask.mutateAsync(payload)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não deu pra salvar. Tente de novo.')
    }
  }

  const handleDelete = () => {
    if (target.mode !== 'edit') return
    deleteTask.mutate(target.task.id)
    onClose()
  }

  const isSaving = createTask.isPending || updateTask.isPending

  return (
    <Sheet label={target.mode === 'edit' ? 'Editar item' : 'Novo item'} onClose={onClose} onSubmit={handleSubmit}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-full bg-cream p-1">
          {(Object.keys(KIND_LABEL) as TaskKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => set('kind', kind)}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${draft.kind === kind ? 'bg-card text-navy shadow-sm' : 'text-navy-soft'}`}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="button-quiet p-2" aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      <input
        autoFocus
        value={draft.title}
        onChange={(event) => set('title', event.target.value)}
        placeholder={
          draft.kind === 'decision'
            ? 'O que você precisa decidir?'
            : isMeeting
              ? 'Nome da reunião'
              : 'O que precisa ser feito?'
        }
        className="mb-4 w-full bg-transparent font-display text-2xl font-bold tracking-tight outline-none placeholder:text-navy-faint"
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 sm:col-span-1">
          <span className="label">Área</span>
          <select className="field" value={draft.areaId} onChange={(event) => set('areaId', event.target.value)}>
            <option value="">Inbox (sem área)</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        {!isMeeting && (
          <label className="col-span-2 sm:col-span-1">
            <span className="label">Prioridade</span>
            <select
              className="field"
              value={draft.priority}
              onChange={(event) => set('priority', Number(event.target.value) as Priority)}
            >
              {([4, 3, 2, 1] as Priority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span className="label">{draft.kind === 'decision' ? 'Decidir até' : 'Data'}</span>
          <input
            type="date"
            className="field"
            value={draft.dueDate}
            onChange={(event) => set('dueDate', event.target.value)}
          />
        </label>
        <label>
          <span className="label">Horário</span>
          <input
            type="time"
            className="field"
            value={draft.dueTime}
            onChange={(event) => set('dueTime', event.target.value)}
          />
        </label>

        <label>
          <span className="label">{isMeeting ? 'Duração (min)' : 'Estimativa (min)'}</span>
          <input
            type="number"
            min={5}
            step={5}
            inputMode="numeric"
            className="field"
            placeholder={isMeeting ? String(DEFAULT_MEETING_MINUTES) : 'opcional'}
            value={draft.durationMinutes}
            onChange={(event) => set('durationMinutes', event.target.value)}
          />
        </label>
        <label>
          <span className="label">Repetir</span>
          <select
            className="field"
            value={draft.recurrence}
            onChange={(event) => set('recurrence', event.target.value as Recurrence | '')}
          >
            <option value="">Não repete</option>
            {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((recurrence) => (
              <option key={recurrence} value={recurrence}>
                {RECURRENCE_LABEL[recurrence]}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2">
          <span className="label">Notas</span>
          <textarea
            rows={3}
            className="field resize-none"
            value={draft.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-alert">{error}</p>}

      <footer className="mt-5 flex items-center justify-between">
        {target.mode === 'edit' ? (
          <button type="button" onClick={handleDelete} className="button-quiet text-alert hover:text-alert">
            <Icon name="trash" size={16} /> Excluir
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="button-quiet">
            Cancelar
          </button>
          <button type="submit" className="button-primary" disabled={isSaving}>
            {target.mode === 'edit' ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </footer>
    </Sheet>
  )
}
