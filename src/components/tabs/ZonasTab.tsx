import { useState, useMemo } from 'react'
import { AlertCircle, Plus, Trash2, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useInventoryStore } from '@/store/inventoryStore'
import { useZonesStore, createZoneFromArea } from '@/store/zonesStore'
import type { ZoneType } from '@/types/ha'
import { cn } from '@/lib/utils'

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  fachada: '🌅 Fachada exterior',
  mixta: '🔀 Mixta',
  interior: '🏠 Interior',
}

const ZONE_TYPE_COLORS: Record<ZoneType, string> = {
  fachada: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  mixta: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  interior: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

export function ZonasTab() {
  const inventory = useInventoryStore((s) => s.inventory)
  const { zones, addZone, updateZone, removeZone, assignEntity, unassignEntity } = useZonesStore()
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [entitySearch, setEntitySearch] = useState('')
  const [newZoneName, setNewZoneName] = useState('')

  const allEntities = useMemo(() => {
    if (!inventory) return []
    return [...inventory.sensors, ...inventory.actuators, ...inventory.others]
  }, [inventory])

  const assignedEntityIds = useMemo(() => {
    return new Set(zones.flatMap((z) => z.entity_ids))
  }, [zones])

  const unassignedEntities = useMemo(() => {
    const q = entitySearch.toLowerCase()
    return allEntities.filter(
      (e) =>
        !assignedEntityIds.has(e.entity_id) &&
        (!q || e.entity_id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)),
    )
  }, [allEntities, assignedEntityIds, entitySearch])

  const activeZone = useMemo(() => {
    return zones.find((z) => z.id === selectedZone)
  }, [zones, selectedZone])

  function handleImportFromAreas() {
    if (!inventory) return
    for (const area of inventory.areas) {
      if (!zones.find((z) => z.id === area.area_id)) {
        addZone(createZoneFromArea(area.area_id, area.name))
      }
    }
  }

  function handleAddZone() {
    if (!newZoneName.trim()) return
    addZone({
      id: `zone_${Date.now()}`,
      name: newZoneName.trim(),
      type: 'interior',
      orientation: '',
      entity_ids: [],
      notes: '',
    })
    setNewZoneName('')
  }

  if (!inventory) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p>Conecta a Home Assistant primero (pestaña Vault)</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Zonas físicas</h2>
          <p className="text-sm text-muted-foreground">Asigna entidades a zonas según el modelo físico de tu apartamento</p>
        </div>
        {inventory.areas.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleImportFromAreas}>
            Importar áreas de HA ({inventory.areas.length})
          </Button>
        )}
      </div>

      {/* Zone model info */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 flex gap-3">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-blue-400">Zonas físicas personalizables</p>
            <p className="text-muted-foreground text-xs">
              Organiza tu instalación agrupando entidades por espacio físico: habitaciones, plantas, fachadas o cualquier criterio que se adapte a tu vivienda.
              Asigna un tipo (interior, fachada exterior o mixta) y una orientación opcional para visualizar cómo interactúan los sensores y actuadores de cada zona.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Zones list */}
        <div className="space-y-3">
          {/* Add zone */}
          <div className="flex gap-2">
            <Input
              placeholder="Nueva zona..."
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddZone()}
            />
            <Button size="icon" onClick={handleAddZone}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {zones.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay zonas. Añade una o importa las áreas de HA.
            </p>
          )}

          {zones.map((zone) => (
            <Card
              key={zone.id}
              className={cn(
                'cursor-pointer transition-colors',
                selectedZone === zone.id ? 'ring-1 ring-primary' : 'hover:border-primary/50',
              )}
              onClick={() => setSelectedZone(zone.id === selectedZone ? null : zone.id)}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{zone.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeZone(zone.id) }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs', ZONE_TYPE_COLORS[zone.type])}>
                  {ZONE_TYPE_LABELS[zone.type]}
                </div>
                {zone.orientation && (
                  <p className="text-xs text-muted-foreground">↗ {zone.orientation}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {zone.entity_ids.length} entidades asignadas
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Zone detail */}
        <div className="lg:col-span-2">
          {!activeZone ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Selecciona una zona para editarla
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{activeZone.name}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Tipo de zona</label>
                    <select
                      value={activeZone.type}
                      onChange={(e) => updateZone(activeZone.id, { type: e.target.value as ZoneType })}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="fachada">Fachada exterior</option>
                      <option value="mixta">Mixta</option>
                      <option value="interior">Interior</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Orientación</label>
                    <Input
                      placeholder="sur, este, noroeste..."
                      value={activeZone.orientation}
                      onChange={(e) => updateZone(activeZone.id, { orientation: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Notas físicas</label>
                    <textarea
                      className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="ej: recibe sol directo 14-18h en verano"
                      value={activeZone.notes}
                      onChange={(e) => updateZone(activeZone.id, { notes: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Assigned entities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Entidades asignadas ({activeZone.entity_ids.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 max-h-40 overflow-auto">
                  {activeZone.entity_ids.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin entidades asignadas</p>
                  )}
                  {activeZone.entity_ids.map((eid) => {
                    const entity = allEntities.find((e) => e.entity_id === eid)
                    return (
                      <div key={eid} className="flex items-center justify-between">
                        <span className="font-mono text-xs text-primary">{eid}</span>
                        <div className="flex items-center gap-2">
                          {entity && <Badge variant="secondary">{entity.domain}</Badge>}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => unassignEntity(eid)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Unassigned entities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Añadir entidades sin zona ({unassignedEntities.length})</CardTitle>
                  <Input
                    placeholder="Buscar..."
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    className="mt-2"
                  />
                </CardHeader>
                <CardContent className="space-y-1 max-h-52 overflow-auto p-3">
                  {unassignedEntities.slice(0, 100).map((e) => (
                    <div
                      key={e.entity_id}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent/30 cursor-pointer"
                      onClick={() => assignEntity(activeZone.id, e.entity_id)}
                    >
                      <div>
                        <span className="font-mono text-xs text-primary">{e.entity_id}</span>
                        <span className="text-xs text-muted-foreground ml-2">{e.name}</span>
                      </div>
                      <Plus className="w-3 h-3 text-muted-foreground" />
                    </div>
                  ))}
                  {unassignedEntities.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{unassignedEntities.length - 100} más — usa la búsqueda para filtrar
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
