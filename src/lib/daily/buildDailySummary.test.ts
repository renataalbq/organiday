import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDailySummary } from './buildDailySummary.ts'
import { DEFAULT_SETTINGS, type Area, type Task } from '../../types.ts'

const work: Area = { id: 'work', name: 'Trabalho', color: '#000000', kind: 'work', position: 0 }
const home: Area = { id: 'home', name: 'Casa', color: '#000000', kind: 'life', position: 1 }
const areasById = new Map([work, home].map((area) => [area.id, area]))

const task = (overrides: Partial<Task>): Task => ({
  id: Math.random().toString(36),
  area_id: 'work',
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
  created_at: '2026-11-18T12:00:00Z',
  ...overrides,
})

const doneAt = (title: string, localIso: string, overrides: Partial<Task> = {}) =>
  task({ title, status: 'done', completed_at: new Date(localIso).toISOString(), ...overrides })

const TASKS: Task[] = [
  doneAt('Revisar PR do filtro de deals', '2026-11-20T10:00:00'), // sexta
  doneAt('Corrigir bug do campo acumulador', '2026-11-20T16:30:00'),
  doneAt('Pagar luz', '2026-11-20T12:00:00', { area_id: 'home' }), // não é trabalho
  doneAt('Daily', '2026-11-20T09:30:00', { kind: 'meeting' }), // reunião não entra
  doneAt('Usar Zustand?', '2026-11-20T11:00:00', { kind: 'decision' }),
  doneAt('Deploy da release', '2026-11-23T15:00:00'), // segunda
  task({ title: 'Montar slides do PDI', priority: 3, due_date: '2026-11-23' }),
  task({ title: 'Escrever testes do checklist' }),
  task({ title: 'Qual lib de gráficos usar?', kind: 'decision' }),
]

test('segunda de manhã: resume sexta e planeja hoje', () => {
  const summary = buildDailySummary({
    tasks: TASKS,
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 23, 9, 0),
  })
  assert.equal(summary.doneLabel, 'Sexta')
  assert.equal(summary.planLabel, 'Hoje')
  assert.deepEqual(
    summary.done.map((t) => t.title),
    ['Revisar PR do filtro de deals', 'Usar Zustand?', 'Corrigir bug do campo acumulador'],
  )
  assert.equal(summary.plan[0].title, 'Montar slides do PDI')
  assert.match(summary.text, /• decidi: Usar Zustand\?/)
  assert.match(summary.text, /Impedimentos: aguardando decisão sobre Qual lib de gráficos usar$/)
  assert.doesNotMatch(summary.text, /Pagar luz|Daily/)
})

test('segunda depois do expediente: resume hoje e planeja amanhã', () => {
  const summary = buildDailySummary({
    tasks: TASKS,
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 23, 18, 30),
  })
  assert.equal(summary.doneLabel, 'Hoje')
  assert.equal(summary.planLabel, 'Amanhã')
  assert.deepEqual(
    summary.done.map((t) => t.title),
    ['Deploy da release'],
  )
})

test('sábado: resume sexta e planeja segunda', () => {
  const summary = buildDailySummary({
    tasks: TASKS,
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 21, 11, 0),
  })
  assert.equal(summary.doneLabel, 'Ontem')
  assert.equal(summary.planLabel, 'Segunda')
  assert.equal(summary.done.length, 3)
})

test('sem nada feito', () => {
  const summary = buildDailySummary({
    tasks: [],
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 24, 10, 0),
  })
  assert.equal(
    summary.text,
    'Já fiz (ontem):\n• nada marcado como concluído\n\nVou fazer (hoje):\n• sem tarefas de trabalho abertas\n\nImpedimentos: nenhum',
  )
})

test('não planeja pra hoje tarefa que vence amanhã, mesmo com prioridade alta', () => {
  const summary = buildDailySummary({
    tasks: [
      task({ title: 'Pedir keys pro Hugo', priority: 3, due_date: '2026-11-24' }),
      task({ title: 'Corrigir ajustes da review', due_date: '2026-11-23' }),
    ],
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 23, 9, 0),
  })
  assert.deepEqual(
    summary.plan.map((t) => t.title),
    ['Corrigir ajustes da review'],
  )
})

test('tarefa começada entra primeiro no "Vou fazer" e bloqueada vai pros impedimentos', () => {
  const summary = buildDailySummary({
    tasks: [
      task({ title: 'Corrigir review', priority: 4, due_date: '2026-11-23' }),
      task({ title: 'Revisar handoff', due_date: '2026-11-23', started_at: '2026-11-23T13:00:00Z' }),
      task({ title: 'Subir env do CRM', due_date: '2026-11-23', blocked_reason: 'esperando keys do Hugo' }),
    ],
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 23, 14, 0),
  })
  assert.deepEqual(
    summary.plan.map((t) => t.title),
    ['Revisar handoff', 'Corrigir review'],
  )
  assert.doesNotMatch(summary.text, /Fazendo/)
  assert.match(summary.text, /Vou fazer \(hoje\):\n• Revisar handoff\n• Corrigir review/)
  assert.match(summary.text, /Impedimentos: Subir env do CRM \(esperando keys do Hugo\)$/)
})

test('começadas contam no limite de 3 do "Vou fazer"', () => {
  const summary = buildDailySummary({
    tasks: [
      task({ title: 'A', due_date: '2026-11-23', started_at: '2026-11-23T10:00:00Z' }),
      task({ title: 'B', due_date: '2026-11-23', started_at: '2026-11-23T11:00:00Z' }),
      task({ title: 'C', due_date: '2026-11-23', priority: 4 }),
      task({ title: 'D', due_date: '2026-11-23', priority: 3 }),
    ],
    areasById,
    settings: DEFAULT_SETTINGS,
    now: new Date(2026, 10, 23, 14, 0),
  })
  assert.deepEqual(
    summary.plan.map((t) => t.title),
    ['A', 'B', 'C'],
  )
})
