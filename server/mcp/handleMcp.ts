import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { resolveArea, type AreaRow } from './resolveArea.js'

/**
 * Servidor MCP do Organiday: deixa o Claude (Code, desktop, web) e o Codex criarem e lerem
 * tarefas do usuário.
 *
 *   POST /api/mcp  (Streamable HTTP, sem sessão)
 *   Authorization: Bearer <access token do Supabase>
 *
 * O login é OAuth 2.1 com o próprio Supabase Auth como servidor de autorização (OAuth Server
 * ligado no painel). O token que o cliente recebe é um JWT normal do usuário, então as
 * consultas passam pelo RLS como se fosse o app. A tela de consentimento é /oauth/consent.
 */

export interface McpHandlerConfig {
  supabaseUrl: string
  supabaseKey: string
  /** fuso usado pra saber o que é "hoje" (o app não guarda o fuso do usuário) */
  timeZone: string
}

const PRIORITY = { baixa: 1, media: 2, alta: 3, urgente: 4 } as const
const PRIORITY_NAME: Record<number, string> = { 1: 'baixa', 2: 'média', 3: 'alta', 4: 'urgente' }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })

/** URL pública do recurso protegido; atrás da Vercel o host vem nos headers de proxy */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}

/** GET /.well-known/oauth-protected-resource (RFC 9728): diz ao cliente onde fazer login */
export function handleProtectedResourceMetadata(request: Request, config: McpHandlerConfig): Response {
  const origin = publicOrigin(request)
  return json(
    200,
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1`],
      bearer_methods_supported: ['header'],
      resource_name: 'Organiday',
      resource_documentation: origin,
    },
    { 'access-control-allow-origin': '*' },
  )
}

export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function weekdayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'long' }).format(now)
}

export async function handleMcp(request: Request, config: McpHandlerConfig): Promise<Response> {
  const origin = publicOrigin(request)
  const unauthorized = (message: string) =>
    json(
      401,
      { error: 'unauthorized', error_description: message },
      {
        'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    )

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return unauthorized('Faça login no Organiday.')

  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    accessToken: async () => token,
  })

  // confere o token com o Supabase (expirado, revogado ou de outro projeto → 401 e o cliente renova)
  const userResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.supabaseKey, authorization: `Bearer ${token}` },
  })
  if (!userResponse.ok) return unauthorized('Sessão expirada. Faça login de novo.')

  if (request.method !== 'POST') {
    // sem sessão MCP: não há stream GET nem DELETE de sessão
    return json(405, { error: 'Método não permitido.' }, { allow: 'POST' })
  }

  const server = buildServer(supabase, config.timeZone)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}

interface TaskRow {
  id: string
  title: string
  notes: string | null
  kind: string
  priority: number
  due_date: string | null
  due_time: string | null
  duration_minutes: number | null
  recurrence: string | null
  status: string
  area_id: string | null
}

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] })
const failure = (value: string) => ({ ...text(value), isError: true })

function describeTask(task: TaskRow, areas: AreaRow[]): string {
  const area = areas.find((item) => item.id === task.area_id)?.name ?? 'Inbox'
  const when = [task.due_date, task.due_time?.slice(0, 5)].filter(Boolean).join(' ') || 'sem data'
  const extras = [
    task.kind !== 'task' ? task.kind : null,
    `prioridade ${PRIORITY_NAME[task.priority] ?? task.priority}`,
    task.duration_minutes ? `~${task.duration_minutes}min` : null,
    task.recurrence ? `repete: ${task.recurrence}` : null,
    task.status === 'done' ? 'concluída' : null,
  ].filter(Boolean)
  return `- [${task.id}] ${task.title} · ${area} · ${when} · ${extras.join(' · ')}`
}

function buildServer(supabase: SupabaseClient, timeZone: string): McpServer {
  const today = todayIn(timeZone)
  const server = new McpServer(
    { name: 'organiday', version: '1.0.0' },
    {
      instructions: [
        'Organiday é o organizador pessoal do usuário (tarefas, decisões e reuniões, separadas por áreas como Trabalho, Pessoal, Casa).',
        `Hoje é ${weekdayIn(timeZone)}, ${today} (fuso ${timeZone}). Converta "amanhã", "sexta", "às 10h" etc. para due_date YYYY-MM-DD e due_time HH:MM nesse fuso.`,
        'Ao criar uma tarefa a partir de um trabalho em andamento (ex.: um bug encontrado num debug), escreva um título curto e acionável e coloque o contexto útil em notes: arquivo e linha, erro, passos pra reproduzir, hipótese.',
        'Depois de criar, confirme ao usuário título, área, data e hora.',
      ].join('\n'),
    },
  )

  const loadAreas = async (): Promise<AreaRow[]> => {
    const { data, error } = await supabase.from('areas').select('id,name,kind').order('position')
    if (error) throw new Error(`Não deu pra ler as áreas: ${error.message}`)
    return data as AreaRow[]
  }

  server.registerTool(
    'list_areas',
    {
      title: 'Listar áreas',
      description: 'Lista as áreas do usuário no Organiday (ex.: Trabalho, Pessoal, Casa) e se cada uma é de trabalho.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const areas = await loadAreas()
      return text(
        areas.map((area) => `- ${area.name} (${area.kind === 'work' ? 'trabalho' : 'vida'}) [${area.id}]`).join('\n') ||
          'Nenhuma área cadastrada.',
      )
    },
  )

  server.registerTool(
    'create_task',
    {
      title: 'Criar tarefa',
      description:
        'Cria uma tarefa, decisão ou reunião no Organiday. A área aceita nome ou começo do nome ("trabalho", "casa"); sem área, vai pra Inbox.',
      inputSchema: {
        title: z.string().min(1).max(300).describe('Título curto e acionável'),
        notes: z.string().max(10_000).optional().describe('Contexto: links, arquivo/linha, erro, próximos passos'),
        area: z.string().optional().describe('Nome da área (ex.: "Trabalho"); omita para Inbox'),
        due_date: z.string().regex(ISO_DATE).optional().describe('YYYY-MM-DD'),
        due_time: z.string().regex(TIME).optional().describe('HH:MM, 24h. Exige due_date'),
        duration_minutes: z.number().int().positive().max(24 * 60).optional().describe('Estimativa ou duração'),
        priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional().describe('Padrão: media'),
        kind: z
          .enum(['task', 'decision', 'meeting'])
          .optional()
          .describe('task (padrão), decision (pergunta a decidir) ou meeting (exige horário)'),
        recurrence: z.enum(['daily', 'weekdays', 'weekly', 'monthly']).optional().describe('Exige due_date'),
      },
    },
    async (input) => {
      if (input.due_time && !input.due_date) return failure('due_time precisa de due_date.')
      if (input.recurrence && !input.due_date) return failure('recurrence precisa de due_date.')
      if (input.kind === 'meeting' && !input.due_time) return failure('Reunião precisa de horário (due_time).')

      const areas = await loadAreas()
      let areaId: string | null = null
      if (input.area) {
        const match = resolveArea(areas, input.area)
        if ('error' in match) return failure(match.error)
        areaId = match.area.id
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: input.title.trim(),
          notes: input.notes?.trim() || null,
          area_id: areaId,
          due_date: input.due_date ?? null,
          due_time: input.due_time ?? null,
          duration_minutes: input.duration_minutes ?? null,
          priority: PRIORITY[input.priority ?? 'media'],
          kind: input.kind ?? 'task',
          recurrence: input.recurrence ?? null,
        })
        .select('*')
        .single()
      if (error) return failure(`Não deu pra criar: ${error.message}`)
      return text(`Criada:\n${describeTask(data as TaskRow, areas)}`)
    },
  )

  server.registerTool(
    'list_tasks',
    {
      title: 'Listar tarefas',
      description:
        'Lista tarefas abertas do Organiday. Filtre por intervalo de datas e/ou área. Sem datas: todas as abertas (atrasadas, com data e sem data).',
      inputSchema: {
        from: z.string().regex(ISO_DATE).optional().describe('Data inicial YYYY-MM-DD (inclusive)'),
        to: z.string().regex(ISO_DATE).optional().describe('Data final YYYY-MM-DD (inclusive)'),
        area: z.string().optional().describe('Nome da área'),
        include_done: z.boolean().optional().describe('Incluir concluídas (padrão: não)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const areas = await loadAreas()
      let query = supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('due_time', { ascending: true, nullsFirst: true })
        .limit(200)
      if (!input.include_done) query = query.eq('status', 'open')
      if (input.from) query = query.gte('due_date', input.from)
      if (input.to) query = query.lte('due_date', input.to)
      if (input.area) {
        const match = resolveArea(areas, input.area)
        if ('error' in match) return failure(match.error)
        query = query.eq('area_id', match.area.id)
      }
      const { data, error } = await query
      if (error) return failure(`Não deu pra listar: ${error.message}`)
      const tasks = data as TaskRow[]
      return text(tasks.length ? tasks.map((task) => describeTask(task, areas)).join('\n') : 'Nenhuma tarefa.')
    },
  )

  server.registerTool(
    'update_task',
    {
      title: 'Editar tarefa',
      description: 'Muda título, notas, área, data, hora, duração ou prioridade de uma tarefa (use o id de list_tasks).',
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().min(1).max(300).optional(),
        notes: z.string().max(10_000).nullable().optional(),
        area: z.string().nullable().optional().describe('Nome da área; null manda pra Inbox'),
        due_date: z.string().regex(ISO_DATE).nullable().optional(),
        due_time: z.string().regex(TIME).nullable().optional(),
        duration_minutes: z.number().int().positive().max(24 * 60).nullable().optional(),
        priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
      },
    },
    async ({ id, area, priority, ...rest }) => {
      const areas = await loadAreas()
      const changes: Record<string, unknown> = { ...rest }
      if (priority) changes.priority = PRIORITY[priority]
      if (area === null) changes.area_id = null
      else if (area !== undefined) {
        const match = resolveArea(areas, area)
        if ('error' in match) return failure(match.error)
        changes.area_id = match.area.id
      }
      if (Object.keys(changes).length === 0) return failure('Nada pra mudar.')

      const { data, error } = await supabase.from('tasks').update(changes).eq('id', id).select('*').maybeSingle()
      if (error) return failure(`Não deu pra editar: ${error.message}`)
      if (!data) return failure('Tarefa não encontrada.')
      return text(`Atualizada:\n${describeTask(data as TaskRow, areas)}`)
    },
  )

  server.registerTool(
    'complete_task',
    {
      title: 'Concluir tarefa',
      description: 'Marca uma tarefa como feita (se for recorrente, o Organiday cria a próxima).',
      inputSchema: { id: z.string().uuid() },
      annotations: { idempotentHint: true },
    },
    async ({ id }) => {
      const { error } = await supabase.rpc('complete_task', { p_task_id: id, p_today: today })
      if (error) return failure(`Não deu pra concluir: ${error.message}`)
      return text('Concluída.')
    },
  )

  return server
}
