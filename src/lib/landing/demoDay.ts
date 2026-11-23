import { DEFAULT_TASK_MINUTES, formatDuration, timeToMinutes } from '../dayBudget/dayBudget.ts'

/** O dia de exemplo da página de entrada: uma reunião da agenda, o almoço e o que a pessoa escreveu. */

export interface DemoBlock {
  kind: 'busy' | 'typed'
  /** posição e largura em % da faixa do expediente */
  left: number
  width: number
}

export interface DemoDay {
  startHour: number
  endHour: number
  blocks: DemoBlock[]
  freeLabel: string
}

const DEMO_BUSY: [string, string][] = [
  ['10:30', '11:00'], // reunião que veio da agenda
  ['12:00', '13:00'], // almoço
]

/** "9", "9h", "9h30", "09:30" → "09:30"; qualquer outra coisa → null */
export function parseHourInput(text: string): string | null {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})(?:\s*(?:h|:)\s*(\d{2})?)?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function buildDemoDay(
  workdayStart: string,
  workdayEnd: string,
  typed: { time: string | null; durationMinutes: number | null } | null,
): DemoDay {
  const start = timeToMinutes(workdayStart)
  const end = Math.max(timeToMinutes(workdayEnd), start + 60)
  const span = end - start

  const intervals: { kind: DemoBlock['kind']; from: number; to: number }[] = DEMO_BUSY.map(([from, to]) => ({
    kind: 'busy',
    from: timeToMinutes(from),
    to: timeToMinutes(to),
  }))
  if (typed?.time) {
    const from = timeToMinutes(typed.time)
    intervals.push({ kind: 'typed', from, to: from + (typed.durationMinutes ?? DEFAULT_TASK_MINUTES) })
  }

  const clipped = intervals
    .map((interval) => ({ ...interval, from: Math.max(interval.from, start), to: Math.min(interval.to, end) }))
    .filter((interval) => interval.to > interval.from)

  // minutos ocupados sem contar duas vezes o que se sobrepõe
  const sorted = [...clipped].sort((a, b) => a.from - b.from)
  let busy = 0
  let cursor = start
  for (const interval of sorted) {
    const from = Math.max(interval.from, cursor)
    if (interval.to > from) busy += interval.to - from
    cursor = Math.max(cursor, interval.to)
  }

  return {
    startHour: Math.floor(start / 60),
    endHour: Math.ceil(end / 60),
    blocks: clipped.map((interval) => ({
      kind: interval.kind,
      left: ((interval.from - start) / span) * 100,
      width: ((interval.to - interval.from) / span) * 100,
    })),
    freeLabel: formatDuration(span - busy),
  }
}
