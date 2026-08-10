import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import process from 'node:process'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function getKey(): Uint8Array {
  const secret = process.env.CFTM_SECRET || 'cftm-dev-secret-change-in-production'
  const buf = new Uint8Array(KEY_LENGTH)
  const encoder = new TextEncoder()
  const encoded = encoder.encode(secret)
  buf.set(encoded.subarray(0, KEY_LENGTH))
  return buf
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const key = getKey()

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const data = new TextEncoder().encode(plaintext)
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, 'base64')

  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)

  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return new TextDecoder().decode(decrypted)
}
