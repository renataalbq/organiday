import { lazy, Suspense, useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SessionProvider, useSession } from './auth/SessionProvider'
import { AppShell } from './components/AppShell'
import { TaskEditorProvider } from './components/TaskEditor'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { OAuthConsentPage } from './pages/OAuthConsentPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudiesPage } from './pages/StudiesPage'
import { TasksPage } from './pages/TasksPage'
import { TodayPage } from './pages/TodayPage'
import { usePendingSignup } from './hooks/usePendingSignup'
import { useSystemThemeSync } from './hooks/useTheme'

// a tela Dia carrega o editor de notas (Tiptap), que é pesado: só baixa quando abre
const DayPage = lazy(() => import('./pages/DayPage').then((module) => ({ default: module.DayPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

function AuthenticatedApp({ userId }: { userId: string }) {
  usePendingSignup(userId)
  return (
    <TaskEditorProvider>
      <AppShell>
        <Suspense fallback={<p className="p-2 text-ink-soft">Carregando…</p>}>
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/semana" element={<DayPage />} />
            <Route path="/semana/:date" element={<DayPage />} />
            <Route path="/dia" element={<Navigate to="/semana" replace />} />
            <Route path="/dia/:date" element={<LegacyDayRedirect />} />
            <Route path="/tarefas" element={<TasksPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/estudos" element={<StudiesPage />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </TaskEditorProvider>
  )
}

/** a tela Dia virou Semana: links antigos continuam funcionando */
function LegacyDayRedirect() {
  const { date } = useParams()
  return <Navigate to={`/semana/${date ?? ''}`} replace />
}

const RETURN_TO_KEY = 'organiday:return-to'
const RETURN_TO_MAX_AGE_MS = 15 * 60_000
const CONSENT_PATH = '/oauth/consent'

/**
 * O login (Google ou link por e-mail) sempre volta pra raiz do site. Quem chegou pela tela de
 * consentimento do MCP precisa voltar pra ela depois de entrar: guarda o endereço antes.
 */
function useReturnAfterLogin(isLoggedIn: boolean, isLoading: boolean) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (!isLoggedIn) {
      if (location.pathname === CONSENT_PATH)
        localStorage.setItem(RETURN_TO_KEY, JSON.stringify({ path: location.pathname + location.search, at: Date.now() }))
      return
    }
    const saved = localStorage.getItem(RETURN_TO_KEY)
    if (!saved) return
    localStorage.removeItem(RETURN_TO_KEY)
    try {
      const { path, at } = JSON.parse(saved) as { path: string; at: number }
      if (path.startsWith(CONSENT_PATH) && Date.now() - at < RETURN_TO_MAX_AGE_MS && location.pathname !== CONSENT_PATH)
        navigate(path, { replace: true })
    } catch {
      // valor velho ou corrompido: ignora
    }
  }, [isLoggedIn, isLoading, location.pathname, location.search, navigate])
}

function SessionGate() {
  const { session, isLoading } = useSession()
  const location = useLocation()
  const userId = session?.user.id
  const previousUserId = useRef(userId)
  useReturnAfterLogin(Boolean(session), isLoading)

  // trocou de conta ou saiu: não deixa dados da sessão anterior no cache
  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) queryClient.clear()
    previousUserId.current = userId
  }, [userId])

  if (isLoading) return null
  if (!session) return <LoginPage />
  return location.pathname === CONSENT_PATH ? <OAuthConsentPage /> : <AuthenticatedApp userId={session.user.id} />
}

export default function App() {
  useSystemThemeSync()

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <SessionGate />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  )
}
