import { createController } from '../../src/createController'

export const createError = createController(() => {
  throw new Error('Something horrible happened')
})

export const updateBaz = createController((_req, res) => {
  res.json({ msg: 'foo', token: 'bar' })
})

export const createBaz = createController((_req, res) => {
  res.status(201)
  res.json({ msg: 'foo' })
})
