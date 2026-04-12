import * as XLSX from 'xlsx'
import type { Inventory, HaEntity } from '@/types/ha'
import type { Zone } from '@/types/ha'

// ─── Export options ───────────────────────────────────────────────────────────

export interface ExportSections {
  automations: boolean
  scenes: boolean
  groups: boolean
  scripts: boolean
  sensors: boolean
  actuators: boolean
  others: boolean
  areas: boolean
  zones: boolean
}

export interface ExportOptions {
  sections: ExportSections
  slim: boolean // strip attributes + raw timestamps to reduce file size
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  sections: {
    automations: true,
    scenes: true,
    groups: true,
    scripts: true,
    sensors: true,
    actuators: true,
    others: true,
    areas: true,
    zones: true,
  },
  slim: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function slimEntity<T extends HaEntity>(e: T): Omit<T, 'attributes' | 'last_changed' | 'last_updated'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { attributes, last_changed, last_updated, ...rest } = e
  return rest
}

export function exportToExcel(inventory: Inventory, zones: Zone[], opts: ExportOptions = DEFAULT_EXPORT_OPTIONS): void {
  const wb = XLSX.utils.book_new()
  const { sections, slim } = opts

  // ── Resumen ──────────────────────────────────────────────────────────────
  const summary = [
    ['Generado', inventory.generated_at],
    ['URL HA', inventory.ha_url],
    ['Modo', slim ? 'Ligero' : 'Completo'],
    [''],
    ['Categoría', 'Cantidad'],
    ...(sections.areas ? [['Áreas', inventory.areas.length]] : []),
    ...(sections.automations ? [['Automatizaciones', inventory.automations.length]] : []),
    ...(sections.scenes ? [['Escenas', inventory.scenes.length]] : []),
    ...(sections.groups ? [['Grupos', inventory.groups.length]] : []),
    ...(sections.scripts ? [['Scripts', inventory.scripts.length]] : []),
    ...(sections.sensors ? [['Sensores', inventory.sensors.length]] : []),
    ...(sections.actuators ? [['Actuadores', inventory.actuators.length]] : []),
    ...(sections.others ? [['Otros', inventory.others.length]] : []),
    ['Zonas configuradas', zones.length],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Resumen')

  // ── Automatizaciones ─────────────────────────────────────────────────────
  if (sections.automations) {
    const cols = slim
      ? [['Nombre', 'entity_id', 'Estado', 'Modo', 'Última ejecución', 'Área']]
      : [['Nombre', 'entity_id', 'Estado', 'Modo', 'Última ejecución', 'Área']]
    for (const a of inventory.automations) {
      cols.push([a.name, a.entity_id, a.state, a.mode, safeStr(a.last_triggered), safeStr(a.area_name)])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Automatizaciones')
  }

  // ── Escenas ───────────────────────────────────────────────────────────────
  if (sections.scenes) {
    const cols = [['Nombre', 'entity_id', 'Entidades controladas']]
    for (const s of inventory.scenes) {
      cols.push([s.name, s.entity_id, s.entities_controlled.join(', ')])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Escenas')
  }

  // ── Sensores ──────────────────────────────────────────────────────────────
  if (sections.sensors) {
    const cols = slim
      ? [['Nombre', 'entity_id', 'Estado', 'Unidad', 'Device Class', 'Área']]
      : [['Nombre', 'entity_id', 'Estado', 'Unidad', 'Device Class', 'Área', 'Última actualización']]
    for (const e of inventory.sensors) {
      const row = [e.name, e.entity_id, e.state, e.unit, e.device_class, safeStr(e.area_name)]
      if (!slim) row.push(e.last_updated)
      cols.push(row)
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Sensores')
  }

  // ── Actuadores ────────────────────────────────────────────────────────────
  if (sections.actuators) {
    const cols = slim
      ? [['Nombre', 'entity_id', 'Estado', 'Device Class', 'Área']]
      : [['Nombre', 'entity_id', 'Estado', 'Device Class', 'Área', 'Última actualización']]
    for (const e of inventory.actuators) {
      const row = [e.name, e.entity_id, e.state, e.device_class, safeStr(e.area_name)]
      if (!slim) row.push(e.last_updated)
      cols.push(row)
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Actuadores')
  }

  // ── Grupos ────────────────────────────────────────────────────────────────
  if (sections.groups) {
    const cols = [['Nombre', 'entity_id', 'Estado', 'Miembros']]
    for (const g of inventory.groups) {
      cols.push([g.name, g.entity_id, g.state, g.members.join(', ')])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Grupos')
  }

  // ── Scripts ───────────────────────────────────────────────────────────────
  if (sections.scripts) {
    const cols = [['Nombre', 'entity_id', 'Estado', 'Última ejecución']]
    for (const s of inventory.scripts) {
      cols.push([s.name, s.entity_id, s.state, safeStr(s.last_triggered)])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Scripts')
  }

  // ── Otros ─────────────────────────────────────────────────────────────────
  if (sections.others) {
    const cols = [['Nombre', 'entity_id', 'Dominio', 'Estado', 'Área']]
    for (const e of inventory.others) {
      cols.push([e.name, e.entity_id, e.domain, e.state, safeStr(e.area_name)])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Otros')
  }

  // ── Áreas ─────────────────────────────────────────────────────────────────
  if (sections.areas && inventory.areas.length) {
    const cols = [['area_id', 'Nombre']]
    for (const a of inventory.areas) {
      cols.push([a.area_id, a.name])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Áreas')
  }

  // ── Zonas ─────────────────────────────────────────────────────────────────
  if (sections.zones) {
    const cols = [['Nombre', 'Tipo', 'Orientación', 'Notas', 'Entidades']]
    for (const z of zones) {
      cols.push([z.name, z.type, z.orientation, z.notes, z.entity_ids.join(', ')])
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cols), 'Zonas')
  }

  XLSX.writeFile(wb, `ha-inventory-${new Date().toISOString().slice(0, 10)}${slim ? '-slim' : ''}.xlsx`)
}

export function exportToJson(inventory: Inventory, zones: Zone[], opts: ExportOptions = DEFAULT_EXPORT_OPTIONS): void {
  const { sections, slim } = opts

  const pick = <T extends HaEntity>(arr: T[]) =>
    slim ? arr.map((e) => slimEntity(e)) : arr

  const data: Record<string, unknown> = {
    generated_at: inventory.generated_at,
    ha_url: inventory.ha_url,
    export_mode: slim ? 'slim' : 'full',
  }

  if (sections.areas) data.areas = inventory.areas
  if (sections.automations) data.automations = slim
    ? inventory.automations.map(({ attributes, last_changed, last_updated, ...r }) => r)
    : inventory.automations
  if (sections.scenes) data.scenes = slim
    ? inventory.scenes.map(({ attributes, last_changed, last_updated, ...r }) => r)
    : inventory.scenes
  if (sections.groups) data.groups = slim
    ? inventory.groups.map(({ attributes, last_changed, last_updated, ...r }) => r)
    : inventory.groups
  if (sections.scripts) data.scripts = slim
    ? inventory.scripts.map(({ attributes, last_changed, last_updated, ...r }) => r)
    : inventory.scripts
  if (sections.sensors) data.sensors = pick(inventory.sensors)
  if (sections.actuators) data.actuators = pick(inventory.actuators)
  if (sections.others) data.others = pick(inventory.others)
  if (sections.zones) data.zones = zones

  const blob = new Blob([JSON.stringify(data, null, slim ? 0 : 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ha-inventory-${new Date().toISOString().slice(0, 10)}${slim ? '-slim' : ''}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeMarkdownCell(value: unknown): string {
  if (value == null) return ''
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
}

export function exportTableToMarkdown(
  title: string,
  columns: string[],
  rows: Array<Array<unknown>>,
  filename: string,
): void {
  const header = `# ${title}`
  const tableHeader = `| ${columns.map(escapeMarkdownCell).join(' | ')} |`
  const separator = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`).join('\n')
  const markdown = [header, '', tableHeader, separator, body].filter(Boolean).join('\n')

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  a.click()
  URL.revokeObjectURL(url)
}
