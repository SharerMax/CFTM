import { createAccountSchema, updateAccountSchema } from '@cftm/shared/schemas'
import { Hono } from 'hono'
import { fail, ok } from '../response'
import { AccountError, AccountService } from '../services/accounts'

export const accountRoutes = new Hono()

function handleError(c: any, e: unknown) {
  if (e instanceof AccountError)
    return fail(c, e.status, e.message)
  throw e
}

accountRoutes.get('/', async (c) => {
  const accounts = await new AccountService().list()
  return ok(c, accounts)
})

accountRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const input = createAccountSchema.parse(body)

  try {
    const account = await new AccountService().create(input)
    return ok(c, account, 'created')
  }
  catch (e) {
    return handleError(c, e)
  }
})

accountRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const input = updateAccountSchema.parse(body)

  try {
    const account = await new AccountService().update(id, input)
    return ok(c, account, 'updated')
  }
  catch (e) {
    return handleError(c, e)
  }
})

accountRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    await new AccountService().remove(id)
    return ok(c, { success: true }, 'deleted')
  }
  catch (e) {
    return handleError(c, e)
  }
})
