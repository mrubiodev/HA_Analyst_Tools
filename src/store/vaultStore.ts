import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface VaultState {
  url: string
  token: string
  connected: boolean
  connecting: boolean
  error: string | null
  setUrl: (url: string) => void
  setToken: (token: string) => void
  setConnected: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setError: (e: string | null) => void
  clear: () => void
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set) => ({
      url: '',
      token: '',
      connected: false,
      connecting: false,
      error: null,
      setUrl: (url) => set({ url }),
      setToken: (token) => set({ token }),
      setConnected: (connected) => set({ connected }),
      setConnecting: (connecting) => set({ connecting }),
      setError: (error) => set({ error }),
      clear: () => set({ url: '', token: '', connected: false, error: null }),
    }),
    {
      name: 'ha-vault',
      // Only persist url; token stored separately in sessionStorage
      partialize: (s) => ({ url: s.url }),
    },
  ),
)

// Token is kept in sessionStorage separately (more secure — cleared on tab close)
export const vaultToken = {
  get: () => sessionStorage.getItem('ha-token') ?? '',
  set: (t: string) => sessionStorage.setItem('ha-token', t),
  clear: () => sessionStorage.removeItem('ha-token'),
}
