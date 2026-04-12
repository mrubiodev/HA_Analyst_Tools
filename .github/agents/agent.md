---
name: repo-assistant
description: "Agente personalizado para tareas específicas del repositorio: creación/actualización de archivos de configuración, plantillas y revisiones rápidas. Cargar solo cuando la tarea sea sobre archivos del proyecto."
applyTo:
  - "src/**"
  - ".github/**"
  - "package.json"
entrypoint: |
  Usa este agente para cambios automáticos y asistidos en el repositorio. Sigue las instrucciones explícitas del usuario y solicita confirmación antes de hacer cambios destructivos.
capabilities:
  - read
  - write
  - ask-questions
  - run-subagent
---

# Uso

- `description`: explica cuándo debe cargarse este agente.
- `applyTo`: patrones glob que limitan cuándo se añade al contexto.
- `entrypoint`: breve instrucción de alto nivel para el agente.

# Ejemplos de prompts

- "Crea un archivo de configuración en `.github/workflows` para CI".
- "Corrige importaciones no usadas en `src/` y genera un resumen de cambios".

# Buenas prácticas

- Evita `applyTo: "**"` salvo que quieras que el agente se cargue siempre.
- Mantén `description` con palabras clave que permitan al sistema encontrarlo.
- Pide confirmación antes de commits o cambios masivos.
