import { DEFAULT_MEETING_MINUTES, DEFAULT_TASK_MINUTES, timeToMinutes } from '../dayBudget/dayBudget.ts'
import type { Task } from '../../types.ts'

const MIN_EVENT_MINUTES = 15

export interface PlacedEvent {
  task: Task
  start: number
  end: number
  lane: number
  lanes: number
}

/** Distribui eventos sobrepostos lado a lado. */
export function placeEvents(events: Task[]): PlacedEvent[] {
  const items = events
    .map((task) => {
      const start = timeToMinutes(task.due_time!)
      const fallback = task.kind === 'meeting' ? DEFAULT_MEETING_MINUTES : DEFAULT_TASK_MINUTES
      return {
        task,
        start,
        end: start + Math.max(MIN_EVENT_MINUTES, task.duration_minutes ?? fallback),
        lane: 0,
        lanes: 1,
      }
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const placed: PlacedEvent[] = []
  let group: PlacedEvent[] = []
  let groupEnd = -1

  const closeGroup = () => {
    const lanes = Math.max(1, ...group.map((item) => item.lane + 1))
    for (const item of group) item.lanes = lanes
    placed.push(...group)
    group = []
  }

  for (const item of items) {
    if (item.start >= groupEnd && group.length > 0) closeGroup()
    const laneEnds: number[] = []
    for (const other of group) laneEnds[other.lane] = Math.max(laneEnds[other.lane] ?? 0, other.end)
    let lane = 0
    while (laneEnds[lane] !== undefined && laneEnds[lane] > item.start) lane += 1
    item.lane = lane
    group.push(item)
    groupEnd = Math.max(groupEnd, item.end)
  }
  if (group.length > 0) closeGroup()
  return placed
}
