import { getCurrentInvoke } from '@codegenie/serverless-express'
import { Middleware } from '../types'

const apiGateway = (): Middleware => {
  return (req, res, next) => {
    // Always try to get the current invoke for API Gateway requests
    try {
      const invoke = getCurrentInvoke()
      if (invoke?.event) {
        req.apiGateway = invoke
      }
    } catch {
      // Not running in Lambda/API Gateway context, ignore
    }
    next()
  }
}

export default apiGateway
