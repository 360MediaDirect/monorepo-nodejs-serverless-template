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
import { AppOptions } from './types'

export const createApp = (opts: AppOptions): Application => {
  const spec = (opts as any).specPath || (opts as any).apiSpec
  const app = express()
  app.enable('trust proxy')
  app.use(addStartTime())
  app.use(express.json({ limit: '1mb' }))
  app.use(apiGateway())
  app.use(setCorsHeaders())
  app.use(addRequestId())
  app.use(addBasicAuth(opts.basicAuth))
  app.use(addVerifiedToken(opts.embassy))
  app.use(addLogger(opts.log))
  app.use(exposeResponse())
  app.use(openApiRoutes(spec, opts.controllers))
  app.use(handleError())
  app.use(logResponse())
  app.use(endResponse())
  app.set('query parser', function (str) {
    return qs.parse(str, { comma: true })
  })
  return app
}
