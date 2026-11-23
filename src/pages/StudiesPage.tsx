import { useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { STUDY_STATUS_LABEL, StudyEditor } from '../components/StudyEditor'
import { StudyProgress } from '../components/StudyProgress'
import { useDeleteStudy, useStudies, useUpdateStudy } from '../data/studies'
import { singularUnit, studyKindLabel, weeklyPace } from '../lib/studies/describeStudy'
import type { Study } from '../types'

const MAX_NUMBERED = 12
const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const atNoon = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T12:00:00`)

export function StudiesPage() {
  const { data: studies = [], isLoading } = useStudies()
  const [editing, setEditing] = useState<Study | 'new' | null>(null)

  const active = studies.filter((study) => study.status === 'active')
  const queued = studies.filter((study) => study.status === 'paused')
  const done = studies.filter((study) => study.status === 'done')

  return (
    <div>
      <PageHeader
        eyebrow="Cursos, livros e certificações em andamento"
        title="Estudos"
        aside={
          <div className="flex lg:justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white hover:bg-accent-ink"
              onClick={() => setEditing('new')}
            >
              <Icon name="plus" size={17} /> Novo estudo
            </button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-ink-soft">Carregando…</p>
      ) : (
        <div className="space-y-6">
          {active.length === 0 ? (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="card w-full border-dashed p-6 text-left text-ink-soft hover:border-line-strong"
            >
              Nada em andamento. Cadastre o que você está estudando para ver o progresso e quanto falta por semana.
            </button>
          ) : (
            active.map((study) => <StudyCard key={study.id} study={study} onEdit={() => setEditing(study)} />)
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <SideList
              title="Na fila"
              empty="Guarde aqui o próximo curso ou livro. Ele só começa a contar ritmo quando você der início."
              studies={queued}
              onOpen={setEditing}
              renderMeta={(study) => `${study.total} ${study.unit_label}`}
              action={(study) => <StartButton study={study} />}
            />
            <SideList
              title="Concluídos"
              empty="O que você terminar aparece aqui, com a data de conclusão."
              studies={done}
              onOpen={setEditing}
              renderMeta={(study) =>
                study.updated_at
                  ? `concluído em ${shortDate.format(atNoon(study.updated_at)).replace('.', '')}`
                  : 'concluído'
              }
            />
          </div>
        </div>
      )}

      {editing && <StudyEditor study={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function StudyCard({ study, onEdit }: { study: Study; onEdit: () => void }) {
  const updateStudy = useUpdateStudy()
  const deleteStudy = useDeleteStudy()
  const pace = weeklyPace(study)
  const remaining = study.total - study.progress
  const unit = singularUnit(study.unit_label)

  const step = (delta: number) => {
    const progress = Math.min(Math.max(study.progress + delta, 0), study.total)
    updateStudy.mutate({ id: study.id, changes: { progress, status: progress === study.total ? 'done' : 'active' } })
  }

  const tiles = [
    {
      label: 'Ritmo necessário',
      value: pace !== null ? `~${pace} ${pace === 1 ? unit : study.unit_label}/semana` : '—',
    },
    { label: 'Faltam', value: `${remaining} ${remaining === 1 ? unit : study.unit_label}` },
    {
      label: 'Prazo',
      value: study.target_date ? shortDate.format(atNoon(study.target_date)).replace('.', '') : 'sem prazo',
    },
  ]

  return (
    <article className="card p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.1em] text-accent uppercase">
            {studyKindLabel(study.unit_label)} · {STUDY_STATUS_LABEL[study.status]}
          </p>
          <button type="button" onClick={onEdit} className="mt-1.5 block text-left">
            <h2 className="font-display text-2xl leading-tight font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">
              {study.title}
            </h2>
          </button>
          <p className="mt-1 text-sm text-ink-soft">
            {study.target_date
              ? `Meta: terminar até ${longDate.format(atNoon(study.target_date))}`
              : 'Sem prazo definido'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="grid size-10 place-items-center rounded-lg text-ink-faint hover:bg-hover-strong hover:text-ink"
            aria-label={`Editar ${study.title}`}
          >
            <Icon name="edit" size={17} />
          </button>
          <button
            type="button"
            onClick={() => window.confirm(`Excluir o estudo "${study.title}"?`) && deleteStudy.mutate(study.id)}
            className="grid size-10 place-items-center rounded-lg text-ink-faint hover:bg-hover-strong hover:text-alert"
            aria-label={`Excluir ${study.title}`}
          >
            <Icon name="trash" size={17} />
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            className="icon-button"
            aria-label={`Voltar 1 em ${study.title}`}
            disabled={study.progress === 0}
          >
            <Icon name="minus" size={18} />
          </button>
          <button type="button" onClick={() => step(1)} className="button-dark py-3" disabled={remaining === 0}>
            <Icon name="check" size={16} /> Fiz {unit.endsWith('a') || unit.endsWith('ão') ? 'uma' : 'um'} {unit}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <StudyProgress
          progress={study.progress}
          total={study.total}
          label={study.title}
          numbered={study.total <= MAX_NUMBERED}
        />
        <p className="mt-2.5 text-sm text-ink-soft">
          {study.progress} de {study.total} {study.unit_label}
        </p>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-muted/70 px-4 py-3.5">
            <dt className="text-xs text-ink-soft">{tile.label}</dt>
            <dd className="mt-1 font-display text-xl font-bold tracking-[-0.01em]">{tile.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function StartButton({ study }: { study: Study }) {
  const updateStudy = useUpdateStudy()
  return (
    <button
      type="button"
      onClick={() => updateStudy.mutate({ id: study.id, changes: { status: 'active' } })}
      className="button-outline shrink-0 px-3 py-1.5 text-[13px]"
    >
      Começar
    </button>
  )
}

function SideList({
  title,
  empty,
  studies,
  onOpen,
  renderMeta,
  action,
}: {
  title: string
  empty: string
  studies: Study[]
  onOpen: (study: Study) => void
  renderMeta: (study: Study) => string
  action?: (study: Study) => ReactNode
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border p-5 sm:p-6 ${studies.length === 0 ? 'border-dashed border-line-strong' : 'card'}`}
    >
      <h2 className="font-display text-[17px] font-semibold">{title}</h2>
      {studies.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {studies.map((study) => (
            <li key={study.id} className="flex items-center gap-3 py-3">
              <button type="button" onClick={() => onOpen(study)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[15px]">{study.title}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{renderMeta(study)}</span>
              </button>
              {action?.(study)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
