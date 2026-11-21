import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeEvents } from './placeEvents.ts'
import type { Task } from '../../types.ts'

const event = (id: string, time: string, minutes: number | null, kind: Task['kind'] = 'meeting'): Task => ({
  id,
  area_id: null,
  kind,
  title: id,
  notes: null,
  priority: 2,
  due_date: '2026-11-23',
  due_time: time,
  duration_minutes: minutes,
  recurrence: null,
  focus_date: null,
  status: 'open',
  completed_at: null,
  created_at: '2026-11-23T09:00:00',
})

const layout = (tasks: Task[]) =>
  Object.fromEntries(placeEvents(tasks).map((item) => [item.task.id, [item.lane, item.lanes, item.start, item.end]]))

test('eventos sem sobreposição ocupam a largura toda', () => {
  assert.deepEqual(layout([event('a', '09:00', 30), event('b', '09:30', 60)]), {
    a: [0, 1, 540, 570],
    b: [0, 1, 570, 630],
  })
})

test('eventos sobrepostos ficam lado a lado', () => {
  assert.deepEqual(layout([event('a', '09:00', 60), event('b', '09:30', 60)]), {
    a: [0, 2, 540, 600],
    b: [1, 2, 570, 630],
  })
})

test('reaproveita a primeira coluna livre dentro do grupo', () => {
  const result = layout([event('a', '09:00', 120), event('b', '09:00', 30), event('c', '09:45', 30)])
  assert.deepEqual(result.a, [0, 2, 540, 660])
  assert.deepEqual(result.b, [1, 2, 540, 570])
  assert.deepEqual(result.c, [1, 2, 585, 615])
})

test('sem duração usa o padrão e nunca fica menor que 15 min', () => {
  const result = layout([event('m', '10:00', null), event('t', '14:00', null, 'task'), event('s', '16:00', 5)])
  assert.equal(result.m[3] - result.m[2], 30)
  assert.equal(result.t[3] - result.t[2], 30)
  assert.equal(result.s[3] - result.s[2], 15)
})
