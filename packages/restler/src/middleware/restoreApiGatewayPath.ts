import { Middleware } from '../types'
import log from '@360mediadirect/log'

/**
 * Middleware to restore the original API Gateway path before express-openapi-validator
 * processes it. serverless-express strips the base path, but we need the full path
 * to match against the OpenAPI spec.
 */
const restoreApiGatewayPath = (): Middleware => {
  return (req, res, next) => {
    const event = (req as any).apiGateway?.event

    log.info('restoreApiGatewayPath', {
      hasApiGateway: !!(req as any).apiGateway,
      hasEvent: !!event,
      eventPath: event?.path,
      eventResource: event?.resource,
      reqUrl: req.url,
      reqPath: req.path,
      reqOriginalUrl: req.originalUrl,
    })

    if (event?.path) {
      const oldUrl = req.url
      const oldOriginalUrl = req.originalUrl

      // Preserve query string if present
      const queryIndex = req.url.indexOf('?')
      const newUrl =
        queryIndex > -1
          ? event.path + req.url.substring(queryIndex)
          : event.path

      // Update both url and originalUrl
      req.url = newUrl
      ;(req as any).originalUrl = newUrl

      log.info('restoreApiGatewayPath - restored', {
        oldUrl,
        oldOriginalUrl,
        newUrl: req.url,
        newOriginalUrl: req.originalUrl,
        method: req.method,
      })
    }
    next()
  }
}

export default restoreApiGatewayPath
