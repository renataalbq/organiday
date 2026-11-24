import { useState, type FormEvent } from 'react'
import { useAreas } from '../data/areas'
import {
  useCalendarFeeds,
  useCalendarMeetings,
  useCreateCalendarFeed,
  useDeleteCalendarFeed,
  useUpdateCalendarFeed,
} from '../data/calendar'
import { useNow } from '../hooks/useNow'
import type { CalendarFeed } from '../types'
import { Icon } from './Icon'

const FEED_COLORS = ['#5B4CDB', '#1E8A85', '#C2416B', '#B97A1C', '#4F6FA8']
const VALID_URL = /^(https|webcal):\/\/\S+$/i

/** Ajustes → Calendários: conecta agendas por link .ics (Google, Outlook, Apple…). */
export function CalendarSettings() {
  const { todayISO } = useNow()
  const { feeds, isLoading, isTableMissing, error } = useCalendarFeeds()
  const { errorsByFeed, isFetching, error: eventsError } = useCalendarMeetings(todayISO)
  const [isAdding, setIsAdding] = useState(false)

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Calendários</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Conecte uma agenda pelo link .ics e as reuniões aparecem no Hoje e na Semana, entrando na conta do tempo
            livre. É só leitura: o Organiday não altera nada na sua agenda.
          </p>
        </div>
        {!isTableMissing && (
          <button
            type="button"
            onClick={() => setIsAdding((value) => !value)}
            className="button-outline shrink-0 px-3 py-2 text-[13px]"
          >
            {isAdding ? 'Cancelar' : '+ Conectar'}
          </button>
        )}
      </div>

      <p className="mt-4 flex gap-2 rounded-xl bg-peach p-3 text-[13px] text-peach-ink">
        <Icon name="alert" size={15} className="mt-0.5" />
        <span>
          <strong className="font-semibold">Agenda da empresa?</strong> Muitas empresas não permitem compartilhar a
          agenda com apps externos. Confira a política com o time de TI antes de conectar.
        </span>
      </p>

      {isTableMissing ? (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-ink-soft">
          Pra ativar, rode <code className="rounded bg-card px-1">supabase/migrations/0005_calendar_feeds.sql</code> no
          SQL Editor do Supabase e recarregue a página.
        </p>
      ) : error ? (
        <p className="mt-4 text-sm font-medium text-alert">Não deu pra carregar seus calendários.</p>
      ) : (
        <>
          {isAdding && <AddFeedForm feedCount={feeds.length} onDone={() => setIsAdding(false)} />}

          {!isLoading && feeds.length === 0 && !isAdding && (
            <p className="mt-4 text-sm text-ink-faint">Nenhum calendário conectado.</p>
          )}

          {feeds.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {feeds.map((feed) => (
                <FeedRow key={feed.id} feed={feed} error={errorsByFeed.get(feed.id) ?? null} />
              ))}
            </ul>
          )}

          {feeds.length > 0 && eventsError && <p className="mt-3 text-sm text-alert">{eventsError.message}</p>}
          {feeds.length > 0 && isFetching && <p className="mt-3 text-xs text-ink-faint">Atualizando agendas…</p>}
        </>
      )}

      <HowToGetLink />
    </section>
  )
}

function AddFeedForm({ feedCount, onDone }: { feedCount: number; onDone: () => void }) {
  const { areas } = useAreas()
  const createFeed = useCreateCalendarFeed()
  const workArea = areas.find((area) => area.kind === 'work')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [areaId, setAreaId] = useState<string>(workArea?.id ?? '')
  const isUrlValid = VALID_URL.test(url.trim())

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !isUrlValid) return
    await createFeed.mutateAsync({
      name: name.trim(),
      url: url.trim(),
      area_id: areaId || null,
      color: FEED_COLORS[feedCount % FEED_COLORS.length],
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
      <label className="min-w-0">
        <span className="label">Nome</span>
        <input
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Agenda pessoal"
          maxLength={60}
          required
        />
      </label>
      <label className="min-w-0">
        <span className="label">As reuniões contam como</span>
        <select className="field" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
          <option value="">Sem área</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 sm:col-span-2">
        <span className="label">Link secreto .ics</span>
        <input
          className="field"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          aria-invalid={url.trim() !== '' && !isUrlValid}
          required
        />
        {url.trim() !== '' && !isUrlValid && (
          <span className="mt-1.5 block text-sm text-alert">O link precisa começar com https:// ou webcal://.</span>
        )}
      </label>
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p className="text-xs text-ink-faint">Trate esse link como senha: quem tem o link vê a agenda.</p>
        <button
          type="submit"
          className="button-primary shrink-0"
          disabled={!name.trim() || !isUrlValid || createFeed.isPending}
        >
          {createFeed.isPending ? 'Conectando…' : 'Conectar'}
        </button>
      </div>
      {createFeed.error && (
        <p className="text-sm text-alert sm:col-span-2">Não deu pra salvar: {createFeed.error.message}</p>
      )}
    </form>
  )
}

function FeedRow({ feed, error }: { feed: CalendarFeed; error: string | null }) {
  const { areas } = useAreas()
  const updateFeed = useUpdateCalendarFeed()
  const deleteFeed = useDeleteCalendarFeed()
  const host = (() => {
    try {
      return new URL(feed.url.replace(/^webcal:/i, 'https:')).hostname
    } catch {
      return feed.url
    }
  })()

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: feed.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{feed.name}</p>
        <p className="truncate text-xs text-ink-faint">{host}</p>
        {error && (
          <p className="mt-1 flex items-start gap-1 text-xs text-alert">
            <Icon name="alert" size={12} className="mt-0.5" /> {error}
          </p>
        )}
      </div>
      <select
        className="field w-auto py-1.5 text-sm"
        aria-label={`Área das reuniões de ${feed.name}`}
        value={feed.area_id ?? ''}
        onChange={(event) => updateFeed.mutate({ id: feed.id, changes: { area_id: event.target.value || null } })}
      >
        <option value="">Sem área</option>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Desconectar "${feed.name}"? As reuniões dele somem do Organiday.`))
            deleteFeed.mutate(feed.id)
        }}
        className="grid size-9 place-items-center rounded-lg text-ink-faint hover:bg-hover-strong hover:text-alert"
        aria-label={`Desconectar ${feed.name}`}
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  )
}

function HowToGetLink() {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium text-ink-soft hover:text-ink">Como pegar o link .ics</summary>
      <div className="mt-3 space-y-3 text-ink-soft">
        <div>
          <p className="font-medium text-ink">Google Agenda</p>
          <p>
            No computador: Configurações → em “Configurações das minhas agendas”, clique na agenda → Integrar agenda →
            copie o <strong>Endereço secreto no formato iCal</strong>.
          </p>
        </div>
        <div>
          <p className="font-medium text-ink">Outlook / Microsoft 365</p>
          <p>
            No Outlook na web: Configurações → Calendário → Calendários compartilhados → em “Publicar um calendário”,
            escolha a agenda e “Pode exibir todos os detalhes” → Publicar → copie o <strong>link ICS</strong>.
          </p>
        </div>
        <div>
          <p className="font-medium text-ink">Apple / iCloud</p>
          <p>No app Calendário do iCloud: compartilhe a agenda como “Calendário público” e copie o link (webcal://).</p>
        </div>
        <p className="text-xs text-ink-faint">
          As mudanças na agenda aparecem aqui em alguns minutos. O Google pode levar algumas horas pra atualizar o link
          .ics.
        </p>
      </div>
    </details>
  )
}
