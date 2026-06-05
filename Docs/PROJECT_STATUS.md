# HA Analyst Tools - Estado del Proyecto 📊

**Fecha de análisis:** 2026-06-05  
**Versión:** 0.0.0  
**Estado:** Proyecto activo con todas las funcionalidades implementadas

---

## 📋 Descripción General

**HA Analyst Tools** es una aplicación web progresiva para explorar, analizar y documentar instalaciones de **Home Assistant** desde el navegador, sin requerir instalación de software adicional en el servidor.

La aplicación proporciona un conjunto completo de herramientas para:
- Conectar y autenticarse con instancias de Home Assistant
- Analizar el inventario completo de entidades
- Auditar automatizaciones y scripts
- Organizar entidades en zonas físicas personalizables
- Consultar instalaciones mediante un agente IA (OpenAI, Anthropic, Ollama, LLMStudio)
- Explorar y ejecutar APIs de Home Assistant
- Exportar datos en múltiples formatos

---

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico

```
Frontend Framework:
├── React 18.3.1 (UI)
├── TypeScript 5.6 (Tipado estático)
├── Vite 5.4.9 (Build tool)
└── Tailwind CSS 3.4 + Radix UI (Estilado)

Estado Global:
├── Zustand 5.0 (State management)
└── Persistencia en localStorage/sessionStorage

Librerías de IA:
├── @anthropic-ai/sdk (Claude API)
├── openai (OpenAI API)
└── LLM locales (Ollama, LLMStudio via OpenAI-compatible API)

Utilidades:
├── xlsx (Exportación Excel)
├── lucide-react (Iconos)
└── cmdk (Command palette UI)
```

### Estructura de Directorios

```
src/
├── components/
│   ├── layout/
│   │   └── AppShell.tsx          # Shell principal con navegación de pestañas
│   ├── tabs/
│   │   ├── VaultTab.tsx          # Conexión y autenticación con HA
│   │   ├── ResumenTab.tsx        # Dashboard con KPIs y tabla filtrable
│   │   ├── ExplorerTab.tsx       # Exploración detallada de entidades
│   │   ├── AutomacionesTab.tsx   # Auditoría de automatizaciones
│   │   ├── ZonasTab.tsx          # Gestión de zonas físicas
│   │   ├── AgenteTab.tsx         # Chat con agente IA + herramientas
│   │   └── HaApiTab.tsx          # Exploración manual de APIs
│   └── ui/
│       ├── badge.tsx             # Componentes Radix UI
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── textarea.tsx
│       └── ExportDialog.tsx       # Diálogo de exportación
│
├── lib/
│   ├── haApi.ts                  # Cliente REST para Home Assistant
│   ├── haTools.ts                # Definiciones MCP de herramientas HA
│   ├── llmProviders.ts           # Integraciones con proveedores LLM
│   ├── exporters.ts              # Exportadores (Excel, JSON)
│   └── utils.ts                  # Utilidades generales
│
├── store/
│   ├── inventoryStore.ts         # Estado del inventario de HA
│   ├── vaultStore.ts             # Credenciales y conexión
│   └── zonesStore.ts             # Gestión de zonas personalizadas
│
├── types/
│   └── ha.ts                     # Tipos TypeScript compartidos
│
├── App.tsx                       # Componente raíz
├── main.tsx                      # Punto de entrada
├── index.css                     # Estilos globales
└── vite-env.d.ts                 # Tipos de Vite
```

---

## 🎯 Funcionalidades Implementadas

### 1. **Vault** 🔐
- Conexión a Home Assistant mediante URL + Long-Lived Access Token
- Validación de conectividad en tiempo real
- Carga offline de JSON exportado previamente
- Token almacenado en sessionStorage (se limpia al cerrar pestaña)
- URL persistida en localStorage
- Indicador visual de estado de conexión

### 2. **Resumen** 📊
- Dashboard con KPIs principales:
  - Total de entidades
  - Automatizaciones activas
  - Entidades no disponibles
  - Actuadores encendidos
  - Sensores disponibles
- Tabla filtrable y ordenable de todas las entidades
- Filtrado rápido: clic en un KPI para filtrar la tabla al instante
- Información detallada de cada entidad (estado, atributos, última actualización)

### 3. **Explorer** 🔍
- Búsqueda y exploración jerárquica de entidades
- Filtrado por:
  - Dominio (light, switch, sensor, climate, etc.)
  - Área asignada
  - Estado actual
  - Tipo de entidad (sensor, actuador, otro)
- Vista detallada con atributos completos
- Información de dispositivo y contexto

### 4. **Automatizaciones** ⚙️
- Listado de todas las automatizaciones configuradas
- Información por automatización:
  - Estado (habilitada/deshabilitada)
  - Modo de ejecución
  - Última ejecución
  - Triggers y acciones
- Ordenamiento y filtrado

### 5. **Zonas Físicas** 🏠
- Organización personalizada de entidades por espacio físico
- Tipos de zona:
  - Interior (habitaciones, pasillos, etc.)
  - Fachada exterior
  - Mixta
- Propiedades por zona:
  - Nombre personalizado
  - Tipo de zona
  - Orientación (norte, sur, este, oeste, etc.)
  - Notas descriptivas
- Importación de áreas directamente desde Home Assistant
- Persistencia en Zustand + localStorage

### 6. **Agente IA** 🤖
Consulta conversacional con contexto del inventario y herramientas en tiempo real:

**Proveedores soportados:**
- OpenAI (GPT-4, GPT-4o)
- Anthropic (Claude 3.5 Sonnet)
- Ollama (modelos locales)
- LLMStudio (modelos locales con contexto amplio)

**Características:**
- Herramientas en tiempo real (tool calling):
  - `ha_get_status`: Estado del servidor
  - `ha_get_config`: Configuración global
  - `ha_get_states`: Estado de todas las entidades
  - `ha_get_components`: Integraciones cargadas
  - `ha_get_services`: Servicios disponibles
  - Y muchas más...
- Contexto vacío por defecto (usuario elige qué incluir)
- Selección granular de contexto:
  - Incluir/excluir automatizaciones, entidades, áreas, grupos
  - Limitar nivel de detalle
- Compresión automática de mensajes previos (evita overflow de contexto)
- Indicador visual de ocupación de contexto
- Métricas de respuesta (tokens, tiempo, velocidad)
- Trazas visuales de llamadas a herramientas

### 7. **API HA** 🔌
- Exploración manual de endpoints REST de Home Assistant
- Constructor de solicitudes GET/POST
- Visualización de respuestas en tiempo real
- Autocomplete de rutas comunes
- Útil para debugging y exploración

### 8. **Exportación Flexible** 📥
Múltiples formatos y opciones:

**Formatos:**
- Excel (XLSX) con múltiples hojas
- JSON

**Opciones de sección:**
- Automatizaciones
- Escenas
- Grupos
- Scripts
- Sensores
- Actuadores
- Otras entidades
- Áreas
- Zonas personalizadas

**Modo ligero:**
- Elimina atributos completos
- Elimina timestamps raw
- Reduce tamaño hasta 10x

---

## 🔧 Servicios Principales

### `haApi.ts` - Cliente REST de Home Assistant

```typescript
class HAClient {
  constructor(url: string, token: string)
  
  // Métodos principales
  async ping(): boolean
  async getStates(): HaStateRaw[]
  async getConfig(): Record<string, unknown>
  async getAreas(): HaAreaRaw[]
  async getEntityRegistry(): HaEntityRegistryRaw[]
  async getServices(): Record<string, unknown>
  // ... y más
}
```

**Características:**
- Normalización de URLs
- Headers de autenticación transparente
- Proxy en desarrollo (via Vite plugin)
- Manejo de errores consistente

### `llmProviders.ts` - Integraciones LLM

Soporta múltiples proveedores con interfaz unificada:

```typescript
async function sendMessage(
  messages: LlmMessage[],
  systemPrompt: string,
  config: LlmConfig,
  tools?: HaTool[]
): Promise<LlmResponse>
```

**Características:**
- Tool calling (function calling)
- Manejo de stop reasons
- Serialización de mensajes normalizada
- Error recovery

### `haTools.ts` - Definiciones de Herramientas

Conjunto de 20+ herramientas MCP/OpenAI-compatible para queries de HA:
- Lectura de estado y config
- Listado de servicios, eventos, componentes
- Queries específicas de dominio
- Ejecución de servicios
- Template rendering

### `exporters.ts` - Generadores de Exportación

```typescript
function exportToExcel(
  inventory: Inventory,
  zones: Zone[],
  options: ExportOptions
): void

function exportToJSON(
  inventory: Inventory,
  zones: Zone[]
): string
```

**Hojas en Excel:**
- Resumen (metadata)
- Automatizaciones
- Escenas, Grupos, Scripts
- Sensores, Actuadores, Otros
- Áreas, Zonas

---

## 🗄️ Gestión de Estado (Zustand Stores)

### `vaultStore.ts`
```typescript
{
  url: string           // URL de HA
  token: string         // Token en memoria
  connected: boolean    // Estado de conexión
  connecting: boolean   // Flag de operación
  error: string | null  // Último error
}
```
- Token en sessionStorage (más seguro)
- URL en localStorage persistida

### `inventoryStore.ts`
```typescript
{
  inventory: Inventory | null
  loading: boolean
  error: string | null
  automationStats: Record<string, number>
}
```

### `zonesStore.ts`
```typescript
{
  zones: Zone[]
  // Métodos para CRUD de zonas
}
```

---

## 🔌 Integraciones Externas

### Home Assistant
- Conexión REST API
- Long-Lived Access Tokens
- Proxy en desarrollo (Vite plugin personalizado)
- Fallback a carga offline JSON

### Proveedores LLM

| Proveedor | Modelo | Endpoint | Características |
|-----------|--------|----------|-----------------|
| **OpenAI** | GPT-4o | `api.openai.com` | Tool calling, streaming |
| **Anthropic** | Claude 3.5 Sonnet | `api.anthropic.com` | Tool use nativo |
| **Ollama** | Cualquier modelo | `localhost:11434` | Local, sin API key |
| **LLMStudio** | Múltiples | `localhost:1234` | Local, descubrimiento dinámico de contexto |

---

## 🚀 Modos de Ejecución

### Desarrollo Local
```bash
npm run dev
```
- Vite dev server en `http://localhost:5173`
- Proxy automático para evitar CORS
- Hot Module Replacement (HMR)
- TypeScript checking en tiempo real

### Build para Producción
```bash
npm run build
```
- Compilación de TypeScript
- Optimización de Vite
- Output en `dist/`

### Docker
```bash
./run.ps1
```
- Dockerfile personalizado
- nginx como proxy reverso (CORS handling)
- Publicado en `http://localhost:8080`

---

## 📝 Tipos Principales

### Inventory (Modelo de datos principal)
```typescript
interface Inventory {
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
```

### HaEntity (Entidad normalizada)
```typescript
interface HaEntity {
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
  kind: 'sensor' | 'actuator' | 'other'
}
```

### Zone (Zona personalizada)
```typescript
interface Zone {
  id: string          // uuid o area_id
  name: string
  type: 'fachada' | 'interior' | 'mixta'
  orientation: string // norte, sur, este, oeste
  entity_ids: string[]
  notes: string
}
```

### LlmConfig (Configuración de LLM)
```typescript
interface LlmConfig {
  provider: 'claude' | 'openai' | 'ollama' | 'llmstudio'
  apiKey: string
  temperature?: number
  maxTokens?: number
  llmstudioMaxContextTokens?: number
  llmstudioContextReserveTokens?: number
}
```

---

## ⚙️ Configuración Técnica

### TypeScript
```json
{
  "target": "ES2020",
  "jsx": "react-jsx",
  "strict": true,
  "esModuleInterop": true,
  "skipLibCheck": true
}
```

### Vite
- Plugin React con SWC
- Alias `@` → `src`
- Proxy dinámico `/ha-proxy` en desarrollo
- Optimización de dependencias

### Tailwind CSS
- PostCSS configurado
- Esquema de colores personalizado
- Temas light/dark (disponible)

### ESLint
- TypeScript support
- React Hooks rules
- React Refresh rules

---

## 🔐 Seguridad

### Credenciales
- ✅ Tokens en **sessionStorage** (se limpian al cerrar pestaña)
- ✅ URLs en **localStorage** (sin datos sensibles)
- ✅ Validación HTTPS cuando sea posible
- ⚠️ CORS: En desarrollo se proxya; en producción nginx lo maneja

### API calls
- Headers de autenticación correctos
- Manejo robusto de errores
- Validación de respuestas

---

## 📊 Funcionalidades del Agente IA

### Herramientas Disponibles (20+)

**Estado y Config:**
- `ha_get_status` — Verificar conectividad
- `ha_get_config` — Configuración global (zona horaria, unidades, versión)
- `ha_get_components` — Integraciones cargadas

**Entidades y Servicios:**
- `ha_get_states` — Estado de todas las entidades (con filtro por dominio)
- `ha_get_state` — Estado de una entidad específica
- `ha_get_services` — Servicios disponibles por dominio
- `ha_get_events_list` — Event listeners activos

**Dominio-específicas:**
- `ha_call_service` — Ejecutar servicios (si está habilitado)
- `ha_render_template` — Renderizar templates Jinja2
- `ha_get_logbook` — Historial de eventos
- `ha_get_history` — Histórico de estados

### Gestión de Contexto

**Presupuesto de contexto:**
- Cálculo automático de tokens disponibles
- Indicador visual de ocupación
- Compresión automática de histórico cuando se acerca al límite
- Soporte para LLMStudio con contexto dinámico

**Secciones contextuales:**
- Instrucciones del sistema (siempre)
- Inventario completo (opcional, granular)
- Automatizaciones (seleccionables)
- Historial de chat (con compresión)
- Resultados de herramientas (truncados si son muy grandes)

---

## 🎨 Componentes UI

Todos los componentes usan **Radix UI** + **Tailwind CSS**:

- `badge` — Etiquetas y estados
- `button` — Botones estilizados
- `card` — Contenedores de contenido
- `input` — Campos de texto
- `select` — Selectores personalizados
- `textarea` — Áreas de texto
- `ExportDialog` — Diálogo modal de exportación

---

## 📈 Características Avanzadas

### 1. Detección Automática de Contexto (LLMStudio)
```typescript
- Intenta descubrir loaded_context_length del modelo
- Fallback a max_context_length si no está disponible
- Override manual si es necesario
```

### 2. Compresión de Histórico
```typescript
- Detecta cuando el contexto se acerca al límite
- Resume N mensajes anteriores automáticamente
- Preserva últimas N vueltas del chat
```

### 3. Tool Calling Heterogéneo
```typescript
- Soporta OpenAI function_calling format
- Soporta Anthropic tool_use format
- Conversión automática entre formatos
```

### 4. Exportación Flexible
```typescript
- Slim mode: reduce tamaño hasta 10x
- Selección granular de secciones
- Múltiples formatos (Excel, JSON)
- Metadata automática (fecha, URL, modo)
```

---

## 🐛 Consideraciones Técnicas

### Limitaciones Conocidas

1. **APIs de HA limitadas via REST:**
   - Entity Registry solo via WebSocket (fallback a array vacío)
   - Area Registry solo via WebSocket (fallback a array vacío)
   - Algunos datos internos no expuestos

2. **Contexto LLM:**
   - Modelos locales pueden tener límites más estrictos que teóricos
   - Recomendación: revisar `loaded_context_length` en LLMStudio

3. **CORS:**
   - Necesita proxy en desarrollo (Vite) o producción (nginx)
   - O CORS habilitado en configuration.yaml de HA

### Rendimiento

- Tabla de entidades: optimizada para 5K+ entidades
- Chat: compresión automática evita bloat
- Exportación: streaming de Excel para archivos grandes

---

## 🔄 Flujo de Datos Principal

```
Usuario → UI (Tab)
    ↓
Zustand Store (inventoryStore, vaultStore, zonesStore)
    ↓
Servicios (haApi, llmProviders, exporters)
    ↓
Home Assistant API / LLM Provider API / XLSX Export
    ↓
Respuesta normalizada → Store → UI
```

---

## 📚 Dependencias Clave

| Paquete | Versión | Propósito |
|---------|---------|----------|
| `react` | 18.3.1 | Framework UI |
| `typescript` | 5.6.2 | Tipado estático |
| `vite` | 5.4.9 | Build + dev server |
| `zustand` | 5.0.12 | State management |
| `@anthropic-ai/sdk` | 0.86.1 | Claude API |
| `openai` | 6.33.0 | OpenAI API |
| `tailwindcss` | 3.4.19 | Estilado CSS |
| `@radix-ui/*` | ^1.x | Componentes accesibles |
| `xlsx` | 0.18.5 | Exportación Excel |
| `lucide-react` | 1.7.0 | Iconos |

---

## 📦 Scripts Disponibles

```json
{
  "dev": "vite",                      // Dev server
  "build": "tsc -b && vite build",    // Build prod
  "lint": "eslint .",                 // Lint code
  "preview": "vite preview"           // Preview build
}
```

---

## 🎯 Próximos Pasos Potenciales

1. **Mejoras de UX:**
   - Tema oscuro/claro con persistencia
   - Accesos rápidos a entidades favoritas
   - Búsqueda global con fuzzy matching

2. **Integraciones adicionales:**
   - Más proveedores LLM (Google, Groq, etc.)
   - Soporte para Custom LLM backends

3. **Features avanzadas:**
   - Historial de cambios con diff visual
   - Alertas y monitoreo
   - Scripts batch de acciones
   - Backups automáticos

4. **Performance:**
   - Virtual scrolling para tablas grandes
   - Web Workers para processing pesado
   - Service Worker para offline mode mejorado

---

## 📄 Resumen Ejecutivo

**HA Analyst Tools** es una aplicación web **completa y funcional** que proporciona un kit integral de herramientas para explorar, analizar y documentar instalaciones de Home Assistant. 

**Fortalezas:**
✅ Arquitectura limpia basada en TypeScript  
✅ UI intuitivo con componentes Radix UI  
✅ Integración flexible con múltiples proveedores LLM  
✅ Exportación versátil (Excel, JSON)  
✅ Herramientas avanzadas para debugging y exploración  
✅ Gestión de estado robusta con Zustand  

**Estado actual:**
✅ Todas las funcionalidades principales implementadas  
✅ Código compilable sin errores  
✅ Listo para desarrollo o deployment  

---

*Documento generado automáticamente — 2026-06-05*
