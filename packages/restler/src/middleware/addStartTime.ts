import { Middleware } from '../types'

const addStartTime = (): Middleware => {
  return (req, _res, next) => {
    req.startTime = new Date()
    next()
  }
}

export default addStartTime
