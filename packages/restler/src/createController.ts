import { Middleware, ControllerFunction, SilentSymbol } from './types'
import { redact as redactObj } from './lib/redact'

export const REQ_REDACT_KEY = 'x-restler-request-redact'
export const RES_REDACT_KEY = 'x-restler-response-redact'
export const CACHE_CONTROL_KEY = 'x-restler-cache-control'

export const DEFAULT_CACHE_CONTROL =
  process.env.DEFAULT_CACHE_CONTROL || 'no-cache, no-store'

interface HasLength extends Record<string, any> {
  length: number
}

function hasLength(obj: any): obj is HasLength {
  return (typeof obj === 'object' && 'length' in obj) || typeof obj === 'string'
}

export type RedactTarget = 'silent' | 'body' | string[]

/**
 * Redacts the message body according to the following rules:
 *
 * - If the message body is a Buffer, it is always redacted according to the
 *   "body" section below, regardless of whether or not "body" was specified as
 *   the target.
 * - If the redact target is "silent", this function returns SilentSymbol
 * - If the redact target is "body", returns "REDACTED type[length]" where the
 *   type is array, binary, object, or other js native, and length is the
 *   `length` property if available, or the number of keys for objects. Length
 *   is omitted if unavailable.
 * - If the body is an object, the targeted field or fields will be replaced
 *   with the string "(REDACTED)"
 *
 * @param body - The message body to be manipulated
 * @param target - The targeting instructions for redacting the body
 * @returns SilentSymbol if the target indicates no logging at all should occur,
 * or a redacted string or object depending on the provided body and target.
 */
const redact = <T>(body: T, target: RedactTarget): T | string | symbol => {
  const isArray = Array.isArray(body)
  if (target === 'silent') return SilentSymbol
  if (target === 'body' || Buffer.isBuffer(body)) {
    let type: string = typeof body
    let len = hasLength(body) ? `[${body.length}]` : ''
    if (Buffer.isBuffer(body)) type = 'binary'
    else if (isArray) type = 'array'
    else if (typeof body === 'object') len = `[${Object.keys(body).length}]`
    return `REDACTED ${type}${len}`
  }
  if (!isArray && typeof body === 'object') return redactObj(body, target)
  return body
}

export const createController = (fn: ControllerFunction): Middleware => {
  return async (req, res, next) => {
    const reqRedact = req.openapi?.schema?.[REQ_REDACT_KEY] || []
    const resRedact = req.openapi?.schema?.[RES_REDACT_KEY] || []
    const cacheControl =
      req.openapi?.schema?.[CACHE_CONTROL_KEY] || DEFAULT_CACHE_CONTROL
    const reqLog = redact(req.body, reqRedact)
    if (reqLog !== SilentSymbol && req.log) {
      req.log.info('Request received', { body: reqLog })
    }
    try {
      if (cacheControl) res.set('Cache-Control', cacheControl)
      req.matchedRoute = true
      await fn(req, res)
    } catch (e) {
      return next(e)
    }
    res.responseBody = redact(res.responseBody, resRedact)
    next()
  }
}
