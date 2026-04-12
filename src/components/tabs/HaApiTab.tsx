import { useState, useCallback } from 'react'
import {
  Database, Wrench, History, BookOpen, Radio, Settings2,
  Code2, CalendarDays, MessageSquare, RefreshCw, Play,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useVaultStore, vaultToken } from '@/store/vaultStore'
import { HAClient } from '@/lib/haApi'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Section =
  | 'states' | 'services' | 'history' | 'logbook'
  | 'events' | 'system' | 'templates' | 'calendars' | 'intents'

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'states',    label: 'Estados',     icon: <Database    className="w-4 h-4" /> },
  { id: 'services',  label: 'Servicios',   icon: <Wrench      className="w-4 h-4" /> },
  { id: 'history',   label: 'Historial',   icon: <History     className="w-4 h-4" /> },
  { id: 'logbook',   label: 'Logbook',     icon: <BookOpen    className="w-4 h-4" /> },
  { id: 'events',    label: 'Eventos',     icon: <Radio       className="w-4 h-4" /> },
  { id: 'system',    label: 'Sistema',     icon: <Settings2   className="w-4 h-4" /> },
  { id: 'templates', label: 'Plantillas',  icon: <Code2       className="w-4 h-4" /> },
  { id: 'calendars', label: 'Calendarios', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'intents',   label: 'Intents',     icon: <MessageSquare className="w-4 h-4" /> },
]

// ─── Shared helpers ───────────────────────────────────────────────────────────

function JsonView({ data, maxH = 'max-h-96' }: { data: unknown; maxH?: string }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return (
    <pre className={cn('overflow-auto text-[11px] bg-secondary/60 rounded-lg p-3 font-mono leading-relaxed', maxH)}>
      {text}
    </pre>
  )
}

function ResultBox({ result, error }: { result: unknown; error: string | null }) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-destructive mt-3">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="font-mono text-xs break-all">{error}</span>
      </div>
    )
  }
  if (result === null) return null
  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-xs text-green-400 mb-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Resultado
      </p>
      <JsonView data={result} />
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{description}</p>
    </div>
  )
}

// ─── States ───────────────────────────────────────────────────────────────────

function StatesSection({ client }: { client: HAClient }) {
  const [states, setStates] = useState<Array<Record<string, unknown>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [domainFilter, setDomainFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [updateEntityId, setUpdateEntityId] = useState('')
  const [updateState, setUpdateState] = useState('')
  const [updateAttrs, setUpdateAttrs] = useState('{}')
  const [updateResult, setUpdateResult] = useState<unknown | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateLoading, setUpdateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await client.getStates()
      setStates(data as unknown as Array<Record<string, unknown>>)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [client])

  const domains = Array.from(new Set((states ?? []).map((s) => (s['entity_id'] as string).split('.')[0]))).sort()

  const filtered = (states ?? []).filter((s) => {
    const id = s['entity_id'] as string
    if (domainFilter && !id.startsWith(`${domainFilter}.`)) return false
    if (search && !id.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleUpdate() {
    if (!updateEntityId || !updateState) return
    setUpdateLoading(true); setUpdateError(null); setUpdateResult(null)
    try {
      let attrs: Record<string, unknown> = {}
      try { attrs = JSON.parse(updateAttrs) as Record<string, unknown> } catch { /* invalid */ }
      const res = await client.updateState(updateEntityId, updateState, attrs)
      setUpdateResult(res)
      // Refresh list of states to reflect the change (some integrations may override)
      try { await load() } catch { /* ignore */ }
      // If we have the states loaded, update the selected entity details
      setSelected((prev) => (prev && prev['entity_id'] === updateEntityId ? { ...(prev as any), state: updateState } : prev))
    } catch (e) { setUpdateError(String(e)) }
    setUpdateLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Estados de entidades" description="GET /api/states  ·  GET /api/states/<entity_id>  ·  POST /api/states/<entity_id>" />
      <div className="flex gap-2 flex-wrap">
        <Button onClick={load} disabled={loading} size="sm" className="gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {states ? 'Recargar' : 'Cargar estados'}
        </Button>
        {states && <Badge variant="outline">{filtered.length} / {states.length} entidades</Badge>}
      </div>
      {error && <ResultBox result={null} error={error} />}

      {states && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* List */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <option value="">Todos los dominios</option>
                {domains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <Input className="h-8 text-xs" placeholder="Buscar entity_id…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">entity_id</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const id = s['entity_id'] as string
                      const st = s['state'] as string
                      return (
                        <tr key={i} className={cn('border-t border-border cursor-pointer hover:bg-accent/30 transition-colors', selected === s && 'bg-accent/50')} onClick={() => { setSelected(s); setUpdateEntityId(id); setUpdateState(st) }}>
                          <td className="px-3 py-1.5 font-mono text-primary text-[11px]">{id}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant={st === 'on' || st === 'open' ? 'success' : st === 'unavailable' || st === 'unknown' ? 'destructive' : 'outline'} className="text-[10px]">{st}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">Sin resultados</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail + update form */}
          <div className="space-y-3">
            {selected && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Detalle completo</p>
                <JsonView data={selected} maxH="max-h-48" />
              </div>
            )}
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-mono">POST /api/states/&lt;entity_id&gt;</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-3">
                <Input placeholder="entity_id" value={updateEntityId} onChange={(e) => setUpdateEntityId(e.target.value)} className="text-xs h-8 font-mono" />
                <Input placeholder="Nuevo estado" value={updateState} onChange={(e) => setUpdateState(e.target.value)} className="text-xs h-8" />
                <Textarea placeholder='Atributos JSON (p.ej. {"friendly_name":"Nota"})' value={updateAttrs} onChange={(e) => setUpdateAttrs(e.target.value)} className="text-xs min-h-0 h-16 resize-none font-mono" />
                <Button size="sm" onClick={handleUpdate} disabled={updateLoading || !updateEntityId || !updateState} className="gap-1.5 w-full">
                  <Play className="w-3 h-3" />{updateLoading ? 'Actualizando…' : 'Actualizar estado'}
                </Button>
                <ResultBox result={updateResult} error={updateError} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Services ─────────────────────────────────────────────────────────────────

function ServicesSection({ client }: { client: HAClient }) {
  const [services, setServices] = useState<Array<{ domain: string; services: Record<string, unknown> }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set())
  const [domainSearch, setDomainSearch] = useState('')
  const [callDomain, setCallDomain] = useState('')
  const [callService, setCallService] = useState('')
  const [callData, setCallData] = useState('{}')
  const [callTarget, setCallTarget] = useState('')
  const [callResult, setCallResult] = useState<unknown | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [callLoading, setCallLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setServices(await client.getServices()) } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [client])

  const toggleDomain = (d: string) => setOpenDomains((prev) => { const n = new Set(prev); if (n.has(d)) { n.delete(d) } else { n.add(d) } return n })

  const filteredServices = (services ?? []).filter((s) => !domainSearch || s.domain.toLowerCase().includes(domainSearch.toLowerCase()))

  async function handleCall() {
    if (!callDomain || !callService) return
    setCallLoading(true); setCallError(null); setCallResult(null)
    try {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(callData) as Record<string, unknown> } catch { /* ignore */ }
      const target = callTarget ? { entity_id: callTarget } : undefined
      setCallResult(await client.callService(callDomain, callService, data, target))
    } catch (e) { setCallError(String(e)) }
    setCallLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Servicios" description="GET /api/services  ·  POST /api/services/<domain>/<service>" />
      <div className="flex gap-2">
        <Button onClick={load} disabled={loading} size="sm" className="gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {services ? 'Recargar' : 'Cargar servicios'}
        </Button>
        {services && <Badge variant="outline">{services.length} dominios</Badge>}
      </div>
      {error && <ResultBox result={null} error={error} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {services && (
          <div className="space-y-2">
            <Input className="h-8 text-xs" placeholder="Filtrar dominio…" value={domainSearch} onChange={(e) => setDomainSearch(e.target.value)} />
            <div className="border border-border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              {filteredServices.map((s) => (
                <div key={s.domain} className="border-b border-border last:border-0">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/30 transition-colors text-left" onClick={() => toggleDomain(s.domain)}>
                    {openDomains.has(s.domain) ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    <span className="font-mono font-semibold text-primary">{s.domain}</span>
                    <span className="text-muted-foreground ml-auto text-[10px]">{Object.keys(s.services).length} servicios</span>
                  </button>
                  {openDomains.has(s.domain) && (
                    <div className="bg-secondary/30 px-4 py-1.5 space-y-0.5">
                      {Object.entries(s.services).map(([svcName, svcDef]) => (
                        <button key={svcName} className="text-xs text-left w-full hover:text-primary transition-colors py-0.5 font-mono" onClick={() => { setCallDomain(s.domain); setCallService(svcName) }}>
                          ▸ {svcName}
                          {typeof svcDef === 'object' && svcDef !== null && 'description' in svcDef && (
                            <span className="text-muted-foreground font-sans ml-2 text-[10px]">{String((svcDef as Record<string, unknown>)['description']).slice(0, 55)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground font-mono">POST /api/services/&lt;domain&gt;/&lt;service&gt;</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            <div className="flex gap-2">
              <Input placeholder="Dominio" value={callDomain} onChange={(e) => setCallDomain(e.target.value)} className="text-xs h-8 font-mono" />
              <Input placeholder="Servicio" value={callService} onChange={(e) => setCallService(e.target.value)} className="text-xs h-8 font-mono" />
            </div>
            <Input placeholder="entity_id destino (opcional)" value={callTarget} onChange={(e) => setCallTarget(e.target.value)} className="text-xs h-8 font-mono" />
            <Textarea placeholder={'Datos JSON\n{"brightness_pct": 80}'} value={callData} onChange={(e) => setCallData(e.target.value)} className="text-xs min-h-0 h-20 resize-none font-mono" />
            <Button size="sm" onClick={handleCall} disabled={callLoading || !callDomain || !callService} className="gap-1.5 w-full">
              <Play className="w-3 h-3" />{callLoading ? 'Ejecutando…' : `Llamar ${callDomain ? `${callDomain}.${callService}` : 'servicio'}`}
            </Button>
            <ResultBox result={callResult} error={callError} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistorySection({ client }: { client: HAClient }) {
  const [entityId, setEntityId] = useState('')
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400_000)
  const [startTime, setStartTime] = useState(yesterday.toISOString().slice(0, 16))
  const [endTime, setEndTime] = useState(now.toISOString().slice(0, 16))
  const [result, setResult] = useState<unknown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await client.getHistory(entityId || undefined, new Date(startTime).toISOString(), new Date(endTime).toISOString(), true))
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  const entries = result && Array.isArray(result) ? (result as unknown[][]).flat() : []

  return (
    <div className="space-y-4">
      <SectionHeader title="Historial de estados" description="GET /api/history/period/<timestamp>?filter_entity_id=&end_time=&minimal_response" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <Input placeholder="entity_id (vacío = todos)" value={entityId} onChange={(e) => setEntityId(e.target.value)} className="text-xs h-8 font-mono" />
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Inicio</label>
          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Fin</label>
          <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs h-8" />
        </div>
        <Button onClick={load} disabled={loading} size="sm" className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Cargar
        </Button>
      </div>
      {error && <ResultBox result={null} error={error} />}

      {entries.length > 0 && (
        <div className="space-y-2">
          <Badge variant="outline">{entries.length} registros</Badge>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">entity_id</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">estado</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">last_changed</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const e = entry as Record<string, unknown>
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono text-primary text-[10px]">{String(e['entity_id'] ?? '')}</td>
                        <td className="px-3 py-1.5"><Badge variant="outline" className="text-[10px]">{String(e['state'] ?? '')}</Badge></td>
                        <td className="px-3 py-1.5 text-muted-foreground text-[10px]">{e['last_changed'] ? new Date(e['last_changed'] as string).toLocaleString('es-ES') : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Logbook ──────────────────────────────────────────────────────────────────

function LogbookSection({ client }: { client: HAClient }) {
  const now = new Date()
  const [entityId, setEntityId] = useState('')
  const [startTime, setStartTime] = useState(new Date(now.getTime() - 86400_000).toISOString().slice(0, 16))
  const [endTime, setEndTime] = useState(now.toISOString().slice(0, 16))
  const [result, setResult] = useState<Array<Record<string, unknown>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await client.getLogbook(new Date(startTime).toISOString(), entityId || undefined, new Date(endTime).toISOString()))
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Logbook" description="GET /api/logbook/<timestamp>?entity_id=&end_time=" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <Input placeholder="entity_id (opcional)" value={entityId} onChange={(e) => setEntityId(e.target.value)} className="text-xs h-8 font-mono" />
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Inicio</label>
          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Fin</label>
          <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs h-8" />
        </div>
        <Button onClick={load} disabled={loading} size="sm" className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Cargar
        </Button>
      </div>
      {error && <ResultBox result={null} error={error} />}

      {result && (
        <div className="space-y-2">
          <Badge variant="outline">{result.length} entradas</Badge>
          <div className="border border-border rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto">
            {result.length === 0 && <p className="px-3 py-4 text-xs text-center text-muted-foreground">Sin entradas en este rango</p>}
            {result.map((e, i) => (
              <div key={i} className="border-b border-border last:border-0 px-3 py-2 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground text-[10px] shrink-0">{e['when'] ? new Date(e['when'] as string).toLocaleString('es-ES') : ''}</span>
                  {!!e['entity_id'] && <span className="font-mono text-primary text-[10px]">{String(e['entity_id'])}</span>}
                  {!!e['domain'] && <Badge variant="outline" className="text-[9px] px-1">{String(e['domain'])}</Badge>}
                </div>
                <p className="text-xs mt-0.5">{String(e['message'] ?? e['name'] ?? '')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Events ───────────────────────────────────────────────────────────────────

function EventsSection({ client }: { client: HAClient }) {
  const [events, setEvents] = useState<Array<{ event_type: string; listener_count: number }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fireType, setFireType] = useState('')
  const [fireData, setFireData] = useState('{}')
  const [fireResult, setFireResult] = useState<unknown | null>(null)
  const [fireError, setFireError] = useState<string | null>(null)
  const [fireLoading, setFireLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setEvents(await client.getEventsList()) } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [client])

  async function handleFire() {
    if (!fireType) return
    setFireLoading(true); setFireError(null); setFireResult(null)
    try {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(fireData) as Record<string, unknown> } catch { /* ignore */ }
      setFireResult(await client.fireEvent(fireType, data))
    } catch (e) { setFireError(String(e)) }
    setFireLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Eventos" description="GET /api/events  ·  POST /api/events/<event_type>" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Button onClick={load} disabled={loading} size="sm" className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {events ? 'Recargar' : 'Cargar eventos'}
          </Button>
          {error && <ResultBox result={null} error={error} />}
              {events && (
            <div className="border border-border rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">event_type</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">listeners</th>
                  </tr>
                </thead>
                <tbody>
                      {events.map((ev, i) => {
                        // Some HA proxies or middleware may return slightly different shapes
                        // (e.g. `event_type` vs `eventType` or `type`). Be defensive and
                        // display any available field.
                        const et = String((ev as any)['event_type'] ?? (ev as any)['eventType'] ?? (ev as any)['type'] ?? '')
                        const lc = (ev as any)['listener_count'] ?? (ev as any)['listeners'] ?? ''
                        return (
                          <tr key={et || i} className="border-t border-border hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => setFireType(et)}>
                            <td className="px-3 py-1.5 font-mono text-primary text-[11px]">{et}</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground">{String(lc)}</td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground font-mono">POST /api/events/&lt;event_type&gt;</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            <Input placeholder="event_type" value={fireType} onChange={(e) => setFireType(e.target.value)} className="text-xs h-8 font-mono" />
            <Textarea placeholder={'Datos JSON\n{"key": "value"}'} value={fireData} onChange={(e) => setFireData(e.target.value)} className="text-xs min-h-0 h-20 resize-none font-mono" />
            <Button size="sm" onClick={handleFire} disabled={fireLoading || !fireType} className="gap-1.5 w-full">
              <Play className="w-3 h-3" />{fireLoading ? 'Disparando…' : 'Disparar evento'}
            </Button>
            <ResultBox result={fireResult} error={fireError} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── System ───────────────────────────────────────────────────────────────────

function SystemSection({ client }: { client: HAClient }) {
  const [haConfig, setHaConfig] = useState<unknown | null>(null)
  const [components, setComponents] = useState<string[] | null>(null)
  const [errorLog, setErrorLog] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<{ result: string; errors: string | null } | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [compFilter, setCompFilter] = useState('')

  function setL(key: string, v: boolean) { setLoading((p) => ({ ...p, [key]: v })) }

  async function loadConfig() {
    setL('cfg', true); setErrMsg(null)
    try { setHaConfig(await client.getConfig()) } catch (e) { setErrMsg(String(e)) }
    setL('cfg', false)
  }
  async function loadComponents() {
    setL('cmp', true)
    try { setComponents(await client.getComponents()) } catch (e) { setErrMsg(String(e)) }
    setL('cmp', false)
  }
  async function loadErrorLog() {
    setL('log', true)
    try { setErrorLog(await client.getErrorLog()) } catch (e) { setErrMsg(String(e)) }
    setL('log', false)
  }
  async function runCheck() {
    setL('chk', true)
    try { setCheckResult(await client.checkConfig()) } catch (e) { setErrMsg(String(e)) }
    setL('chk', false)
  }

  const filteredComponents = (components ?? []).filter((c) => !compFilter || c.toLowerCase().includes(compFilter.toLowerCase()))

  return (
    <div className="space-y-4">
      <SectionHeader title="Sistema" description="GET /api/config  ·  GET /api/components  ·  GET /api/error_log  ·  POST /api/config/core/check_config" />
      {errMsg && <ResultBox result={null} error={errMsg} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground">GET /api/config</CardTitle>
            <Button size="sm" variant="ghost" onClick={loadConfig} disabled={loading['cfg']} className="h-7 px-2 gap-1">
              <RefreshCw className={cn('w-3 h-3', loading['cfg'] && 'animate-spin')} />Cargar
            </Button>
          </CardHeader>
          {haConfig != null && <CardContent className="px-4 pb-3"><JsonView data={haConfig} maxH="max-h-52" /></CardContent>}
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground">POST /api/config/core/check_config</CardTitle>
            <Button size="sm" variant="ghost" onClick={runCheck} disabled={loading['chk']} className="h-7 px-2 gap-1">
              <Play className={cn('w-3 h-3', loading['chk'] && 'animate-spin')} />Verificar
            </Button>
          </CardHeader>
          {checkResult && (
            <CardContent className="px-4 pb-3">
              {(() => {
                const ok = checkResult.result === 'valid'
                return (
                  <div className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-xs border', ok ? 'bg-green-500/10 text-green-400 border-green-400/30' : 'bg-destructive/10 text-destructive border-destructive/30')}>
                    {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <div>
                      <p className="font-semibold">{ok ? 'Configuración válida ✓' : 'Errores en configuración'}</p>
                      {checkResult.errors && <p className="mt-1 font-mono text-[10px]">{checkResult.errors}</p>}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground">GET /api/components</CardTitle>
            <Button size="sm" variant="ghost" onClick={loadComponents} disabled={loading['cmp']} className="h-7 px-2 gap-1">
              <RefreshCw className={cn('w-3 h-3', loading['cmp'] && 'animate-spin')} />Cargar
            </Button>
          </CardHeader>
          {components && (
            <CardContent className="px-4 pb-3 space-y-2">
              <Input className="h-7 text-xs" placeholder="Filtrar componente…" value={compFilter} onChange={(e) => setCompFilter(e.target.value)} />
              <div className="flex flex-wrap gap-1 max-h-36 overflow-auto">
                {filteredComponents.map((c) => <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>)}
              </div>
              <p className="text-[10px] text-muted-foreground">{filteredComponents.length} / {components.length} componentes</p>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-mono text-muted-foreground">GET /api/error_log</CardTitle>
            <Button size="sm" variant="ghost" onClick={loadErrorLog} disabled={loading['log']} className="h-7 px-2 gap-1">
              <RefreshCw className={cn('w-3 h-3', loading['log'] && 'animate-spin')} />Cargar
            </Button>
          </CardHeader>
          {errorLog !== null && (
            <CardContent className="px-4 pb-3">
              <pre className="text-[10px] font-mono bg-secondary/60 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">
                {errorLog || '(sin errores en el log)'}
              </pre>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

// ─── Templates ────────────────────────────────────────────────────────────────

function TemplatesSection({ client }: { client: HAClient }) {
  const [template, setTemplate] = useState(`{{ states('sun.sun') }}\n{{ now().strftime('%H:%M:%S') }}\n{{ states | selectattr('domain','eq','light') | list | length }} luces totales`)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function render() {
    setLoading(true); setError(null); setResult(null)
    try { setResult(await client.renderTemplate(template)) } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Plantillas Jinja2" description="POST /api/template — renderiza Jinja2 con acceso completo al estado de Home Assistant" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Plantilla Jinja2</label>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="font-mono text-xs min-h-[220px] resize-y"
            placeholder="{{ states('light.living_room') }}"
          />
          <Button onClick={render} disabled={loading || !template} size="sm" className="gap-1.5 w-full">
            <Play className="w-3 h-3" />{loading ? 'Renderizando…' : 'Renderizar plantilla'}
          </Button>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Resultado</label>
          {error && <ResultBox result={null} error={error} />}
          {result !== null ? (
            <pre className="font-mono text-sm bg-secondary/60 rounded-lg p-4 min-h-[220px] whitespace-pre-wrap border border-border">{result}</pre>
          ) : (
            <div className="min-h-[220px] rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
              El resultado aparecerá aquí
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Calendars ────────────────────────────────────────────────────────────────

function CalendarsSection({ client }: { client: HAClient }) {
  const now = new Date()
  const [calendars, setCalendars] = useState<Array<{ entity_id: string; name: string }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCalendar, setSelectedCalendar] = useState('')
  const [startTime, setStartTime] = useState(now.toISOString().slice(0, 16))
  const [endTime, setEndTime] = useState(new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 16))
  const [events, setEvents] = useState<unknown[] | null>(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const loadCalendars = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCalendars(await client.getCalendars()) } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [client])

  async function loadEvents() {
    if (!selectedCalendar) return
    setEventsLoading(true); setEventsError(null); setEvents(null)
    try {
      setEvents(await client.getCalendarEvents(selectedCalendar, new Date(startTime).toISOString(), new Date(endTime).toISOString()))
    } catch (e) { setEventsError(String(e)) }
    setEventsLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Calendarios" description="GET /api/calendars  ·  GET /api/calendars/<entity_id>?start=&end=" />
      <div className="flex gap-2">
        <Button onClick={loadCalendars} disabled={loading} size="sm" className="gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {calendars ? 'Recargar' : 'Cargar calendarios'}
        </Button>
        {calendars && <Badge variant="outline">{calendars.length} calendarios</Badge>}
      </div>
      {error && <ResultBox result={null} error={error} />}

      {calendars && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Selecciona un calendario</label>
            {calendars.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay calendarios configurados.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                {calendars.map((cal) => (
                  <button key={cal.entity_id} className={cn('w-full text-left px-3 py-2 text-xs border-b border-border last:border-0 hover:bg-accent/30 transition-colors', selectedCalendar === cal.entity_id && 'bg-accent/50')} onClick={() => setSelectedCalendar(cal.entity_id)}>
                    <span className="font-medium">{cal.name}</span>
                    <span className="text-muted-foreground font-mono ml-2 text-[10px]">{cal.entity_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <div className="space-y-0.5 flex-1 min-w-[140px]">
                <label className="text-[10px] text-muted-foreground">Inicio</label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs h-8" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-[140px]">
                <label className="text-[10px] text-muted-foreground">Fin</label>
                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <Button onClick={loadEvents} disabled={eventsLoading || !selectedCalendar} size="sm" className="gap-1.5 w-full">
              <RefreshCw className={cn('w-3.5 h-3.5', eventsLoading && 'animate-spin')} />
              {eventsLoading ? 'Cargando…' : `Ver eventos${selectedCalendar ? ` de ${selectedCalendar}` : ''}`}
            </Button>
            {eventsError && <ResultBox result={null} error={eventsError} />}
            {events && (
              <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {(events as Array<Record<string, unknown>>).length === 0 ? (
                  <p className="px-3 py-4 text-xs text-center text-muted-foreground">Sin eventos en este rango</p>
                ) : (
                  (events as Array<Record<string, unknown>>).map((ev, i) => (
                    <div key={i} className="border-b border-border last:border-0 px-3 py-2">
                      <p className="text-xs font-medium">{String(ev['summary'] ?? ev['title'] ?? '(sin título)')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {String((ev['start'] as Record<string, unknown> | undefined)?.['dateTime'] ?? (ev['start'] as Record<string, unknown> | undefined)?.['date'] ?? '')}
                        {' → '}
                        {String((ev['end'] as Record<string, unknown> | undefined)?.['dateTime'] ?? (ev['end'] as Record<string, unknown> | undefined)?.['date'] ?? '')}
                      </p>
                      {!!ev['description'] && <p className="text-[10px] text-muted-foreground mt-0.5">{String(ev['description'])}</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Intents ──────────────────────────────────────────────────────────────────

function IntentsSection({ client }: { client: HAClient }) {
  const [intentName, setIntentName] = useState('GetState')
  const [intentData, setIntentData] = useState('{\n  "name": "living room"\n}')
  const [result, setResult] = useState<unknown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const EXAMPLES = ['GetState', 'TurnOn', 'TurnOff', 'Toggle', 'SetPosition', 'SetTemperature', 'HassTurnOn', 'HassTurnOff', 'HassLightSet']

  async function handle() {
    setLoading(true); setError(null); setResult(null)
    try {
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(intentData) as Record<string, unknown> } catch { /* ignore */ }
      setResult(await client.handleIntent(intentName, data))
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Intents" description="POST /api/intent/handle — Conversation/voice intents de Home Assistant" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nombre del intent</label>
            <Input value={intentName} onChange={(e) => setIntentName(e.target.value)} className="text-xs h-8 font-mono" placeholder="GetState" />
            <div className="flex flex-wrap gap-1 mt-1">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent/30 transition-colors font-mono" onClick={() => setIntentName(ex)}>{ex}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Datos del intent (JSON)</label>
            <Textarea value={intentData} onChange={(e) => setIntentData(e.target.value)} className="font-mono text-xs min-h-[120px] resize-y" />
          </div>
          <Button onClick={handle} disabled={loading || !intentName} size="sm" className="gap-1.5 w-full">
            <Play className="w-3 h-3" />{loading ? 'Procesando…' : `Ejecutar ${intentName}`}
          </Button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Respuesta</label>
          <ResultBox result={result} error={error} />
          {!result && !error && (
            <div className="mt-3 text-xs text-muted-foreground space-y-1.5 bg-secondary/30 rounded-lg p-3 border border-border">
              <p className="font-medium text-foreground">Ejemplos:</p>
              <p>• <code className="font-mono">TurnOn</code> + <code className="font-mono">{`{"name":"salon"}`}</code></p>
              <p>• <code className="font-mono">GetState</code> + <code className="font-mono">{`{"name":"temperatura cocina"}`}</code></p>
              <p>• <code className="font-mono">HassLightSet</code> + <code className="font-mono">{`{"name":"all","brightness":50}`}</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function HaApiTab() {
  const [activeSection, setActiveSection] = useState<Section>('states')
  const url = useVaultStore((s) => s.url)
  const connected = useVaultStore((s) => s.connected)

  // Create client from current vault credentials
  const client = new HAClient(url, vaultToken.get())

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="w-10 h-10 opacity-30" />
        <p className="text-sm">Conecta a Home Assistant primero (pestaña Vault)</p>
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[500px]">
      {/* Sidebar */}
      <nav className="w-44 shrink-0 space-y-0.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors',
              activeSection === s.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40',
            )}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </nav>

      {/* Content panel */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-5 h-full overflow-auto">
          {activeSection === 'states'    && <StatesSection    client={client} />}
          {activeSection === 'services'  && <ServicesSection  client={client} />}
          {activeSection === 'history'   && <HistorySection   client={client} />}
          {activeSection === 'logbook'   && <LogbookSection   client={client} />}
          {activeSection === 'events'    && <EventsSection    client={client} />}
          {activeSection === 'system'    && <SystemSection    client={client} />}
          {activeSection === 'templates' && <TemplatesSection client={client} />}
          {activeSection === 'calendars' && <CalendarsSection client={client} />}
          {activeSection === 'intents'   && <IntentsSection   client={client} />}
        </CardContent>
      </Card>
    </div>
  )
}
