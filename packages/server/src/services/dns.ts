import type { CreateDnsRecordInput } from '@cftm/shared/schemas'
import type { DnsRecordService, DnsRecordView } from '@cftm/shared/types'
import type { CfDnsRecord, CfTunnel, CfWorkerDomain } from './cloudflare'
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

// CNAME 内容指向 Cloudflare 托管子域名时的来源判别
const SERVICE_SUFFIXES: { type: DnsRecordService['type'], suffix: string }[] = [
  { type: 'worker', suffix: '.workers.dev' },
  { type: 'pages', suffix: '.pages.dev' },
  { type: 'r2', suffix: '.r2.dev' },
]

/**
 * 判别 DNS 记录的来源，按信号强度从强到弱：
 * 1. 内容模式（CNAME 指向 cfargotunnel.com / workers.dev / pages.dev / r2.dev）— 确定性，零额外请求
 * 2. 记录自带 meta 标志（origin_worker_id / read_only / auto_added）— 确定性，零额外请求
 * 3. hostname 命中 worker custom domain 列表 — 弱信号，需要 Workers Scripts 权限（403 时自动降级为 []）
 */
function resolveService(record: CfDnsRecord, tunnels: CfTunnel[], workerDomains: CfWorkerDomain[]): DnsRecordService | null {
  const content = record.content?.toLowerCase() ?? ''
  const meta = record.meta ?? {}

  // 1a. Tunnel 路由 CNAME：<tunnel-id>.cfargotunnel.com
  if (TUNNEL_CONTENT_RE.test(content)) {
    const uuid = content.split('.')[0]
    const tunnel = tunnels.find(t => t.id === uuid)
    return { type: 'tunnel', name: tunnel?.name || uuid }
  }

  // 1b. 内容指向 workers.dev / pages.dev / r2.dev
  for (const { type, suffix } of SERVICE_SUFFIXES) {
    if (content.endsWith(suffix)) {
      return { type, name: content.split('.')[0] }
    }
  }

  // hostname 命中的 worker domain（custom domain / route），用于补充 worker 名
  const workerDomain = workerDomains.find(d => d.hostname === record.name)

  // 2a. Worker custom domain：Cloudflare 自动创建的占位记录（如 AAAA 100::）自带 origin_worker_id
  if (meta.origin_worker_id) {
    return { type: 'worker', name: workerDomain?.service ?? undefined }
  }

  // 2b. 弱信号：hostname 命中 worker domain（token 有权限时；无 origin_worker_id 说明是用户自建 + route）
  if (workerDomain) {
    return { type: 'worker', name: workerDomain.service }
  }

  // 2c. 服务托管的只读记录（R2 custom domain、Web3 gateway、Email Routing 等）；
  //     locked 为旧字段，部分记录不返回，实际标志是 meta.read_only
  if (record.locked || meta.read_only === true) {
    return { type: 'managed' }
  }

  // 2d. 兼容存量：auto_added 已被 Cloudflare 移除（2025-02），仅对旧数据生效
  if (meta.auto_added === true) {
    return { type: 'auto' }
  }

  return null
}

function toView(record: CfDnsRecord, tunnels: CfTunnel[], workerDomains: CfWorkerDomain[]): DnsRecordView {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    content: record.content,
    proxied: record.proxied,
    ttl: record.ttl,
    locked: record.locked,
    readOnly: record.meta?.read_only === true,
    comment: record.comment ?? null,
    service: resolveService(record, tunnels, workerDomains),
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

    const hasWorkerTarget = records.some(r => r.meta?.origin_worker_id || (r.content ?? '').toLowerCase().endsWith('.workers.dev'))
    const workerDomains = hasWorkerTarget
      ? await cf.listWorkerDomains(accountId, zoneId).catch(() => [])
      : []

    return records.map(r => toView(r, tunnels, workerDomains))
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

    return toView(record, [], [])
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
