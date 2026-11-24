import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reminderMessage, type DueReminder } from './reminderMessage.ts'

const base: DueReminder = {
  task_id: 't1',
  user_id: 'u1',
  title: 'Enviar proposta pro cliente',
  due_date: '2026-11-24',
  due_time: '15:00:00',
  kind: 'task',
  minutes_before: 15,
}

test('tarefa com horário diz a hora e quanto falta', () => {
  assert.deepEqual(reminderMessage(base), {
    title: 'Enviar proposta pro cliente',
    body: 'Tarefa às 15h, daqui a 15 min.',
    tag: 'task-t1',
    url: '/',
  })
  assert.equal(reminderMessage({ ...base, due_time: '09:30:00', minutes_before: 60 }).body, 'Tarefa às 9h30, daqui a 1h.')
  assert.equal(reminderMessage({ ...base, minutes_before: 0 }).body, 'Tarefa às 15h, agora.')
  assert.equal(reminderMessage({ ...base, kind: 'meeting', minutes_before: 5 }).body, 'Reunião às 15h, daqui a 5 min.')
})

test('tarefa sem horário avisa que vence hoje', () => {
  assert.equal(reminderMessage({ ...base, due_time: null, minutes_before: null }).body, 'Vence hoje.')
  assert.equal(reminderMessage({ ...base, due_time: null, kind: 'decision', minutes_before: null }).body, 'Decisão pra tomar hoje.')
})
