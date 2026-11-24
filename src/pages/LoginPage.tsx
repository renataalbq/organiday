import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { sendMagicLink, signInWithGoogle } from '../auth/SessionProvider'
import { translateAuthError } from '../lib/auth/translateAuthError'
import { buildDemoDay, parseHourInput } from '../lib/landing/demoDay'
import { savePendingSignup } from '../lib/landing/pendingSignup'
import { parseQuickAdd, type QuickAddToken } from '../lib/quickAdd/parseQuickAdd'
import type { Area } from '../types'

const DEFAULT_TEXT = 'enviar proposta pro cliente 15h #trab !alta'

const EXAMPLES = [
  'pagar condomínio todo dia 10 #casa',
  'reunião de alinhamento dias úteis 10h ~30m #trab',
  'academia dias úteis 7h ~1h #pessoal',
  'ler 20 páginas sexta 21h ~30m #estudos',
]

// áreas de exemplo pra demonstração do adicionar rápido na página de entrada
const DEMO_AREAS: Area[] = [
  { id: 'demo-work', name: 'Trabalho', color: '#5B4CDB', kind: 'work', position: 0 },
  { id: 'demo-personal', name: 'Pessoal', color: '#C8577A', kind: 'life', position: 1 },
  { id: 'demo-home', name: 'Casa', color: '#B97A1C', kind: 'life', position: 2 },
  { id: 'demo-study', name: 'Estudos', color: '#1E8A85', kind: 'life', position: 3 },
]

export function LoginPage() {
  const [text, setText] = useState(DEFAULT_TEXT)
  const [name, setName] = useState('')
  const [start, setStart] = useState('9h')
  const [end, setEnd] = useState('18h')

  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, DEMO_AREAS) : null), [text])
  const workdayStart = parseHourInput(start)
  const workdayEnd = parseHourInput(end)
  const workdayValid = Boolean(workdayStart && workdayEnd && workdayStart < workdayEnd)

  // guardado antes do login; aplicado quando a pessoa voltar logada (ver usePendingSignup)
  const rememberAnswers = () =>
    savePendingSignup({
      displayName: name.trim() || null,
      workdayStart: workdayValid && (start !== '9h' || end !== '18h') ? workdayStart : null,
      workdayEnd: workdayValid && (start !== '9h' || end !== '18h') ? workdayEnd : null,
      firstTask: text.trim() && text.trim() !== DEFAULT_TEXT ? text.trim() : null,
    })

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Header />
      <Hero text={text} onTextChange={setText} parsed={parsed} />
      <DaySection
        start={workdayValid ? workdayStart! : '09:00'}
        end={workdayValid ? workdayEnd! : '18:00'}
        parsed={parsed}
      />
      <ElsewhereSection />
      <ClaudeSection />
      <MomentsSection />
      <SignUpSection
        name={name}
        onNameChange={setName}
        start={start}
        onStartChange={setStart}
        end={end}
        onEndChange={setEnd}
        typedTitle={text.trim() !== DEFAULT_TEXT ? (parsed?.title ?? null) : null}
        onBeforeLogin={rememberAnswers}
      />
      <Footer />
    </div>
  )
}

const shell = 'mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-[72px]'
const mono = 'font-mono text-[11px] tracking-[0.08em] uppercase'

function Header() {
  return (
    <header className="border-b border-ink/80 pt-[env(safe-area-inset-top)]">
      <div className={`${shell} flex h-[66px] items-center justify-between`}>
        <span className="text-[17px] font-semibold tracking-[-0.02em]">organiday</span>
        <span className="hidden font-mono text-[11px] text-ink-soft sm:block">trabalho · casa · estudos</span>
        <a href="#entrar" className="border-b border-ink text-sm font-medium">
          Entrar →
        </a>
      </div>
    </header>
  )
}

/* ─── Herói: o adicionar rápido de verdade ─────────────────────────────── */

const FIELD_LABEL: Partial<Record<QuickAddToken['kind'], string>> = {
  kind: 'Tipo',
  date: 'Quando',
  time: 'Horário',
  duration: 'Duração',
  recurrence: 'Repete',
  area: 'Área',
  unknownArea: 'Área',
  priority: 'Prioridade',
}

const FIELD_ORDER: QuickAddToken['kind'][] = ['kind', 'date', 'time', 'duration', 'recurrence', 'area', 'unknownArea', 'priority']

function fieldTone(token: QuickAddToken): string {
  if (token.kind === 'area') return 'text-accent border-accent'
  if (token.kind === 'unknownArea') return 'text-ink-faint border-ink-faint'
  if (token.kind === 'priority' && /alta|urgente/.test(token.label)) return 'text-alert border-alert'
  return 'border-ink-faint'
}

function Hero({
  text,
  onTextChange,
  parsed,
}: {
  text: string
  onTextChange: (text: string) => void
  parsed: ReturnType<typeof parseQuickAdd> | null
}) {
  const tokens = [...(parsed?.tokens ?? [])].sort((a, b) => FIELD_ORDER.indexOf(a.kind) - FIELD_ORDER.indexOf(b.kind))

  return (
    <section className={`${shell} pt-14 sm:pt-[72px]`}>
      <label htmlFor="quick-add-demo" className={`${mono} text-ink-soft`}>
        Escreva qualquer coisa aqui embaixo ↓
      </label>
      <input
        id="quick-add-demo"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="mt-7 block w-full border-b-2 border-ink bg-transparent pb-3 text-[clamp(2.3rem,6.2vw,5.4rem)] leading-[1.1] font-semibold tracking-[-0.035em] outline-none placeholder:text-ink-faint sm:mt-9"
        placeholder="o que precisa fazer?"
      />

      <dl className="mt-7 flex min-h-[78px] flex-wrap gap-x-9 gap-y-5" aria-live="polite">
        {parsed && (
          <Field label="Tarefa" className="border-ink">
            {parsed.title || '—'}
          </Field>
        )}
        {tokens.map((token, index) => (
          <Field key={`${token.kind}-${index}`} label={FIELD_LABEL[token.kind] ?? ''} className={fieldTone(token)}>
            {token.kind === 'priority' ? token.label.replace('prioridade ', '') : token.label}
          </Field>
        ))}
      </dl>

      <div className="mt-9 flex flex-wrap items-baseline gap-x-7 gap-y-3 text-[13px]">
        <span className="text-ink-soft">ou tente:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onTextChange(example)}
            className="border-b border-ink-faint text-left hover:border-ink"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  )
}

function Field({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={`${mono} text-[10px] text-ink-soft`}>{label}</dt>
      <dd className={`mt-2 border-b-2 pb-1 text-[clamp(1.25rem,2vw,1.65rem)] leading-tight font-medium tracking-[-0.02em] ${className}`}>
        {children}
      </dd>
    </div>
  )
}

/* ─── O dia de exemplo ─────────────────────────────────────────────────── */

function DaySection({
  start,
  end,
  parsed,
}: {
  start: string
  end: string
  parsed: ReturnType<typeof parseQuickAdd> | null
}) {
  const [today] = useState(() => new Date().toLocaleDateString('en-CA'))
  const isToday = !parsed?.dueDate || parsed.dueDate === today
  const day = buildDemoDay(
    start,
    end,
    parsed?.dueTime && isToday ? { time: parsed.dueTime, durationMinutes: parsed.durationMinutes } : null,
  )

  return (
    <section className={`${shell} pt-16 pb-16 sm:pt-20 sm:pb-[88px]`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 className="text-[clamp(1.3rem,2vw,1.75rem)] font-medium tracking-[-0.02em]">
          Seu dia hoje, das {formatHour(start)} às {formatHour(end)}
        </h2>
        <p className="flex items-baseline gap-2">
          <span className="text-[clamp(4rem,9vw,8rem)] leading-[0.85] font-normal tracking-[-0.05em] text-accent tabular-nums">
            {day.freeLabel}
          </span>
          <span className="text-[clamp(1.3rem,2vw,1.75rem)] font-medium tracking-[-0.02em]">livres</span>
        </p>
      </div>

      <div className="relative mt-8 h-11 border-y border-ink">
        {day.blocks.map((block, index) => (
          <span
            key={index}
            className={`absolute inset-y-0 transition-all duration-300 ${block.kind === 'typed' ? 'bg-accent' : 'bg-busy'}`}
            style={{ left: `${block.left}%`, width: `${block.width}%` }}
          />
        ))}
      </div>
      <div className="relative mt-3 h-3 font-mono text-[10px] text-ink-soft" aria-hidden>
        {day.ticks.map(({ hour, left }) => (
          <span
            key={hour}
            className={`absolute ${left < 1 ? '' : left > 99 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${left}%` }}
          >
            {String(hour).padStart(2, '0')}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-ink-soft">
        Cinza: uma reunião que veio da sua agenda e o almoço. Colorido: o que você acabou de escrever.
        {parsed?.dueTime && !isToday && ' (A sua tarefa ficou pra outro dia, então não entra aqui.)'}
      </p>
    </section>
  )
}

const formatHour = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
}

/* ─── O que está em outro lugar ────────────────────────────────────────── */

const MESS: { text: string; style: CSSProperties; className?: string }[] = [
  { text: '[JIRA-482] Você foi atribuída: revisar relatório do mês', style: { left: '0%', top: 0, rotate: '-1deg' }, className: 'font-mono text-[11px]' },
  { text: '+3 comentários', style: { left: '48%', top: 18 }, className: 'font-mono text-[10px] text-ink-soft' },
  { text: 'Convite: Reunião de equipe · seg 9h30', style: { left: '14%', top: 40 }, className: 'text-[15px] font-medium' },
  { text: 'Aceitar · Talvez · Recusar', style: { left: '68%', top: 62, rotate: '-4deg' }, className: 'bg-busy px-1.5 font-mono text-[10px]' },
  { text: 'Trello · cartão movido para “Fazendo”: atualizar planilha de custos', style: { left: '2%', top: 86 }, className: 'font-mono text-[10px]' },
  { text: 'Codex: “posso abrir uma issue?”', style: { left: '58%', top: 100 }, className: 'text-[12px] italic' },
  { text: 'Outlook: Call com cliente, 16h', style: { left: '34%', top: 120 }, className: 'text-[17px] font-semibold' },
  { text: 'lembrar: pagar boleto', style: { left: '0%', top: 140, rotate: '-6deg' }, className: 'text-[12px] italic' },
  { text: 'Outlook: lembrete em 15 min', style: { left: '20%', top: 156 }, className: 'font-mono text-[10px] text-ink-soft' },
  { text: 'RE: RE: RE: proposta revisada (v3 final)', style: { left: '54%', top: 170 }, className: 'text-[11px]' },
  { text: 'Asana · Lembrete: preparar apresentação', style: { left: '7%', top: 190 }, className: 'bg-busy px-1.5 font-mono text-[10px]' },
  { text: '@renata pode ver isso hoje?', style: { left: '41%', top: 214 }, className: 'font-mono text-[10px]' },
  { text: 'Claude: “…tem um erro nesse cálculo. Quer que eu…”', style: { left: '11%', top: 236 }, className: 'text-[12px] italic' },
  { text: 'Slack (12)', style: { left: '67%', top: 246 }, className: 'bg-busy px-1.5 font-mono text-[10px]' },
  { text: 'ligar pro fornecedor', style: { left: '0%', top: 266 }, className: 'text-[12px] line-through' },
  { text: 'Jira: 2 tarefas vencem amanhã', style: { left: '30%', top: 274 }, className: 'font-mono text-[10px]' },
  { text: 'Google Agenda: Alinhamento trimestral', style: { left: '50%', top: 292 }, className: 'text-[12px]' },
  { text: 'post-it: mandar orçamento até sexta?', style: { left: '3%', top: 310 }, className: 'bg-busy px-1.5 font-mono text-[10px]' },
  { text: 'Trello: 4 cartões atrasados', style: { left: '25%', top: 330 }, className: 'text-[17px] font-semibold' },
  { text: 'notificações não lidas', style: { left: '67%', top: 340 }, className: 'font-mono text-[10px] text-ink-soft' },
  { text: 'anotei em algum lugar…', style: { left: '4%', top: 364, rotate: '-3deg' }, className: 'text-[11px] italic' },
  { text: 'Asana · você foi mencionada', style: { left: '42%', top: 368 }, className: 'font-mono text-[10px]' },
  { text: 'Reunião às 9h30 ou 10h??', style: { left: '37%', top: 390 }, className: 'bg-busy px-1.5 text-[12px]' },
  { text: 'Jira · status alterado: Em revisão → A fazer', style: { left: '0%', top: 412 }, className: 'font-mono text-[10px]' },
]

const ONE_DAY: { time: string; title: string; source: string; highlight?: boolean }[] = [
  { time: '09:30', title: 'reunião de equipe', source: 'google agenda' },
  { time: '11:00', title: 'corrigir validação de CPF no cadastro', source: 'claude', highlight: true },
  { time: '14:00', title: 'revisar relatório do mês', source: 'jira' },
  { time: '15:00', title: 'atualizar planilha de custos', source: 'trello' },
  { time: '16:00', title: 'call com cliente', source: 'outlook' },
  { time: '17:00', title: 'preparar apresentação', source: 'asana' },
]

function ElsewhereSection() {
  return (
    <section className="border-t border-ink/80">
      <div className={`${shell} pt-16 pb-9 sm:pt-[72px]`}>
        <p className={`${mono} text-ink-soft`}>Você nem precisa escrever tudo</p>
        <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.3rem)] leading-[1] font-semibold tracking-[-0.035em]">
          O que já está em outro lugar
          <br />
          <span className="text-accent">chega sozinho.</span>
        </h2>
      </div>

      <div className="border-y border-ink/80">
        <div className={`${shell} grid md:grid-cols-2`}>
          <div className="border-b border-ink/80 py-9 md:border-r md:border-b-0 md:pr-10">
            <p className={`${mono} text-ink-soft`}>Antes · abas demais, cabeça cheia</p>
            {/* desktop: espalhado; celular: amontoado, mas cabendo na tela */}
            <div className="relative mt-6 hidden h-[430px] overflow-hidden text-ink md:block" aria-hidden>
              {MESS.map((item) => (
                <span key={item.text} className={`absolute whitespace-nowrap ${item.className ?? ''}`} style={item.style}>
                  {item.text}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-ink md:hidden" aria-hidden>
              {MESS.map((item, index) => (
                <span
                  key={item.text}
                  className={`max-w-full ${item.className ?? ''}`}
                  style={{ rotate: item.style.rotate ?? `${((index * 7) % 5) - 2}deg` }}
                >
                  {item.text}
                </span>
              ))}
            </div>
          </div>
          <div className="py-9 md:pl-[72px]">
            <p className={`${mono} text-accent`}>Depois · um dia só</p>
            <ol className="mt-6">
              {ONE_DAY.map((item) => (
                <li key={item.time} className="flex items-baseline gap-6 border-b border-line-strong py-4 sm:gap-10">
                  <span className="font-mono text-[13px] text-ink-soft">{item.time}</span>
                  <span className={`flex-1 text-[17px] font-medium ${item.highlight ? 'text-accent' : ''}`}>
                    {item.title}
                  </span>
                  <span className={`font-mono text-[10px] ${item.highlight ? 'text-accent' : 'text-ink-soft'}`}>
                    {item.source}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <p className={`${shell} max-w-[1440px] py-8 text-[14px] leading-relaxed text-ink-soft`}>
        <span className="block max-w-[560px]">
          Reuniões do <b className="font-semibold text-ink">Google Agenda</b> e do{' '}
          <b className="font-semibold text-ink">Outlook</b> entram sozinhas. O que te atribuírem no{' '}
          <b className="font-semibold text-ink">Jira</b>, no <b className="font-semibold text-ink">Trello</b> ou no{' '}
          <b className="font-semibold text-ink">Asana</b> chega pronto, e você só escolhe a hora de puxar.
        </span>
      </p>
    </section>
  )
}

/* ─── Claude e Codex ───────────────────────────────────────────────────── */

const CLAUDE_TASK: [string, string][] = [
  ['Tarefa', 'corrigir validação de CPF no cadastro de cliente'],
  ['Quando', 'amanhã'],
  ['Horário', '10h'],
  ['Área', 'Trabalho'],
]

const CLAUDE_NOTES = [
  'O formulário de cadastro envia o CPF com máscara (123.456.789-00), mas a API só aceita números e responde 422.',
  'Onde: src/clientes/CadastroForm.tsx:84, no envio do formulário.',
  'Pra reproduzir: cadastrar um cliente digitando o CPF formatado.',
  'Sugestão: tirar a máscara antes de enviar e cobrir com um teste.',
]

function ClaudeSection() {
  return (
    <section className="bg-accent text-white">
      <div className={`${shell} pt-16 pb-14 sm:pt-[88px]`}>
        <p className={`${mono} text-white/75`}>De dentro do Claude e do Codex</p>
        <blockquote className="mt-6 max-w-[1040px] text-[clamp(2rem,4.2vw,3.6rem)] leading-[1.1] font-medium tracking-[-0.028em]">
          “Claude, abre uma tarefa pra mim amanhã às 10h, no trabalho, pra corrigir esse problema no cadastro.”
        </blockquote>

        <dl className="mt-10 flex flex-wrap gap-x-9 gap-y-5">
          {CLAUDE_TASK.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className={`${mono} text-[10px] text-white/75`}>{label}</dt>
              <dd className="mt-2 border-b-2 border-white/80 pb-1 text-[clamp(1.25rem,2vw,1.65rem)] leading-tight font-medium tracking-[-0.02em]">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-9 max-w-[760px] border-l-2 border-white/45 pl-5">
          <p className={`${mono} text-[10px] text-white/75`}>Notas · escritas pelo Claude a partir da conversa</p>
          <div className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-white/90">
            {CLAUDE_NOTES.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/30 pt-6">
          <p className="text-[15px] font-medium">
            ✓ Criada no seu Organiday, com o contexto do problema. Você nem saiu da conversa.
          </p>
          <p className="font-mono text-[11px] text-white/75">conecta via MCP em um clique</p>
        </div>
      </div>
    </section>
  )
}

/* ─── Os momentos do dia ───────────────────────────────────────────────── */

const MOMENTS = [
  {
    time: '08:50',
    title: 'Você abre. Três coisas. Só.',
    text: 'Prazo, prioridade e área escolhem por você o que importa hoje.',
  },
  {
    time: '14:00',
    title: 'Uma dúvida vira decisão.',
    text: 'Escreva terminando com “?” e ela fica guardada em Pra decidir até você bater o martelo. Nada fica perdido no meio das tarefas.',
  },
  {
    time: '18:00',
    title: 'Já fiz. Vou fazer.',
    text: 'O que você fez, o que vai fazer e os impedimentos, num texto pronto pra mandar pra quem precisar saber. Você não esquece de nada.',
  },
  {
    time: '21:00',
    title: 'Mais uma aula. No ritmo.',
    text: 'Curso, livro ou certificação: você marca o avanço e ele te diz se ainda dá tempo de terminar no prazo que você escolheu.',
  },
]

function MomentsSection() {
  return (
    <section>
      {MOMENTS.map((moment) => (
        <div key={moment.time} className="border-b border-ink/80">
          <div className={`${shell} grid gap-3 py-10 sm:py-12 md:grid-cols-[230px_1fr_380px] md:gap-8`}>
            <span className="font-mono text-[clamp(2.2rem,3.4vw,3rem)] leading-none text-accent">{moment.time}</span>
            <h3 className="text-[clamp(1.9rem,3.3vw,2.9rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
              {moment.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-ink-soft md:pt-5">{moment.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}

/* ─── Cadastro ─────────────────────────────────────────────────────────── */

function SignUpSection({
  name,
  onNameChange,
  start,
  onStartChange,
  end,
  onEndChange,
  typedTitle,
  onBeforeLogin,
}: {
  name: string
  onNameChange: (value: string) => void
  start: string
  onStartChange: (value: string) => void
  end: string
  onEndChange: (value: string) => void
  typedTitle: string | null
  onBeforeLogin: () => void
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleGoogle = () => {
    onBeforeLogin()
    signInWithGoogle()
  }

  const handleMagicLink = async (event: FormEvent) => {
    event.preventDefault()
    onBeforeLogin()
    setStatus('sending')
    const { error } = await sendMagicLink(email)
    if (error) {
      setErrorMessage(translateAuthError(error))
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  const inline =
    'border-b-2 border-white/80 bg-transparent px-2 text-center outline-none placeholder:text-white/45 focus:border-white'

  return (
    <section id="entrar" className="scroll-mt-4 bg-[#19191b] text-[#f4f3ef]">
      <div className={`${shell} pt-20 pb-16 sm:pt-[104px]`}>
        <p className="max-w-[1000px] text-[clamp(2rem,4.2vw,3.6rem)] leading-[1.35] font-medium tracking-[-0.028em]">
          Me chama de{' '}
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="seu nome"
            aria-label="Seu nome"
            maxLength={40}
            autoComplete="given-name"
            className={`${inline} w-[7.5ch] text-left text-white/90 placeholder:text-white/50`}
          />
          , meu dia começa às{' '}
          <input
            value={start}
            onChange={(event) => onStartChange(event.target.value)}
            aria-label="Começo do expediente"
            className={`${inline} w-[3.2ch] text-[#c6bfff]`}
          />{' '}
          e termina às{' '}
          <input
            value={end}
            onChange={(event) => onEndChange(event.target.value)}
            aria-label="Fim do expediente"
            className={`${inline} w-[3.2ch] text-[#c6bfff]`}
          />
          .
        </p>

        <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <button
            type="button"
            onClick={handleGoogle}
            className="w-fit rounded-full bg-[#f4f3ef] px-7 py-3.5 text-[15px] font-semibold text-[#19191b] transition-colors hover:bg-white"
          >
            Começar com Google →
          </button>
          <span className="text-[13px] text-white/60">ou</span>
          {status === 'sent' ? (
            <p className="text-[14px] text-[#c6bfff]">Link enviado para {email}. Abra o e-mail neste aparelho.</p>
          ) : (
            <form onSubmit={handleMagicLink} className="flex w-full max-w-[24rem] items-center gap-3">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="receber link em seu@email.com"
                aria-label="E-mail"
                className="w-[min(100%,19rem)] min-w-0 flex-1 border-b border-white/40 bg-transparent py-2 text-[15px] outline-none placeholder:text-white/55 focus:border-white"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                aria-label="Enviar link de acesso"
                className="grid size-11 shrink-0 place-items-center rounded-full border border-white/80 transition-colors hover:bg-white hover:text-[#19191b] disabled:opacity-50"
              >
                →
              </button>
            </form>
          )}
        </div>
        {status === 'error' && <p className="mt-3 text-sm font-medium text-[#ff8f84]">{errorMessage}</p>}

        <p className="mt-9 font-mono text-[11px] text-white/60">
          {typedTitle
            ? `“${typedTitle}” já entra como sua primeira tarefa.`
            : 'O que você escrever lá em cima já entra como sua primeira tarefa.'}
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-[#19191b] pb-[env(safe-area-inset-bottom)] text-white/60">
      <div
        className={`${shell} flex flex-col gap-2 border-t border-white/15 py-6 font-mono text-[10px] sm:flex-row sm:justify-between`}
      >
        <span>Instala como app: Android ⋮ → Instalar · iPhone Compartilhar → Tela de Início</span>
        <span>Cada conta só enxerga os próprios dados.</span>
      </div>
    </footer>
  )
}
