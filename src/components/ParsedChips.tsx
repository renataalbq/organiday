import type { QuickAddToken, QuickAddTokenKind } from '../lib/quickAdd/parseQuickAdd'

const TOKEN_CLASSES: Record<QuickAddTokenKind, string> = {
  kind: 'bg-accent-soft text-accent-ink',
  area: 'bg-accent-soft text-accent-ink',
  unknownArea: 'bg-alert-soft text-alert',
  priority: 'bg-alert-soft text-alert',
  date: 'bg-accent-soft text-accent-ink',
  time: 'bg-accent-soft text-accent-ink',
  recurrence: 'bg-accent-soft text-accent-ink',
  duration: 'bg-accent-soft text-accent-ink',
}

/** "Entendi: amanhã · 15h · Trabalho" — o que o adicionar rápido tirou do texto. */
export function ParsedChips({ tokens, className = '' }: { tokens: QuickAddToken[]; className?: string }) {
  if (tokens.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-xs ${className}`}>
      <span className="mr-1 text-ink-soft">Entendi:</span>
      {tokens.map((token) => (
        <span
          key={token.kind + token.label}
          className={`rounded-full px-2.5 py-1 font-medium ${TOKEN_CLASSES[token.kind]}`}
        >
          {token.label}
        </span>
      ))}
    </div>
  )
}
