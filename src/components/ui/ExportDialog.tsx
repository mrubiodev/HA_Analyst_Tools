import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, FileJson, X, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DEFAULT_EXPORT_OPTIONS,
  exportToExcel,
  exportToJson,
  type ExportOptions,
  type ExportSections,
} from '@/lib/exporters'
import type { Inventory } from '@/types/ha'
import type { Zone } from '@/types/ha'

// ─── Section definitions ──────────────────────────────────────────────────────

const SECTION_LABELS: { key: keyof ExportSections; label: string; count: (inv: Inventory, zones: Zone[]) => number }[] = [
  { key: 'automations', label: 'Automatizaciones', count: (i) => i.automations.length },
  { key: 'scenes',      label: 'Escenas',          count: (i) => i.scenes.length },
  { key: 'groups',      label: 'Grupos',            count: (i) => i.groups.length },
  { key: 'scripts',     label: 'Scripts',           count: (i) => i.scripts.length },
  { key: 'sensors',     label: 'Sensores',          count: (i) => i.sensors.length },
  { key: 'actuators',   label: 'Actuadores',        count: (i) => i.actuators.length },
  { key: 'others',      label: 'Otros',             count: (i) => i.others.length },
  { key: 'areas',       label: 'Áreas',             count: (i) => i.areas.length },
  { key: 'zones',       label: 'Zonas',             count: (_i, z) => z.length },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface ExportDialogProps {
  inventory: Inventory
  zones: Zone[]
  children: React.ReactNode // trigger element
}

export function ExportDialog({ inventory, zones, children }: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)

  function toggleSection(key: keyof ExportSections) {
    setOpts((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: !prev.sections[key] },
    }))
  }

  function selectAll() {
    const all = Object.fromEntries(SECTION_LABELS.map((s) => [s.key, true])) as unknown as ExportSections
    setOpts((prev) => ({ ...prev, sections: all }))
  }

  function selectNone() {
    const none = Object.fromEntries(SECTION_LABELS.map((s) => [s.key, false])) as unknown as ExportSections
    setOpts((prev) => ({ ...prev, sections: none }))
  }

  const anySelected = Object.values(opts.sections).some(Boolean)

  function handleExcel() {
    exportToExcel(inventory, zones, opts)
    setOpen(false)
  }

  function handleJson() {
    exportToJson(inventory, zones, opts)
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
              <Layers className="w-4 h-4 text-primary" />
              Opciones de exportación
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Slim mode toggle */}
          <div className="mb-5 rounded-lg border border-border bg-secondary/30 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.slim}
                onChange={() => setOpts((p) => ({ ...p, slim: !p.slim }))}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium leading-none">Modo ligero</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Elimina <code className="bg-secondary px-1 rounded">attributes</code>, <code className="bg-secondary px-1 rounded">last_changed</code> y <code className="bg-secondary px-1 rounded">last_updated</code> de cada entidad. El JSON resultante es hasta 10× más pequeño.
                </p>
              </div>
            </label>
          </div>

          {/* Section checkboxes */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Secciones a incluir</p>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-primary hover:underline">Todas</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={selectNone} className="text-muted-foreground hover:text-foreground hover:underline">Ninguna</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-6">
            {SECTION_LABELS.map(({ key, label, count }) => {
              const n = count(inventory, zones)
              return (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={opts.sections[key]}
                    onChange={() => toggleSection(key)}
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span className={cn('text-sm', opts.sections[key] ? 'text-foreground' : 'text-muted-foreground')}>
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{n}</span>
                </label>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-1.5"
              variant="outline"
              disabled={!anySelected}
              onClick={handleExcel}
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </Button>
            <Button
              className="flex-1 gap-1.5"
              disabled={!anySelected}
              onClick={handleJson}
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
