import { Middleware } from '../types'
import log from '@360mediadirect/log'

const addBasicAuth = (basicAuth?: string): Middleware => {
  return async (req, _res, next) => {
    const auth = req.get('Authorization')
    if (!auth) return next()
    const match = auth.match(/^\s*Basic (\S+)\s*$/)
    if (match) {
      log.info('Authorization header is Basic', {
        reqId: req.id,
      })
    } else {
      return next()
    }
    try {
      req.isBasicAuthorized = match[1] === basicAuth
    } catch (e) {
      log.warn('Auth verification failed', { reqId: req.id }, e)
    } finally {
      next()
    }
  }
}

export default addBasicAuth
