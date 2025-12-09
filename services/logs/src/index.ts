import { createHandler } from '@360mediadirect/restler'
import log from '@360mediadirect/log'
import * as controllers from './controllers'
import apiSpec from '../openapi.json'

import { getEmbassy } from '../../../common/auth/getEmbassy'

export const httpHandler = createHandler({
  controllers,
  apiSpec,
  log,
  embassy: getEmbassy()
})
