import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAreas } from '../data/areas'
import { useCreateTask } from '../data/tasks'
import { DEFAULT_MEETING_MINUTES } from '../lib/dayBudget/dayBudget'
import { fromISODate } from '../lib/dates'
import { parseQuickAdd } from '../lib/quickAdd/parseQuickAdd'
import { Icon } from './Icon'
import { ParsedChips } from './ParsedChips'

const SYNTAX_HELP: Array<[string, string]> = [
  ['#casa', 'área (o começo do nome basta)'],
  ['!  !!  !baixa', 'prioridade alta, urgente, baixa'],
  ['amanhã, sexta, dia 25, 30/11', 'data'],
  ['15h, 9h30, às 8 da noite', 'horário'],
  ['todo dia, dias úteis, toda segunda, todo dia 10', 'repetir'],
  ['~30m  ~1h', 'quanto tempo leva'],
  ['termina com ?', 'vira uma decisão (data e hora depois do ? viram o prazo)'],
  ['reunião / call / daily + horário', 'vira uma reunião'],
]

interface QuickAddProps {
  placeholder?: string
  /** dia de referência (YYYY-MM-DD): "amanhã" conta a partir dele e, sem data no texto, a tarefa cai nele */
  day?: string
}

export function QuickAdd({ placeholder = 'Ex.: pagar luz sexta 10h #casa', day }: QuickAddProps) {
  const { areas } = useAreas()
  const createTask = useCreateTask()
  const [text, setText] = useState('')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, areas, day ? fromISODate(day) : undefined) : null),
    [text, areas, day],
  )

  useEffect(() => {
    const focusOnSlash = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
        return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', focusOnSlash)
    return () => window.removeEventListener('keydown', focusOnSlash)
  }, [])

  useEffect(() => {
    if (!isHelpOpen) return
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setIsHelpOpen(false)
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsHelpOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('pointerdown', closeOnOutside)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [isHelpOpen])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!parsed?.title) return
    createTask.mutate({
      kind: parsed.kind,
      title: parsed.title,
      area_id: parsed.areaId,
      priority: parsed.priority ?? 2,
      due_date: parsed.dueDate ?? day ?? null,
      due_time: parsed.dueTime,
      duration_minutes: parsed.durationMinutes ?? (parsed.kind === 'meeting' ? DEFAULT_MEETING_MINUTES : null),
      recurrence: parsed.recurrence,
    })
    setText('')
    setIsHelpOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-card py-1.5 pr-1.5 pl-4 transition-shadow sm:pl-5 focus-within:shadow-[0_0_0_4px_var(--color-accent-soft)]"
      >
        <Icon name="plus" size={20} className="text-ink" />
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label="Adicionar rapidamente"
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-ink-faint sm:text-[16px]"
        />
        <button
          type="button"
          onClick={() => setIsHelpOpen((open) => !open)}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-hover-strong hover:text-ink"
          aria-label="Como escrever"
          aria-expanded={isHelpOpen}
        >
          <Icon name="question" size={18} />
        </button>
        <button
          type="submit"
          className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-60 sm:px-5"
          disabled={!parsed?.title}
        >
          Adicionar
        </button>
      </form>

      {parsed && (parsed.tokens.length > 0 || parsed.title) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4">
          <span className="min-w-0 text-sm font-medium text-ink [overflow-wrap:anywhere]">
            {parsed.title || 'Sem título ainda'}
          </span>
          <ParsedChips tokens={parsed.tokens} />
        </div>
      )}

      {isHelpOpen && (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-2xl border border-line bg-card p-5 shadow-[0_16px_40px_-16px_rgba(0,0,0,.25)]">
          <p className="mb-3 text-sm font-semibold">Escreva do seu jeito e use estes atalhos:</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
            {SYNTAX_HELP.map(([example, meaning]) => (
              <div key={example} className="contents">
                <dt className="font-medium text-accent">{example}</dt>
                <dd className="text-ink-soft">{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-ink-faint">Dica: aperte / em qualquer tela para começar a digitar.</p>
        </div>
      )}
    </div>
  )
}
