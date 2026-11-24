import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandIcs, wallTimeToUtc } from './expandIcs.ts'

const SAO_PAULO = 'America/Sao_Paulo'

const calendar = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Organiday//test//PT',
    'BEGIN:VTIMEZONE',
    'TZID:America/Sao_Paulo',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

const event = (...lines: string[]) => ['BEGIN:VEVENT', 'DTSTAMP:20261101T000000Z', ...lines, 'END:VEVENT'].join('\r\n')

const week = { from: '2026-11-23', to: '2026-11-29', timeZone: SAO_PAULO }

test('evento simples com TZID vira data e hora locais', () => {
  const ics = calendar(
    event(
      'UID:1',
      'SUMMARY:Planning',
      'DTSTART;TZID=America/Sao_Paulo:20261124T140000',
      'DTEND;TZID=America/Sao_Paulo:20261124T153000',
    ),
  )
  const [planning] = expandIcs(ics, week)
  assert.equal(planning.title, 'Planning')
  assert.equal(planning.date, '2026-11-24')
  assert.equal(planning.time, '14:00')
  assert.equal(planning.durationMinutes, 90)
  assert.equal(planning.start, '2026-11-24T17:00:00.000Z')
  assert.equal(planning.allDay, false)
})

test('evento em UTC é convertido pro fuso do usuário', () => {
  const ics = calendar(event('UID:2', 'SUMMARY:Call', 'DTSTART:20261125T120000Z', 'DTEND:20261125T123000Z'))
  const [call] = expandIcs(ics, week)
  assert.equal(call.date, '2026-11-25')
  assert.equal(call.time, '09:00')
})

test('daily recorrente em dias úteis, com uma ocorrência removida e outra movida', () => {
  const ics = calendar(
    event(
      'UID:daily',
      'SUMMARY:Daily',
      'DTSTART;TZID=America/Sao_Paulo:20261102T093000',
      'DTEND;TZID=America/Sao_Paulo:20261102T094500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      'EXDATE;TZID=America/Sao_Paulo:20261125T093000',
    ),
    event(
      'UID:daily',
      'SUMMARY:Daily (mais tarde)',
      'RECURRENCE-ID;TZID=America/Sao_Paulo:20261126T093000',
      'DTSTART;TZID=America/Sao_Paulo:20261126T110000',
      'DTEND;TZID=America/Sao_Paulo:20261126T111500',
    ),
  )
  const dailies = expandIcs(ics, week)
  assert.deepEqual(
    dailies.map((item) => `${item.date} ${item.time} ${item.title}`),
    [
      '2026-11-23 09:30 Daily',
      '2026-11-24 09:30 Daily',
      '2026-11-26 11:00 Daily (mais tarde)',
      '2026-11-27 09:30 Daily',
    ],
  )
  assert.ok(dailies.every((item) => item.durationMinutes === 15))
})

test('ignora cancelados e eventos fora do intervalo', () => {
  const ics = calendar(
    event('UID:3', 'SUMMARY:Cancelada', 'STATUS:CANCELLED', 'DTSTART:20261124T150000Z', 'DTEND:20261124T160000Z'),
    event('UID:4', 'SUMMARY:Mês que vem', 'DTSTART:20261215T150000Z', 'DTEND:20261215T160000Z'),
    event('UID:5', 'SUMMARY:Semana passada', 'DTSTART:20261116T150000Z', 'DTEND:20261116T160000Z'),
  )
  assert.deepEqual(expandIcs(ics, week), [])
})

test('evento de dia inteiro vem sem horário, na data certa', () => {
  const ics = calendar(event('UID:6', 'SUMMARY:Feriado', 'DTSTART;VALUE=DATE:20261127', 'DTEND;VALUE=DATE:20261128'))
  const [holiday] = expandIcs(ics, week)
  assert.equal(holiday.allDay, true)
  assert.equal(holiday.date, '2026-11-27')
  assert.equal(holiday.time, null)
})

test('TZID IANA sem VTIMEZONE no arquivo ainda respeita o fuso do evento', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    event(
      'UID:7',
      'SUMMARY:Sync com Lisboa',
      'DTSTART;TZID=Europe/Lisbon:20261124T150000',
      'DTEND;TZID=Europe/Lisbon:20261124T160000',
    ),
    'END:VCALENDAR',
  ].join('\r\n')
  const [sync] = expandIcs(ics, week)
  // 15h em Lisboa (UTC+0 em novembro) = 12h em São Paulo
  assert.equal(sync.time, '12:00')
  assert.equal(sync.durationMinutes, 60)
})

test('recorrência sem fim não trava e só devolve o intervalo pedido', () => {
  const ics = calendar(
    event('UID:8', 'SUMMARY:Sempre', 'DTSTART:20200101T120000Z', 'DTEND:20200101T123000Z', 'RRULE:FREQ=DAILY'),
  )
  const result = expandIcs(ics, week)
  assert.equal(result.length, 7)
  assert.equal(result[0].date, '2026-11-23')
})

test('wallTimeToUtc respeita horário de verão', () => {
  // Nova York: 9h de 1º de julho = 13h UTC (EDT), 9h de 1º de dezembro = 14h UTC (EST)
  const summer = wallTimeToUtc({ year: 2026, month: 7, day: 1, hour: 9, minute: 0, second: 0 }, 'America/New_York')
  const winter = wallTimeToUtc({ year: 2026, month: 12, day: 1, hour: 9, minute: 0, second: 0 }, 'America/New_York')
  assert.equal(new Date(summer).toISOString(), '2026-07-01T13:00:00.000Z')
  assert.equal(new Date(winter).toISOString(), '2026-12-01T14:00:00.000Z')
})
