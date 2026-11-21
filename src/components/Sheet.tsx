import { useEffect, type FormEvent, type ReactNode } from 'react'

interface SheetProps {
  label: string
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  children: ReactNode
}

/** Formulário em painel: sobe de baixo no celular, centralizado no desktop. Fecha com Esc ou clicando fora. */
export function Sheet({ label, onClose, onSubmit, children }: SheetProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/30 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.5rem] bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl [animation:sheet-in_.2s_ease-out] sm:max-w-lg sm:rounded-[1.5rem]"
      >
        {children}
      </form>
    </div>
  )
}
