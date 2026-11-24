import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ExternalItem, Integration, IntegrationProvider } from '../types'
import { isMissingTableError } from './calendar'

const INTEGRATIONS_KEY = ['integrations'] as const
const ITEMS_KEY = ['integration-items'] as const
const PULLED_KEY = ['pulled-refs'] as const

export const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  jira: 'Jira',
  trello: 'Trello',
  asana: 'Asana',
}

/** coluna nova que ainda não existe (migration 0006 não rodou) */
const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' && error !== null && ['42703', 'PGRST204'].includes((error as { code?: string }).code ?? '')

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Faça login de novo.')
  const response = await fetch(path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new Error((body.error as string) ?? 'Algo deu errado. Tente de novo.')
  return body
}

export function useIntegrations() {
  const query = useQuery({
    queryKey: INTEGRATIONS_KEY,
    queryFn: async (): Promise<Integration[]> => {
      const { data, error } = await supabase.from('integrations').select('id, provider, account, created_at')
      if (error) throw error
      return data as Integration[]
    },
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  })
  const integrations = useMemo(() => query.data ?? [], [query.data])
  return { ...query, integrations, isTableMissing: isMissingTableError(query.error) }
}

export function useConnectIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { provider: IntegrationProvider } & Record<string, string>) =>
      authorizedFetch('/api/integrations', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_KEY })
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
    },
  })
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('integrations').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INTEGRATIONS_KEY })
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
    },
  })
}

interface ProviderItems {
  provider: IntegrationProvider
  items: ExternalItem[]
  error: string | null
}

/** refs do que já virou tarefa (aberta ou concluída), pra não oferecer de novo */
function usePulledRefs() {
  return useQuery({
    queryKey: PULLED_KEY,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('tasks').select('external_ref').not('external_ref', 'is', null)
      if (error) {
        if (isMissingColumnError(error)) return new Set()
        throw error
      }
      return new Set((data as { external_ref: string }[]).map((row) => row.external_ref))
    },
  })
}

/** O que está atribuído à pessoa e ainda não foi puxado, mais o erro de cada integração. */
export function useExternalItems() {
  const { integrations } = useIntegrations()
  const pulled = usePulledRefs()

  const query = useQuery({
    queryKey: [...ITEMS_KEY, integrations.map((integration) => integration.id).join(',')],
    queryFn: async () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const body = await authorizedFetch(`/api/integration-items?${new URLSearchParams({ tz: timeZone })}`)
      return (body.providers ?? []) as ProviderItems[]
    },
    enabled: integrations.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  })

  const items = useMemo(() => {
    const done = pulled.data ?? new Set<string>()
    return (query.data ?? [])
      .flatMap((provider) => provider.items)
      .filter((item) => !done.has(item.ref))
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  }, [query.data, pulled.data])

  const errors = useMemo(
    () => (query.data ?? []).filter((provider) => provider.error).map((provider) => ({ provider: provider.provider, error: provider.error! })),
    [query.data],
  )

  return {
    items,
    errors,
    hasIntegrations: integrations.length > 0,
    isLoading: query.isLoading && integrations.length > 0,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

/** Traz um item de fora como tarefa, com o link e o contexto nas notas. */
export function usePullItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, areaId }: { item: ExternalItem; areaId: string | null }) => {
      const notes = [`${PROVIDER_LABEL[item.provider]}: ${item.url}`, item.context].filter(Boolean).join('\n')
      const { error } = await supabase.from('tasks').insert({
        title: item.title.slice(0, 300),
        notes,
        area_id: areaId,
        due_date: item.dueDate,
        due_time: item.dueDate ? item.dueTime : null,
        external_ref: item.ref,
      })
      // já tinha sido puxado em outro aparelho: só atualiza a lista
      if (error && error.code !== '23505') throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PULLED_KEY })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
