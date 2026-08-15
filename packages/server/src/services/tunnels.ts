import type { CreateTunnelInput, UpdateConfigInput } from '@cftm/shared/schemas'
import type { CfTunnel, CfTunnelConfig } from './cloudflare'
import { decrypt, encrypt } from '@cftm/shared/crypto'
import { logger } from '../logger'
import { prisma } from '../prisma'
import { AccountService } from './accounts'
import { CloudflareApi } from './cloudflare'
import { tunnelManager } from './tunnel'

export class TunnelError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

interface IngressRule {
  hostname?: string
  service: string
  path?: string
}

export interface TunnelDTO {
  id: string
  name: string
  cloudflareTunnelId: string | null
  accountId: string
  status: string
  isRunning: boolean
  config: {
    'tunnel': string
    'credentials-file'?: string
    'ingress': IngressRule[]
    'originRequest'?: Record<string, unknown>
  }
  createdAt: string
  updatedAt?: string
  runtimeStatus?: string
}

const accountService = new AccountService()

async function cfForAccountId(accountId: string): Promise<CloudflareApi> {
  const token = await accountService.getTokenByAccountId(accountId)
  if (!token)
    throw new TunnelError('account_not_found', 404)
  return new CloudflareApi(token)
}

function toDTO(tunnel: {
  id: string
  name: string
  cloudflareTunnelId: string | null
  accountId: string
  status: string
  config: string
  createdAt: Date
  updatedAt?: Date | null
}): TunnelDTO {
  return {
    id: tunnel.id,
    name: tunnel.name,
    cloudflareTunnelId: tunnel.cloudflareTunnelId,
    accountId: tunnel.accountId,
    status: tunnel.status,
    isRunning: tunnelManager.isRunning(tunnel.id),
    config: JSON.parse(tunnel.config),
    createdAt: tunnel.createdAt.toISOString(),
    updatedAt: tunnel.updatedAt?.toISOString(),
  }
}

export class TunnelService {
  async list(): Promise<TunnelDTO[]> {
    const tunnels = await prisma.tunnel.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return tunnels.map(toDTO)
  }

  async listRemote(accountId: string): Promise<CfTunnel[]> {
    const cf = await cfForAccountId(accountId)
    const cfTunnels = await cf.listTunnels(accountId)

    const existing = await prisma.tunnel.findMany({
      where: { accountId },
      select: { cloudflareTunnelId: true },
    })
    const existingIds = new Set(existing.map(t => t.cloudflareTunnelId).filter(Boolean))

    return cfTunnels
      .filter(t => !t.deleted_at)
      .filter(t => !existingIds.has(t.id))
  }

  async getRemoteConfig(accountId: string, tunnelId: string): Promise<CfTunnelConfig> {
    const cf = await cfForAccountId(accountId)
    const tunnel = await cf.getTunnel(accountId, tunnelId)
    if (tunnel.config_src === 'local')
      throw new TunnelError('locally_managed_config', 409)
    return cf.getTunnelConfig(accountId, tunnelId)
  }

  async updateRemoteConfig(accountId: string, tunnelId: string, config: CfTunnelConfig): Promise<CfTunnelConfig> {
    const cf = await cfForAccountId(accountId)
    const tunnel = await cf.getTunnel(accountId, tunnelId)
    if (tunnel.config_src === 'local')
      throw new TunnelError('locally_managed_config', 409)
    return cf.updateTunnelConfig(accountId, tunnelId, config)
  }

  async get(id: string): Promise<TunnelDTO> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)

    const status = tunnelManager.getStatus(id)
    return {
      ...toDTO(tunnel),
      runtimeStatus: status?.status || tunnel.status,
    }
  }

  async create(input: CreateTunnelInput): Promise<TunnelDTO> {
    const cf = await cfForAccountId(input.accountId)
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

    logger.info({
      tunnelId: tunnel.id,
      name: tunnel.name,
      accountId: tunnel.accountId,
      cloudflareTunnelId: cfTunnel.id,
    }, 'tunnel_created')

    return toDTO(tunnel)
  }

  async updateConfig(id: string, config: UpdateConfigInput): Promise<void> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)

    if (tunnel.cloudflareTunnelId) {
      const cf = await cfForAccountId(tunnel.accountId)
      const cfConfig: CfTunnelConfig = {
        ingress: config.ingress,
        ...(config.originRequest ? { originRequest: config.originRequest } : {}),
      }
      await cf.updateTunnelConfig(tunnel.accountId, tunnel.cloudflareTunnelId, cfConfig)
    }

    await prisma.tunnel.update({
      where: { id },
      data: { config: JSON.stringify(config) },
    })

    logger.info({ tunnelId: id }, 'tunnel_config_updated')
  }

  async start(id: string): Promise<void> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)
    if (tunnelManager.isRunning(id))
      throw new TunnelError('already_running', 400)

    try {
      const tunnelToken = decrypt(tunnel.encryptedToken!)
      await tunnelManager.start(id, { type: 'token', token: tunnelToken })
      await prisma.tunnel.update({ where: { id }, data: { status: 'running' } })
      logger.info({ tunnelId: id, name: tunnel.name }, 'tunnel_started')
    }
    catch (e) {
      await prisma.tunnel.update({ where: { id }, data: { status: 'error' } })
      logger.error({
        tunnelId: id,
        error: e instanceof Error ? e.message : String(e),
      }, 'tunnel_start_failed')
      throw e
    }
  }

  async stop(id: string): Promise<void> {
    const stopped = tunnelManager.stop(id)
    if (!stopped)
      throw new TunnelError('not_running', 400)

    await prisma.tunnel.update({ where: { id }, data: { status: 'stopped' } })
    logger.info({ tunnelId: id }, 'tunnel_stopped')
  }

  async remove(id: string): Promise<void> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)

    if (tunnelManager.isRunning(id))
      tunnelManager.stop(id)

    if (tunnel.cloudflareTunnelId) {
      const cf = await cfForAccountId(tunnel.accountId)
      await cf.deleteTunnel(tunnel.accountId, tunnel.cloudflareTunnelId)
    }

    await prisma.tunnel.delete({ where: { id } })

    logger.info({ tunnelId: id, name: tunnel.name }, 'tunnel_deleted')
  }

  getLogs(id: string): string[] {
    return tunnelManager.getLogs(id)
  }

  onLog(id: string, handler: (entry: string) => void): () => void {
    const event = `log:${id}`
    tunnelManager.on(event, handler)
    return () => tunnelManager.off(event, handler)
  }
}
