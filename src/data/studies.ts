import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { NewStudy, Study, StudyChanges } from '../types'

const STUDIES_KEY = ['studies'] as const

export function useStudies() {
  return useQuery({
    queryKey: STUDIES_KEY,
    queryFn: async (): Promise<Study[]> => {
      const { data, error } = await supabase.from('studies').select('*').order('created_at')
      if (error) throw error
      return data as Study[]
    },
  })
}

export function useCreateStudy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (study: NewStudy) => {
      const { error } = await supabase.from('studies').insert(study)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: STUDIES_KEY }),
  })
}

export function useUpdateStudy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: StudyChanges }) => {
      const { error } = await supabase.from('studies').update(changes).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: STUDIES_KEY })
      const previous = queryClient.getQueryData<Study[]>(STUDIES_KEY)
      if (previous) {
        queryClient.setQueryData<Study[]>(
          STUDIES_KEY,
          previous.map((study) => (study.id === id ? { ...study, ...changes } : study)),
        )
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(STUDIES_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: STUDIES_KEY }),
  })
}

export function useDeleteStudy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('studies').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: STUDIES_KEY })
      const previous = queryClient.getQueryData<Study[]>(STUDIES_KEY)
      if (previous) queryClient.setQueryData<Study[]>(STUDIES_KEY, previous.filter((study) => study.id !== id))
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(STUDIES_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: STUDIES_KEY }),
  })
}
