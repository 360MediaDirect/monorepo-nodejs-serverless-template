import { Middleware } from '../types'

const setCorsHeaders = (): Middleware => {
  return (_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, x-userid, DNT, x-api-version',
    )
    res.header('Access-Control-Expose-Headers', 'x-userid')
    next()
  }
}

export default setCorsHeaders
