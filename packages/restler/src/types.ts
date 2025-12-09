import { Request, Response, NextFunction } from 'express'
import { HttpError } from 'http-errors'
import { Token } from 'embassy'
import { OpenApiRequestMetadata } from 'express-openapi-validator/dist/framework/types'
import { Embassy } from 'embassy'

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

export type AppOptions = {
  controllers: ControllerMap
  embassy: Embassy
  basicAuth?: string
  log?: Logger
} & ({ specPath: string } | { apiSpec: any })

export const SilentSymbol = Symbol.for('silent')
