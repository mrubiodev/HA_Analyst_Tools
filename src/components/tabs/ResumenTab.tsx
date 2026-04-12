import { useState, useMemo, useEffect } from 'react'
import { AlertCircle, Activity, Zap, Eye, Home, Layers, X, FileText, Filter, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useInventoryStore } from '@/store/inventoryStore'
import { cn, loadJsonStorage, saveJsonStorage } from '@/lib/utils'
import { exportTableToMarkdown } from '@/lib/exporters'

type EntityColumn = 'entity_id' | 'name' | 'domain' | 'state' | 'area_name' | 'area_id' | 'unit' | 'device_class' | 'last_updated' | 'last_changed' | 'icon' | 'supported_features' | 'category'
type FilterOperator = 'contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'not_empty'
type FilterRule = { id: string; field: EntityColumn; operator: FilterOperator; value: string }

const ENTITY_COLUMNS: Array<{ key: EntityColumn; label: string }> = [
  { key: 'entity_id', label: 'entity_id' },
  { key: 'name', label: 'Nombre' },
  { key: 'domain', label: 'Dominio' },
  { key: 'state', label: 'Estado' },
  { key: 'area_name', label: 'Área' },
  { key: 'area_id', label: 'area_id' },
  { key: 'unit', label: 'Unidad' },
  { key: 'device_class', label: 'Device class' },
  { key: 'last_updated', label: 'Actualizado' },
  { key: 'last_changed', label: 'Cambio' },
  { key: 'icon', label: 'Icono' },
  { key: 'supported_features', label: 'Supported features' },
  { key: 'category', label: 'Tipo' },
]

const DEFAULT_VISIBLE_COLUMNS: EntityColumn[] = ['entity_id', 'name', 'domain', 'state', 'area_name', 'unit', 'device_class', 'last_updated', 'category']
const RESUMEN_VISIBLE_COLUMNS_KEY = 'ha-resumen-visible-columns'
const RESUMEN_FILTER_RULES_KEY = 'ha-resumen-filter-rules'
const RESUMEN_FILTERS_OPEN_KEY = 'ha-resumen-filters-open'

const FILTER_OPERATORS: Array<{ key: FilterOperator; label: string }> = [
  { key: 'contains', label: 'contiene' },
  { key: 'equals', label: '=' },
  { key: 'not_equals', label: '!=' },
  { key: 'starts_with', label: '^ empieza' },
  { key: 'ends_with', label: '$ termina' },
  { key: 'gt', label: '>' },
  { key: 'gte', label: '>=' },
  { key: 'lt', label: '<' },
  { key: 'lte', label: '<=' },
  { key: 'empty', label: 'vacío' },
  { key: 'not_empty', label: 'no vacío' },
]

function formatEntityDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-ES')
}

function getEntityAttr(entity: Record<string, unknown>, key: 'icon' | 'supported_features'): string {
  const attributes = entity['attributes'] as Record<string, unknown> | undefined
  const value = attributes?.[key]
  if (value === undefined || value === null || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function getColumnValue(entity: Record<string, unknown>, column: EntityColumn): string {
  switch (column) {
    case 'entity_id': return String(entity['entity_id'] ?? '—')
    case 'name': return String(entity['name'] ?? '—')
    case 'domain': return String(entity['domain'] ?? '—')
    case 'state': return String(entity['state'] ?? '—')
    case 'area_name': return String(entity['area_name'] ?? '—')
    case 'area_id': return String(entity['area_id'] ?? '—')
    case 'unit': return String(entity['unit'] ?? '—')
    case 'device_class': return String(entity['device_class'] ?? '—')
    case 'last_updated': return formatEntityDate(String(entity['last_updated'] ?? ''))
    case 'last_changed': return formatEntityDate(String(entity['last_changed'] ?? ''))
    case 'icon': return getEntityAttr(entity, 'icon')
    case 'supported_features': return getEntityAttr(entity, 'supported_features')
    case 'category': return String(entity['category'] ?? '—')
  }
}

function getColumnFilterValue(entity: Record<string, unknown>, column: EntityColumn): string {
  switch (column) {
    case 'area_name': return String(entity['area_name'] ?? '')
    case 'area_id': return String(entity['area_id'] ?? '')
    case 'unit': return String(entity['unit'] ?? '')
    case 'device_class': return String(entity['device_class'] ?? '')
    case 'last_updated': return String(entity['last_updated'] ?? '')
    case 'last_changed': return String(entity['last_changed'] ?? '')
    case 'icon': {
      const attributes = entity['attributes'] as Record<string, unknown> | undefined
      return String(attributes?.['icon'] ?? '')
    }
    case 'supported_features': {
      const attributes = entity['attributes'] as Record<string, unknown> | undefined
      return String(attributes?.['supported_features'] ?? '')
    }
    default:
      return String(entity[column] ?? '')
  }
}

function createFilterRule(field: EntityColumn = 'name'): FilterRule {
  return { id: `rule_${Math.random().toString(36).slice(2, 9)}`, field, operator: 'contains', value: '' }
}

function compareValues(left: string, right: string): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1
  }

  const leftDate = Date.parse(left)
  const rightDate = Date.parse(right)
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return leftDate === rightDate ? 0 : leftDate > rightDate ? 1 : -1
  }

  return left.localeCompare(right, 'es', { sensitivity: 'base', numeric: true })
}

function matchesRule(value: string, rule: FilterRule): boolean {
  const normalizedValue = value.trim()
  const lowerValue = normalizedValue.toLowerCase()
  const expected = rule.value.trim()
  const lowerExpected = expected.toLowerCase()

  switch (rule.operator) {
    case 'contains': return lowerValue.includes(lowerExpected)
    case 'equals': return compareValues(normalizedValue, expected) === 0
    case 'not_equals': return compareValues(normalizedValue, expected) !== 0
    case 'starts_with': return lowerValue.startsWith(lowerExpected)
    case 'ends_with': return lowerValue.endsWith(lowerExpected)
    case 'gt': return compareValues(normalizedValue, expected) > 0
    case 'gte': return compareValues(normalizedValue, expected) >= 0
    case 'lt': return compareValues(normalizedValue, expected) < 0
    case 'lte': return compareValues(normalizedValue, expected) <= 0
    case 'empty': return normalizedValue === ''
    case 'not_empty': return normalizedValue !== ''
  }
}

function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== 'empty' && operator !== 'not_empty'
}

function isPresetColumn(column: EntityColumn): boolean {
  return column === 'area_name' || column === 'area_id' || column === 'domain' || column === 'state' || column === 'device_class' || column === 'unit' || column === 'category'
}

// ─── Filter definitions ───────────────────────────────────────────────────────

type FilterKey =
  | 'auto_on' | 'auto_off' | 'auto_never'
  | 'unavailable' | 'actuators_on' | 'total'
  | 'scenes' | 'groups' | 'scripts'

const FILTER_LABELS: Record<FilterKey, string> = {
  auto_on:      'Automatizaciones activas',
  auto_off:     'Automatizaciones inactivas',
  auto_never:   'Nunca disparadas',
  unavailable:  'Entidades no disponibles',
  actuators_on: 'Actuadores encendidos',
  total:        'Total entidades',
  scenes:       'Escenas',
  groups:       'Grupos',
  scripts:      'Scripts',
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, icon: Icon, accent, active, onClick }: {
  title: string
  value: number | string
  icon: React.ElementType
  accent?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'transition-all',
        onClick && 'cursor-pointer hover:border-primary/60',
        active && 'ring-2 ring-primary border-primary',
      )}
    >
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`rounded-md p-2 ${accent ?? 'bg-primary/10'}`}>
          <Icon className={`w-4 h-4 ${accent ? 'text-inherit' : 'text-primary'}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold leading-none mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniCard({ label, value, active, onClick }: {
  label: string
  value: number
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'transition-all',
        onClick && value > 0 && 'cursor-pointer hover:border-primary/60',
        active && 'ring-2 ring-primary border-primary',
      )}
    >
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export function ResumenTab() {
  const inventory = useInventoryStore((s) => s.inventory)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<EntityColumn[]>(() => loadJsonStorage(RESUMEN_VISIBLE_COLUMNS_KEY, DEFAULT_VISIBLE_COLUMNS))
  const [filterRules, setFilterRules] = useState<FilterRule[]>(() => loadJsonStorage(RESUMEN_FILTER_RULES_KEY, []))
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => loadJsonStorage(RESUMEN_FILTERS_OPEN_KEY, false))

  useEffect(() => {
    saveJsonStorage(RESUMEN_VISIBLE_COLUMNS_KEY, visibleColumns)
  }, [visibleColumns])

  useEffect(() => {
    saveJsonStorage(RESUMEN_FILTER_RULES_KEY, filterRules)
  }, [filterRules])

  useEffect(() => {
    saveJsonStorage(RESUMEN_FILTERS_OPEN_KEY, filtersOpen)
  }, [filtersOpen])

  function toggleFilter(key: FilterKey) {
    setActiveFilter((prev) => (prev === key ? null : key))
  }

  function toggleColumn(column: EntityColumn) {
    setVisibleColumns((current) => {
      if (current.includes(column)) {
        if (current.length === 1) return current
        return current.filter((entry) => entry !== column)
      }
      return [...current, column]
    })
  }

  function addFilterRule() {
    setFiltersOpen(true)
    setFilterRules((current) => [...current, createFilterRule()])
  }

  function updateFilterRule(ruleId: string, patch: Partial<FilterRule>) {
    setFilterRules((current) => current.map((rule) => {
      if (rule.id !== ruleId) return rule
      const next = { ...rule, ...patch }
      if (patch.field) {
        next.value = ''
        next.operator = 'contains'
      }
      if (patch.operator && !operatorNeedsValue(patch.operator)) {
        next.value = ''
      }
      return next
    }))
  }

  function removeFilterRule(ruleId: string) {
    setFilterRules((current) => current.filter((rule) => rule.id !== ruleId))
  }

  const kpis = useMemo(() => {
    if (!inventory) return null
    const autoOn = inventory.automations.filter((a) => a.state === 'on').length
    const autoOff = inventory.automations.filter((a) => a.state === 'off').length
    const autoNever = inventory.automations.filter((a) => !a.last_triggered).length
    const unavailable = [...inventory.sensors, ...inventory.actuators, ...inventory.others]
      .filter((e) => e.state === 'unavailable' || e.state === 'unknown').length
    const actuatorsOn = inventory.actuators.filter((a) => a.state === 'on' || a.state === 'open').length
    const totalEntities = inventory.sensors.length + inventory.actuators.length + inventory.others.length
    return { autoOn, autoOff, autoNever, unavailable, actuatorsOn, totalEntities }
  }, [inventory])

  const allEntities = useMemo(() => {
    if (!inventory) return []
    return [
      ...inventory.automations.map((e) => ({ ...e, category: 'automation' })),
      ...inventory.scenes.map((e) => ({ ...e, category: 'scene' })),
      ...inventory.groups.map((e) => ({ ...e, category: 'group' })),
      ...inventory.scripts.map((e) => ({ ...e, category: 'script' })),
      ...inventory.sensors.map((e) => ({ ...e, category: 'sensor' })),
      ...inventory.actuators.map((e) => ({ ...e, category: 'actuator' })),
      ...inventory.others.map((e) => ({ ...e, category: 'other' })),
    ]
  }, [inventory])

  const domains = useMemo(() => {
    const set = new Set(allEntities.map((e) => e.domain))
    return Array.from(set).sort()
  }, [allEntities])

  const valueOptionsByColumn = useMemo<Record<EntityColumn, string[]>>(() => {
    const collect = (column: EntityColumn) => Array.from(new Set(allEntities.map((entity) => getColumnFilterValue(entity as unknown as Record<string, unknown>, column)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }))
    return {
      entity_id: collect('entity_id'),
      name: collect('name'),
      domain: collect('domain'),
      state: collect('state'),
      area_name: collect('area_name'),
      area_id: collect('area_id'),
      unit: collect('unit'),
      device_class: collect('device_class'),
      last_updated: collect('last_updated'),
      last_changed: collect('last_changed'),
      icon: collect('icon'),
      supported_features: collect('supported_features'),
      category: collect('category'),
    }
  }, [allEntities])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()

    // KPI predicate
    const kpiPass = (e: typeof allEntities[number]): boolean => {
      if (!activeFilter) return true
      switch (activeFilter) {
        case 'auto_on':      return e.category === 'automation' && e.state === 'on'
        case 'auto_off':     return e.category === 'automation' && e.state === 'off'
        case 'auto_never':   return e.category === 'automation' && !(e as { last_triggered?: string | null }).last_triggered
        case 'unavailable':  return e.state === 'unavailable' || e.state === 'unknown'
        case 'actuators_on': return e.category === 'actuator' && (e.state === 'on' || e.state === 'open')
        case 'total':        return e.category === 'sensor' || e.category === 'actuator' || e.category === 'other'
        case 'scenes':       return e.category === 'scene'
        case 'groups':       return e.category === 'group'
        case 'scripts':      return e.category === 'script'
        default:             return true
      }
    }

    return allEntities.filter((e) => {
      const matchSearch = !q || e.entity_id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
      const matchDomain = !domainFilter || e.domain === domainFilter
      const matchAdvancedRules = filterRules.every((rule) => {
        if (operatorNeedsValue(rule.operator) && !rule.value.trim()) return true
        return matchesRule(getColumnFilterValue(e as unknown as Record<string, unknown>, rule.field), rule)
      })
      return matchSearch && matchDomain && kpiPass(e) && matchAdvancedRules
    })
  }, [allEntities, search, domainFilter, activeFilter, filterRules])

  function exportCurrentViewToMarkdown() {
    exportTableToMarkdown(
      `Resumen entidades (${filtered.length})`,
      visibleColumns.map((column) => ENTITY_COLUMNS.find((entry) => entry.key === column)?.label || column),
      filtered.map((entity) => visibleColumns.map((column) => getColumnValue(entity as unknown as Record<string, unknown>, column))),
      `ha-resumen-entidades-${new Date().toISOString().slice(0, 10)}.md`,
    )
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resumen del inventario</h2>
        <p className="text-sm text-muted-foreground">Generado: {new Date(inventory.generated_at).toLocaleString('es-ES')}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard title="Automatizaciones activas"   value={kpis!.autoOn}       icon={Zap}          accent="bg-emerald-500/10 text-emerald-400" active={activeFilter === 'auto_on'}      onClick={() => toggleFilter('auto_on')} />
        <KpiCard title="Automatizaciones inactivas" value={kpis!.autoOff}      icon={Zap}          accent="bg-yellow-500/10 text-yellow-400"  active={activeFilter === 'auto_off'}     onClick={() => toggleFilter('auto_off')} />
        <KpiCard title="Nunca disparadas"           value={kpis!.autoNever}    icon={AlertCircle}  accent="bg-destructive/10 text-destructive" active={activeFilter === 'auto_never'}   onClick={() => toggleFilter('auto_never')} />
        <KpiCard title="Entidades no disponibles"   value={kpis!.unavailable}  icon={Activity}     accent="bg-orange-500/10 text-orange-400"   active={activeFilter === 'unavailable'}  onClick={() => toggleFilter('unavailable')} />
        <KpiCard title="Actuadores encendidos"      value={kpis!.actuatorsOn}  icon={Eye}                                                      active={activeFilter === 'actuators_on'} onClick={() => toggleFilter('actuators_on')} />
        <KpiCard title="Total entidades"            value={kpis!.totalEntities} icon={Layers}                                                  active={activeFilter === 'total'}        onClick={() => toggleFilter('total')} />
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniCard label="Áreas"   value={inventory.areas.length}   />
        <MiniCard label="Escenas" value={inventory.scenes.length}  active={activeFilter === 'scenes'}  onClick={inventory.scenes.length  > 0 ? () => toggleFilter('scenes')  : undefined} />
        <MiniCard label="Grupos"  value={inventory.groups.length}  active={activeFilter === 'groups'}  onClick={inventory.groups.length  > 0 ? () => toggleFilter('groups')  : undefined} />
        <MiniCard label="Scripts" value={inventory.scripts.length} active={activeFilter === 'scripts'} onClick={inventory.scripts.length > 0 ? () => toggleFilter('scripts') : undefined} />
      </div>

      {/* Global entity table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-4 h-4" />
            Entidades ({filtered.length})
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                {FILTER_LABELS[activeFilter]}
                <X className="w-3 h-3" />
              </button>
            )}
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Buscar entity_id o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos los dominios</option>
              {domains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFiltersOpen((current) => !current)}>
              <Filter className="w-3.5 h-3.5" />
              {filtersOpen ? 'Ocultar filtros avanzados' : 'Filtros avanzados'}
              {filterRules.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{filterRules.length}</Badge>}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={exportCurrentViewToMarkdown}>
              <FileText className="w-3.5 h-3.5" /> Exportar MD
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ENTITY_COLUMNS.map((column) => {
              const active = visibleColumns.includes(column.key)
              return (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => toggleColumn(column.key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent/30 hover:text-foreground',
                  )}
                >
                  {column.label}
                </button>
              )
            })}
          </div>
          {filtersOpen && (
            <div className="mt-3 rounded-xl border border-border/70 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Filtros avanzados</p>
                  <p className="text-xs text-muted-foreground">Operadores disponibles: contiene, =, !=, &gt;, &gt;=, &lt;, &lt;=, empieza por, termina en, vacío, no vacío.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addFilterRule}>
                  <Plus className="w-3.5 h-3.5" /> Añadir filtro
                </Button>
              </div>

              {filterRules.length === 0 && <p className="text-xs text-muted-foreground">No hay filtros avanzados activos.</p>}

              <div className="space-y-2">
                {filterRules.map((rule, index) => {
                  const options = valueOptionsByColumn[rule.field] || []
                  const usePreset = isPresetColumn(rule.field) && options.length > 0
                  const listId = `resumen-filter-${rule.id}`
                  const firstSuggestion = options.find((option) => option.toLowerCase().includes(rule.value.trim().toLowerCase())) || ''

                  return (
                    <div key={rule.id} className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr_1.4fr_auto] gap-2 items-center rounded-xl border border-border/70 p-3">
                      <Select value={rule.field} onChange={(e) => updateFilterRule(rule.id, { field: e.target.value as EntityColumn })} className="h-9 text-sm">
                        {ENTITY_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                      </Select>

                      <Select value={rule.operator} onChange={(e) => updateFilterRule(rule.id, { operator: e.target.value as FilterOperator })} className="h-9 text-sm">
                        {FILTER_OPERATORS.map((operator) => <option key={operator.key} value={operator.key}>{operator.label}</option>)}
                      </Select>

                      {operatorNeedsValue(rule.operator) ? (
                        usePreset ? (
                          <Select value={rule.value} onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })} className="h-9 text-sm">
                            <option value="">Selecciona un valor…</option>
                            {options.map((option) => <option key={option} value={option}>{option}</option>)}
                          </Select>
                        ) : (
                          <>
                            <Input
                              list={listId}
                              value={rule.value}
                              onChange={(e) => updateFilterRule(rule.id, { value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Tab' && rule.value.trim() && firstSuggestion && firstSuggestion !== rule.value) {
                                  e.preventDefault()
                                  updateFilterRule(rule.id, { value: firstSuggestion })
                                }
                              }}
                              placeholder="Valor"
                              className="h-9 text-sm"
                            />
                            <datalist id={listId}>
                              {options.slice(0, 100).map((option) => <option key={option} value={option} />)}
                            </datalist>
                          </>
                        )
                      ) : (
                        <div className="text-xs text-muted-foreground px-1">Este operador no necesita valor.</div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-muted-foreground hidden xl:inline">#{index + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeFilterRule(rule.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  {visibleColumns.includes('entity_id') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">entity_id</th>}
                  {visibleColumns.includes('name') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>}
                  {visibleColumns.includes('domain') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Dominio</th>}
                  {visibleColumns.includes('state') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Estado</th>}
                  {visibleColumns.includes('area_name') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Área</th>}
                  {visibleColumns.includes('area_id') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">area_id</th>}
                  {visibleColumns.includes('unit') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Unidad</th>}
                  {visibleColumns.includes('device_class') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Device class</th>}
                  {visibleColumns.includes('last_updated') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Actualizado</th>}
                  {visibleColumns.includes('last_changed') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cambio</th>}
                  {visibleColumns.includes('icon') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Icono</th>}
                  {visibleColumns.includes('supported_features') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Supported features</th>}
                  {visibleColumns.includes('category') && <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tipo</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.entity_id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    {visibleColumns.includes('entity_id') && <td className="px-4 py-2 font-mono text-xs text-primary">{e.entity_id}</td>}
                    {visibleColumns.includes('name') && <td className="px-4 py-2">{e.name}</td>}
                    {visibleColumns.includes('domain') && <td className="px-4 py-2">
                      <Badge variant="secondary">{e.domain}</Badge>
                    </td>}
                    {visibleColumns.includes('state') && <td className="px-4 py-2">
                      <Badge
                        variant={
                          e.state === 'unavailable' || e.state === 'unknown'
                            ? 'destructive'
                            : e.state === 'on' || e.state === 'open'
                            ? 'success'
                            : 'outline'
                        }
                      >
                        {e.state}
                      </Badge>
                    </td>}
                    {visibleColumns.includes('area_name') && <td className="px-4 py-2 text-muted-foreground text-xs">{e.area_name ?? '—'}</td>}
                    {visibleColumns.includes('area_id') && <td className="px-4 py-2 font-mono text-muted-foreground text-xs">{e.area_id ?? '—'}</td>}
                    {visibleColumns.includes('unit') && <td className="px-4 py-2 text-muted-foreground text-xs">{e.unit || '—'}</td>}
                    {visibleColumns.includes('device_class') && <td className="px-4 py-2 text-muted-foreground text-xs">{e.device_class || '—'}</td>}
                    {visibleColumns.includes('last_updated') && <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">{formatEntityDate(e.last_updated)}</td>}
                    {visibleColumns.includes('last_changed') && <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">{formatEntityDate(e.last_changed)}</td>}
                    {visibleColumns.includes('icon') && <td className="px-4 py-2 text-muted-foreground text-xs break-all">{getEntityAttr(e as unknown as Record<string, unknown>, 'icon')}</td>}
                    {visibleColumns.includes('supported_features') && <td className="px-4 py-2 text-muted-foreground text-xs break-all">{getEntityAttr(e as unknown as Record<string, unknown>, 'supported_features')}</td>}
                    {visibleColumns.includes('category') && <td className="px-4 py-2 text-xs text-muted-foreground">{e.category}</td>}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                      No hay entidades que coincidan con la búsqueda
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
