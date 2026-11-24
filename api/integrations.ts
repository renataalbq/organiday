import { handleConnectIntegration } from '../server/integrations/handleIntegrations.js'
import { integrationsConfigFrom } from '../server/integrations/config.js'

/** Função da Vercel: conecta Jira, Trello ou Asana (ver server/integrations). */
export function POST(request: Request): Promise<Response> {
  return handleConnectIntegration(request, integrationsConfigFrom(process.env))
}
