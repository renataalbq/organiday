/**
 * Jira, Trello e Asana: só leitura. Cada provedor sabe (1) conferir a credencial e dizer de quem
 * é a conta e (2) listar o que está atribuído à pessoa e ainda não foi concluído.
 */

export type Provider = 'jira' | 'trello' | 'asana'
export const PROVIDERS: Provider[] = ['jira', 'trello', 'asana']

export interface JiraCredentials {
  site: string
  email: string
  token: string
}
export interface TrelloCredentials {
  apiKey: string
  token: string
}
export interface AsanaCredentials {
  token: string
}
export type Credentials = JiraCredentials | TrelloCredentials | AsanaCredentials

export interface ExternalItem {
  provider: Provider
  /** id estável pra não puxar duas vezes (vai pra tasks.external_ref) */
  ref: string
  title: string
  url: string
  /** YYYY-MM-DD no fuso do usuário */
  dueDate: string | null
  /** HH:MM no fuso do usuário */
  dueTime: string | null
  /** projeto, quadro ou status, pra dar contexto */
  context: string | null
}

export class ProviderError extends Error {}

const FETCH_TIMEOUT_MS = 10_000
const MAX_ITEMS = 50

async function getJson<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json', ...init.headers },
    })
  } catch {
    throw new ProviderError(`O ${label} não respondeu. Tente de novo daqui a pouco.`)
  }
  if (response.status === 401 || response.status === 403)
    throw new ProviderError(`O ${label} recusou o acesso. Confira o token (ele pode ter expirado ou sido revogado).`)
  if (response.status === 404) throw new ProviderError(`Não encontrei esse endereço no ${label}.`)
  if (!response.ok) throw new ProviderError(`O ${label} respondeu com erro (${response.status}).`)
  return (await response.json()) as T
}

/** ISO com fuso → data e hora locais do usuário */
export function toLocalDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/* ─── Jira Cloud ────────────────────────────────────────────────────────── */

/** "empresa", "empresa.atlassian.net" ou a URL inteira → "empresa.atlassian.net" (só Atlassian Cloud) */
export function normalizeJiraSite(raw: string): string {
  let host = raw.trim().toLowerCase()
  try {
    if (/^https?:\/\//.test(host)) host = new URL(host).hostname
  } catch {
    throw new ProviderError('Endereço do Jira inválido.')
  }
  host = host.replace(/\/.*$/, '')
  if (/^[a-z0-9][a-z0-9-]*$/.test(host)) host = `${host}.atlassian.net`
  if (!/^[a-z0-9][a-z0-9-]*\.atlassian\.net$/.test(host))
    throw new ProviderError('Use o endereço do Jira Cloud, no formato empresa.atlassian.net.')
  return host
}

const jiraAuth = ({ email, token }: JiraCredentials) => ({
  authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
})

interface JiraIssue {
  key: string
  fields: { summary?: string; duedate?: string | null; status?: { name?: string }; project?: { name?: string } }
}

export function normalizeJiraIssue(issue: JiraIssue, site: string): ExternalItem {
  const context = [issue.fields.project?.name, issue.fields.status?.name].filter(Boolean).join(' · ')
  return {
    provider: 'jira',
    ref: `jira:${site}:${issue.key}`,
    title: `[${issue.key}] ${issue.fields.summary ?? 'Sem título'}`,
    url: `https://${site}/browse/${issue.key}`,
    dueDate: issue.fields.duedate ?? null,
    dueTime: null,
    context: context || null,
  }
}

async function jiraAccount(credentials: JiraCredentials): Promise<string> {
  const me = await getJson<{ displayName?: string; emailAddress?: string }>(
    `https://${credentials.site}/rest/api/3/myself`,
    { headers: jiraAuth(credentials) },
    'Jira',
  )
  return `${me.displayName ?? credentials.email} · ${credentials.site}`
}

async function jiraItems(credentials: JiraCredentials): Promise<ExternalItem[]> {
  const params = new URLSearchParams({
    jql: 'assignee = currentUser() AND statusCategory != Done ORDER BY duedate ASC, updated DESC',
    fields: 'summary,duedate,status,project',
    maxResults: String(MAX_ITEMS),
  })
  const body = await getJson<{ issues?: JiraIssue[] }>(
    `https://${credentials.site}/rest/api/3/search/jql?${params}`,
    { headers: jiraAuth(credentials) },
    'Jira',
  )
  return (body.issues ?? []).map((issue) => normalizeJiraIssue(issue, credentials.site))
}

/* ─── Trello ────────────────────────────────────────────────────────────── */

const trelloUrl = (path: string, { apiKey, token }: TrelloCredentials, params: Record<string, string> = {}) =>
  `https://api.trello.com/1${path}?${new URLSearchParams({ ...params, key: apiKey, token })}`

interface TrelloCard {
  id: string
  name: string
  due: string | null
  dueComplete: boolean
  shortUrl: string
  idBoard: string
}

export function normalizeTrelloCard(card: TrelloCard, boardName: string | undefined, timeZone: string): ExternalItem {
  const due = card.due ? toLocalDateTime(card.due, timeZone) : null
  return {
    provider: 'trello',
    ref: `trello:${card.id}`,
    title: card.name,
    url: card.shortUrl,
    dueDate: due?.date ?? null,
    dueTime: due?.time ?? null,
    context: boardName ?? null,
  }
}

async function trelloAccount(credentials: TrelloCredentials): Promise<string> {
  const me = await getJson<{ fullName?: string; username?: string }>(
    trelloUrl('/members/me', credentials, { fields: 'fullName,username' }),
    {},
    'Trello',
  )
  return me.fullName || me.username || 'Trello'
}

async function trelloItems(credentials: TrelloCredentials, timeZone: string): Promise<ExternalItem[]> {
  const [cards, boards] = await Promise.all([
    getJson<TrelloCard[]>(
      trelloUrl('/members/me/cards', credentials, { filter: 'open', fields: 'name,due,dueComplete,shortUrl,idBoard' }),
      {},
      'Trello',
    ),
    getJson<{ id: string; name: string }[]>(
      trelloUrl('/members/me/boards', credentials, { filter: 'open', fields: 'name' }),
      {},
      'Trello',
    ),
  ])
  const boardNames = new Map(boards.map((board) => [board.id, board.name]))
  return cards
    .filter((card) => !card.dueComplete)
    .slice(0, MAX_ITEMS)
    .map((card) => normalizeTrelloCard(card, boardNames.get(card.idBoard), timeZone))
}

/* ─── Asana ─────────────────────────────────────────────────────────────── */

const asanaAuth = ({ token }: AsanaCredentials) => ({ authorization: `Bearer ${token}` })

interface AsanaTask {
  gid: string
  name: string
  due_on: string | null
  due_at: string | null
  permalink_url: string
  projects?: { name?: string }[]
}

export function normalizeAsanaTask(task: AsanaTask, timeZone: string): ExternalItem {
  const due = task.due_at ? toLocalDateTime(task.due_at, timeZone) : null
  return {
    provider: 'asana',
    ref: `asana:${task.gid}`,
    title: task.name || 'Sem título',
    url: task.permalink_url,
    dueDate: due?.date ?? task.due_on ?? null,
    dueTime: due?.time ?? null,
    context:
      (task.projects ?? [])
        .map((project) => project.name)
        .filter(Boolean)
        .join(', ') || null,
  }
}

interface AsanaMe {
  name?: string
  workspaces?: { gid: string; name?: string }[]
}

async function asanaMe(credentials: AsanaCredentials): Promise<AsanaMe> {
  const body = await getJson<{ data: AsanaMe }>(
    'https://app.asana.com/api/1.0/users/me?opt_fields=name,workspaces.name',
    { headers: asanaAuth(credentials) },
    'Asana',
  )
  return body.data
}

async function asanaItems(credentials: AsanaCredentials, timeZone: string): Promise<ExternalItem[]> {
  const me = await asanaMe(credentials)
  const lists = await Promise.all(
    (me.workspaces ?? []).slice(0, 3).map(async (workspace) => {
      const params = new URLSearchParams({
        assignee: 'me',
        workspace: workspace.gid,
        completed_since: 'now',
        limit: String(MAX_ITEMS),
        opt_fields: 'name,due_on,due_at,permalink_url,projects.name',
      })
      const body = await getJson<{ data: AsanaTask[] }>(
        `https://app.asana.com/api/1.0/tasks?${params}`,
        { headers: asanaAuth(credentials) },
        'Asana',
      )
      return body.data
    }),
  )
  return lists
    .flat()
    .slice(0, MAX_ITEMS)
    .map((task) => normalizeAsanaTask(task, timeZone))
}

/* ─── Interface comum ───────────────────────────────────────────────────── */

const required = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new ProviderError(message)
  if (value.length > 500) throw new ProviderError('Valor longo demais.')
  return value.trim()
}

/** valida o que veio do formulário e devolve a credencial no formato do provedor */
export function parseCredentials(provider: Provider, input: Record<string, unknown>): Credentials {
  if (provider === 'jira')
    return {
      site: normalizeJiraSite(required(input.site, 'Informe o endereço do Jira.')),
      email: required(input.email, 'Informe o e-mail da conta Atlassian.'),
      token: required(input.token, 'Informe o token de API do Jira.'),
    }
  if (provider === 'trello')
    return {
      apiKey: required(input.apiKey, 'Informe a chave de API do Trello.'),
      token: required(input.token, 'Informe o token do Trello.'),
    }
  return { token: required(input.token, 'Informe o token de acesso pessoal do Asana.') }
}

export async function describeAccount(provider: Provider, credentials: Credentials): Promise<string> {
  if (provider === 'jira') return jiraAccount(credentials as JiraCredentials)
  if (provider === 'trello') return trelloAccount(credentials as TrelloCredentials)
  const me = await asanaMe(credentials as AsanaCredentials)
  return me.name ?? 'Asana'
}

export function listItems(provider: Provider, credentials: Credentials, timeZone: string): Promise<ExternalItem[]> {
  if (provider === 'jira') return jiraItems(credentials as JiraCredentials)
  if (provider === 'trello') return trelloItems(credentials as TrelloCredentials, timeZone)
  return asanaItems(credentials as AsanaCredentials, timeZone)
}
