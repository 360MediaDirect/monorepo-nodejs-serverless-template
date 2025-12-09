import { Middleware } from '../types'
import { Embassy } from 'embassy'
import log from '@360mediadirect/log'

const addVerifiedToken = (embassy: Embassy): Middleware => {
  return async (req, _res, next) => {
    const auth = req.get('Authorization')
    if (!auth) return next()
    const match = auth.match(/^\s*Bearer (\S+)\s*$/)
    if (match) {
      log.info('Authorization header is Bearer', {
        reqId: req.id
      })
    } else {
      return next()
    }
    try {
      const token = embassy.parseToken(match[1])
      await token.verify()
      req.token = token
    } catch (e) {
      log.warn('Token verification failed', { reqId: req.id }, e)
    } finally {
      next()
    }
  }
}

export default addVerifiedToken
