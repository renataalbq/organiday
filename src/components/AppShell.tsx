import type { ReactNode } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useAreas } from '../data/areas'
import { useTasks } from '../data/tasks'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: IconName
  count?: number
}

function useNavCounts() {
  const { data: tasks = [] } = useTasks()
  const open = tasks.filter((task) => task.status === 'open' && task.kind === 'task')
  const byArea = new Map<string, number>()
  for (const task of open) {
    if (task.area_id) byArea.set(task.area_id, (byArea.get(task.area_id) ?? 0) + 1)
  }
  return {
    tasks: open.length,
    inbox: tasks.filter((task) => task.status === 'open' && task.area_id === null).length,
    byArea,
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const counts = useNavCounts()
  const mainItems: NavItem[] = [
    { to: '/', label: 'Hoje', icon: 'today' },
    { to: '/semana', label: 'Semana', icon: 'calendar' },
    { to: '/tarefas', label: 'Tarefas', icon: 'tasks', count: counts.tasks },
    { to: '/inbox', label: 'Inbox', icon: 'inbox', count: counts.inbox },
    { to: '/estudos', label: 'Estudos', icon: 'study' },
  ]

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar items={mainItems} areaCounts={counts.byArea} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/95 px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur lg:hidden">
          <Logo markSize={28} className="text-lg" />
          <NavLink to="/ajustes" className="button-quiet p-2" aria-label="Ajustes">
            <Icon name="settings" />
          </NavLink>
        </div>

        <main className="mx-auto w-full max-w-[1160px] flex-1 px-4 pt-5 pb-28 sm:px-8 lg:px-14 lg:pt-9 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileTabBar items={mainItems} />
    </div>
  )
}

function Sidebar({ items, areaCounts }: { items: NavItem[]; areaCounts: Map<string, number> }) {
  const { areas } = useAreas()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const activeAreaId = location.pathname === '/tarefas' ? searchParams.get('area') : null

  return (
    <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col overflow-y-auto border-r border-line bg-card px-4 py-7 lg:flex">
      <div className="mb-9 px-2">
        <Logo markSize={28} className="text-lg" />
      </div>

      <nav className="space-y-1">
        {items.map((item) => (
          <SidebarLink
            key={item.to}
            {...item}
            isActive={item.to === '/tarefas' ? location.pathname === '/tarefas' && !activeAreaId : undefined}
          />
        ))}
      </nav>

      {areas.length > 0 && (
        <>
          <p className="eyebrow mt-9 mb-3 px-2.5 text-[10.5px]">Áreas</p>
          <nav className="space-y-1">
            {areas.map((area) => {
              const count = areaCounts.get(area.id) ?? 0
              return (
                <NavLink
                  key={area.id}
                  to={`/tarefas?area=${area.id}`}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    activeAreaId === area.id ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-hover'
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
                  <span className="min-w-0 flex-1 truncate">{area.name}</span>
                  {count > 0 && <span className="text-xs text-ink-soft tabular-nums">{count}</span>}
                </NavLink>
              )
            })}
          </nav>
        </>
      )}

      <div className="mt-auto pt-6">
        <SidebarLink to="/ajustes" label="Ajustes" icon="settings" />
      </div>
    </aside>
  )
}

function SidebarLink({ to, label, icon, count, isActive }: NavItem & { isActive?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive: routeActive }) =>
        `flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
          (isActive ?? routeActive) ? 'bg-accent-soft font-semibold text-ink' : 'text-ink hover:bg-hover'
        }`
      }
    >
      <Icon name={icon} size={17} className="text-ink-soft" />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && <span className="text-xs text-ink-soft tabular-nums">{count}</span>}
    </NavLink>
  )
}

function MobileTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-ink-faint'}`
            }
          >
            <Icon name={item.icon} size={21} />
            {item.label}
            {item.count !== undefined && item.count > 0 && item.to === '/inbox' && (
              <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">
                {item.count}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
