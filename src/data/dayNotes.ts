import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

const dayNoteKey = (day: string) => ['day-note', day] as const

/** Nota do dia (YYYY-MM-DD). `null` quando ainda não foi escrita. */
export function useDayNote(day: string) {
  return useQuery({
    queryKey: dayNoteKey(day),
    queryFn: async (): Promise<JSONContent | null> => {
      const { data, error } = await supabase.from('day_notes').select('content').eq('day', day).maybeSingle()
      if (error) throw error
      return (data?.content as JSONContent | undefined) ?? null
    },
    // o editor é a fonte da verdade enquanto está aberto: não sobrescreve o que está sendo digitado
    refetchOnWindowFocus: false,
  })
}

/**
 * Salva a nota direto no Supabase (sem useMutation), para poder ser chamada
 * no cleanup do editor, quando o componente já está desmontando.
 */
export function useSaveDayNote() {
  const queryClient = useQueryClient()
  return useCallback(
    async (day: string, content: JSONContent) => {
      queryClient.setQueryData(dayNoteKey(day), content)
      const { error } = await supabase.from('day_notes').upsert({ day, content }, { onConflict: 'user_id,day' })
      if (error) throw error
    },
    [queryClient],
  )
}
