import openApiRoutes from '../../src/middleware/openApiRoutes'
import { ControllerMap, RestRequest, Middleware } from '../../src/types'
import createError from 'http-errors'
import log from '@360mediadirect/log'

// Mock the dependencies
jest.mock('express-openapi-validator', () => ({
  middleware: jest.fn(),
}))
jest.mock('http-errors')
jest.mock('@360mediadirect/log')

const {
  middleware: mockOpenApiMiddleware,
} = require('express-openapi-validator')
const mockCreateError = createError as jest.MockedFunction<typeof createError>
const mockLog = log as jest.Mocked<typeof log>

describe('openApiRoutes middleware', () => {
  let controllers: ControllerMap
  let mockController: Middleware

  beforeEach(() => {
    mockController = jest.fn()
    controllers = {
      getUserById: mockController,
      createUser: mockController,
    }
    jest.clearAllMocks()
  })

  it('should call openApiMiddleware with correct configuration', () => {
    const apiSpec = { paths: {} }

    mockOpenApiMiddleware.mockReturnValue([])

    openApiRoutes(apiSpec, controllers)

    expect(mockOpenApiMiddleware).toHaveBeenCalledWith({
      apiSpec,
      operationHandlers: {
        basePath: '',
        resolver: expect.any(Function),
      },
      validateSecurity: {
        handlers: {
          BasicAuth: expect.any(Function),
          JWTAuth: expect.any(Function),
          Internal: expect.any(Function),
        },
      },
    })
  })

  describe('resolver function', () => {
    let resolver: Function
    let apiDoc: any

    beforeEach(() => {
      const apiSpec = { paths: {} }
      mockOpenApiMiddleware.mockImplementation((config) => {
        resolver = config.operationHandlers.resolver
        return []
      })

      openApiRoutes(apiSpec, controllers)

      apiDoc = {
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
            },
          },
          '/users': {
            post: {
              operationId: 'createUser',
            },
          },
        },
      }
    })

    it('should return controller when found', () => {
      const route = {
        basePath: '',
        expressRoute: '/users/123',
        openApiRoute: '/users/{id}',
        method: 'GET',
        pathParams: { id: '123' },
      }

      const result = resolver('', route, apiDoc)

      expect(result).toBe(mockController)
    })

    it('should throw 404 when controller not found in controllers map', () => {
      const route = {
        basePath: '',
        expressRoute: '/unknown',
        openApiRoute: '/unknown',
        method: 'GET',
        pathParams: {},
      }

      const apiDocWithUnknown = {
        paths: {
          '/unknown': {
            get: {
              operationId: 'unknownController',
            },
          },
        },
      }

      const error = new Error('Not Found')
      mockCreateError.mockReturnValue(error as any)

      expect(() => resolver('', route, apiDocWithUnknown)).toThrow()
      expect(mockLog.error).toHaveBeenCalledWith(
        'Controller not found for openapi-defined endpoint (404)',
        {
          basePath: '',
          pathKey: '/unknown',
          controllerId: 'unknownController',
        },
      )
      expect(mockCreateError).toHaveBeenCalledWith(404)
    })

    it('should throw 404 when no operationId in path schema', () => {
      const route = {
        basePath: '',
        expressRoute: '/users',
        openApiRoute: '/users',
        method: 'GET',
        pathParams: {},
      }

      const apiDocWithoutOperationId = {
        paths: {
          '/users': {
            get: {
              // No operationId
            },
          },
        },
      }

      const error = new Error('Not Found')
      mockCreateError.mockReturnValue(error as any)

      expect(() => resolver('', route, apiDocWithoutOperationId)).toThrow()
      expect(mockCreateError).toHaveBeenCalledWith(404)
    })

    it('should handle basePath in route', () => {
      const route = {
        basePath: '/api/v1',
        expressRoute: '/api/v1/users/123',
        openApiRoute: '/api/v1/users/{id}',
        method: 'GET',
        pathParams: { id: '123' },
      }

      const apiDocWithBasePath = {
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
            },
          },
        },
      }

      const result = resolver('/api/v1', route, apiDocWithBasePath)

      expect(result).toBe(mockController)
    })
  })

  describe('security handlers', () => {
    let securityHandlers: any

    beforeEach(() => {
      const apiSpec = { paths: {} }
      mockOpenApiMiddleware.mockImplementation((config) => {
        securityHandlers = config.validateSecurity.handlers
        return []
      })

      openApiRoutes(apiSpec, controllers)
    })

    describe('BasicAuth handler', () => {
      it('should return true when request is basic authorized', () => {
        const req = { isBasicAuthorized: true } as RestRequest

        const result = securityHandlers.BasicAuth(req)

        expect(result).toBe(true)
      })

      it('should throw 401 when request is not basic authorized', () => {
        const req = { isBasicAuthorized: false } as RestRequest
        const error = new Error('Unauthorized')
        mockCreateError.mockReturnValue(error as any)

        expect(() => securityHandlers.BasicAuth(req)).toThrow()
        expect(mockCreateError).toHaveBeenCalledWith(401)
      })

      it('should throw 401 when isBasicAuthorized is undefined', () => {
        const req = {} as RestRequest
        const error = new Error('Unauthorized')
        mockCreateError.mockReturnValue(error as any)

        expect(() => securityHandlers.BasicAuth(req)).toThrow()
        expect(mockCreateError).toHaveBeenCalledWith(401)
      })
    })

    describe('JWTAuth handler', () => {
      it('should return true when token exists and no scopes required', async () => {
        const req = {
          token: {
            hasScopes: jest.fn().mockResolvedValue(true),
          },
        } as any

        const result = await securityHandlers.JWTAuth(req, [])

        expect(result).toBe(true)
      })

      it('should return true when token has required scopes', async () => {
        const req = {
          token: {
            hasScopes: jest.fn().mockResolvedValue(true),
          },
        } as any

        const result = await securityHandlers.JWTAuth(req, ['read', 'write'])

        expect(req.token.hasScopes).toHaveBeenCalledWith(['read', 'write'])
        expect(result).toBe(true)
      })

      it('should throw 401 when no token exists', async () => {
        const req = {} as RestRequest
        const error = new Error('Unauthorized')
        mockCreateError.mockReturnValue(error as any)

        await expect(securityHandlers.JWTAuth(req, [])).rejects.toThrow()
        expect(mockCreateError).toHaveBeenCalledWith(401)
      })

      it('should throw 403 when token lacks required scopes', async () => {
        const req = {
          token: {
            hasScopes: jest.fn().mockResolvedValue(false),
          },
        } as any
        const error = new Error('Forbidden')
        mockCreateError.mockReturnValue(error as any)

        await expect(securityHandlers.JWTAuth(req, ['admin'])).rejects.toThrow()
        expect(mockCreateError).toHaveBeenCalledWith(403)
      })

      it('should handle undefined scopes', async () => {
        const req = {
          token: {
            hasScopes: jest.fn(),
          },
        } as any

        const result = await securityHandlers.JWTAuth(req, undefined)

        expect(result).toBe(true)
        expect(req.token.hasScopes).not.toHaveBeenCalled()
      })
    })

    describe('Internal handler', () => {
      it('should return true when request is internal', () => {
        const req = { isInternal: true } as RestRequest

        const result = securityHandlers.Internal(req)

        expect(result).toBe(true)
      })

      it('should throw 401 when request is not internal', () => {
        const req = { isInternal: false } as RestRequest
        const error = new Error('Unauthorized')
        mockCreateError.mockReturnValue(error as any)

        expect(() => securityHandlers.Internal(req)).toThrow()
        expect(mockCreateError).toHaveBeenCalledWith(401)
      })

      it('should throw 401 when isInternal is undefined', () => {
        const req = {} as RestRequest
        const error = new Error('Unauthorized')
        mockCreateError.mockReturnValue(error as any)

        expect(() => securityHandlers.Internal(req)).toThrow()
        expect(mockCreateError).toHaveBeenCalledWith(401)
      })
    })
  })
})
