import type { CfTunnelConfig } from '../services/cloudflare'
import { createTunnelSchema, updateConfigSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { TunnelError, TunnelService } from '../services/tunnels'
import { getCfTokenAsync } from './auth'

export const tunnelRoutes = new Hono()

function handleError(c: any, e: unknown) {
  if (e instanceof TunnelError)
    return c.json({ error: e.message }, e.status)
  throw e
}

function getAccountId(c: any): string | null {
  return c.req.query('accountId') || null
}

tunnelRoutes.get('/', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const tunnels = await new TunnelService(token).list()
  return c.json(tunnels)
})

tunnelRoutes.get('/remote', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const accountId = getAccountId(c)
  if (!accountId)
    return c.json({ error: 'bad_request', message: 'accountId is required' }, 400)

  const service = new TunnelService(token)
  const cfTunnels = await service.listRemote(accountId)

  return c.json(cfTunnels)
})

tunnelRoutes.get('/remote/config', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const accountId = getAccountId(c)
  const tunnelId = c.req.query('tunnelId')
  if (!accountId || !tunnelId)
    return c.json({ error: 'bad_request', message: 'accountId and tunnelId are required' }, 400)

  try {
    const config = await new TunnelService(token).getRemoteConfig(accountId, tunnelId)
    return c.json(config)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.put('/remote/config', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const accountId = getAccountId(c)
  const tunnelId = c.req.query('tunnelId')
  if (!accountId || !tunnelId)
    return c.json({ error: 'bad_request', message: 'accountId and tunnelId are required' }, 400)

  const body = await c.req.json()
  const config = body.config as CfTunnelConfig

  try {
    const result = await new TunnelService(token).updateRemoteConfig(accountId, tunnelId, config)
    return c.json(result)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.post('/', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const body = await c.req.json()
  const input = createTunnelSchema.parse(body)

  try {
    const tunnel = await new TunnelService(token).create(input)
    return c.json(tunnel)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.get('/:id', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  try {
    const tunnel = await new TunnelService(token).get(c.req.param('id'))
    return c.json(tunnel)
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.put('/:id/config', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()
  const config = updateConfigSchema.parse(body)

  try {
    await new TunnelService(token).updateConfig(id, config)
    return c.json({ success: true })
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.post('/:id/start', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  try {
    await new TunnelService(token).start(c.req.param('id'))
    return c.json({ success: true, status: 'running' })
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.post('/:id/stop', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  try {
    await new TunnelService(token).stop(c.req.param('id'))
    return c.json({ success: true, status: 'stopped' })
  }
  catch (e) {
    return handleError(c, e)
  }
})

tunnelRoutes.get('/:id/logs', async (c) => {
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  const id = c.req.param('id')

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  const service = new TunnelService(token)

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
  const token = await getCfTokenAsync()
  if (!token)
    return c.json({ error: 'not_authorized' }, 401)

  try {
    await new TunnelService(token).remove(c.req.param('id'))
    return c.json({ success: true })
  }
  catch (e) {
    return handleError(c, e)
  }
})
