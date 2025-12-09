import { Logger, Middleware } from '../types'
import nopLogger from '../lib/nopLogger'

const tokenClaims = ['sub', 'email', 'name', 'iat', 'exp', 'iss']

const addLogger = (log?: Logger): Middleware => {
  return (req, _res, next) => {
    const logger = log || nopLogger
    const claims =
      req.token &&
      tokenClaims.reduce((acc, claim) => {
        const value = req.token.claims[claim]
        if (value) acc[claim] = value
        return acc
      }, {})
    req.log = logger.child({
      path: req.path,
      url: req.originalUrl,
      isInternal: !!req.isInternal,
      ...(req.apiGateway && {
        awsRequestId: req.apiGateway.context.awsRequestId,
        ipAddress: req.apiGateway.event.requestContext.identity.sourceIp,
      }),
      ...(req.id && { reqId: req.id }),
      ...(claims && { claims }),
    })
    next()
  }
}

export default addLogger
