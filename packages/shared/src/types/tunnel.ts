export type TunnelStatus = 'stopped' | 'running' | 'error'

export interface TunnelConfig {
  'tunnel': string
  'credentials-file'?: string
  'ingress': IngressRule[]
  'originRequest'?: OriginRequest
}

export interface AccessRule {
  required?: boolean
  teamName?: string
  audTag?: string[]
}

export interface OriginRequest {
  // TLS
  originServerName?: string
  matchSNItoHost?: boolean
  caPool?: string
  noTLSVerify?: boolean
  tlsTimeout?: string
  http2Origin?: boolean
  // HTTP
  httpHostHeader?: string
  disableChunkedEncoding?: boolean
  // Connection
  connectTimeout?: string
  noHappyEyeballs?: boolean
  proxyType?: string
  proxyAddress?: string
  proxyPort?: number
  keepAliveTimeout?: string
  keepAliveConnections?: number
  tcpKeepAlive?: string
  // Access
  access?: AccessRule
}

export interface IngressRule {
  hostname?: string
  service: string
  path?: string
  originRequest?: OriginRequest
}

export interface RemoteTunnelConfig {
  'ingress': IngressRule[]
  'originRequest'?: OriginRequest
  'warp-routing'?: { enabled: boolean }
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
