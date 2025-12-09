import { getCurrentInvoke } from '@codegenie/serverless-express'
import { Middleware } from '../types'

const apiGateway = (): Middleware => {
  return (req, res, next) => {
    if (req.get('x-apigateway-event') || req.get('x-apigateway-context')) {
      req.apiGateway = getCurrentInvoke()
    } else next()
  }
}

export default apiGateway
