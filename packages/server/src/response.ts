import type { ApiResponse } from '@cftm/shared/types'
import type { Context } from 'hono'

const OK_CODE = 0

export function ok<T>(c: Context, data: T, message = 'ok') {
  return c.json({ code: OK_CODE, message, data } satisfies ApiResponse<T>)
}

export function fail(c: Context, status: number, message: string) {
  return c.json(
    { code: status, message, data: null } satisfies ApiResponse<unknown>,
    status as Parameters<Context['json']>[1],
  )
}
