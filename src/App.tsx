import { useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './auth/SessionProvider'
import { AppShell } from './components/AppShell'
import { TaskEditorProvider } from './components/TaskEditor'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudiesPage } from './pages/StudiesPage'
import { TasksPage } from './pages/TasksPage'
import { TodayPage } from './pages/TodayPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

function AuthenticatedApp() {
  return (
    <TaskEditorProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/tarefas" element={<TasksPage />} />
          <Route path="/inbox" element={<TasksPage inboxOnly />} />
          <Route path="/estudos" element={<StudiesPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </TaskEditorProvider>
  )
}

function SessionGate() {
  const { session, isLoading } = useSession()
  const userId = session?.user.id
  const previousUserId = useRef(userId)

  // trocou de conta ou saiu: não deixa dados da sessão anterior no cache
  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) queryClient.clear()
    previousUserId.current = userId
  }, [userId])

  if (isLoading) return null
  return session ? <AuthenticatedApp /> : <LoginPage />
}

export default function App() {
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
