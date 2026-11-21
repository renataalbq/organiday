import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankTasks, scoreTask } from './scoreTask.ts'
import type { Area, Task } from '../../types.ts'

const MONDAY = new Date(2026, 10, 23, 9)
const SATURDAY = new Date(2026, 10, 21, 9)

const work: Area = { id: 'work', name: 'Trabalho', color: '#000000', kind: 'work', position: 0 }
const home: Area = { id: 'home', name: 'Casa', color: '#000000', kind: 'life', position: 1 }

const task = (overrides: Partial<Task>): Task => ({
  id: 'x',
  area_id: null,
  kind: 'task',
  title: 'x',
  notes: null,
  priority: 2,
  due_date: null,
  due_time: null,
  duration_minutes: null,
  recurrence: null,
  focus_date: null,
  status: 'open',
  completed_at: null,
  created_at: '2026-11-23T09:00:00',
  ...overrides,
})

test('atrasada pesa mais que prioridade alta sem prazo', () => {
  const overdue = scoreTask(task({ due_date: '2026-11-20' }), undefined, MONDAY)
  const highNoDate = scoreTask(task({ priority: 3 }), undefined, MONDAY)
  assert.ok(overdue.score > highNoDate.score)
  assert.equal(overdue.reasons[0], 'atrasada há 3 dias')
})

test('trabalho sobe em dia útil e casa sobe no fim de semana', () => {
  const workTask = task({ area_id: 'work' })
  const homeTask = task({ area_id: 'home' })
  assert.ok(scoreTask(workTask, work, MONDAY).score > scoreTask(homeTask, home, MONDAY).score)
  assert.ok(scoreTask(homeTask, home, SATURDAY).score > scoreTask(workTask, work, SATURDAY).score)
})

test('fixada no foco vem primeiro e reuniões ficam fora', () => {
  const ranked = rankTasks(
    [
      task({ id: 'urgent', priority: 4, due_date: '2026-11-23' }),
      task({ id: 'pinned', priority: 1, focus_date: '2026-11-23' }),
      task({ id: 'meeting', kind: 'meeting', due_date: '2026-11-23', due_time: '10:00' }),
    ],
    new Map(),
    '2026-11-23',
    MONDAY,
  )
  assert.deepEqual(
    ranked.map((item) => item.task.id),
    ['pinned', 'urgent'],
  )
})
