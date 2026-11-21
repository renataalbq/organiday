import { minutesToClock, type DayBudget } from '../lib/dayBudget/dayBudget'

interface DayTimelineProps {
  budget: DayBudget
  nowMinute: number
  onMeetingClick?: (taskId: string) => void
}

/** Régua do dia: expediente, almoço, reuniões e o "agora". Feita para ficar sobre o card azul. */
export function DayTimeline({ budget, nowMinute, onMeetingClick }: DayTimelineProps) {
  const span = budget.rangeEnd - budget.rangeStart
  const toPercent = (minute: number) => `${((minute - budget.rangeStart) / span) * 100}%`
  const widthPercent = (start: number, end: number) => `${((end - start) / span) * 100}%`

  const hours: number[] = []
  for (let minute = budget.rangeStart; minute <= budget.rangeEnd; minute += 60) hours.push(minute)
  const labelEvery = hours.length > 10 ? 2 : 1

  const showNow = nowMinute >= budget.rangeStart && nowMinute <= budget.rangeEnd

  return (
    <div>
      <div className="relative h-11 overflow-hidden rounded-xl bg-white/35">
        {budget.isWorkday && (
          <div
            className="absolute inset-y-0 bg-white/65"
            style={{
              left: toPercent(budget.workdayStart),
              width: widthPercent(budget.workdayStart, budget.workdayEnd),
            }}
          />
        )}

        {budget.segments.map((segment) =>
          segment.type === 'lunch' ? (
            <div
              key="lunch"
              title="Almoço"
              className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgba(43,33,82,.10)_0_4px,transparent_4px_9px)]"
              style={{
                left: toPercent(segment.startMinute),
                width: widthPercent(segment.startMinute, segment.endMinute),
              }}
            />
          ) : (
            <button
              key={segment.taskId}
              type="button"
              onClick={() => segment.taskId && onMeetingClick?.(segment.taskId)}
              title={`${segment.label}, ${minutesToClock(segment.startMinute)}–${minutesToClock(segment.endMinute)}`}
              className="absolute inset-y-1.5 overflow-hidden rounded-md bg-peach px-1.5 text-left text-[11px] leading-[32px] font-semibold whitespace-nowrap text-peach-ink ring-1 ring-lilac-ink/15 hover:bg-peach-deep"
              style={{
                left: toPercent(segment.startMinute),
                width: widthPercent(segment.startMinute, segment.endMinute),
              }}
            >
              {segment.label}
            </button>
          ),
        )}

        {showNow && (
          <div className="absolute inset-y-0 w-0.5 bg-lilac-ink" style={{ left: toPercent(nowMinute) }}>
            <span className="absolute -top-0.5 -left-[3px] size-2 rounded-full bg-lilac-ink" />
          </div>
        )}
      </div>

      <div className="relative mt-1.5 h-4 text-[11px] font-medium text-lilac-ink/75">
        {hours.map((minute, index) =>
          index % labelEvery === 0 ? (
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
  )
}
