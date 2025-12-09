import { Middleware } from '../types'
import shortid from 'shortid'

const addRequestId = (): Middleware => {
  return (req, _res, next) => {
    req.id = req.get('x-reqid') || `req${shortid.generate()}`
    next()
  }
}

export default addRequestId
