import { useEffect, useMemo, useRef } from 'react'
import { minutesToClock, type DayBudget } from '../lib/dayBudget/dayBudget'
import { placeEvents } from '../lib/dayAgenda/placeEvents'
import type { Task } from '../types'
import { Icon } from './Icon'

interface DayTimelineProps {
  budget: DayBudget
  /** tarefas e reuniões de hoje com horário */
  events: Task[]
  nextTaskId?: string
  nowMinute: number
  onOpen: (task: Task) => void
  onAdd: () => void
}

const BAR_HEIGHT = 48

/** Régua do dia: almoço, reuniões e tarefas com horário, o "agora" e um + pra adicionar pelo formulário. */
export function DayTimeline({ budget, events, nextTaskId, nowMinute, onOpen, onAdd }: DayTimelineProps) {
  const placed = useMemo(() => placeEvents(events), [events])
  const scrollRef = useRef<HTMLDivElement>(null)

  const rangeStart = Math.floor(Math.min(budget.rangeStart, ...placed.map((item) => item.start)) / 60) * 60
  const rangeEnd = Math.ceil(Math.max(budget.rangeEnd, ...placed.map((item) => item.end)) / 60) * 60
  const span = rangeEnd - rangeStart
  const toPercent = (minute: number) => `${((minute - rangeStart) / span) * 100}%`
  const widthPercent = (start: number, end: number) => `${((end - start) / span) * 100}%`

  const hours: number[] = []
  for (let minute = rangeStart; minute <= rangeEnd; minute += 60) hours.push(minute)
  const lunch = budget.segments.find((segment) => segment.type === 'lunch')
  const showNow = nowMinute >= rangeStart && nowMinute <= rangeEnd
  const nowFraction = (nowMinute - rangeStart) / span

  // quando a régua rola (celular), abre centrada no agora
  useEffect(() => {
    const element = scrollRef.current
    if (!element || element.scrollWidth <= element.clientWidth) return
    element.scrollLeft = Math.max(0, nowFraction * element.scrollWidth - element.clientWidth / 2)
  }, [nowFraction])

  return (
    <section className="card flex items-center gap-3 px-4 pb-4 sm:gap-4 sm:px-6">
      {/* no celular a régua rola de lado pra os blocos continuarem legíveis */}
      <div ref={scrollRef} className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 pt-8 [scrollbar-width:thin]">
        <div className="min-w-[620px] sm:min-w-0">
          <div className="relative rounded-lg bg-muted/70" style={{ height: BAR_HEIGHT }}>
            {lunch && (
              <div
                className="absolute inset-y-1 overflow-hidden rounded-md bg-busy px-1.5 pt-1 text-[11px] text-ink-soft"
                style={{ left: toPercent(lunch.startMinute), width: widthPercent(lunch.startMinute, lunch.endMinute) }}
              >
                almoço
              </div>
            )}

            {placed.map(({ task, start, end, lane, lanes }) => {
              const isDone = task.status === 'done'
              const isNext = task.id === nextTaskId
              const laneHeight = (BAR_HEIGHT - 8) / lanes
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpen(task)}
                  title={`${task.title}, ${minutesToClock(start)}–${minutesToClock(end)}`}
                  className={`absolute overflow-hidden rounded-md px-1.5 pt-1 text-left text-[11px] leading-tight font-medium whitespace-nowrap transition-[filter] hover:brightness-95 ${
                    isNext ? 'bg-accent text-white' : 'bg-accent-soft text-accent-ink'
                  } ${isDone ? 'text-accent-ink/60 line-through' : ''}`}
                  style={{
                    left: toPercent(start),
                    width: `calc(${widthPercent(start, end)} - 2px)`,
                    top: 4 + lane * laneHeight,
                    height: laneHeight - 2,
                  }}
                >
                  {task.title}
                </button>
              )
            })}

            {showNow && (
              <div
                className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 bg-ink"
                style={{ left: toPercent(nowMinute) }}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-panel px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums">
                  {minutesToClock(nowMinute)}
                </span>
              </div>
            )}
          </div>

          <div className="relative mt-3 h-4 text-[11px] text-ink-soft">
            {hours.map((minute, index) =>
              hours.length <= 11 || index % 2 === 0 ? (
                <span
                  key={minute}
                  className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                  style={{ left: toPercent(minute) }}
                >
                  {minutesToClock(minute)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      <button type="button" onClick={onAdd} className="icon-button mt-2" aria-label="Adicionar no dia">
        <Icon name="plus" size={20} />
      </button>
    </section>
  )
}
