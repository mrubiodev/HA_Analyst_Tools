
import { Shield, Wifi, WifiOff, Download, Home } from 'lucide-react'
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

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
