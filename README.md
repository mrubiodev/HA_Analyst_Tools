# hass_get_me_info

Aplicación web para explorar, analizar y documentar instalaciones de **Home Assistant** desde el navegador, sin necesidad de instalar nada en el servidor.

## Funcionalidades

- **Vault** — Conexión a cualquier instancia de Home Assistant mediante URL + Long-Lived Access Token. También admite carga offline de un JSON exportado previamente.
- **Resumen** — KPIs y tabla filtrable de todas las entidades. Haz clic en cualquier indicador (automatizaciones activas, entidades no disponibles, actuadores encendidos…) para filtrar la tabla al instante.
- **Explorer** — Búsqueda y exploración detallada de entidades por dominio, área o estado.
- **Automatizaciones** — Listado con estado, modo y última ejecución de cada automatización.
- **Zonas físicas** — Agrupa entidades por espacio físico (habitación, planta, fachada…). Las zonas son completamente personalizables: nombre, tipo (interior / fachada exterior / mixta), orientación y notas. También permite importar las áreas directamente desde HA.
- **Agente IA** — Consulta tu instalación usando OpenAI, Anthropic, Ollama o LLMStudio.
- **API HA** — Pestaña dedicada para explorar manualmente endpoints y operaciones habituales de Home Assistant desde la propia app.
- **Exportación flexible** — Exporta a Excel o JSON eligiendo qué secciones incluir y activando el **modo ligero** (elimina `attributes` y timestamps para reducir el tamaño del fichero hasta 10×).

## Pestañas disponibles

- **Vault** — Configuración de conexión, token y carga offline.
- **Resumen** — Vista global del inventario con filtros rápidos.
- **Explorer** — Navegación detallada por entidades.
- **Automatizaciones** — Auditoría rápida de automatizaciones.
- **Zonas físicas** — Organización espacial personalizada.
- **Agente IA** — Chat con contexto opcional y herramientas en tiempo real.
- **API HA** — Exploración manual de APIs de Home Assistant.

## Agente IA

El agente ha evolucionado para trabajar bien con modelos remotos y locales, incluyendo flujos con tool calling imperfecto.

- **Proveedores soportados** — OpenAI, Anthropic, Ollama y LLMStudio.
- **Herramientas en tiempo real** — Puede consultar Home Assistant en directo para estados, entidades, plantillas y otras operaciones de lectura. También puede habilitarse el modo de acciones si quieres permitir llamadas que cambien estado.
- **Contexto vacío por defecto** — Al abrir el chat no se incluye inventario automáticamente. El usuario decide qué partes añadir al prompt.
- **Selección granular de contexto** — Puedes incluir o excluir automatizaciones, entidades, áreas y grupos, además de limitar el nivel de detalle enviado.
- **Compresión automática** — Si la conversación crece demasiado, la app resume mensajes anteriores para evitar desbordar la ventana de contexto.
- **Visibilidad de consumo** — El chat muestra cuánto ocupan las instrucciones, el resumen acumulado y los mensajes vivos, junto con el presupuesto disponible.
- **Métricas de respuesta** — Cada respuesta puede mostrar fecha, hora, tokens de entrada y salida, velocidad en tokens por segundo y tiempo total de respuesta cuando el proveedor lo expone.
- **Trazas del agente** — Las llamadas a herramientas se muestran en bloques expandibles para ver argumentos, resultados y secuencia de consultas realizadas.

## Integración con LLMStudio

La integración con **LLMStudio** está orientada a modelos locales con contexto amplio y tool calling heterogéneo.

- Usa el endpoint compatible OpenAI de LLMStudio para chat completions.
- Detecta modelos disponibles automáticamente desde `/api/v1/models` o `/v1/models`.
- Intenta descubrir el contexto real cargado del modelo a partir de metadatos como `loaded_context_length`, `max_context_length` y `loaded_instances[].config.context_length`.
- Calcula automáticamente el presupuesto efectivo de prompt y reserva margen para evitar problemas de contexto o `n_keep` en el backend.
- Permite definir un override manual del contexto y una reserva manual si quieres ajustar el comportamiento.

## Gestión de contexto

La aplicación intenta evitar que el chat consuma contexto innecesario o se vuelva frágil con modelos locales.

- El inventario no se envía salvo que el usuario lo seleccione.
- El histórico del chat se comprime automáticamente cuando supera el presupuesto objetivo.
- Los resultados de herramientas grandes se truncán para evitar que una sola consulta desborde la ventana disponible.
- La interfaz muestra una barra de ocupación con reparto entre instrucciones, resumen, mensajes y espacio libre.

## Compatibilidad con Home Assistant

- Conexión mediante URL base + **Long-Lived Access Token**.
- Soporte para inventario exportado en JSON para trabajar offline.
- Consultas en tiempo real mediante herramientas del agente y exploración manual en la pestaña **API HA**.
- Algunas rutas internas no expuestas directamente por HTTP en todas las instalaciones pueden no estar disponibles según la versión o configuración de Home Assistant.

## Desarrollo local

```bat
run-local.bat
```

Abre [http://localhost:5173](http://localhost:5173).

## Docker

```powershell
.\run.ps1
```

Abre [http://localhost:8080](http://localhost:8080).

## Notas de uso

- En desarrollo, Vite usa proxy para evitar problemas de CORS.
- En Docker, nginx actúa como proxy hacia Home Assistant y hacia los endpoints necesarios de la app.
- Para usar modelos locales, asegúrate de que **Ollama** o **LLMStudio** estén levantados y accesibles desde la URL configurada.
- Si el modelo local tiene limitaciones de contexto reales menores que las teóricas, conviene revisar en el panel del agente el valor de contexto cargado y la reserva configurada.

## Configuración de CORS (opcional)

En modo desarrollo el proxy de Vite evita los errores de CORS automáticamente. En producción (Docker), el contenedor nginx actúa como proxy. Si accedes directamente desde otro origen, añade a `configuration.yaml` de HA:

```yaml
http:
  cors_allowed_origins:
    - "http://localhost:5173"
    - "http://<IP_DE_TU_APP>"
```

