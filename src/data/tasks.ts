import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { addDays, toISODate } from '../lib/dates'
import type { NewTask, Task, TaskChanges } from '../types'

const TASKS_KEY = ['tasks'] as const
const DONE_HISTORY_DAYS = 14

async function fetchTasks(): Promise<Task[]> {
  const doneSince = addDays(new Date(), -DONE_HISTORY_DAYS).toISOString()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .or(`status.eq.open,completed_at.gte.${doneSince}`)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Task[]
}

/** Abertas + concluídas nas últimas 2 semanas. Para uso pessoal, cabe tudo na memória. */
export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks })
}

function useOptimisticTasks() {
  const queryClient = useQueryClient()

  const patchCache = async (update: (tasks: Task[]) => Task[]) => {
    await queryClient.cancelQueries({ queryKey: TASKS_KEY })
    const previous = queryClient.getQueryData<Task[]>(TASKS_KEY)
    if (previous) queryClient.setQueryData<Task[]>(TASKS_KEY, update(previous))
    return { previous }
  }

  const rollback = (_error: unknown, _variables: unknown, context?: { previous?: Task[] }) => {
    if (context?.previous) queryClient.setQueryData(TASKS_KEY, context.previous)
  }

  const refetch = () => queryClient.invalidateQueries({ queryKey: TASKS_KEY })

  return { patchCache, rollback, refetch }
}

export function useCreateTask() {
  const { refetch } = useOptimisticTasks()
  return useMutation({
    mutationFn: async (newTask: NewTask) => {
      const { error } = await supabase.from('tasks').insert(newTask)
      if (error) throw error
    },
    onSettled: refetch,
  })
}

export function useUpdateTask() {
  const { patchCache, rollback, refetch } = useOptimisticTasks()
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: TaskChanges }) => {
      const { error } = await supabase.from('tasks').update(changes).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, changes }) =>
      patchCache((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...changes } : task))),
    onError: rollback,
    onSettled: refetch,
  })
}

export function useCompleteTask() {
  const { patchCache, rollback, refetch } = useOptimisticTasks()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('complete_task', { p_task_id: id, p_today: toISODate(new Date()) })
      if (error) throw error
    },
    onMutate: (id) =>
      patchCache((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, status: 'done', completed_at: new Date().toISOString() } : task,
        ),
      ),
    onError: rollback,
    onSettled: refetch,
  })
}

export function useReopenTask() {
  const updateTask = useUpdateTask()
  return {
    ...updateTask,
    mutate: (id: string) => updateTask.mutate({ id, changes: { status: 'open', completed_at: null } }),
  }
}

export function useDeleteTask() {
  const { patchCache, rollback, refetch } = useOptimisticTasks()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => patchCache((tasks) => tasks.filter((task) => task.id !== id)),
    onError: rollback,
    onSettled: refetch,
  })
}
