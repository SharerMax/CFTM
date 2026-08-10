import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'

interface TunnelProcess {
  process: ChildProcess
  tunnelId: string
  logs: string[]
  status: 'running' | 'error'
  exitCode: number | null
}

const MAX_LOG_LINES = 1000

class TunnelManager extends EventEmitter {
  private processes = new Map<string, TunnelProcess>()

  async start(tunnelId: string, config: object, token: string): Promise<void> {
    if (this.processes.has(tunnelId)) {
      throw new Error('Tunnel is already running')
    }

    const configDir = join(tmpdir(), 'cftm', tunnelId)
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true })
    }

    const configPath = join(configDir, 'config.yml')
    await writeFile(configPath, stringify(config))

    const logBuffer: string[] = []
    const proc = spawn('cloudflared', [
      'tunnel',
      'run',
      '--config',
      configPath,
      token,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    const tunnelProc: TunnelProcess = {
      process: proc,
      tunnelId,
      logs: logBuffer,
      status: 'running',
      exitCode: null,
    }

    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        const entry = `[${new Date().toISOString()}] ${line}`
        logBuffer.push(entry)
        if (logBuffer.length > MAX_LOG_LINES) {
          logBuffer.shift()
        }
        this.emit(`log:${tunnelId}`, entry)
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        const entry = `[${new Date().toISOString()}] [stderr] ${line}`
        logBuffer.push(entry)
        if (logBuffer.length > MAX_LOG_LINES) {
          logBuffer.shift()
        }
        this.emit(`log:${tunnelId}`, entry)
      }
    })

    proc.on('exit', (code) => {
      tunnelProc.status = code === 0 ? 'running' : 'error'
      tunnelProc.exitCode = code
      this.emit(`exit:${tunnelId}`, code)
    })

    proc.on('error', (err) => {
      tunnelProc.status = 'error'
      const entry = `[${new Date().toISOString()}] [error] ${err.message}`
      logBuffer.push(entry)
      this.emit(`log:${tunnelId}`, entry)
    })

    this.processes.set(tunnelId, tunnelProc)
  }

  stop(tunnelId: string): boolean {
    const tunnelProc = this.processes.get(tunnelId)
    if (!tunnelProc) {
      return false
    }

    tunnelProc.process.kill('SIGTERM')
    this.processes.delete(tunnelId)
    return true
  }

  getStatus(tunnelId: string): { status: string, exitCode: number | null } | null {
    const tunnelProc = this.processes.get(tunnelId)
    if (!tunnelProc)
      return null
    return { status: tunnelProc.status, exitCode: tunnelProc.exitCode }
  }

  getLogs(tunnelId: string): string[] {
    const tunnelProc = this.processes.get(tunnelId)
    if (!tunnelProc)
      return []
    return [...tunnelProc.logs]
  }

  isRunning(tunnelId: string): boolean {
    return this.processes.has(tunnelId)
  }
}

export const tunnelManager = new TunnelManager()
