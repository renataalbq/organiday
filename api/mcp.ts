import { handleMcp } from '../server/mcp/handleMcp.js'
import { mcpConfigFrom } from '../server/mcp/config.js'

/** Função da Vercel: servidor MCP do Organiday (ver server/mcp/handleMcp.ts). */
const handle = (request: Request) => handleMcp(request, mcpConfigFrom(process.env))

export { handle as GET, handle as POST, handle as DELETE }
