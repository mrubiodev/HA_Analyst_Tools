import { create } from 'zustand'
import type { Inventory } from '@/types/ha'

interface InventoryState {
  inventory: Inventory | null
  loading: boolean
  error: string | null
  setInventory: (inv: Inventory) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  clear: () => void
}

export const useInventoryStore = create<InventoryState>()((set) => ({
  inventory: null,
  loading: false,
  error: null,
  setInventory: (inventory) => set({ inventory, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  clear: () => set({ inventory: null, loading: false, error: null }),
}))
