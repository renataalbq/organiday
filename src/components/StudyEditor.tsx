import { useState, type FormEvent } from 'react'
import { useCreateStudy, useDeleteStudy, useUpdateStudy } from '../data/studies'
import type { Study, StudyStatus } from '../types'
import { Icon } from './Icon'
import { prefersAutoFocus } from '../lib/device'
import { Sheet } from './Sheet'

const STATUS_LABEL: Record<StudyStatus, string> = { active: 'Estudando', paused: 'Pausado', done: 'Concluído' }

interface StudyEditorProps {
  study?: Study
  onClose: () => void
}

export function StudyEditor({ study, onClose }: StudyEditorProps) {
  const createStudy = useCreateStudy()
  const updateStudy = useUpdateStudy()
  const deleteStudy = useDeleteStudy()
  const [title, setTitle] = useState(study?.title ?? '')
  const [unitLabel, setUnitLabel] = useState(study?.unit_label ?? 'aulas')
  const [progress, setProgress] = useState(String(study?.progress ?? 0))
  const [total, setTotal] = useState(study ? String(study.total) : '')
  const [targetDate, setTargetDate] = useState(study?.target_date ?? '')
  const [status, setStatus] = useState<StudyStatus>(study?.status ?? 'active')
  const [notes, setNotes] = useState(study?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const totalNumber = Number(total)
    const progressNumber = Number(progress)
    if (!title.trim()) return setError('Dê um nome ao estudo.')
    if (!totalNumber || totalNumber < 1) return setError('Quantas aulas, capítulos ou módulos tem no total?')
    if (progressNumber > totalNumber) return setError('O progresso não pode passar do total.')

    const payload = {
      title: title.trim(),
      unit_label: unitLabel.trim() || 'aulas',
      progress: progressNumber,
      total: totalNumber,
      target_date: targetDate || null,
      status: progressNumber === totalNumber ? 'done' : status,
      notes: notes.trim() || null,
    } as const

    try {
      if (study) await updateStudy.mutateAsync({ id: study.id, changes: payload })
      else await createStudy.mutateAsync(payload)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não deu pra salvar. Tente de novo.')
    }
  }

  return (
    <Sheet
      label={study ? 'Editar estudo' : 'Novo estudo'}
      onClose={onClose}
      onSubmit={handleSubmit}
      header={
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{study ? 'Editar estudo' : 'Novo estudo'}</h2>
          <button type="button" onClick={onClose} className="button-quiet p-2" aria-label="Fechar">
            <Icon name="close" />
          </button>
        </div>
      }
      footer={
        <>
          {error && <p className="mb-2 text-sm font-semibold text-alert">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {study ? (
              <button
                type="button"
                onClick={() => {
                  deleteStudy.mutate(study.id)
                  onClose()
                }}
                className="button-quiet text-alert hover:text-alert"
              >
                <Icon name="trash" size={16} /> Excluir
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="button-quiet">
                Cancelar
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={createStudy.isPending || updateStudy.isPending}
              >
                {study ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 [&>label]:min-w-0">
        <label className="col-span-2">
          <span className="label">O que você está estudando</span>
          <input
            autoFocus={!study && prefersAutoFocus()}
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Curso de TypeScript avançado"
          />
        </label>
        <label>
          <span className="label">Feito</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className="field"
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Total</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            className="field"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="40"
          />
        </label>
        <label>
          <span className="label">Unidade</span>
          <input
            className="field"
            value={unitLabel}
            onChange={(event) => setUnitLabel(event.target.value)}
            list="study-units"
          />
          <datalist id="study-units">
            <option value="aulas" />
            <option value="módulos" />
            <option value="capítulos" />
            <option value="páginas" />
            <option value="horas" />
          </datalist>
        </label>
        <label>
          <span className="label">Terminar até</span>
          <input
            type="date"
            className="field"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>
        {study && (
          <label className="col-span-2">
            <span className="label">Situação</span>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value as StudyStatus)}>
              {(Object.keys(STATUS_LABEL) as StudyStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="col-span-2">
          <span className="label">Notas</span>
          <textarea
            rows={2}
            className="field resize-none"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Link do curso, onde parou…"
          />
        </label>
      </div>
    </Sheet>
  )
}

export { STATUS_LABEL as STUDY_STATUS_LABEL }
