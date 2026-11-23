/** Mensagens do Supabase Auth vêm em inglês; aqui viram texto da tela de entrada. */
export function translateAuthError(error: { message: string; code?: string; status?: number }): string {
  const message = error.message ?? ''

  const waitSeconds = message.match(/only request this after (\d+) seconds?/i)
  if (waitSeconds) return `Por segurança, espere ${waitSeconds[1]} segundos para pedir outro link.`

  if (error.code === 'over_email_send_rate_limit' || /email rate limit exceeded/i.test(message))
    return 'Muitos links pedidos em pouco tempo. Tente de novo em alguns minutos.'

  if (error.code === 'email_address_invalid' || /invalid format|invalid email/i.test(message))
    return 'Esse e-mail não parece válido. Confira e tente de novo.'

  if (error.status === 429) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'

  return 'Não deu pra enviar o link. Tente de novo em instantes.'
}
