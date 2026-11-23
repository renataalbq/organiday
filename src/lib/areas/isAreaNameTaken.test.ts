import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAreaNameTaken } from './isAreaNameTaken.ts'
import type { Area } from '../../types.ts'

const AREAS: Area[] = [
  { id: 'work', name: 'Trabalho', color: '#000000', kind: 'work', position: 0 },
  { id: 'study', name: 'Estudos', color: '#000000', kind: 'life', position: 1 },
]

test('recusa nome igual ignorando maiúsculas, acentos e espaços', () => {
  assert.equal(isAreaNameTaken('trabalho', AREAS), true)
  assert.equal(isAreaNameTaken('  TRABALHO ', AREAS), true)
  assert.equal(isAreaNameTaken('Éstudos', AREAS), true)
  assert.equal(isAreaNameTaken('Saúde', AREAS), false)
})

test('renomear a própria área pro mesmo nome não conta como duplicada', () => {
  assert.equal(isAreaNameTaken('trabalho', AREAS, 'work'), false)
  assert.equal(isAreaNameTaken('Estudos', AREAS, 'work'), true)
})
