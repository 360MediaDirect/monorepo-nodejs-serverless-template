import { Middleware } from '../types'

const exposeResponse = (): Middleware => {
  return (_req, res, next) => {
    const status = res.status
    const json = res.json
    const send = res.send
    res.status = (code: number) => {
      res.responseStatus = code
      return status.call(res, code)
    }
    res.json = (obj: Record<string, any>) => {
      res.responseBody = obj
      return json.call(res, obj)
    }
    res.send = (body: any) => {
      if (!res.responseBody) res.responseBody = body
      return send.call(res, body)
    }
    next()
  }
}

export default exposeResponse
