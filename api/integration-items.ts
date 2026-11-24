import { handleIntegrationItems } from '../server/integrations/handleIntegrations.js'
import { integrationsConfigFrom } from '../server/integrations/config.js'

/** Função da Vercel: o que está atribuído ao usuário no Jira, Trello e Asana. */
export function GET(request: Request): Promise<Response> {
  return handleIntegrationItems(request, integrationsConfigFrom(process.env))
}
