import { addDays, toISODate } from '../dates.ts'
import type { Area, Priority, Recurrence, TaskKind } from '../../types.ts'

/**
 * Entende frases como "pagar luz sexta 10h #casa !alta" e devolve a tarefa estruturada.
 *
 * Sintaxe:
 *   #area                → área (prefixo basta: #tra → Trabalho)
 *   !  !!  !alta  !baixa → prioridade (! = alta, !! = urgente)
 *   ~30m  ~1h            → duração estimada (ou da reunião)
 *   "...?" ou "decidir …" → decisão
 *   "reunião/call/daily/1:1 …" com horário → reunião
 *   hoje, amanhã, depois de amanhã, sexta, sexta que vem, ter 9h,
 *   dia 25, 25/12, em 3 dias, semana que vem, mês que vem
 *   15h, 15h30, 15:30, às 9, 8h da noite
 *   todo dia, dias úteis, toda segunda, toda semana, todo dia 5, todo mês
 */

export type QuickAddTokenKind =
  'kind' | 'area' | 'unknownArea' | 'priority' | 'date' | 'time' | 'recurrence' | 'duration'

export interface QuickAddToken {
  kind: QuickAddTokenKind
  label: string
}

export interface ParsedQuickAdd {
  title: string
  kind: TaskKind
  areaId: string | null
  priority: Priority | null
  dueDate: string | null
  dueTime: string | null
  recurrence: Recurrence | null
  durationMinutes: number | null
  tokens: QuickAddToken[]
}

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  dom: 0,
  segunda: 1,
  seg: 1,
  terca: 2,
  ter: 2,
  quarta: 3,
  qua: 3,
  quinta: 4,
  qui: 4,
  sexta: 5,
  sex: 5,
  sabado: 6,
  sab: 6,
}

const WEEKDAY_LABEL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const PRIORITY_BY_WORD: Record<string, Priority> = { '': 3, '!': 4, urgente: 4, alta: 3, media: 2, baixa: 1 }
const PRIORITY_TOKEN_LABEL: Record<Priority, string> = {
  1: 'prioridade baixa',
  2: 'prioridade média',
  3: 'prioridade alta',
  4: 'urgente',
}

const MEETING_START =
  /^(?:reuniao|call|daily|weekly|1:1|1on1|meet|alinhamento|sync|planning|review|retro|refinamento|entrevista)\b/

const DATE_PREFIX = String.raw`(?:(?:para|pra|ate|no|na|em)\s+)?`

/** Minúsculas e sem acento, preservando o comprimento para os índices baterem com o texto original. */
export function normalizeForMatch(text: string): string {
  let normalized = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const folded = char.normalize('NFD')[0].toLowerCase()
    normalized += folded.length === 1 ? folded : char
  }
  return normalized
}

class Scanner {
  private readonly original: string
  private readonly normalized: string
  private readonly consumed: boolean[]

  constructor(original: string) {
    this.original = original
    this.normalized = normalizeForMatch(original)
    this.consumed = new Array(original.length).fill(false)
  }

  /** Aplica a regex; o handler devolve `false` para rejeitar o trecho. Consome só o primeiro trecho aceito. */
  takeFirst(pattern: RegExp, handler: (match: RegExpExecArray) => boolean | void): boolean {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    for (const match of this.normalized.matchAll(regex)) {
      const start = match.index
      const end = start + match[0].length
      if (match[0].length === 0 || this.isConsumed(start, end)) continue
      if (handler(match) === false) continue
      this.consumed.fill(true, start, end)
      return true
    }
    return false
  }

  remainingText(): string {
    let text = ''
    for (let i = 0; i < this.original.length; i++) {
      text += this.consumed[i] ? ' ' : this.original[i]
    }
    return text
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
  }

  private isConsumed(start: number, end: number): boolean {
    for (let i = start; i < end; i++) if (this.consumed[i]) return true
    return false
  }
}

function slugify(text: string): string {
  return normalizeForMatch(text).replace(/[^\p{L}\p{N}]/gu, '')
}

function nextWeekday(today: Date, weekday: number, allowToday: boolean): Date {
  let distance = (weekday - today.getDay() + 7) % 7
  if (distance === 0 && !allowToday) distance = 7
  return addDays(today, distance)
}

function nextMonthDay(today: Date, day: number): Date | null {
  if (day < 1 || day > 31) return null
  for (let monthOffset = 0; monthOffset < 13; monthOffset++) {
    const candidate = new Date(today.getFullYear(), today.getMonth() + monthOffset, day)
    if (candidate.getDate() !== day) continue // mês sem esse dia (ex.: 31/11)
    if (candidate >= addDays(today, 0)) return candidate
  }
  return null
}

function nextWeekdayOrMonday(today: Date): Date {
  const weekday = today.getDay()
  if (weekday === 6) return addDays(today, 2)
  if (weekday === 0) return addDays(today, 1)
  return addDays(today, 0)
}

function formatTimeValue(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function describeDate(date: Date, today: Date): string {
  const diff = Math.round((addDays(date, 0).getTime() - addDays(today, 0).getTime()) / 86_400_000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff > 1 && diff < 7) return WEEKDAY_LABEL[date.getDay()]
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', weekday: 'short' })
    .format(date)
    .replace(/\./g, '')
}

export function parseQuickAdd(input: string, areas: Area[], now: Date = new Date()): ParsedQuickAdd {
  const today = addDays(now, 0)
  const scanner = new Scanner(input)
  const tokens: QuickAddToken[] = []

  // tipos explícitos via `as`: os valores são atribuídos dentro dos handlers, e o TS não acompanha isso
  let areaId = null as string | null
  let priority = null as Priority | null
  let dueDate = null as Date | null
  let dueTime = null as string | null
  let recurrence = null as Recurrence | null
  let durationMinutes = null as number | null

  // ── Área ────────────────────────────────────────────────────────────────
  scanner.takeFirst(/(?:^|\s)#([\p{L}\p{N}_-]+)/u, (match) => {
    const hint = slugify(match[1])
    const area = areas.find((candidate) => slugify(candidate.name).startsWith(hint))
    if (area) {
      areaId = area.id
      tokens.push({ kind: 'area', label: area.name })
    } else {
      tokens.push({ kind: 'unknownArea', label: `#${match[1]} não existe` })
    }
  })

  // ── Prioridade ──────────────────────────────────────────────────────────
  scanner.takeFirst(/(?:^|\s)!(urgente|alta|media|baixa|!)?(?=\s|$)/, (match) => {
    priority = PRIORITY_BY_WORD[match[1] ?? '']
    tokens.push({ kind: 'priority', label: PRIORITY_TOKEN_LABEL[priority] })
  })

  // ── Esforço ─────────────────────────────────────────────────────────────
  scanner.takeFirst(/(?:^|\s)~(\d{1,3})\s?(min|m|h)(?=\s|$)/, (match) => {
    const amount = Number(match[1])
    if (amount === 0) return false
    durationMinutes = match[2] === 'h' ? amount * 60 : amount
    tokens.push({
      kind: 'duration',
      label: durationMinutes >= 60 ? `~${durationMinutes / 60}h` : `~${durationMinutes}min`,
    })
  })

  // ── Recorrência ─────────────────────────────────────────────────────────
  const recurrenceRules: Array<[RegExp, (match: RegExpExecArray) => boolean | void]> = [
    [
      /\b(?:todo dia util|todos os dias uteis|(?:em )?dias uteis)\b/,
      () => {
        recurrence = 'weekdays'
        dueDate = nextWeekdayOrMonday(today)
        tokens.push({ kind: 'recurrence', label: 'dias úteis' })
      },
    ],
    [
      /\btodo dia (\d{1,2})\b(?!\s*[/h:])/,
      (match) => {
        const date = nextMonthDay(today, Number(match[1]))
        if (!date) return false
        recurrence = 'monthly'
        dueDate = date
        tokens.push({ kind: 'recurrence', label: `todo dia ${Number(match[1])}` })
      },
    ],
    [
      /\b(?:todos os dias|todo dia|diariamente)\b/,
      () => {
        recurrence = 'daily'
        dueDate = today
        tokens.push({ kind: 'recurrence', label: 'todo dia' })
      },
    ],
    [
      /\b(?:toda (segunda|terca|quarta|quinta|sexta)(?:[\s-]feira)?|todo (sabado|domingo))\b/,
      (match) => {
        const weekday = WEEKDAY_INDEX[match[1] ?? match[2]]
        recurrence = 'weekly'
        dueDate = nextWeekday(today, weekday, true)
        tokens.push({ kind: 'recurrence', label: `toda ${WEEKDAY_LABEL[weekday]}` })
      },
    ],
    [
      /\b(?:toda semana|todas as semanas|semanalmente)\b/,
      () => {
        recurrence = 'weekly'
        dueDate = today
        tokens.push({ kind: 'recurrence', label: 'toda semana' })
      },
    ],
    [
      /\b(?:todo mes|todos os meses|mensalmente)\b/,
      () => {
        recurrence = 'monthly'
        dueDate = today
        tokens.push({ kind: 'recurrence', label: 'todo mês' })
      },
    ],
  ]
  for (const [pattern, handler] of recurrenceRules) {
    if (scanner.takeFirst(pattern, handler)) break
  }

  // ── Data ────────────────────────────────────────────────────────────────
  let explicitDate = null as Date | null
  const dateRules: Array<[RegExp, (match: RegExpExecArray) => boolean | void]> = [
    [
      new RegExp(String.raw`\b(?:(?:para|pra|ate)\s+)?depois de amanha\b`),
      () => {
        explicitDate = addDays(today, 2)
      },
    ],
    [
      new RegExp(String.raw`\b${DATE_PREFIX}(hoje|amanha)\b`),
      (match) => {
        explicitDate = addDays(today, match[1] === 'hoje' ? 0 : 1)
      },
    ],
    [
      new RegExp(String.raw`\b${DATE_PREFIX}(?:a\s+)?(?:semana que vem|proxima semana)\b`),
      () => {
        explicitDate = nextWeekday(today, 1, false)
      },
    ],
    [
      new RegExp(String.raw`\b${DATE_PREFIX}(?:o\s+)?(?:mes que vem|proximo mes)\b`),
      () => {
        explicitDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
      },
    ],
    [
      /\b(?:em|daqui a)\s+(\d{1,3})\s+dias?\b/,
      (match) => {
        explicitDate = addDays(today, Number(match[1]))
      },
    ],
    [
      new RegExp(
        String.raw`\b${DATE_PREFIX}(?:(?:a|o)\s+)?(proxim[ao]\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[\s-]feira)?(\s+que vem)?\b`,
      ),
      (match) => {
        const isNext = Boolean(match[1] || match[3])
        explicitDate = nextWeekday(today, WEEKDAY_INDEX[match[2]], !isNext)
      },
    ],
    [
      // abreviações só valem seguidas de horário ("ter 9h"), porque "ter" e "sex" também são palavras comuns
      new RegExp(String.raw`\b${DATE_PREFIX}(seg|ter|qua|qui|sex|sab|dom)\b(?=\s+(?:as\s+)?\d{1,2}(?:h|:))`),
      (match) => {
        explicitDate = nextWeekday(today, WEEKDAY_INDEX[match[1]], true)
      },
    ],
    [
      new RegExp(String.raw`\b${DATE_PREFIX}(?:dia\s+)?(\d{1,2})/(\d{1,2})(?:/(\d{2}|\d{4}))?\b`),
      (match) => {
        const day = Number(match[1])
        const month = Number(match[2]) - 1
        let year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : today.getFullYear()
        let date = new Date(year, month, day)
        if (date.getMonth() !== month || date.getDate() !== day) return false
        if (!match[3] && date < today) {
          year += 1
          date = new Date(year, month, day)
        }
        explicitDate = date
      },
    ],
    [
      new RegExp(String.raw`\b${DATE_PREFIX}dia\s+(\d{1,2})\b(?!\s*[/h:])`),
      (match) => {
        const date = nextMonthDay(today, Number(match[1]))
        if (!date) return false
        explicitDate = date
      },
    ],
  ]
  for (const [pattern, handler] of dateRules) {
    if (scanner.takeFirst(pattern, handler)) break
  }
  if (explicitDate) dueDate = explicitDate

  // ── Horário ─────────────────────────────────────────────────────────────
  const applyTime = (hoursText: string, minutesText: string | undefined, period: string | undefined) => {
    let hours = Number(hoursText)
    const minutes = minutesText ? Number(minutesText) : 0
    if ((period === 'tarde' || period === 'noite') && hours < 12) hours += 12
    if (hours > 23 || minutes > 59) return false
    dueTime = formatTimeValue(hours, minutes)
    return true
  }
  const PERIOD = String.raw`(?:\s+da\s+(manha|tarde|noite))?`
  const matchedTime =
    scanner.takeFirst(
      new RegExp(String.raw`\b(?:(?:as|ate as|a partir das)\s+)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?![\d/])${PERIOD}`),
      (match) => applyTime(match[1], match[2] ?? match[3], match[4]),
    ) ||
    scanner.takeFirst(new RegExp(String.raw`\b(?:as|ate as|a partir das)\s+(\d{1,2})\b(?![/:\d])${PERIOD}`), (match) =>
      applyTime(match[1], undefined, match[2]),
    )
  if (matchedTime && !dueDate) dueDate = today

  if (dueDate) tokens.push({ kind: 'date', label: describeDate(dueDate, today) })
  if (dueTime)
    tokens.push({
      kind: 'time',
      label: dueTime.endsWith(':00') ? `${Number(dueTime.slice(0, 2))}h` : dueTime.replace(':', 'h'),
    })

  let title = scanner.remainingText()
  let kind: TaskKind = 'task'
  if (title.startsWith('?')) {
    kind = 'decision'
    title = title.replace(/^\?\s*/, '')
  } else if (title.endsWith('?') || /^decidir\b/.test(normalizeForMatch(title))) {
    kind = 'decision'
  } else if (dueTime && MEETING_START.test(normalizeForMatch(title))) {
    kind = 'meeting'
  }
  if (kind !== 'task') tokens.unshift({ kind: 'kind', label: kind === 'decision' ? 'decisão' : 'reunião' })

  return {
    title,
    kind,
    areaId,
    priority,
    dueDate: dueDate ? toISODate(dueDate) : null,
    dueTime,
    recurrence,
    durationMinutes,
    tokens,
  }
}
