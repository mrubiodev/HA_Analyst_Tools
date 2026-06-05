# HA Analyst Tools - Arquitectura Visual

## 🎯 Diagrama de Flujo General

```mermaid
graph TB
    User["👤 Usuario"]
    UI["🎨 UI Layer<br/>(React Components)"]
    Store["🗄️ State Layer<br/>(Zustand Stores)"]
    Services["⚙️ Services Layer<br/>(Business Logic)"]
    API["🔌 External APIs"]
    
    User -->|Interactúa| UI
    UI -->|Lee/Actualiza| Store
    Store -->|Consulta/Modifica| Services
    Services -->|HTTP/REST| API
    
    API -->|"HA REST<br/>LLM API<br/>XLSX Export"| Services
    Services -->|Datos normalizados| Store
    Store -->|Re-render| UI
    UI -->|Visualiza| User
```

## 🏗️ Arquitectura de Componentes

```mermaid
graph TB
    AppShell["AppShell<br/>(Layout principal)"]
    
    AppShell --> VaultTab["🔐 VaultTab<br/>Conexión & Auth"]
    AppShell --> ResumenTab["📊 ResumenTab<br/>Dashboard KPIs"]
    AppShell --> ExplorerTab["🔍 ExplorerTab<br/>Entity Search"]
    AppShell --> AutoTab["⚙️ AutomacionesTab<br/>Automation Audit"]
    AppShell --> ZonasTab["🏠 ZonasTab<br/>Physical Zones"]
    AppShell --> AgenteTab["🤖 AgenteTab<br/>AI Agent Chat"]
    AppShell --> HaApiTab["🔌 HaApiTab<br/>API Explorer"]
    
    VaultTab -.->|usa| vaultStore
    ResumenTab -.->|usa| inventoryStore
    ExplorerTab -.->|usa| inventoryStore
    AutoTab -.->|usa| inventoryStore
    ZonasTab -.->|usa| zonesStore
    AgenteTab -.->|usa| vaultStore & inventoryStore
    HaApiTab -.->|usa| vaultStore
    
    subgraph Stores
        vaultStore["🔐 vaultStore<br/>url, token, connected"]
        inventoryStore["📦 inventoryStore<br/>Inventory cache"]
        zonesStore["📍 zonesStore<br/>Custom zones"]
    end
```

## 🔄 Flujo de Datos - Conexión a Home Assistant

```mermaid
sequenceDiagram
    participant U as Usuario
    participant UI as VaultTab
    participant Store as vaultStore
    participant Service as HAClient
    participant HA as Home Assistant
    
    U->>UI: Ingresa URL + Token
    UI->>Store: setUrl(), setToken()
    Store->>Store: Persiste en localStorage/sessionStorage
    U->>UI: Clica "Conectar"
    UI->>UI: setConnecting(true)
    UI->>Service: new HAClient(url, token)
    Service->>HA: fetch /api/
    HA->>Service: 200 OK
    Service->>Store: setConnected(true)
    UI->>U: ✅ Conectado
```

## 🔄 Flujo de Datos - Carga de Inventario

```mermaid
sequenceDiagram
    participant UI as ResumenTab
    participant Store as inventoryStore
    participant HAClient as HAClient
    participant Parser as Normalizer
    participant HA as Home Assistant
    
    UI->>UI: useEffect[]
    UI->>Store: loadInventory()
    Store->>Store: setLoading(true)
    Store->>HAClient: getStates()
    HAClient->>HA: GET /api/states
    HA->>HAClient: [HaStateRaw[], ...]
    HAClient->>Parser: normalizeStates()
    Parser->>Parser: Clasifica por dominio<br/>y kind (sensor/actuator)
    Parser->>Store: inventory = Inventory
    Store->>Store: setLoading(false)
    Store->>UI: Re-render con datos
    UI->>UI: Muestra tabla & KPIs
```

## 🤖 Flujo de Datos - Agente IA con Tool Calling

```mermaid
sequenceDiagram
    participant User as Usuario
    participant Chat as AgenteTab
    participant Store as inventoryStore
    participant LLM as llmProviders
    participant Model as OpenAI/Claude/Ollama
    participant HA as HAClient
    participant Tools as haTools
    
    User->>Chat: Escribe: "¿Cuántas luces hay?"
    Chat->>Chat: systemPrompt + context
    Chat->>LLM: sendMessage(messages, tools)
    LLM->>Model: POST /v1/chat/completions<br/>with tools
    Model->>Model: Procesa con contexto
    Model->>LLM: toolCalls: [ha_get_states]
    LLM->>Tools: executeHaTool('ha_get_states')
    Tools->>HA: getStates()
    HA->>HA: Filtra domain=light
    HA->>Tools: [light.*, ...]
    Tools->>LLM: "Found 15 lights"
    LLM->>Model: POST (tool result)
    Model->>LLM: "response: Se encontraron 15 luces"
    LLM->>Chat: LlmResponse
    Chat->>User: Muestra respuesta
```

## 💾 Diagrama de Estado (Zustand Stores)

```mermaid
graph TB
    subgraph vaultStore
        url["url: string<br/>(localStorage)"]
        token["token: string<br/>(sessionStorage)"]
        connected["connected: boolean"]
        connecting["connecting: boolean"]
        error["error: string | null"]
    end
    
    subgraph inventoryStore
        inventory["inventory: Inventory | null"]
        loading["loading: boolean"]
        loadError["error: string | null"]
        automStats["automationStats: Record"]
    end
    
    subgraph zonesStore
        zones["zones: Zone[]<br/>(localStorage)"]
    end
    
    vaultStore -->|"HAClient(url, token)"| HAClient["🔌 HAClient"]
    HAClient -->|"getStates()<br/>getConfig()<br/>..."| HA["Home Assistant"]
    HA -->|"HaStateRaw[]"| Parser["📦 Normalizer"]
    Parser -->|"Inventory"| inventoryStore
    
    zonesStore -->|"Almacena"| Zone["Zonas<br/>Personalizadas"]
```

## 📡 Integraciones LLM - Arquitectura

```mermaid
graph TB
    AgenteTab["AgenteTab<br/>(UI)"]
    
    AgenteTab -->|"llmConfig"| Dispatcher["LLM Dispatcher<br/>(llmProviders.ts)"]
    
    Dispatcher -->|"if provider === 'openai'"| OpenAI["OpenAI Client<br/>SDK"]
    Dispatcher -->|"if provider === 'claude'"| Claude["Anthropic Client<br/>SDK"]
    Dispatcher -->|"if provider === 'ollama'"| Ollama["Ollama<br/>OpenAI-compat"]
    Dispatcher -->|"if provider === 'llmstudio'"| LLMStudio["LLMStudio<br/>OpenAI-compat"]
    
    OpenAI -->|"POST /v1/chat/completions"| OpenAIAPI["api.openai.com"]
    Claude -->|"POST /messages"| ClaudeAPI["api.anthropic.com"]
    Ollama -->|"POST /v1/chat/completions"| OllamaAPI["localhost:11434"]
    LLMStudio -->|"POST /v1/chat/completions"| LLMStudioAPI["localhost:1234"]
    
    OpenAIAPI & ClaudeAPI & OllamaAPI & LLMStudioAPI -->|"Model Response<br/>(+ tool calls)"| Dispatcher
    
    Dispatcher -->|"toolCalls?"| Tools["haTools.ts<br/>(20+ tools)"]
    Tools -->|"executeHaTool()"| HA["HAClient<br/>(Home Assistant)"]
    HA -->|"State/Config/Services"| Tools
    Tools -->|"Tool Results"| Dispatcher
    
    Dispatcher -->|"LlmResponse"| AgenteTab
```

## 📊 Pipeline de Exportación

```mermaid
graph TB
    ExportDialog["ExportDialog<br/>(UI)"]
    
    ExportDialog -->|"ExportOptions"| Exporter["exporters.ts"]
    
    subgraph Options
        Sections["Secciones<br/>(automations, sensors, etc)"]
        SlimMode["Slim Mode<br/>(strip attributes)"]
    end
    
    Exporter -->|"inventory + zones"| Format{Format?}
    Format -->|"Excel"| XLSX["XLSX Workbook"]
    Format -->|"JSON"| JSON["JSON String"]
    
    XLSX -->|"Workbook.write()"| File1["Descarga .xlsx"]
    JSON -->|"Stringify()"| File2["Descarga .json"]
    
    subgraph XLSXSheets
        Summary["Resumen"]
        Automations["Automatizaciones"]
        Sensors["Sensores"]
        Actuators["Actuadores"]
        Zones["Zonas"]
    end
    
    XLSX -.->|"Múltiples hojas"| XLSXSheets
```

## 🔌 Proxy en Desarrollo

```mermaid
graph LR
    Browser["🌐 Browser<br/>http://localhost:5173"]
    ViteServer["Vite Dev Server"]
    Plugin["haProxyPlugin<br/>(Middleware)"]
    
    Browser -->|"/ha-proxy/api/*<br/>+ X-HA-Base header"| ViteServer
    ViteServer -->|Intercepta| Plugin
    Plugin -->|Normaliza headers<br/>Resuelve URL target| Router{Protocolo?}
    
    Router -->|"https:"| HTTPS["httpRequest<br/>(SSL)"]
    Router -->|"http:"| HTTP["httpRequest"]
    
    HTTPS & HTTP -->|"Proxy a"| HAServer["Home Assistant<br/>Backend"]
    HAServer -->|Response| Plugin
    Plugin -->|"headers limpios"| Browser
```

## 🛡️ Modelo de Seguridad

```mermaid
graph TB
    User["👤 Usuario"]
    App["HA Analyst Tools<br/>(Browser)"]
    
    User -->|"HA URL<br/>Token"| App
    
    subgraph Storage
        LocalStorage["localStorage<br/>(HA URL only)"]
        SessionStorage["sessionStorage<br/>(Token)"]
    end
    
    App -->|"Persiste"| LocalStorage
    App -->|"Persiste"| SessionStorage
    
    LocalStorage -->|"⚠️ Visible en DevTools<br/>⚠️ Persiste entre sesiones"| Warning1["No sensible"]
    SessionStorage -->|"✅ Limpiado al cerrar tab<br/>✅ No accesible entre tabs"| Safe1["Seguro"]
    
    App -->|"Authorization: Bearer"| HAServer["Home Assistant"]
    HAServer -->|"✅ HTTPS recomendado<br/>✅ Token en header"| Safe2["Seguro"]
    
    App -->|"si dev: proxy Vite<br/>si prod: nginx proxy"| CORS["CORS Handling"]
```

## 🗂️ Estructura de Directorios Detallada

```
src/
├── components/
│   ├── layout/
│   │   └── AppShell.tsx ← Raíz, navegación de tabs
│   │
│   ├── tabs/
│   │   ├── VaultTab.tsx ← Conexión, URL, token
│   │   ├── ResumenTab.tsx ← Dashboard con KPIs + tabla
│   │   ├── ExplorerTab.tsx ← Búsqueda entidades
│   │   ├── AutomacionesTab.tsx ← Listado automatizaciones
│   │   ├── ZonasTab.tsx ← Gestión zonas custom
│   │   ├── AgenteTab.tsx ← Chat + tools IA
│   │   └── HaApiTab.tsx ← Explorer API manual
│   │
│   └── ui/
│       ├── badge.tsx ← Etiquetas
│       ├── button.tsx ← Botones
│       ├── card.tsx ← Contenedores
│       ├── input.tsx ← Text inputs
│       ├── select.tsx ← Dropdowns
│       ├── textarea.tsx ← Text areas
│       └── ExportDialog.tsx ← Modal exportación
│
├── lib/
│   ├── haApi.ts ← Cliente REST HA (HAClient)
│   ├── haTools.ts ← Definiciones de tools (20+ tools MCP)
│   ├── llmProviders.ts ← Dispatcher LLM + integraciones
│   ├── exporters.ts ← Excel + JSON export logic
│   └── utils.ts ← Helpers (tokenCount, etc)
│
├── store/
│   ├── vaultStore.ts ← Zustand: url, token, connected
│   ├── inventoryStore.ts ← Zustand: inventory cache
│   └── zonesStore.ts ← Zustand: custom zones
│
├── types/
│   └── ha.ts ← Todas las interfaces TypeScript
│
├── App.tsx ← Router de tabs
├── main.tsx ← Entry point React
└── index.css ← Estilos globales
```

## 🔗 Dependencias y Su Rol

```mermaid
graph TB
    App["App.tsx"]
    
    subgraph UI["🎨 UI Layer"]
        React["react 18.3.1"]
        ReactDOM["react-dom 18.3.1"]
        Tailwind["tailwindcss 3.4"]
        RadixUI["@radix-ui/* 1.x<br/>(dialog, select, tabs, tooltip)"]
        LucideIcons["lucide-react 1.7"]
    end
    
    subgraph State["🗄️ State"]
        Zustand["zustand 5.0<br/>(+ persist middleware)"]
    end
    
    subgraph Logic["⚙️ Logic"]
        TypeScript["typescript 5.6<br/>(type safety)"]
        Utils["clsx<br/>class-variance-authority<br/>tailwind-merge"]
    end
    
    subgraph LLM["🤖 LLM Integration"]
        OpenAI["openai 6.33"]
        Anthropic["@anthropic-ai/sdk 0.86"]
    end
    
    subgraph Export["📥 Export"]
        XLSX["xlsx 0.18"]
    end
    
    App -->|"Renders"| UI
    App -->|"Uses"| State
    State -->|"Type-safe"| Logic
    LLM -->|"Model APIs"| Logic
    Export -->|"Generate files"| Logic
```

## 📈 Ciclo de Vida de Componente Tab

```mermaid
sequenceDiagram
    participant App
    participant Tab as TabComponent
    participant Store
    participant Service
    participant API
    
    App->>Tab: Monta (setActiveTab)
    Tab->>Tab: useState() inicializa
    Tab->>Tab: useEffect[] (mount)
    Tab->>Store: Lee estado inicial
    Tab->>Service: Inicia carga si needed
    Service->>API: fetch datos
    API->>Service: Response
    Service->>Store: Actualiza estado
    Store->>Tab: Re-render (hook)
    Tab->>Tab: Renderiza UI
    App->>Tab: Usuario interactúa
    Tab->>Service: Ejecuta acción
    Service->>API: fetch
    API->>Service: Response
    Service->>Store: setData()
    Store->>Tab: Re-render
    App->>Tab: setActiveTab(otro)
    Tab->>Tab: useEffect cleanup
    Tab->>Tab: Unmount
```

---

## 📊 Matriz de Características por Pestaña

| Feature | Vault | Resumen | Explorer | Automaciones | Zonas | Agente | HaApi |
|---------|-------|---------|----------|--------------|-------|--------|-------|
| Conexión HA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offline JSON | ✅ | - | - | - | - | - | - |
| Dashboard KPIs | - | ✅ | - | - | - | - | - |
| Tabla Filtrable | - | ✅ | ✅ | - | - | - | - |
| Buscar Entidades | - | ✅ | ✅ | - | - | - | - |
| Tool Calling | - | - | - | - | - | ✅ | - |
| Context Mgmt | - | - | - | - | - | ✅ | - |
| Exportar | - | ✅ | ✅ | ✅ | ✅ | - | - |
| Custom Zones | - | - | - | - | ✅ | ✅ | - |
| API Explorer | - | - | - | - | - | - | ✅ |

---

**Nota:** Todos los diagramas son conceptuales. Los números de versión y URLs son actuales al 2026-06-05.
