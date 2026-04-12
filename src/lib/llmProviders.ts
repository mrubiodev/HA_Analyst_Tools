import type { LlmConfig, LlmMessage, ToolCallDef } from '@/types/ha'
import { estimateTokens } from '@/lib/utils'
import type { HaTool } from '@/lib/haTools'
import { executeHaTool, buildToolsSystemPromptSection } from '@/lib/haTools'
import type { HAClient } from '@/lib/haApi'

export interface LlmResponse {
  content: string
  error?: string
  meta?: Record<string, unknown>
  /** Tool calls requested by the model (function calling) */
  toolCalls?: ToolCallDef[]
  /** Why the model stopped generating */
  stopReason?: 'stop' | 'tool_use' | 'error'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Serialize messages for providers that support OpenAI-style roles */
function serializeMessagesOpenAI(
  messages: LlmMessage[],
  systemPrompt: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name })
    } else if (m.tool_calls && m.tool_calls.length > 0) {
      out.push({ role: 'assistant', content: m.content ?? null, tool_calls: m.tool_calls })
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

function parseToolCallsOpenAI(rawCalls: unknown): ToolCallDef[] {
  if (!Array.isArray(rawCalls)) return []
  return rawCalls.map((c) => {
    const call = c as Record<string, unknown>
    const fn = call['function'] as Record<string, unknown>
    return {
      id: (call['id'] as string) ?? `call_${Math.random().toString(36).slice(2)}`,
      type: 'function' as const,
      function: {
        name: fn['name'] as string,
        arguments: typeof fn['arguments'] === 'string' ? fn['arguments'] : JSON.stringify(fn['arguments']),
      },
    }
  })
}

// ─── Claude ───────────────────────────────────────────────────────────────────

async function sendClaude(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  // Convert messages to Anthropic format (tool_result role + tool_use content blocks)
  const anthropicMessages: Array<Record<string, unknown>> = []
  for (const m of messages) {
    if (m.role === 'tool') {
      // Tool results must follow the assistant tool_use message
      anthropicMessages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
      })
    } else if (m.tool_calls && m.tool_calls.length > 0) {
      // Assistant message with tool calls
      const content: unknown[] = []
      if (m.content) content.push({ type: 'text', text: m.content })
      for (const tc of m.tool_calls) {
        let inputParsed: unknown = {}
        try { inputParsed = JSON.parse(tc.function.arguments) } catch { /* keep empty */ }
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: inputParsed })
      }
      anthropicMessages.push({ role: 'assistant', content })
    } else {
      anthropicMessages.push({ role: m.role, content: m.content })
    }
  }

  const anthropicTools = tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }))

  const body: Record<string, unknown> = {
    model: config.claudeModel || 'claude-3-5-sonnet-20241022',
    max_tokens: config.maxTokens ?? 4096,
    system: systemPrompt,
    messages: anthropicMessages,
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
  }
  if (anthropicTools.length > 0) body['tools'] = anthropicTools

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return { content: '', error: `Claude API error ${res.status}: ${err}`, stopReason: 'error' }
  }

  const data = await res.json() as {
    stop_reason: string
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>
  }

  const textBlock = data.content.find((c) => c.type === 'text')
  const text = textBlock?.text ?? ''

  if (data.stop_reason === 'tool_use') {
    const toolUseBlocks = data.content.filter((c) => c.type === 'tool_use')
    const toolCalls: ToolCallDef[] = toolUseBlocks.map((c) => ({
      id: c.id ?? `call_${Math.random().toString(36).slice(2)}`,
      type: 'function' as const,
      function: {
        name: c.name ?? '',
        arguments: JSON.stringify(c.input ?? {}),
      },
    }))
    return { content: text, toolCalls, stopReason: 'tool_use' }
  }

  return { content: text, stopReason: 'stop' }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function sendOpenAI(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  return sendOpenAICompatible(messages, systemPrompt, config, {
    model: config.openaiModel || 'gpt-4o',
    url: 'https://api.openai.com/v1/chat/completions',
    authHeader: `Bearer ${config.apiKey}`,
    providerName: 'OpenAI',
  }, tools)
}

async function sendOpenRouter(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  return sendOpenAICompatible(messages, systemPrompt, config, {
    model: config.openrouterModel || 'openai/gpt-4o-mini',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    authHeader: `Bearer ${config.apiKey}`,
    providerName: 'OpenRouter',
    extraHeaders: {
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'hass_get_me_info',
    },
  }, tools)
}

async function sendOpenAICompatible(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  request: {
    model: string
    url: string
    authHeader: string
    providerName: string
    extraHeaders?: Record<string, string>
  },
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: serializeMessagesOpenAI(messages, systemPrompt),
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    ...(config.maxTokens !== undefined ? { max_tokens: config.maxTokens } : {}),
  }
  if (tools.length > 0) {
    body['tools'] = tools
    body['tool_choice'] = 'auto'
  }

  const res = await fetch(request.url, {
    method: 'POST',
    headers: {
      Authorization: request.authHeader,
      'content-type': 'application/json',
      ...(request.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return { content: '', error: `${request.providerName} API error ${res.status}: ${err}`, stopReason: 'error' }
  }

  const data = await res.json() as {
    choices: Array<{
      finish_reason: string
      message: { content: string | null; tool_calls?: unknown[] }
    }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
      tokens_per_second?: number
    }
  }
  const choice = data.choices[0]
  const text = choice?.message?.content ?? ''
  const meta: Record<string, unknown> = {}
  if (data.usage) {
    meta['stats'] = {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
      tokens_per_second: data.usage.tokens_per_second,
    }
  }

  if (choice?.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    const toolCalls = parseToolCallsOpenAI(choice.message.tool_calls)
    return { content: text, toolCalls, stopReason: 'tool_use', meta }
  }

  return { content: text, stopReason: 'stop', meta }
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

async function sendOllama(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  const base = (config.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '')
  const model = config.ollamaModel || 'llama3'

  // Build messages in OpenAI format (Ollama >=0.3 understands it)
  const ollamaMessages = serializeMessagesOpenAI(messages, systemPrompt)

  const body: Record<string, unknown> = {
    model,
    stream: false,
    messages: ollamaMessages,
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    ...(config.maxTokens !== undefined ? { max_tokens: config.maxTokens } : {}),
  }
  if (tools.length > 0) body['tools'] = tools

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return { content: '', error: `Ollama error ${res.status}: ${err}`, stopReason: 'error' }
  }

  const data = await res.json() as {
    message?: { content: string; tool_calls?: unknown[] }
    done_reason?: string
    error?: string
  }
  if (data.error) return { content: '', error: data.error, stopReason: 'error' }

  const text = data.message?.content ?? ''

  if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
    const toolCalls = parseToolCallsOpenAI(data.message.tool_calls)
    return { content: text, toolCalls, stopReason: 'tool_use' }
  }

  // Fallback: try to parse JSON tool_calls block from text (prompt-injection path)
  const injected = tryParseInjectedToolCalls(text)
  if (injected) return injected

  return { content: text, stopReason: 'stop' }
}

// ─── LLMStudio ────────────────────────────────────────────────────────────────

/**
 * LLMStudio exposes an OpenAI-compatible `/v1/chat/completions` endpoint.
 * We use it directly (same as OpenAI/Ollama) to get proper message history,
 * native tool calling, and reasoning_content support.
 */
async function sendLlmStudio(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  const base = (config.llmstudioUrl || 'http://localhost:1234').replace(/\/$/, '')
  const model = config.llmstudioModel || config.ollamaModel || 'qwen/qwen3.5-9b'

  // Truncate history to a safe token budget
  const maxContextTokens = config.llmstudioMaxContextTokens || 14000
  const reserveTokens = config.llmstudioContextReserveTokens ?? 2048
  const allowedTokens = Math.max(1000, maxContextTokens - reserveTokens)
  let tokens = estimateTokens(systemPrompt)
  const truncatedMessages: LlmMessage[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    const t = estimateTokens(m.content ?? JSON.stringify(m.tool_calls ?? ''))
    if (tokens + t > allowedTokens) break
    truncatedMessages.unshift(m)
    tokens += t
  }
  if (truncatedMessages.length === 0 && messages.length > 0) {
    truncatedMessages.push(messages[messages.length - 1])
  }

  const body: Record<string, unknown> = {
    model,
    messages: serializeMessagesOpenAI(truncatedMessages, systemPrompt),
    stream: false,
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    ...(config.maxTokens !== undefined ? { max_tokens: config.maxTokens } : {}),
  }
  if (tools.length > 0) body['tools'] = tools

  const isDev = import.meta.env.DEV
  const url = isDev ? `/llmstudio-proxy/v1/chat/completions` : `${base}/v1/chat/completions`
  const extraHeaders: Record<string, string> = isDev ? { 'x-llm-base': base } : {}

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    return { content: '', error: `LLMStudio error ${res.status}: ${err}`, stopReason: 'error' }
  }

  const data = await res.json() as {
    choices?: Array<{
      message?: {
        content?: string
        tool_calls?: unknown[]
        reasoning_content?: string
      }
      finish_reason?: string
    }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
      tokens_per_second?: number
    }
    error?: { message?: string }
  }

  if (data.error?.message) return { content: '', error: data.error.message, stopReason: 'error' }

  const choice = data.choices?.[0]
  if (!choice) return { content: '', error: 'LLMStudio returned no choices', stopReason: 'error' }

  const assistantText = choice.message?.content ?? ''
  const meta: Record<string, unknown> = {}
  if (choice.message?.reasoning_content) meta['reasoning'] = choice.message.reasoning_content
  if (data.usage) {
    meta['stats'] = {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
      tokens_per_second: data.usage.tokens_per_second,
    }
  }

  // Native tool calling (models that support it via OpenAI tool format)
  if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
    const toolCalls = parseToolCallsOpenAI(choice.message.tool_calls).slice(0, 1)
    if (toolCalls.length > 0) return { content: assistantText, toolCalls, stopReason: 'tool_use', meta }
  }

  // Fallback: prompt-injection tool call parser (for models that embed JSON in content)
  if (tools.length > 0) {
    const fallbackText = [assistantText, choice.message?.reasoning_content ?? '']
      .filter(Boolean)
      .join('\n\n')
    const injected = tryParseInjectedToolCalls(fallbackText)
    if (injected) return { ...injected, meta }
  }

  return { content: assistantText, meta, stopReason: 'stop' }
}

// ─── Prompt-injection tool call parser ───────────────────────────────────────

/**
 * Walk the string counting brace depth to extract the first complete balanced
 * JSON object (handles nested objects and escaped strings correctly).
 */
function extractFirstJsonObject(text: string): { raw: string; start: number; end: number } | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return { raw: text.slice(start, i + 1), start, end: i + 1 }
    }
  }
  // JSON was unbalanced (model truncated output) — return fragment so repair can be tried
  if (depth > 0) return { raw: text.slice(start), start, end: text.length }
  return null
}

/**
 * Close any unbalanced braces/brackets appended at the end.
 * Models (e.g. Qwen on LLMStudio) sometimes omit the last `}` of a tool_call entry.
 */
function repairJson(json: string): string {
  let braces = 0, brackets = 0
  let inString = false, escape = false
  for (const ch of json) {
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') braces++
    else if (ch === '}') braces--
    else if (ch === '[') brackets++
    else if (ch === ']') brackets--
  }
  let out = json
  while (braces > 0) { out += '}'; braces-- }
  while (brackets > 0) { out += ']'; brackets-- }
  return out
}

/**
 * Last-resort extractor for models that emit a tool_calls-shaped blob that is
 * close to JSON but not fully parseable. This salvages the first tool call by
 * reading the function name and escaped arguments directly from the text.
 */
function tryParseMalformedToolCall(text: string): ToolCallDef[] {
  const match = text.match(/"tool_calls"\s*:\s*\[\s*\{[\s\S]*?"id"\s*:\s*"([^"]+)"[\s\S]*?"function"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (!match) return []

  const [, rawId, rawName, rawArguments] = match
  let decodedArguments = '{}'
  try {
    decodedArguments = JSON.parse(`"${rawArguments}"`) as string
  } catch {
    decodedArguments = rawArguments.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  return [{
    id: rawId || `call_${Math.random().toString(36).slice(2)}`,
    type: 'function',
    function: {
      name: rawName,
      arguments: decodedArguments,
    },
  }]
}

/**
 * Some local models emit pseudo-XML tool calls in reasoning_content, e.g.
 * <tool_call><function=ha_get_states><parameter=domain>binary_sensor</parameter></function></tool_call>
 */
function tryParseXmlStyleToolCall(text: string): ToolCallDef[] {
  const functionMatch = text.match(/<function=([^>\s]+)>/i)
  if (!functionMatch?.[1]) return []

  const toolName = functionMatch[1].trim()
  const args: Record<string, string> = {}
  const paramRegex = /<parameter=([^>\s]+)>([\s\S]*?)<\/parameter>/gi
  let paramMatch: RegExpExecArray | null
  while ((paramMatch = paramRegex.exec(text)) !== null) {
    const key = paramMatch[1]?.trim()
    const value = paramMatch[2]?.trim()
    if (key && value) args[key] = value
  }

  return [{
    id: `call_${Math.random().toString(36).slice(2)}`,
    type: 'function',
    function: {
      name: toolName,
      arguments: JSON.stringify(args),
    },
  }]
}

/**
 * Attempt to extract a {"tool_calls": [...]} JSON block from the model's text
 * response (used for Ollama and LLMStudio when native function calling unavailable).
 *
 * Uses brace-counting instead of regex to correctly handle nested JSON objects
 * (the old lazy regex [\s\S]*?\} matched the first } it found, cutting the object short).
 */
function tryParseInjectedToolCalls(text: string): LlmResponse | null {
  // Build candidates: fenced code block first, then bare JSON object
  const candidates: Array<{ json: string; fullMatch: string }> = []

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    const inner = fenced[1].trim()
    if (inner.startsWith('{')) candidates.push({ json: inner, fullMatch: fenced[0] })
  }

  const bare = extractFirstJsonObject(text)
  if (bare) candidates.push({ json: bare.raw, fullMatch: bare.raw })

  for (const { json, fullMatch } of candidates) {
    // Try as-is first, then with repair (model may omit trailing `}`)
    for (const attempt of [json, repairJson(json)]) {
      try {
        const parsed = JSON.parse(attempt) as Record<string, unknown>
        if (!parsed['tool_calls'] || !Array.isArray(parsed['tool_calls'])) continue
        const allToolCalls = parseToolCallsOpenAI(parsed['tool_calls'])
        if (allToolCalls.length === 0) continue
        // One tool call per turn — injection providers must wait for each result
        const toolCalls = allToolCalls.slice(0, 1)
        const cleanText = text.replace(fullMatch, '').trim()
        return { content: cleanText, toolCalls, stopReason: 'tool_use' }
      } catch {
        continue
      }
    }
  }

  const malformedToolCalls = tryParseMalformedToolCall(text)
  if (malformedToolCalls.length > 0) {
    return { content: '', toolCalls: malformedToolCalls.slice(0, 1), stopReason: 'tool_use' }
  }

  const xmlToolCalls = tryParseXmlStyleToolCall(text)
  if (xmlToolCalls.length > 0) {
    return { content: '', toolCalls: xmlToolCalls.slice(0, 1), stopReason: 'tool_use' }
  }

  return null
}

// ─── Public: single-shot send ─────────────────────────────────────────────────

export async function sendLlmMessage(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[] = [],
): Promise<LlmResponse> {
  // For prompt-injection providers, augment system prompt with tool schemas
  const isNativeToolProvider = config.provider === 'claude' || config.provider === 'openai' || config.provider === 'openrouter'
  const effectiveSystemPrompt =
    tools.length > 0 && !isNativeToolProvider
      ? systemPrompt + '\n' + buildToolsSystemPromptSection(tools)
      : systemPrompt

  switch (config.provider) {
    case 'claude':
      return sendClaude(messages, effectiveSystemPrompt, config, tools)
    case 'openai':
      return sendOpenAI(messages, effectiveSystemPrompt, config, tools)
    case 'openrouter':
      return sendOpenRouter(messages, effectiveSystemPrompt, config, tools)
    case 'ollama':
      return sendOllama(messages, effectiveSystemPrompt, config, tools)
    case 'llmstudio':
      return sendLlmStudio(messages, effectiveSystemPrompt, config, tools)
    default:
      return { content: '', error: 'Unknown LLM provider', stopReason: 'error' }
  }
}

// ─── Public: agentic loop ────────────────────────────────────────────────────

export interface AgentLoopResult {
  messages: LlmMessage[]   // full updated history
  finalContent: string
  iterations: number
  error?: string
  meta?: Record<string, unknown>
}

export interface AgentLoopOptions {
  maxIterations?: number
  onToolCall?: (call: ToolCallDef, result: unknown) => void
}

function buildFallbackAgentAnswer(history: LlmMessage[]): string {
  const recentTools = history
    .filter((msg): msg is LlmMessage & { role: 'tool'; name: string } => msg.role === 'tool' && Boolean(msg.name) && Boolean(msg.content.trim()))
    .slice(-2)

  if (recentTools.length === 0) {
    return 'El modelo no devolvio una respuesta final legible tras ejecutar las herramientas.'
  }

  const parts = recentTools.map((msg) => {
    const snippet = msg.content.length > 1200 ? `${msg.content.slice(0, 1200).trimEnd()}...` : msg.content
    return `Resultado de ${msg.name}:\n${snippet}`
  })

  return `El modelo no devolvio una respuesta final legible. Muestro los ultimos resultados obtenidos:\n\n${parts.join('\n\n')}`
}

/**
 * Run an agentic loop: send messages → if model returns tool calls →
 * execute them against HAClient → append results → repeat.
 * Returns when the model stops calling tools or maxIterations is reached.
 */
export async function runAgentLoop(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools: HaTool[],
  haClient: HAClient,
  opts: AgentLoopOptions = {},
): Promise<AgentLoopResult> {
  const maxIterations = opts.maxIterations ?? 10
  let history: LlmMessage[] = [...messages]
  let iterations = 0
  let lastMeta: Record<string, unknown> | undefined

  while (iterations < maxIterations) {
    iterations++
    const response = await sendLlmMessage(history, systemPrompt, config, tools)
    lastMeta = response.meta

    if (response.error) {
      return { messages: history, finalContent: '', iterations, error: response.error, meta: lastMeta }
    }

    if (!response.toolCalls || response.toolCalls.length === 0) {
      // Model is done — append final assistant message and return
      const finalContent = response.content.trim() || buildFallbackAgentAnswer(history)
      history = [...history, { role: 'assistant', content: finalContent }]
      return { messages: history, finalContent, iterations, meta: lastMeta }
    }

    // Append assistant message with pending tool calls
    history = [
      ...history,
      { role: 'assistant', content: response.content ?? '', tool_calls: response.toolCalls },
    ]

    // Execute each tool call and append tool result messages
    for (const call of response.toolCalls) {
      let result: unknown
      try {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>
        result = await executeHaTool(call.function.name, args, haClient)
      } catch (err) {
        result = { error: String(err) }
      }

      opts.onToolCall?.(call, result)

      // Truncate large results so a single ha_get_states call doesn't overflow any context window
      const MAX_TOOL_RESULT_CHARS = 4000
      const rawContent = typeof result === 'string' ? result : JSON.stringify(result)
      const content = rawContent.length > MAX_TOOL_RESULT_CHARS
        ? rawContent.slice(0, MAX_TOOL_RESULT_CHARS) + `\n[...truncated ${rawContent.length - MAX_TOOL_RESULT_CHARS} more chars]`
        : rawContent

      history = [
        ...history,
        {
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content,
        },
      ]
    }
  }

  return {
    messages: history,
    finalContent: buildFallbackAgentAnswer(history),
    iterations,
    error: `Max iterations (${maxIterations}) reached`,
    meta: lastMeta,
  }
}

// ─── System prompt builder ────────────────────────────────────────────────────

export function buildInventorySystemPrompt(inventoryJson: string, toolsSection = ''): string {
  return `You are an expert Home Assistant analyst and controller. The user has provided the inventory of their Home Assistant instance below.

INVENTORY (JSON):
${inventoryJson}

Guidelines:
- Be concise and actionable
- Reference specific entity_ids when relevant
- When analyzing automations, highlight ones that never triggered (last_triggered = null)
- For energy optimization, focus on actuators (lights, covers, climate)
- Respond in the same language the user uses
- When the user asks about CURRENT states or real-time data, use the available tools instead of relying only on the inventory snapshot${toolsSection}`
}
