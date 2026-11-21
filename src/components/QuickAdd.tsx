import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAreas } from '../data/areas'
import { useCreateTask } from '../data/tasks'
import { DEFAULT_MEETING_MINUTES } from '../lib/dayBudget/dayBudget'
import { parseQuickAdd, type QuickAddTokenKind } from '../lib/quickAdd/parseQuickAdd'
import { Icon } from './Icon'

const TOKEN_CLASSES: Record<QuickAddTokenKind, string> = {
  kind: 'bg-peach text-peach-ink',
  area: 'bg-mint text-lilac-deep',
  unknownArea: 'bg-alert-soft text-alert',
  priority: 'bg-alert-soft text-alert',
  date: 'bg-mint text-lilac-deep',
  time: 'bg-mint text-lilac-deep',
  recurrence: 'bg-mint text-lilac-deep',
  duration: 'bg-canvas text-ink-soft',
}

const SYNTAX_HELP: Array<[string, string]> = [
  ['#casa', 'área (o começo do nome basta)'],
  ['!  !!  !baixa', 'prioridade alta, urgente, baixa'],
  ['amanhã, sexta, dia 25, 30/11', 'data'],
  ['15h, 9h30, às 8 da noite', 'horário'],
  ['todo dia, dias úteis, toda segunda, todo dia 10', 'repetir'],
  ['~30m  ~1h', 'quanto tempo leva'],
  ['termina com ?', 'vira uma decisão'],
  ['reunião / call / daily + horário', 'vira uma reunião'],
]

export function QuickAdd() {
  const { areas } = useAreas()
  const createTask = useCreateTask()
  const [text, setText] = useState('')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, areas) : null), [text, areas])

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', focusOnSlash)
    return () => window.removeEventListener('keydown', focusOnSlash)
  }, [])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!parsed?.title) return
    createTask.mutate({
      kind: parsed.kind,
      title: parsed.title,
      area_id: parsed.areaId,
      priority: parsed.priority ?? 2,
      due_date: parsed.dueDate,
      due_time: parsed.dueTime,
      duration_minutes: parsed.durationMinutes ?? (parsed.kind === 'meeting' ? DEFAULT_MEETING_MINUTES : null),
      recurrence: parsed.recurrence,
    })
    setText('')
  }

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pr-1.5 pl-4 focus-within:border-lilac"
      >
        <Icon name="plus" className="text-ink-faint" />
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ex.: pagar luz sexta 10h #casa"
          aria-label="Adicionar rapidamente"
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={() => setIsHelpOpen((open) => !open)}
          className="button-quiet p-1.5"
          aria-label="Como escrever"
          aria-expanded={isHelpOpen}
        >
          <Icon name="question" />
        </button>
        <button type="submit" className="button-primary px-3 py-1.5" disabled={!parsed?.title}>
          Adicionar
        </button>
      </form>

      {parsed && (parsed.tokens.length > 0 || parsed.title) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-2 text-xs">
          <span className="font-semibold text-ink">{parsed.title || 'Sem título ainda'}</span>
          {parsed.tokens.map((token) => (
            <span key={token.kind + token.label} className={`chip ${TOKEN_CLASSES[token.kind]}`}>
              {token.label}
            </span>
          ))}
        </div>
      )}

      {isHelpOpen && (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-2xl border border-line bg-card p-4 shadow-lg">
          <p className="mb-2 text-sm font-semibold">Escreva do seu jeito e use estes atalhos:</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {SYNTAX_HELP.map(([example, meaning]) => (
              <div key={example} className="contents">
                <dt className="font-semibold text-lilac-deep">{example}</dt>
                <dd className="text-ink-soft">{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-ink-faint">Dica: aperte / em qualquer tela para começar a digitar.</p>
        </div>
      )}
    </div>
  )
}
