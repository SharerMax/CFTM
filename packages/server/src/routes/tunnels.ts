import type { CfTunnelConfig } from '../services/cloudflare'
import { createTunnelSchema, updateConfigSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { fail, ok } from '../response'
import { TunnelError, TunnelService } from '../services/tunnels'

export const tunnelRoutes = new Hono()

function handleError(c: any, e: unknown) {
  if (e instanceof TunnelError)
    return fail(c, e.status, e.message)
  throw e
}

function getAccountId(c: any): string | null {
  return c.req.query('accountId') || null
}

const service = new TunnelService()

tunnelRoutes.get('/', async (c) => {
  const tunnels = await service.list()
  return ok(c, tunnels)
})

tunnelRoutes.get('/remote', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return fail(c, 400, 'bad_request: accountId is required')
  }

  try {
    const cfTunnels = await service.listRemote(accountId)
    return ok(c, cfTunnels)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.get('/remote/config', async (c) => {
  const accountId = getAccountId(c)
  const tunnelId = c.req.query('tunnelId')
  if (!accountId || !tunnelId)
    return fail(c, 400, 'bad_request: accountId and tunnelId are required')

  try {
    const config = await service.getRemoteConfig(accountId, tunnelId)
    return ok(c, config)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.put('/remote/config', async (c) => {
  const accountId = getAccountId(c)
  const tunnelId = c.req.query('tunnelId')
  if (!accountId || !tunnelId)
    return fail(c, 400, 'bad_request: accountId and tunnelId are required')

  const body = await c.req.json()
  const config = body.config as CfTunnelConfig

  try {
    const result = await service.updateRemoteConfig(accountId, tunnelId, config)
    return ok(c, result, 'updated')
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const input = createTunnelSchema.parse(body)

  try {
    const tunnel = await service.create(input)
    return ok(c, tunnel, 'created')
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.get('/:id', async (c) => {
  try {
    const tunnel = await service.get(c.req.param('id'))
    return ok(c, tunnel)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.put('/:id/config', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const config = updateConfigSchema.parse(body)

  try {
    await service.updateConfig(id, config)
    return ok(c, { success: true }, 'updated')
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.post('/:id/start', async (c) => {
  try {
    await service.start(c.req.param('id'))
    return ok(c, { success: true, status: 'running' }, 'started')
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.post('/:id/stop', async (c) => {
  try {
    await service.stop(c.req.param('id'))
    return ok(c, { success: true, status: 'stopped' }, 'stopped')
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.get('/:id/logs', async (c) => {
  const id = c.req.param('id')

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(`data: ${data}\n\n`)

      for (const log of service.getLogs(id))
        send(log)

      const unsubscribe = service.onLog(id, send)

      const interval = setInterval(send, 30000, ': keepalive\n')

      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(interval)
        unsubscribe()
      })
    },
  })

  return new Response(stream as any)
})

tunnelRoutes.delete('/:id', async (c) => {
  try {
    await service.remove(c.req.param('id'))
    return ok(c, { success: true }, 'deleted')
  }
  catch (e) {
    return handleError(c, e)
  }
})
