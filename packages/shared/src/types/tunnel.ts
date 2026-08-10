export type TunnelStatus = 'stopped' | 'running' | 'error'

export interface TunnelConfig {
  'tunnel': string
  'credentials-file'?: string
  'ingress': IngressRule[]
  'originRequest'?: Record<string, unknown>
}

export interface IngressRule {
  hostname?: string
  service: string
  path?: string
}

export interface TunnelDTO {
  id: string
  name: string
  cloudflareTunnelId: string | null
  accountId: string
  status: TunnelStatus
  config: TunnelConfig
  createdAt: string
}
