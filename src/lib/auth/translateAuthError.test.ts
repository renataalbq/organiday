import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translateAuthError } from './translateAuthError.ts'

test('espera do Supabase vira mensagem em português com os segundos', () => {
  assert.equal(
    translateAuthError({ message: 'For security purposes, you can only request this after 36 seconds.' }),
    'Por segurança, espere 36 segundos para pedir outro link.',
  )
})

test('limite de e-mails e e-mail inválido', () => {
  assert.match(translateAuthError({ message: 'Email rate limit exceeded' }), /Muitos links/)
  assert.match(translateAuthError({ message: 'x', code: 'email_address_invalid' }), /e-mail não parece válido/)
})

test('erro desconhecido nunca mostra o texto em inglês', () => {
  assert.equal(
    translateAuthError({ message: 'Something unexpected happened' }),
    'Não deu pra enviar o link. Tente de novo em instantes.',
  )
})
