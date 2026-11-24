import { Link } from 'react-router-dom'
import { useAreas } from '../data/areas'
import { PROVIDER_LABEL, useExternalItems, usePullItem } from '../data/integrations'
import { formatRelativeDate } from '../lib/dates'
import type { ExternalItem } from '../types'
import { Icon } from './Icon'

/** Inbox → "Chegou de fora": o que te atribuíram no Jira, Trello ou Asana, pra puxar quando quiser. */
export function ExternalInbox() {
  const { items, errors, hasIntegrations, isLoading, isFetching, error, refetch } = useExternalItems()

  if (!hasIntegrations) {
    return (
      <p className="mb-6 text-sm text-ink-soft">
        Usa Jira, Trello ou Asana?{' '}
        <Link to="/ajustes" className="font-medium text-accent underline">
          Conecte em Ajustes
        </Link>{' '}
        e o que te atribuírem aparece aqui.
      </p>
    )
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Chegou de fora{items.length > 0 && <span className="ml-1.5 text-ink-soft">{items.length}</span>}
        </h2>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs text-ink-soft hover:text-ink disabled:opacity-60"
        >
          {isFetching ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {errors.map(({ provider, error: message }) => (
        <p key={provider} className="mb-2 flex items-start gap-1.5 text-xs text-alert">
          <Icon name="alert" size={13} className="mt-0.5 shrink-0" /> {PROVIDER_LABEL[provider]}: {message}
        </p>
      ))}
      {error && <p className="mb-2 text-xs text-alert">{error.message}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-soft">Buscando o que te atribuíram…</p>
      ) : items.length === 0 ? (
        <p className="card px-5 py-4 text-sm text-ink-soft">Nada novo atribuído a você. Tudo em dia.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((item) => (
            <ExternalRow key={item.ref} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ExternalRow({ item }: { item: ExternalItem }) {
  const { areas } = useAreas()
  const pull = usePullItem()
  const workArea = areas.find((area) => area.kind === 'work') ?? null

  const due = item.dueDate
    ? `vence ${formatRelativeDate(item.dueDate)}${item.dueTime ? ` às ${item.dueTime.replace(':00', 'h').replace(':', 'h')}` : ''}`
    : null

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block text-[15px] [overflow-wrap:anywhere] hover:underline"
        >
          {item.title}
        </a>
        <span className="mt-1 block text-xs text-ink-soft">
          <span className="font-mono text-[11px] tracking-[0.04em] uppercase">{PROVIDER_LABEL[item.provider]}</span>
          {item.context && ` · ${item.context}`}
          {due && ` · ${due}`}
        </span>
      </div>
      <button
        type="button"
        className="button-outline shrink-0 self-start px-3.5 py-2 text-[13px] sm:self-auto"
        disabled={pull.isPending}
        onClick={() => pull.mutate({ item, areaId: workArea?.id ?? null })}
        title={workArea ? `Vira tarefa em ${workArea.name}` : 'Vira tarefa na Inbox'}
      >
        <Icon name="plus" size={14} /> {pull.isPending ? 'Puxando…' : 'Puxar'}
      </button>
      {pull.error && <p className="text-xs text-alert sm:basis-full">{pull.error.message}</p>}
    </li>
  )
}
