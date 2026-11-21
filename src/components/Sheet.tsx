import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'

interface SheetProps {
  label: string
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  /** fica fixo no topo */
  header: ReactNode
  /** fica fixo embaixo (botões de ação) */
  footer: ReactNode
  children: ReactNode
}

/**
 * Formulário em painel. No celular ocupa a tela toda, como uma tela de app:
 * cabeçalho e botões fixos, só o meio rola. No desktop fica centralizado.
 * Fecha com Esc ou clicando fora.
 */
export function Sheet({ label, onClose, onSubmit, header, footer, children }: SheetProps) {
  const panelRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // trava a rolagem da página por trás enquanto o painel está aberto
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // com o teclado aberto, o iOS não encolhe a tela: acompanha a área visível
  // para os botões continuarem acima do teclado
  useEffect(() => {
    const viewport = window.visualViewport
    const panel = panelRef.current
    if (!viewport || !panel) return
    const sync = () => {
      panel.style.setProperty('--sheet-height', `${viewport.height}px`)
      panel.style.setProperty('--sheet-top', `${viewport.offsetTop}px`)
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-ink/30 sm:flex sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <form
        ref={panelRef}
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
        className="fixed inset-x-0 top-[var(--sheet-top,0px)] flex h-[var(--sheet-height,100dvh)] flex-col bg-paper [animation:sheet-in_.2s_ease-out] sm:static sm:h-auto sm:max-h-[88dvh] sm:w-full sm:max-w-lg sm:rounded-[1.5rem] sm:shadow-xl"
      >
        <header className="shrink-0 border-b border-line/70 px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3 sm:border-0 sm:px-5 sm:pt-5 sm:pb-0">
          {header}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>

        <footer className="shrink-0 border-t border-line/70 bg-paper px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:rounded-b-[1.5rem] sm:border-0 sm:px-5 sm:pt-1 sm:pb-5">
          {footer}
        </footer>
      </form>
    </div>
  )
}
