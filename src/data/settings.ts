import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { DEFAULT_SETTINGS, type UserSettings } from '../types'

const SETTINGS_KEY = ['settings'] as const

const trimSeconds = (time: string | null) => (time ? time.slice(0, 5) : null)

export function useSettings() {
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
      if (error) throw error
      if (!data) return DEFAULT_SETTINGS
      return {
        display_name: data.display_name,
        workday_start: trimSeconds(data.workday_start)!,
        workday_end: trimSeconds(data.workday_end)!,
        lunch_start: trimSeconds(data.lunch_start),
        lunch_end: trimSeconds(data.lunch_end),
      }
    },
  })
  return { ...query, settings: query.data ?? DEFAULT_SETTINGS }
}

export function useSaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (settings: UserSettings) => {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: userData.user?.id, ...settings }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}
