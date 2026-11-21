import { useMemo } from 'react'
import { useAreas } from '../data/areas'
import { useSettings } from '../data/settings'
import { useTasks } from '../data/tasks'
import { buildAttentionItems } from '../lib/attention/buildAttentionItems'
import { buildDailySummary } from '../lib/daily/buildDailySummary'
import { computeDayBudget } from '../lib/dayBudget/dayBudget'
import { daysFromToday } from '../lib/dates'
import { rankTasks } from '../lib/priority/scoreTask'
import { useNow } from './useNow'

const FOCUS_SIZE = 3
const UPCOMING_DAYS = 7

/** Tudo que a tela "Hoje" precisa, já calculado a partir das tarefas, áreas e expediente. */
export function useTodayBoard() {
  const { now, todayISO } = useNow()
  const tasksQuery = useTasks()
  const { areas, areasById, isLoading: areasLoading } = useAreas()
  const { settings } = useSettings()

  const board = useMemo(() => {
    const allTasks = tasksQuery.data ?? []
    const openTasks = allTasks.filter((task) => task.status === 'open')
    const isDueByToday = (dueDate: string | null) => dueDate !== null && daysFromToday(dueDate, now) <= 0

    const todayMeetings = openTasks
      .filter((task) => task.kind === 'meeting' && task.due_date === todayISO)
      .sort((a, b) => a.due_time!.localeCompare(b.due_time!))
    const meetingsDoneToday = allTasks.filter(
      (task) => task.kind === 'meeting' && task.status === 'done' && task.due_date === todayISO,
    )

    const ranked = rankTasks(openTasks, areasById, todayISO, now)
    const focus = ranked.slice(0, FOCUS_SIZE)
    const focusIds = new Set(focus.map((item) => item.task.id))

    const workTasksForToday = openTasks.filter(
      (task) =>
        task.kind === 'task' &&
        task.area_id !== null &&
        areasById.get(task.area_id)?.kind === 'work' &&
        (isDueByToday(task.due_date) || task.focus_date === todayISO || focusIds.has(task.id)),
    )

    const budget = computeDayBudget({
      settings,
      meetings: [...todayMeetings, ...meetingsDoneToday],
      workTasks: workTasksForToday,
      now,
    })

    const decisions = openTasks
      .filter((task) => task.kind === 'decision')
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

    const alsoToday = ranked
      .filter((item) => !focusIds.has(item.task.id) && isDueByToday(item.task.due_date))
      .map((item) => item.task)

    const upcoming = openTasks
      .filter((task) => {
        if (task.kind === 'decision' || !task.due_date || focusIds.has(task.id)) return false
        const days = daysFromToday(task.due_date, now)
        return days > 0 && days <= UPCOMING_DAYS
      })
      .sort((a, b) => (a.due_date! + (a.due_time ?? '')).localeCompare(b.due_date! + (b.due_time ?? '')))

    const attention = buildAttentionItems({ openTasks, todayMeetings, budget, now })
    const dailySummary = buildDailySummary({ tasks: allTasks, areasById, settings, now })

    const dueTodayCount = openTasks.filter((task) => task.kind === 'task' && task.due_date === todayISO).length
    const overdueCount = openTasks.filter(
      (task) => task.kind !== 'meeting' && task.due_date && daysFromToday(task.due_date, now) < 0,
    ).length

    return {
      todayMeetings,
      meetingsDoneToday,
      focus,
      budget,
      workTasksForToday,
      decisions,
      alsoToday,
      upcoming,
      attention,
      dailySummary,
      dueTodayCount,
      overdueCount,
    }
  }, [tasksQuery.data, areasById, settings, now, todayISO])

  return {
    ...board,
    now,
    todayISO,
    areas,
    areasById,
    settings,
    isLoading: tasksQuery.isLoading || areasLoading,
    error: tasksQuery.error,
  }
}
