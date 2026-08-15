import process from 'node:process'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ZodError } from 'zod'
import { logger } from './logger'
import { fail, ok } from './response'
import { accountRoutes } from './routes/accounts'
import { tunnelRoutes } from './routes/tunnels'
import { zoneRoutes } from './routes/zones'
import { migrateLegacyToken } from './services/migration'
import 'dotenv/config'

const app = new Hono()

app.use('/api/*', cors())

app.use('/api/*', async (c, next) => {
  const start = performance.now()
  await next()
  const duration = Math.round(performance.now() - start)
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }, 'http_request')
})

app.onError((err, c) => {
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message || 'invalid_input'
    logger.warn({ path: c.req.path, message }, 'validation_error')
    return fail(c, 400, message)
  }
  logger.error({
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }, 'unhandled_error')
  return fail(c, 500, err instanceof Error ? err.message : 'internal_error')
})

app.get('/api/health', (c) => {
  return ok(c, { status: 'ok', time: new Date().toISOString() })
})

app.route('/api/accounts', accountRoutes)
app.route('/api/tunnels', tunnelRoutes)
app.route('/api/zones', zoneRoutes)

async function main() {
  await migrateLegacyToken()

  const port = Number(process.env.PORT) || 3000

  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    logger.info({ port: info.port }, 'server_started')
  })
}

main()
