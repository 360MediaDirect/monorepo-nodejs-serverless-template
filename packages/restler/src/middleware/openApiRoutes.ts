import { Middleware, RestRequest } from '../types'
import { middleware as openApiMiddleware } from 'express-openapi-validator'
import createError from 'http-errors'
import { ControllerMap } from '../types'
import log from '@360mediadirect/log'

interface OAVRoute {
  basePath: string
  expressRoute: string
  openApiRoute: string
  method: string
  pathParams: Record<string, any>
}

const openApiRoutes = (
  apiSpec: string | any,
  controllers: ControllerMap,
): Middleware | Middleware[] => {
  return openApiMiddleware({
    apiSpec,
    operationHandlers: {
      basePath: '', // Unused
      resolver: (
        basePath: string,
        route: OAVRoute,
        apiDoc: any,
      ): Middleware => {
        // See issue: https://github.com/cdimascio/express-openapi-validator/issues/512
        const pathKey = route.openApiRoute.substring(route.basePath.length)
        const pathSchema = apiDoc.paths?.[pathKey]?.[route.method.toLowerCase()]
        const controllerId = pathSchema?.operationId
        if (!controllerId || !controllers[controllerId]) {
          log.error('Controller not found for openapi-defined endpoint (404)', {
            basePath,
            pathKey,
            controllerId,
          })
          throw createError(404)
        }
        return controllers[controllerId]
      },
    },
    validateSecurity: {
      handlers: {
        BasicAuth: (req: RestRequest) => {
          if (!req.isBasicAuthorized) throw createError(401)
          return true
        },
        JWTAuth: async (req: RestRequest, scopes) => {
          if (!req.token) throw createError(401)
          if (!scopes?.length) return true
          // Check if the token has all the listed "scopes" encoded as
          // permissions. 403 if not.
          const hasScopes = await req.token.hasScopes(scopes)
          if (!hasScopes) throw createError(403)
          return true
        },
        Internal: (req: RestRequest) => {
          if (!req.isInternal) throw createError(401)
          return true
        },
      },
    },
  })
}

export default openApiRoutes
