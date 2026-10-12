import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const exampleUniverse = readFileSync(
  new URL('./data/example-universe.csv', import.meta.url),
  'utf8',
)

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    {
      name: 'example-universe-download',
      configureServer(server) {
        server.middlewares.use(
          '/data/example-universe.csv',
          (_request, response) => {
            response.setHeader('Content-Type', 'text/csv; charset=utf-8')
            response.end(exampleUniverse)
          },
        )
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'data/example-universe.csv',
          source: exampleUniverse,
        })
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/breakout': 'http://127.0.0.1:8788',
      '/api/broker': 'http://127.0.0.1:8788',
      '/api/settings': 'http://127.0.0.1:8788',
      '/api/universe': 'http://127.0.0.1:8788',
      '/api/sync': 'http://127.0.0.1:8788',
      '/api/leaders': 'http://127.0.0.1:8788',
      '/api/health': 'http://127.0.0.1:8788',
      '/api/docs': 'http://127.0.0.1:8788',
      '/api/openapi.json': 'http://127.0.0.1:8788',
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
