/**
 * haTools.ts — MCP/OpenAI-compatible tool definitions for the Home Assistant REST API.
 *
 * Each tool maps 1-to-1 to a HAClient method. The dispatcher `executeHaTool` converts
 * the JSON-serialized arguments back into a typed call and returns a serializable result.
 */

import type { HAClient } from '@/lib/haApi'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const HA_TOOLS: HaTool[] = [
  {
    type: 'function',
    function: {
      name: 'ha_get_status',
      description: 'Check if the Home Assistant instance is running and reachable. Returns { message } on success.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_config',
      description: 'Get the Home Assistant core configuration (location, timezone, unit system, enabled components, version, etc.).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_components',
      description: 'List all loaded integrations/components in the Home Assistant instance.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_services',
      description: 'List all available services grouped by domain. Useful to discover what actions can be called.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_events_list',
      description: 'List all event types that are being listened to in Home Assistant with their listener counts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_states',
      description: 'Get the current state of all entities. Optionally filter by domain (e.g. "light", "sensor", "automation"). Returns an array of state objects with entity_id, state, and attributes.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Optional domain to filter entities (e.g. "light", "switch", "climate", "sensor", "automation").',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_state',
      description: 'Get the current state of a single entity by its entity_id.',
      parameters: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'The entity_id to query (e.g. "light.living_room").' },
        },
        required: ['entity_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_history',
      description: 'Get the state history of an entity over a time range. Returns an array of state changes.',
      parameters: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Entity to retrieve history for.' },
          start_time: { type: 'string', description: 'ISO 8601 start time. Defaults to 24 hours ago.' },
          end_time: { type: 'string', description: 'ISO 8601 end time. Defaults to now.' },
          minimal_response: {
            type: 'boolean',
            description: 'Return only state and last_changed (smaller payload). Default true.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_logbook',
      description: 'Get logbook entries (human-readable event log) for a time range, optionally filtered by entity.',
      parameters: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Filter logbook to a specific entity.' },
          start_time: { type: 'string', description: 'ISO 8601 start time. Defaults to 24 hours ago.' },
          end_time: { type: 'string', description: 'ISO 8601 end time.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_error_log',
      description: 'Retrieve the current Home Assistant error log as plain text.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_calendars',
      description: 'List all calendar entities available in Home Assistant.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_get_calendar_events',
      description: 'Get events from a specific calendar entity within a date range.',
      parameters: {
        type: 'object',
        properties: {
          calendar_entity_id: { type: 'string', description: 'Calendar entity_id (e.g. "calendar.holidays").' },
          start: { type: 'string', description: 'ISO 8601 start datetime.' },
          end: { type: 'string', description: 'ISO 8601 end datetime.' },
        },
        required: ['calendar_entity_id', 'start', 'end'],
      },
    },
  },
  // ─── Action tools (POST) ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'ha_call_service',
      description: 'Call a Home Assistant service to control devices (e.g. turn on a light, start a script, trigger an automation). Use ha_get_services to discover available services and their parameters.',
      parameters: {
        type: 'object',
        properties: {
          domain: { type: 'string', description: 'Service domain (e.g. "light", "switch", "climate", "automation").' },
          service: { type: 'string', description: 'Service name (e.g. "turn_on", "turn_off", "toggle", "set_temperature").' },
          service_data: {
            type: 'object',
            description: 'Additional service parameters (e.g. {"brightness_pct": 80, "color_temp": 4000}).',
          },
          target: {
            type: 'object',
            description: 'Target selector: { entity_id, area_id, device_id } — each can be a string or array.',
            properties: {
              entity_id: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
              area_id: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
              device_id: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
            },
          },
        },
        required: ['domain', 'service'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_fire_event',
      description: 'Fire a custom Home Assistant event on the event bus.',
      parameters: {
        type: 'object',
        properties: {
          event_type: { type: 'string', description: 'Event type to fire (e.g. "custom_alarm_triggered").' },
          event_data: { type: 'object', description: 'Optional data payload to include with the event.' },
        },
        required: ['event_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_update_state',
      description: 'Set or update the state of an entity (creates the entity if it does not exist). Useful for virtual/helper entities.',
      parameters: {
        type: 'object',
        properties: {
          entity_id: { type: 'string', description: 'Entity to update (e.g. "input_text.notes").' },
          state: { type: 'string', description: 'New state value.' },
          attributes: { type: 'object', description: 'Optional state attributes to set.' },
        },
        required: ['entity_id', 'state'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_render_template',
      description: 'Render a Home Assistant Jinja2 template and return the result as a string. Useful for complex state queries.',
      parameters: {
        type: 'object',
        properties: {
          template: { type: 'string', description: 'Jinja2 template string to render.' },
        },
        required: ['template'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_check_config',
      description: 'Check the Home Assistant YAML configuration for errors without restarting.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ha_handle_intent',
      description: 'Handle a Home Assistant intent (voice command / intent). Pass the intent name and optional slot data.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Intent name (e.g. "TurnOnIntent").' },
          data: { type: 'object', description: 'Optional slot data for the intent.' },
        },
        required: ['name'],
      },
    },
  },
]

// ─── Tool groupings ───────────────────────────────────────────────────────────

export const READ_ONLY_TOOLS: string[] = [
  'ha_get_status',
  'ha_get_config',
  'ha_get_components',
  'ha_get_services',
  'ha_get_events_list',
  'ha_get_states',
  'ha_get_state',
  'ha_get_history',
  'ha_get_logbook',
  'ha_get_error_log',
  'ha_get_calendars',
  'ha_get_calendar_events',
]

export const ACTION_TOOLS: string[] = [
  'ha_call_service',
  'ha_fire_event',
  'ha_update_state',
  'ha_render_template',
  'ha_check_config',
  'ha_handle_intent',
]

// ─── Tool executor ────────────────────────────────────────────────────────────

/**
 * Dispatch a tool call to the matching HAClient method.
 * `args` are the parsed JSON arguments from the LLM.
 */
export async function executeHaTool(
  toolName: string,
  args: Record<string, unknown>,
  client: HAClient,
): Promise<unknown> {
  switch (toolName) {
    case 'ha_get_status':
      return client.ping().then((ok) => ({ ok, message: ok ? 'Home Assistant is running' : 'Unreachable' }))

    case 'ha_get_config':
      return client.getConfig()

    case 'ha_get_components':
      return client.getComponents()

    case 'ha_get_services':
      return client.getServices()

    case 'ha_get_events_list':
      return client.getEventsList()

    case 'ha_get_states': {
      const states = await client.getStates()
      const domain = args['domain'] as string | undefined
      return domain ? states.filter((s) => s.entity_id.startsWith(`${domain}.`)) : states
    }

    case 'ha_get_state':
      return client.getState(args['entity_id'] as string)

    case 'ha_get_history':
      return client.getHistory(
        args['entity_id'] as string | undefined,
        args['start_time'] as string | undefined,
        args['end_time'] as string | undefined,
        (args['minimal_response'] as boolean | undefined) ?? true,
      )

    case 'ha_get_logbook':
      return client.getLogbook(
        args['start_time'] as string | undefined,
        args['entity_id'] as string | undefined,
        args['end_time'] as string | undefined,
      )

    case 'ha_get_error_log':
      return client.getErrorLog()

    case 'ha_get_calendars':
      return client.getCalendars()

    case 'ha_get_calendar_events':
      return client.getCalendarEvents(
        args['calendar_entity_id'] as string,
        args['start'] as string,
        args['end'] as string,
      )

    case 'ha_call_service':
      return client.callService(
        args['domain'] as string,
        args['service'] as string,
        args['service_data'] as Record<string, unknown> | undefined,
        args['target'] as Parameters<HAClient['callService']>[3],
      )

    case 'ha_fire_event':
      return client.fireEvent(
        args['event_type'] as string,
        args['event_data'] as Record<string, unknown> | undefined,
      )

    case 'ha_update_state':
      return client.updateState(
        args['entity_id'] as string,
        args['state'] as string,
        args['attributes'] as Record<string, unknown> | undefined,
      )

    case 'ha_render_template':
      return client.renderTemplate(args['template'] as string)

    case 'ha_check_config':
      return client.checkConfig()

    case 'ha_handle_intent':
      return client.handleIntent(
        args['name'] as string,
        args['data'] as Record<string, unknown> | undefined,
      )

    default:
      throw new Error(`Unknown HA tool: ${toolName}`)
  }
}

// ─── System prompt snippet for prompt-injection providers ─────────────────────

/**
 * Generates the tools section to inject into the system prompt for providers
 * that don't support native function calling (Ollama, LLMStudio).
 *
 * The model must respond with a JSON block when it wants to call a tool:
 * ```json
 * {"tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "ha_get_states", "arguments": "{\"domain\":\"light\"}"}}]}
 * ```
 * After receiving the tool result, continue the conversation normally.
 */
export function buildToolsSystemPromptSection(enabledTools: HaTool[]): string {
  if (enabledTools.length === 0) return ''

  const toolList = enabledTools
    .map((t) => `- **${t.function.name}**: ${t.function.description}`)
    .join('\n')

  const exampleArgs = JSON.stringify({ domain: 'light' })
  const exampleCall = JSON.stringify({
    tool_calls: [
      { id: 'call_1', type: 'function', function: { name: 'ha_get_states', arguments: exampleArgs } },
    ],
  })

  return `
## AVAILABLE TOOLS (Home Assistant API)

You have access to the following tools to query and control Home Assistant in real time.
Whenever the user asks about current states, history, or wants to control devices, use the appropriate tool.

${toolList}

### STRICT RULES — read carefully
1. **Call ONE tool per response.** Wait for its result before deciding the next step.
2. **NEVER guess an entity_id.** Always derive entity_id from:
   a. The inventory already in your system prompt (search by friendly_name or area), OR
   b. Calling \`ha_get_states\` (optionally with domain filter) first, then pick the correct entity_id from the results.
3. If the inventory doesn't contain the entity, call \`ha_get_states\` with the relevant domain and identify the right entity by its \`friendly_name\` or \`attributes.friendly_name\`.
4. Do NOT emit multiple tool calls trying different possible entity_ids.

### How to call a tool (STEP 1 — requesting)
Respond ONLY with a JSON block (nothing before or after it):
\`\`\`json
${exampleCall}
\`\`\`

### After receiving a tool result (STEP 2 — got the data)
When you see **"Tool result from <name>:"** in the conversation:
- You ALREADY HAVE the data. Do NOT call another tool unless you truly need something not in the result.
- Analyze the JSON returned, find the relevant entity, and **answer the user in natural language** (their language).
- Do NOT emit a JSON block. Do NOT output tool_calls. Just write a normal answer.
- If the user asked for a room light such as "despacho", "salon", or "cocina" and the light results already contain matching entities by \`entity_id\` or \`friendly_name\`, STOP and answer with those matching lights and their states.
- For example, if you see \`light.despacho_luz_lateral_2\` and \`light.despacho_luz_superior\`, answer with their states. Do NOT go search sensors, switches, or binary_sensors unless no matching light exists.

### Action tools (ha_call_service, ha_fire_event, ha_update_state)
Before calling any action tool, briefly describe what you are about to do so the user can confirm.
`
}
