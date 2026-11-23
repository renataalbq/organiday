import type { ReactNode } from 'react'

interface CardProps {
  title: ReactNode
  /** texto ou botão à direita do título */
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, action, className = '', children }: CardProps) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <header className="mb-4 flex min-h-8 items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
