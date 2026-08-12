import { createDnsRecordSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { prisma } from '../prisma'
import { AccountService } from '../services/accounts'
import { CloudflareApi } from '../services/cloudflare'

export const zoneRoutes = new Hono()

const accountService = new AccountService()

async function resolveToken(accountId: string): Promise<string | null> {
  return accountService.getTokenByAccountId(accountId)
}

function getAccountId(c: any): string | null {
  return c.req.query('accountId') || null
}

zoneRoutes.get('/', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return c.json({ error: 'bad_request', message: 'accountId is required' }, 400)
  }

  const token = await resolveToken(accountId)
  if (!token) {
    return c.json({ error: 'account_not_found' }, 404)
  }

  const cf = new CloudflareApi(token)
  const zones = await cf.listZones()

  return c.json(zones.map(z => ({
    id: z.id,
    name: z.name,
    status: z.status,
  })))
})

zoneRoutes.get('/:zoneId/records', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return c.json({ error: 'bad_request', message: 'accountId is required' }, 400)
  }

  const token = await resolveToken(accountId)
  if (!token) {
    return c.json({ error: 'account_not_found' }, 404)
  }

  const zoneId = c.req.param('zoneId')
  const cf = new CloudflareApi(token)
  const records = await cf.listDnsRecords(zoneId)

  return c.json(records.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
  })))
})

zoneRoutes.post('/:zoneId/records', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return c.json({ error: 'bad_request', message: 'accountId is required' }, 400)
  }

  const token = await resolveToken(accountId)
  if (!token) {
    return c.json({ error: 'account_not_found' }, 404)
  }

  const zoneId = c.req.param('zoneId')
  const body = await c.req.json()
  const input = createDnsRecordSchema.parse(body)

  const cf = new CloudflareApi(token)
  const record = await cf.createDnsRecord(zoneId, {
    name: input.name,
    type: input.type,
    content: input.content,
    proxied: input.proxied,
  })

  if (input.tunnelId) {
    await prisma.dnsRecord.create({
      data: {
        cloudflareRecordId: record.id,
        zoneId,
        name: record.name,
        type: record.type,
        content: record.content,
        proxied: record.proxied,
        tunnelId: input.tunnelId,
      },
    })
  }

  return c.json({
    id: record.id,
    name: record.name,
    type: record.type,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
  })
})

zoneRoutes.delete('/:zoneId/records/:recordId', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return c.json({ error: 'bad_request', message: 'accountId is required' }, 400)
  }

  const token = await resolveToken(accountId)
  if (!token) {
    return c.json({ error: 'account_not_found' }, 404)
  }

  const { zoneId, recordId } = c.req.param()

  const cf = new CloudflareApi(token)
  await cf.deleteDnsRecord(zoneId, recordId)

  await prisma.dnsRecord.deleteMany({
    where: { cloudflareRecordId: recordId },
  })

  return c.json({ success: true })
})
