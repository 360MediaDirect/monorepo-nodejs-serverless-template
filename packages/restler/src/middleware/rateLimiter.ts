import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { createError } from '../index'
import { RestRequest, RestResponse, Middleware } from '../types'
import { NextFunction } from 'express'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
})
const ddbDocClient = DynamoDBDocumentClient.from(client)

export interface RateLimitConfig {
  /**
   * DynamoDB table name for rate limiting
   * Defaults to RATE_LIMIT_TABLE_NAME env var
   */
  tableName?: string

  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number

  /**
   * Time window in seconds
   */
  windowSeconds: number

  /**
   * Key extractor function to determine rate limit key
   * Defaults to IP address
   */
  keyExtractor?: (req: RestRequest) => string

  /**
   * Custom error message
   */
  message?: string

  /**
   * Skip function to bypass rate limiting for certain requests
   */
  skip?: (req: RestRequest) => boolean | Promise<boolean>

  /**
   * Whether this rate limiter is enabled
   * Defaults to true
   */
  enabled?: boolean
}

interface RateLimitRecord {
  key: string
  count: number
  resetAt: number
  createdAt: number
  ttl: number
}

/**
 * Default key extractor uses IP address
 */
const defaultKeyExtractor = (req: RestRequest): string => {
  // Try to get real IP from headers (for requests behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded
    return ips.split(',')[0].trim()
  }

  const realIp = req.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  return req.ip || req.socket.remoteAddress || 'unknown'
}

/**
 * Creates a rate limiting middleware using DynamoDB for distributed rate limiting
 *
 * @example
 * // In AppOptions
 * {
 *   rateLimit: {
 *     maxRequests: 100,
 *     windowSeconds: 60
 *   }
 * }
 *
 * @example
 * // In OpenAPI spec for specific endpoint
 * {
 *   "paths": {
 *     "/auth/login/magiclink": {
 *       "post": {
 *         "x-rate-limit": {
 *           "maxRequests": 5,
 *           "windowSeconds": 3600,
 *           "keyExtractor": "email"
 *         }
 *       }
 *     }
 *   }
 * }
 */
export const createRateLimiter = (config: RateLimitConfig): Middleware => {
  const {
    tableName = process.env.RATE_LIMIT_TABLE_NAME,
    maxRequests,
    windowSeconds,
    keyExtractor = defaultKeyExtractor,
    message = 'Too many requests. Please try again later.',
    skip,
    enabled = true,
  } = config

  if (!enabled) {
    // Return no-op middleware if disabled
    return (_req: RestRequest, _res: RestResponse, next: NextFunction) => next()
  }

  if (!tableName) {
    console.warn(
      'Rate limiting is enabled but RATE_LIMIT_TABLE_NAME is not set. Rate limiting will be disabled.',
    )
    return (_req: RestRequest, _res: RestResponse, next: NextFunction) => next()
  }

  return async (req: RestRequest, res: RestResponse, next: NextFunction) => {
    try {
      // Check if we should skip rate limiting for this request
      if (skip) {
        const shouldSkip = await Promise.resolve(skip(req))
        if (shouldSkip) {
          return next()
        }
      }

      const key =
        typeof keyExtractor === 'function'
          ? keyExtractor(req)
          : defaultKeyExtractor(req)

      const now = Math.floor(Date.now() / 1000) // Current time in seconds
      const rateLimitKey = `${req.path}:${key}`

      // Try to get existing rate limit record
      const getResult = await ddbDocClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { key: rateLimitKey },
        }),
      )

      const existingRecord = getResult.Item as RateLimitRecord | undefined

      // If no record exists or window has expired, create new record
      if (!existingRecord || existingRecord.resetAt <= now) {
        const resetAt = now + windowSeconds
        const ttl = resetAt + 3600 // Keep records for 1 hour after expiry for audit

        await ddbDocClient.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              key: rateLimitKey,
              count: 1,
              resetAt,
              createdAt: now,
              ttl,
              path: req.path,
              identifier: key,
            },
          }),
        )

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests)
        res.setHeader('X-RateLimit-Remaining', maxRequests - 1)
        res.setHeader('X-RateLimit-Reset', resetAt)

        return next()
      }

      // Record exists and is still valid
      const { count, resetAt } = existingRecord

      // Check if limit exceeded
      if (count >= maxRequests) {
        const retryAfter = resetAt - now

        res.setHeader('X-RateLimit-Limit', maxRequests)
        res.setHeader('X-RateLimit-Remaining', 0)
        res.setHeader('X-RateLimit-Reset', resetAt)
        res.setHeader('Retry-After', retryAfter)

        throw createError(429, message, {
          retryAfter,
          resetAt,
        })
      }

      // Increment count
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { key: rateLimitKey },
          UpdateExpression: 'SET #count = #count + :inc',
          ExpressionAttributeNames: {
            '#count': 'count',
          },
          ExpressionAttributeValues: {
            ':inc': 1,
          },
        }),
      )

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', maxRequests - count - 1)
      res.setHeader('X-RateLimit-Reset', resetAt)

      next()
    } catch (error: any) {
      // If it's already an HTTP error, pass it through
      if (error.statusCode) {
        return next(error)
      }

      // Log unexpected errors but don't block the request
      req.log?.error?.('Rate limiter error:', error)

      // In case of DynamoDB errors, allow the request through (fail-open)
      // This ensures rate limiting failures don't break the app
      next()
    }
  }
}

/**
 * Preset rate limiter for login endpoints
 * Combines IP-based and email-based rate limiting
 */
export const loginRateLimiterPreset = (
  tableName?: string,
): [Middleware, Middleware] => {
  const ipLimiter = createRateLimiter({
    tableName,
    maxRequests: 10, // 10 requests per hour per IP
    windowSeconds: 3600,
    message:
      'Too many login attempts from this IP address. Please try again in an hour.',
  })

  const emailLimiter = createRateLimiter({
    tableName,
    maxRequests: 5, // 5 requests per hour per email
    windowSeconds: 3600,
    keyExtractor: (req) => {
      const email = req.body?.email
      return email ? String(email).toLowerCase() : 'unknown'
    },
    message:
      'Too many login attempts for this email address. Please try again in an hour.',
  })

  return [ipLimiter, emailLimiter]
}

/**
 * Preset rate limiter for API endpoints
 * IP-based with reasonable defaults
 */
export const apiRateLimiterPreset = (
  maxRequests = 100,
  windowSeconds = 60,
  tableName?: string,
): Middleware => {
  return createRateLimiter({
    tableName,
    maxRequests,
    windowSeconds,
    message: 'API rate limit exceeded. Please try again later.',
  })
}

export default createRateLimiter
