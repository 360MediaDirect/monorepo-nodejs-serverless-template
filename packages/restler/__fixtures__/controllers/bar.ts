import { createController } from '../../src/createController'

export const createBar = createController((_req, res) => {
  res.status(204).json({ bar: 'bar' })
})

export const updateBar = createController((req, res) => {
  res.json(req.body.bar)
})
