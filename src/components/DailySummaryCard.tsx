import { useEffect, useState } from 'react'
import type { DailySummary } from '../lib/daily/buildDailySummary'
import { Card } from './Card'
import { Icon } from './Icon'

const storageKey = (summary: DailySummary) => `tidy:daily:${summary.doneDate}:${summary.planLabel}`

function readSavedText(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSavedText(key: string, text: string | null) {
  try {
    if (text === null) localStorage.removeItem(key)
    else localStorage.setItem(key, text)
  } catch {
    // armazenamento indisponível (aba anônima etc.): a edição só vale até recarregar
  }
}

/** Resumo pronto pra falar na daily. Dá pra editar à vontade; a edição fica salva neste aparelho. */
export function DailySummaryCard({ summary, className = '' }: { summary: DailySummary; className?: string }) {
  const key = storageKey(summary)
  const [editedText, setEditedText] = useState<string | null>(() => readSavedText(key))
  const [copied, setCopied] = useState(false)

  useEffect(() => setEditedText(readSavedText(key)), [key])

  const text = editedText ?? summary.text

  const updateText = (value: string) => {
    setEditedText(value)
    writeSavedText(key, value)
  }

  const resetText = () => {
    setEditedText(null)
    writeSavedText(key, null)
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card
      title="Pra daily"
      className={className}
      action={
        <div className="-my-2 -mr-2 flex items-center gap-1">
          {editedText !== null && (
            <button type="button" onClick={resetText} className="button-quiet" title="Voltar ao texto gerado">
              Refazer
            </button>
          )}
          <button type="button" onClick={copyText} className="button-quiet text-lilac-deep">
            <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      }
    >
      <p className="mb-2 text-xs text-ink-soft">
        {summary.doneLabel === 'Hoje'
          ? `O que você fez hoje e o plano de ${summary.planLabel.toLowerCase()}. Atualiza sozinho conforme você marca tarefas de trabalho.`
          : `O que você fez ${summary.doneLabel === 'Ontem' ? 'ontem' : `na ${summary.doneLabel.toLowerCase()}`} e o plano de ${summary.planLabel.toLowerCase()}.`}
      </p>
      <textarea
        value={text}
        onChange={(event) => updateText(event.target.value)}
        rows={Math.min(Math.max(text.split('\n').length, 6), 14)}
        aria-label="Texto para a daily"
        className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-lilac-deep"
      />
    </Card>
  )
}
