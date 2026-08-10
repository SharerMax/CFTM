import { z } from 'zod'

export const createDnsRecordSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['CNAME', 'A', 'AAAA']),
  content: z.string().min(1),
  proxied: z.boolean().default(true),
  tunnelId: z.string().optional(),
})

export const deleteDnsRecordSchema = z.object({
  zoneId: z.string().min(1),
  recordId: z.string().min(1),
})

export type CreateDnsRecordInput = z.infer<typeof createDnsRecordSchema>
export type DeleteDnsRecordInput = z.infer<typeof deleteDnsRecordSchema>
