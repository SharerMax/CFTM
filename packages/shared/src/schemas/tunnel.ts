import { z } from 'zod'

export const createTunnelSchema = z.object({
  name: z.string().min(1).max(64),
  accountId: z.string().min(1),
})

export const updateConfigSchema = z.object({
  'tunnel': z.string().optional(),
  'credentials-file': z.string().optional(),
  'ingress': z.array(z.object({
    hostname: z.string().optional(),
    service: z.string().min(1),
    path: z.string().optional(),
  })).min(1),
  'originRequest': z.record(z.string(), z.unknown()).optional(),
})

export const updateTunnelSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  accountId: z.string().min(1).optional(),
})

export type CreateTunnelInput = z.infer<typeof createTunnelSchema>
export type UpdateConfigInput = z.infer<typeof updateConfigSchema>
export type UpdateTunnelInput = z.infer<typeof updateTunnelSchema>
