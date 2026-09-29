# HA Analyst Tools

> Aplicación web para analizar y documentar instalaciones de Home Assistant desde el navegador.

![Estado](https://img.shields.io/badge/estado-Activo-2ea44f)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-REST%20API-41BDF5?logo=homeassistant&logoColor=white)

## Resumen

Aplicación web de análisis y documentación para instalaciones de Home Assistant. Se ejecuta en el navegador, consulta la API REST de HA y reúne el inventario, las herramientas de auditoría, la exploración de la API y un agente de IA en una sola interfaz.

## Funciones

- **Vault:** conecta con Home Assistant usando la URL de la instancia y un Long-Lived Access Token, o carga un inventario JSON exportado previamente.
- **Resumen:** muestra indicadores del inventario y una tabla de entidades con filtros por columnas, reglas y búsqueda.
- **Explorer:** permite localizar entidades y consultar sus estados y atributos.
- **Automatizaciones:** filtra automatizaciones por nombre, estado y modo, y muestra datos como última ejecución.
- **Zonas:** crea zonas físicas, asigna entidades y guarda la organización en el almacenamiento local del navegador.
- **Agente IA:** trabaja con OpenAI, Anthropic/Claude, OpenRouter, OmniRoute, Ollama y LM Studio. Permite elegir qué inventario incluir en el contexto y consultar HA con herramientas.
- **API HA:** explora estados, servicios, historial, logbook, eventos, sistema, plantillas, calendarios e intents.
- **Exportación:** genera Excel o JSON por secciones y con modo ligero. La tabla del Resumen también puede exportarse a Markdown.

## Conexión y datos

Para conectar la aplicación, introduce la URL completa de Home Assistant y un Long-Lived Access Token con los permisos necesarios. En desarrollo, Vite usa un proxy; en una aplicación publicada, el navegador se conecta directamente a Home Assistant y la instancia debe permitir el origen web mediante CORS.

La URL se conserva en `localStorage`. El token de Home Assistant y la configuración del agente se guardan en `sessionStorage` de la pestaña. Si usas un proveedor de IA remoto, se envían a ese proveedor los mensajes y el contexto que hayas incluido en la conversación. Los proveedores locales envían las solicitudes a la dirección configurada.

> **Acciones del agente:** el agente incluye herramientas de lectura y herramientas que pueden ejecutar servicios, emitir eventos o actualizar estados de HA. Habilita las acciones solo cuando quieras permitir cambios en tu instalación. La pestaña API HA también incluye operaciones POST.

## Límites actuales

- La conexión online carga estados de entidades. El cliente REST todavía no obtiene el registro de áreas ni el registro de entidades de HA; por ello, la importación automática de áreas puede aparecer vacía. Puedes crear zonas manualmente. Un inventario JSON sí puede conservar áreas si las incluye.
- La API REST y las funciones disponibles dependen de los permisos del token y de la versión/configuración de Home Assistant.
- El inventario offline debe ser un JSON completo compatible con el modelo de inventario de la aplicación.

## Desarrollo local

Necesitas Node.js y npm. En Windows puedes usar:

~~~bat
run-local.bat
~~~

O ejecutar los comandos desde la raíz del repositorio:

~~~bash
npm ci
npm run dev
~~~

Vite inicia el servidor de desarrollo en `http://localhost:5173`.

## Docker

Con Docker instalado, ejecuta desde PowerShell:

~~~powershell
.\run.ps1
~~~

La aplicación queda disponible en `http://localhost:8080`. La imagen compila el frontend y lo sirve con nginx.

## CORS en Home Assistant

En desarrollo, el proxy de Vite evita configurar CORS para el servidor local. En producción, añade el origen exacto desde el que sirves la aplicación en `configuration.yaml` y reinicia Home Assistant:

~~~yaml
http:
  cors_allowed_origins:
    - "https://tu-dominio.example"
~~~

Una página HTTPS no puede llamar a una instancia HTTP desde el navegador; sirve Home Assistant también por HTTPS.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, Zustand y Radix UI. Las exportaciones Excel usan SheetJS (`xlsx`). Las integraciones de IA se conectan desde el navegador al proveedor configurado.

## Privacidad

No compartas capturas ni exportaciones que contengan datos sensibles de tu instalación. Usa un token con los permisos mínimos que necesites, evita introducirlo en equipos compartidos y limpia la sesión al terminar.
