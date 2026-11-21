/** Datas sempre como 'YYYY-MM-DD' no fuso local, para não sofrer com UTC. */

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Diferença em dias de calendário: positivo se `isoDate` está no futuro. */
export function daysFromToday(isoDate: string, today: Date = new Date()): number {
  const ms = fromISODate(isoDate).getTime() - startOfDay(today).getTime()
  return Math.round(ms / 86_400_000)
}

export function formatTime(dueTime: string): string {
  const [hours, minutes] = dueTime.split(':')
  return minutes === '00' ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`
}

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

/** "hoje", "amanhã", "ontem", "sexta", "3 dez" */
export function formatRelativeDate(isoDate: string, today: Date = new Date()): string {
  const diff = daysFromToday(isoDate, today)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff === -1) return 'ontem'
  const date = fromISODate(isoDate)
  if (diff > 1 && diff < 7) return weekdayFormatter.format(date).replace('-feira', '')
  if (diff < -1 && diff > -7) return `há ${-diff} dias`
  return shortDateFormatter.format(date).replace('.', '')
}

export function formatLongToday(today: Date = new Date()): { weekday: string; date: string } {
  return {
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(today),
    date: new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(today),
  }
}
