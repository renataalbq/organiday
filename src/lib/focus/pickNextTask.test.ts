import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickNextTask } from './pickNextTask.ts'
import type { Task } from '../../types.ts'

const task = (overrides: Partial<Task>): Task => ({
  id: Math.random().toString(36),
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
  created_at: '2026-11-20T12:00:00Z',
  ...overrides,
})
const rank = (tasks: Task[]) => tasks.map((t) => ({ task: t, score: 0, reasons: [], isPinned: false }))
const TODAY = '2026-11-23'
const at = (hours: number, minutes = 0) => hours * 60 + minutes

test('próxima com horário vem antes da mais importante', () => {
  const important = task({ title: 'importante', priority: 4 })
  const timed = task({ title: 'handoff', due_time: '15:30:00', duration_minutes: 30 })
  const next = pickNextTask({ ranked: rank([important, timed]), todayISO: TODAY, nowMinute: at(14, 20) })
  assert.equal(next?.task.title, 'handoff')
  assert.equal(next?.label, 'A seguir · 15h30')
  assert.equal(next?.startsInMinutes, 70)
})

test('horário que já passou não conta; cai na mais importante', () => {
  const important = task({ title: 'importante' })
  const past = task({ title: 'passou', due_time: '09:00:00', duration_minutes: 30 })
  const next = pickNextTask({ ranked: rank([important, past]), todayISO: TODAY, nowMinute: at(14) })
  assert.equal(next?.task.title, 'importante')
  assert.equal(next?.label, 'Próxima')
})

test('cronômetro rodando ou tarefa começada ganham de tudo; bloqueada nunca aparece', () => {
  const blocked = task({ title: 'travada', blocked_reason: 'esperando acesso' })
  const started = task({ title: 'começada', started_at: '2026-11-23T13:00:00Z' })
  const timed = task({ title: 'com horário', due_time: '15:00:00' })
  assert.equal(
    pickNextTask({ ranked: rank([blocked, timed, started]), todayISO: TODAY, nowMinute: at(14) })?.task.title,
    'começada',
  )
  assert.equal(
    pickNextTask({ ranked: rank([blocked, timed]), todayISO: TODAY, nowMinute: at(14), runningTaskId: timed.id })
      ?.label,
    'Em andamento',
  )
  assert.equal(pickNextTask({ ranked: rank([blocked]), todayISO: TODAY, nowMinute: at(14) }), null)
})
