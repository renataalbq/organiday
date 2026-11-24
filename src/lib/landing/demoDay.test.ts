import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDemoDay, parseHourInput } from './demoDay.ts'

test('entende horas escritas de vários jeitos', () => {
  assert.equal(parseHourInput('9h'), '09:00')
  assert.equal(parseHourInput('9'), '09:00')
  assert.equal(parseHourInput('8h30'), '08:30')
  assert.equal(parseHourInput('18:00'), '18:00')
  assert.equal(parseHourInput(' 7 h '), '07:00')
  assert.equal(parseHourInput('25h'), null)
  assert.equal(parseHourInput('cedo'), null)
  assert.equal(parseHourInput(''), null)
})

test('desconta reunião, almoço e a tarefa escrita do expediente', () => {
  assert.equal(buildDemoDay('09:00', '18:00', null).freeLabel, '7h30')
  assert.equal(buildDemoDay('09:00', '18:00', { time: '15:00', durationMinutes: 60 }).freeLabel, '6h30')
  assert.equal(buildDemoDay('09:00', '18:00', { time: '15:00', durationMinutes: null }).freeLabel, '7h')
})

test('não conta duas vezes o que se sobrepõe e corta o que fica fora do expediente', () => {
  assert.equal(buildDemoDay('09:00', '18:00', { time: '12:30', durationMinutes: 60 }).freeLabel, '7h')
  const evening = buildDemoDay('09:00', '18:00', { time: '21:00', durationMinutes: 30 })
  assert.equal(evening.freeLabel, '7h30')
  assert.equal(evening.blocks.filter((block) => block.kind === 'typed').length, 0)
})

test('posiciona os blocos em % da faixa', () => {
  const day = buildDemoDay('09:00', '18:00', { time: '15:00', durationMinutes: 60 })
  const typed = day.blocks.find((block) => block.kind === 'typed')!
  assert.equal(Math.round(typed.left), 67)
  assert.equal(Math.round(typed.width), 11)
  assert.deepEqual(day.ticks.map((tick) => tick.hour), [9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  assert.equal(buildDemoDay('08:30', '17:00', null).ticks[0].hour, 9)
})
