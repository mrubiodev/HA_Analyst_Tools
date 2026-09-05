# hass_get_me_info

Aplicación web para explorar, analizar y documentar instalaciones de **Home Assistant** desde el navegador, sin necesidad de instalar nada en el servidor.

## Visión general

HA Analyst Tools nace para convertir un inventario de Home Assistant en una herramienta operativa, legible y útil para diagnósticos, auditoría y documentación.

Permite conectar con una instancia real de HA, inspeccionar entidades, automatizaciones, zonas y scripts, y exportar la información en formato práctico para trabajar o compartir conocimiento.

Es útil tanto para usuarios avanzados que quieren entender mejor su instalación como para profesionales que necesitan auditar automatizaciones o documentar un sistema domótico sin depender de un entorno local complejo.

## Guía rápida

1. Abre la pestaña **Vault**.
2. Introduce la URL de tu instancia de Home Assistant.
3. Pega tu **Long-Lived Access Token**.
4. Pulsa **Conectar**.
5. Explora el inventario desde **Resumen**, **Explorer**, **Automatizaciones**, **Zonas** y **API HA**.
6. Si necesitas documentación, usa **Exportar** para generar un fichero útil en Excel, JSON o Markdown.

## Funcionalidades

- **Vault** — Conexión a cualquier instancia de Home Assistant mediante URL + Long-Lived Access Token. También admite carga offline de un JSON exportado previamente.
- **Resumen** — KPIs y tabla filtrable de todas las entidades. Haz clic en cualquier indicador (automatizaciones activas, entidades no disponibles, actuadores encendidos…) para filtrar la tabla al instante.
- **Explorer** — Búsqueda y exploración detallada de entidades por dominio, área o estado.
- **Automatizaciones** — Listado con estado, modo y última ejecución de cada automatización.
- **Zonas físicas** — Agrupa entidades por espacio físico (habitación, planta, fachada…). Las zonas son completamente personalizables: nombre, tipo (interior / fachada exterior / mixta), orientación y notas. También permite importar las áreas directamente desde HA.
- **Agente IA** — Consulta tu instalación usando OpenAI, Anthropic, OmniRoute, Ollama o LLMStudio.
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

- **Proveedores soportados** — OpenAI, Anthropic, OmniRoute, Ollama y LLMStudio.
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

## Integración con OmniRoute

La integración con **OmniRoute** usa su API compatible con OpenAI para enrutar el chat hacia los proveedores y modelos configurados en el gateway.

- URL base local por defecto: `http://localhost:20128/v1`.
- Modelo por defecto: `auto`, para usar el enrutamiento automático y fallback de OmniRoute.
- La API key es opcional para una instancia local sin autenticación; si el gateway la exige, se introduce desde la configuración del agente.
- El listado de modelos se detecta desde `/v1/models` y se mantienen disponibles las herramientas nativas del agente.

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
- El token de acceso se guarda en **sessionStorage** para reducir el riesgo de persistencia en el navegador. Se recomienda limpiar sesión cuando se deje de usar la herramienta.

## Seguridad y privacidad

Esta app se diseñó con una mentalidad de mínima exposición:

- no se recomienda introducir tokens en equipos compartidos;
- la conexión a HA debe hacerse con permisos mínimos necesarios;
- los datos sensibles no deben compartirse en capturas ni exportaciones públicas;
- se recomienda cerrar o limpiar la sesión al terminar cada trabajo.

## Configuración de CORS

En modo desarrollo el proxy de Vite evita los errores de CORS automáticamente. En producción, la aplicación estática contacta directamente con Home Assistant, por lo que HA debe permitir el origen desde el que se abre la aplicación:

```yaml
http:
  cors_allowed_origins:
    - "http://localhost:5173"
    - "https://hasstools.mrubiodev.com"
```

Reinicia Home Assistant después de cambiar `configuration.yaml`. La URL configurada en Vault también debe usar `https://`, por ejemplo `https://hass.local`; una aplicación publicada con HTTPS no puede acceder directamente a una URL HTTP.

