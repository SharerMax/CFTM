import { decrypt, encrypt } from '@cftm/shared/crypto'
import { createTunnelSchema, updateConfigSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { prisma } from '../prisma'
import { CloudflareApi } from '../services/cloudflare'
import { tunnelManager } from '../services/tunnel'
import { getCfTokenAsync } from './auth'

export const tunnelRoutes = new Hono()

tunnelRoutes.get('/', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const tunnels = await prisma.tunnel.findMany({
    include: { dnsRecords: true },
    orderBy: { createdAt: 'desc' },
  })

  return c.json(tunnels.map(t => ({
    ...t,
    config: JSON.parse(t.config),
    isRunning: tunnelManager.isRunning(t.id),
  })))
})

tunnelRoutes.post('/', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const body = await c.req.json()
  const input = createTunnelSchema.parse(body)

  const cf = new CloudflareApi(token)
  const cfTunnel = await cf.createTunnel(input.accountId, input.name)
  const tunnelToken = await cf.getTunnelToken(input.accountId, cfTunnel.id)

  const tunnel = await prisma.tunnel.create({
    data: {
      name: input.name,
      accountId: input.accountId,
      cloudflareTunnelId: cfTunnel.id,
      encryptedToken: encrypt(tunnelToken),
      status: 'stopped',
      config: JSON.stringify({
        'tunnel': cfTunnel.id,
        'credentials-file': '',
        'ingress': [],
      }),
    },
  })

  return c.json({
    ...tunnel,
    config: JSON.parse(tunnel.config),
    isRunning: false,
  })
})

tunnelRoutes.get('/:id', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const id = c.req.param('id')
  const tunnel = await prisma.tunnel.findUnique({
    where: { id },
    include: { dnsRecords: true },
  })

  if (!tunnel) {
    return c.json({ error: 'not_found' }, 404)
  }

  const status = tunnelManager.getStatus(id)

  return c.json({
    ...tunnel,
    config: JSON.parse(tunnel.config),
    isRunning: tunnelManager.isRunning(id),
    runtimeStatus: status?.status || tunnel.status,
  })
})

tunnelRoutes.put('/:id/config', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const id = c.req.param('id')
  const body = await c.req.json()
  const config = updateConfigSchema.parse(body)

  const tunnel = await prisma.tunnel.findUnique({ where: { id } })
  if (!tunnel) {
    return c.json({ error: 'not_found' }, 404)
  }

  await prisma.tunnel.update({
    where: { id },
    data: { config: JSON.stringify(config) },
  })

  return c.json({ success: true })
})

tunnelRoutes.post('/:id/start', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const id = c.req.param('id')
  const tunnel = await prisma.tunnel.findUnique({ where: { id } })

  if (!tunnel) {
    return c.json({ error: 'not_found' }, 404)
  }

  if (tunnelManager.isRunning(id)) {
    return c.json({ error: 'already_running' }, 400)
  }

  try {
    const config = JSON.parse(tunnel.config)
    const tunnelToken = decrypt(tunnel.encryptedToken!)
    await tunnelManager.start(id, config, tunnelToken)

    await prisma.tunnel.update({
      where: { id },
      data: { status: 'running' },
    })

    return c.json({ success: true, status: 'running' })
  }
  catch (e) {
    await prisma.tunnel.update({
      where: { id },
      data: { status: 'error' },
    })
    return c.json({ error: (e as Error).message }, 500)
  }
})

tunnelRoutes.post('/:id/stop', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const id = c.req.param('id')

  const stopped = tunnelManager.stop(id)
  if (!stopped) {
    return c.json({ error: 'not_running' }, 400)
  }

  await prisma.tunnel.update({
    where: { id },
    data: { status: 'stopped' },
  })

  return c.json({ success: true, status: 'stopped' })
})

tunnelRoutes.get('/:id/logs', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const id = c.req.param('id')
  const tunnel = await prisma.tunnel.findUnique({ where: { id } })

  if (!tunnel) {
    return c.json({ error: 'not_found' }, 404)
  }

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(`data: ${data}\n\n`)
      }

      const logs = tunnelManager.getLogs(id)
      for (const log of logs) {
        send(log)
      }

      const onLog = (entry: string) => send(entry)
      tunnelManager.on(`log:${id}`, onLog)

      const interval = setInterval(() => {
        send(': keepalive\n')
      }, 30000)

      c.req.raw.signal.addEventListener('abort', () => {
        clearInterval(interval)
        tunnelManager.off(`log:${id}`, onLog)
      })
    },
  })

  return new Response(stream as any)
})

tunnelRoutes.delete('/:id', async (c) => {
  const token = await getCfTokenAsync()
  if (!token) {
    return c.json({ error: 'not_authorized' }, 401)
  }

  const id = c.req.param('id')
  const tunnel = await prisma.tunnel.findUnique({ where: { id } })

  if (!tunnel) {
    return c.json({ error: 'not_found' }, 404)
  }

  if (tunnelManager.isRunning(id)) {
    tunnelManager.stop(id)
  }

  if (tunnel.cloudflareTunnelId) {
    const cf = new CloudflareApi(token)
    await cf.deleteTunnel(tunnel.accountId, tunnel.cloudflareTunnelId)
  }

  await prisma.tunnel.delete({ where: { id } })

  return c.json({ success: true })
})
