import { cloudflaredPathSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { fail, ok } from '../response'
import { SettingsError, SettingsService } from '../services/settings'

export const settingsRoutes = new Hono()

function handleError(c: any, e: unknown) {
  if (e instanceof SettingsError)
    return fail(c, e.status, e.message)
  throw e
}

const service = new SettingsService()

settingsRoutes.get('/cloudflared-path', async (c) => {
  const path = await service.getCloudflaredPath()
  return ok(c, { path })
})

settingsRoutes.put('/cloudflared-path', async (c) => {
  const body = await c.req.json()
  const input = cloudflaredPathSchema.parse(body)

  try {
    const result = await service.setCloudflaredPath(input.path)
    return ok(c, result, 'saved')
  }
  catch (e) {
    return handleError(c, e)
  }
})
