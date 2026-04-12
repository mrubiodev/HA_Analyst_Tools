import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Send, Bot, User, AlertCircle, Settings, Loader2,
  Wrench, ChevronDown, ChevronRight, Zap, SlidersHorizontal, Eye, Gauge,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useInventoryStore } from '@/store/inventoryStore'
import { useVaultStore, vaultToken } from '@/store/vaultStore'
import { runAgentLoop, sendLlmMessage, buildInventorySystemPrompt } from '@/lib/llmProviders'
import { HAClient } from '@/lib/haApi'
import { HA_TOOLS, READ_ONLY_TOOLS, ACTION_TOOLS } from '@/lib/haTools'
import type { HaTool } from '@/lib/haTools'
import type { LlmProvider, LlmMessage, LlmConfig, ToolCallDef } from '@/types/ha'
import { cn, estimateTokens, estimateMessagesTokens } from '@/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type MsgMeta = { reasoning?: string; stats?: Record<string, unknown>; createdAt?: string; responseMs?: number }

type AgentStep = {
  call: ToolCallDef
  result: unknown
  ok: boolean
}

type ChatMsg =
  | { kind: 'chat'; msg: LlmMessage; meta?: MsgMeta }
  | { kind: 'agent_block'; id: string; steps: AgentStep[]; done: boolean }

const QUICK_QUESTIONS = [
  '¿Qué automatizaciones nunca se han disparado y podría eliminar?',
  '¿Qué sensores tienen estado "unavailable" o "unknown"?',
  '¿Qué entidades no están asignadas a ningún área?',
  '¿Cuáles son las automatizaciones relacionadas con energía o consumo?',
  '¿Qué actuadores están encendidos ahora mismo?',
  '¿Cómo podría optimizar mis automatizaciones de iluminación?',
]

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  claude: '🟣 Claude (Anthropic)',
  openai: '🟢 OpenAI (GPT-4o)',
  openrouter: '🔵 OpenRouter',
  ollama: '⚫ Ollama (local)',
  llmstudio: '🟠 LLMStudio (local)',
}

const AUTO_SUMMARY_PREFIX = 'Resumen automático de conversación previa.'
const SUMMARY_TARGET_CHARS = 1200
const MIN_LIVE_MESSAGES = 4
const COMPRESSION_TARGET_RATIO = 0.75
const DEFAULT_LLMSTUDIO_MAX_CONTEXT = 14000
const DEFAULT_LLMSTUDIO_RESERVE = 2048

type LlmStudioModelInfo = {
  id: string
  label: string
  maxContextLength?: number
  loadedContextLength?: number
}

function clipText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

function formatCompactNumber(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatDateTime(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDuration(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return ''
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function statNumber(stats: Record<string, unknown> | undefined, key: string): number | undefined {
  const raw = stats?.[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function ContextMeter({ context, summary, live, requestBudget }: { context: number; summary: number; live: number; requestBudget: number }) {
  const total = context + summary + live
  const safeBudget = Math.max(1, requestBudget)
  const contextWidth = Math.min(100, (context / safeBudget) * 100)
  const summaryWidth = Math.min(100, (summary / safeBudget) * 100)
  const liveWidth = Math.min(100, (live / safeBudget) * 100)
  const usedWidth = Math.min(100, (total / safeBudget) * 100)
  const freeWidth = Math.max(0, 100 - usedWidth)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wide">
        <Gauge className="w-3 h-3" /> Ocupación de contexto
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-secondary/30 p-1.5">
        <div className="flex h-3 overflow-hidden rounded-xl bg-background/70">
          <div className="bg-sky-500/70" style={{ width: `${contextWidth}%` }} />
          <div className="bg-amber-500/70" style={{ width: `${summaryWidth}%` }} />
          <div className="bg-emerald-500/70" style={{ width: `${liveWidth}%` }} />
          <div className="bg-transparent" style={{ width: `${freeWidth}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground sm:grid-cols-4">
        <span>Instr. {formatCompactNumber(context)}</span>
        <span>Resumen {formatCompactNumber(summary)}</span>
        <span>Mensajes {formatCompactNumber(live)}</span>
        <span>Libre {formatCompactNumber(Math.max(0, requestBudget - total))}</span>
      </div>
    </div>
  )
}

function isAutoSummaryMessage(msg: LlmMessage): boolean {
  return msg.role === 'assistant' && msg.content.startsWith(AUTO_SUMMARY_PREFIX)
}

function buildSummaryMessage(summary: string): LlmMessage[] {
  if (!summary.trim()) return []
  return [{
    role: 'assistant',
    content: `${AUTO_SUMMARY_PREFIX}\n${summary}`,
  }]
}

function summarizeMessages(messages: LlmMessage[]): string {
  const lines = messages
    .filter((m) => !isAutoSummaryMessage(m) && m.content.trim())
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${clipText(m.content, 220)}`)

  return clipText(lines.join('\n'), SUMMARY_TARGET_CHARS)
}

function mergeSummaries(existing: string, addition: string): string {
  if (!addition.trim()) return existing
  if (!existing.trim()) return clipText(addition, SUMMARY_TARGET_CHARS)
  return clipText(`${existing}\n${addition}`, SUMMARY_TARGET_CHARS)
}

function estimateManagedTokens(systemPrompt: string, summary: string, liveMessages: LlmMessage[]): { context: number; summary: number; live: number; total: number } {
  const context = estimateTokens(systemPrompt)
  const summaryMessages = buildSummaryMessage(summary)
  const summaryTokens = estimateMessagesTokens('', summaryMessages)
  const live = estimateMessagesTokens('', liveMessages)
  return { context, summary: summaryTokens, live, total: context + summaryTokens + live }
}

function toFiniteTokenNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value)
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  }
  return undefined
}

function normalizeLlmStudioModels(payload: unknown): { options: string[]; infos: Record<string, LlmStudioModelInfo> } {
  const infos: Record<string, LlmStudioModelInfo> = {}

  const rawModels = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>)?.models)
      ? ((payload as Record<string, unknown>).models as unknown[])
      : Array.isArray((payload as Record<string, unknown>)?.data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : []

  const aliases = new Set<string>()

  for (const rawModel of rawModels) {
    const model = rawModel as Record<string, unknown>
    const id = String(model['key'] || model['id'] || model['name'] || model['display_name'] || '').trim()
    if (!id) continue

    const label = String(model['display_name'] || model['name'] || id)
    const maxContextLength = toFiniteTokenNumber(model['max_context_length'])
    const loadedContextLength = toFiniteTokenNumber(model['loaded_context_length'])
      ?? toFiniteTokenNumber(((model['loaded_instances'] as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined)?.config && (((model['loaded_instances'] as unknown[])[0] as Record<string, unknown>).config as Record<string, unknown>)['context_length'])

    const info: LlmStudioModelInfo = { id, label, maxContextLength, loadedContextLength }
    infos[id] = info
    aliases.add(id)

    for (const alias of [model['display_name'], model['name'], model['id'], model['selected_variant']]) {
      const key = String(alias || '').trim()
      if (!key) continue
      infos[key] = info
      aliases.add(id)
    }

    const variants = model['variants']
    if (Array.isArray(variants)) {
      for (const variant of variants) {
        const key = String(variant || '').trim()
        if (!key) continue
        infos[key] = info
      }
    }
  }

  return { options: [...aliases], infos }
}

function getLlmStudioRequestBudget(config: LlmConfig, modelInfo?: LlmStudioModelInfo): { maxContext: number; reserve: number; requestBudget: number; modelMax?: number; loadedContext?: number } {
  const configuredMax = config.llmstudioMaxContextTokens
  const manualMax = configuredMax !== undefined && configuredMax !== DEFAULT_LLMSTUDIO_MAX_CONTEXT ? configuredMax : undefined
  const maxContext = manualMax ?? modelInfo?.loadedContextLength ?? modelInfo?.maxContextLength ?? configuredMax ?? DEFAULT_LLMSTUDIO_MAX_CONTEXT
  const reserve = config.llmstudioContextReserveTokens ?? DEFAULT_LLMSTUDIO_RESERVE
  const requestBudget = Math.max(1000, maxContext - reserve)
  return { maxContext, reserve, requestBudget, modelMax: modelInfo?.maxContextLength, loadedContext: modelInfo?.loadedContextLength }
}

function compactConversationToBudget(
  systemPrompt: string,
  summary: string,
  liveMessages: LlmMessage[],
  allowedTokens: number,
): { summary: string; liveMessages: LlmMessage[]; compressionSteps: number } {
  let nextSummary = summary
  let nextLive = [...liveMessages]
  let compressionSteps = 0
  const target = Math.floor(allowedTokens * COMPRESSION_TARGET_RATIO)

  while (estimateManagedTokens(systemPrompt, nextSummary, nextLive).total > target && nextLive.length > MIN_LIVE_MESSAGES) {
    let chunkSize = Math.min(6, nextLive.length - MIN_LIVE_MESSAGES)
    if (chunkSize < 2) break
    if (chunkSize % 2 !== 0) chunkSize--
    if (chunkSize < 2) break

    const chunk = nextLive.slice(0, chunkSize)
    nextSummary = mergeSummaries(nextSummary, summarizeMessages(chunk))
    nextLive = nextLive.slice(chunkSize)
    compressionSteps++
  }

  return { summary: nextSummary, liveMessages: nextLive, compressionSteps }
}

// ─── Chat sub-components ──────────────────────────────────────────────────────

function ChatMessage({ msg, meta }: { msg: LlmMessage; meta?: MsgMeta }) {
  const isUser = msg.role === 'user'
  const stats = meta?.stats as Record<string, unknown> | undefined
  const inputTokens = statNumber(stats, 'input_tokens') ?? statNumber(stats, 'prompt_tokens')
  const outputTokens = statNumber(stats, 'output_tokens') ?? statNumber(stats, 'completion_tokens')
  const totalTokens = statNumber(stats, 'total_tokens')
  const tokensPerSecond = statNumber(stats, 'tokens_per_second')
  const footerBits = [
    formatDateTime(meta?.createdAt),
    inputTokens !== undefined ? `in ${formatCompactNumber(inputTokens)}` : '',
    outputTokens !== undefined ? `out ${formatCompactNumber(outputTokens)}` : '',
    totalTokens !== undefined ? `total ${formatCompactNumber(totalTokens)}` : '',
    tokensPerSecond !== undefined ? `${tokensPerSecond.toFixed(1)} tok/s` : '',
    formatDuration(meta?.responseMs),
  ].filter(Boolean)

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn('rounded-full p-1.5 h-fit flex-shrink-0', isUser ? 'bg-primary/20' : 'bg-secondary')}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
      </div>
      <div className={cn('rounded-2xl px-4 py-3 text-sm max-w-[85%] whitespace-pre-wrap border', isUser ? 'bg-primary/15 text-foreground border-primary/20' : 'bg-secondary text-foreground border-border/60')}>
        {msg.content}
        {meta?.reasoning && (
          <div className="mt-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            {meta.reasoning && <div className="italic mb-1">Reasoning: {String(meta.reasoning)}</div>}
          </div>
        )}
        {footerBits.length > 0 && <div className="mt-3 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">{footerBits.join(' · ')}</div>}
      </div>
    </div>
  )
}

// ─── Agent block: collapsible trace of tool calls during an agent turn ────────

function AgentStep({ step, index }: { step: AgentStep; index: number }) {
  const [open, setOpen] = useState(false)
  const isAction = ACTION_TOOLS.includes(step.call.function.name)
  let args: Record<string, unknown> = {}
  try { args = JSON.parse(step.call.function.arguments) as Record<string, unknown> } catch { /* raw */ }
  const resultStr = typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)
  const argsStr = JSON.stringify(args, null, 2)

  // Build a human-readable summary of the call args
  const argsSummary = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')

  return (
    <div className="border-t border-border/50 first:border-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/20 transition-colors"
        onClick={() => setOpen((s) => !s)}
      >
        <span className="text-[10px] text-muted-foreground w-4 shrink-0">{index + 1}.</span>
        <Wrench className={cn('w-3 h-3 shrink-0', isAction ? 'text-orange-400' : 'text-blue-400')} />
        <span className={cn('font-mono text-[11px] font-medium', isAction ? 'text-orange-400' : 'text-blue-400')}>
          {step.call.function.name}
        </span>
        {argsSummary && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">({argsSummary})</span>
        )}
        <span className={cn('ml-auto text-[10px] font-semibold shrink-0', step.ok ? 'text-green-400' : 'text-destructive')}>
          {step.ok ? '✓' : '✗'}
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1.5">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">Args</p>
            <pre className="text-[10px] bg-secondary/50 rounded p-2 overflow-auto max-h-32 font-mono">{argsStr}</pre>
          </div>
          <div>
            <p className={cn('text-[10px] mb-0.5 uppercase tracking-wide', step.ok ? 'text-green-400/70' : 'text-destructive/70')}>Resultado</p>
            <pre className="text-[10px] bg-secondary/50 rounded p-2 overflow-auto max-h-48 font-mono">{resultStr}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentBlock({ block }: { block: { id: string; steps: AgentStep[]; done: boolean } }) {
  const [open, setOpen] = useState(true)
  const hasErrors = block.steps.some((s) => !s.ok)
  const allOk = block.steps.length > 0 && !hasErrors

  return (
    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/3 text-xs overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/20 transition-colors"
        onClick={() => setOpen((s) => !s)}
      >
        {block.done ? (
          <span className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold', allOk ? 'bg-green-500/20 text-green-400' : hasErrors ? 'bg-destructive/20 text-destructive' : 'bg-blue-500/20 text-blue-400')}>
            {allOk ? '✓' : hasErrors ? '!' : '?'}
          </span>
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
        )}
        <span className="text-blue-400 font-medium">
          {block.done
            ? `${block.steps.length} ${block.steps.length === 1 ? 'consulta HA' : 'consultas HA'}`
            : 'Consultando HA...'}
        </span>
        {block.steps.length > 0 && (
          <span className="text-[10px] text-muted-foreground truncate flex-1 text-right pr-1">
            {block.steps.map((s) => s.call.function.name.replace('ha_', '')).join(' → ')}
          </span>
        )}
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
      </button>

      {/* Steps */}
      {open && block.steps.length > 0 && (
        <div className="border-t border-blue-400/10">
          {block.steps.map((step, i) => (
            <AgentStep key={step.call.id} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function ModalDialog({
  open, onOpenChange, title, children, maxW = 'max-w-lg',
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode; maxW?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className={cn('fixed left-1/2 top-1/2 z-50 w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[85vh] overflow-auto', maxW)}>
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Config persistence ───────────────────────────────────────────────────────

function loadLlmConfig(): LlmConfig {
  try {
    const raw = sessionStorage.getItem('ha-llm-config')
    if (raw) return JSON.parse(raw) as LlmConfig
  } catch { /* ignore */ }
  return {
    provider: 'claude',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    openaiModel: 'gpt-4o',
    openrouterModel: 'openai/gpt-4o-mini',
    claudeModel: 'claude-3-5-sonnet-20241022',
    temperature: 0.0,
    maxTokens: 1024,
    llmstudioMaxContextTokens: DEFAULT_LLMSTUDIO_MAX_CONTEXT,
    llmstudioContextReserveTokens: DEFAULT_LLMSTUDIO_RESERVE,
  }
}
function saveLlmConfig(cfg: LlmConfig) { sessionStorage.setItem('ha-llm-config', JSON.stringify(cfg)) }

// ─── Main component ───────────────────────────────────────────────────────────

export function AgenteTab() {
  const inventory = useInventoryStore((s) => s.inventory)
  const vaultUrl = useVaultStore((s) => s.url)

  // LLM config
  const [config, setConfig] = useState<LlmConfig>(loadLlmConfig)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [llmstudioModelInfos, setLlmstudioModelInfos] = useState<Record<string, LlmStudioModelInfo>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<LlmMessage[]>([])
  const [chatLog, setChatLog] = useState<ChatMsg[]>([])
  const [messageMetas, setMessageMetas] = useState<Record<number, MsgMeta>>({})
  const [conversationSummary, setConversationSummary] = useState('')
  const [compressionCount, setCompressionCount] = useState(0)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Context config
  const [includeAutomations, setIncludeAutomations] = useState(false)
  const [includeAreas, setIncludeAreas] = useState(false)
  const [includeEntities, setIncludeEntities] = useState(false)
  const [includeGroups, setIncludeGroups] = useState(false)
  const [entityInfoLevel, setEntityInfoLevel] = useState<'id' | 'name' | 'name_state' | 'full'>('name_state')
  const [selectedAutomationIds, setSelectedAutomationIds] = useState<string[]>([])
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [automationFilter, setAutomationFilter] = useState('')

  // Tool toggles
  const [toolsEnabled, setToolsEnabled] = useState(true)
  const [actionsEnabled, setActionsEnabled] = useState(false)

  // Dialog visibility
  const [llmDialogOpen, setLlmDialogOpen] = useState(false)
  const [ctxDialogOpen, setCtxDialogOpen] = useState(false)
  const [payloadOpen, setPayloadOpen] = useState(false)

  const compactRef = useRef<Record<string, unknown> | null>(null)

  function updateConfig(patch: Partial<LlmConfig>) {
    const next = { ...config, ...patch }
    setConfig(next)
    saveLlmConfig(next)
  }

  // Fetch available models
  useEffect(() => {
    async function fetchModels() {
      try {
        setAvailableModels([])
        setLlmstudioModelInfos({})
        if (config.provider === 'ollama') {
          const base = (config.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')
          const res = await fetch(`${base}/api/models`)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) setAvailableModels((data as unknown[]).map((m) => { const mm = m as Record<string, unknown>; return (mm['name'] as string) || String(mm) }))
          }
        } else if (config.provider === 'llmstudio') {
          const base = (config.llmstudioUrl || 'http://localhost:1234').replace(/\/$/, '')
          const isDev = import.meta.env.DEV
          const tryUrls = isDev
            ? [`/llmstudio-proxy/api/v1/models`, `/llmstudio-proxy/v1/models`]
            : [`${base}/api/v1/models`, `${base}/v1/models`]
          for (const u of tryUrls) {
            try {
              const r = await fetch(u, isDev ? { headers: { 'x-llm-base': base } } : undefined)
              if (!r.ok) continue
              const d = await r.json()
              const normalized = normalizeLlmStudioModels(d)
              if (normalized.options.length > 0) {
                setAvailableModels(normalized.options)
                setLlmstudioModelInfos(normalized.infos)
                break
              }
            } catch (err) { console.debug('llmstudio model fetch', err) }
          }
        } else if ((config.provider === 'openai' || config.provider === 'openrouter') && config.apiKey) {
          const modelsUrl = config.provider === 'openrouter'
            ? 'https://openrouter.ai/api/v1/models'
            : 'https://api.openai.com/v1/models'
          const r = await fetch(modelsUrl, { headers: { Authorization: `Bearer ${config.apiKey}` } })
          if (r.ok) {
            const d = await r.json()
            const maybe = (d as Record<string, unknown>)['data']
            if (maybe && Array.isArray(maybe)) {
              setAvailableModels((maybe as unknown[]).map((m) => {
                const mm = m as Record<string, unknown>
                return (mm['id'] as string) || (mm['name'] as string)
              }).filter(Boolean))
            }
          }
        }
      } catch (e) { console.debug('fetchModels error', e) }
    }
    fetchModels()
  }, [config.provider, config.ollamaUrl, config.llmstudioUrl, config.apiKey])

  const selectedLlmStudioModel = config.llmstudioModel || availableModels[0] || ''
  const selectedLlmStudioInfo = selectedLlmStudioModel ? llmstudioModelInfos[selectedLlmStudioModel] : undefined
  const effectiveLlmConfig = useMemo<LlmConfig>(() => {
    if (config.provider !== 'llmstudio') return config
    const budget = getLlmStudioRequestBudget(config, selectedLlmStudioInfo)
    return {
      ...config,
      llmstudioModel: selectedLlmStudioModel || config.llmstudioModel,
      llmstudioMaxContextTokens: budget.maxContext,
      llmstudioContextReserveTokens: config.llmstudioContextReserveTokens ?? DEFAULT_LLMSTUDIO_RESERVE,
    }
  }, [config, selectedLlmStudioModel, selectedLlmStudioInfo])

  // Init selection when inventory loads
  useEffect(() => {
    if (!inventory) return
    setSelectedAutomationIds(inventory.automations.map((a) => a.entity_id))
    setSelectedEntityIds([...inventory.sensors.map((s) => s.entity_id), ...inventory.actuators.map((a) => a.entity_id)])
    setSelectedAreaIds(inventory.areas.map((ar) => ar.area_id))
    setSelectedGroupIds(inventory.groups.map((g) => g.entity_id))
  }, [inventory])

  const filteredAutomations = useMemo(() => {
    if (!inventory) return []
    if (!automationFilter) return inventory.automations
    const q = automationFilter.toLowerCase()
    return inventory.automations.filter((a) => a.entity_id.includes(automationFilter) || (a.name || '').toLowerCase().includes(q))
  }, [inventory, automationFilter])

  const activeTools = useMemo<HaTool[]>(() => {
    if (!toolsEnabled) return []
    return HA_TOOLS.filter((t) => {
      if (READ_ONLY_TOOLS.includes(t.function.name)) return true
      if (actionsEnabled && ACTION_TOOLS.includes(t.function.name)) return true
      return false
    })
  }, [toolsEnabled, actionsEnabled])

  const systemPrompt = useMemo(() => {
    if (!inventory) return 'You are a Home Assistant expert. No inventory data is loaded yet.'
    const compact: Record<string, unknown> = {}
    if (includeAreas) {
      compact.areas = selectedAreaIds.length > 0 ? inventory.areas.filter((ar) => selectedAreaIds.includes(ar.area_id)) : inventory.areas
    }
    if (includeAutomations) {
      const autos = selectedAutomationIds.length > 0 ? inventory.automations.filter((a) => selectedAutomationIds.includes(a.entity_id)) : inventory.automations
      compact.automations = autos.map((a) => ({ entity_id: a.entity_id, name: a.name, state: a.state, mode: a.mode, last_triggered: a.last_triggered, area_name: a.area_name }))
    }
    if (inventory.scenes && (includeEntities || includeGroups)) {
      compact.scenes = inventory.scenes.map((s) => ({ entity_id: s.entity_id, name: s.name, entities_controlled: s.entities_controlled }))
    }
    if (includeGroups) {
      const groups = selectedGroupIds.length > 0 ? inventory.groups.filter((g) => selectedGroupIds.includes(g.entity_id)) : inventory.groups
      compact.groups = groups.map((g) => ({ entity_id: g.entity_id, name: g.name, members: g.members }))
    }
    if (inventory.scripts && (includeEntities || includeAutomations)) {
      compact.scripts = inventory.scripts.map((s) => ({ entity_id: s.entity_id, name: s.name, state: s.state, last_triggered: s.last_triggered }))
    }
    if (includeEntities) {
      const allEntities = [...inventory.sensors, ...inventory.actuators]
      const entities = selectedEntityIds.length > 0 ? allEntities.filter((e) => selectedEntityIds.includes(e.entity_id)) : allEntities
      const makeEntry = (e: unknown) => {
        const ent = e as Record<string, unknown>
        switch (entityInfoLevel) {
          case 'id': return { entity_id: ent['entity_id'] }
          case 'name': return { entity_id: ent['entity_id'], name: ent['name'] }
          case 'name_state': return { entity_id: ent['entity_id'], name: ent['name'], state: ent['state'] }
          default: return { entity_id: ent['entity_id'], name: ent['name'], state: ent['state'], unit: ent['unit'], device_class: ent['device_class'], area_name: ent['area_name'], attributes: ent['attributes'] }
        }
      }
      compact.sensors = entities.filter((e) => inventory.sensors.find((s) => s.entity_id === e.entity_id)).map(makeEntry)
      compact.actuators = entities.filter((e) => inventory.actuators.find((a) => a.entity_id === e.entity_id)).map(makeEntry)
    }
    compactRef.current = compact
    if (Object.keys(compact).length === 0) {
      return 'You are a Home Assistant expert. The user has not selected any inventory context. Use the live Home Assistant tools when needed and answer in the same language as the user.'
    }
    return buildInventorySystemPrompt(JSON.stringify(compact, null, 1))
  }, [inventory, includeAreas, includeAutomations, includeEntities, includeGroups, entityInfoLevel, selectedAreaIds, selectedAutomationIds, selectedEntityIds, selectedGroupIds])

  const tokenCounts = useMemo(() => {
    const counts = estimateManagedTokens(systemPrompt, conversationSummary, messages)
    const { maxContext, reserve, requestBudget, modelMax, loadedContext } = getLlmStudioRequestBudget(effectiveLlmConfig, selectedLlmStudioInfo)
    return { ...counts, allowed: maxContext, reserve, requestBudget, modelMax, loadedContext, fillPct: Math.min(100, Math.round((counts.total / Math.max(1, requestBudget)) * 100)) }
  }, [systemPrompt, conversationSummary, messages, effectiveLlmConfig, selectedLlmStudioInfo])

  void messageMetas

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog, loading])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    if (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'llmstudio') {
      setError('Introduce tu API key en la configuración')
      return
    }
    setInput('')
    setError(null)
    const userTimestamp = new Date().toISOString()

    const userMsg: LlmMessage = { role: 'user', content: trimmed }
    const { maxContext, requestBudget } = getLlmStudioRequestBudget(effectiveLlmConfig, selectedLlmStudioInfo)
    const compactedBeforeSend = compactConversationToBudget(systemPrompt, conversationSummary, [...messages, userMsg], requestBudget)
    if (compactedBeforeSend.compressionSteps > 0) {
      setConversationSummary(compactedBeforeSend.summary)
      setCompressionCount((prev) => prev + compactedBeforeSend.compressionSteps)
    }

    const liveMessages = compactedBeforeSend.liveMessages
    const nextMessages = [...buildSummaryMessage(compactedBeforeSend.summary), ...liveMessages]
    setMessages(liveMessages)
    setChatLog((prev) => [...prev, { kind: 'chat', msg: userMsg, meta: { createdAt: userTimestamp } }])
    setLoading(true)
    const startedAt = performance.now()

    const totalTokens = estimateManagedTokens(systemPrompt, compactedBeforeSend.summary, liveMessages).total
    if (config.provider === 'llmstudio' && totalTokens >= requestBudget) {
      setLoading(false)
      setError(`Request tokens ${totalTokens} >= budget ${requestBudget} (ctx ${maxContext}, reserva ${maxContext - requestBudget}). Reduce inventory slices or clear conversation.`)
      return
    }

    if (toolsEnabled && activeTools.length > 0) {
      const haClient = new HAClient(vaultUrl, vaultToken.get())
      // Create a collapsible agent block that accumulates steps in real time
      const blockId = `agent_${Date.now()}`
      setChatLog((prev) => [...prev, { kind: 'agent_block', id: blockId, steps: [], done: false }])
      const result = await runAgentLoop(nextMessages, systemPrompt, effectiveLlmConfig, activeTools, haClient, {
        maxIterations: 10,
        onToolCall: (call, toolResult) => {
          const isError = typeof toolResult === 'object' && toolResult !== null && 'error' in (toolResult as Record<string, unknown>)
          const step: AgentStep = { call, result: toolResult, ok: !isError }
          setChatLog((prev) => prev.map((entry) =>
            entry.kind === 'agent_block' && entry.id === blockId
              ? { ...entry, steps: [...entry.steps, step] }
              : entry
          ))
        },
      })
      // Mark block as done
      setChatLog((prev) => prev.map((entry) =>
        entry.kind === 'agent_block' && entry.id === blockId ? { ...entry, done: true } : entry
      ))
      setLoading(false)
      if (result.error) {
        setError(result.error)
      } else {
        const assistantMsg: LlmMessage = { role: 'assistant', content: result.finalContent }
        const finishedAt = new Date().toISOString()
        const responseMs = performance.now() - startedAt
        const assistantMeta: MsgMeta = { ...(result.meta as MsgMeta | undefined), createdAt: finishedAt, responseMs }
        const liveHistory = result.messages.filter((m) => !isAutoSummaryMessage(m) && (m.role === 'user' || (m.role === 'assistant' && !m.tool_calls)))
        const compactedAfterResponse = compactConversationToBudget(systemPrompt, compactedBeforeSend.summary, liveHistory, requestBudget)
        setConversationSummary(compactedAfterResponse.summary)
        if (compactedAfterResponse.compressionSteps > 0) {
          setCompressionCount((prev) => prev + compactedAfterResponse.compressionSteps)
        }
        setMessages(compactedAfterResponse.liveMessages)
        setChatLog((prev) => [...prev, { kind: 'chat', msg: assistantMsg, meta: assistantMeta }])
      }
    } else {
      const result = await sendLlmMessage(nextMessages, systemPrompt, effectiveLlmConfig)
      setLoading(false)
      if (result.error) {
        setError(result.error)
      } else {
        const assistantMsg: LlmMessage = { role: 'assistant', content: result.content }
        const finishedAt = new Date().toISOString()
        const responseMs = performance.now() - startedAt
        const assistantMeta: MsgMeta = { ...(result.meta as MsgMeta | undefined), createdAt: finishedAt, responseMs }
        const liveHistory = [...liveMessages, assistantMsg]
        const compactedAfterResponse = compactConversationToBudget(systemPrompt, compactedBeforeSend.summary, liveHistory, requestBudget)
        setConversationSummary(compactedAfterResponse.summary)
        if (compactedAfterResponse.compressionSteps > 0) {
          setCompressionCount((prev) => prev + compactedAfterResponse.compressionSteps)
        }
        setMessages(compactedAfterResponse.liveMessages)
        const idx = liveHistory.length
        setMessageMetas((s) => ({ ...s, [idx]: assistantMeta }))
        setChatLog((prev) => [...prev, { kind: 'chat', msg: assistantMsg, meta: assistantMeta }])
      }
    }
  }

  // Derived summary for sidebar badge
  const ctxBadge = [
    includeAutomations && `${selectedAutomationIds.length} autos`,
    includeEntities && `${selectedEntityIds.length} ent`,
    includeAreas && `${selectedAreaIds.length} áreas`,
    includeGroups && `${selectedGroupIds.length} grupos`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-200px)] min-h-[500px]">

      {/* ── Compact sidebar ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 min-w-0">
        <Card>
          <CardContent className="p-3 space-y-2.5">
            {/* Provider */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Proveedor LLM</label>
              <select
                value={config.provider}
                onChange={(e) => updateConfig({ provider: e.target.value as LlmProvider })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs mt-1"
              >
                {(Object.keys(PROVIDER_LABELS) as LlmProvider[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            </div>

            {/* Modal buttons */}
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs justify-start" onClick={() => setLlmDialogOpen(true)}>
              <Settings className="w-3.5 h-3.5" /> Configurar modelo
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs justify-start" onClick={() => setCtxDialogOpen(true)}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Configurar contexto</span>
              {ctxBadge && <span className="text-muted-foreground text-[10px] truncate max-w-[80px]">{ctxBadge}</span>}
            </Button>

            {/* Tool toggles */}
            <div className="border-t border-border pt-2 space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Herramientas
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={toolsEnabled} onChange={(e) => setToolsEnabled(e.target.checked)} />
                <Wrench className="w-3 h-3 text-blue-400" />
                Lectura RT
                <span className="text-muted-foreground ml-1">({READ_ONLY_TOOLS.length})</span>
              </label>
              {toolsEnabled && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer pl-4">
                  <input type="checkbox" checked={actionsEnabled} onChange={(e) => setActionsEnabled(e.target.checked)} />
                  <Zap className="w-3 h-3 text-orange-400" />
                  Acciones
                  <span className="text-muted-foreground ml-1">({ACTION_TOOLS.length})</span>
                </label>
              )}
              {toolsEnabled && (
                <p className="text-[10px] text-muted-foreground pl-1">
                  {activeTools.length} activas · {config.provider === 'claude' || config.provider === 'openai' || config.provider === 'openrouter' ? 'native' : 'JSON inject'}
                </p>
              )}
            </div>

            {/* Status + tokens */}
            <div className="border-t border-border pt-2 space-y-1.5">
              {inventory ? (
                <Badge variant="success" className="w-full justify-center text-xs">✓ Inventario cargado</Badge>
              ) : (
                <Badge variant="destructive" className="w-full justify-center text-xs">Sin inventario</Badge>
              )}
              <div className={cn('space-y-0.5 text-[10px] text-muted-foreground', tokenCounts.total >= tokenCounts.allowed ? 'text-destructive' : '')}>
                <p>Ctx {tokenCounts.context} · Resumen {tokenCounts.summary} · Chat {tokenCounts.live}</p>
                <p>Req {tokenCounts.total}/{tokenCounts.requestBudget} · Reserva {tokenCounts.reserve} · Ctx activo {tokenCounts.allowed}</p>
                <p>Uso actual {tokenCounts.fillPct}%</p>
                {config.provider === 'llmstudio' && tokenCounts.loadedContext && <p>Cargado LLMStudio {tokenCounts.loadedContext}</p>}
                {config.provider === 'llmstudio' && tokenCounts.modelMax && <p>Máx modelo {tokenCounts.modelMax}</p>}
                {compressionCount > 0 && <p>Compresiones automáticas: {compressionCount}</p>}
              </div>
              <ContextMeter context={tokenCounts.context} summary={tokenCounts.summary} live={tokenCounts.live} requestBudget={tokenCounts.requestBudget} />
            </div>

            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { setMessages([]); setChatLog([]); setConversationSummary(''); setCompressionCount(0) }}>
              Limpiar conversación
            </Button>
          </CardContent>
        </Card>

        {/* Quick questions */}
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3 shrink-0">
            <CardTitle className="text-[10px] text-muted-foreground uppercase tracking-wide">Preguntas rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-2 space-y-0.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => send(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Chat ─────────────────────────────────────────────────────────── */}
      <Card className="lg:col-span-3 flex flex-col overflow-hidden">
        <CardHeader className="border-b border-border pb-3 shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            Chat con {PROVIDER_LABELS[config.provider]}
            <span className="text-xs text-muted-foreground font-normal ml-auto">Contexto {tokenCounts.fillPct}%</span>
          </CardTitle>
        </CardHeader>

        <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
          {chatLog.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Bot className="w-10 h-10 opacity-20" />
              <p className="text-sm">Haz una pregunta o usa las preguntas rápidas</p>
              {!inventory && <p className="text-xs text-destructive">Conecta a HA primero para cargar el inventario</p>}
              {inventory && !includeAutomations && !includeAreas && !includeEntities && !includeGroups && (
                <p className="text-xs">El contexto está vacío por defecto. Añádelo manualmente desde “Configurar contexto”.</p>
              )}
              {toolsEnabled && (
                <p className="text-xs text-blue-400 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Agente activo — puede consultar HA en tiempo real
                </p>
              )}
            </div>
          )}

          {chatLog.map((entry, i) => {
            if (entry.kind === 'chat') return <ChatMessage key={i} msg={entry.msg} meta={entry.meta} />
            // Hide blocks that finished with 0 steps (parse failed, nothing useful to show)
            if (entry.kind === 'agent_block' && entry.done && entry.steps.length === 0) return null
            return <AgentBlock key={entry.id} block={entry} />
          })}

          {loading && (
            <div className="flex gap-3">
              <div className="rounded-full p-1.5 h-fit bg-secondary">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
              <div className="bg-secondary rounded-lg px-4 py-3 text-sm text-muted-foreground">Pensando...</div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-3 shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder="Pregunta sobre tu inventario de Home Assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
              className="min-h-0 h-10 resize-none py-2"
              rows={1}
            />
            <Button size="icon" onClick={() => void send(input)} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </Card>

      {/* ── Dialog: LLM config ───────────────────────────────────────────── */}
      <ModalDialog open={llmDialogOpen} onOpenChange={setLlmDialogOpen} title="Configuración del modelo LLM">
        <div className="space-y-4">
          {config.provider !== 'ollama' && config.provider !== 'llmstudio' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">API Key</label>
              <Input type="password" placeholder="sk-... / sk-ant-..." value={config.apiKey} onChange={(e) => updateConfig({ apiKey: e.target.value })} />
              <p className="text-xs text-muted-foreground">Guardado en sessionStorage</p>
            </div>
          )}

          {config.provider === 'ollama' && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">URL Ollama</label>
                <Input placeholder="http://localhost:11434" value={config.ollamaUrl} onChange={(e) => updateConfig({ ollamaUrl: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                {availableModels.length > 0 ? (
                  <select value={config.ollamaModel} onChange={(e) => updateConfig({ ollamaModel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                    {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <Input placeholder="llama3" value={config.ollamaModel} onChange={(e) => updateConfig({ ollamaModel: e.target.value })} />
                )}
              </div>
            </>
          )}

          {config.provider === 'llmstudio' && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">URL LLMStudio</label>
                <Input placeholder="http://localhost:1234" value={config.llmstudioUrl || ''} onChange={(e) => updateConfig({ llmstudioUrl: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                {availableModels.length > 0 ? (
                  <select value={selectedLlmStudioModel} onChange={(e) => updateConfig({ llmstudioModel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                    <option value="">Selecciona un modelo...</option>
                    {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <Input placeholder="qwen/qwen3.5-9b" value={config.llmstudioModel || ''} onChange={(e) => updateConfig({ llmstudioModel: e.target.value })} />
                )}
                {selectedLlmStudioInfo && (
                  <p className="text-[11px] text-muted-foreground">
                    {selectedLlmStudioInfo.label}
                    {selectedLlmStudioInfo.loadedContextLength ? ` · cargado ${selectedLlmStudioInfo.loadedContextLength}` : ''}
                    {selectedLlmStudioInfo.maxContextLength ? ` · máximo ${selectedLlmStudioInfo.maxContextLength}` : ''}
                  </p>
                )}
              </div>
            </>
          )}

          {config.provider === 'openai' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Modelo OpenAI</label>
              {availableModels.length > 0 ? (
                <select value={config.openaiModel} onChange={(e) => updateConfig({ openaiModel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <select value={config.openaiModel} onChange={(e) => updateConfig({ openaiModel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="o3">o3</option>
                </select>
              )}
            </div>
          )}

          {config.provider === 'openrouter' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Modelo OpenRouter</label>
              {availableModels.length > 0 ? (
                <select value={config.openrouterModel || ''} onChange={(e) => updateConfig({ openrouterModel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <Input placeholder="openai/gpt-4o-mini" value={config.openrouterModel || ''} onChange={(e) => updateConfig({ openrouterModel: e.target.value })} />
              )}
              <p className="text-[11px] text-muted-foreground">OpenRouter usa modelos con formato proveedor/modelo, por ejemplo `openai/gpt-4o-mini` o `anthropic/claude-3.7-sonnet`.</p>
            </div>
          )}

          {config.provider === 'claude' && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Modelo Claude</label>
              <select value={config.claudeModel} onChange={(e) => updateConfig({ claudeModel: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022</option>
                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022</option>
                <option value="claude-opus-4-5">claude-opus-4-5</option>
                <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
              </select>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <button className="text-xs text-muted-foreground flex items-center gap-1" onClick={() => setShowAdvanced((s) => !s)}>
              {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Opciones avanzadas
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Temperatura</label>
                  <Input type="number" min={0} max={2} step={0.01} value={String(config.temperature ?? 0.0)} onChange={(e) => updateConfig({ temperature: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Max tokens (respuesta)</label>
                  <Input type="number" min={16} step={1} value={String(config.maxTokens ?? 1024)} onChange={(e) => updateConfig({ maxTokens: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">LLMStudio contexto manual (override)</label>
                  <Input type="number" min={1024} step={256} placeholder={String(selectedLlmStudioInfo?.loadedContextLength ?? selectedLlmStudioInfo?.maxContextLength ?? DEFAULT_LLMSTUDIO_MAX_CONTEXT)} value={config.llmstudioMaxContextTokens === undefined ? '' : String(config.llmstudioMaxContextTokens)} onChange={(e) => updateConfig({ llmstudioMaxContextTokens: e.target.value ? Number(e.target.value) : undefined })} />
                  <p className="text-[11px] text-muted-foreground">Déjalo vacío para usar el contexto detectado desde /api/v1/models.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Reserva LLMStudio / n_keep (tokens)</label>
                  <Input type="number" min={256} step={128} value={String(config.llmstudioContextReserveTokens ?? DEFAULT_LLMSTUDIO_RESERVE)} onChange={(e) => updateConfig({ llmstudioContextReserveTokens: Number(e.target.value) })} />
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalDialog>

      {/* ── Dialog: Context config ───────────────────────────────────────── */}
      <ModalDialog open={ctxDialogOpen} onOpenChange={setCtxDialogOpen} title="Configuración del contexto" maxW="max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Incluir en contexto</label>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeAutomations} onChange={(e) => setIncludeAutomations(e.target.checked)} /> Automatizaciones ({inventory?.automations.length ?? 0})</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeEntities} onChange={(e) => setIncludeEntities(e.target.checked)} /> Entidades ({(inventory?.sensors.length ?? 0) + (inventory?.actuators.length ?? 0)})</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeAreas} onChange={(e) => setIncludeAreas(e.target.checked)} /> Áreas ({inventory?.areas.length ?? 0})</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={includeGroups} onChange={(e) => setIncludeGroups(e.target.checked)} /> Grupos ({inventory?.groups.length ?? 0})</label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalle de entidades env.</label>
              <div className="space-y-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="infoLevel" checked={entityInfoLevel === 'id'} onChange={() => setEntityInfoLevel('id')} /> IDs solamente</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="infoLevel" checked={entityInfoLevel === 'name'} onChange={() => setEntityInfoLevel('name')} /> Nombre + ID</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="infoLevel" checked={entityInfoLevel === 'name_state'} onChange={() => setEntityInfoLevel('name_state')} /> Nombre + estado</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="infoLevel" checked={entityInfoLevel === 'full'} onChange={() => setEntityInfoLevel('full')} /> Detalle completo</label>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs text-muted-foreground">Ctx {tokenCounts.context} · Resumen {tokenCounts.summary} · Chat {tokenCounts.live}</p>
              <p className="text-xs text-muted-foreground">Req {tokenCounts.total}/{tokenCounts.requestBudget} · Reserva {tokenCounts.reserve}</p>
              <ContextMeter context={tokenCounts.context} summary={tokenCounts.summary} live={tokenCounts.live} requestBudget={tokenCounts.requestBudget} />
              {config.provider === 'llmstudio' && tokenCounts.loadedContext && <p className="text-xs text-muted-foreground">Ctx cargado LLMStudio {tokenCounts.loadedContext}</p>}
              {config.provider === 'llmstudio' && tokenCounts.modelMax && <p className="text-xs text-muted-foreground">Ctx máx modelo {tokenCounts.modelMax}</p>}
              <p className="text-[11px] text-muted-foreground">Por defecto no se incluye inventario. Marca solo lo que quieras añadir.</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setCtxDialogOpen(false); setPayloadOpen(true) }}>
                <Eye className="w-3.5 h-3.5" /> Ver payload JSON
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Automatizaciones en contexto</label>
            <div className="flex gap-1.5">
              <Input className="h-7 text-xs flex-1" placeholder="Filtrar..." value={automationFilter} onChange={(e) => setAutomationFilter(e.target.value)} />
              <button className="text-xs px-2 rounded border border-border hover:bg-accent/30 transition-colors whitespace-nowrap" onClick={() => setSelectedAutomationIds(filteredAutomations.map((a) => a.entity_id))}>Todos</button>
              <button className="text-xs px-2 rounded border border-border hover:bg-accent/30 transition-colors whitespace-nowrap" onClick={() => setSelectedAutomationIds([])}>Ninguno</button>
            </div>
            <div className="border border-border rounded-lg max-h-64 overflow-auto">
              {filteredAutomations.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground text-center">Sin automatizaciones</p>}
              {filteredAutomations.map((a) => {
                const id = a.entity_id
                const name = a.name || id
                return (
                  <label key={id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/20 cursor-pointer border-b border-border last:border-0">
                    <input type="checkbox" checked={selectedAutomationIds.includes(id)} onChange={(e) => setSelectedAutomationIds((s) => e.target.checked ? [...s, id] : s.filter((id2) => id2 !== id))} />
                    <span className="truncate">{name}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">{selectedAutomationIds.length} / {inventory?.automations.length ?? 0} seleccionadas</p>
          </div>
        </div>
      </ModalDialog>

      {/* ── Dialog: Payload preview ──────────────────────────────────────── */}
      <ModalDialog open={payloadOpen} onOpenChange={setPayloadOpen} title="Payload de contexto (preview)" maxW="max-w-4xl">
        <div className="mb-3 text-xs text-muted-foreground">
          Tokens JSON: {estimateTokens(JSON.stringify(compactRef.current || {}, null, 1))} · Tokens sistema: {estimateTokens(systemPrompt)}
        </div>
        <pre className="max-h-[60vh] overflow-auto text-xs bg-secondary p-3 rounded"><code>{JSON.stringify(compactRef.current || {}, null, 2)}</code></pre>
      </ModalDialog>
    </div>
  )
}
