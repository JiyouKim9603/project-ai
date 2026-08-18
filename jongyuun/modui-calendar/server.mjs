import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleCalendarAi } from './calendar-ai-server.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = join(root, 'dist')

const loadDotEnv = () => {
  const path = join(root, '.env')
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!(key in process.env)) process.env[key] = value
  }
}
loadDotEnv()

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

const serveFile = async (res, filePath) => {
  const data = await readFile(filePath)
  res.statusCode = 200
  res.setHeader('Content-Type', mime[extname(filePath)] || 'application/octet-stream')
  res.end(data)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/api/calendar-ai') return handleCalendarAi(req, res)

  if (!existsSync(dist)) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('dist 폴더가 없습니다. 먼저 npm run build를 실행해주세요.')
    return
  }

  try {
    const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.(\/|\\|$))+/, '')
    let filePath = join(dist, safePath === '/' ? 'index.html' : safePath)
    const info = await stat(filePath).catch(() => null)
    if (!info || !info.isFile()) filePath = join(dist, 'index.html')
    await serveFile(res, filePath)
  } catch {
    res.statusCode = 500
    res.end('Server error')
  }
})

const port = Number(process.env.PORT || 4173)
server.listen(port, () => console.log(`MODUI Calendar: http://localhost:${port}`))
