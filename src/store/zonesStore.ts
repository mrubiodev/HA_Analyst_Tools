import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Zone, ZoneType } from '@/types/ha'

interface ZonesState {
  zones: Zone[]
  addZone: (zone: Zone) => void
  updateZone: (id: string, patch: Partial<Zone>) => void
  removeZone: (id: string) => void
  assignEntity: (zoneId: string, entityId: string) => void
  unassignEntity: (entityId: string) => void
  setZones: (zones: Zone[]) => void
}

export const useZonesStore = create<ZonesState>()(
  persist(
    (set) => ({
      zones: [],
      addZone: (zone) => set((s) => ({ zones: [...s.zones, zone] })),
      updateZone: (id, patch) =>
        set((s) => ({
          zones: s.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
        })),
      removeZone: (id) =>
        set((s) => ({ zones: s.zones.filter((z) => z.id !== id) })),
      assignEntity: (zoneId, entityId) =>
        set((s) => ({
          zones: s.zones.map((z) =>
            z.id === zoneId
              ? { ...z, entity_ids: Array.from(new Set([...z.entity_ids, entityId])) }
              : { ...z, entity_ids: z.entity_ids.filter((e) => e !== entityId) },
          ),
        })),
      unassignEntity: (entityId) =>
        set((s) => ({
          zones: s.zones.map((z) => ({
            ...z,
            entity_ids: z.entity_ids.filter((e) => e !== entityId),
          })),
        })),
      setZones: (zones) => set({ zones }),
    }),
    { name: 'ha-zones' },
  ),
)

export function createZoneFromArea(areaId: string, name: string): Zone {
  return {
    id: areaId,
    name,
    type: 'interior' as ZoneType,
    orientation: '',
    entity_ids: [],
    notes: '',
  }
}
