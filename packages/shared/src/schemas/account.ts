import { z } from 'zod'

export const createAccountSchema = z.object({
  name: z.string().min(1).max(64),
  cloudflareAccountId: z.string().min(1),
  token: z.string().min(1),
})

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  cloudflareAccountId: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
