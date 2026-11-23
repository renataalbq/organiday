import { useUpdateStudy } from '../data/studies'
import { formatRelativeDate } from '../lib/dates'
import { weeklyPace } from '../lib/studies/describeStudy'
import type { Study } from '../types'
import { Icon } from './Icon'
import { StudyProgress } from './StudyProgress'

const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

interface StudyRowProps {
  study: Study
  onOpen: (study: Study) => void
}

/** Estudo em andamento, compacto (tela Hoje): progresso e um + pra avançar. */
export function StudyRow({ study, onOpen }: StudyRowProps) {
  const updateStudy = useUpdateStudy()
  const pace = weeklyPace(study)

  const advance = () => {
    const progress = Math.min(study.progress + 1, study.total)
    updateStudy.mutate({
      id: study.id,
      changes: { progress, status: progress === study.total ? 'done' : study.status },
    })
  }

  const deadline = study.target_date
    ? `até ${longDate.format(new Date(`${study.target_date}T12:00:00`)).replace('.', '')}`
    : 'sem prazo'

  return (
    <div className="flex items-center gap-4 py-1">
      <button type="button" onClick={() => onOpen(study)} className="min-w-0 flex-1 text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[15px] text-ink">{study.title}</span>
          <span className="shrink-0 text-sm text-ink-soft tabular-nums">
            {study.progress}/{study.total}
          </span>
        </span>
        <span className="mt-2.5 block">
          <StudyProgress progress={study.progress} total={study.total} label={study.title} />
        </span>
        <span className="mt-2 block truncate text-xs text-ink-soft">
          {deadline}
          {pace !== null && ` · ~${pace} ${study.unit_label} por semana`}
          {study.target_date && pace === null && ` · prazo passou (${formatRelativeDate(study.target_date)})`}
        </span>
      </button>
      <button
        type="button"
        onClick={advance}
        className="icon-button"
        aria-label={`Avançar 1 em ${study.title}`}
        disabled={study.progress === study.total}
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  )
}
