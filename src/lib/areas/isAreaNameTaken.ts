import { normalizeForMatch } from '../quickAdd/parseQuickAdd.ts'
import type { Area } from '../../types.ts'

const comparable = (name: string) => normalizeForMatch(name.trim()).replace(/\s+/g, ' ')

/** Já existe outra área com esse nome, ignorando maiúsculas, acentos e espaços nas pontas. */
export function isAreaNameTaken(name: string, areas: Area[], exceptId?: string): boolean {
  const target = comparable(name)
  return areas.some((area) => area.id !== exceptId && comparable(area.name) === target)
}
