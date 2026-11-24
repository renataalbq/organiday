import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Criptografa os tokens do Jira, Trello e Asana antes de irem pro banco. A chave fica só no
 * servidor (ORGANIDAY_SECRET_KEY), então nem o navegador nem quem lê a tabela vê o token.
 * Formato guardado: v1.<iv>.<tag>.<conteúdo>, tudo em base64url.
 */

const keyFrom = (secret: string) => createHash('sha256').update(secret, 'utf8').digest()

export function seal(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), body].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.')
}

export function open(sealed: string, secret: string): string {
  const [version, iv, tag, body] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || body === undefined) throw new Error('Credencial em formato desconhecido.')
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}
