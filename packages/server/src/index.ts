import process from 'node:process'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ZodError } from 'zod'
import { authRoutes } from './routes/auth'
import { tunnelRoutes } from './routes/tunnels'
import { zoneRoutes } from './routes/zones'
import 'dotenv/config'

const app = new Hono()

app.use('/api/*', cors())

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: err.issues[0]?.message || 'invalid_input' }, 400)
  }
  return c.json({ error: err.message || 'internal_error' }, 500)
})

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() })
})

app.route('/api/auth', authRoutes)
app.route('/api/tunnels', tunnelRoutes)
app.route('/api/zones', zoneRoutes)

const port = Number(process.env.PORT) || 3000

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.warn(`[server] running on http://localhost:${info.port}`)
})
