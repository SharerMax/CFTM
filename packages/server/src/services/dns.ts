import type { CreateDnsRecordInput } from '@cftm/shared/schemas'
import type { DnsRecordService, DnsRecordView } from '@cftm/shared/types'
import type { CfDnsRecord, CfTunnel } from './cloudflare'
import { logger } from '../logger'
import { prisma } from '../prisma'
import { AccountService } from './accounts'
import { CloudflareApi } from './cloudflare'

export class DnsError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const accountService = new AccountService()

const TUNNEL_CONTENT_RE = /^[0-9a-f-]+\.cfargotunnel\.com$/i

function resolveService(record: CfDnsRecord, tunnels: CfTunnel[]): DnsRecordService | null {
  const content = record.content?.toLowerCase() ?? ''

  if (TUNNEL_CONTENT_RE.test(content)) {
    const uuid = content.split('.')[0]
    const tunnel = tunnels.find(t => t.id === uuid)
    return { type: 'tunnel', name: tunnel?.name || uuid }
  }

  if (content.endsWith('.workers.dev')) {
    return { type: 'worker', name: content.split('.')[0] }
  }

  if (content.endsWith('.pages.dev')) {
    return { type: 'pages', name: content.split('.')[0] }
  }

  if (content.endsWith('.r2.dev')) {
    return { type: 'r2', name: content.split('.')[0] }
  }

  if (record.locked) {
    return { type: 'managed' }
  }

  if (record.meta?.auto_added === true) {
    return { type: 'auto' }
  }

  return null
}

function toView(record: CfDnsRecord, tunnels: CfTunnel[]): DnsRecordView {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
    locked: record.locked,
    comment: record.comment ?? null,
    service: resolveService(record, tunnels),
  }
}

export class DnsService {
  async listRecords(accountId: string, zoneId: string): Promise<DnsRecordView[]> {
    const token = await accountService.getTokenByAccountId(accountId)
    if (!token)
      throw new DnsError('account_not_found', 404)

    const cf = new CloudflareApi(token)
    const records = await cf.listDnsRecords(zoneId)

    let tunnels: CfTunnel[] = []
    const hasTunnelTarget = records.some(r => TUNNEL_CONTENT_RE.test(r.content ?? ''))
    if (hasTunnelTarget) {
      tunnels = await cf.listTunnels(accountId).catch(() => [])
    }

    return records.map(r => toView(r, tunnels))
  }

  async createRecord(accountId: string, zoneId: string, input: CreateDnsRecordInput): Promise<DnsRecordView> {
    const token = await accountService.getTokenByAccountId(accountId)
    if (!token)
      throw new DnsError('account_not_found', 404)

    const cf = new CloudflareApi(token)
    const zone = await cf.getZone(zoneId)
    if (!zone)
      throw new DnsError('zone_not_found', 404)

    const name = input.name === '@' ? zone.name : `${input.name}.${zone.name}`

    const record = await cf.createDnsRecord(zoneId, {
      name,
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

    logger.info({ zoneId, recordId: record.id, name: record.name }, 'dns_record_created')

    return toView(record, [])
  }

  async deleteRecord(accountId: string, zoneId: string, recordId: string): Promise<void> {
    const token = await accountService.getTokenByAccountId(accountId)
    if (!token)
      throw new DnsError('account_not_found', 404)

    const cf = new CloudflareApi(token)
    await cf.deleteDnsRecord(zoneId, recordId)

    await prisma.dnsRecord.deleteMany({
      where: { cloudflareRecordId: recordId },
    })

    logger.info({ zoneId, recordId }, 'dns_record_deleted')
  }
}
