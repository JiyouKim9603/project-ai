import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore JavaScript server helper is intentionally shared with the production Node server.
import { handleCalendarAi } from './calendar-ai-server.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (!process.env.OLLAMA_BASE_URL && env.OLLAMA_BASE_URL) {
    process.env.OLLAMA_BASE_URL = env.OLLAMA_BASE_URL
  }

  if (!process.env.OLLAMA_MODEL && env.OLLAMA_MODEL) {
    process.env.OLLAMA_MODEL = env.OLLAMA_MODEL
  }

  return {
    plugins: [
      react(),
      {
        name: 'modui-calendar-ai-api',
        configureServer(server) {
          server.middlewares.use('/api/calendar-ai', handleCalendarAi)
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/calendar-ai', handleCalendarAi)
        },
      },
    ],
  }
})
