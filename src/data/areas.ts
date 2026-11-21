import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Area } from '../types'

const AREAS_KEY = ['areas'] as const

export function useAreas() {
  const query = useQuery({
    queryKey: AREAS_KEY,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase.from('areas').select('*').order('position').order('created_at')
      if (error) throw error
      return data as Area[]
    },
  })
  const areas = useMemo(() => query.data ?? [], [query.data])
  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas])
  return { ...query, areas, areasById }
}

function useInvalidateAreas() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: AREAS_KEY })
    // apagar área devolve tarefas pra Inbox
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }
}

export function useCreateArea() {
  const invalidate = useInvalidateAreas()
  return useMutation({
    mutationFn: async (area: Pick<Area, 'name' | 'color' | 'kind' | 'position'>) => {
      const { error } = await supabase.from('areas').insert(area)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}

export function useUpdateArea() {
  const invalidate = useInvalidateAreas()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<Omit<Area, 'id'>> }) => {
      const { error } = await supabase.from('areas').update(changes).eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}

export function useDeleteArea() {
  const invalidate = useInvalidateAreas()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('areas').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}
