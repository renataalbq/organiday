import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { takePendingSignup } from '../lib/landing/pendingSignup'
import { parseQuickAdd } from '../lib/quickAdd/parseQuickAdd'
import type { Area } from '../types'

/**
 * Quem preencheu nome, expediente ou a primeira tarefa na página de entrada e depois logou:
 * aplica uma vez e esquece (ver src/lib/landing/pendingSignup.ts).
 */
export function usePendingSignup(userId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const pending = takePendingSignup()
    if (!pending) return

    const apply = async () => {
      const settings: Record<string, string> = {}
      if (pending.displayName) settings.display_name = pending.displayName.slice(0, 40)
      if (pending.workdayStart && pending.workdayEnd && pending.workdayStart < pending.workdayEnd) {
        settings.workday_start = pending.workdayStart
        settings.workday_end = pending.workdayEnd
      }
      if (Object.keys(settings).length > 0)
        await supabase.from('user_settings').upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' })

      if (pending.firstTask) {
        const { data: areas } = await supabase.from('areas').select('*').order('position')
        const parsed = parseQuickAdd(pending.firstTask, (areas ?? []) as Area[])
        if (parsed.title) {
          await supabase.from('tasks').insert({
            title: parsed.title,
            kind: parsed.kind,
            area_id: parsed.areaId,
            priority: parsed.priority ?? 2,
            due_date: parsed.dueDate,
            due_time: parsed.dueTime,
            recurrence: parsed.recurrence,
            duration_minutes: parsed.durationMinutes,
          })
        }
      }
      await queryClient.invalidateQueries()
    }

    apply().catch(() => {
      // é só uma ajuda pra começar: se falhar, a pessoa preenche no app
    })
  }, [userId, queryClient])
}
