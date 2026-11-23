import { useState } from 'react'
import type { DailySummary } from '../lib/daily/buildDailySummary'
import type { Task } from '../types'
import { Card } from './Card'
import { Icon } from './Icon'

interface DailySummaryCardProps {
  summary: DailySummary
  onOpenTask: (task: Task) => void
  className?: string
}

/** Já fiz, vou fazer e impedimentos. Fica à mão pra daily, 1:1 ou qualquer reunião. */
export function DailySummaryCard({ summary, onOpenTask, className = '' }: DailySummaryCardProps) {
  const [copied, setCopied] = useState(false)

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(summary.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const impediments = [
    ...summary.blocked.map((task) => ({ task, text: `${task.title} (${task.blocked_reason})` })),
    ...summary.blockers.map((task) => ({ task, text: `decidir: ${task.title}` })),
  ]

  return (
    <Card
      title="Resumo do dia"
      className={className}
      action={
        <button type="button" onClick={copyText} className="button-outline px-3 py-2 text-[13px]">
          <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copiado' : 'Copiar'}
        </button>
      }
    >
      <p className="-mt-2 mb-4 text-xs text-ink-soft">
        Pra daily ou qualquer reunião. Só tarefas de áreas de trabalho.
      </p>

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
        <Column
          title={`Já fiz · ${summary.doneLabel}`}
          tasks={summary.done}
          empty="nada concluído"
          onOpen={onOpenTask}
        />
        <Column
          title={`Vou fazer · ${summary.planLabel}`}
          tasks={summary.plan}
          empty="nada planejado"
          onOpen={onOpenTask}
        />
      </div>

      <div className="mt-5 border-t border-line pt-4 text-[13px]">
        {impediments.length === 0 ? (
          <p className="text-ink-soft">
            Impedimentos: nenhum.{' '}
            <span className="text-ink-faint">
              Marque uma tarefa como bloqueada no formulário pra ela aparecer aqui.
            </span>
          </p>
        ) : (
          <>
            <p className="mb-1.5 font-medium text-ink">Impedimentos</p>
            <ul className="space-y-1">
              {impediments.map(({ task, text }) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="inline-flex items-start gap-1.5 text-left text-peach-ink hover:underline"
                  >
                    <Icon name="lock" size={13} className="mt-0.5" />
                    <span className="[overflow-wrap:anywhere]">{text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  )
}

function Column({
  title,
  tasks,
  empty,
  onOpen,
}: {
  title: string
  tasks: Task[]
  empty: string
  onOpen: (task: Task) => void
}) {
  return (
    <div className="min-w-0">
      <h3 className="eyebrow mb-2">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-[13px] text-ink-faint">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task)}
                className="text-left text-[13px] leading-snug text-ink [overflow-wrap:anywhere] hover:text-accent"
              >
                {task.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
