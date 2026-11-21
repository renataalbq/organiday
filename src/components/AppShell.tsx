import type { ReactNode } from 'react'
import { NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { useAreas } from '../data/areas'
import { useTasks } from '../data/tasks'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { QuickAdd } from './QuickAdd'

interface NavItem {
  to: string
  label: string
  icon: IconName
  count?: number
}

function useNavCounts() {
  const { data: tasks = [] } = useTasks()
  const open = tasks.filter((task) => task.status === 'open')
  return {
    tasks: open.filter((task) => task.kind === 'task').length,
    inbox: open.filter((task) => task.area_id === null).length,
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const counts = useNavCounts()
  const mainItems: NavItem[] = [
    { to: '/', label: 'Hoje', icon: 'today' },
    { to: '/dia', label: 'Dia', icon: 'calendar' },
    { to: '/tarefas', label: 'Tarefas', icon: 'tasks', count: counts.tasks },
    { to: '/inbox', label: 'Inbox', icon: 'inbox', count: counts.inbox },
    { to: '/estudos', label: 'Estudos', icon: 'study' },
  ]

  return (
    <div className="min-h-dvh">
      <div className="flex min-h-dvh">
        <Sidebar items={mainItems} />

        <div className="flex min-w-0 flex-1 flex-col bg-paper">
          <div className="sticky top-0 z-20 border-b border-line/60 bg-paper/95 px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur sm:px-6 lg:static lg:border-0 lg:bg-transparent lg:pt-5 lg:backdrop-blur-none">
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <Logo markSize={28} className="text-2xl text-lilac-deep" />
              <NavLink to="/ajustes" className="button-quiet p-2" aria-label="Ajustes">
                <Icon name="settings" />
              </NavLink>
            </div>
            <div className="max-w-2xl">
              <QuickAdd />
            </div>
          </div>

          <main className="flex-1 px-4 pt-2 pb-28 sm:px-6 lg:pb-8">{children}</main>
        </div>
      </div>

      <MobileTabBar items={mainItems} />
    </div>
  )
}

function Sidebar({ items }: { items: NavItem[] }) {
  const { areas } = useAreas()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const activeAreaId = location.pathname === '/tarefas' ? searchParams.get('area') : null

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-lilac px-4 py-6 text-lilac-ink lg:flex">
      <div className="mb-8 px-2">
        <Logo markSize={32} className="text-[1.75rem] leading-none" />
      </div>

      <p className="eyebrow mb-2 px-2 text-lilac-ink/60">Geral</p>
      <nav className="space-y-0.5">
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
          <p className="eyebrow mt-7 mb-2 px-2 text-lilac-ink/60">Áreas</p>
          <nav className="space-y-0.5">
            {areas.map((area) => (
              <NavLink
                key={area.id}
                to={`/tarefas?area=${area.id}`}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                  activeAreaId === area.id ? 'bg-paper text-ink' : 'hover:bg-white/45'
                }`}
              >
                <span className="size-2.5 rounded-full ring-2 ring-white/80" style={{ backgroundColor: area.color }} />
                {area.name}
              </NavLink>
            ))}
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
        `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
          (isActive ?? routeActive) ? 'bg-paper text-ink' : 'hover:bg-white/45'
        }`
      }
    >
      <Icon name={icon} size={17} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-peach-deep px-1.5 text-[11px] font-bold text-peach-ink">
          {count}
        </span>
      )}
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
              `relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-lilac-deep' : 'text-ink-faint'}`
            }
          >
            <Icon name={item.icon} size={21} />
            {item.label}
            {item.count !== undefined && item.count > 0 && item.to === '/inbox' && (
              <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-4 place-items-center rounded-full bg-peach-deep px-1 text-[10px] text-ink">
                {item.count}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
