import type { ReactNode } from 'react'

const TONE_CLASSES = {
  plain: 'bg-card border border-line',
  butter: 'bg-butter',
  sky: 'bg-sky',
  blue: 'bg-blue text-blue-ink',
} as const

interface CardProps {
  title: string
  tone?: keyof typeof TONE_CLASSES
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, tone = 'plain', action, className = '', children }: CardProps) {
  return (
    <section className={`rounded-[var(--radius-card)] p-4 sm:p-5 ${TONE_CLASSES[tone]} ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold tracking-tight">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
