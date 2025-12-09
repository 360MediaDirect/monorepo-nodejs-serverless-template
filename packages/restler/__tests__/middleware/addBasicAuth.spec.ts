import addBasicAuth from '../../src/middleware/addBasicAuth'
import { RestRequest, RestResponse } from '../../src/types'
import log from '@360mediadirect/log'

// Mock the logger
jest.mock('@360mediadirect/log')
const mockLog = log as jest.Mocked<typeof log>

describe('addBasicAuth middleware', () => {
  let req: Partial<RestRequest>
  let res: Partial<RestResponse>
  let next: jest.Mock

  beforeEach(() => {
    req = {
      id: 'test-req-id',
      get: jest.fn()
    }
    res = {}
    next = jest.fn()
    jest.clearAllMocks()
  })

  it('should call next() when no Authorization header is present', async () => {
    const mockGet = req.get as jest.Mock
    mockGet.mockReturnValue(undefined)

    const middleware = addBasicAuth('test-token')
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.isBasicAuthorized).toBeUndefined()
  })

  it('should call next() when Authorization header is not Basic', async () => {
    const mockGet = req.get as jest.Mock
    mockGet.mockReturnValue('Bearer some-token')

    const middleware = addBasicAuth('test-token')
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.isBasicAuthorized).toBeUndefined()
  })

  it('should set isBasicAuthorized to true when credentials match', async () => {
    const mockGet = req.get as jest.Mock
    const expectedToken = Buffer.from('username:password').toString('base64')
    mockGet.mockReturnValue(`Basic ${expectedToken}`)

    const middleware = addBasicAuth(expectedToken)
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(mockLog.info).toHaveBeenCalledWith(
      'Authorization header is Basic',
      { reqId: req.id }
    )
    expect(req.isBasicAuthorized).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should set isBasicAuthorized to false when credentials do not match', async () => {
    const mockGet = req.get as jest.Mock
    const providedToken = Buffer.from('username:password').toString('base64')
    const expectedToken = Buffer.from('admin:secret').toString('base64')
    mockGet.mockReturnValue(`Basic ${providedToken}`)

    const middleware = addBasicAuth(expectedToken)
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(mockLog.info).toHaveBeenCalledWith(
      'Authorization header is Basic',
      { reqId: req.id }
    )
    expect(req.isBasicAuthorized).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should handle Basic auth with extra whitespace', async () => {
    const mockGet = req.get as jest.Mock
    const expectedToken = Buffer.from('username:password').toString('base64')
    mockGet.mockReturnValue(`  Basic ${expectedToken}  `)

    const middleware = addBasicAuth(expectedToken)
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(req.isBasicAuthorized).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should work when basicAuth parameter is undefined', async () => {
    const mockGet = req.get as jest.Mock
    const token = Buffer.from('username:password').toString('base64')
    mockGet.mockReturnValue(`Basic ${token}`)

    const middleware = addBasicAuth(undefined)
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(req.isBasicAuthorized).toBe(false)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('should handle auth verification and call next in finally block', async () => {
    const mockGet = req.get as jest.Mock
    const expectedToken = Buffer.from('username:password').toString('base64')
    mockGet.mockReturnValue(`Basic ${expectedToken}`)

    const middleware = addBasicAuth(expectedToken)
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(req.isBasicAuthorized).toBe(true)
    expect(next).toHaveBeenCalledTimes(1)
    expect(mockLog.warn).not.toHaveBeenCalled()
  })

  it('should handle malformed Basic auth header gracefully', async () => {
    const mockGet = req.get as jest.Mock
    mockGet.mockReturnValue('Basic')

    const middleware = addBasicAuth('test-token')
    await middleware(req as RestRequest, res as RestResponse, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.isBasicAuthorized).toBeUndefined()
  })
})