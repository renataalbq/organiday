import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  /** fica à direita no desktop e embaixo do título no celular (ex.: adicionar rápido) */
  aside?: ReactNode
  children?: ReactNode
}

/** Cabeçalho das telas: linha de contexto, título grande e, opcionalmente, o adicionar rápido. */
export function PageHeader({ eyebrow, title, aside, children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:mb-7 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-sm text-ink-soft">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {children}
      </div>
      {aside && <div className="w-full shrink-0 lg:w-[min(100%,620px)]">{aside}</div>}
    </header>
  )
}
