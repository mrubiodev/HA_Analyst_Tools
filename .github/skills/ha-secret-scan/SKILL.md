---
name: ha-secret-scan
description: "Escaneo profundo de secretos y configuración sensible. Use cuando se solicite: 'escaneo de secretos', 'análisis de seguridad', 'revisar información privada'."
---

# SKILL: HA Secret Scan

Descripción
- Al invocarse, realiza un análisis profundo del repositorio para detectar posibles secretos, credenciales expuestas y malas prácticas de seguridad relacionadas con la configuración.

Qué hace (resumen de pasos)
1. Escanea todo el árbol de ficheros (incluyendo archivos ignorados y `dist`, `node_modules`, `.git`) en busca de patrones comunes: claves AWS, tokens JWT, cabeceras `Authorization: Bearer`, `x-api-key`, `sk-...`, `----BEGIN PRIVATE KEY----`, URIs de bases de datos, cadenas con `password=` y similares.
2. Revisa almacenamiento en cliente (ej. `sessionStorage`, `localStorage`) y usos de tokens en código fuente.
3. Inspecciona archivos de configuración (ej. `.env`, `package.json`, CI/CD y workflows) y detecta posibles variables sensibles inyectadas en build.
4. (Opcional) Escanea el historial Git en busca de secretos previamente comprometidos (requiere permiso del usuario para leer `.git`/historial).
5. Identifica artefactos construidos (`dist`) que puedan contener strings sensibles y recomienda regenerarlos/introspección.
6. Genera un informe con hallazgos: archivo/ruta, fragmento coincidente (maskado), riesgo estimado y acciones recomendadas.

Salida esperada
- Lista priorizada de hallazgos con ubicación y nivel de riesgo.
- Acciones inmediatas sugeridas: rotar claves, limpiar historial, eliminar archivos públicos, añadir `.gitignore`, e implementar hooks pre-commit.

Requisitos y permisos
- Para escaneo de historial Git o acceso a `.git` se solicitará permiso explícito.

Configuración y no hardcodear
- Esta SKILL debe leer opciones desde un archivo de configuración en `.github/agents/agent-config.yaml` cuando esté disponible. Si no existe, usará valores por defecto contenidos aquí.
- Parámetros recomendados en la configuración (ver `.github/agents/agent-config.example.yaml`):
	- `scan.include_ignored`, `scan.include_node_modules`, `scan.include_dist`, `scan.include_git_history`.
	- `token_storage_key`, `session_storage`.
	- `report_path`, `mask_show_first`.
- Nunca embedear claves en la SKILL; usar variables de entorno en CI o `sessionStorage`/vault en tiempo de ejecución.

Frases de activación (sugeridas)
- "Haz un escaneo profundo de secretos"
- "Analiza la seguridad del repositorio" 
- "Busca credenciales expuestas y recomendaciones"

Notas de seguridad
- Nunca incluirá ni devolverá en el informe secretos completos sin solicitación explícita; los valores se mostrarán parcialmente maskados (p.ej. `AKIA************ABCD`).
- Cuando se encuentre evidencia de secreto en remoto o histórico, recomendará rotación inmediata.

Herramientas recomendadas (no instaladas por el agente)
- `git-secrets`, `detect-secrets`, `truffleHog`, `gitleaks` para integrarlo en CI / pre-commit.

---

