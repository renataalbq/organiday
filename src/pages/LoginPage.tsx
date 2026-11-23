import { useMemo, useState, type FormEvent } from 'react'
import { sendMagicLink, signInWithGoogle } from '../auth/SessionProvider'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { ParsedChips } from '../components/ParsedChips'
import { APP_NAME } from '../config'
import { translateAuthError } from '../lib/auth/translateAuthError'
import { parseQuickAdd } from '../lib/quickAdd/parseQuickAdd'
import type { Area } from '../types'

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'plus',
    title: 'Adicionar rápido',
    text: 'Escreva do jeito que você fala. "pagar condomínio todo dia 10 #casa" já vira tarefa com data, repetição e área.',
  },
  {
    icon: 'flag',
    title: 'Prioridades no automático',
    text: 'Prazo, prioridade e contexto viram uma nota. Você abre o app e vê as 3 coisas que importam hoje.',
  },
  {
    icon: 'copy',
    title: 'Resumo pra reunião',
    text: 'O que você já fez e vai fazer, com impedimentos. Pronto pra daily ou qualquer conversa.',
  },
  {
    icon: 'study',
    title: 'Estudos com ritmo',
    text: 'Cursos e livros com progresso, prazo e quantas aulas por semana faltam pra chegar lá.',
  },
]

// áreas de exemplo pra demonstração do adicionar rápido na página de entrada
const DEMO_AREAS: Area[] = [
  { id: 'demo-work', name: 'Trabalho', color: '#5B4CDB', kind: 'work', position: 0 },
  { id: 'demo-home', name: 'Casa', color: '#B97A1C', kind: 'life', position: 1 },
  { id: 'demo-study', name: 'Estudos', color: '#1E8A85', kind: 'life', position: 2 },
]

export function LoginPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-[1144px] px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-8">
        <header className="flex items-center justify-between py-2">
          <Logo markSize={32} className="text-xl" />
          <a href="#entrar" className="button-outline px-3.5 py-2 lg:hidden">
            Entrar
          </a>
        </header>

        <div className="mt-10 grid gap-10 lg:mt-16 lg:grid-cols-[1fr_400px] lg:gap-20">
          <section>
            <p className="eyebrow">Trabalho · casa · estudos</p>
            <h1 className="mt-4 font-display text-[2.8rem] leading-[0.98] font-bold tracking-[-0.045em] sm:text-[4.25rem]">
              Seu dia inteiro,
              <br />
              <span className="text-accent">num lugar só.</span>
            </h1>
            <p className="mt-6 max-w-[540px] text-lg leading-relaxed text-ink-soft">
              O {APP_NAME} junta tarefas, reuniões, decisões e estudos, calcula quanto tempo livre sobra no expediente e
              mostra o que fazer primeiro. Sem montar sistema nenhum.
            </p>

            <QuickAddDemo />

            <div className="mt-10 lg:hidden" id="entrar">
              <LoginCard />
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <LoginCard />
            </div>
          </aside>
        </div>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="card p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={feature.icon} size={19} />
              </span>
              <h2 className="mt-5 font-display text-lg font-semibold tracking-[-0.01em]">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.text}</p>
            </article>
          ))}
        </section>

        <footer className="mt-14 flex flex-col gap-3 rounded-[1.25rem] bg-panel p-7 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-bold tracking-[-0.01em]">Instale no celular</p>
            <p className="mt-1.5 text-sm text-white/75">
              Android: menu ⋮ → Instalar app. iPhone: Compartilhar → Adicionar à Tela de Início.
            </p>
          </div>
          <p className="text-sm text-[#c9c2ff]">Funciona como app, sem loja.</p>
        </footer>
      </div>
    </div>
  )
}

/** O adicionar rápido de verdade, com áreas de exemplo: quem chega já vê o que ele entende. */
function QuickAddDemo() {
  const [text, setText] = useState('daily dias úteis 9h30 ~15m #trab')
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, DEMO_AREAS) : null), [text])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    document.getElementById('entrar')?.scrollIntoView({ behavior: 'smooth' })
    document.querySelector<HTMLInputElement>('#entrar input[type="email"], aside input[type="email"]')?.focus()
  }

  return (
    <div className="mt-9 max-w-[580px]">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-card py-1.5 pr-1.5 pl-5"
      >
        <Icon name="plus" size={20} />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Experimente o adicionar rápido"
          className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none sm:text-[17px]"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-accent-ink"
        >
          Adicionar
        </button>
      </form>
      {parsed && <ParsedChips tokens={parsed.tokens} className="mt-3 px-5" />}
    </div>
  )
}

function LoginCard() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    const { error } = await sendMagicLink(email)
    if (error) {
      setErrorMessage(translateAuthError(error))
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="rounded-[1.25rem] border border-line bg-card p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,.22)] sm:p-8">
      <h2 className="font-display text-[1.7rem] font-bold tracking-[-0.02em]">Entrar</h2>
      <p className="mt-1 text-sm text-ink-soft">Cada conta só enxerga os próprios dados.</p>

      <button type="button" onClick={() => signInWithGoogle()} className="button-dark mt-6 w-full py-3 text-[15px]">
        <Icon name="google" size={17} /> Continuar com Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-line" /> ou receba um link por e-mail <span className="h-px flex-1 bg-line" />
      </div>

      {status === 'sent' ? (
        <p className="rounded-xl bg-accent-soft p-3.5 text-sm text-accent-ink">
          Link enviado para {email}. Abra o e-mail neste aparelho para entrar.
        </p>
      ) : (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
          <label>
            <span className="label">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="field py-3"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" className="button-outline py-3 text-[15px]" disabled={status === 'sending'}>
            {status === 'sending' ? 'Enviando…' : 'Enviar link de acesso'}
          </button>
          {status === 'error' && <p className="text-sm font-medium text-alert">{errorMessage}</p>}
        </form>
      )}
    </div>
  )
}
