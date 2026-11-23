import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveArea, type AreaRow } from './resolveArea.ts'

const areas: AreaRow[] = [
  { id: 'a1', name: 'Trabalho', kind: 'work' },
  { id: 'a2', name: 'Pessoal', kind: 'life' },
  { id: 'a3', name: 'Casa', kind: 'life' },
  { id: 'a4', name: 'Projetos', kind: 'life' },
]

const nameOf = (query: string, list = areas) => {
  const match = resolveArea(list, query)
  return 'area' in match ? match.area.name : null
}

test('acha pelo nome sem ligar pra maiúscula e acento', () => {
  assert.equal(nameOf('trabalho'), 'Trabalho')
  assert.equal(nameOf('CASA'), 'Casa')
  assert.equal(nameOf('Pessoál'), 'Pessoal')
})

test('acha pelo começo do nome e pelo id', () => {
  assert.equal(nameOf('trab'), 'Trabalho')
  assert.equal(nameOf('a3'), 'Casa')
})

test('"trabalho" cai na única área de trabalho quando o nome é outro', () => {
  const renamed: AreaRow[] = [
    { id: 'w', name: 'Empresa X', kind: 'work' },
    { id: 'l', name: 'Pessoal', kind: 'life' },
  ]
  assert.equal(nameOf('trabalho', renamed), 'Empresa X')
  assert.equal(nameOf('work', renamed), 'Empresa X')
})

test('nome ambíguo ou inexistente vira erro com as áreas disponíveis', () => {
  const ambiguous: AreaRow[] = [
    { id: 'p1', name: 'Projetos', kind: 'life' },
    { id: 'p2', name: 'Pessoal', kind: 'life' },
  ]
  const both = resolveArea(ambiguous, 'p')
  assert.ok('error' in both && both.error.includes('Projetos, Pessoal'))

  const missing = resolveArea(areas, 'academia')
  assert.ok('error' in missing && missing.error.includes('Trabalho, Pessoal, Casa, Projetos'))
})
