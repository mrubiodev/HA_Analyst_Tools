import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Dev-only proxy: forwards /ha-proxy/<api-path> to the real HA server.
 * The caller sets the X-HA-Base header with the full HA origin so the
 * proxy target stays dynamic (user-entered at runtime).
 */
function haProxyPlugin(): Plugin {
  return {
    name: 'ha-proxy',
    configureServer(server) {
      server.middlewares.use('/ha-proxy', (req: IncomingMessage, res: ServerResponse) => {
          // Debug: log incoming proxy requests for easier troubleshooting
          // (will appear in the terminal running the Vite dev server).
          try {
            // eslint-disable-next-line no-console
            console.debug(`[ha-proxy] ${req.method} ${req.url} - X-HA-Base: ${String(req.headers['x-ha-base'] ?? '')}`)
          } catch {}

          const haBase = req.headers['x-ha-base'] as string | undefined
          if (!haBase) {
            res.statusCode = 400
            res.end('Missing X-HA-Base header')
            return
          }

          let targetUrl: URL
          try {
            targetUrl = new URL(`${haBase}${req.url ?? '/'}`)
          } catch {
            res.statusCode = 400
            res.end('Invalid X-HA-Base header')
            return
          }

        const transport = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
        const headers = { ...req.headers }
        delete headers['x-ha-base']
        delete headers['host']

        const proxyReq = transport(
          {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: { ...headers, host: targetUrl.host },
          },
          (proxyRes) => {
            // Log proxied response status for easier debugging
            try {
              // eslint-disable-next-line no-console
              console.debug(`[ha-proxy] proxied -> ${targetUrl.href} : ${proxyRes.statusCode}`)
            } catch {}

            // If the proxied server returned an error, buffer up to a limit
            // and log the response body to help diagnose 4xx/5xx failures.
            const status = proxyRes.statusCode ?? 0
            if (status >= 400) {
              const chunks: Buffer[] = []
              let size = 0
              const MAX = 8 * 1024 // 8KB
              proxyRes.on('data', (chunk: Buffer) => {
                if (size < MAX) {
                  const toTake = Math.min(MAX - size, chunk.length)
                  chunks.push(chunk.slice(0, toTake))
                  size += toTake
                }
              })
              proxyRes.on('end', () => {
                try {
                  const body = Buffer.concat(chunks).toString('utf8')
                  // eslint-disable-next-line no-console
                  console.debug(`[ha-proxy] proxied body (first ${MAX} bytes):`, body)
                } catch {}
              })
            }

            res.writeHead(proxyRes.statusCode!, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 502
            res.end(`Proxy error: ${err.message}`)
          }
        })

        req.pipe(proxyReq)
      })
    },
  }
}

/**
 * Dev-only proxy: forwards /llmstudio-proxy/<path> to the LLMStudio server.
 * The caller sets the X-LLM-Base header with the full LLMStudio origin.
 */
function llmStudioProxyPlugin(): Plugin {
  return {
    name: 'llmstudio-proxy',
    configureServer(server) {
      server.middlewares.use('/llmstudio-proxy', (req: IncomingMessage, res: ServerResponse) => {
        const llmBase = req.headers['x-llm-base'] as string | undefined
        if (!llmBase) {
          res.statusCode = 400
          res.end('Missing X-LLM-Base header')
          return
        }

        let targetUrl: URL
        try {
          targetUrl = new URL(`${llmBase}${req.url ?? '/'}`)
        } catch {
          res.statusCode = 400
          res.end('Invalid X-LLM-Base header')
          return
        }

        const transport = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest
        const headers = { ...req.headers }
        delete headers['x-llm-base']
        delete headers['host']

        const proxyReq = transport(
          {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: { ...headers, host: targetUrl.host },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode!, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 502
            res.end(`Proxy error: ${err.message}`)
          }
        })

        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), haProxyPlugin(), llmStudioProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve('src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-xlsx': ['xlsx'],
          'vendor-ui': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-select', '@radix-ui/react-tooltip'],
        },
      },
    },
  },
})
