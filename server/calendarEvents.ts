import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { expandIcs, isValidTimeZone, type CalendarEvent } from '../src/lib/calendar/expandIcs.js'

/**
 * GET /api/calendar-events?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=America/Sao_Paulo
 * Authorization: Bearer <token de sessão do Supabase>
 *
 * Lê os links .ics do próprio usuário (tabela calendar_feeds, protegida por RLS usando o
 * token dele), baixa cada calendário e devolve os eventos do intervalo no fuso pedido.
 * Usado pela função da Vercel (api/calendar-events.ts) e pelo Vite em desenvolvimento.
 */

export interface CalendarHandlerConfig {
  supabaseUrl: string
  supabaseKey: string
}

interface FeedRow {
  id: string
  url: string
}

export interface FeedEvents {
  feedId: string
  events: CalendarEvent[]
  error: string | null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 62
const FETCH_TIMEOUT_MS = 10_000
const MAX_ICS_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  })

export async function handleCalendarEvents(request: Request, config: CalendarHandlerConfig): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'Método não permitido.' })

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json(401, { error: 'Faça login de novo.' })

  const params = new URL(request.url).searchParams
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const timeZone = params.get('tz') ?? 'UTC'
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to)
    return json(400, { error: 'Intervalo de datas inválido.' })
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_RANGE_DAYS)
    return json(400, { error: 'Intervalo grande demais.' })
  if (!isValidTimeZone(timeZone)) return json(400, { error: 'Fuso horário inválido.' })

  // RLS: com o token do usuário, o Supabase só devolve os links dele
  const feedsResponse = await fetch(`${config.supabaseUrl}/rest/v1/calendar_feeds?select=id,url`, {
    headers: { apikey: config.supabaseKey, authorization: `Bearer ${token}` },
  })
  if (feedsResponse.status === 401) return json(401, { error: 'Faça login de novo.' })
  if (!feedsResponse.ok) return json(502, { error: 'Não deu pra ler seus calendários.' })
  const feeds = (await feedsResponse.json()) as FeedRow[]

  const results = await Promise.all(
    feeds.map(async (feed): Promise<FeedEvents> => {
      try {
        const ics = await fetchIcs(feed.url)
        return { feedId: feed.id, events: expandIcs(ics, { from, to, timeZone }), error: null }
      } catch (error) {
        return {
          feedId: feed.id,
          events: [],
          error: error instanceof FeedError ? error.message : 'Não deu pra ler esse calendário.',
        }
      }
    }),
  )

  return json(200, { feeds: results })
}

class FeedError extends Error {}

/** webcal:// é só https:// com outro nome */
export function normalizeFeedUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://'))
  } catch {
    throw new FeedError('Link inválido.')
  }
  if (url.protocol !== 'https:') throw new FeedError('O link precisa começar com https:// ou webcal://.')
  assertPublicHost(url.hostname)
  return url
}

/**
 * Evita que o servidor seja usado pra acessar endereços internos (SSRF):
 * nada de IP literal, localhost ou nomes de rede local.
 */
export function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (
    isIP(host) !== 0 ||
    host === 'localhost' ||
    !host.includes('.') ||
    /\.(local|localhost|internal|lan|home|corp)$/.test(host)
  ) {
    throw new FeedError('Esse endereço não é permitido.')
  }
}

/** IPv4/IPv6 de rede interna, loopback, link-local ou metadados de nuvem */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  const v6 = address.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

/** o nome pode apontar pra um IP interno: confere antes de baixar */
async function assertResolvesPublic(hostname: string) {
  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new FeedError('Não encontrei esse endereço.')
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new FeedError('Esse endereço não é permitido.')
  }
}

async function fetchIcs(rawUrl: string): Promise<string> {
  let url = normalizeFeedUrl(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertResolvesPublic(url.hostname)
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1', 'user-agent': 'Organiday-Calendar/1.0' },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new FeedError('O calendário redirecionou pra lugar nenhum.')
      url = normalizeFeedUrl(new URL(location, url).toString())
      continue
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new FeedError('O link não está acessível. Ele pode ter sido trocado ou desativado.')
    }
    if (!response.ok) throw new FeedError(`O calendário respondeu com erro (${response.status}).`)

    const text = await readLimited(response, MAX_ICS_BYTES)
    if (!text.includes('BEGIN:VCALENDAR')) throw new FeedError('Esse link não é de um calendário .ics.')
    return text
  }
  throw new FeedError('Redirecionamentos demais.')
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new FeedError('O calendário é grande demais.')
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new FeedError('O calendário é grande demais.')
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}
