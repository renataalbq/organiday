import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeDayBudget, formatDuration } from './dayBudget.ts'
import { DEFAULT_SETTINGS, type Task } from '../../types.ts'

const baseTask: Task = {
  id: 'x',
  area_id: null,
  kind: 'task',
  title: 'x',
  notes: null,
  priority: 2,
  due_date: '2026-11-23',
  due_time: null,
  duration_minutes: null,
  recurrence: null,
  focus_date: null,
  status: 'open',
  completed_at: null,
  created_at: '2026-11-20T10:00:00Z',
}

const meeting = (id: string, time: string, minutes: number): Task => ({
  ...baseTask,
  id,
  kind: 'meeting',
  title: id,
  due_time: time,
  duration_minutes: minutes,
})

// segunda, 23/11/2026
const MONDAY_8AM = new Date(2026, 10, 23, 8, 0)

test('expediente 9–18 com almoço: 8h úteis, descontando reuniões sobrepostas', () => {
  const budget = computeDayBudget({
    settings: DEFAULT_SETTINGS,
    meetings: [meeting('daily', '09:30', 15), meeting('planning', '14:00', 60), meeting('sync', '14:30', 60)],
    workTasks: [{ ...baseTask, duration_minutes: 120 }, baseTask],
    now: MONDAY_8AM,
  })
  assert.equal(budget.workMinutes, 480)
  assert.equal(budget.meetingMinutes, 15 + 90)
  assert.equal(budget.freeMinutes, 480 - 105)
  assert.equal(budget.freeFromNowMinutes, 480 - 105)
  assert.equal(budget.plannedMinutes, 150)
  assert.equal(budget.unestimatedCount, 1)
})

test('tempo livre a partir de agora desconta o que já passou', () => {
  const budget = computeDayBudget({
    settings: DEFAULT_SETTINGS,
    meetings: [meeting('planning', '14:00', 60)],
    workTasks: [],
    now: new Date(2026, 10, 23, 15, 30),
  })
  assert.equal(budget.freeFromNowMinutes, 150)
})

test('reunião fora do expediente aparece na régua mas não come tempo livre', () => {
  const budget = computeDayBudget({
    settings: DEFAULT_SETTINGS,
    meetings: [meeting('call EUA', '19:00', 60)],
    workTasks: [],
    now: MONDAY_8AM,
  })
  assert.equal(budget.meetingMinutes, 0)
  assert.equal(budget.rangeEnd, 20 * 60)
})

test('fim de semana não tem expediente', () => {
  const budget = computeDayBudget({
    settings: DEFAULT_SETTINGS,
    meetings: [],
    workTasks: [],
    now: new Date(2026, 10, 21, 10),
  })
  assert.equal(budget.isWorkday, false)
  assert.equal(budget.freeMinutes, 0)
})

test('formatação de duração', () => {
  assert.equal(formatDuration(45), '45min')
  assert.equal(formatDuration(140), '2h20')
  assert.equal(formatDuration(120), '2h')
})
