export type DnsRecordType = 'CNAME' | 'A' | 'AAAA'

export interface DnsRecordDTO {
  id: string
  zoneId: string
  name: string
  type: DnsRecordType
  content: string
  proxied: boolean
  tunnelId: string | null
  createdAt: string
}

export interface ZoneDTO {
  id: string
  name: string
  status: string
}

export type DnsRecordService
  = { type: 'tunnel', name?: string }
    | { type: 'worker', name?: string }
    | { type: 'pages', name?: string }
    | { type: 'r2', name?: string }
    | { type: 'managed' }
    | { type: 'auto' }

export interface DnsRecordView {
  id: string
  name: string
  type: string
  content: string
  proxied: boolean
  ttl: number
  locked?: boolean
  comment?: string | null
  service?: DnsRecordService | null
}
