import { isValidTimeZone } from '../../src/lib/calendar/expandIcs.js'
import {
  PROVIDERS,
  ProviderError,
  describeAccount,
  listItems,
  parseCredentials,
  type Credentials,
  type ExternalItem,
  type Provider,
} from './providers.js'
import { open, seal } from './secretBox.js'

/**
 * POST /api/integrations         { provider, ...credenciais } → confere e salva (token criptografado)
 * GET  /api/integration-items?tz → o que está atribuído à pessoa no Jira, Trello e Asana
 * Authorization: Bearer <token de sessão do Supabase>
 *
 * Tudo passa pelo RLS com o token do próprio usuário. Remover uma integração é direto pelo app
 * (delete na tabela integrations), não precisa do servidor.
 */

export interface IntegrationsConfig {
  supabaseUrl: string
  supabaseKey: string
  /** chave que criptografa os tokens; só existe no servidor */
  secretKey: string
}

export interface ProviderItems {
  provider: Provider
  items: ExternalItem[]
  error: string | null
}

interface IntegrationRow {
  provider: Provider
  credentials: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  })

const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]

function rest(config: IntegrationsConfig, token: string, path: string, init: RequestInit = {}) {
  return fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.supabaseKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
}

const missingSecret = () =>
  json(500, { error: 'Falta configurar ORGANIDAY_SECRET_KEY no servidor pra guardar os tokens com segurança.' })

export async function handleConnectIntegration(request: Request, config: IntegrationsConfig): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' })
  const token = bearer(request)
  if (!token) return json(401, { error: 'Faça login de novo.' })
  if (!config.secretKey) return missingSecret()

  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const provider = input?.provider as Provider
  if (!input || !PROVIDERS.includes(provider)) return json(400, { error: 'Integração desconhecida.' })

  let credentials: Credentials
  let account: string
  try {
    credentials = parseCredentials(provider, input)
    account = await describeAccount(provider, credentials) // confere o token antes de salvar
  } catch (error) {
    return json(400, { error: error instanceof ProviderError ? error.message : 'Não deu pra conferir o acesso.' })
  }

  const saved = await rest(config, token, 'integrations?on_conflict=user_id,provider', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ provider, account: account.slice(0, 120), credentials: seal(JSON.stringify(credentials), config.secretKey) }),
  })
  if (saved.status === 401) return json(401, { error: 'Faça login de novo.' })
  if (!saved.ok) return json(502, { error: 'Não deu pra salvar a integração.' })
  return json(200, { provider, account })
}

export async function handleIntegrationItems(request: Request, config: IntegrationsConfig): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'Método não permitido.' })
  const token = bearer(request)
  if (!token) return json(401, { error: 'Faça login de novo.' })
  if (!config.secretKey) return missingSecret()

  const timeZone = new URL(request.url).searchParams.get('tz') ?? 'UTC'
  if (!isValidTimeZone(timeZone)) return json(400, { error: 'Fuso horário inválido.' })

  const rowsResponse = await rest(config, token, 'integrations?select=provider,credentials')
  if (rowsResponse.status === 401) return json(401, { error: 'Faça login de novo.' })
  if (!rowsResponse.ok) return json(502, { error: 'Não deu pra ler suas integrações.' })
  const rows = (await rowsResponse.json()) as IntegrationRow[]

  const results = await Promise.all(
    rows.map(async (row): Promise<ProviderItems> => {
      try {
        const credentials = JSON.parse(open(row.credentials, config.secretKey)) as Credentials
        return { provider: row.provider, items: await listItems(row.provider, credentials, timeZone), error: null }
      } catch (error) {
        return {
          provider: row.provider,
          items: [],
          error: error instanceof ProviderError ? error.message : 'Não deu pra ler. Tente conectar de novo.',
        }
      }
    }),
  )
  return json(200, { providers: results })
}
