import { decrypt, encrypt } from '@cftm/shared/crypto'
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
      console.warn('[migration] cf_token verify failed:', (e as Error).message)
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
    console.warn('[migration] cf_token could not be decrypted:', (e as Error).message)
    await prisma.setting.delete({ where: { key: 'cf_token' } })
  }
}
