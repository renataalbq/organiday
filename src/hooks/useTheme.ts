import { useCallback, useEffect, useState } from 'react'
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from '../lib/theme'

/** Na raiz do app: segue o modo do sistema quando a preferência salva é "system". */
export function useSystemThemeSync() {
  useEffect(() => watchSystemTheme(() => applyTheme(resolveTheme(readThemePreference()))), [])
}

/** Para a tela de Ajustes: lê e troca a preferência. */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference)

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next)
    setPreferenceState(next)
  }, [])

  return { preference, setPreference }
}
