import { Middleware } from '../types'

/**
 * A middleware to be placed as the last node of a middleware chain, ending
 * the response. This allows response bodies to be omitted in controllers
 * that only require sending back a status code. Otherwise, a 404 would be
 * returned.
 * @returns An Express middleware
 */
const endResponse = (): Middleware => {
  return (_req, res) => {
    res.end()
  }
}

export default endResponse
