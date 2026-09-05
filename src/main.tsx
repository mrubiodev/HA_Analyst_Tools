import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev helper: when running in Vite dev mode, allow pre-populating the
// Vault URL and token from VITE_HA_DEV_BASE and VITE_HA_DEV_TOKEN environment
// variables. This makes it easier to reproduce proxied API calls locally.
if (import.meta.env.DEV) {
  try {
    const env = import.meta.env as Record<string, unknown>
    const base = typeof env.VITE_HA_DEV_BASE === 'string' ? env.VITE_HA_DEV_BASE : undefined
    const token = typeof env.VITE_HA_DEV_TOKEN === 'string' ? env.VITE_HA_DEV_TOKEN : undefined
    if (base) {
      localStorage.setItem('ha-vault', JSON.stringify({ url: base }))
    }
    if (token) {
      sessionStorage.setItem('ha-token', token)
    }
  } catch {
    /* ignore */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
