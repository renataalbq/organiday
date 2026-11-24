import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ProviderError,
  normalizeAsanaTask,
  normalizeJiraIssue,
  normalizeJiraSite,
  normalizeTrelloCard,
  parseCredentials,
  toLocalDateTime,
} from './providers.ts'
import { open, seal } from './secretBox.ts'

test('aceita o endereço do Jira de vários jeitos, mas só Atlassian Cloud', () => {
  assert.equal(normalizeJiraSite('empresa'), 'empresa.atlassian.net')
  assert.equal(normalizeJiraSite('Empresa.atlassian.net'), 'empresa.atlassian.net')
  assert.equal(normalizeJiraSite('https://empresa.atlassian.net/jira/your-work'), 'empresa.atlassian.net')
  assert.throws(() => normalizeJiraSite('jira.empresa.com'), ProviderError)
  assert.throws(() => normalizeJiraSite('http://169.254.169.254'), ProviderError)
  assert.throws(() => normalizeJiraSite('evil.com/x.atlassian.net'), ProviderError)
})

test('converte horário com fuso pro dia e hora do usuário', () => {
  assert.deepEqual(toLocalDateTime('2026-11-25T02:30:00.000Z', 'America/Sao_Paulo'), { date: '2026-11-24', time: '23:30' })
  assert.deepEqual(toLocalDateTime('2026-11-24T13:00:00Z', 'America/Sao_Paulo'), { date: '2026-11-24', time: '10:00' })
})

test('normaliza issue do Jira', () => {
  const item = normalizeJiraIssue(
    { key: 'APP-42', fields: { summary: 'Erro no cadastro', duedate: '2026-11-30', status: { name: 'A fazer' }, project: { name: 'App' } } },
    'empresa.atlassian.net',
  )
  assert.deepEqual(item, {
    provider: 'jira',
    ref: 'jira:empresa.atlassian.net:APP-42',
    title: '[APP-42] Erro no cadastro',
    url: 'https://empresa.atlassian.net/browse/APP-42',
    dueDate: '2026-11-30',
    dueTime: null,
    context: 'App · A fazer',
  })
})

test('normaliza cartão do Trello com prazo no fuso do usuário', () => {
  const item = normalizeTrelloCard(
    { id: 'c1', name: 'Atualizar planilha', due: '2026-11-24T18:00:00.000Z', dueComplete: false, shortUrl: 'https://trello.com/c/x', idBoard: 'b' },
    'Financeiro',
    'America/Sao_Paulo',
  )
  assert.equal(item.ref, 'trello:c1')
  assert.equal(item.dueDate, '2026-11-24')
  assert.equal(item.dueTime, '15:00')
  assert.equal(item.context, 'Financeiro')
})

test('normaliza tarefa do Asana: due_at tem hora, due_on é só o dia', () => {
  const base = { gid: '9', name: 'Preparar apresentação', permalink_url: 'https://app.asana.com/0/0/9', projects: [{ name: 'Q4' }] }
  const dayOnly = normalizeAsanaTask({ ...base, due_on: '2026-11-26', due_at: null }, 'America/Sao_Paulo')
  assert.deepEqual([dayOnly.dueDate, dayOnly.dueTime, dayOnly.context], ['2026-11-26', null, 'Q4'])
  const withTime = normalizeAsanaTask({ ...base, due_on: '2026-11-26', due_at: '2026-11-26T20:00:00.000Z' }, 'America/Sao_Paulo')
  assert.deepEqual([withTime.dueDate, withTime.dueTime], ['2026-11-26', '17:00'])
})

test('exige os campos de cada integração', () => {
  assert.throws(() => parseCredentials('jira', { site: 'empresa', email: 'a@b.com' }), /token/)
  assert.throws(() => parseCredentials('trello', { token: 'x' }), /chave/)
  assert.deepEqual(parseCredentials('asana', { token: ' abc ' }), { token: 'abc' })
})

test('criptografa e abre o token; chave errada não abre', () => {
  const sealed = seal('{"token":"segredo"}', 'chave-do-servidor')
  assert.ok(!sealed.includes('segredo'))
  assert.equal(open(sealed, 'chave-do-servidor'), '{"token":"segredo"}')
  assert.throws(() => open(sealed, 'outra-chave'))
})
