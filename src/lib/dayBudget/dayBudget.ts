import type { Task, UserSettings } from '../../types.ts'

export const DEFAULT_MEETING_MINUTES = 30
export const DEFAULT_TASK_MINUTES = 30

export interface TimelineSegment {
  startMinute: number
  endMinute: number
  type: 'meeting' | 'lunch'
  label: string
  taskId?: string
}

export interface DayBudget {
  isWorkday: boolean
  /** início e fim da régua da linha do tempo, em minutos desde 0h */
  rangeStart: number
  rangeEnd: number
  workdayStart: number
  workdayEnd: number
  segments: TimelineSegment[]
  /** minutos úteis do expediente (sem almoço) */
  workMinutes: number
  meetingMinutes: number
  /** livre no expediente inteiro */
  freeMinutes: number
  /** livre daqui até o fim do expediente */
  freeFromNowMinutes: number
  /** soma das estimativas das tarefas de trabalho do dia */
  plannedMinutes: number
  unestimatedCount: number
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`
}

/** "2h20", "45min", "0min" */
export function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes))
  if (safe < 60) return `${safe}min`
  return minutesToClock(safe)
}

type Interval = [number, number]

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: Interval[] = []
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}

function overlapMinutes(intervals: Interval[], window: Interval): number {
  return intervals.reduce((sum, [start, end]) => {
    const clippedStart = Math.max(start, window[0])
    const clippedEnd = Math.min(end, window[1])
    return sum + Math.max(0, clippedEnd - clippedStart)
  }, 0)
}

export function meetingInterval(meeting: Task): Interval {
  const start = timeToMinutes(meeting.due_time ?? '00:00')
  return [start, start + (meeting.duration_minutes ?? DEFAULT_MEETING_MINUTES)]
}

interface DayBudgetInput {
  settings: UserSettings
  /** reuniões abertas de hoje */
  meetings: Task[]
  /** tarefas de trabalho que você pretende fazer hoje */
  workTasks: Task[]
  now: Date
}

export function computeDayBudget({ settings, meetings, workTasks, now }: DayBudgetInput): DayBudget {
  const weekday = now.getDay()
  const isWorkday = weekday !== 0 && weekday !== 6
  const workdayStart = timeToMinutes(settings.workday_start)
  const workdayEnd = timeToMinutes(settings.workday_end)
  const nowMinute = now.getHours() * 60 + now.getMinutes()

  const workWindows: Interval[] = []
  const lunch: Interval | null =
    settings.lunch_start && settings.lunch_end
      ? [timeToMinutes(settings.lunch_start), timeToMinutes(settings.lunch_end)]
      : null
  if (isWorkday) {
    if (lunch && lunch[0] > workdayStart && lunch[1] < workdayEnd) {
      workWindows.push([workdayStart, lunch[0]], [lunch[1], workdayEnd])
    } else {
      workWindows.push([workdayStart, workdayEnd])
    }
  }

  const meetingIntervals = meetings.map(meetingInterval)
  const busy = mergeIntervals(meetingIntervals)

  const workMinutes = workWindows.reduce((sum, [start, end]) => sum + (end - start), 0)
  const meetingMinutes = workWindows.reduce((sum, window) => sum + overlapMinutes(busy, window), 0)

  const remainingWindows = workWindows
    .map(([start, end]): Interval => [Math.max(start, nowMinute), end])
    .filter(([start, end]) => end > start)
  const remainingMinutes = remainingWindows.reduce((sum, [start, end]) => sum + (end - start), 0)
  const remainingBusy = remainingWindows.reduce((sum, window) => sum + overlapMinutes(busy, window), 0)

  const segments: TimelineSegment[] = meetings
    .map((meeting) => {
      const [startMinute, endMinute] = meetingInterval(meeting)
      return { startMinute, endMinute, type: 'meeting' as const, label: meeting.title, taskId: meeting.id }
    })
    .sort((a, b) => a.startMinute - b.startMinute)
  if (isWorkday && lunch) segments.push({ startMinute: lunch[0], endMinute: lunch[1], type: 'lunch', label: 'Almoço' })

  const allPoints = [workdayStart, workdayEnd, ...meetingIntervals.flat()]
  const rangeStart = Math.floor(Math.min(...allPoints) / 60) * 60
  const rangeEnd = Math.ceil(Math.max(...allPoints) / 60) * 60

  const plannedMinutes = workTasks.reduce((sum, task) => sum + (task.duration_minutes ?? DEFAULT_TASK_MINUTES), 0)
  const unestimatedCount = workTasks.filter((task) => !task.duration_minutes).length

  return {
    isWorkday,
    rangeStart,
    rangeEnd,
    workdayStart,
    workdayEnd,
    segments,
    workMinutes,
    meetingMinutes,
    freeMinutes: workMinutes - meetingMinutes,
    freeFromNowMinutes: remainingMinutes - remainingBusy,
    plannedMinutes,
    unestimatedCount,
  }
}
