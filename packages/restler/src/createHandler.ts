import { AppOptions } from './types'
import { APIGatewayProxyHandler } from 'aws-lambda'
import { createApp } from './createApp'
import serverlessExpress from '@codegenie/serverless-express'

export const createHandler = (opts: AppOptions): APIGatewayProxyHandler => {
  const app = createApp(opts)
  return serverlessExpress({ app })
}
