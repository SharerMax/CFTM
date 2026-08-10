import type { CreateTunnelInput, UpdateConfigInput } from '@cftm/shared/schemas'
import type { CfTunnel, CfTunnelConfig } from './cloudflare'
import { decrypt, encrypt } from '@cftm/shared/crypto'
import { prisma } from '../prisma'
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
  private cf: CloudflareApi

  constructor(token: string) {
    this.cf = new CloudflareApi(token)
  }

  async list(): Promise<TunnelDTO[]> {
    const tunnels = await prisma.tunnel.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return tunnels.map(toDTO)
  }

  async listRemote(accountId: string): Promise<CfTunnel[]> {
    const cfTunnels = await this.cf.listTunnels(accountId)

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
    return this.cf.getTunnelConfig(accountId, tunnelId)
  }

  async updateRemoteConfig(accountId: string, tunnelId: string, config: CfTunnelConfig): Promise<CfTunnelConfig> {
    return this.cf.updateTunnelConfig(accountId, tunnelId, config)
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
    const cfTunnel = await this.cf.createTunnel(input.accountId, input.name)
    const tunnelToken = await this.cf.getTunnelToken(input.accountId, cfTunnel.id)

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

    return toDTO(tunnel)
  }

  async updateConfig(id: string, config: UpdateConfigInput): Promise<void> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)

    await prisma.tunnel.update({
      where: { id },
      data: { config: JSON.stringify(config) },
    })
  }

  async start(id: string): Promise<void> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)
    if (tunnelManager.isRunning(id))
      throw new TunnelError('already_running', 400)

    try {
      const config = JSON.parse(tunnel.config)
      const tunnelToken = decrypt(tunnel.encryptedToken!)
      await tunnelManager.start(id, config, tunnelToken)
      await prisma.tunnel.update({ where: { id }, data: { status: 'running' } })
    }
    catch (e) {
      await prisma.tunnel.update({ where: { id }, data: { status: 'error' } })
      throw e
    }
  }

  async stop(id: string): Promise<void> {
    const stopped = tunnelManager.stop(id)
    if (!stopped)
      throw new TunnelError('not_running', 400)

    await prisma.tunnel.update({ where: { id }, data: { status: 'stopped' } })
  }

  async remove(id: string): Promise<void> {
    const tunnel = await prisma.tunnel.findUnique({ where: { id } })
    if (!tunnel)
      throw new TunnelError('not_found', 404)

    if (tunnelManager.isRunning(id))
      tunnelManager.stop(id)

    if (tunnel.cloudflareTunnelId)
      await this.cf.deleteTunnel(tunnel.accountId, tunnel.cloudflareTunnelId)

    await prisma.tunnel.delete({ where: { id } })
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
