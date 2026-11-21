import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { useAreas, useCreateArea, useDeleteArea, useUpdateArea } from '../data/areas'
import { useSaveSettings, useSettings } from '../data/settings'
import { signOut } from '../auth/SessionProvider'
import type { Area, UserSettings } from '../types'

const AREA_COLORS = ['#4F6FA8', '#C8577A', '#3D8C6E', '#C48A1A', '#7A5BB5', '#2F8FA3', '#B8463A', '#6B7280']

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-tight">Ajustes</h1>
      <WorkdaySettings />
      <AreasSettings />
      <button type="button" onClick={() => signOut()} className="button-quiet -ml-3">
        <Icon name="logout" size={16} /> Sair da conta
      </button>
    </div>
  )
}

function WorkdaySettings() {
  const { settings, isLoading } = useSettings()
  const saveSettings = useSaveSettings()
  const [draft, setDraft] = useState<UserSettings>(settings)
  const [hasLunch, setHasLunch] = useState(Boolean(settings.lunch_start))
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft(settings)
    setHasLunch(Boolean(settings.lunch_start))
  }, [settings])

  const set = <Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.workday_start >= draft.workday_end) return setMessage('O fim do expediente precisa ser depois do início.')
    if (hasLunch && (!draft.lunch_start || !draft.lunch_end || draft.lunch_start >= draft.lunch_end)) {
      return setMessage('Confira o horário do almoço.')
    }
    try {
      await saveSettings.mutateAsync({
        ...draft,
        display_name: draft.display_name?.trim() || null,
        lunch_start: hasLunch ? draft.lunch_start : null,
        lunch_end: hasLunch ? draft.lunch_end : null,
      })
      setMessage('Ajustes salvos.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não deu pra salvar.')
    }
  }

  if (isLoading) return null

  return (
    <form onSubmit={handleSubmit} className="rounded-[var(--radius-card)] border border-line bg-card p-4 sm:p-5">
      <h2 className="mb-1 font-display text-[17px] font-bold">Você e seu expediente</h2>
      <p className="mb-4 text-sm text-ink-soft">
        Usado para calcular quanto tempo livre sobra entre as reuniões em dias úteis.
      </p>
      <div className="grid max-w-xl grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className="label">Como te chamar</span>
          <input
            className="field"
            value={draft.display_name ?? ''}
            onChange={(event) => set('display_name', event.target.value)}
            placeholder="Seu nome"
          />
        </label>
        <label>
          <span className="label">Início do expediente</span>
          <input
            type="time"
            className="field"
            value={draft.workday_start}
            onChange={(event) => set('workday_start', event.target.value)}
            required
          />
        </label>
        <label>
          <span className="label">Fim do expediente</span>
          <input
            type="time"
            className="field"
            value={draft.workday_end}
            onChange={(event) => set('workday_end', event.target.value)}
            required
          />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={hasLunch}
            onChange={(event) => setHasLunch(event.target.checked)}
            className="size-4 accent-[var(--color-lilac-deep)]"
          />
          Descontar almoço
        </label>
        {hasLunch && (
          <>
            <label>
              <span className="label">Almoço começa</span>
              <input
                type="time"
                className="field"
                value={draft.lunch_start ?? '12:00'}
                onChange={(event) => set('lunch_start', event.target.value)}
              />
            </label>
            <label>
              <span className="label">Almoço termina</span>
              <input
                type="time"
                className="field"
                value={draft.lunch_end ?? '13:00'}
                onChange={(event) => set('lunch_end', event.target.value)}
              />
            </label>
          </>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="button-primary" disabled={saveSettings.isPending}>
          Salvar ajustes
        </button>
        {message && <span className="text-sm text-ink-soft">{message}</span>}
      </div>
    </form>
  )
}

function AreasSettings() {
  const { areas } = useAreas()
  const createArea = useCreateArea()
  const [newName, setNewName] = useState('')

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    if (!newName.trim()) return
    createArea.mutate({
      name: newName.trim(),
      color: AREA_COLORS[areas.length % AREA_COLORS.length],
      kind: 'life',
      position: areas.length,
    })
    setNewName('')
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-card p-4 sm:p-5">
      <h2 className="mb-1 font-display text-[17px] font-bold">Áreas</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Áreas marcadas como trabalho entram na conta do expediente e ganham peso em dias úteis. Ao excluir uma área, as
        tarefas dela vão pra Inbox.
      </p>
      <ul className="divide-y divide-line">
        {areas.map((area) => (
          <AreaRow key={area.id} area={area} />
        ))}
      </ul>
      <form onSubmit={handleCreate} className="mt-3 flex max-w-md gap-2">
        <input
          className="field"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nova área, ex.: Saúde"
          maxLength={40}
        />
        <button type="submit" className="button-primary shrink-0" disabled={!newName.trim()}>
          Criar área
        </button>
      </form>
    </section>
  )
}

function AreaRow({ area }: { area: Area }) {
  const updateArea = useUpdateArea()
  const deleteArea = useDeleteArea()
  const [name, setName] = useState(area.name)

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== area.name) updateArea.mutate({ id: area.id, changes: { name: trimmed } })
    else setName(area.name)
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="flex gap-1" role="radiogroup" aria-label={`Cor de ${area.name}`}>
        {AREA_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={area.color.toLowerCase() === color.toLowerCase()}
            aria-label={color}
            onClick={() => updateArea.mutate({ id: area.id, changes: { color } })}
            className={`size-5 rounded-full ${area.color.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <input
        className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-semibold outline-none focus:bg-paper"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
        aria-label="Nome da área"
      />
      <label className="flex items-center gap-1.5 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={area.kind === 'work'}
          onChange={(event) =>
            updateArea.mutate({ id: area.id, changes: { kind: event.target.checked ? 'work' : 'life' } })
          }
          className="size-4 accent-[var(--color-lilac-deep)]"
        />
        é trabalho
      </label>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Excluir a área "${area.name}"? As tarefas dela vão pra Inbox.`))
            deleteArea.mutate(area.id)
        }}
        className="button-quiet p-2 text-ink-faint hover:text-alert"
        aria-label={`Excluir ${area.name}`}
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  )
}
