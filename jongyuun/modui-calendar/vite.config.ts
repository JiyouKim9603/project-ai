import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore JavaScript server helper is intentionally shared with the production Node server.
import { handleCalendarAi } from './calendar-ai-server.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // OpenAI 키/모델은 Vite의 서버 프로세스에서만 사용합니다.
  // VITE_ 접두사를 붙이지 않으므로 브라우저 번들에 API 키가 포함되지 않습니다.
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_REASONING_EFFORT', 'OPENAI_MAX_OUTPUT_TOKENS']) {
    if (!process.env[key] && env[key]) process.env[key] = env[key]
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
