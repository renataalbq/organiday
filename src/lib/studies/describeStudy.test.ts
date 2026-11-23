import { test } from 'node:test'
import assert from 'node:assert/strict'
import { singularUnit, studyKindLabel, weeklyPace } from './describeStudy.ts'
import type { Study } from '../../types.ts'

const study = (overrides: Partial<Study>): Study => ({
  id: 's',
  title: 'x',
  unit_label: 'aulas',
  progress: 0,
  total: 10,
  target_date: null,
  status: 'active',
  notes: null,
  created_at: '2026-11-01T00:00:00Z',
  ...overrides,
})

test('unidade no singular pro botão "Fiz uma …"', () => {
  assert.equal(singularUnit('aulas'), 'aula')
  assert.equal(singularUnit('capítulos'), 'capítulo')
  assert.equal(singularUnit('lições'), 'lição')
  assert.equal(singularUnit('hora'), 'hora')
})

test('tipo pelo que se conta', () => {
  assert.equal(studyKindLabel('aulas'), 'Curso')
  assert.equal(studyKindLabel('páginas'), 'Livro')
  assert.equal(studyKindLabel('horas'), 'Estudo')
})

test('ritmo semanal até o prazo', () => {
  const today = new Date(2026, 10, 23)
  assert.equal(weeklyPace(study({ target_date: '2026-12-21' }), today), 3)
  assert.equal(weeklyPace(study({ target_date: null }), today), null)
  assert.equal(weeklyPace(study({ target_date: '2026-11-01' }), today), null)
})
