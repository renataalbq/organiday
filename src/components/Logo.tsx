import { APP_NAME } from '../config'

/** Símbolo do app: o "O" de Organiday como a volta de um dia, com o sol em pêssego. */
export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="512" height="512" rx="112" fill="#6A52C4" />
      <circle cx="256" cy="256" r="128" fill="none" stroke="#FFFCF5" strokeWidth="68" />
      <circle cx="346.5" cy="165.5" r="62" fill="#6A52C4" />
      <circle cx="346.5" cy="165.5" r="44" fill="#F0BF9C" />
    </svg>
  )
}

/** Símbolo + nome. O tamanho do texto vem de `className`. */
export function Logo({ markSize = 28, className = '' }: { markSize?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${className}`}>
      <LogoMark size={markSize} />
      {APP_NAME}
    </span>
  )
}
