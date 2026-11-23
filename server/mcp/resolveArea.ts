export interface AreaRow {
  id: string
  name: string
  kind: 'work' | 'life'
}

export type AreaMatch = { area: AreaRow } | { error: string }

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/**
 * Acha a área pelo que a pessoa falou: id, nome exato ou começo do nome ("trab" → Trabalho),
 * sem ligar pra acento nem maiúscula. "trabalho"/"work" sem área com esse nome cai na única
 * área de trabalho, se houver só uma.
 */
export function resolveArea(areas: AreaRow[], query: string): AreaMatch {
  const wanted = normalize(query)
  const available = areas.map((area) => area.name).join(', ') || 'nenhuma'
  if (!wanted) return { error: `Área vazia. Áreas disponíveis: ${available}.` }

  const byId = areas.find((area) => area.id === query.trim())
  if (byId) return { area: byId }

  const exact = areas.filter((area) => normalize(area.name) === wanted)
  if (exact.length === 1) return { area: exact[0] }

  const prefixed = areas.filter((area) => normalize(area.name).startsWith(wanted))
  if (prefixed.length === 1) return { area: prefixed[0] }
  if (prefixed.length > 1)
    return { error: `"${query}" combina com mais de uma área: ${prefixed.map((area) => area.name).join(', ')}.` }

  if (['trabalho', 'work', 'trampo', 'servico'].includes(wanted)) {
    const work = areas.filter((area) => area.kind === 'work')
    if (work.length === 1) return { area: work[0] }
  }

  return { error: `Não achei a área "${query}". Áreas disponíveis: ${available}.` }
}
