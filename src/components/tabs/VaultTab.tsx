import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Upload, Eye, EyeOff, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useVaultStore, vaultToken } from '@/store/vaultStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { HAClient, parseInventory } from '@/lib/haApi'
import type { Inventory } from '@/types/ha'

export function VaultTab() {
  const { url, setUrl, connected, setConnected, connecting, setConnecting, error, setError } =
    useVaultStore()
  const { setInventory, loading } = useInventoryStore()

  const [localToken, setLocalToken] = useState(() => vaultToken.get())
  const [showToken, setShowToken] = useState(false)
  const [corsError, setCorsError] = useState(false)

  useEffect(() => {
    vaultToken.set(localToken)
  }, [localToken])

  async function handleConnect() {
    if (!url || !localToken) {
      setError('Introduce la URL y el token de HA')
      return
    }
    setConnecting(true)
    setError(null)
    setCorsError(false)

    try {
      const client = new HAClient(url, localToken)
      const ok = await client.ping()
      if (!ok) {
        setError('No se pudo conectar. Verifica la URL y el token.')
        setConnected(false)
        setConnecting(false)
        return
      }

      const [states, areas, entityRegistry] = await Promise.all([
        client.getStates(),
        client.getAreas(),
        client.getEntityRegistry(),
      ])
      const inv = parseInventory(states, areas, url, entityRegistry)
      setInventory(inv)
      setConnected(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('cors')) {
        setCorsError(true)
        setError('Error de red (posiblemente CORS). Ver instrucciones abajo.')
      } else {
        setError(msg)
      }
      setConnected(false)
    } finally {
      setConnecting(false)
    }
  }

  function handleLoadJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Inventory
        if (!data.automations || !data.sensors) {
          setError('JSON inválido: no parece un inventario de HA válido')
          return
        }
        setInventory(data)
        setConnected(true)
        setError(null)
        // fake url
        setUrl(data.ha_url || 'Cargado desde archivo')
      } catch {
        setError('No se pudo parsear el JSON')
      }
    }
    reader.readAsText(file)
    // reset input
    e.target.value = ''
  }

  return (
    <div className="grid gap-6 max-w-2xl mx-auto">
      {/* Connection card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {connected ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-muted-foreground" />
            )}
            Conexión a Home Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); void handleConnect() }}
          >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">URL de Home Assistant</label>
            <Input
              placeholder="http://homeassistant.local:8123"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={connecting || loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Long-Lived Access Token</label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
                value={localToken}
                onChange={(e) => setLocalToken(e.target.value)}
                disabled={connecting || loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              HA → Perfil → Seguridad → Tokens de acceso de larga duración
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {connected && !error && (
            <div className="rounded-md bg-emerald-600/10 border border-emerald-600/30 px-3 py-2 text-sm text-emerald-400">
              ✓ Conectado y datos cargados correctamente
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={connecting || loading || !url || !localToken}
          >
            {connecting || loading ? 'Conectando...' : connected ? 'Reconectar / Actualizar' : 'Conectar'}
          </Button>
          </form>
        </CardContent>
      </Card>

      {/* Offline/JSON fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Modo offline — Cargar JSON
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Si no puedes habilitar CORS, ejecuta el script <code className="text-xs bg-secondary px-1 rounded">ha_inventory.py</code> en tu HA y carga el JSON resultante aquí.
          </p>
          <label className="inline-flex items-center gap-2 cursor-pointer h-8 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Seleccionar ha_inventory.json
            <input type="file" accept=".json" className="hidden" onChange={handleLoadJson} />
          </label>
        </CardContent>
      </Card>

      {/* CORS instructions */}
      {corsError && (
        <Card className="border-yellow-600/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Info className="w-5 h-5" />
              Habilitar CORS en Home Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Para que el navegador pueda hacer peticiones a HA, debes añadir estas líneas a tu <code className="bg-secondary px-1 rounded">configuration.yaml</code>:</p>
            <pre className="bg-secondary rounded p-3 text-xs overflow-auto">{`http:
  cors_allowed_origins:
    - "http://localhost:5173"   # dev
    - "http://TU_IP_APP:80"    # producción`}</pre>
            <p className="text-muted-foreground">Después reinicia HA (Herramientas del programador → Reiniciar).</p>
            <p>Alternativa sin CORS: usa el <strong>modo offline</strong> con el script Python de arriba.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
