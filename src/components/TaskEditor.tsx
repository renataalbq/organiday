import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useAreas } from '../data/areas'
import { useCreateTask, useDeleteTask, useUpdateTask } from '../data/tasks'
import { DEFAULT_MEETING_MINUTES } from '../lib/dayBudget/dayBudget'
import { addDays, formatRelativeDate, toISODate } from '../lib/dates'
import { prefersAutoFocus } from '../lib/device'
import { parseQuickAdd } from '../lib/quickAdd/parseQuickAdd'
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
import { ParsedChips } from './ParsedChips'
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
  isBlocked: boolean
  blockedReason: string
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
    isBlocked: Boolean(source.blocked_reason),
    blockedReason: source.blocked_reason ?? '',
  }
}

const DURATION_PRESETS = [15, 30, 60, 120]
const durationLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${minutes / 60}h`)

const TITLE_PROMPT: Record<TaskKind, string> = {
  task: 'O que precisa ser feito?',
  decision: 'O que você precisa decidir?',
  meeting: 'Qual reunião?',
}

function nextMonday(today: Date): Date {
  const distance = (8 - today.getDay()) % 7 || 7
  return addDays(today, distance)
}

function TaskEditorDialog({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const { areas } = useAreas()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [draft, setDraft] = useState<Draft>(() => draftFromTarget(target))
  const [error, setError] = useState<string | null>(null)
  const [createAnother, setCreateAnother] = useState(false)
  const [isCustomDuration, setIsCustomDuration] = useState(
    () => draft.durationMinutes !== '' && !DURATION_PRESETS.includes(Number(draft.durationMinutes)),
  )
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // título cresce com o texto (o Safari não tem field-sizing)
  useLayoutEffect(() => {
    const element = titleRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [draft.title])

  const [today] = useState(() => new Date())
  const todayISO = toISODate(today)
  const tomorrowISO = toISODate(addDays(today, 1))
  const mondayISO = toISODate(nextMonday(today))

  const set = <Key extends keyof Draft>(key: Key, value: Draft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const isMeeting = draft.kind === 'meeting'
  const isEdit = target.mode === 'edit'
  const originalTitle = isEdit ? target.task.title : ''

  // o título aceita os mesmos atalhos do adicionar rápido; o que ele entender preenche os campos
  const parsed = useMemo(
    () => (draft.title.trim() && draft.title !== originalTitle ? parseQuickAdd(draft.title, areas) : null),
    [draft.title, originalTitle, areas],
  )
  const hasParsedTokens = Boolean(parsed?.tokens.some((token) => token.kind !== 'unknownArea'))

  const changeTitle = (title: string) => {
    const result = title.trim() && title !== originalTitle ? parseQuickAdd(title, areas) : null
    setDraft((current) => ({
      ...current,
      title,
      ...(result?.kind && result.kind !== 'task' ? { kind: result.kind } : {}),
      ...(result?.areaId ? { areaId: result.areaId } : {}),
      ...(result?.priority ? { priority: result.priority } : {}),
      ...(result?.dueDate ? { dueDate: result.dueDate } : {}),
      ...(result?.dueTime ? { dueTime: result.dueTime.slice(0, 5) } : {}),
      ...(result?.durationMinutes ? { durationMinutes: String(result.durationMinutes) } : {}),
      ...(result?.recurrence ? { recurrence: result.recurrence } : {}),
    }))
    if (result?.durationMinutes) setIsCustomDuration(!DURATION_PRESETS.includes(result.durationMinutes))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const title = (hasParsedTokens && parsed ? parsed.title : draft.title).trim()
    if (!title) return setError('Dê um título.')
    if (isMeeting && !draft.dueTime) return setError('Reunião precisa de horário.')
    if (draft.recurrence && !draft.dueDate && !isMeeting) return setError('Para repetir, escolha a primeira data.')
    if (draft.isBlocked && !draft.blockedReason.trim()) return setError('Escreva o que está travando a tarefa.')

    const dueDate = draft.dueDate || (draft.dueTime || draft.recurrence ? todayISO : null)
    const blockedReason = draft.kind === 'task' && draft.isBlocked ? draft.blockedReason.trim() : null
    const originalReason = isEdit ? (target.task.blocked_reason ?? null) : null
    const payload = {
      kind: draft.kind,
      title,
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
      // só manda o campo quando mudou: sem a migration 0004, ele não existe no banco
      ...(blockedReason !== originalReason ? { blocked_reason: blockedReason } : {}),
    }

    try {
      if (isEdit) await updateTask.mutateAsync({ id: target.task.id, changes: payload })
      else await createTask.mutateAsync(payload)

      if (!isEdit && createAnother) {
        setDraft((current) => ({
          ...current,
          title: '',
          notes: '',
          dueTime: '',
          durationMinutes: '',
          isBlocked: false,
          blockedReason: '',
        }))
        setError(null)
        titleRef.current?.focus()
        return
      }
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não deu pra salvar. Tente de novo.')
    }
  }

  const handleDelete = () => {
    if (!isEdit || !window.confirm(`Excluir "${target.task.title}"?`)) return
    deleteTask.mutate(target.task.id)
    onClose()
  }

  const isSaving = createTask.isPending || updateTask.isPending
  const isCustomDate = draft.dueDate !== '' && ![todayISO, tomorrowISO, mondayISO].includes(draft.dueDate)

  return (
    <Sheet
      size="lg"
      label={isEdit ? 'Editar item' : 'Novo item'}
      onClose={onClose}
      onSubmit={handleSubmit}
      header={
        <div className="flex items-center justify-between gap-2">
          <div className="segmented" role="group" aria-label="Tipo">
            {(Object.keys(KIND_LABEL) as TaskKind[]).map((kind) => (
              <button key={kind} type="button" aria-pressed={draft.kind === kind} onClick={() => set('kind', kind)}>
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="button-quiet p-2" aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
      }
      footer={
        <>
          {error && <p className="mb-2 text-sm font-medium text-alert">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            {isEdit ? (
              <button type="button" onClick={handleDelete} className="button-quiet -ml-3 text-alert hover:text-alert">
                <Icon name="trash" size={16} /> Excluir
              </button>
            ) : (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={createAnother}
                  onChange={(event) => setCreateAnother(event.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                Criar outra em seguida
              </label>
            )}
            <div className="flex items-center gap-2">
              <span className="mr-2 hidden text-xs text-ink-soft md:inline">
                Enter {isEdit ? 'salva' : 'cria'} · Esc fecha
              </span>
              <button type="button" onClick={onClose} className="button-quiet hidden sm:inline-flex">
                Cancelar
              </button>
              <button type="submit" className="button-primary px-5" disabled={isSaving}>
                {isEdit ? 'Salvar' : `Criar ${KIND_LABEL[draft.kind].toLowerCase()}`}
              </button>
            </div>
          </div>
        </>
      }
    >
      <label className="block">
        <span className="text-[13px] text-ink-soft">{TITLE_PROMPT[draft.kind]}</span>
        <textarea
          ref={titleRef}
          autoFocus={!isEdit && prefersAutoFocus()}
          value={draft.title}
          rows={1}
          onChange={(event) => changeTitle(event.target.value.replace(/\n/g, ' '))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={draft.kind === 'task' ? 'revisar PR do checkout amanhã 15h ~30m #trab !alta' : ''}
          className="mt-1.5 block w-full resize-none bg-transparent font-display text-[1.6rem] leading-tight font-bold tracking-[-0.02em] outline-none placeholder:font-semibold placeholder:text-ink-faint/70"
        />
      </label>
      {parsed && <ParsedChips tokens={parsed.tokens} className="mt-3" />}

      <div className="mt-5 grid grid-cols-1 items-center gap-x-6 gap-y-3 border-t border-line pt-5 sm:grid-cols-[110px_1fr] sm:gap-y-4">
        <FieldLabel>Área</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <AreaPill label="Inbox" isActive={draft.areaId === ''} onClick={() => set('areaId', '')} />
          {areas.map((area) => (
            <AreaPill
              key={area.id}
              label={area.name}
              color={area.color}
              isActive={draft.areaId === area.id}
              onClick={() => set('areaId', area.id)}
            />
          ))}
        </div>

        <FieldLabel>{draft.kind === 'decision' ? 'Decidir até' : 'Quando'}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <ChoicePill isActive={draft.dueDate === todayISO} onClick={() => set('dueDate', todayISO)}>
            Hoje
          </ChoicePill>
          <ChoicePill isActive={draft.dueDate === tomorrowISO} onClick={() => set('dueDate', tomorrowISO)}>
            Amanhã
          </ChoicePill>
          <ChoicePill isActive={draft.dueDate === mondayISO} onClick={() => set('dueDate', mondayISO)}>
            Próx. segunda
          </ChoicePill>
          <label className={`pill relative cursor-pointer ${isCustomDate ? 'border-panel bg-panel text-white' : ''}`}>
            <Icon name="calendar" size={14} />
            {isCustomDate ? formatRelativeDate(draft.dueDate) : 'Outra data'}
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => set('dueDate', event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Escolher data"
            />
          </label>
          <label className="pill gap-2 focus-within:border-ink">
            <span className="text-ink-soft">às</span>
            <input
              type="time"
              value={draft.dueTime}
              onChange={(event) => set('dueTime', event.target.value)}
              className="w-[5.5rem] bg-transparent font-semibold outline-none"
              aria-label="Horário"
            />
          </label>
          {(draft.dueDate || draft.dueTime) && !isMeeting && (
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, dueDate: '', dueTime: '', recurrence: '' }))}
              className="button-quiet px-2 text-[13px]"
            >
              Sem data
            </button>
          )}
        </div>

        <FieldLabel>Duração</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((minutes) => (
            <ChoicePill
              key={minutes}
              isActive={!isCustomDuration && draft.durationMinutes === String(minutes)}
              onClick={() => {
                setIsCustomDuration(false)
                set('durationMinutes', draft.durationMinutes === String(minutes) && !isMeeting ? '' : String(minutes))
              }}
            >
              {durationLabel(minutes)}
            </ChoicePill>
          ))}
          {isCustomDuration ? (
            <label className="pill gap-1.5 border-panel">
              <input
                type="number"
                min={5}
                step={5}
                inputMode="numeric"
                autoFocus
                value={draft.durationMinutes}
                onChange={(event) => set('durationMinutes', event.target.value)}
                className="w-14 bg-transparent font-semibold outline-none"
                aria-label="Duração em minutos"
              />
              <span className="text-ink-soft">min</span>
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setIsCustomDuration(true)}
              className="pill border-dashed text-ink-soft"
            >
              outro
            </button>
          )}
        </div>

        {!isMeeting && (
          <>
            <FieldLabel>Prioridade</FieldLabel>
            <div>
              <div className="segmented" role="group" aria-label="Prioridade">
                {([1, 2, 3, 4] as Priority[]).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    aria-pressed={draft.priority === priority}
                    onClick={() => set('priority', priority)}
                    className={draft.priority === priority && priority >= 3 ? '!text-alert' : ''}
                  >
                    {PRIORITY_LABEL[priority]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <FieldLabel>Repetir</FieldLabel>
        <div>
          <select
            className="field sm:max-w-[220px]"
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
        </div>

        {draft.kind === 'task' && (
          <>
            <FieldLabel>Impedimento</FieldLabel>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isBlocked}
                  onChange={(event) => set('isBlocked', event.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                Está travada por algo
              </label>
              {draft.isBlocked && (
                <input
                  className="field"
                  value={draft.blockedReason}
                  onChange={(event) => set('blockedReason', event.target.value)}
                  placeholder="Ex.: esperando as keys do Hugo"
                  maxLength={300}
                  autoFocus
                />
              )}
            </div>
          </>
        )}

        <FieldLabel className="self-start sm:pt-3">Notas</FieldLabel>
        <textarea
          rows={3}
          className="field resize-none"
          value={draft.notes}
          onChange={(event) => set('notes', event.target.value)}
          placeholder="Links, contexto, checklist…"
        />
      </div>
    </Sheet>
  )
}

function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`text-sm text-ink-soft sm:text-ink ${className}`}>{children}</span>
}

function ChoicePill({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={isActive} onClick={onClick} className="pill">
      {children}
    </button>
  )
}

function AreaPill({
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
      aria-pressed={isActive}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        isActive
          ? 'border-accent bg-accent-soft font-medium text-accent-ink'
          : 'border-line bg-card text-ink hover:border-line-strong'
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  )
}
