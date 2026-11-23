import { APP_NAME } from '../config'

/** Símbolo do app: o "O" de Organiday como a volta de um dia. */
export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="512" height="512" rx="112" fill="#5B4CDB" />
      <circle cx="256" cy="256" r="128" fill="none" stroke="#FFFFFF" strokeWidth="56" />
      <circle cx="346.5" cy="165.5" r="58" fill="#5B4CDB" />
      <circle cx="346.5" cy="165.5" r="26" fill="#FFFFFF" />
    </svg>
  )
}

/** Símbolo + nome. O tamanho do texto vem de `className`. */
export function Logo({ markSize = 28, className = '' }: { markSize?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display font-bold tracking-[-0.02em] ${className}`}>
      <LogoMark size={markSize} />
      {APP_NAME}
    </span>
  )
}
