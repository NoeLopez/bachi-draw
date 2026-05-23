import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Aplica el tema sincrónicamente antes del primer paint para evitar flash.
// La lógica reactiva del toggle vive en core/theme/useTheme.
;(function initTheme(): void {
  try {
    const stored = window.localStorage.getItem('bachi-draw.theme')
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored)
      return
    }
  } catch {
    /* localStorage puede no estar disponible */
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
