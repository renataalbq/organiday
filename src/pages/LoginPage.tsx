import { useState, type FormEvent } from 'react'
import { sendMagicLink, signInWithGoogle } from '../auth/SessionProvider'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { APP_NAME } from '../config'

const FEATURES: { icon: IconName; title: string; text: string; tone: string }[] = [
  {
    icon: 'plus',
    title: 'Adicionar rápido',
    text: 'Escreva do jeito que você fala. "pagar condomínio todo dia 10 #casa" já vira tarefa com data, repetição e área.',
    tone: 'bg-lilac text-lilac-ink',
  },
  {
    icon: 'flag',
    title: 'Prioridades no automático',
    text: 'Prazo, prioridade e contexto viram uma nota. Você abre o app e vê as 3 coisas que importam hoje.',
    tone: 'bg-peach text-peach-ink',
  },
  {
    icon: 'copy',
    title: 'Pra daily',
    text: 'Um resumo pronto do que você fez e do que vem a seguir, com impedimentos. É só copiar e colar.',
    tone: 'bg-mint text-ink',
  },
  {
    icon: 'study',
    title: 'Estudos com ritmo',
    text: 'Cursos e livros com progresso, prazo e quantas aulas por semana faltam pra chegar lá.',
    tone: 'bg-card border border-line text-ink',
  },
]

export function LoginPage() {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-16 sm:px-8">
        <header className="flex items-center justify-between py-2">
          <Logo markSize={30} className="text-2xl text-lilac-deep" />
          <a href="#entrar" className="button-quiet lg:hidden">
            Entrar
          </a>
        </header>

        <div className="mt-8 grid gap-10 lg:mt-14 lg:grid-cols-[1fr_380px] lg:gap-14">
          <section>
            <p className="eyebrow">Trabalho · casa · estudos</p>
            <h1 className="mt-3 font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-ink sm:text-6xl">
              Seu dia inteiro,
              <br />
              <span className="text-lilac-deep">num lugar só.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">
              O {APP_NAME} junta tarefas, reuniões, decisões e estudos, calcula quanto tempo livre sobra no expediente e
              mostra o que fazer primeiro. Sem montar sistema nenhum.
            </p>

            <div className="mt-8 lg:hidden" id="entrar">
              <LoginCard />
            </div>

            <AppPreview />
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <LoginCard />
            </div>
          </aside>
        </div>

        <section className="mt-16">
          <p className="eyebrow">O que tem</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article key={feature.title} className={`rounded-[var(--radius-card)] p-5 ${feature.tone}`}>
                <span className="grid size-9 place-items-center rounded-full bg-white/60">
                  <Icon name={feature.icon} />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold tracking-tight">{feature.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed opacity-80">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-2 rounded-[var(--radius-card)] bg-lilac-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold">Instale no celular</p>
            <p className="text-sm text-white/70">
              Funciona como app: no Android, menu ⋮ → Instalar app. No iPhone, Compartilhar → Adicionar à Tela de
              Início.
            </p>
          </div>
          <a href="#entrar" className="button-primary shrink-0 bg-white text-lilac-ink hover:bg-lilac lg:hidden">
            Começar
          </a>
        </footer>
      </div>
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
      setErrorMessage(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_12px_40px_-20px_rgba(43,33,82,.35)]">
      <h2 className="font-display text-2xl font-bold tracking-tight">Entrar</h2>
      <p className="mt-1 text-sm text-ink-soft">Cada conta só enxerga os próprios dados.</p>

      <button type="button" onClick={() => signInWithGoogle()} className="button-primary mt-5 w-full py-2.5">
        Entrar com Google
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-line" /> ou receba um link por e-mail <span className="h-px flex-1 bg-line" />
      </div>

      {status === 'sent' ? (
        <p className="rounded-xl bg-mint p-3 text-sm">
          Link enviado para {email}. Abra o e-mail neste aparelho para entrar.
        </p>
      ) : (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-2">
          <input
            type="email"
            required
            autoComplete="email"
            className="field"
            placeholder="seu@email.com"
            aria-label="E-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="button-quiet border border-line py-2.5" disabled={status === 'sending'}>
            {status === 'sending' ? 'Enviando…' : 'Enviar link de acesso'}
          </button>
          {status === 'error' && <p className="text-sm font-semibold text-alert">{errorMessage}</p>}
        </form>
      )}
    </div>
  )
}

const PREVIEW_CHIPS = [
  { label: 'Reunião', className: 'bg-lilac text-lilac-ink' },
  { label: 'Dias úteis', className: 'bg-mint' },
  { label: '9h30', className: 'bg-paper border border-line' },
  { label: '15 min', className: 'bg-paper border border-line' },
  { label: 'Trabalho', className: 'bg-peach text-peach-ink' },
]

const PREVIEW_PRIORITIES = [
  { title: 'Revisar PR do checkout', meta: 'Trabalho · atrasada', dot: 'bg-alert' },
  { title: 'Pagar condomínio', meta: 'Casa · hoje', dot: 'bg-peach-deep' },
  { title: 'Aula 12 do curso de SQL', meta: 'Estudos · 2 por semana', dot: 'bg-lilac-deep' },
]

function AppPreview() {
  return (
    <div aria-hidden="true" className="mt-10 grid gap-3 sm:grid-cols-[1.1fr_1fr]">
      <div className="rounded-[var(--radius-card)] border border-line bg-card p-5">
        <p className="eyebrow">Adicionar rápido</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-lilac bg-paper px-3 py-2.5 text-[15px]">
          <Icon name="plus" size={16} className="text-lilac-deep" />
          <span className="truncate">daily dias úteis 9h30 ~15m #trab</span>
        </div>
        <p className="mt-4 text-xs font-semibold text-ink-soft">O {APP_NAME} entendeu:</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PREVIEW_CHIPS.map((chip) => (
            <span key={chip.label} className={`chip text-xs ${chip.className}`}>
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] bg-lilac p-5 text-lilac-ink">
        <div className="flex items-center justify-between">
          <p className="font-display text-[17px] font-bold tracking-tight">Prioridades de hoje</p>
          <span className="chip bg-white/60">
            <Icon name="clock" size={12} /> 3h livres
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {PREVIEW_PRIORITIES.map((item) => (
            <li key={item.title} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5">
              <span className={`size-2.5 shrink-0 rounded-full ${item.dot}`} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                <span className="block text-xs text-ink-soft">{item.meta}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
