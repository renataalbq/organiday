import { useState, type FormEvent } from 'react'
import { sendMagicLink, signInWithGoogle } from '../auth/SessionProvider'
import { APP_NAME } from '../config'

export function LoginPage() {
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
    <main className="grid min-h-dvh place-items-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-[1.5rem] bg-blue p-6 text-blue-ink">
          <p className="font-display text-5xl font-extrabold tracking-tight">{APP_NAME}</p>
          <p className="mt-2 text-blue-ink/85">Trabalho, casa, estudos e o que mais couber no seu dia, num lugar só.</p>
        </div>

        <div className="rounded-[1.5rem] border border-line bg-card p-5">
          <button type="button" onClick={() => signInWithGoogle()} className="button-primary w-full py-2.5">
            Entrar com Google
          </button>

          <div className="my-4 flex items-center gap-3 text-xs text-navy-faint">
            <span className="h-px flex-1 bg-line" /> ou receba um link por e-mail{' '}
            <span className="h-px flex-1 bg-line" />
          </div>

          {status === 'sent' ? (
            <p className="rounded-xl bg-sky p-3 text-sm">
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="submit" className="button-quiet border border-line" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando…' : 'Enviar link de acesso'}
              </button>
              {status === 'error' && <p className="text-sm font-semibold text-alert">{errorMessage}</p>}
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
