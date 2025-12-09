import { Middleware, SilentSymbol } from '../types'

const logResponse = (): Middleware => {
  return (req, res, next) => {
    if (res.responseBody !== SilentSymbol && req.log) {
      const endTime = new Date()
      req.log.info('Response sent', {
        status: res.responseStatus || 200,
        body: res.responseBody || '',
        startTime: req.startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs: endTime.getTime() - req.startTime.getTime()
      })
    }
    next()
  }
}

export default logResponse
