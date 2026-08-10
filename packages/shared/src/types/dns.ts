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

export interface DnsRecordView {
  id: string
  name: string
  type: string
  content: string
  proxied: boolean
  ttl: number
}
