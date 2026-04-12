import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useInventoryStore } from '@/store/inventoryStore'
import { cn } from '@/lib/utils'

const MODE_COLORS: Record<string, string> = {
  single: 'bg-primary/10 text-primary',
  restart: 'bg-yellow-500/10 text-yellow-400',
  queued: 'bg-blue-500/10 text-blue-400',
  parallel: 'bg-purple-500/10 text-purple-400',
  unknown: 'bg-secondary text-muted-foreground',
}

export function AutomacionesTab() {
  const inventory = useInventoryStore((s) => s.inventory)
  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')

  const automations = useMemo(() => {
    if (!inventory) return []
    return inventory.automations
  }, [inventory])

  const modeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of automations) {
      counts[a.mode] = (counts[a.mode] ?? 0) + 1
    }
    return counts
  }, [automations])

  const neverTriggered = automations.filter((a) => !a.last_triggered).length
  const active = automations.filter((a) => a.state === 'on').length
  const inactive = automations.filter((a) => a.state === 'off').length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return automations.filter((a) => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.entity_id.toLowerCase().includes(q)
      const matchMode = !modeFilter || a.mode === modeFilter
      const matchState = !stateFilter || a.state === stateFilter
      return matchSearch && matchMode && matchState
    })
  }, [automations, search, modeFilter, stateFilter])

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
      <div>
        <h2 className="text-lg font-semibold">Automatizaciones ({automations.length})</h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Activas</p>
            <p className="text-2xl font-bold text-emerald-400">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Inactivas</p>
            <p className="text-2xl font-bold text-yellow-400">{inactive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Nunca disparadas</p>
            <p className="text-2xl font-bold text-destructive">{neverTriggered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Por modo</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(modeCounts).map(([mode, count]) => (
                <span
                  key={mode}
                  className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', MODE_COLORS[mode] ?? MODE_COLORS.unknown)}
                >
                  {mode}: {count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar automatización..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">Todos los modos</option>
          {Object.keys(modeCounts).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="on">on</option>
          <option value="off">off</option>
        </select>
        <span className="text-sm text-muted-foreground flex items-center">{filtered.length} resultados</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">entity_id</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Estado</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Modo</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Última ejecución</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Área</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const neverRun = !a.last_triggered
                  return (
                    <tr
                      key={a.entity_id}
                      className={cn(
                        'border-b border-border/50 transition-colors',
                        neverRun ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-accent/30',
                      )}
                    >
                      <td className="px-4 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          {neverRun && (
                            <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                          )}
                          {a.name}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-primary">{a.entity_id}</td>
                      <td className="px-4 py-2">
                        <Badge variant={a.state === 'on' ? 'success' : 'warning'}>{a.state}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', MODE_COLORS[a.mode] ?? MODE_COLORS.unknown)}>
                          {a.mode}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {a.last_triggered
                          ? new Date(a.last_triggered).toLocaleString('es-ES')
                          : <span className="text-destructive">Nunca</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{a.area_name ?? '—'}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay automatizaciones que coincidan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
