const BASE = '/api'

interface RequestConfig {
  params?: Record<string, string>
}

function buildUrl(path: string, params?: Record<string, string>): string {
  if (!params)
    return `${BASE}${path}`
  const qs = new URLSearchParams(params).toString()
  return `${BASE}${path}?${qs}`
}

async function request<T>(path: string, init?: RequestInit, params?: Record<string, string>): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, config?: RequestConfig) => request<T>(path, undefined, config?.params),
  post: <T>(path: string, body?: unknown, config?: RequestConfig) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, config?.params),
  put: <T>(path: string, body?: unknown, config?: RequestConfig) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }, config?.params),
  delete: <T>(path: string, config?: RequestConfig) => request<T>(path, { method: 'DELETE' }, config?.params),
}
