import { AppOptions } from './types'
import { createApp } from './createApp'
import serverlessExpress from '@codegenie/serverless-express'

export const createHandler = (opts: AppOptions) => {
  const app = createApp(opts)
  return serverlessExpress({ app })
}
