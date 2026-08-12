import { decrypt, encrypt } from '@cftm/shared/crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../prisma'
import { CloudflareApi } from '../services/cloudflare'

export const authRoutes = new Hono()

const verifySchema = z.object({
  token: z.string().min(1),
})

authRoutes.post('/verify', async (c) => {
  const body = await c.req.json()
  const { token } = verifySchema.parse(body)

  let result: { id: string, status: string }
  try {
    result = await new CloudflareApi(token).verifyToken()
  }
  catch (e) {
    return c.json({ error: 'invalid_token', message: (e as Error).message || 'Token 验证失败' }, 401)
  }

  const encrypted = encrypt(token)
  await prisma.setting.upsert({
    where: { key: 'cf_token' },
    update: { value: encrypted },
    create: { key: 'cf_token', value: encrypted },
  })

  return c.json({ success: true, tokenId: result.id, status: result.status })
})

authRoutes.get('/status', async (c) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'cf_token' } })
  if (!setting) {
    return c.json({ configured: false })
  }

  try {
    const token = decrypt(setting.value)
    const cf = new CloudflareApi(token)
    const result = await cf.verifyToken()
    return c.json({ configured: true, tokenId: result.id, status: result.status })
  }
  catch {
    return c.json({ configured: false, error: 'invalid_token' })
  }
})

export async function getCfTokenAsync(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: 'cf_token' } })
  if (!setting)
    return null
  try {
    return decrypt(setting.value)
  }
  catch {
    return null
  }
}
