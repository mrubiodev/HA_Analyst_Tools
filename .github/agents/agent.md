---
name: repo-assistant
description: "Agente especializado en tareas específicas del repositorio: crear/actualizar archivos de configuración, plantillas, revisiones rápidas y ejecutar análisis de seguridad cuando se solicite. Incluye la SKILL `ha-secret-scan` para escaneos profundos de secretos."
applyTo:
  - "src/**"
  - ".github/**"
  - "package.json"
entrypoint: |
  Usa este agente para cambios automáticos y asistidos en el repositorio. Pregunta siempre antes de ejecutar acciones destructivas o de acceder al historial Git. Carga la SKILL de escaneo (`.github/skills/ha-secret-scan/SKILL.md`) cuando el usuario pida un análisis de secretos o seguridad.
capabilities:
  - read
  - write
  - ask-questions
  - run-subagent
skills:
  - ".github/skills/ha-secret-scan/SKILL.md"
---
# Guía de referencia para agentes (documentación)

Este documento explica las convenciones y campos clave que un archivo de agente (p. ej. `.github/agents/*.md`) debe contener, y qué debe saber un desarrollador o mantenedor al crear/agregar un agente al repositorio.

1) Frontmatter obligatorio y campos comunes
- `name`: identificador corto del agente.
- `description`: breve descripción clara de su propósito y cuándo debe cargarse.
- `applyTo`: lista de patrones glob que determinan cuándo el agente se añade al contexto (ej.: `src/**`, `.github/**`). Mantenerlo específico reduce ruido.
- `entrypoint`: instrucción de alto nivel para el agente (qué hacer por defecto).
- `capabilities`: permisos requeridos (`read`, `write`, `ask-questions`, `run-subagent`, etc.).
- `skills`: lista de rutas a SKILLs relacionadas (p. ej. `.github/skills/ha-secret-scan/SKILL.md`).

2) Diseño y buenas prácticas
- Mantén `description` con palabras clave que faciliten búsquedas (ej.: "escaneo de secretos", "CI", "formateo").
- Evita `applyTo: "**"` salvo que sea realmente necesario.
- Pregunta siempre antes de ejecutar cambios destructivos o de modificar el historial Git.
- Documenta las dependencias externas o herramientas que el agente pueda invocar.

3) Frases de activación y triggers
- Incluye en la documentación una sección de *Activadores* (frases que usuarios pueden usar para invocar el agente o su SKILL). Ejemplos:
  - "Analiza la seguridad del repositorio"
  - "Añade flujo CI para pruebas"
  - "Haz un escaneo profundo de secretos"

4) Integración con SKILLs
- Preferir separar lógica compleja en SKILLs (carpeta `.github/skills/<name>/SKILL.md`).
- En el frontmatter del agente, lista las SKILLs que pueda necesitar.
- En la documentación del agente indica claramente: ruta a la SKILL, qué hace y cuándo llamarla.

5) Seguridad y privacidad
- No exponer secretos completos en salidas automáticas; siempre mostrar valores maskados.
- Requerir permiso explícito para leer `.git`/historial antes de hacer un escaneo histórico.
- Recomendar rotación de claves y añadir herramientas de detección en CI si se detecta un secreto.

6) Plantillas y ejemplos
- Minimal agent frontmatter (ejemplo):

  ---
  name: my-agent
  description: "Descripción breve y activadores"
  applyTo:
    - "src/**"
  entrypoint: |
    Ejecuta tareas X y pide confirmación antes de cambios destructivos.
  capabilities:
    - read
    - write
  skills:
    - ".github/skills/example/SKILL.md"
  ---

7) Pruebas y despliegue
- Probar localmente con cambios no destructivos (simular salidas). 
- Si el agente aplicará commits automáticos, pedir confirmación y crear PRs en lugar de push directo.

8) Mantenimiento
- Mantener la lista de `skills` y las frases de activación sincronizadas entre la SKILL y el agente.
- Revisar permisos (`capabilities`) y minimizar privilegios.

9) Recursos recomendados
- Herramientas para seguridad: `detect-secrets`, `gitleaks`, `git-secrets`, `truffleHog`.
- Para CI/pre-commit: `pre-commit` + hooks para escaneo de secretos.

10) Cómo usar esta guía
- Copia las secciones relevantes para crear nuevos agentes en `.github/agents/`.
- Añade SKILLs en `.github/skills/` cuando el flujo sea multi-etapa o requiera assets propios.

11) Evitar valores hardcodeados

- Mantén la configuración fuera de los archivos del agente y SKILL: usa `.github/agents/agent-config.yaml` (no comitear credenciales reales).
- Para secretos y API keys usa variables de entorno en CI, o servicios de vault; nunca comitees valores reales.
- Ejemplos de valores movidos a config: rutas a SKILLs, claves de almacenamiento (`token_storage_key`), inclusiones de carpetas para escaneos (`include_dist`, `include_node_modules`), y comandos de CI/pre-commit.
- Hemos añadido un ejemplo: `.github/agents/agent-config.example.yaml`. Copia y personaliza a `.github/agents/agent-config.yaml`.

---

Si quieres, adapto este documento para incluir una plantilla firme para crear agentes específicos (p. ej. agente de CI, agente de formato, agente de seguridad) y ejemplos listos para pegar.
