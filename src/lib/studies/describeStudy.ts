import { daysFromToday } from '../dates.ts'
import type { Study } from '../../types.ts'

/** "aulas" → "aula", "capítulos" → "capítulo", "lições" → "lição" */
export function singularUnit(unitLabel: string): string {
  const unit = unitLabel.trim()
  if (/ões$/.test(unit)) return unit.replace(/ões$/, 'ão')
  if (/is$/.test(unit)) return unit.replace(/is$/, 'l')
  if (/s$/.test(unit)) return unit.slice(0, -1)
  return unit
}

/** Tipo do estudo pela unidade: aulas e módulos são curso; capítulos e páginas, livro. */
export function studyKindLabel(unitLabel: string): string {
  const unit = unitLabel.toLowerCase()
  if (/aula|m[oó]dulo|v[ií]deo/.test(unit)) return 'Curso'
  if (/cap[ií]tulo|p[aá]gina/.test(unit)) return 'Livro'
  return 'Estudo'
}

/** Quanto precisa fazer por semana pra terminar no prazo; null sem prazo ou se o prazo já passou. */
export function weeklyPace(study: Study, today: Date = new Date()): number | null {
  if (!study.target_date || study.status === 'done') return null
  const days = daysFromToday(study.target_date, today)
  if (days < 0) return null
  const remaining = study.total - study.progress
  return Math.ceil(remaining / Math.max(days / 7, 1))
}
