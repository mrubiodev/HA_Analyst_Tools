# HA Analyst Tools - Guía de Desarrollo y Checklists

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js 18+
- npm o yarn
- Home Assistant 2024+ (para testing)
- (Opcional) Docker para build de producción

### Setup Inicial
```bash
# Clonar/abrir repositorio
cd HA_Analyst_Tools

# Instalar dependencias
npm install

# Iniciar dev server
npm run dev

# Abrir browser
open http://localhost:5173
```

### Test con Home Assistant Local
1. Obtener Long-Lived Access Token desde HA
2. En VaultTab, ingresar URL y token
3. Clica "Conectar"
4. Navega a Resumen para ver dashboard

---

## 🔧 Desarrollo Diario

### Estructura para Agregar Nueva Funcionalidad

#### 1. Nueva Pestaña
```typescript
// src/components/tabs/NewTab.tsx
import { useState } from 'react'
import { useVaultStore } from '@/store/vaultStore'
import { Card } from '@/components/ui/card'

export function NewTab() {
  const { connected } = useVaultStore()
  
  if (!connected) {
    return <div>Por favor conecta primero en Vault</div>
  }
  
  return (
    <div className="p-4">
      <Card>
        <h1>Nueva Funcionalidad</h1>
      </Card>
    </div>
  )
}
```

```typescript
// src/App.tsx - agregar
import { NewTab } from '@/components/tabs/NewTab'

type Tab = '...' | 'new'

// En AppShell
{activeTab === 'new' && <NewTab />}
```

#### 2. Nuevo Store
```typescript
// src/store/newStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NewState {
  data: unknown
  setData: (d: unknown) => void
}

export const useNewStore = create<NewState>()(
  persist(
    (set) => ({
      data: null,
      setData: (data) => set({ data }),
    }),
    { name: 'new-store' }
  ),
)
```

#### 3. Nuevo Servicio
```typescript
// src/lib/newService.ts
import type { HAClient } from '@/lib/haApi'

export async function doSomething(client: HAClient): Promise<string> {
  // Lógica aquí
  return 'resultado'
}
```

### Convenciones de Código

#### Naming
- Archivos: `camelCase.ts` o `PascalCase.tsx` (componentes)
- Variables: `camelCase`
- Tipos/Interfaces: `PascalCase`
- Constantes: `UPPER_CASE`
- Archivos de componentes: `PascalCase`
- Archivos de tipos: `types.ts`

#### Estructura de Archivo
```typescript
// Imports primero
import type { Type } from '@/types'
import { Component } from '@/components'

// Tipos/Interfaces
interface MyState {}

// Funciones helper
function helperFn() {}

// Componente/Export principal
export function MyComponent() {}
```

#### Estilos
- Usar `clsx()` para clases condicionales
- Usar Tailwind directamente (no CSS modules)
- Componentes UI: usar Radix UI
- Colores: consultar `tailwind.config.js`

```typescript
import { clsx } from 'clsx'

<div className={clsx(
  'p-4',
  condition && 'bg-red-500',
  isActive ? 'opacity-100' : 'opacity-50'
)}>
```

#### Type Safety
- Siempre tipar props
- Usar `Record<string, T>` en lugar de `any`
- Interfaces explícitas para objetos

```typescript
interface Props {
  items: Item[]
  onSelect: (item: Item) => void
  loading?: boolean
}

export function MyComponent({ items, onSelect, loading = false }: Props) {}
```

---

## 🧪 Testing y Validación

### Pre-Commit Checklist
```bash
# 1. Lint el código
npm run lint

# 2. Build check
npm run build

# 3. Prueba en dev
npm run dev
# - Prueba conexión a HA
# - Prueba navegación entre tabs
# - Prueba exportación
```

### Testing Manual Completo

#### Setup
- [ ] Conectar a instancia HA actual
- [ ] Cargar inventario
- [ ] Verificar sin errores en console

#### Por Pestaña
- [ ] **Vault**: Conexión OK, token seguro
- [ ] **Resumen**: KPIs correctos, tabla filtra
- [ ] **Explorer**: Búsqueda por dominio/área funciona
- [ ] **Automatizaciones**: Lista y estado correcto
- [ ] **Zonas**: Crear, editar, borrar zona custom
- [ ] **Agente**: Chat responde, tools ejecutan
- [ ] **HaApi**: Requests HTTP manuales funcionan

#### Exportación
- [ ] Exportar a Excel (completo)
- [ ] Exportar a JSON (completo)
- [ ] Exportar slim (sin attributes)
- [ ] Seleccionar secciones parciales

#### Edge Cases
- [ ] HA desconectado → error graceful
- [ ] Inventario vacío → UI no quebrada
- [ ] Token expirado → pedir reconexión
- [ ] Salir/volver a tab → estado preservado

---

## 🐛 Debugging

### Browser DevTools

#### Console
```javascript
// Inspeccionar stores
localStorage.getItem('ha-vault')  // URL (sin token)
sessionStorage.getItem('ha-token') // Token

// Importar y usar stores manualmente
const { getState } = await import('./store/inventoryStore.js')
getState().inventory
```

#### Performance
- Devtools → Performance tab
- Recording antes/después de acciones
- Check: Main thread no bloqueado >16ms

#### Network
- Devtools → Network tab
- Filter: `/ha-proxy` (dev requests)
- Check: Headers `X-HA-Base` presentes
- Check: Authorization headers enviados

### Vite Debug
```bash
# Terminal donde corre dev server
[ha-proxy] GET /api/states - X-HA-Base: http://192.168.1.100:8123
[ha-proxy] GET /api/config - X-HA-Base: http://192.168.1.100:8123
```

### Logs Útiles para Agregar
```typescript
// Durante desarrollo
console.debug('[VaultTab] Conectando a:', url)
console.error('[HAClient] Error:', error.message)
console.log('[AgenteTab] Tool call:', toolName, args)
```

---

## 📦 Build y Deployment

### Desarrollo
```bash
npm run dev
# → http://localhost:5173
# → Hot reload automático
# → Source maps incluidos
```

### Build Local
```bash
npm run build
# → dist/ folder
npm run preview
# → http://localhost:4173
# → Simula producción
```

### Docker Build
```powershell
# Windows PowerShell
./run.ps1
# → Builds Dockerfile
# → Corre nginx + app
# → http://localhost:8080
```

### Optimizaciones Build
- Tree-shaking automático
- Chunk splitting por rutas
- CSS minificado
- Assets optimizados

---

## 📋 Checklist para Release

### Pre-Release
- [ ] No errores en `npm run build`
- [ ] No warnings en ESLint
- [ ] TypeScript clean (`npm run build` paso 1)
- [ ] Todas las features funcionales testeadas
- [ ] README.md actualizado
- [ ] PROJECT_STATUS.md actualizado
- [ ] ARCHITECTURE.md actualizado

### Testing Final
- [ ] Conexión HA (real instance)
- [ ] Todas las 7 pestañas funcionales
- [ ] Exportación (Excel + JSON)
- [ ] Agente con múltiples proveedores
- [ ] Offline JSON load funciona
- [ ] Responsive design (mobile + desktop)

### Post-Release
- [ ] Tag git con versión
- [ ] Update package.json version
- [ ] Update CHANGELOG

---

## 🎓 Aprendizaje del Codebase

### Ruta Recomendada de Lectura
1. **Inicio** → `README.md` (20 min)
2. **Arquitectura** → `ARCHITECTURE.md` (30 min)
3. **Types** → `src/types/ha.ts` (15 min)
4. **Core** → `src/lib/haApi.ts` (20 min)
5. **UI** → `src/components/tabs/VaultTab.tsx` (15 min)
6. **State** → `src/store/vaultStore.ts` (10 min)
7. **Features** → Explora por interés

### Key Concepts

#### HAClient
```typescript
// Cliente REST que abstrae HA API
const client = new HAClient(url, token)
const states = await client.getStates()
// Auto-usa proxy en dev, directo en prod
```

#### Zustand Store
```typescript
// State management con persistencia
const { inventory, loading } = useInventoryStore()
// Auto-persiste en localStorage
```

#### Tool Calling
```typescript
// LLM puede ejecutar funciones (Tools)
// Modelo: "Necesito llamar ha_get_states"
// App: Ejecuta tool, retorna resultado
// Modelo: Usa resultado para responder
```

#### Normalización
```typescript
// HA API raw → tipos internos normalizados
HaStateRaw → HaEntity (classify, parse)
```

---

## 🔐 Seguridad - Guía para Devs

### Nunca
- ❌ Commitar tokens o URLs
- ❌ Logar tokens en console
- ❌ Enviar credenciales en query params
- ❌ Usar eval() o innerHTML con datos externos

### Siempre
- ✅ Usar Headers de Authorization
- ✅ Validar respuestas de API
- ✅ Usar Strict TypeScript
- ✅ Sanitize URLs antes de usarlas
- ✅ Usar sessionStorage para datos sensibles

### CORS
- Desarrollo: Vite proxy automático
- Producción: nginx proxy (ver nginx.conf)
- Local testing: puede necesitar CORS en HA config.yaml

---

## 📚 Recursos Útiles

### Documentación
- [TypeScript](https://www.typescriptlang.org/docs/)
- [React Hooks](https://react.dev/reference/react)
- [Zustand](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/docs)
- [Home Assistant API](https://developers.home-assistant.io/docs/api/rest)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)

### Dev Tools
- VS Code: ESLint + Prettier extensions
- TypeScript: Strict mode habilitado
- React DevTools: Para inspeccionar componentes
- Redux DevTools: Para inspeccionar Zustand stores

---

## 🐞 Troubleshooting Común

### "X-HA-Base header missing"
**Problema:** Request al proxy sin header  
**Solución:** Verificar que en dev mode, la app usa `/ha-proxy/` en lugar de URL directa
```typescript
// ❌ Malo
const url = `${baseUrl}/api/states`

// ✅ Bien
const url = isDev ? `/ha-proxy/api/states` : `${baseUrl}/api/states`
```

### "CORS error"
**Problema:** Browser bloquea request  
**Solución:** 
- Dev: Ya proxeado, verificar header X-HA-Base
- Prod: Revisar nginx.conf o configurar CORS en HA

### "Token expirado"
**Problema:** 401 Unauthorized  
**Solución:** Generar nuevo token en HA (Settings → Companion → Long-Lived Tokens)

### "Inventario vacío"
**Problema:** Cargar devuelve array vacío  
**Solución:**
- Verificar conexión (test ping)
- Verificar token tiene permisos
- Revisar console para error específico

### "UI no actualiza"
**Problema:** Component renderiza pero no actualiza  
**Solución:**
- Verificar que store action fue llamado
- Check: useEffect dependencies correctas
- Usar React DevTools para ver re-renders

---

## 🎯 Próximas Features Potenciales

### Prioridad Alta
- [ ] Tema dark/light con persistencia
- [ ] Búsqueda global fuzzy
- [ ] Favoritos de entidades
- [ ] Historial de cambios

### Prioridad Media
- [ ] Alertas y monitoreo
- [ ] Scripts batch de acciones
- [ ] Backups automáticos
- [ ] Más proveedores LLM

### Prioridad Baja
- [ ] PWA (offline primero)
- [ ] Mobile app nativa
- [ ] Sincronización multi-device
- [ ] Marketplace de zonas compartidas

---

## 📝 Checklist de Code Review

Cuando revises código:
- [ ] TypeScript tipos completos
- [ ] No `any` types sin justificación
- [ ] Imports organizados y limpios
- [ ] Componentes pequeños y reutilizables
- [ ] Props tipiadas explícitamente
- [ ] Error handling presente
- [ ] Loading states considerados
- [ ] Estilos con Tailwind (no CSS custom)
- [ ] No logica de business en componentes (usar servicios)
- [ ] Comments para lógica no obvia
- [ ] Nombres descriptivos (variables, funciones)

---

## 🎊 ¡A Programar!

El proyecto está listo para desarrollo. Sigue estas guías y mantén la consistencia.

**Preguntas frecuentes:**
- "¿Dónde agrego...?" → Revisa ARCHITECTURE.md
- "¿Cómo conecto a...?" → Revisa ejemplo en VaultTab.tsx
- "¿Cómo exporto...?" → Revisa exporters.ts
- "¿Cómo uso LLM...?" → Revisa AgenteTab.tsx

Happy coding! 🚀
