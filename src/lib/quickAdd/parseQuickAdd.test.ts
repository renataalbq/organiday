import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuickAdd } from './parseQuickAdd.ts'
import type { Area } from '../../types.ts'

// sábado, 21/11/2026, 12h
const NOW = new Date(2026, 10, 21, 12, 0)

const AREAS: Area[] = [
  { id: 'work', name: 'Trabalho', color: '#000000', kind: 'work', position: 0 },
  { id: 'home', name: 'Casa', color: '#000000', kind: 'life', position: 1 },
  { id: 'study', name: 'Estudos e cursos', color: '#000000', kind: 'life', position: 2 },
]

const parse = (text: string) => parseQuickAdd(text, AREAS, NOW)

test('texto simples vira só título', () => {
  const result = parse('Comprar ração')
  assert.equal(result.title, 'Comprar ração')
  assert.equal(result.kind, 'task')
  assert.equal(result.dueDate, null)
  assert.equal(result.areaId, null)
})

test('data, hora, área e prioridade juntos', () => {
  const result = parse('pagar luz sexta 10h #casa !alta')
  assert.equal(result.title, 'pagar luz')
  assert.equal(result.dueDate, '2026-11-27')
  assert.equal(result.dueTime, '10:00')
  assert.equal(result.areaId, 'home')
  assert.equal(result.priority, 3)
})

test('área por prefixo e com acento', () => {
  assert.equal(parse('ler artigo #est').areaId, 'study')
  assert.equal(parse('deploy #TRAB').areaId, 'work')
  const unknown = parse('algo #mercado')
  assert.equal(unknown.areaId, null)
  assert.equal(unknown.tokens[0].kind, 'unknownArea')
})

test('hoje, amanhã e depois de amanhã com preposição', () => {
  assert.equal(parse('ligar pro banco amanhã').dueDate, '2026-11-22')
  assert.equal(parse('ligar pro banco amanhã').title, 'ligar pro banco')
  assert.equal(parse('dentista depois de amanhã').dueDate, '2026-11-23')
  assert.equal(parse('enviar nota até hoje').title, 'enviar nota')
})

test('dia da semana: hoje conta, "que vem" pula', () => {
  assert.equal(parse('feira no sábado').dueDate, '2026-11-21')
  assert.equal(parse('feira sábado que vem').dueDate, '2026-11-28')
  assert.equal(parse('reunião na segunda-feira').dueDate, '2026-11-23')
  assert.equal(parse('próxima quarta: revisão').dueDate, '2026-11-25')
})

test('abreviação de dia só com horário', () => {
  const withTime = parse('1:1 ter 9h30')
  assert.equal(withTime.dueDate, '2026-11-24')
  assert.equal(withTime.dueTime, '09:30')
  const withoutTime = parse('ter paciência')
  assert.equal(withoutTime.title, 'ter paciência')
  assert.equal(withoutTime.dueDate, null)
})

test('datas numéricas', () => {
  assert.equal(parse('entregar relatório 30/11 14:00').dueDate, '2026-11-30')
  assert.equal(parse('entregar relatório 30/11 14:00').dueTime, '14:00')
  assert.equal(parse('renovar passaporte 10/01').dueDate, '2027-01-10')
  assert.equal(parse('prova dia 25').dueDate, '2026-11-25')
  assert.equal(parse('aluguel dia 5').dueDate, '2026-12-05')
  assert.equal(parse('data inválida 31/02').title, 'data inválida 31/02')
})

test('datas relativas', () => {
  assert.equal(parse('revisar contrato em 3 dias').dueDate, '2026-11-24')
  assert.equal(parse('planejar férias semana que vem').dueDate, '2026-11-23')
  assert.equal(parse('fechar fatura mês que vem').dueDate, '2026-12-01')
})

test('horários', () => {
  const evening = parse('jantar 8h da noite')
  assert.equal(evening.dueTime, '20:00')
  assert.equal(evening.dueDate, '2026-11-21')
  assert.equal(parse('call às 15').dueTime, '15:00')
  assert.equal(parse('call 15:45').dueTime, '15:45')
  assert.equal(parse('treino 25h').dueTime, null)
})

test('recorrência', () => {
  const daily = parse('tomar água todo dia')
  assert.equal(daily.recurrence, 'daily')
  assert.equal(daily.dueDate, '2026-11-21')
  assert.equal(daily.title, 'tomar água')

  const weekly = parse('lixo reciclável toda terça')
  assert.equal(weekly.recurrence, 'weekly')
  assert.equal(weekly.dueDate, '2026-11-24')

  const weekdays = parse('daily dias úteis 9h30 ~15m #trabalho')
  assert.equal(weekdays.recurrence, 'weekdays')
  assert.equal(weekdays.dueDate, '2026-11-23') // sábado → segunda
  assert.equal(weekdays.kind, 'meeting')
  assert.equal(weekdays.durationMinutes, 15)
  assert.equal(weekdays.title, 'daily')

  const monthly = parse('pagar condomínio todo dia 10')
  assert.equal(monthly.recurrence, 'monthly')
  assert.equal(monthly.dueDate, '2026-12-10')
})

test('prioridade e duração', () => {
  assert.equal(parse('corrigir bug !!').priority, 4)
  assert.equal(parse('corrigir bug !baixa').priority, 1)
  assert.equal(parse('corrigir bug ~1h').durationMinutes, 60)
  assert.equal(parse('ótimo!').priority, null)
})

test('decisões', () => {
  const question = parse('Qual cor da nova ecobag?')
  assert.equal(question.kind, 'decision')
  assert.equal(question.title, 'Qual cor da nova ecobag?')
  const prefixed = parse('? trocar de plano de celular sexta')
  assert.equal(prefixed.kind, 'decision')
  assert.equal(prefixed.title, 'trocar de plano de celular')
  assert.equal(parse('decidir viagem de fim de ano').kind, 'decision')
})

test('reunião só quando tem horário', () => {
  assert.equal(parse('reunião com time de produto 14h ~1h').kind, 'meeting')
  assert.equal(parse('reunião: preparar pauta').kind, 'task')
})

test('pergunta mantém data e hora no título; o que vem depois do ? vira prazo', () => {
  const areas: Area[] = [...AREAS, { id: 'proj', name: 'Projetos', color: '#000000', kind: 'life', position: 3 }]
  const inside = parseQuickAdd('[QA] manter a daily às 10h30? #proj', areas, NOW)
  assert.equal(inside.kind, 'decision')
  assert.equal(inside.title, '[QA] manter a daily às 10h30?')
  assert.equal(inside.dueTime, null)
  assert.equal(inside.dueDate, null)
  assert.equal(inside.areaId, 'proj')

  const after = parse('trocar de plano de celular? sexta')
  assert.equal(after.title, 'trocar de plano de celular?')
  assert.equal(after.dueDate, '2026-11-27')
})
