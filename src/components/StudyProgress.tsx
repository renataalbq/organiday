const MAX_SEGMENTS = 24

/** Progresso em blocos (um por aula/capítulo) quando cabe; barra contínua quando são muitos. */
export function StudyProgress({
  progress,
  total,
  label,
  numbered = false,
}: {
  progress: number
  total: number
  label: string
  numbered?: boolean
}) {
  const percent = Math.round((progress / total) * 100)
  const common = {
    role: 'progressbar',
    'aria-valuenow': percent,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-label': label,
  } as const

  if (total > MAX_SEGMENTS) {
    return (
      <div {...common} className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    )
  }

  return (
    <div
      {...common}
      className={`grid gap-1.5 ${numbered ? 'gap-2' : ''}`}
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`grid place-items-center rounded-md text-xs transition-colors ${
            numbered ? 'h-10' : 'h-1.5 rounded-full'
          } ${index < progress ? 'bg-accent text-white' : 'bg-muted text-ink-soft'}`}
        >
          {numbered ? index + 1 : null}
        </span>
      ))}
    </div>
  )
}
