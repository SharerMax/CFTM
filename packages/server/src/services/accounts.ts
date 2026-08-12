import type { CreateAccountInput, UpdateAccountInput } from '@cftm/shared/schemas'
import type { AccountDTO } from '@cftm/shared/types'
import { decrypt, encrypt } from '@cftm/shared/crypto'
import { prisma } from '../prisma'
import { CloudflareApi } from './cloudflare'

export class AccountError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function toDTO(account: {
  id: string
  name: string
  cloudflareAccountId: string
  cloudflareTokenId: string | null
  createdAt: Date
  updatedAt: Date
}): AccountDTO {
  return {
    id: account.id,
    name: account.name,
    cloudflareAccountId: account.cloudflareAccountId,
    cloudflareTokenId: account.cloudflareTokenId,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

export class AccountService {
  async list(): Promise<AccountDTO[]> {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return accounts.map(toDTO)
  }

  async create(input: CreateAccountInput): Promise<AccountDTO> {
    let tokenId: string | null = null
    try {
      const result = await new CloudflareApi(input.token).verifyToken()
      tokenId = result.id
    }
    catch {
      throw new AccountError('invalid_token', 401)
    }

    const account = await prisma.account.create({
      data: {
        name: input.name,
        cloudflareAccountId: input.cloudflareAccountId,
        encryptedToken: encrypt(input.token),
        cloudflareTokenId: tokenId,
      },
    })

    return toDTO(account)
  }

  async update(id: string, input: UpdateAccountInput): Promise<AccountDTO> {
    const account = await prisma.account.findUnique({ where: { id } })
    if (!account)
      throw new AccountError('not_found', 404)

    const data: {
      name?: string
      cloudflareAccountId?: string
      encryptedToken?: string
      cloudflareTokenId?: string | null
    } = {}

    if (input.name)
      data.name = input.name

    if (input.cloudflareAccountId)
      data.cloudflareAccountId = input.cloudflareAccountId

    if (input.token) {
      let tokenId: string | null = null
      try {
        const result = await new CloudflareApi(input.token).verifyToken()
        tokenId = result.id
      }
      catch {
        throw new AccountError('invalid_token', 401)
      }
      data.encryptedToken = encrypt(input.token)
      data.cloudflareTokenId = tokenId
    }

    const updated = await prisma.account.update({
      where: { id },
      data,
    })

    return toDTO(updated)
  }

  async remove(id: string): Promise<void> {
    const account = await prisma.account.findUnique({ where: { id } })
    if (!account)
      throw new AccountError('not_found', 404)

    const referenced = await prisma.tunnel.count({
      where: { accountId: account.cloudflareAccountId },
    })
    if (referenced > 0)
      throw new AccountError('account_in_use', 409)

    await prisma.account.delete({ where: { id } })
  }

  async getById(id: string): Promise<{ cloudflareAccountId: string, encryptedToken: string } | null> {
    const account = await prisma.account.findUnique({
      where: { id },
      select: { cloudflareAccountId: true, encryptedToken: true },
    })
    return account
  }

  async getTokenByAccountId(cloudflareAccountId: string): Promise<string | null> {
    const account = await prisma.account.findUnique({
      where: { cloudflareAccountId },
      select: { encryptedToken: true },
    })
    if (!account)
      return null
    return decrypt(account.encryptedToken)
  }

  async getTokenById(id: string): Promise<string | null> {
    const account = await prisma.account.findUnique({
      where: { id },
      select: { encryptedToken: true },
    })
    if (!account)
      return null
    return decrypt(account.encryptedToken)
  }
}
