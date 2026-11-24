import { useState, type FormEvent } from 'react'
import {
  PROVIDER_LABEL,
  useConnectIntegration,
  useDeleteIntegration,
  useExternalItems,
  useIntegrations,
} from '../data/integrations'
import type { Integration, IntegrationProvider } from '../types'
import { Icon } from './Icon'

interface FieldSpec {
  name: string
  label: string
  placeholder: string
  type?: 'text' | 'email' | 'password'
}

const PROVIDERS: {
  provider: IntegrationProvider
  what: string
  fields: FieldSpec[]
  help: { text: string; url: string; steps: string }
}[] = [
  {
    provider: 'jira',
    what: 'Issues atribuídas a você que ainda não foram concluídas.',
    fields: [
      { name: 'site', label: 'Endereço do Jira', placeholder: 'empresa.atlassian.net' },
      { name: 'email', label: 'E-mail da conta Atlassian', placeholder: 'voce@empresa.com', type: 'email' },
      { name: 'token', label: 'Token de API', placeholder: 'ATATT3x…', type: 'password' },
    ],
    help: {
      text: 'Criar token de API do Jira',
      url: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      steps: 'Clique em "Criar token de API", dê um nome (ex.: Organiday) e copie o token.',
    },
  },
  {
    provider: 'trello',
    what: 'Cartões abertos em que você é membro.',
    fields: [
      { name: 'apiKey', label: 'Chave de API', placeholder: '32 letras e números' },
      { name: 'token', label: 'Token', placeholder: 'ATTA…', type: 'password' },
    ],
    help: {
      text: 'Abrir o painel de Power-Ups do Trello',
      url: 'https://trello.com/power-ups/admin',
      steps:
        'Crie um Power-Up (qualquer nome, ex.: Organiday), abra a aba "Chave de API" e gere a chave. Na mesma página, clique no link "Token" pra gerar o token e autorize.',
    },
  },
  {
    provider: 'asana',
    what: 'Tarefas atribuídas a você que ainda não foram concluídas.',
    fields: [{ name: 'token', label: 'Token de acesso pessoal', placeholder: '2/1234…', type: 'password' }],
    help: {
      text: 'Abrir o console de desenvolvedor do Asana',
      url: 'https://app.asana.com/0/my-apps',
      steps: 'Clique em "Criar token de acesso pessoal", dê um nome (ex.: Organiday) e copie o token.',
    },
  },
]

/** Ajustes → Jira, Trello e Asana: o que te atribuírem lá aparece na Inbox pra você puxar. */
export function IntegrationSettings() {
  const { integrations, isLoading, isTableMissing, error } = useIntegrations()
  const { errors } = useExternalItems()
  const [openForm, setOpenForm] = useState<IntegrationProvider | null>(null)

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Jira, Trello e Asana</h2>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        O que te atribuírem lá aparece na Inbox, em "Chegou de fora", e você escolhe quando puxar pro seu dia. É só
        leitura: o Organiday não altera nada nessas ferramentas.
      </p>

      <p className="mt-4 flex gap-2 rounded-xl bg-peach p-3 text-[13px] text-peach-ink">
        <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
        <span>
          <strong className="font-semibold">Conta da empresa?</strong> Confira com o time de TI se a política permite
          conectar ferramentas externas. O token fica guardado criptografado e dá pra remover a qualquer momento.
        </span>
      </p>

      {isTableMissing ? (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-ink-soft">
          Pra ativar, rode <code className="rounded bg-card px-1">supabase/migrations/0006_integrations.sql</code> no
          SQL Editor do Supabase e recarregue a página.
        </p>
      ) : error ? (
        <p className="mt-4 text-sm font-medium text-alert">Não deu pra carregar suas integrações.</p>
      ) : (
        !isLoading && (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {PROVIDERS.map((spec) => (
              <ProviderRow
                key={spec.provider}
                spec={spec}
                integration={integrations.find((item) => item.provider === spec.provider)}
                error={errors.find((item) => item.provider === spec.provider)?.error ?? null}
                isFormOpen={openForm === spec.provider}
                onToggleForm={() => setOpenForm((current) => (current === spec.provider ? null : spec.provider))}
              />
            ))}
          </ul>
        )
      )}
    </section>
  )
}

function ProviderRow({
  spec,
  integration,
  error,
  isFormOpen,
  onToggleForm,
}: {
  spec: (typeof PROVIDERS)[number]
  integration: Integration | undefined
  error: string | null
  isFormOpen: boolean
  onToggleForm: () => void
}) {
  const deleteIntegration = useDeleteIntegration()
  const label = PROVIDER_LABEL[spec.provider]

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{label}</p>
          <p className="text-xs [overflow-wrap:anywhere] text-ink-soft">
            {integration ? `Conectado · ${integration.account}` : spec.what}
          </p>
          {integration && error && (
            <p className="mt-1 flex items-start gap-1 text-xs text-alert">
              <Icon name="alert" size={12} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {integration && (
            <button
              type="button"
              onClick={() => window.confirm(`Desconectar o ${label}?`) && deleteIntegration.mutate(integration.id)}
              className="button-quiet px-3 py-2 text-[13px] hover:text-alert"
            >
              Remover
            </button>
          )}
          <button type="button" onClick={onToggleForm} className="button-outline px-3 py-2 text-[13px]">
            {isFormOpen ? 'Cancelar' : integration ? 'Trocar token' : 'Conectar'}
          </button>
        </div>
      </div>
      {isFormOpen && <ConnectForm spec={spec} onDone={onToggleForm} />}
    </li>
  )
}

function ConnectForm({ spec, onDone }: { spec: (typeof PROVIDERS)[number]; onDone: () => void }) {
  const connect = useConnectIntegration()
  const [values, setValues] = useState<Record<string, string>>({})
  const isComplete = spec.fields.every((field) => values[field.name]?.trim())

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isComplete) return
    try {
      await connect.mutateAsync({ provider: spec.provider, ...values })
      onDone()
    } catch {
      // a mensagem aparece abaixo do formulário
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
      <div className="text-[13px] text-ink-soft sm:col-span-2">
        <a href={spec.help.url} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
          {spec.help.text} ↗
        </a>
        <p className="mt-1">{spec.help.steps}</p>
      </div>
      {spec.fields.map((field) => (
        <label key={field.name} className={`min-w-0 ${spec.fields.length === 1 ? 'sm:col-span-2' : ''}`}>
          <span className="label">{field.label}</span>
          <input
            className="field"
            type={field.type ?? 'text'}
            autoComplete="off"
            spellCheck={false}
            placeholder={field.placeholder}
            value={values[field.name] ?? ''}
            onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
            required
          />
        </label>
      ))}
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p className="text-xs text-ink-faint">Trate o token como senha.</p>
        <button type="submit" className="button-primary shrink-0" disabled={!isComplete || connect.isPending}>
          {connect.isPending ? 'Conferindo…' : 'Conectar'}
        </button>
      </div>
      {connect.error && <p className="text-sm text-alert sm:col-span-2">{connect.error.message}</p>}
    </form>
  )
}
