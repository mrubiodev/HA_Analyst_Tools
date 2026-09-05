
import { Shield, Wifi, WifiOff, Download, Home, AlertTriangle, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVaultStore } from '@/store/vaultStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { useZonesStore } from '@/store/zonesStore'
import { ExportDialog } from '@/components/ui/ExportDialog'
import { cn } from '@/lib/utils'

type Tab = 'vault' | 'resumen' | 'explorer' | 'automatizaciones' | 'zonas' | 'agente' | 'haapi'

const TABS: { id: Tab; label: string }[] = [
  { id: 'vault', label: '🔐 Vault' },
  { id: 'resumen', label: '📊 Resumen' },
  { id: 'explorer', label: '🔍 Explorer' },
  { id: 'automatizaciones', label: '⚡ Automatizaciones' },
  { id: 'zonas', label: '🏠 Zonas' },
  { id: 'agente', label: '🤖 Agente IA' },
  { id: 'haapi', label: '🛠️ API HA' },
]

interface AppShellProps {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  children: React.ReactNode
}

export function AppShell({ activeTab, setActiveTab, children }: AppShellProps) {
  const connected = useVaultStore((s) => s.connected)
  const inventory = useInventoryStore((s) => s.inventory)
  const zones = useZonesStore((s) => s.zones)

  const inventoryStatus = inventory ? 'Inventario cargado' : 'Sin inventario'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-screen-xl px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 mr-auto">
            <Home className="w-5 h-5 text-primary" />
            <span className="font-bold text-base tracking-tight">HA Analyst</span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Desconectado</span>
              </>
            )}
          </div>

          {/* Export button */}
          {inventory ? (
            <ExportDialog inventory={inventory} zones={zones}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Exportar
              </Button>
            </ExportDialog>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Download className="w-3.5 h-3.5" />
              Exportar
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTab('vault')}
            title="Vault"
          >
            <Shield className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-screen-xl px-4 flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                activeTab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <aside className="border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-emerald-500/5">
        <div className="mx-auto max-w-screen-xl px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                HA Analyst
              </span>
              <span className="text-muted-foreground">Panel de control</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-border bg-background text-muted-foreground',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-muted-foreground')} />
                {connected ? 'Conexión activa' : 'Sin conexión'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground">
                {inventoryStatus}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-muted-foreground">
                Privacidad reforzada
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Privacy disclaimer ─────────────────────────────────────────── */}
      <aside className="border-b border-yellow-500/30 bg-yellow-500/10 text-yellow-100">
        <div className="mx-auto max-w-screen-xl px-4 py-2.5 flex items-start gap-2 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
          <p>
            <strong>Privacidad:</strong> no introduzcas tokens de Home Assistant ni API keys en ordenadores compartidos.
            Usa credenciales temporales y de mínimo privilegio, no compartas capturas, exportaciones ni archivos JSON con datos reales,
            y limpia el almacenamiento del navegador al terminar.
          </p>
        </div>
      </aside>

      <aside className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-screen-xl px-4 py-4">
          <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Sobre mí</p>
                <h3 className="text-lg font-semibold">Soy Mario</h3>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Desarrollo herramientas para Home Assistant y automatización domótica. Si este proyecto te ha servido,
                  me encantaría invitarte a un café como agradecimiento.
                </p>
              </div>

              <a href="https://buymeacoffee.com" target="_blank" rel="noreferrer">
                <Button variant="outline" className="gap-2 border-amber-500/50 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
                  <Coffee className="w-4 h-4" />
                  Invítame a un café
                </Button>
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
