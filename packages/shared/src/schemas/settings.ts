import { z } from 'zod'

export const cloudflaredPathSchema = z.object({
  path: z.string().max(4096),
})

export type CloudflaredPathInput = z.infer<typeof cloudflaredPathSchema>
