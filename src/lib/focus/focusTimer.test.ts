import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extendTimer, formatClock, pauseTimer, remainingSeconds, resumeTimer, startTimer } from './focusTimer.ts'

const MINUTE = 60_000

test('conta o tempo da tarefa e para no zero', () => {
  const timer = startTimer('t1', 30, 0)
  assert.equal(remainingSeconds(timer, 0), 1800)
  assert.equal(remainingSeconds(timer, 10 * MINUTE), 1200)
  assert.equal(remainingSeconds(timer, 45 * MINUTE), 0)
})

test('pausa congela e retomar desconta o tempo parado', () => {
  const paused = pauseTimer(startTimer('t1', 30, 0), 10 * MINUTE)
  assert.equal(remainingSeconds(paused, 20 * MINUTE), 1200)
  const resumed = resumeTimer(paused, 20 * MINUTE)
  assert.equal(remainingSeconds(resumed, 25 * MINUTE), 900)
})

test('mais 5 minutos depois do fim volta a contar de 5', () => {
  const timer = startTimer('t1', 30, 0)
  const extended = extendTimer(timer, 5, 40 * MINUTE)
  assert.equal(remainingSeconds(extended, 40 * MINUTE), 300)
})

test('formata como relógio', () => {
  assert.equal(formatClock(1500), '25:00')
  assert.equal(formatClock(65), '01:05')
  assert.equal(formatClock(3725), '1:02:05')
})
