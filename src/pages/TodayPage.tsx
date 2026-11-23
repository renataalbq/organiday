import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { DailySummaryCard } from '../components/DailySummaryCard'
import { DayTimeline } from '../components/DayTimeline'
import { Icon } from '../components/Icon'
import { PinButton } from '../components/PinButton'
import { StudyEditor } from '../components/StudyEditor'
import { StudyRow } from '../components/StudyRow'
import { useTaskEditor } from '../components/TaskEditor'
import { TaskRow } from '../components/TaskRow'
import { useStudies } from '../data/studies'
import { useCompleteTask } from '../data/tasks'
import { useTodayBoard } from '../hooks/useTodayBoard'
import { daysFromToday, formatLongToday, formatRelativeDate, formatTime } from '../lib/dates'
import { formatDuration, meetingInterval, minutesToClock, type DayBudget } from '../lib/dayBudget/dayBudget'
import type { Study, Task } from '../types'

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 5) return 'Boa noite'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function TodayPage() {
  const board = useTodayBoard()
  const { openTask, openNewTask } = useTaskEditor()
  const { weekday, date } = formatLongToday(board.now)
  const name = board.settings.display_name

  if (board.isLoading) return <p className="p-8 text-ink-soft">Carregando seu dia…</p>
  if (board.error) return <p className="p-8 font-semibold text-alert">Não deu pra carregar: {board.error.message}</p>

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-lilac-deep">
            {weekday}, {date}
          </p>
          <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-tight sm:text-[2.5rem]">
            {greeting(board.now)}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {plural(board.dueTodayCount, 'tarefa hoje', 'tarefas hoje')},{' '}
            {plural(board.overdueCount, 'atrasada', 'atrasadas')}
            {board.todayMeetings.length > 0 && `, ${plural(board.todayMeetings.length, 'reunião', 'reuniões')}`}
          </p>
        </div>
        <button type="button" onClick={() => openNewTask({ due_date: board.todayISO })} className="button-primary">
          <Icon name="plus" size={16} /> Nova tarefa
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DayCard
          budget={board.budget}
          now={board.now}
          onMeetingClick={(id) => {
            const meeting = board.todayMeetings.find((task) => task.id === id)
            if (meeting) openTask(meeting)
          }}
        />

        <Card
          title="Agenda"
          className="lg:col-span-4"
          action={
            <button
              type="button"
              className="button-quiet -my-2 -mr-2"
              onClick={() => openNewTask({ kind: 'meeting', due_date: board.todayISO })}
            >
              <Icon name="plus" size={16} /> Reunião
            </button>
          }
        >
          <MeetingList
            meetings={board.todayMeetings}
            done={board.meetingsDoneToday}
            nowMinute={board.now.getHours() * 60 + board.now.getMinutes()}
            onOpen={openTask}
          />
        </Card>

        <Card title="Pra decidir" tone="peach" className="lg:col-span-7">
          {board.decisions.length === 0 ? (
            <p className="text-sm text-peach-ink/80">
              Nada pra decidir. Escreva uma pergunta terminando com "?" e ela aparece aqui.
            </p>
          ) : (
            <ul className="divide-y divide-peach-ink/10">
              {board.decisions.slice(0, 5).map((decision) => (
                <DecisionRow key={decision.id} decision={decision} onOpen={openTask} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Fica de olho" className="bg-paper lg:col-span-5">
          {board.attention.length === 0 ? (
            <p className="rounded-xl bg-mint/60 p-3 text-sm text-ink-soft">
              Nada urgente agora. Prazos e reuniões estão em dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {board.attention.map((item) => {
                const task = item.taskId ? findTask(board, item.taskId) : undefined
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!task}
                      onClick={() => task && openTask(task)}
                      className={`flex w-full items-start gap-2 rounded-xl p-3 text-left text-sm font-medium ${
                        item.tone === 'alert' ? 'bg-alert-soft text-alert' : 'bg-peach/60 text-peach-ink'
                      }`}
                    >
                      <Icon name={item.tone === 'alert' ? 'alert' : 'clock'} size={16} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{item.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <DailySummaryCard summary={board.dailySummary} className="lg:col-span-7" />

        <Card title="Prioridades de hoje" tone="mint" className="lg:col-span-5">
          {board.focus.length === 0 ? (
            <p className="text-sm text-ink-soft">Sem tarefas abertas. Adicione uma no campo lá em cima.</p>
          ) : (
            <div className="divide-y divide-ink/10">
              {board.focus.map(({ task, reasons, isPinned }) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  area={task.area_id ? board.areasById.get(task.area_id) : undefined}
                  reasons={isPinned ? undefined : reasons}
                  isPinned={isPinned}
                  trailing={isPinned ? <PinButton task={task} /> : undefined}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            Escolhidas por prazo, prioridade e área. Use o alfinete para fixar outra.
          </p>
        </Card>

        <StudiesCard />

        {(board.alsoToday.length > 0 || board.upcoming.length > 0) && (
          <Card title="No radar" className="lg:col-span-5">
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2 lg:grid-cols-1">
              <div>
                <h3 className="eyebrow mb-1">Hoje e atrasadas</h3>
                {board.alsoToday.length === 0 ? (
                  <p className="py-2 text-sm text-ink-faint">Só o que já está nas prioridades.</p>
                ) : (
                  board.alsoToday.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      area={task.area_id ? board.areasById.get(task.area_id) : undefined}
                      trailing={<PinButton task={task} />}
                    />
                  ))
                )}
              </div>
              <div>
                <h3 className="eyebrow mb-1">Próximos 7 dias</h3>
                {board.upcoming.length === 0 ? (
                  <p className="py-2 text-sm text-ink-faint">Semana livre por enquanto.</p>
                ) : (
                  board.upcoming.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      area={task.area_id ? board.areasById.get(task.area_id) : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function findTask(board: ReturnType<typeof useTodayBoard>, taskId: string): Task | undefined {
  return [
    ...board.todayMeetings,
    ...board.decisions,
    ...board.focus.map((item) => item.task),
    ...board.alsoToday,
    ...board.workTasksForToday,
  ].find((task) => task.id === taskId)
}

function DayCard({
  budget,
  now,
  onMeetingClick,
}: {
  budget: DayBudget
  now: Date
  onMeetingClick: (taskId: string) => void
}) {
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  const hasEnded = nowMinute >= budget.workdayEnd
  const fits = budget.plannedMinutes <= budget.freeFromNowMinutes
  const slack = budget.freeFromNowMinutes - budget.plannedMinutes

  return (
    <Card title="Seu expediente" tone="lilac" className="lg:col-span-8">
      {budget.isWorkday ? (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <p className="font-display text-5xl leading-none font-extrabold tracking-tight">
                {formatDuration(hasEnded ? 0 : budget.freeFromNowMinutes)}
              </p>
              <p className="mt-1.5 text-sm text-lilac-ink/85">
                {hasEnded
                  ? 'Expediente encerrado por hoje.'
                  : `livres até as ${minutesToClock(budget.workdayEnd)}, fora reuniões e almoço`}
              </p>
            </div>
            <dl className="flex gap-5 text-sm">
              <div>
                <dt className="text-lilac-ink/70">Expediente</dt>
                <dd className="font-display text-lg font-bold">{formatDuration(budget.workMinutes)}</dd>
              </div>
              <div>
                <dt className="text-lilac-ink/70">Em reuniões</dt>
                <dd className="font-display text-lg font-bold">{formatDuration(budget.meetingMinutes)}</dd>
              </div>
              <div>
                <dt className="text-lilac-ink/70">Tarefas</dt>
                <dd className="font-display text-lg font-bold">{formatDuration(budget.plannedMinutes)}</dd>
              </div>
            </dl>
          </div>

          <DayTimeline budget={budget} nowMinute={nowMinute} onMeetingClick={onMeetingClick} />

          {!hasEnded && budget.plannedMinutes > 0 && (
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${fits ? 'bg-white/55' : 'bg-peach text-peach-ink'}`}
            >
              {fits
                ? `Suas tarefas de trabalho cabem no dia, com ${formatDuration(slack)} de folga.`
                : `Não cabe tudo: faltam ${formatDuration(-slack)}. Vale empurrar algo pra amanhã.`}
              {budget.unestimatedCount > 0 &&
                ` (${plural(budget.unestimatedCount, 'tarefa sem estimativa contou', 'tarefas sem estimativa contaram')} 30min.)`}
            </p>
          )}
        </>
      ) : (
        <div>
          <p className="font-display text-4xl leading-none font-extrabold tracking-tight">Fim de semana</p>
          <p className="mt-2 text-sm text-lilac-ink/85">
            Sem expediente hoje. As prioridades puxam mais as coisas de casa e pessoais.
          </p>
          {budget.segments.length > 0 && (
            <div className="mt-4">
              <DayTimeline budget={budget} nowMinute={nowMinute} onMeetingClick={onMeetingClick} />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function MeetingList({
  meetings,
  done,
  nowMinute,
  onOpen,
}: {
  meetings: Task[]
  done: Task[]
  nowMinute: number
  onOpen: (task: Task) => void
}) {
  const all = [...meetings, ...done].sort((a, b) => a.due_time!.localeCompare(b.due_time!))
  if (all.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Nenhuma reunião hoje. Para adicionar, escreva algo como "daily 9h30 ~15m".
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {all.map((meeting) => {
        const [start, end] = meetingInterval(meeting)
        const isPast = meeting.status === 'done' || end <= nowMinute
        const isNow = !isPast && start <= nowMinute
        return (
          <li key={meeting.id}>
            <button
              type="button"
              onClick={() => onOpen(meeting)}
              className={`flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-black/5 ${isPast ? 'text-ink-faint' : ''}`}
            >
              <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                {formatTime(meeting.due_time!)}–{minutesToClock(end)}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${isPast ? 'line-through' : 'font-medium'}`}>
                {meeting.title}
              </span>
              {isNow && <span className="chip bg-peach text-peach-ink">agora</span>}
            </button>
          </li>
        )
      })}
    </ul>
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
    <li className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => onOpen(decision)}
        className="min-w-0 flex-1 text-left text-[15px] leading-snug font-medium text-peach-ink [overflow-wrap:anywhere]"
      >
        {decision.title}
      </button>
      <span
        className={`chip ${days !== null && days <= 0 ? 'bg-alert-soft text-alert' : 'bg-peach-deep/70 text-peach-ink'}`}
      >
        {deadlineLabel}
      </span>
      <button
        type="button"
        onClick={() => completeTask.mutate(decision.id)}
        className="chip bg-card text-peach-ink hover:bg-white"
        aria-label={`Marcar "${decision.title}" como decidida`}
      >
        <Icon name="check" size={12} /> decidi
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
      title="Aprendendo"
      className="lg:col-span-7"
      action={
        <Link to="/estudos" className="button-quiet -my-2 -mr-2">
          Ver todos
        </Link>
      }
    >
      {active.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-xl border border-dashed border-line p-4 text-left text-sm text-ink-soft hover:border-lilac"
        >
          Nenhum estudo em andamento. Cadastre um curso, livro ou certificação para acompanhar o progresso.
        </button>
      ) : (
        <div className="divide-y divide-line">
          {active.slice(0, 3).map((study) => (
            <StudyRow key={study.id} study={study} onOpen={setEditing} />
          ))}
        </div>
      )}
      {editing && <StudyEditor study={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}
