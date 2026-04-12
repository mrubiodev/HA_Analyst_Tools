import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Dev helper: when running in Vite dev mode, allow pre-populating the
// Vault URL and token from VITE_HA_DEV_BASE and VITE_HA_DEV_TOKEN environment
// variables. This makes it easier to reproduce proxied API calls locally.
if (import.meta.env.DEV) {
  try {
    const base = (import.meta.env as any).VITE_HA_DEV_BASE as string | undefined
    const token = (import.meta.env as any).VITE_HA_DEV_TOKEN as string | undefined
    if (base) {
      localStorage.setItem('ha-vault', JSON.stringify({ url: base }))
    }
    if (token) {
      sessionStorage.setItem('ha-token', token)
    }
  } catch (e) {
    // ignore
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
