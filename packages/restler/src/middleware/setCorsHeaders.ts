import { Middleware } from '../types'

const setCorsHeaders = (): Middleware => {
  return (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    )
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-userid, DNT, x-api-version',
    )
    res.header('Access-Control-Expose-Headers', 'x-userid')

    // Handle preflight OPTIONS requests immediately
    if (req.method === 'OPTIONS') {
      res.status(200).end()
      return
    }

    next()
  }
}

export default setCorsHeaders
