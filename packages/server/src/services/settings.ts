import type { CloudflaredPathResult } from '@cftm/shared/types'
import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { logger } from '../logger'
import { prisma } from '../prisma'

const CLOUDFLARED_PATH_KEY = 'cloudflared_path'
const DEFAULT_BINARY = 'cloudflared'

export class SettingsError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function runCloudflaredVersion(binary: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawn(binary, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    }
    catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
      return
    }

    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('command timed out'))
    }, 5000)

    child.stdout?.on('data', (data: Buffer) => {
      out += data.toString()
    })
    child.stderr?.on('data', (data: Buffer) => {
      err += data.toString()
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(out.trim() || err.trim() || 'unknown version')
      }
      else {
        reject(new Error(err.trim() || `exit code ${code}`))
      }
    })
  })
}

export class SettingsService {
  async getCloudflaredPath(): Promise<string | null> {
    const setting = await prisma.setting.findUnique({ where: { key: CLOUDFLARED_PATH_KEY } })
    if (!setting)
      return null
    const value = setting.value.trim()
    return value || null
  }

  async resolveCloudflaredPath(): Promise<string> {
    return (await this.getCloudflaredPath()) || DEFAULT_BINARY
  }

  async setCloudflaredPath(path: string): Promise<CloudflaredPathResult> {
    const trimmed = path.trim()

    if (!trimmed) {
      await prisma.setting.delete({ where: { key: CLOUDFLARED_PATH_KEY } }).catch(() => {})
      logger.info({}, 'cloudflared_path_cleared')
      return { path: null, version: null }
    }

    let version: string
    try {
      version = await runCloudflaredVersion(trimmed)
    }
    catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      logger.warn({ path: trimmed, error: reason }, 'cloudflared_path_verify_failed')
      throw new SettingsError(`invalid_cloudflared_path: ${reason}`, 400)
    }

    await prisma.setting.upsert({
      where: { key: CLOUDFLARED_PATH_KEY },
      create: { key: CLOUDFLARED_PATH_KEY, value: trimmed },
      update: { value: trimmed },
    })

    logger.info({ path: trimmed, version }, 'cloudflared_path_saved')

    return { path: trimmed, version }
  }
}
