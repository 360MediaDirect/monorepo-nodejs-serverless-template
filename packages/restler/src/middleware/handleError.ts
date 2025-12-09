import { ErrorHandlerMiddleware } from '../types'
import log from '@360mediadirect/log'

const handleError = (): ErrorHandlerMiddleware => {
  return (e, req, res, next) => {
    // Sanity check
    if (e) {
      const logger = req.log || log
      if (!req.matchedRoute) logger.warn('No route found for request')
      const showMessage = e.expose || e.status === 404 || e.errors
      const message = e.status === 404 ? 'Not Found' : e.message
      res.status(e.status || 500)
      res.json({
        error: showMessage ? message : 'Internal server error',
        ...(e.errors && { details: e.errors }),
        ...(e.errorCode && { errorCode: e.errorCode })
      })
      if (!res.responseStatus || res.responseStatus >= 500) {
        logger.error('Unexpected error during request', e)
      }
    }
    next()
  }
}

export default handleError
