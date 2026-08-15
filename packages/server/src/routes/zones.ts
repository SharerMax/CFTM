import type { ZoneDTO } from '@cftm/shared/types'
import { createDnsRecordSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { fail, ok } from '../response'
import { AccountService } from '../services/accounts'
import { CloudflareApi } from '../services/cloudflare'
import { DnsError, DnsService } from '../services/dns'

export const zoneRoutes = new Hono()

const accountService = new AccountService()
const dnsService = new DnsService()

async function resolveToken(accountId: string): Promise<string | null> {
  return accountService.getTokenByAccountId(accountId)
}

function getAccountId(c: any): string | null {
  return c.req.query('accountId') || null
}

zoneRoutes.get('/', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return fail(c, 400, 'bad_request: accountId is required')
  }

  const token = await resolveToken(accountId)
  if (!token) {
    return fail(c, 404, 'account_not_found')
  }

  const cf = new CloudflareApi(token)
  const zones = await cf.listZones()

  return ok(c, zones.map<ZoneDTO>(z => ({
    id: z.id,
    name: z.name,
    status: z.status,
  })))
})

zoneRoutes.get('/:zoneId/records', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return fail(c, 400, 'bad_request: accountId is required')
  }

  const zoneId = c.req.param('zoneId')

  try {
    const records = await dnsService.listRecords(accountId, zoneId)
    return ok(c, records)
  }
  catch (e) {
    if (e instanceof DnsError) {
      return fail(c, e.status, e.message)
    }
    throw e
  }
})

zoneRoutes.post('/:zoneId/records', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return fail(c, 400, 'bad_request: accountId is required')
  }

  const zoneId = c.req.param('zoneId')
  const body = await c.req.json()
  const input = createDnsRecordSchema.parse({ zoneId, ...body })

  try {
    const record = await dnsService.createRecord(accountId, zoneId, input)
    return ok(c, record, 'created')
  }
  catch (e) {
    if (e instanceof DnsError) {
      return fail(c, e.status, e.message)
    }
    throw e
  }
})

zoneRoutes.delete('/:zoneId/records/:recordId', async (c) => {
  const accountId = getAccountId(c)
  if (!accountId) {
    return fail(c, 400, 'bad_request: accountId is required')
  }

  const { zoneId, recordId } = c.req.param()

  try {
    await dnsService.deleteRecord(accountId, zoneId, recordId)
    return ok(c, { success: true }, 'deleted')
  }
  catch (e) {
    if (e instanceof DnsError) {
      return fail(c, e.status, e.message)
    }
    throw e
  }
})
