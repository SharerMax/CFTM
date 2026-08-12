export interface AccountDTO {
  id: string
  name: string
  cloudflareAccountId: string
  cloudflareTokenId: string | null
  createdAt: string
  updatedAt: string
}
