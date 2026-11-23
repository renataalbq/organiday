import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { DailySummaryCard } from '../components/DailySummaryCard'
import { DayTimeline } from '../components/DayTimeline'
import { FocusCard } from '../components/FocusCard'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { QuickAdd } from '../components/QuickAdd'
import { StudyEditor } from '../components/StudyEditor'
import { StudyRow } from '../components/StudyRow'
import { useTaskEditor } from '../components/TaskEditor'
import { TaskRow } from '../components/TaskRow'
import { useStudies } from '../data/studies'
import { useCompleteTask } from '../data/tasks'
import { useFocusTimer } from '../hooks/useFocusTimer'
import { useTodayBoard } from '../hooks/useTodayBoard'
import { daysFromToday, formatRelativeDate, formatTime, fromISODate } from '../lib/dates'
import { formatDuration, minutesToClock } from '../lib/dayBudget/dayBudget'
import type { Study, Task } from '../types'

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return 'Boa noite'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

const headerDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function TodayPage() {
  const focusTimer = useFocusTimer()
  const board = useTodayBoard(focusTimer.timer?.taskId ?? null)
  const { openTask, openNewTask } = useTaskEditor()
  const [showDoneToday, setShowDoneToday] = useState(false)
  const name = board.settings.display_name

  if (board.isLoading) return <p className="p-8 text-ink-soft">Carregando seu dia…</p>
  if (board.error) return <p className="p-8 font-semibold text-alert">Não deu pra carregar: {board.error.message}</p>

  const nowMinute = board.now.getHours() * 60 + board.now.getMinutes()
  const areaOf = (task: Task) => (task.area_id ? board.areasById.get(task.area_id) : undefined)
  const doneCount = board.doneToday.length

  return (
    <div>
      <PageHeader
        eyebrow={capitalize(headerDate.format(board.now).replace('-feira', ''))}
        title={`${greeting(board.now)}${name ? `, ${name}` : ''}`}
        aside={<QuickAdd placeholder="daily dias úteis 9h30 ~15m #trab" />}
      >
        <DayStats
          budget={board.budget}
          nowMinute={nowMinute}
          doneCount={doneCount}
          totalCount={doneCount + board.openTodayCount}
        />
      </PageHeader>

      {/* no celular a régua fica espremida demais pra ler: some abaixo de 640px */}
      <div className="hidden sm:block">
        <DayTimeline
          budget={board.budget}
          events={board.timelineEvents}
          nextTaskId={board.next?.task.id}
          nowMinute={nowMinute}
          onOpen={openTask}
          onAdd={() => openNewTask({ due_date: board.todayISO })}
        />
      </div>
      <button
        type="button"
        onClick={() => openNewTask({ due_date: board.todayISO })}
        className="button-outline w-full sm:hidden"
      >
        <Icon name="plus" size={16} /> Adicionar nova tarefa
      </button>

      <AttentionStrip board={board} onOpen={openTask} />

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <FocusCard
            next={board.next}
            area={board.next ? areaOf(board.next.task) : undefined}
            focusTimer={focusTimer}
            onOpenTask={() => board.next && openTask(board.next.task)}
            onNewTask={() => openNewTask({ due_date: board.todayISO })}
          />

          <Card
            title="Prioridades"
            action={<span className="text-xs text-ink-soft">por prazo, prioridade e área</span>}
          >
            {board.focus.length === 0 ? (
              <p className="border-t border-line pt-4 text-sm text-ink-soft">
                Só o que está no foco. Use o alfinete na tela Tarefas pra fixar outra.
              </p>
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {board.focus.map(({ task, isPinned }) => (
                  <TaskRow key={task.id} task={task} area={areaOf(task)} isPinned={isPinned} />
                ))}
              </div>
            )}
            {doneCount > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowDoneToday((value) => !value)}
                  className="text-sm text-accent underline underline-offset-2 hover:text-accent-ink"
                >
                  {showDoneToday ? 'Esconder concluídas' : `Ver concluídas hoje (${doneCount})`}
                </button>
                {showDoneToday && (
                  <div className="mt-2 divide-y divide-line">
                    {board.doneToday.map((task) => (
                      <TaskRow key={task.id} task={task} area={areaOf(task)} showDate={false} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <DecisionsCard decisions={board.decisions} onOpen={openTask} />
        </div>

        <div className="space-y-6">
          <DailySummaryCard summary={board.dailySummary} onOpenTask={openTask} />
          <StudiesCard />
          <Card title="Próximos 7 dias">
            {board.upcoming.length === 0 ? (
              <p className="text-sm text-ink-soft">Semana livre por enquanto.</p>
            ) : (
              <ul className="space-y-1">
                {board.upcoming.slice(0, 8).map((task) => (
                  <UpcomingRow key={task.id} task={task} color={areaOf(task)?.color} onOpen={openTask} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function DayStats({
  budget,
  nowMinute,
  doneCount,
  totalCount,
}: {
  budget: ReturnType<typeof useTodayBoard>['budget']
  nowMinute: number
  doneCount: number
  totalCount: number
}) {
  const hasEnded = nowMinute >= budget.workdayEnd
  const free = !budget.isWorkday
    ? { label: 'Expediente', value: 'folga' }
    : hasEnded
      ? { label: 'Expediente', value: 'encerrado' }
      : { label: `Livre até ${minutesToClock(budget.workdayEnd)}`, value: formatDuration(budget.freeFromNowMinutes) }

  const stats = [
    free,
    { label: 'Feitas hoje', value: `${doneCount} de ${totalCount}` },
    { label: 'Reuniões', value: formatDuration(budget.meetingMinutes) },
  ]

  return (
    <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs text-ink-soft">{stat.label}</dt>
          <dd className="mt-1 font-display text-2xl font-bold tracking-[-0.02em]">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Ponto de atenção: reunião chegando, atrasadas, urgentes e dia que não fecha. */
function AttentionStrip({ board, onOpen }: { board: ReturnType<typeof useTodayBoard>; onOpen: (task: Task) => void }) {
  const findTask = (taskId: string) =>
    [...board.todayMeetings, ...board.decisions, ...board.focus.map((item) => item.task), ...board.alsoToday].find(
      (task) => task.id === taskId,
    )

  return (
    <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center" aria-label="Fica de olho">
      <h2 className="shrink-0 text-sm font-semibold">Fica de olho</h2>
      {board.attention.length === 0 ? (
        <p className="text-sm text-ink-soft">Nada urgente agora. Prazos e reuniões em dia.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {board.attention.map((item) => {
            const task = item.taskId ? findTask(item.taskId) : undefined
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!task}
                  onClick={() => task && onOpen(task)}
                  className={`inline-flex max-w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium ${
                    item.tone === 'alert' ? 'bg-alert-soft text-alert' : 'bg-peach text-peach-ink'
                  }`}
                >
                  <Icon name={item.tone === 'alert' ? 'alert' : 'clock'} size={15} className="mt-px" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{item.text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function DecisionsCard({ decisions, onOpen }: { decisions: Task[]; onOpen: (task: Task) => void }) {
  return (
    <Card title="Pra decidir">
      {decisions.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Nada pra decidir. Escreva uma pergunta terminando com "?" e ela aparece aqui.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {decisions.slice(0, 5).map((decision) => (
            <DecisionRow key={decision.id} decision={decision} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function DecisionRow({ decision, onOpen }: { decision: Task; onOpen: (task: Task) => void }) {
  const completeTask = useCompleteTask()
  const days = decision.due_date ? daysFromToday(decision.due_date) : null
  const deadlineLabel =
    days === null
      ? 'sem prazo'
      : days < 0
        ? `atrasada, ${formatRelativeDate(decision.due_date!)}`
        : `até ${formatRelativeDate(decision.due_date!)}`

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => onOpen(decision)}
        className="min-w-0 flex-1 text-left text-[15px] leading-snug [overflow-wrap:anywhere]"
      >
        {decision.title}
        <span className={`mt-0.5 block text-xs ${days !== null && days <= 0 ? 'text-alert' : 'text-ink-soft'}`}>
          {deadlineLabel}
        </span>
      </button>
      <button
        type="button"
        onClick={() => completeTask.mutate(decision.id)}
        className="button-outline px-3 py-1.5 text-[13px]"
        aria-label={`Marcar "${decision.title}" como decidida`}
      >
        <Icon name="check" size={14} /> decidi
      </button>
    </li>
  )
}

function UpcomingRow({ task, color, onOpen }: { task: Task; color?: string; onOpen: (task: Task) => void }) {
  const weekday = weekdayShort.format(fromISODate(task.due_date!)).replace('.', '')
  const meta = [
    task.due_time && formatTime(task.due_time),
    task.duration_minutes && `~${formatDuration(task.duration_minutes)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
      >
        <span className="w-9 shrink-0 text-xs text-ink-soft">{weekday}</span>
        <span
          className="size-[7px] shrink-0 rounded-[2px]"
          style={{ backgroundColor: color ?? 'var(--color-line-strong)' }}
        />
        <span className="min-w-0 flex-1 truncate text-[15px]">{task.title}</span>
        {meta && <span className="shrink-0 text-xs text-ink-soft">{meta}</span>}
      </button>
    </li>
  )
}

function StudiesCard() {
  const { data: studies = [] } = useStudies()
  const [editing, setEditing] = useState<Study | 'new' | null>(null)
  const active = studies.filter((study) => study.status === 'active')

  return (
    <Card
      title="Estudando"
      action={
        <Link to="/estudos" className="text-[13px] text-ink-soft hover:text-ink">
          Ver todos
        </Link>
      }
    >
      {active.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-xl border border-dashed border-line-strong p-4 text-left text-sm text-ink-soft hover:border-ink-faint"
        >
          Nenhum estudo em andamento. Cadastre um curso, livro ou certificação para acompanhar o progresso.
        </button>
      ) : (
        <div className="space-y-4">
          {active.slice(0, 3).map((study) => (
            <StudyRow key={study.id} study={study} onOpen={setEditing} />
          ))}
        </div>
      )}
      {editing && <StudyEditor study={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}
