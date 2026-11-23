import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CalendarEvent } from '../lib/calendar/expandIcs'
import { addDays, fromISODate, toISODate } from '../lib/dates'
import { DEFAULT_MEETING_MINUTES } from '../lib/dayBudget/dayBudget'
import { supabase } from '../lib/supabase'
import type { CalendarFeed, NewCalendarFeed, Task } from '../types'

const FEEDS_KEY = ['calendar-feeds'] as const
const EVENTS_KEY = ['calendar-events'] as const

/** PostgREST quando a tabela ainda não existe (migration 0005 não rodou) */
export const isMissingTableError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'PGRST205'

export function useCalendarFeeds() {
  const query = useQuery({
    queryKey: FEEDS_KEY,
    queryFn: async (): Promise<CalendarFeed[]> => {
      const { data, error } = await supabase
        .from('calendar_feeds')
        .select('id, name, url, color, area_id, created_at')
        .order('created_at')
      if (error) throw error
      return data as CalendarFeed[]
    },
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  })
  const feeds = useMemo(() => query.data ?? [], [query.data])
  return { ...query, feeds, isTableMissing: isMissingTableError(query.error) }
}

function useInvalidateCalendar() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: FEEDS_KEY })
    queryClient.invalidateQueries({ queryKey: EVENTS_KEY })
  }
}

export function useCreateCalendarFeed() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (feed: NewCalendarFeed) => {
      const { error } = await supabase.from('calendar_feeds').insert(feed)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}

export function useUpdateCalendarFeed() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string
      changes: Partial<Pick<CalendarFeed, 'name' | 'color' | 'area_id'>>
    }) => {
      const { error } = await supabase.from('calendar_feeds').update(changes).eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}

export function useDeleteCalendarFeed() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_feeds').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}

/** Segunda a domingo da semana de `iso`: uma busca serve a semana toda. */
export function weekRangeOf(iso: string): { from: string; to: string } {
  const date = fromISODate(iso)
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return { from: toISODate(monday), to: toISODate(addDays(monday, 6)) }
}

interface FeedEvents {
  feedId: string
  events: CalendarEvent[]
  error: string | null
}

async function fetchCalendarEvents(from: string, to: string): Promise<FeedEvents[]> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return []
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const params = new URLSearchParams({ from, to, tz: timeZone })
  const response = await fetch(`/api/calendar-events?${params}`, { headers: { authorization: `Bearer ${token}` } })
  const body = (await response.json().catch(() => ({}))) as { feeds?: FeedEvents[]; error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Não deu pra carregar os calendários.')
  return body.feeds ?? []
}

/** Ocorrência de calendário no formato de reunião, só leitura. */
function toMeeting(event: CalendarEvent, feed: CalendarFeed): Task {
  return {
    id: `cal:${feed.id}:${event.id}`,
    area_id: feed.area_id,
    kind: 'meeting',
    title: event.title,
    notes: event.location,
    priority: 2,
    due_date: event.date,
    due_time: event.time,
    duration_minutes: event.durationMinutes || DEFAULT_MEETING_MINUTES,
    recurrence: null,
    focus_date: null,
    status: 'open',
    completed_at: null,
    created_at: event.start,
    started_at: null,
    blocked_reason: null,
    external: { feedId: feed.id, feedName: feed.name, color: feed.color, location: event.location },
  }
}

/**
 * Reuniões dos calendários conectados, para a semana de `day`.
 * Eventos de dia inteiro ficam de fora: não ocupam horário no expediente.
 */
export function useCalendarMeetings(day: string) {
  const { feeds } = useCalendarFeeds()
  const { from, to } = weekRangeOf(day)

  const query = useQuery({
    queryKey: [...EVENTS_KEY, from, to, feeds.map((feed) => feed.id).join(',')],
    queryFn: () => fetchCalendarEvents(from, to),
    enabled: feeds.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  })

  const meetings = useMemo(() => {
    const feedsById = new Map(feeds.map((feed) => [feed.id, feed]))
    return (query.data ?? []).flatMap(({ feedId, events }) => {
      const feed = feedsById.get(feedId)
      return feed ? events.filter((event) => !event.allDay).map((event) => toMeeting(event, feed)) : []
    })
  }, [query.data, feeds])

  const errorsByFeed = useMemo(
    () => new Map((query.data ?? []).filter((item) => item.error).map((item) => [item.feedId, item.error!])),
    [query.data],
  )

  return { meetings, errorsByFeed, isFetching: query.isFetching, error: query.error, refetch: query.refetch }
}
