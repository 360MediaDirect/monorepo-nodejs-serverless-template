import { Middleware } from '../types'
import { Embassy } from '@360mediadirect/embassy'
import log from '@360mediadirect/log'

/**
 * Middleware to verify JWT tokens from Authorization header.
 * If embassy is not provided (public API), skips token verification.
 */
const addVerifiedToken = (embassy?: Embassy): Middleware => {
  return async (req, _res, next) => {
    // Skip token verification for public APIs (no embassy configured)
    if (!embassy) return next()

    const auth = req.get('Authorization')
    if (!auth) return next()
    const match = auth.match(/^\s*Bearer (\S+)\s*$/)
    if (match) {
      log.info('Authorization header is Bearer', {
        reqId: req.id,
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
