import { useUpdateStudy } from '../data/studies'
import { daysFromToday, formatRelativeDate } from '../lib/dates'
import type { Study } from '../types'
import { Icon } from './Icon'

interface StudyRowProps {
  study: Study
  onOpen: (study: Study) => void
}

/** Quanto falta por semana para terminar no prazo. */
function paceHint(study: Study): string | null {
  if (!study.target_date || study.status !== 'active') return null
  const days = daysFromToday(study.target_date)
  const remaining = study.total - study.progress
  if (days < 0) return `prazo passou (${formatRelativeDate(study.target_date)})`
  const weeks = Math.max(days / 7, 1)
  return `até ${formatRelativeDate(study.target_date)}, ~${Math.ceil(remaining / weeks)} ${study.unit_label}/semana`
}

export function StudyRow({ study, onOpen }: StudyRowProps) {
  const updateStudy = useUpdateStudy()
  const percent = Math.round((study.progress / study.total) * 100)
  const hint = paceHint(study)

  const step = (delta: number) => {
    const progress = Math.min(Math.max(study.progress + delta, 0), study.total)
    updateStudy.mutate({
      id: study.id,
      changes: {
        progress,
        status: progress === study.total ? 'done' : study.status === 'done' ? 'active' : study.status,
      },
    })
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <button type="button" onClick={() => onOpen(study)} className="col-start-1 row-start-1 min-w-0 text-left">
        <span className="block truncate text-[15px] font-semibold">{study.title}</span>
        <span className="block truncate text-xs text-ink-soft">
          {hint ?? (study.status === 'paused' ? 'pausado' : study.status === 'done' ? 'concluído' : 'sem prazo')}
        </span>
      </button>

      <div className="col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <div className="mb-1 flex justify-between gap-2 text-xs font-semibold text-ink-soft">
          <span>
            {study.progress} / {study.total} {study.unit_label}
          </span>
          <span>{percent}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-mint"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={study.title}
        >
          <div
            className="h-full rounded-full bg-moss transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="col-start-2 row-start-1 flex gap-1 sm:col-start-3">
        <button
          type="button"
          onClick={() => step(-1)}
          className="button-quiet size-8 p-0"
          aria-label={`Voltar 1 em ${study.title}`}
          disabled={study.progress === 0}
        >
          <Icon name="minus" size={16} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className="grid size-8 place-items-center rounded-full bg-mint text-moss-deep hover:bg-mint-deep"
          aria-label={`Avançar 1 em ${study.title}`}
          disabled={study.progress === study.total}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}
