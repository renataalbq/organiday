import { useEffect, useState } from 'react'
import { useReminderSettings, useSaveReminderSettings } from '../data/reminders'
import { currentSubscription, disablePush, enablePush, pushSupport, sendTestPush } from '../lib/reminders/push'
import { Icon } from './Icon'

const LEAD_OPTIONS: [string, string][] = [
  ['0', 'na hora'],
  ['5', '5 min antes'],
  ['15', '15 min antes'],
  ['30', '30 min antes'],
  ['60', '1h antes'],
  ['off', 'não avisar'],
]

/** Ajustes → Lembretes: notificação quando o prazo de uma tarefa está chegando. */
export function RemindersSettings() {
  const support = pushSupport()
  const { settings, isMigrationMissing, isLoading } = useReminderSettings()
  const saveSettings = useSaveReminderSettings()
  const [isOn, setIsOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    currentSubscription()
      .then((subscription) => !cancelled && setIsOn(Boolean(subscription)))
      .catch(() => !cancelled && setIsOn(false))
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ text: success, isError: false })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Algo deu errado.', isError: true })
    } finally {
      setBusy(false)
    }
  }

  const toggle = () =>
    isOn
      ? run(async () => {
          await disablePush()
          setIsOn(false)
        }, 'Lembretes desligados neste aparelho.')
      : run(async () => {
          await enablePush()
          setIsOn(true)
        }, 'Lembretes ligados. Toque em "Enviar teste" pra conferir.')

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">Lembretes</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Uma notificação quando o prazo de uma tarefa está chegando, mesmo com o app fechado. Vale pra cada aparelho
            em que você ativar.
          </p>
        </div>
        {support === 'ok' && !isMigrationMissing && isOn !== null && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={`${isOn ? 'button-outline' : 'button-primary'} shrink-0 px-4`}
          >
            {busy ? 'Um instante…' : isOn ? 'Desativar neste aparelho' : 'Ativar neste aparelho'}
          </button>
        )}
      </div>

      {isMigrationMissing ? (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-ink-soft">
          Pra ativar, rode <code className="rounded bg-card px-1">supabase/migrations/0008_reminders.sql</code> no SQL
          Editor do Supabase e recarregue a página.
        </p>
      ) : support === 'needs-install' ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-accent-soft p-3 text-[13px] text-accent-ink">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          <span>
            No iPhone, as notificações só funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de
            Início, abra o Organiday por lá e volte aqui.
          </span>
        </p>
      ) : support === 'unsupported' ? (
        <p className="mt-4 text-sm text-ink-soft">Este navegador não aceita notificações.</p>
      ) : null}

      {settings && !isLoading && (
        <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="label">Tarefas com horário</span>
            <select
              className="field"
              value={settings.reminder_minutes === null ? 'off' : String(settings.reminder_minutes)}
              onChange={(event) =>
                saveSettings.mutate({
                  reminder_minutes: event.target.value === 'off' ? null : Number(event.target.value),
                })
              }
            >
              {LEAD_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 items-start gap-3 pt-6 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
              checked={settings.remind_date_only}
              onChange={(event) => saveSettings.mutate({ remind_date_only: event.target.checked })}
            />
            <span>
              Tarefas sem horário: avisar no começo do expediente do dia em que vencem
            </span>
          </label>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {message ? (
          <p className={`text-sm ${message.isError ? 'text-alert' : 'text-ink-soft'}`}>{message.text}</p>
        ) : (
          <span />
        )}
        {isOn && (
          <button
            type="button"
            className="button-quiet px-3 py-2 text-[13px]"
            disabled={busy}
            onClick={() => run(sendTestPush, 'Teste enviado. Deve chegar em alguns segundos.')}
          >
            Enviar teste
          </button>
        )}
      </div>
    </section>
  )
}
