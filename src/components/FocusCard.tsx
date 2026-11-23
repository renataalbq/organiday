import { useCompleteTask, useUpdateTask } from '../data/tasks'
import { useFocusTimer } from '../hooks/useFocusTimer'
import { DEFAULT_TASK_MINUTES, formatDuration } from '../lib/dayBudget/dayBudget'
import { addDays, toISODate } from '../lib/dates'
import {
  extendTimer,
  formatClock,
  pauseTimer,
  remainingSeconds,
  resumeTimer,
  startTimer,
} from '../lib/focus/focusTimer'
import type { NextTask } from '../lib/focus/pickNextTask'
import type { Area } from '../types'
import { Icon } from './Icon'

interface FocusCardProps {
  next: NextTask | null
  area?: Area
  focusTimer: ReturnType<typeof useFocusTimer>
  onOpenTask: () => void
  onNewTask: () => void
}

/** Card escuro com o que fazer agora. "Começar agora" vira um cronômetro com o tempo da tarefa. */
export function FocusCard({ next, area, focusTimer, onOpenTask, onNewTask }: FocusCardProps) {
  const updateTask = useUpdateTask()
  const completeTask = useCompleteTask()
  const { timer, now, setTimer } = focusTimer

  if (!next) {
    return (
      <section className="rounded-[var(--radius-card)] bg-panel p-6 text-white sm:p-7">
        <p className="text-xs font-semibold tracking-[0.12em] text-white/60 uppercase">Tudo em dia</p>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em]">Nada pendente pra hoje</h2>
        <p className="mt-2 text-sm text-white/65">Aproveite, ou adiante algo dos próximos dias.</p>
        <button type="button" onClick={onNewTask} className="mt-6 button-outline border-white/20 bg-white text-neutral-900">
          <Icon name="plus" size={16} /> Nova tarefa
        </button>
      </section>
    )
  }

  const { task } = next
  const minutes = task.duration_minutes ?? DEFAULT_TASK_MINUTES
  const isRunning = timer?.taskId === task.id

  const start = () => {
    setTimer(startTimer(task.id, minutes, Date.now()))
    if (!task.started_at) updateTask.mutate({ id: task.id, changes: { started_at: new Date().toISOString() } })
  }

  const finish = () => {
    setTimer(null)
    completeTask.mutate(task.id)
  }

  const postpone = () => {
    const tomorrow = toISODate(addDays(new Date(), 1))
    updateTask.mutate({
      id: task.id,
      changes: { due_date: tomorrow, focus_date: null, ...(task.started_at ? { started_at: null } : {}) },
    })
  }

  if (isRunning) {
    const left = remainingSeconds(timer, now)
    const isPaused = timer.pausedAt !== null
    const isOver = left === 0
    const progress = 1 - left / timer.durationSeconds

    return (
      <section className="rounded-[var(--radius-card)] bg-panel p-6 text-white sm:p-7" aria-live="polite">
        <p className="text-xs font-semibold tracking-[0.12em] text-white/60 uppercase">
          {isOver ? 'Tempo!' : isPaused ? 'Pausado' : 'Em foco'}
          {area && ` · ${area.name}`}
        </p>
        <button type="button" onClick={onOpenTask} className="mt-3 block text-left">
          <h2 className="font-display text-2xl leading-tight font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">
            {task.title}
          </h2>
        </button>

        <p
          className={`mt-5 font-display text-[3.25rem] leading-none font-bold tracking-[-0.03em] tabular-nums ${isOver ? 'text-[#ffb4a8] [animation:timer-pulse_1.4s_ease-in-out_infinite]' : ''}`}
          role="timer"
          aria-label={`Faltam ${formatClock(left)}`}
        >
          {formatClock(left)}
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-1000"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-white/55">de {formatDuration(Math.round(timer.durationSeconds / 60))}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={finish} className="button-outline border-white bg-white text-neutral-900">
            <Icon name="check" size={16} /> Concluir
          </button>
          {isOver ? (
            <button
              type="button"
              onClick={() => setTimer(extendTimer(timer, 5, Date.now()))}
              className="button-outline border-white/25 bg-transparent text-white hover:border-white/50"
            >
              +5 min
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setTimer(isPaused ? resumeTimer(timer, Date.now()) : pauseTimer(timer, Date.now()))}
              className="button-outline border-white/25 bg-transparent text-white hover:border-white/50"
            >
              <Icon name={isPaused ? 'play' : 'pause'} size={15} /> {isPaused ? 'Retomar' : 'Pausar'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTimer(null)}
            className="button-quiet text-white/65 hover:bg-white/10 hover:text-white"
          >
            Parar
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-[var(--radius-card)] bg-panel p-6 text-white sm:p-7">
      <p className="text-xs font-semibold tracking-[0.12em] text-[#c9c2ff] uppercase">{next.label}</p>
      <button type="button" onClick={onOpenTask} className="mt-3 block text-left">
        <h2 className="font-display text-[1.65rem] leading-tight font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">
          {task.title}
        </h2>
      </button>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/75">
        <span>~{formatDuration(minutes)}</span>
        {area && <span>{area.name}</span>}
        {next.startsInMinutes !== null && <span>daqui a {formatDuration(next.startsInMinutes)}</span>}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={start} className="button-outline border-white bg-white px-5 text-neutral-900">
          {task.started_at ? 'Continuar' : 'Começar agora'}
        </button>
        <button
          type="button"
          onClick={postpone}
          className="button-outline border-white/25 bg-transparent px-5 text-white hover:border-white/50"
          title="Passa pra amanhã"
        >
          Adiar
        </button>
      </div>
    </section>
  )
}
