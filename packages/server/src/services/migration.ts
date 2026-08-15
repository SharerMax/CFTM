import { decrypt, encrypt } from '@cftm/shared/crypto'
import { logger } from '../logger'
import { prisma } from '../prisma'
import { CloudflareApi } from './cloudflare'

export async function migrateLegacyToken(): Promise<void> {
  const setting = await prisma.setting.findUnique({ where: { key: 'cf_token' } })
  if (!setting)
    return

  try {
    const token = decrypt(setting.value)
    let tokenId: string | null = null
    try {
      const result = await new CloudflareApi(token).verifyToken()
      tokenId = result.id
    }
    catch (e) {
      logger.warn({ error: (e as Error).message }, 'migration_token_verify_failed')
    }

    const existing = await prisma.account.findFirst({
      where: { cloudflareTokenId: tokenId },
    })

    if (!existing) {
      await prisma.account.create({
        data: {
          name: 'default',
          cloudflareAccountId: '',
          encryptedToken: encrypt(token),
          cloudflareTokenId: tokenId,
        },
      })
    }

    await prisma.setting.delete({ where: { key: 'cf_token' } })
  }
  catch (e) {
    logger.warn({ error: (e as Error).message }, 'migration_decrypt_failed')
    await prisma.setting.delete({ where: { key: 'cf_token' } })
  }
}
