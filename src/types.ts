export type Priority = 1 | 2 | 3 | 4

export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export type AreaKind = 'work' | 'life'

export type TaskKind = 'task' | 'decision' | 'meeting'

export interface Area {
  id: string
  name: string
  color: string
  kind: AreaKind
  position: number
}

export interface Task {
  id: string
  area_id: string | null
  kind: TaskKind
  title: string
  notes: string | null
  priority: Priority
  /** YYYY-MM-DD, na data local */
  due_date: string | null
  /** HH:MM ou HH:MM:SS (o Postgres devolve com segundos) */
  due_time: string | null
  /** estimativa da tarefa ou duração da reunião */
  duration_minutes: number | null
  recurrence: Recurrence | null
  /** YYYY-MM-DD do dia em que a tarefa foi fixada no foco */
  focus_date: string | null
  status: 'open' | 'done'
  completed_at: string | null
  created_at: string
}

export type NewTask = Pick<Task, 'title'> &
  Partial<
    Pick<Task, 'area_id' | 'kind' | 'notes' | 'priority' | 'due_date' | 'due_time' | 'duration_minutes' | 'recurrence'>
  >

export type TaskChanges = Partial<Omit<Task, 'id' | 'created_at'>>

export type StudyStatus = 'active' | 'paused' | 'done'

export interface Study {
  id: string
  title: string
  unit_label: string
  progress: number
  total: number
  target_date: string | null
  status: StudyStatus
  notes: string | null
  created_at: string
}

export type NewStudy = Pick<Study, 'title' | 'total'> & Partial<Pick<Study, 'unit_label' | 'progress' | 'target_date'>>

export type StudyChanges = Partial<Omit<Study, 'id' | 'created_at'>>

export interface UserSettings {
  display_name: string | null
  workday_start: string
  workday_end: string
  lunch_start: string | null
  lunch_end: string | null
}

export const DEFAULT_SETTINGS: UserSettings = {
  display_name: null,
  workday_start: '09:00',
  workday_end: '18:00',
  lunch_start: '12:00',
  lunch_end: '13:00',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: 'Baixa',
  2: 'Média',
  3: 'Alta',
  4: 'Urgente',
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: 'Todo dia',
  weekdays: 'Dias úteis',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
}

export const KIND_LABEL: Record<TaskKind, string> = {
  task: 'Tarefa',
  decision: 'Decisão',
  meeting: 'Reunião',
}
