import { Middleware } from '../types'
import log from '@360mediadirect/log'

const logBeforeValidation = (): Middleware => {
  return (req, res, next) => {
    log.info('Before OpenAPI validation', {
      method: req.method,
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl,
    })
    next()
  }
}

export default logBeforeValidation
