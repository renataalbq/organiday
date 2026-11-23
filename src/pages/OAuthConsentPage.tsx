import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js'
import { useSession, signOut } from '../auth/SessionProvider'
import { Logo } from '../components/Logo'
import { supabase } from '../lib/supabase'

/**
 * Tela de consentimento do OAuth Server do Supabase (Authentication → OAuth Server →
 * Authorization path = /oauth/consent). Aparece quando o Claude ou o Codex pedem acesso
 * pelo MCP: a pessoa confirma e o Supabase devolve o código pro cliente.
 */
export function OAuthConsentPage() {
  const [params] = useSearchParams()
  const authorizationId = params.get('authorization_id')
  const { session } = useSession()
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null)
  const [requestError, setError] = useState('')
  const error = authorizationId ? requestError : 'Link de autorização inválido.'
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authorizationId) return
    let cancelled = false
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: detailsError }) => {
      if (cancelled) return
      if (detailsError || !data) setError('Esse pedido de acesso expirou. Tente conectar de novo pelo app.')
      // já autorizado antes: o Supabase devolve direto o endereço de volta
      else if ('redirect_url' in data) window.location.assign(data.redirect_url)
      else setDetails(data)
    })
    return () => {
      cancelled = true
    }
  }, [authorizationId])

  const decide = async (approve: boolean) => {
    if (!authorizationId) return
    setBusy(true)
    const options = { skipBrowserRedirect: true }
    const { data, error: decisionError } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, options)
      : await supabase.auth.oauth.denyAuthorization(authorizationId, options)
    if (decisionError || !data) {
      setError('Não deu pra concluir. Tente conectar de novo pelo app.')
      setBusy(false)
      return
    }
    window.location.assign(data.redirect_url)
  }

  const clientName = details?.client.name || 'Um aplicativo'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-5">
      <div className="w-full max-w-[420px] rounded-[1.25rem] border border-line bg-card p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,.22)] sm:p-8">
        <Logo />
        {error ? (
          <p className="mt-6 text-sm font-medium text-alert">{error}</p>
        ) : !details ? (
          <p className="mt-6 text-sm text-ink-soft">Carregando…</p>
        ) : (
          <>
            <h1 className="mt-6 font-display text-[1.5rem] leading-tight font-bold tracking-[-0.02em]">
              {clientName} quer acessar seu Organiday
            </h1>
            <p className="mt-3 text-sm text-ink-soft">Com essa permissão, ele vai poder:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>ver suas áreas e tarefas</li>
              <li>criar, editar e concluir tarefas</li>
            </ul>
            <p className="mt-4 text-xs text-ink-soft">
              Conta: {details.user.email || session?.user.email}
              {details.redirect_uri && (
                <>
                  <br />
                  Volta para: {new URL(details.redirect_uri).host || details.redirect_uri}
                </>
              )}
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                className="button-dark py-3 text-[15px]"
                disabled={busy}
                onClick={() => decide(true)}
              >
                Permitir
              </button>
              <button
                type="button"
                className="button-outline py-3 text-[15px]"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Não permitir
              </button>
            </div>
            <button
              type="button"
              className="mt-5 text-xs text-ink-soft underline"
              onClick={() => signOut()}
              disabled={busy}
            >
              Não é você? Entrar com outra conta
            </button>
          </>
        )}
      </div>
    </main>
  )
}
