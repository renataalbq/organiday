import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../components/Card'
import { DayNotesEditor } from '../components/DayNotesEditor'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { QuickAdd } from '../components/QuickAdd'
import { TaskRow } from '../components/TaskRow'
import { useTaskEditor } from '../components/TaskEditor'
import { useAreas } from '../data/areas'
import { useSettings } from '../data/settings'
import { useTasks } from '../data/tasks'
import { useNow } from '../hooks/useNow'
import { minutesToClock, timeToMinutes } from '../lib/dayBudget/dayBudget'
import { addDays, formatTime, fromISODate, toISODate } from '../lib/dates'
import { placeEvents } from '../lib/dayAgenda/placeEvents'
import type { Area, Task } from '../types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DOTS = 3

const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const longDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function DayPage() {
  const { date } = useParams()
  const { now, todayISO } = useNow()

  if (date !== undefined && (!ISO_DATE.test(date) || Number.isNaN(fromISODate(date).getTime()))) {
    return <Navigate to="/semana" replace />
  }
  return <WeekView day={date ?? todayISO} todayISO={todayISO} now={now} />
}

function WeekView({ day, todayISO, now }: { day: string; todayISO: string; now: Date }) {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { data: tasks = [], isLoading, error } = useTasks()
  const { areasById } = useAreas()
  const isToday = day === todayISO
  const selectedDate = fromISODate(day)

  const goTo = (iso: string) => navigate(iso === todayISO ? '/semana' : `/semana/${iso}`)

  const { openTasks, doneTasks, overdue, events } = useMemo(() => {
    const completedOn = (task: Task) => task.completed_at !== null && toISODate(new Date(task.completed_at)) === day
    const onDay = tasks.filter(
      (task) =>
        (task.due_date === day && task.status === 'open') ||
        (task.status === 'done' && (completedOn(task) || task.due_date === day)),
    )
    const byTime = (a: Task, b: Task) =>
      (a.due_time ?? '99').localeCompare(b.due_time ?? '99') || b.priority - a.priority
    const notMeeting = onDay.filter((task) => task.kind !== 'meeting')

    return {
      openTasks: notMeeting.filter((task) => task.status === 'open').sort(byTime),
      doneTasks: notMeeting.filter((task) => task.status === 'done').sort(byTime),
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

  const areaOf = (task: Task) => (task.area_id ? areasById.get(task.area_id) : undefined)

  return (
    <div>
      <PageHeader
        eyebrow={capitalize(monthYear.format(selectedDate).replace(' de ', ' '))}
        title={`${capitalize(weekdayLong.format(selectedDate).replace('-feira', ''))}, ${selectedDate.getDate()}`}
        aside={<QuickAdd day={day} placeholder="revisar PR 15h #trab" />}
      />

      <WeekStrip day={day} todayISO={todayISO} tasks={tasks} areasById={areasById} onSelect={goTo} />

      {error && <p className="mt-4 text-sm font-medium text-alert">Não deu pra carregar: {error.message}</p>}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card
          title="Tarefas do dia"
          action={
            <span className="text-xs text-ink-soft">
              {openTasks.length} {openTasks.length === 1 ? 'aberta' : 'abertas'} · {doneTasks.length}{' '}
              {doneTasks.length === 1 ? 'feita' : 'feitas'}
            </span>
          }
        >
          {isLoading ? (
            <p className="text-sm text-ink-faint">Carregando…</p>
          ) : (
            <>
              {openTasks.length === 0 && overdue.length === 0 && (
                <p className="border-t border-line pt-4 text-sm text-ink-soft">
                  Nada aberto {isToday ? 'pra hoje' : 'neste dia'}. Use o campo lá em cima.
                </p>
              )}
              {openTasks.length > 0 && (
                <div className="divide-y divide-line border-t border-line">
                  {openTasks.map((task) => (
                    <TaskRow key={task.id} task={task} area={areaOf(task)} showDate={false} />
                  ))}
                </div>
              )}
              {overdue.length > 0 && (
                <div className="mt-4">
                  <p className="eyebrow mb-1 text-alert">Atrasadas</p>
                  <div className="divide-y divide-line">
                    {overdue.map((task) => (
                      <TaskRow key={task.id} task={task} area={areaOf(task)} />
                    ))}
                  </div>
                </div>
              )}
              {doneTasks.length > 0 && <DoneList tasks={doneTasks} areaOf={areaOf} />}
            </>
          )}
        </Card>

        <AgendaCard
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

        <Card title="Notas do dia">
          <DayNotesEditor day={day} />
        </Card>
      </div>
    </div>
  )
}

function DoneList({ tasks, areaOf }: { tasks: Task[]; areaOf: (task: Task) => Area | undefined }) {
  const { openTask } = useTaskEditor()
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="eyebrow mb-2">Feitas</p>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => openTask(task)}
              className="flex w-full items-baseline gap-3 py-2 text-left text-sm text-ink-soft"
            >
              <span className="min-w-0 flex-1 truncate line-through">{task.title}</span>
              <span className="shrink-0 text-xs">
                {task.due_time ? formatTime(task.due_time) : (areaOf(task)?.name ?? '')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Faixa da semana ──────────────────────────────────────────────────────

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

function WeekStrip({
  day,
  todayISO,
  tasks,
  areasById,
  onSelect,
}: {
  day: string
  todayISO: string
  tasks: Task[]
  areasById: Map<string, Area>
  onSelect: (iso: string) => void
}) {
  const selected = fromISODate(day)
  const monday = mondayOf(selected)
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index))

  const dotsByDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const task of tasks) {
      if (!task.due_date || task.kind === 'decision') continue
      const colors = map.get(task.due_date) ?? []
      colors.push((task.area_id && areasById.get(task.area_id)?.color) || 'var(--color-accent)')
      map.set(task.due_date, colors)
    }
    return map
  }, [tasks, areasById])

  return (
    <section className="card flex items-center gap-1 p-2 sm:gap-2 sm:p-3">
      <button
        type="button"
        className="button-quiet shrink-0 p-2"
        aria-label="Semana anterior"
        onClick={() => onSelect(toISODate(addDays(selected, -7)))}
      >
        <Icon name="chevronLeft" size={18} />
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
        {days.map((date) => {
          const iso = toISODate(date)
          const isSelected = iso === day
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const dots = (dotsByDay.get(iso) ?? []).slice(0, MAX_DOTS)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              aria-current={isSelected ? 'date' : undefined}
              aria-label={longDate.format(date)}
              className={`flex flex-col items-center rounded-xl py-2 transition-colors sm:py-2.5 ${
                isSelected ? 'bg-panel text-white' : 'hover:bg-hover'
              }`}
            >
              <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-ink-soft'}`}>
                {weekdayShort.format(date).replace('.', '')}
              </span>
              <span
                className={`font-display text-lg leading-tight font-bold sm:text-xl ${
                  !isSelected && isWeekend ? 'text-ink-soft' : ''
                } ${!isSelected && iso === todayISO ? 'text-accent' : ''}`}
              >
                {date.getDate()}
              </span>
              <span className="mt-1 flex h-1.5 gap-[3px]">
                {dots.map((color, index) => (
                  <span
                    key={index}
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? 'rgba(255,255,255,.85)' : color }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="button-quiet shrink-0 p-2"
        aria-label="Próxima semana"
        onClick={() => onSelect(toISODate(addDays(selected, 7)))}
      >
        <Icon name="chevronRight" size={18} />
      </button>

      <button
        type="button"
        className="button-outline hidden shrink-0 px-3.5 py-2 sm:inline-flex"
        onClick={() => onSelect(todayISO)}
        disabled={day === todayISO}
      >
        Hoje
      </button>
      <label className="button-quiet relative hidden shrink-0 cursor-pointer p-2 sm:inline-flex" title="Escolher data">
        <Icon name="calendar" />
        <span className="sr-only">Escolher data</span>
        <input
          type="date"
          value={day}
          onChange={(event) => event.target.value && onSelect(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </section>
  )
}

// ─── Agenda vertical ──────────────────────────────────────────────────────

const HOUR_HEIGHT = 56

interface AgendaCardProps {
  day: string
  events: Task[]
  areasById: Map<string, Area>
  workdayStart: number
  workdayEnd: number
  lunch: [number, number] | null
  nowMinute: number | null
}

function AgendaCard({ day, events, areasById, workdayStart, workdayEnd, lunch, nowMinute }: AgendaCardProps) {
  const { openTask, openNewTask } = useTaskEditor()
  const placed = useMemo(() => placeEvents(events), [events])

  const earliest = Math.min(workdayStart, ...placed.map((item) => item.start), nowMinute ?? Infinity)
  const latest = Math.max(workdayEnd, ...placed.map((item) => item.end), nowMinute !== null ? nowMinute + 30 : 0)
  const rangeStart = Math.max(0, Math.floor(earliest / 60) * 60)
  const rangeEnd = Math.min(24 * 60, Math.ceil(latest / 60) * 60)
  const hours = Array.from({ length: (rangeEnd - rangeStart) / 60 + 1 }, (_, index) => rangeStart + index * 60)
  const toY = (minute: number) => ((minute - rangeStart) / 60) * HOUR_HEIGHT

  const dayOfWeek = fromISODate(day).getDay()
  const isWorkday = dayOfWeek !== 0 && dayOfWeek !== 6

  return (
    <Card
      title="Agenda"
      action={
        <button
          type="button"
          className="text-[13px] font-medium text-accent hover:text-accent-ink"
          onClick={() => openNewTask({ kind: 'meeting', due_date: day })}
        >
          + Reunião
        </button>
      }
    >
      <div className="relative border-t border-line pt-3" style={{ height: toY(rangeEnd) + 20 }}>
        {hours.map((minute) => (
          <span
            key={minute}
            className="absolute left-0 w-10 -translate-y-1/2 text-[11px] text-ink-soft"
            style={{ top: toY(minute) + 12 }}
          >
            {minutesToClock(minute)}
          </span>
        ))}

        <div className="absolute top-3 right-0 bottom-2 left-12">
          {isWorkday && (
            <div
              className="absolute inset-x-0 rounded-md bg-muted/70"
              style={{ top: toY(workdayStart), height: toY(workdayEnd) - toY(workdayStart) }}
              title="Expediente"
            />
          )}
          {isWorkday && lunch && (
            <div
              className="absolute inset-x-0 bg-busy px-2 pt-1 text-xs text-ink-soft"
              style={{ top: toY(lunch[0]), height: toY(lunch[1]) - toY(lunch[0]) }}
            >
              almoço
            </div>
          )}

          {placed.map(({ task, start, end, lane, lanes }) => {
            const area = task.area_id ? areasById.get(task.area_id) : undefined
            const isDone = task.status === 'done'
            const height = Math.max(22, toY(end) - toY(start) - 2)
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => openTask(task)}
                title={`${task.title}, ${minutesToClock(start)}–${minutesToClock(end)}`}
                className={`absolute overflow-hidden rounded-md px-2 py-1 text-left text-xs font-medium transition-[filter] hover:brightness-95 ${
                  isDone ? 'bg-accent-soft text-accent-ink/70' : 'text-white'
                }`}
                style={{
                  top: toY(start) + 1,
                  height,
                  left: `calc(${(lane / lanes) * 100}% + 2px)`,
                  width: `calc(${100 / lanes}% - 4px)`,
                  backgroundColor: isDone ? undefined : (area?.color ?? 'var(--color-accent)'),
                }}
              >
                <span className={`block truncate ${isDone ? 'line-through' : 'font-semibold'}`}>{task.title}</span>
                {height > 34 && (
                  <span className="block truncate opacity-80">
                    {minutesToClock(start)}–{minutesToClock(end)}
                  </span>
                )}
              </button>
            )
          })}

          {nowMinute !== null && nowMinute >= rangeStart && nowMinute <= rangeEnd && (
            <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-ink" style={{ top: toY(nowMinute) }}>
              <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-ink" />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
