import express, { Application } from 'express'
import qs from 'qs'
import addBasicAuth from './middleware/addBasicAuth'
import apiGateway from './middleware/apiGateway'
import addLogger from './middleware/addLogger'
import addRequestId from './middleware/addRequestId'
import addStartTime from './middleware/addStartTime'
import addVerifiedToken from './middleware/addVerifiedToken'
import setCorsHeaders from './middleware/setCorsHeaders'
import exposeResponse from './middleware/exposeResponse'
import logResponse from './middleware/logResponse'
import handleError from './middleware/handleError'
import openApiRoutes from './middleware/openApiRoutes'
import endResponse from './middleware/endResponse'
import restoreApiGatewayPath from './middleware/restoreApiGatewayPath'
import logBeforeValidation from './middleware/logBeforeValidation'
import { createRateLimiter } from './middleware/rateLimiter'
import { AppOptions, RestRequest } from './types'

/**
 * Converts RateLimitOptions keyExtractor presets to functions
 */
const resolveKeyExtractor = (
  keyExtractor?: ((req: RestRequest) => string) | 'ip' | 'email' | 'userId',
): ((req: RestRequest) => string) | undefined => {
  if (!keyExtractor) {
    return undefined
  }

  if (typeof keyExtractor === 'function') {
    return keyExtractor as (req: RestRequest) => string
  }

  switch (keyExtractor) {
    case 'email':
      return (req: RestRequest) => {
        const email = req.body?.email
        return email ? String(email).toLowerCase() : 'unknown'
      }
    case 'userId':
      return (req: RestRequest) => {
        return (req.token as any)?.sub || 'anonymous'
      }
    case 'ip':
    default:
      return undefined // Will use default IP extractor
  }
}

export const createApp = (opts: AppOptions): Application => {
  const spec = (opts as any).specPath || (opts as any).apiSpec
  const app = express()
  app.enable('trust proxy')
  app.use(addStartTime())
  app.use(express.json({ limit: '1mb' }))
  app.use(apiGateway())
  app.use(restoreApiGatewayPath())
  app.use(setCorsHeaders())
  app.use(addRequestId())
  app.use(addBasicAuth(opts.basicAuth))
  app.use(addVerifiedToken(opts.embassy))
  app.use(addLogger(opts.log))
  app.use(exposeResponse())

  // Add service-level rate limiting if configured
  if (opts.rateLimit) {
    const rateLimitConfigs = Array.isArray(opts.rateLimit)
      ? opts.rateLimit
      : [opts.rateLimit]

    rateLimitConfigs.forEach((config) => {
      const resolvedConfig = {
        ...config,
        keyExtractor: resolveKeyExtractor(config.keyExtractor),
      }
      app.use(createRateLimiter(resolvedConfig))
    })
  }

  app.use(logBeforeValidation())
  app.use(openApiRoutes(spec, opts.controllers))
  app.use(handleError())
  app.use(logResponse())
  app.use(endResponse())
  app.set('query parser', function (str) {
    return qs.parse(str, { comma: true })
  })
  return app
}
