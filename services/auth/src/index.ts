import { createHandler } from '@360mediadirect/restler'
import log from '@360mediadirect/log'
import * as controllers from './controllers'
import apiSpec from '../openapi.json'
import { embassy } from './lib/authorizer'

export const httpHandler = createHandler({
  controllers,
  apiSpec,
  log,
  embassy,
})
