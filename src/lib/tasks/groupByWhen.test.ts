import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByWhen } from './groupByWhen.ts'
import type { Task } from '../../types.ts'

const task = (title: string, due_date: string | null, due_time: string | null = null): Task => ({
  id: title,
  area_id: null,
  kind: 'task',
  title,
  notes: null,
  priority: 2,
  due_date,
  due_time,
  duration_minutes: null,
  recurrence: null,
  focus_date: null,
  status: 'open',
  completed_at: null,
  created_at: '2026-11-20T12:00:00Z',
})

test('separa em atrasadas, hoje, amanhã, esta semana, mais pra frente e sem data', () => {
  const now = new Date(2026, 10, 23, 10, 0)
  const groups = groupByWhen(
    [
      task('sem data', null),
      task('mês que vem', '2026-12-20'),
      task('quarta', '2026-11-25'),
      task('amanhã 14h', '2026-11-24', '14:00:00'),
      task('amanhã 10h', '2026-11-24', '10:00:00'),
      task('hoje', '2026-11-23'),
      task('ontem', '2026-11-22'),
    ],
    now,
  )
  assert.deepEqual(
    groups.map((group) => [group.title, group.tasks.map((t) => t.title)]),
    [
      ['Atrasadas', ['ontem']],
      ['Hoje', ['hoje']],
      ['Amanhã', ['amanhã 10h', 'amanhã 14h']],
      ['Esta semana', ['quarta']],
      ['Mais pra frente', ['mês que vem']],
      ['Sem data', ['sem data']],
    ],
  )
})
