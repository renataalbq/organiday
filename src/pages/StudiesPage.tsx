import { useState } from 'react'
import { Icon } from '../components/Icon'
import { STUDY_STATUS_LABEL, StudyEditor } from '../components/StudyEditor'
import { StudyRow } from '../components/StudyRow'
import { useStudies } from '../data/studies'
import type { Study, StudyStatus } from '../types'

const SECTION_ORDER: StudyStatus[] = ['active', 'paused', 'done']

export function StudiesPage() {
  const { data: studies = [], isLoading } = useStudies()
  const [editing, setEditing] = useState<Study | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-tight">Estudos</h1>
          <p className="text-sm text-navy-soft">
            Cursos, livros e certificações em andamento. Use o + para avançar uma aula.
          </p>
        </div>
        <button type="button" className="button-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Novo estudo
        </button>
      </header>

      {isLoading ? (
        <p className="text-navy-soft">Carregando…</p>
      ) : studies.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="w-full rounded-[var(--radius-card)] border border-dashed border-line bg-card p-6 text-left text-navy-soft hover:border-blue"
        >
          Nada por aqui ainda. Cadastre o que você está estudando para ver o progresso e quanto falta por semana.
        </button>
      ) : (
        SECTION_ORDER.map((status) => {
          const items = studies.filter((study) => study.status === status)
          if (items.length === 0) return null
          return (
            <section key={status} className="rounded-[var(--radius-card)] border border-line bg-card px-4 py-3 sm:px-5">
              <h2 className="eyebrow mb-1">{STUDY_STATUS_LABEL[status]}</h2>
              <div className="divide-y divide-line">
                {items.map((study) => (
                  <StudyRow key={study.id} study={study} onOpen={setEditing} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {editing && <StudyEditor study={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
