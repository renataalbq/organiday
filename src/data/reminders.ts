import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const REMINDERS_KEY = ['reminder-settings'] as const

export interface ReminderSettings {
  /** minutos antes do horário; null = não avisar tarefas com horário */
  reminder_minutes: number | null
  /** avisar no começo do expediente o que vence no dia e não tem horário */
  remind_date_only: boolean
}

/** coluna nova que ainda não existe (migration 0008 não rodou) */
const isMissingColumn = (error: { code?: string }) => error.code === '42703' || error.code === 'PGRST204'

export function useReminderSettings() {
  const query = useQuery({
    queryKey: REMINDERS_KEY,
    queryFn: async (): Promise<ReminderSettings | 'missing'> => {
      const { data, error } = await supabase.from('user_settings').select('reminder_minutes, remind_date_only').maybeSingle()
      if (error) {
        if (isMissingColumn(error)) return 'missing'
        throw error
      }
      return (data as ReminderSettings | null) ?? { reminder_minutes: 15, remind_date_only: true }
    },
  })
  const isMigrationMissing = query.data === 'missing'
  return {
    ...query,
    isMigrationMissing,
    settings: query.data && query.data !== 'missing' ? query.data : null,
  }
}

export function useSaveReminderSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Partial<ReminderSettings>) => {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user.id
      if (!userId) throw new Error('Faça login de novo.')
      const { error } = await supabase.from('user_settings').update(changes).eq('user_id', userId)
      if (error) throw error
    },
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: REMINDERS_KEY })
      const previous = queryClient.getQueryData<ReminderSettings | 'missing'>(REMINDERS_KEY)
      if (previous && previous !== 'missing') queryClient.setQueryData(REMINDERS_KEY, { ...previous, ...changes })
      return { previous }
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) queryClient.setQueryData(REMINDERS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: REMINDERS_KEY }),
  })
}
