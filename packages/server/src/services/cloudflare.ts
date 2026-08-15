const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

interface CfResponse<T> {
  success: boolean
  errors: { code: number, message: string }[]
  result: T
  result_info?: { page: number, per_page: number, total_pages: number, count: number, total_count: number }
}

export interface CfTunnel {
  id: string
  name: string
  created_at: string
  deleted_at: string | null
  connections: { colo_name: string, uuid: string, is_pending_reconnect: boolean }[]
  config_src?: 'local' | 'cloudflare'
}

export interface CfTunnelConfig {
  'ingress': { hostname?: string, service: string, path?: string, originRequest?: Record<string, unknown> }[]
  'originRequest'?: Record<string, unknown>
  'warp-routing'?: { enabled: boolean }
}

export interface CfZone {
  id: string
  name: string
  status: string
  paused: boolean
}

export interface CfDnsRecord {
  id: string
  zone_id: string
  name: string
  type: string
  content: string
  proxied: boolean
  ttl: number
}

export class CloudflareApi {
  constructor(private token: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const data = await this.requestFull<T>(path, init)
    return data.result
  }

  private async requestFull<T>(path: string, init: RequestInit = {}): Promise<CfResponse<T>> {
    const res = await fetch(`${CF_API_BASE}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })

    const data = await res.json() as CfResponse<T>

    if (!data.success) {
      throw new Error(data.errors[0]?.message || 'Cloudflare API error')
    }

    return data
  }

  private async requestAllPages<T>(path: (page: number) => string): Promise<T[]> {
    const results: T[] = []
    let page = 1
    let totalPages = 1
    do {
      const data = await this.requestFull<T[]>(path(page))
      results.push(...data.result)
      totalPages = data.result_info?.total_pages ?? 1
      page += 1
    } while (page <= totalPages)
    return results
  }

  async verifyToken(): Promise<{ id: string, status: string }> {
    return this.request<{ id: string, status: string }>('/user/tokens/verify')
  }

  async listZones(): Promise<CfZone[]> {
    return this.requestAllPages<CfZone>(page => `/zones?per_page=100&page=${page}`)
  }

  async getZone(zoneId: string): Promise<CfZone | undefined> {
    const zones = await this.listZones()
    return zones.find(z => z.id === zoneId)
  }

  async listTunnels(accountId: string): Promise<CfTunnel[]> {
    return this.request<CfTunnel[]>(`/accounts/${accountId}/cfd_tunnel`)
  }

  async getTunnel(accountId: string, tunnelId: string): Promise<CfTunnel> {
    return this.request<CfTunnel>(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`)
  }

  async createTunnel(accountId: string, name: string): Promise<CfTunnel> {
    return this.request<CfTunnel>(`/accounts/${accountId}/cfd_tunnel`, {
      method: 'POST',
      body: JSON.stringify({ name, config_src: 'cloudflare' }),
    })
  }

  async deleteTunnel(accountId: string, tunnelId: string): Promise<void> {
    await this.request(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, { method: 'DELETE' })
  }

  async getTunnelToken(accountId: string, tunnelId: string): Promise<string> {
    const result = await this.request<{ token: string }>(
      `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`,
    )
    return result.token
  }

  async getTunnelConfig(accountId: string, tunnelId: string): Promise<CfTunnelConfig> {
    const result = await this.request<{ config: CfTunnelConfig }>(
      `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    )
    return result.config
  }

  async updateTunnelConfig(accountId: string, tunnelId: string, config: CfTunnelConfig): Promise<CfTunnelConfig> {
    const result = await this.request<{ config: CfTunnelConfig }>(
      `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        body: JSON.stringify({ config }),
      },
    )
    return result.config
  }

  async listDnsRecords(zoneId: string): Promise<CfDnsRecord[]> {
    return this.requestAllPages<CfDnsRecord>(page => `/zones/${zoneId}/dns_records?per_page=100&page=${page}`)
  }

  async createDnsRecord(zoneId: string, record: { name: string, type: string, content: string, proxied: boolean, ttl?: number }): Promise<CfDnsRecord> {
    const body: Record<string, unknown> = {
      name: record.name,
      type: record.type,
      content: record.content,
    }
    if (record.proxied) {
      body.proxied = true
      body.ttl = 1
    }
    else {
      body.proxied = false
      body.ttl = record.ttl ?? 300
    }
    return this.request<CfDnsRecord>(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request(`/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE' })
  }
}
