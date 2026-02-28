import { Request, Response, NextFunction } from 'express'
import { HttpError } from 'http-errors'
import { Token } from '@360mediadirect/embassy'
import { OpenApiRequestMetadata } from 'express-openapi-validator/dist/framework/types'
import { Embassy } from '@360mediadirect/embassy'

export type ControllerMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type ControllerRoute = string | RegExp

export type ControllerFunction = (
  req: RestRequest,
  res: Response,
) => void | Promise<void>

export interface EmbassyToken {
  getClaim: <T>(claim: string) => T
  getOption: <T>(domain: string, optName: string) => T
  hasPermission: (domain: string, permission: string) => Promise<boolean>
  hasPermissions: (domain: string, permissions: string[]) => Promise<boolean>
  verify: (options?: Record<string, any>) => Promise<void>
}

export type ControllerMap = Record<string, Middleware>

export type LogFunction = (...args: any[]) => void

export interface Logger {
  child: (obj?: Record<string, any>) => Logger
  error: LogFunction
  warn: LogFunction
  info: LogFunction
}

export interface RestRequest extends Request {
  apiGateway?: any
  id: string
  log: Logger
  startTime: Date
  matchedRoute: boolean
  token?: Token
  openapi?: OpenApiRequestMetadata
  isInternal?: boolean
  isBasicAuthorized?: boolean
}

export interface RestResponse extends Response {
  responseStatus?: number
  responseBody?: any
}

export type Middleware = (
  req: RestRequest,
  res: RestResponse,
  next: NextFunction,
) => any

export type ErrorHandlerMiddleware = (
  error: HttpError,
  req: RestRequest,
  res: RestResponse,
  next: NextFunction,
) => any

export interface RateLimitOptions {
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
   * Key extractor function or preset name
   * - function: Custom extractor
   * - "ip": Use IP address (default)
   * - "email": Use req.body.email
   * - "userId": Use req.token?.sub
   */
  keyExtractor?: ((req: RestRequest) => string) | 'ip' | 'email' | 'userId'

  /**
   * Custom error message
   */
  message?: string

  /**
   * Skip function to bypass rate limiting for certain requests
   */
  skip?: (req: RestRequest) => boolean | Promise<boolean>

  /**
   * Whether rate limiting is enabled
   * Defaults to true
   */
  enabled?: boolean
}

export type AppOptions = {
  controllers: ControllerMap
  /**
   * Embassy instance for JWT token verification.
   * Optional - if not provided, no token verification is performed.
   * Use this for public APIs that don't require authentication.
   */
  embassy?: Embassy
  basicAuth?: string
  log?: Logger
  /**
   * Service-level rate limiting configuration
   * Applied to all endpoints unless overridden
   */
  rateLimit?: RateLimitOptions | RateLimitOptions[]
} & ({ specPath: string } | { apiSpec: any })

export const SilentSymbol = Symbol.for('silent')
