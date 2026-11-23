import { handleProtectedResourceMetadata } from '../server/mcp/handleMcp.js'
import { mcpConfigFrom } from '../server/mcp/config.js'

/** Servida em /.well-known/oauth-protected-resource (rewrite no vercel.json). */
export function GET(request: Request): Response {
  return handleProtectedResourceMetadata(request, mcpConfigFrom(process.env))
}
