import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { DayNotesEditor } from '../components/DayNotesEditor'
import { Icon } from '../components/Icon'
import { TaskRow } from '../components/TaskRow'
import { useTaskEditor } from '../components/TaskEditor'
import { useAreas } from '../data/areas'
import { useSettings } from '../data/settings'
import { useCreateTask, useTasks } from '../data/tasks'
import { useNow } from '../hooks/useNow'
import { DEFAULT_MEETING_MINUTES, minutesToClock, timeToMinutes } from '../lib/dayBudget/dayBudget'
import { addDays, fromISODate, toISODate } from '../lib/dates'
import { placeEvents } from '../lib/dayAgenda/placeEvents'
import { parseQuickAdd } from '../lib/quickAdd/parseQuickAdd'
import type { Area, Task } from '../types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return 'Boa noite'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export function DayPage() {
  const { date } = useParams()
  const { now, todayISO } = useNow()

  if (date !== undefined && (!ISO_DATE.test(date) || Number.isNaN(fromISODate(date).getTime()))) {
    return <Navigate to="/dia" replace />
  }
  const day = date ?? todayISO

  return <DayView day={day} todayISO={todayISO} now={now} />
}

function DayView({ day, todayISO, now }: { day: string; todayISO: string; now: Date }) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { data: tasks = [], isLoading, error } = useTasks()
  const { areasById } = useAreas()
  const isToday = day === todayISO

  const goTo = (iso: string) => navigate(iso === todayISO ? '/dia' : `/dia/${iso}`)

  const { dayTasks, overdue, events } = useMemo(() => {
    const completedOn = (task: Task) => task.completed_at !== null && toISODate(new Date(task.completed_at)) === day
    const onDay = tasks.filter((task) => task.due_date === day || (task.status === 'done' && completedOn(task)))

    const byTimeThenPriority = (a: Task, b: Task) =>
      Number(a.status === 'done') - Number(b.status === 'done') ||
      (a.due_time ?? '99').localeCompare(b.due_time ?? '99') ||
      b.priority - a.priority

    return {
      dayTasks: onDay.filter((task) => task.kind !== 'meeting').sort(byTimeThenPriority),
      overdue: isToday
        ? tasks
            .filter(
              (task) =>
                task.status === 'open' && task.kind !== 'meeting' && task.due_date !== null && task.due_date < day,
            )
            .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
        : [],
      events: onDay.filter((task) => task.due_time !== null && task.due_date === day),
    }
  }, [tasks, day, isToday])

  const name = settings.display_name
  const selectedDate = fromISODate(day)

  return (
    <div className="mx-auto max-w-[1300px] space-y-5">
      <header className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="shrink-0">
          <p className="font-display text-xl font-bold tracking-tight">
            {isToday ? `${greeting(now)}${name ? `, ${name}` : ''}` : capitalize(longDate.format(selectedDate))}
          </p>
          <p className="text-sm text-ink-soft">
            {isToday ? `Hoje é ${longDate.format(selectedDate)}` : relativeLabel(day, todayISO)}
          </p>
        </div>
        <DateStrip day={day} todayISO={todayISO} onSelect={goTo} />
      </header>

      {error && <p className="text-sm font-semibold text-alert">Não deu pra carregar: {error.message}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Notas">
          <DayNotesEditor day={day} />
        </Card>

        <Card title="Tarefas">
          <DayTaskInput day={day} />
          {isLoading ? (
            <p className="mt-4 text-sm text-ink-faint">Carregando…</p>
          ) : (
            <>
              {dayTasks.length === 0 && overdue.length === 0 && (
                <p className="mt-4 rounded-xl bg-paper p-3 text-sm text-ink-soft">
                  Nenhuma tarefa {isToday ? 'pra hoje' : 'neste dia'}. Use o campo acima para adicionar.
                </p>
              )}
              <TaskList tasks={dayTasks} areasById={areasById} />
              {overdue.length > 0 && (
                <div className="mt-4">
                  <p className="eyebrow mb-1 text-alert">Atrasadas</p>
                  <TaskList tasks={overdue} areasById={areasById} showDate />
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="Agenda">
          <DayAgenda
            day={day}
            events={events}
            areasById={areasById}
            workdayStart={timeToMinutes(settings.workday_start)}
            workdayEnd={timeToMinutes(settings.workday_end)}
            lunch={
              settings.lunch_start && settings.lunch_end
                ? [timeToMinutes(settings.lunch_start), timeToMinutes(settings.lunch_end)]
                : null
            }
            nowMinute={isToday ? now.getHours() * 60 + now.getMinutes() : null}
          />
        </Card>
      </div>
    </div>
  )
}

function TaskList({
  tasks,
  areasById,
  showDate = false,
}: {
  tasks: Task[]
  areasById: Map<string, Area>
  showDate?: boolean
}) {
  if (tasks.length === 0) return null
  return (
    <ul className="mt-2 divide-y divide-line">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskRow task={task} area={task.area_id ? areasById.get(task.area_id) : undefined} showDate={showDate} />
        </li>
      ))}
    </ul>
  )
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function relativeLabel(day: string, todayISO: string): string {
  const diff = Math.round((fromISODate(day).getTime() - fromISODate(todayISO).getTime()) / 86_400_000)
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  return diff > 0 ? `Daqui a ${diff} dias` : `Há ${-diff} dias`
}

// ─── Faixa de datas ───────────────────────────────────────────────────────

const STRIP_RADIUS = 10
const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const monthShort = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

function DateStrip({ day, todayISO, onSelect }: { day: string; todayISO: string; onSelect: (iso: string) => void }) {
  const selectedRef = useRef<HTMLButtonElement>(null)
  const center = fromISODate(day)
  const days = Array.from({ length: STRIP_RADIUS * 2 + 1 }, (_, index) => addDays(center, index - STRIP_RADIUS))

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [day])

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <button
        type="button"
        className="button-quiet p-2"
        aria-label="Semana anterior"
        onClick={() => onSelect(toISODate(addDays(center, -7)))}
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div className="flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)]">
        {days.map((date) => {
          const iso = toISODate(date)
          const isSelected = iso === day
          const isToday = iso === todayISO
          return (
            <button
              key={iso}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(iso)}
              aria-current={isSelected ? 'date' : undefined}
              aria-label={longDate.format(date)}
              className={`relative flex w-14 shrink-0 snap-center flex-col items-center rounded-xl py-1.5 transition-colors ${
                isSelected ? 'bg-lilac-ink text-white' : 'text-ink-soft hover:bg-black/5 hover:text-ink'
              }`}
            >
              <span className="text-[11px] font-semibold uppercase opacity-75">
                {weekdayShort.format(date).replace('.', '')}
              </span>
              <span className="font-display text-lg leading-tight font-bold">{date.getDate()}</span>
              <span className="text-[10px] opacity-60">{monthShort.format(date).replace('.', '')}</span>
              {isToday && !isSelected && <span className="absolute bottom-0.5 size-1 rounded-full bg-lilac-deep" />}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="button-quiet p-2"
        aria-label="Próxima semana"
        onClick={() => onSelect(toISODate(addDays(center, 7)))}
      >
        <span aria-hidden="true">›</span>
      </button>

      {day !== todayISO && (
        <button
          type="button"
          className="button-quiet border border-line px-3 py-1.5"
          onClick={() => onSelect(todayISO)}
        >
          Hoje
        </button>
      )}

      <label className="button-quiet relative cursor-pointer p-2" title="Escolher data">
        <Icon name="calendar" />
        <span className="sr-only">Escolher data</span>
        <input
          type="date"
          value={day}
          onChange={(event) => event.target.value && onSelect(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

// ─── Nova tarefa no dia ───────────────────────────────────────────────────

function DayTaskInput({ day }: { day: string }) {
  const { areas } = useAreas()
  const createTask = useCreateTask()
  const [text, setText] = useState('')

  // datas relativas ("amanhã") contam a partir do dia aberto, não de hoje
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, areas, fromISODate(day)) : null), [text, areas, day])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!parsed?.title) return
    createTask.mutate({
      kind: parsed.kind,
      title: parsed.title,
      area_id: parsed.areaId,
      priority: parsed.priority ?? 2,
      due_date: parsed.dueDate ?? day,
      due_time: parsed.dueTime,
      duration_minutes: parsed.durationMinutes ?? (parsed.kind === 'meeting' ? DEFAULT_MEETING_MINUTES : null),
      recurrence: parsed.recurrence,
    })
    setText('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 focus-within:border-lilac">
        <Icon name="plus" size={16} className="text-ink-faint" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nova tarefa (ex.: revisar PR 15h #trab)"
          aria-label="Nova tarefa neste dia"
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-faint"
        />
      </div>
      {parsed && parsed.tokens.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 px-1">
          {parsed.tokens.map((token) => (
            <span key={token.kind + token.label} className="chip bg-mint text-lilac-deep">
              {token.label}
            </span>
          ))}
        </div>
      )}
    </form>
  )
}

// ─── Agenda vertical ──────────────────────────────────────────────────────

const HOUR_HEIGHT = 56

interface DayAgendaProps {
  day: string
  events: Task[]
  areasById: Map<string, Area>
  workdayStart: number
  workdayEnd: number
  lunch: [number, number] | null
  nowMinute: number | null
}

function DayAgenda({ day, events, areasById, workdayStart, workdayEnd, lunch, nowMinute }: DayAgendaProps) {
  const { openTask, openNewTask } = useTaskEditor()
  const placed = useMemo(() => placeEvents(events), [events])

  const earliest = Math.min(workdayStart - 60, ...placed.map((item) => item.start), nowMinute ?? Infinity)
  const latest = Math.max(workdayEnd + 60, ...placed.map((item) => item.end), nowMinute !== null ? nowMinute + 30 : 0)
  const rangeStart = Math.max(0, Math.floor(earliest / 60) * 60)
  const rangeEnd = Math.min(24 * 60, Math.ceil(latest / 60) * 60)
  const hours = Array.from({ length: (rangeEnd - rangeStart) / 60 + 1 }, (_, index) => rangeStart + index * 60)
  const toY = (minute: number) => ((minute - rangeStart) / 60) * HOUR_HEIGHT

  const dayOfWeek = fromISODate(day).getDay()
  const isWorkday = dayOfWeek !== 0 && dayOfWeek !== 6

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-soft">
          {events.length === 0 ? 'Nada com horário' : `${events.length} com horário`}
        </p>
        <button
          type="button"
          className="button-quiet -my-1 -mr-2 py-1"
          onClick={() => openNewTask({ kind: 'meeting', due_date: day })}
        >
          <Icon name="plus" size={16} /> Reunião
        </button>
      </div>

      <div className="relative" style={{ height: toY(rangeEnd) + 8 }}>
        {isWorkday && (
          <div
            className="absolute right-0 left-12 rounded-lg bg-lilac/25"
            style={{ top: toY(workdayStart), height: toY(workdayEnd) - toY(workdayStart) }}
            title="Expediente"
          />
        )}
        {isWorkday && lunch && (
          <div
            className="absolute right-0 left-12 bg-[repeating-linear-gradient(135deg,rgba(43,33,82,.08)_0_4px,transparent_4px_9px)]"
            style={{ top: toY(lunch[0]), height: toY(lunch[1]) - toY(lunch[0]) }}
            title="Almoço"
          />
        )}

        {hours.map((minute) => (
          <div key={minute} className="absolute right-0 left-0 flex items-start" style={{ top: toY(minute) }}>
            <span className="w-11 -translate-y-1/2 pr-2 text-right text-[11px] font-medium text-ink-faint">
              {minutesToClock(minute)}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 left-12">
          {placed.map(({ task, start, end, lane, lanes }) => {
            const area = task.area_id ? areasById.get(task.area_id) : undefined
            const isMeeting = task.kind === 'meeting'
            const isDone = task.status === 'done'
            const height = Math.max(22, toY(end) - toY(start) - 2)
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => openTask(task)}
                title={`${task.title}, ${minutesToClock(start)}–${minutesToClock(end)}`}
                className={`absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-xs transition-[filter] hover:brightness-95 ${
                  isMeeting ? 'bg-peach text-peach-ink' : 'bg-mint text-ink'
                } ${isDone ? 'opacity-55' : ''}`}
                style={{
                  top: toY(start) + 1,
                  height,
                  left: `calc(${(lane / lanes) * 100}% + 2px)`,
                  width: `calc(${100 / lanes}% - 4px)`,
                  borderLeftColor: area?.color ?? 'var(--color-lilac-deep)',
                }}
              >
                <span className={`block truncate font-semibold ${isDone ? 'line-through' : ''}`}>{task.title}</span>
                {height > 34 && (
                  <span className="block truncate opacity-75">
                    {minutesToClock(start)}–{minutesToClock(end)}
                  </span>
                )}
              </button>
            )
          })}

          {nowMinute !== null && nowMinute >= rangeStart && nowMinute <= rangeEnd && (
            <div className="pointer-events-none absolute right-0 left-0 h-0.5 bg-alert" style={{ top: toY(nowMinute) }}>
              <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-alert" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
