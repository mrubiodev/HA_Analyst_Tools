// ─── Raw HA API shapes ────────────────────────────────────────────────────────

export interface HaStateRaw {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_changed: string
  last_updated: string
  context: { id: string; parent_id: string | null; user_id: string | null }
}

export interface HaAreaRaw {
  area_id: string
  name: string
  picture?: string | null
  aliases?: string[]
}

export interface HaEntityRegistryRaw {
  entity_id: string
  unique_id: string
  platform: string
  name: string | null
  icon: string | null
  area_id: string | null
  device_id: string | null
  disabled_by: string | null
  hidden_by: string | null
}

// ─── Normalized internal types ────────────────────────────────────────────────

export type EntityKind = 'sensor' | 'actuator' | 'other'
export type ZoneType = 'fachada' | 'interior' | 'mixta'

export interface HaEntity {
  entity_id: string
  name: string
  domain: string
  state: string
  unit: string
  device_class: string
  area_id: string | null
  area_name: string | null
  last_changed: string
  last_updated: string
  attributes: Record<string, unknown>
  kind: EntityKind
}

export interface HaArea {
  area_id: string
  name: string
}

export interface Automation extends HaEntity {
  mode: string
  last_triggered: string | null
}

export interface Scene extends HaEntity {
  entities_controlled: string[]
}

export interface Group extends HaEntity {
  members: string[]
}

export interface Script extends HaEntity {
  last_triggered: string | null
}

// ─── Inventory (full in-memory model) ────────────────────────────────────────

export interface Inventory {
  generated_at: string
  ha_url: string
  areas: HaArea[]
  automations: Automation[]
  scenes: Scene[]
  groups: Group[]
  scripts: Script[]
  sensors: HaEntity[]
  actuators: HaEntity[]
  others: HaEntity[]
}

// ─── Zone model (stored in localStorage) ─────────────────────────────────────

export interface Zone {
  id: string          // matches area_id or custom uuid
  name: string
  type: ZoneType
  orientation: string
  entity_ids: string[]
  notes: string
}

// ─── LLM ─────────────────────────────────────────────────────────────────────

export type LlmProvider = 'claude' | 'openai' | 'openrouter' | 'ollama' | 'llmstudio'

export interface ToolCallDef {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LlmMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  /** Present when role === 'assistant' and the model issued tool calls */
  tool_calls?: ToolCallDef[]
  /** Present when role === 'tool': links this result back to the tool_call */
  tool_call_id?: string
  /** Present when role === 'tool': name of the tool that produced this result */
  name?: string
}

export interface LlmConfig {
  provider: LlmProvider
  apiKey: string        // blank for Ollama
  ollamaUrl: string     // default http://localhost:11434
  ollamaModel: string   // default llama3
  openaiModel: string   // default gpt-4o
  openrouterModel?: string
  claudeModel: string   // default claude-3-5-sonnet-20241022
  llmstudioUrl?: string // default http://localhost:1234
  llmstudioModel?: string
  // Optional runtime params for model calls
  temperature?: number
  maxTokens?: number
  // Provider-specific: override estimated context token budget for LLMStudio
  llmstudioMaxContextTokens?: number
  // Provider-specific: reserve headroom for server-side prompt caching / n_keep
  llmstudioContextReserveTokens?: number
}
