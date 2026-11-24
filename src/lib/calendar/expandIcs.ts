import ICAL from 'ical.js'

/**
 * Lê um arquivo iCalendar (.ics) e devolve os eventos que caem num intervalo de dias,
 * já no fuso do usuário. Expande recorrências (RRULE/RDATE/EXDATE) e aplica as
 * exceções (ocorrências movidas/editadas, com RECURRENCE-ID).
 *
 * Roda no servidor (função da Vercel); não tem acesso à rede nem ao Supabase.
 */

export interface CalendarEvent {
  /** estável por ocorrência: uid + início */
  id: string
  title: string
  location: string | null
  /** dia inteiro (sem horário) */
  allDay: boolean
  /** início/fim em UTC (ISO) */
  start: string
  end: string
  /** data e hora locais no fuso pedido */
  date: string
  time: string | null
  durationMinutes: number
}

export interface ExpandOptions {
  /** YYYY-MM-DD, inclusive, no fuso `timeZone` */
  from: string
  to: string
  /** fuso IANA do usuário, ex.: America/Sao_Paulo */
  timeZone: string
}

/**
 * Teto de passos por evento recorrente, só para um RRULE absurdo (ex.: a cada minuto)
 * não travar a função. Uma daily de 10 anos atrás dá ~3.650 passos.
 */
const MAX_STEPS_PER_EVENT = 50_000
/** ocorrências movidas (exceções) podem vir de antes do intervalo */
const EXCEPTION_MARGIN_MS = 31 * 86_400_000
const MAX_EVENTS = 1000

interface WallTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatter = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatter.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    partsFormatter.set(timeZone, formatter)
  }
  return formatter
}

/** Data/hora de parede num fuso, para um instante UTC. */
export function wallTimeIn(utcMs: number, timeZone: string): WallTime {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Instante UTC de uma data/hora de parede num fuso (ajusta o horário de verão). */
export function wallTimeToUtc(wall: WallTime, timeZone: string): number {
  const asIfUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  // duas passadas cobrem a troca de offset no horário de verão
  let guess = asIfUtc
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = wallTimeIn(guess, timeZone)
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second)
    guess += asIfUtc - seenAsUtc
  }
  return guess
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

const pad = (value: number) => String(value).padStart(2, '0')
const isoDate = (wall: WallTime) => `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`
const isoTime = (wall: WallTime) => `${pad(wall.hour)}:${pad(wall.minute)}`

function parseIsoDate(value: string): WallTime {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day, hour: 0, minute: 0, second: 0 }
}

function wallFromIcal(time: ICAL.Time): WallTime {
  return {
    year: time.year,
    month: time.month,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
    second: time.second,
  }
}

/**
 * Converte um ICAL.Time para UTC.
 * - com fuso conhecido (VTIMEZONE no arquivo ou UTC): o próprio ical.js converte;
 * - "flutuante": usa o TZID do evento se for um nome IANA válido (alguns feeds não
 *   mandam VTIMEZONE), senão o fuso do usuário.
 */
function toUtcMs(time: ICAL.Time, tzid: string | null, fallbackZone: string): number {
  const zone = time.zone
  const isFloating = !zone || zone === ICAL.Timezone.localTimezone || zone.tzid === 'floating'
  if (!isFloating) return time.toUnixTime() * 1000
  const wallZone = tzid && isValidTimeZone(tzid) ? tzid : fallbackZone
  return wallTimeToUtc(wallFromIcal(time), wallZone)
}

function tzidOf(event: ICAL.Event): string | null {
  const value = event.component.getFirstProperty('dtstart')?.getParameter('tzid')
  return typeof value === 'string' ? value : null
}

function isCancelled(event: ICAL.Event): boolean {
  return String(event.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED'
}

export function expandIcs(icsText: string, { from, to, timeZone }: ExpandOptions): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(icsText))
  for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
    const tzid = vtimezone.getFirstPropertyValue('tzid')
    if (typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(vtimezone)
  }

  const rangeStartUtc = wallTimeToUtc(parseIsoDate(from), timeZone)
  const toWall = parseIsoDate(to)
  const rangeEndUtc = wallTimeToUtc({ ...toWall, hour: 23, minute: 59, second: 59 }, timeZone)

  // separa eventos "mestre" das exceções (ocorrência específica alterada)
  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Event[] = []
  for (const vevent of root.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent)
    if (!event.uid || !event.startDate) continue
    if (event.isRecurrenceException()) exceptions.push(event)
    else masters.set(event.uid, event)
  }
  const orphanExceptions: ICAL.Event[] = []
  for (const exception of exceptions) {
    const master = masters.get(exception.uid)
    if (master) master.relateException(exception)
    else orphanExceptions.push(exception)
  }

  const events: CalendarEvent[] = []

  const pushOccurrence = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    if (isCancelled(item)) return
    const tzid = tzidOf(item)
    const allDay = start.isDate
    const startUtc = allDay ? wallTimeToUtc(wallFromIcal(start), timeZone) : toUtcMs(start, tzid, timeZone)
    const endUtc = allDay ? wallTimeToUtc(wallFromIcal(end), timeZone) : toUtcMs(end, tzid, timeZone)
    if (endUtc <= rangeStartUtc && startUtc < rangeStartUtc) return
    if (startUtc > rangeEndUtc) return

    const wall = allDay ? wallFromIcal(start) : wallTimeIn(startUtc, timeZone)
    events.push({
      id: `${item.uid}:${new Date(startUtc).toISOString()}`,
      title: item.summary?.trim() || '(sem título)',
      location: item.location?.trim() || null,
      allDay,
      start: new Date(startUtc).toISOString(),
      end: new Date(Math.max(endUtc, startUtc)).toISOString(),
      date: isoDate(wall),
      time: allDay ? null : isoTime(wall),
      durationMinutes: Math.max(0, Math.round((endUtc - startUtc) / 60_000)),
    })
  }

  for (const event of masters.values()) {
    if (events.length >= MAX_EVENTS) break
    if (!event.isRecurring()) {
      pushOccurrence(event, event.startDate, event.endDate ?? event.startDate)
      continue
    }
    const iterator = event.iterator()
    for (let step = 0; step < MAX_STEPS_PER_EVENT; step += 1) {
      const next = iterator.next()
      if (!next) break
      // conversão barata: só pra saber se já chegou perto do intervalo
      const approxUtc = Date.UTC(next.year, next.month - 1, next.day, next.hour, next.minute)
      if (approxUtc < rangeStartUtc - EXCEPTION_MARGIN_MS) continue
      if (approxUtc > rangeEndUtc + EXCEPTION_MARGIN_MS) break
      const details = event.getOccurrenceDetails(next)
      pushOccurrence(details.item, details.startDate, details.endDate)
    }
  }

  for (const exception of orphanExceptions) {
    pushOccurrence(exception, exception.startDate, exception.endDate ?? exception.startDate)
  }

  return events.sort((a, b) => a.start.localeCompare(b.start)).slice(0, MAX_EVENTS)
}
