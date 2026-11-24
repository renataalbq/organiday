/**
 * Tema claro/escuro. A preferência fica no aparelho (localStorage).
 * "system" segue o modo do celular/computador.
 * O mesmo cálculo roda num script inline no index.html antes do app carregar,
 * para a página não piscar branca ao abrir no escuro.
 */
export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'organiday:theme'

/** cor da barra do navegador/status bar em cada tema (= --color-canvas) */
const THEME_COLOR: Record<Theme, string> = { light: '#EBEBE7', dark: '#111113' }

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== 'system') return preference
  return darkQuery().matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // modo privado sem storage: vale só até fechar
  }
  applyTheme(resolveTheme(preference))
}

/** Reaplica quando o sistema troca de modo (só importa se a preferência for "system"). */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
