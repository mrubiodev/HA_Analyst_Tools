import { useState, useMemo, useEffect } from 'react'
import { AlertCircle, X, ChevronRight, FileText, Filter, Plus, Trash2, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useInventoryStore } from '@/store/inventoryStore'
import type { HaEntity, Automation, Scene, Group, Script } from '@/types/ha'
import { cn, loadJsonStorage, saveJsonStorage } from '@/lib/utils'
import { exportTableToMarkdown } from '@/lib/exporters'

type Category = 'sensors' | 'actuators' | 'automations' | 'scenes' | 'groups' | 'scripts' | 'others'
type EntityColumn = 'entity_id' | 'name' | 'domain' | 'state' | 'area_name' | 'area_id' | 'unit' | 'device_class' | 'last_updated' | 'last_changed' | 'icon' | 'supported_features'
type FilterOperator = 'contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' | 'gt' | 'gte' | 'lt' | 'lte' | 'empty' | 'not_empty'
type FilterRule = { id: string; field: EntityColumn; operator: FilterOperator; value: string }

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'sensors', label: 'Sensores' },
  { id: 'actuators', label: 'Actuadores' },
  { id: 'automations', label: 'Automatizaciones' },
  { id: 'scenes', label: 'Escenas' },
  { id: 'groups', label: 'Grupos' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'others', label: 'Otros' },
]

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
]

const DEFAULT_VISIBLE_COLUMNS: EntityColumn[] = ['entity_id', 'name', 'domain', 'state', 'area_name', 'unit', 'device_class', 'last_updated']
const EXPLORER_VISIBLE_COLUMNS_KEY = 'ha-explorer-visible-columns'
const EXPLORER_FILTER_RULES_KEY = 'ha-explorer-filter-rules'
const EXPLORER_FILTERS_OPEN_KEY = 'ha-explorer-filters-open'

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

function getEntityAttr(entity: HaEntity, key: 'icon' | 'supported_features'): string {
  const value = entity.attributes[key]
  if (value === undefined || value === null || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function formatEntityDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-ES')
}

function getColumnValue(entity: HaEntity, column: EntityColumn): string {
  switch (column) {
    case 'entity_id': return entity.entity_id
    case 'name': return entity.name
    case 'domain': return entity.domain
    case 'state': return entity.state
    case 'area_name': return entity.area_name ?? '—'
    case 'area_id': return entity.area_id ?? '—'
    case 'unit': return entity.unit || '—'
    case 'device_class': return entity.device_class || '—'
    case 'last_updated': return formatEntityDate(entity.last_updated)
    case 'last_changed': return formatEntityDate(entity.last_changed)
    case 'icon': return getEntityAttr(entity, 'icon')
    case 'supported_features': return getEntityAttr(entity, 'supported_features')
  }
}

function getColumnFilterValue(entity: HaEntity, column: EntityColumn): string {
  switch (column) {
    case 'area_name': return entity.area_name ?? ''
    case 'area_id': return entity.area_id ?? ''
    case 'unit': return entity.unit || ''
    case 'device_class': return entity.device_class || ''
    case 'last_updated': return entity.last_updated
    case 'last_changed': return entity.last_changed
    case 'icon': {
      const value = entity.attributes['icon']
      return value == null ? '' : String(value)
    }
    case 'supported_features': {
      const value = entity.attributes['supported_features']
      return value == null ? '' : String(value)
    }
    default:
      return getColumnValue(entity, column) === '—' ? '' : getColumnValue(entity, column)
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
  return column === 'area_name' || column === 'area_id' || column === 'domain' || column === 'state' || column === 'device_class' || column === 'unit'
}

function AttributePanel({ entity, onClose }: { entity: HaEntity | Automation | Scene | Group | Script; onClose: () => void }) {
  const attrs = Object.entries(entity.attributes)

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="font-medium text-sm">{entity.name}</p>
          <p className="text-xs text-primary font-mono">{entity.entity_id}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Estado:</span>
          <Badge
            variant={entity.state === 'unavailable' || entity.state === 'unknown' ? 'destructive' : entity.state === 'on' || entity.state === 'open' ? 'success' : 'outline'}
          >
            {entity.state}
          </Badge>
        </div>
        {entity.unit && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Unidad:</span>
            <span className="text-xs">{entity.unit}</span>
          </div>
        )}
        {entity.area_name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Área:</span>
            <span className="text-xs">{entity.area_name}</span>
          </div>
        )}
        {entity.area_id && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">area_id:</span>
            <span className="text-xs font-mono">{entity.area_id}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Cambio:</span>
          <span className="text-xs">{formatEntityDate(entity.last_changed)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Actualizado:</span>
          <span className="text-xs">{formatEntityDate(entity.last_updated)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Icono:</span>
          <span className="text-xs break-all">{getEntityAttr(entity, 'icon')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Supported features:</span>
          <span className="text-xs break-all">{getEntityAttr(entity, 'supported_features')}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">ATRIBUTOS ({attrs.length})</p>
        <div className="space-y-1.5">
          {attrs.map(([k, v]) => (
            <div key={k} className="text-xs">
              <span className="text-muted-foreground font-mono">{k}: </span>
              <span className="break-all">
                {typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EntityRow({
  entity,
  onClick,
  selected,
  visibleColumns,
}: {
  entity: HaEntity
  onClick: () => void
  selected: boolean
  visibleColumns: EntityColumn[]
}) {
  const show = (column: EntityColumn) => visibleColumns.includes(column)

  return (
    <tr
      className={cn(
        'border-b border-border/50 cursor-pointer transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-accent/30',
      )}
      onClick={onClick}
    >
      {show('entity_id') && <td className="px-4 py-2 font-mono text-xs text-primary">{entity.entity_id}</td>}
      {show('name') && <td className="px-4 py-2 text-sm">{entity.name}</td>}
      {show('domain') && (
        <td className="px-4 py-2">
          <Badge variant="secondary">{entity.domain}</Badge>
        </td>
      )}
      {show('state') && <td className="px-4 py-2">
        <Badge
          variant={
            entity.state === 'unavailable' || entity.state === 'unknown'
              ? 'destructive'
              : entity.state === 'on' || entity.state === 'open'
              ? 'success'
              : 'outline'
          }
        >
          {entity.state}
        </Badge>
      </td>}
      {show('area_name') && <td className="px-4 py-2 text-xs text-muted-foreground">{entity.area_name ?? '—'}</td>}
      {show('area_id') && <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{entity.area_id ?? '—'}</td>}
      {show('unit') && <td className="px-4 py-2 text-xs text-muted-foreground">{entity.unit || '—'}</td>}
      {show('device_class') && <td className="px-4 py-2 text-xs text-muted-foreground">{entity.device_class || '—'}</td>}
      {show('last_updated') && <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatEntityDate(entity.last_updated)}</td>}
      {show('last_changed') && <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatEntityDate(entity.last_changed)}</td>}
      {show('icon') && <td className="px-4 py-2 text-xs text-muted-foreground break-all">{getEntityAttr(entity, 'icon')}</td>}
      {show('supported_features') && <td className="px-4 py-2 text-xs text-muted-foreground break-all">{getEntityAttr(entity, 'supported_features')}</td>}
      <td className="px-4 py-2">
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      </td>
    </tr>
  )
}

export function ExplorerTab() {
  const inventory = useInventoryStore((s) => s.inventory)
  const [category, setCategory] = useState<Category>('sensors')
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [selected, setSelected] = useState<HaEntity | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<EntityColumn[]>(() => loadJsonStorage(EXPLORER_VISIBLE_COLUMNS_KEY, DEFAULT_VISIBLE_COLUMNS))
  const [filterRules, setFilterRules] = useState<FilterRule[]>(() => loadJsonStorage(EXPLORER_FILTER_RULES_KEY, []))
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => loadJsonStorage(EXPLORER_FILTERS_OPEN_KEY, false))

  useEffect(() => {
    saveJsonStorage(EXPLORER_VISIBLE_COLUMNS_KEY, visibleColumns)
  }, [visibleColumns])

  useEffect(() => {
    saveJsonStorage(EXPLORER_FILTER_RULES_KEY, filterRules)
  }, [filterRules])

  useEffect(() => {
    saveJsonStorage(EXPLORER_FILTERS_OPEN_KEY, filtersOpen)
  }, [filtersOpen])

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

  const entities = useMemo(() => {
    if (!inventory) return []
    const map: Record<Category, (HaEntity | Automation | Scene | Group | Script)[]> = {
      sensors: inventory.sensors,
      actuators: inventory.actuators,
      automations: inventory.automations,
      scenes: inventory.scenes,
      groups: inventory.groups,
      scripts: inventory.scripts,
      others: inventory.others,
    }
    return map[category] as HaEntity[]
  }, [inventory, category])

  const domains = useMemo(() => {
    const set = new Set(entities.map((e) => e.domain))
    return Array.from(set).sort()
  }, [entities])

  const valueOptionsByColumn = useMemo<Record<EntityColumn, string[]>>(() => {
    const collect = (column: EntityColumn) => Array.from(new Set(entities.map((entity) => getColumnFilterValue(entity, column)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }))
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
    }
  }, [entities])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entities.filter((e) => {
      const matchSearch = !q || e.entity_id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
      const matchDomain = !domainFilter || e.domain === domainFilter
      const matchAdvancedRules = filterRules.every((rule) => {
        if (!operatorNeedsValue(rule.operator) && !rule.value.trim()) {
          return matchesRule(getColumnFilterValue(e, rule.field), rule)
        }
        if (operatorNeedsValue(rule.operator) && !rule.value.trim()) return true
        return matchesRule(getColumnFilterValue(e, rule.field), rule)
      })
      return matchSearch && matchDomain && matchAdvancedRules
    })
  }, [entities, search, domainFilter, filterRules])

  function exportCurrentViewToMarkdown() {
    exportTableToMarkdown(
      `Explorer ${category} (${filtered.length})`,
      visibleColumns.map((column) => ENTITY_COLUMNS.find((entry) => entry.key === column)?.label || column),
      filtered.map((entity) => visibleColumns.map((column) => getColumnValue(entity, column))),
      `ha-explorer-${category}-${new Date().toISOString().slice(0, 10)}.md`,
    )
  }

  const counts = useMemo(() => {
    if (!inventory) return {} as Record<Category, number>
    return {
      sensors: inventory.sensors.length,
      actuators: inventory.actuators.length,
      automations: inventory.automations.length,
      scenes: inventory.scenes.length,
      groups: inventory.groups.length,
      scripts: inventory.scripts.length,
      others: inventory.others.length,
    }
  }, [inventory])

  if (!inventory) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8" />
        <p>Conecta a Home Assistant primero (pestaña Vault)</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Category sub-tabs */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.id)
              setSearch('')
              setDomainFilter('')
              setSelected(null)
            }}
            className={cn(
              'px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5',
              category === c.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
            <Badge variant="secondary" className="text-xs py-0 px-1.5">
              {counts[c.id] ?? 0}
            </Badge>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
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
        <span className="text-sm text-muted-foreground flex items-center">{filtered.length} entidades</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFiltersOpen((current) => !current)}>
          <Filter className="w-3.5 h-3.5" />
          {filtersOpen ? 'Ocultar filtros avanzados' : 'Filtros avanzados'}
          {filterRules.length > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{filterRules.length}</Badge>}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={exportCurrentViewToMarkdown}>
          <FileText className="w-3.5 h-3.5" /> Exportar MD
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
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
        <Card>
          <CardContent className="p-4 space-y-3">
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
                const listId = `explorer-filter-${rule.id}`
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
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  {visibleColumns.includes('entity_id') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">entity_id</th>}
                  {visibleColumns.includes('name') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Nombre</th>}
                  {visibleColumns.includes('domain') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Dominio</th>}
                  {visibleColumns.includes('state') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Estado</th>}
                  {visibleColumns.includes('area_name') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Área</th>}
                  {visibleColumns.includes('area_id') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">area_id</th>}
                  {visibleColumns.includes('unit') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Unidad</th>}
                  {visibleColumns.includes('device_class') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Device class</th>}
                  {visibleColumns.includes('last_updated') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Actualizado</th>}
                  {visibleColumns.includes('last_changed') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Cambio</th>}
                  {visibleColumns.includes('icon') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Icono</th>}
                  {visibleColumns.includes('supported_features') && <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Supported features</th>}
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <EntityRow
                    key={e.entity_id}
                    entity={e}
                    visibleColumns={visibleColumns}
                    selected={selected?.entity_id === e.entity_id}
                    onClick={() => setSelected(selected?.entity_id === e.entity_id ? null : e)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="text-center py-8 text-muted-foreground">
                      No hay entidades que coincidan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Side panel */}
      {selected && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelected(null)}
          />
          <AttributePanel entity={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </div>
  )
}
