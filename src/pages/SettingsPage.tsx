import { useEffect, useRef, useState, type FormEvent } from 'react'
import { signOut, useSession } from '../auth/SessionProvider'
import { CalendarSettings } from '../components/CalendarSettings'
import { Icon } from '../components/Icon'
import { IntegrationSettings } from '../components/IntegrationSettings'
import { PageHeader } from '../components/PageHeader'
import { useAreas, useCreateArea, useDeleteArea, useUpdateArea } from '../data/areas'
import { useSaveSettings, useSettings } from '../data/settings'
import { useThemePreference } from '../hooks/useTheme'
import { isAreaNameTaken } from '../lib/areas/isAreaNameTaken'
import { formatDuration, minutesToClock, timeToMinutes } from '../lib/dayBudget/dayBudget'
import type { ThemePreference } from '../lib/theme'
import type { Area, UserSettings } from '../types'

const AREA_COLORS = ['#5B4CDB', '#C2416B', '#1E8A85', '#B97A1C', '#3D8C6E', '#4F6FA8', '#B8463A', '#6B7280']

export function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Seu expediente, suas áreas e sua conta" title="Ajustes" />
      <div className="space-y-6">
        <WorkdaySettings />
        <AreasSettings />
        <CalendarSettings />
        <IntegrationSettings />
        <AppearanceSettings />
        <AccountSettings />
      </div>
    </div>
  )
}

function WorkdaySettings() {
  const { settings, isLoading } = useSettings()
  const saveSettings = useSaveSettings()
  const [draft, setDraft] = useState<UserSettings>(settings)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const set = <Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setMessage(null)
  }

  const hasLunch = Boolean(draft.lunch_start && draft.lunch_end)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.workday_start >= draft.workday_end) return setMessage('O fim do expediente precisa ser depois do início.')
    if (Boolean(draft.lunch_start) !== Boolean(draft.lunch_end))
      return setMessage('Preencha os dois horários do almoço, ou nenhum.')
    if (hasLunch && draft.lunch_start! >= draft.lunch_end!) return setMessage('Confira o horário do almoço.')
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
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6">
      <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Você e seu expediente</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Usado pra calcular quanto tempo livre sobra entre as reuniões em dias úteis.
      </p>

      <label className="mt-5 block max-w-md">
        <span className="label">Como te chamar</span>
        <input
          className="field"
          value={draft.display_name ?? ''}
          onChange={(event) => set('display_name', event.target.value)}
          placeholder="Seu nome"
          maxLength={40}
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <TimeField
          label="Começa"
          value={draft.workday_start}
          onChange={(value) => set('workday_start', value)}
          required
        />
        <TimeField label="Termina" value={draft.workday_end} onChange={(value) => set('workday_end', value)} required />
        <TimeField
          label="Almoço de"
          value={draft.lunch_start ?? ''}
          onChange={(value) => set('lunch_start', value || null)}
        />
        <TimeField label="até" value={draft.lunch_end ?? ''} onChange={(value) => set('lunch_end', value || null)} />
      </div>

      <WorkdayPreview settings={draft} />

      <div className="mt-5 flex items-center justify-end gap-3">
        {message && <span className="text-sm text-ink-soft">{message}</span>}
        <button type="submit" className="button-primary px-5" disabled={saveSettings.isPending}>
          Salvar
        </button>
      </div>
    </form>
  )
}

function TimeField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="min-w-0">
      <span className="label">{label}</span>
      <input
        type="time"
        className="field"
        value={value.slice(0, 5)}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}

/** Régua do expediente com o almoço, pra conferir de olho. */
function WorkdayPreview({ settings }: { settings: UserSettings }) {
  if (!settings.workday_start || !settings.workday_end) return null
  const start = timeToMinutes(settings.workday_start)
  const end = timeToMinutes(settings.workday_end)
  if (end <= start) return null

  const lunch =
    settings.lunch_start && settings.lunch_end
      ? [timeToMinutes(settings.lunch_start), timeToMinutes(settings.lunch_end)]
      : null
  const lunchInside = lunch && lunch[0] > start && lunch[1] < end && lunch[0] < lunch[1] ? lunch : null
  const lunchMinutes = lunchInside ? lunchInside[1] - lunchInside[0] : 0
  const toPercent = (minute: number) => `${((minute - start) / (end - start)) * 100}%`

  return (
    <div className="mt-5">
      <div className="relative h-7 overflow-hidden rounded-md bg-accent-soft">
        {lunchInside && (
          <div
            className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgba(91,76,219,.18)_0_4px,transparent_4px_9px)]"
            style={{
              left: toPercent(lunchInside[0]),
              width: `calc(${toPercent(lunchInside[1])} - ${toPercent(lunchInside[0])})`,
            }}
            title="Almoço"
          />
        )}
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-ink-soft">
        <span>{minutesToClock(start)}</span>
        <span className="text-center">
          {formatDuration(end - start - lunchMinutes)} úteis por dia
          {lunchInside ? `, descontando ${formatDuration(lunchMinutes)} de almoço` : ', sem almoço'}
        </span>
        <span>{minutesToClock(end)}</span>
      </div>
    </div>
  )
}

function AreasSettings() {
  const { areas } = useAreas()
  const createArea = useCreateArea()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const isDuplicate = newName.trim() !== '' && isAreaNameTaken(newName, areas)

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    if (!newName.trim() || isDuplicate) return
    createArea.mutate({
      name: newName.trim(),
      color: AREA_COLORS[areas.length % AREA_COLORS.length],
      kind: 'life',
      position: areas.length,
    })
    setNewName('')
    setIsAdding(false)
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Áreas</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Áreas de trabalho entram na conta do expediente. Ao excluir uma, as tarefas dela vão pra Inbox.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding((value) => !value)}
          className="button-outline shrink-0 px-3 py-2 text-[13px]"
        >
          {isAdding ? 'Cancelar' : '+ Nova área'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="mt-4">
          <div className="flex max-w-md gap-2">
            <input
              className="field"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nova área, ex.: Saúde"
              maxLength={40}
              autoFocus
              aria-invalid={isDuplicate}
            />
            <button type="submit" className="button-primary shrink-0" disabled={!newName.trim() || isDuplicate}>
              Criar
            </button>
          </div>
          {isDuplicate && <p className="mt-1.5 text-sm text-alert">Já existe uma área com esse nome.</p>}
        </form>
      )}

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {areas.map((area) => (
          <AreaRow key={area.id} area={area} />
        ))}
      </ul>
    </section>
  )
}

function AreaRow({ area }: { area: Area }) {
  const updateArea = useUpdateArea()
  const deleteArea = useDeleteArea()
  const { areas } = useAreas()
  const [name, setName] = useState(area.name)
  const [isPickingColor, setIsPickingColor] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const isDuplicate = name.trim() !== '' && isAreaNameTaken(name, areas, area.id)

  useEffect(() => {
    if (!isPickingColor) return
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsPickingColor(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [isPickingColor])

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== area.name && !isDuplicate) updateArea.mutate({ id: area.id, changes: { name: trimmed } })
    else setName(area.name)
  }

  const isWork = area.kind === 'work'

  return (
    <li className="flex flex-wrap items-center gap-x-2.5 gap-y-2 py-4 sm:gap-x-4">
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsPickingColor((value) => !value)}
          className="block size-8 shrink-0 rounded-lg ring-offset-2 ring-offset-card hover:ring-2 hover:ring-line-strong"
          style={{ backgroundColor: area.color }}
          aria-label={`Trocar a cor de ${area.name}`}
          aria-expanded={isPickingColor}
        />
        {isPickingColor && (
          <div
            className="absolute top-full left-0 z-20 mt-2 grid grid-cols-4 gap-2 rounded-xl border border-line bg-card p-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,.25)]"
            role="radiogroup"
            aria-label={`Cor de ${area.name}`}
          >
            {AREA_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={area.color.toLowerCase() === color.toLowerCase()}
                aria-label={color}
                onClick={() => {
                  updateArea.mutate({ id: area.id, changes: { color } })
                  setIsPickingColor(false)
                }}
                className={`size-7 rounded-md ${area.color.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>

      <input
        className="min-w-[6rem] flex-1 rounded-lg bg-transparent px-2 py-1.5 text-[15px] outline-none focus:bg-muted"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
        aria-label="Nome da área"
        aria-invalid={isDuplicate}
      />

      <button
        type="button"
        role="switch"
        aria-checked={isWork}
        onClick={() => updateArea.mutate({ id: area.id, changes: { kind: isWork ? 'life' : 'work' } })}
        className="flex shrink-0 items-center gap-2 text-[13px] text-ink-soft sm:gap-2.5"
        aria-label={`${area.name} conta como trabalho`}
      >
        <span className={`relative h-5 w-9 rounded-full transition-colors ${isWork ? 'bg-accent' : 'bg-line-strong'}`}>
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${isWork ? 'left-[18px]' : 'left-0.5'}`}
          />
        </span>
        {/* no celular o texto inteiro espremia o nome da área */}
        <span className="sm:hidden">trabalho</span>
        <span className="hidden sm:inline">conta como trabalho</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Excluir a área "${area.name}"? As tarefas dela vão pra Inbox.`))
            deleteArea.mutate(area.id)
        }}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-hover-strong hover:text-alert"
        aria-label={`Excluir ${area.name}`}
      >
        <Icon name="trash" size={16} />
      </button>
      {isDuplicate && <p className="basis-full text-sm text-alert">Já existe uma área com esse nome.</p>}
    </li>
  )
}

const THEME_OPTIONS: Array<[ThemePreference, string]> = [
  ['system', 'Sistema'],
  ['light', 'Claro'],
  ['dark', 'Escuro'],
]

function AppearanceSettings() {
  const { preference, setPreference } = useThemePreference()

  return (
    <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Aparência</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {preference === 'system' ? 'Segue o modo claro ou escuro do aparelho.' : 'Vale só para este aparelho.'}
        </p>
      </div>
      <div className="segmented" role="group" aria-label="Tema">
        {THEME_OPTIONS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={preference === value} onClick={() => setPreference(value)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

function AccountSettings() {
  const { session } = useSession()
  const provider = session?.user.app_metadata.provider
  const email = session?.user.email

  return (
    <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      <div className="min-w-0">
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Conta</h2>
        <p className="mt-1 text-sm [overflow-wrap:anywhere] text-ink-soft">
          {provider === 'google' ? 'Conectada com Google' : 'Conectada por e-mail'}
          {email && ` · ${email}`}
        </p>
      </div>
      <button type="button" onClick={() => signOut()} className="button-outline text-alert hover:border-alert/40">
        Sair
      </button>
    </section>
  )
}
