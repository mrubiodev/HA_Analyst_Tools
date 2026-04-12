import type {
  HaStateRaw,
  HaAreaRaw,
  HaEntityRegistryRaw,
  HaEntity,
  HaArea,
  Automation,
  Scene,
  Group,
  Script,
  EntityKind,
  Inventory,
} from '@/types/ha'

const SENSOR_DOMAINS = new Set(['sensor', 'binary_sensor', 'weather', 'sun', 'number', 'input_number', 'input_boolean'])
const ACTUATOR_DOMAINS = new Set([
  'light', 'switch', 'cover', 'climate', 'fan', 'media_player',
  'lock', 'vacuum', 'humidifier', 'water_heater', 'alarm_control_panel',
  'input_select', 'select', 'button', 'scene',
])

export function classifyDomain(domain: string): EntityKind {
  if (SENSOR_DOMAINS.has(domain)) return 'sensor'
  if (ACTUATOR_DOMAINS.has(domain)) return 'actuator'
  return 'other'
}

// ─── HA REST API client ───────────────────────────────────────────────────────

export class HAClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(url: string, token: string) {
    // Normalize: strip trailing slash
    this.baseUrl = url.replace(/\/$/, '')
    this.headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  private async get<T>(path: string): Promise<T> {
    const isDev = import.meta.env.DEV
    const url = isDev ? `/ha-proxy/api/${path}` : `${this.baseUrl}/api/${path}`
    const headers: Record<string, string> = isDev
      ? { ...this.headers, 'X-HA-Base': this.baseUrl }
      : { ...this.headers }
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HA API ${res.status}: ${text || res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const isDev = import.meta.env.DEV
    const url = isDev ? `/ha-proxy/api/${path}` : `${this.baseUrl}/api/${path}`
    const headers: Record<string, string> = isDev
      ? { ...this.headers, 'X-HA-Base': this.baseUrl }
      : { ...this.headers }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HA API ${res.status}: ${text || res.statusText}`)
    }
    // Some endpoints return 200 with empty body
    const text = await res.text()
    return (text ? JSON.parse(text) : {}) as T
  }

  async ping(): Promise<boolean> {
    try {
      await this.get<{ message: string }>('')
      return true
    } catch {
      return false
    }
  }

  async getStates(): Promise<HaStateRaw[]> {
    return this.get<HaStateRaw[]>('states')
  }

  async getAreas(): Promise<HaAreaRaw[]> {
    // Area registry is only available via WebSocket in standard HA REST API.
    // Returning empty array avoids 404s; area grouping falls back to entity domain.
    return []
  }

  async getEntityRegistry(): Promise<HaEntityRegistryRaw[]> {
    // Entity registry is only available via WebSocket in standard HA REST API.
    return []
  }

  // ─── Extended read endpoints ────────────────────────────────────────────────

  async getConfig(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('config')
  }

  async getComponents(): Promise<string[]> {
    return this.get<string[]>('components')
  }

  async getEventsList(): Promise<Array<{ event_type: string; listener_count: number }>> {
    return this.get<Array<{ event_type: string; listener_count: number }>>('events')
  }

  async getServices(): Promise<Array<{ domain: string; services: Record<string, unknown> }>> {
    return this.get<Array<{ domain: string; services: Record<string, unknown> }>>('services')
  }

  async getState(entityId: string): Promise<HaStateRaw> {
    return this.get<HaStateRaw>(`states/${encodeURIComponent(entityId)}`)
  }

  /**
   * GET /api/history/period/<startTime>?filter_entity_id=<id>&end_time=<endTime>&minimal_response
   * startTime defaults to 1 day ago if not provided.
   */
  async getHistory(
    entityId?: string,
    startTime?: string,
    endTime?: string,
    minimalResponse = true,
  ): Promise<unknown[][]> {
    const start = startTime ?? new Date(Date.now() - 86400_000).toISOString()
    const params = new URLSearchParams()
    if (entityId) params.set('filter_entity_id', entityId)
    if (endTime) params.set('end_time', endTime)
    const qs = params.toString()
    const minFlag = minimalResponse ? (qs ? '&minimal_response' : '?minimal_response') : ''
    return this.get<unknown[][]>(`history/period/${encodeURIComponent(start)}${qs ? `?${qs}` : ''}${minFlag}`)
  }

  /**
   * GET /api/logbook/<startTime>?entity_id=<id>&end_time=<endTime>
   */
  async getLogbook(
    startTime?: string,
    entityId?: string,
    endTime?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const start = startTime ?? new Date(Date.now() - 86400_000).toISOString()
    const params = new URLSearchParams()
    if (entityId) params.set('entity_id', entityId)
    if (endTime) params.set('end_time', endTime)
    const qs = params.toString()
    return this.get<Array<Record<string, unknown>>>(`logbook/${encodeURIComponent(start)}${qs ? `?${qs}` : ''}`)
  }

  async getErrorLog(): Promise<string> {
    const isDev = import.meta.env.DEV
    const url = isDev ? `/ha-proxy/api/error_log` : `${this.baseUrl}/api/error_log`
    const headers: Record<string, string> = isDev
      ? { ...this.headers, 'X-HA-Base': this.baseUrl }
      : { ...this.headers }
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`HA API ${res.status}: ${res.statusText}`)
    return res.text()
  }

  async getCalendars(): Promise<Array<{ entity_id: string; name: string }>> {
    return this.get<Array<{ entity_id: string; name: string }>>('calendars')
  }

  async getCalendarEvents(
    calendarEntityId: string,
    start: string,
    end: string,
  ): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams({ start, end })
    return this.get<Array<Record<string, unknown>>>(`calendars/${encodeURIComponent(calendarEntityId)}?${params}`)
  }

  // ─── Action endpoints (POST) ─────────────────────────────────────────────────

  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string | string[]; area_id?: string | string[]; device_id?: string | string[] },
  ): Promise<HaStateRaw[]> {
    return this.post<HaStateRaw[]>(`services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
      ...(serviceData ?? {}),
      ...(target ? { target } : {}),
    })
  }

  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>,
  ): Promise<{ message: string }> {
    return this.post<{ message: string }>(`events/${encodeURIComponent(eventType)}`, eventData ?? {})
  }

  async updateState(
    entityId: string,
    state: string,
    attributes?: Record<string, unknown>,
  ): Promise<HaStateRaw> {
    return this.post<HaStateRaw>(`states/${encodeURIComponent(entityId)}`, {
      state,
      attributes: attributes ?? {},
    })
  }

  async renderTemplate(template: string): Promise<string> {
    const isDev = import.meta.env.DEV
    const url = isDev ? `/ha-proxy/api/template` : `${this.baseUrl}/api/template`
    const headers: Record<string, string> = isDev
      ? { ...this.headers, 'X-HA-Base': this.baseUrl }
      : { ...this.headers }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ template }),
    })
    if (!res.ok) throw new Error(`HA API ${res.status}: ${res.statusText}`)
    return res.text()
  }

  async checkConfig(): Promise<{ result: string; errors: string | null }> {
    return this.post<{ result: string; errors: string | null }>('config/core/check_config')
  }

  async handleIntent(
    name: string,
    data?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('intent/handle', { name, data: data ?? {} })
  }
}

// ─── Parser: raw states → Inventory ──────────────────────────────────────────

export function parseInventory(
  states: HaStateRaw[],
  rawAreas: HaAreaRaw[],
  haUrl: string,
  entityRegistry: HaEntityRegistryRaw[] = [],
): Inventory {
  const areaMap = new Map<string, string>()
  const areas: HaArea[] = rawAreas.map((a) => {
    areaMap.set(a.area_id, a.name)
    return { area_id: a.area_id, name: a.name }
  })

  // Build entity_id → area_id map from entity registry (more reliable than state attributes)
  const entityAreaMap = new Map<string, string>()
  for (const e of entityRegistry) {
    if (e.area_id) {
      entityAreaMap.set(e.entity_id, e.area_id)
      // Add area to map if not already known (area_id used as name fallback)
      if (!areaMap.has(e.area_id)) {
        areaMap.set(e.area_id, e.area_id)
        areas.push({ area_id: e.area_id, name: e.area_id })
      }
    }
  }

  // Derive any area IDs mentioned in state attributes as last resort
  for (const s of states) {
    const aid = s.attributes.area_id as string | undefined
    if (aid && !areaMap.has(aid)) {
      areaMap.set(aid, aid)
      areas.push({ area_id: aid, name: aid })
    }
  }

  const automations: Automation[] = []
  const scenes: Scene[] = []
  const groups: Group[] = []
  const scripts: Script[] = []
  const sensors: HaEntity[] = []
  const actuators: HaEntity[] = []
  const others: HaEntity[] = []

  for (const s of states) {
    const domain = s.entity_id.split('.')[0]
    // Prefer entity registry area_id over state attribute (more accurate)
    const area_id = entityAreaMap.get(s.entity_id)
      ?? (s.attributes.area_id as string | undefined)
      ?? null
    const base: HaEntity = {
      entity_id: s.entity_id,
      name: (s.attributes.friendly_name as string) ?? s.entity_id,
      domain,
      state: s.state,
      unit: (s.attributes.unit_of_measurement as string) ?? '',
      device_class: (s.attributes.device_class as string) ?? '',
      area_id,
      area_name: area_id ? (areaMap.get(area_id) ?? null) : null,
      last_changed: s.last_changed,
      last_updated: s.last_updated,
      attributes: s.attributes,
      kind: classifyDomain(domain),
    }

    if (domain === 'automation') {
      automations.push({
        ...base,
        mode: (s.attributes.mode as string) ?? 'single',
        last_triggered: (s.attributes.last_triggered as string) ?? null,
      })
    } else if (domain === 'scene') {
      const ctrl = s.attributes.entity_id
      scenes.push({
        ...base,
        entities_controlled: Array.isArray(ctrl)
          ? (ctrl as string[])
          : typeof ctrl === 'object' && ctrl !== null
          ? Object.keys(ctrl as Record<string, unknown>)
          : [],
      })
    } else if (domain === 'group') {
      const members = s.attributes.entity_id
      groups.push({
        ...base,
        members: Array.isArray(members) ? (members as string[]) : [],
      })
    } else if (domain === 'script') {
      scripts.push({
        ...base,
        last_triggered: (s.attributes.last_triggered as string) ?? null,
      })
    } else {
      const kind = classifyDomain(domain)
      if (kind === 'sensor') sensors.push(base)
      else if (kind === 'actuator') actuators.push(base)
      else others.push(base)
    }
  }

  return {
    generated_at: new Date().toISOString(),
    ha_url: haUrl,
    areas,
    automations,
    scenes,
    groups,
    scripts,
    sensors,
    actuators,
    others,
  }
}
