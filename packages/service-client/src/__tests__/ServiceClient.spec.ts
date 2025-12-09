import {
  ServiceClient,
  ServiceClientOptions,
  InvokeServiceOptions
} from '../index'
import * as AWS from 'aws-sdk'

// Mock AWS SDK
const mockInvoke = jest.fn()
const mockLambda = {
  invoke: mockInvoke
}

jest.mock('aws-sdk', () => ({
  Lambda: jest.fn(() => mockLambda)
}))

const MockedLambda = AWS.Lambda as jest.MockedClass<typeof AWS.Lambda>

describe('ServiceClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    delete process.env.AWS_REGION
  })

  describe('constructor', () => {
    it('should create ServiceClient with default options', () => {
      new ServiceClient()

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'us-east-1'
      })
    })

    it('should use AWS_REGION environment variable when available', () => {
      process.env.AWS_REGION = 'us-west-2'

      new ServiceClient()

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'us-west-2'
      })
    })

    it('should use provided region option', () => {
      const options: ServiceClientOptions = {
        region: 'eu-west-1'
      }

      new ServiceClient(options)

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'eu-west-1'
      })
    })

    it('should use provided endpoint option', () => {
      const options: ServiceClientOptions = {
        region: 'us-east-1',
        endpoint: 'http://localhost:3001'
      }

      new ServiceClient(options)

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'us-east-1',
        endpoint: 'http://localhost:3001'
      })
    })

    it('should use provided AWS credentials', () => {
      const options: ServiceClientOptions = {
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key'
      }

      new ServiceClient(options)

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key'
      })
    })

    it('should prioritize provided region over environment variable', () => {
      process.env.AWS_REGION = 'us-west-2'
      const options: ServiceClientOptions = {
        region: 'eu-west-1'
      }

      new ServiceClient(options)

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'eu-west-1'
      })
    })

    it('should not include credentials when only partial credentials provided', () => {
      const options: ServiceClientOptions = {
        region: 'us-east-1',
        accessKeyId: 'test-access-key'
        // Missing secretAccessKey
      }

      new ServiceClient(options)

      expect(MockedLambda).toHaveBeenCalledWith({
        region: 'us-east-1'
      })
    })
  })

  describe('invokeService', () => {
    let client: ServiceClient
    let mockPromise: jest.Mock

    beforeEach(() => {
      client = new ServiceClient()
      mockPromise = jest.fn()
      mockInvoke.mockReturnValue({
        promise: mockPromise
      })
    })

    it('should invoke Lambda function with default parameters', async () => {
      const mockResponse = {
        StatusCode: 200,
        Payload: JSON.stringify({ result: 'success' })
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', {
        data: 'test'
      })

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ data: 'test' })
      })

      expect(result).toEqual({
        StatusCode: 200,
        Payload: { result: 'success' }
      })
    })

    it('should handle string payload', async () => {
      const mockResponse = {
        StatusCode: 200,
        Payload: '"Hello World"'
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', 'hello')

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify('hello')
      })

      expect(result.Payload).toBe('Hello World')
    })

    it('should handle null payload', async () => {
      const mockResponse = {
        StatusCode: 200,
        Payload: 'null'
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', null)

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'RequestResponse',
        Payload: 'null'
      })

      expect(result.Payload).toBeNull()
    })

    it('should handle empty response payload', async () => {
      const mockResponse = {
        StatusCode: 200
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', {
        data: 'test'
      })

      expect(result.Payload).toBeUndefined()
    })

    it('should handle Buffer payload response', async () => {
      const mockResponse = {
        StatusCode: 200,
        Payload: Buffer.from(JSON.stringify({ result: 'success' }))
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', {
        data: 'test'
      })

      expect(result.Payload).toEqual({ result: 'success' })
    })

    it('should invoke with custom invocation type', async () => {
      const mockResponse = { StatusCode: 202 }
      mockPromise.mockResolvedValue(mockResponse)

      const options: InvokeServiceOptions = {
        invocationType: 'Event'
      }

      await client.invokeService('test-function', { data: 'test' }, options)

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'Event',
        Payload: JSON.stringify({ data: 'test' })
      })
    })

    it('should invoke with all optional parameters', async () => {
      const mockResponse = { StatusCode: 200 }
      mockPromise.mockResolvedValue(mockResponse)

      const options: InvokeServiceOptions = {
        invocationType: 'RequestResponse',
        logType: 'Tail',
        clientContext: 'test-context',
        qualifier: '$LATEST'
      }

      await client.invokeService('test-function', { data: 'test' }, options)

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ data: 'test' }),
        LogType: 'Tail',
        ClientContext: 'test-context',
        Qualifier: '$LATEST'
      })
    })

    it('should handle function errors', async () => {
      const mockResponse = {
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: JSON.stringify({
          errorMessage: 'Task timed out after 3.00 seconds'
        })
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', {
        data: 'test'
      })

      expect(result.FunctionError).toBe('Unhandled')
      expect(result.Payload).toEqual({
        errorMessage: 'Task timed out after 3.00 seconds'
      })
    })

    it('should handle AWS SDK errors', async () => {
      const error = new Error('Function not found')
      mockPromise.mockRejectedValue(error)

      await expect(
        client.invokeService('non-existent-function', { data: 'test' })
      ).rejects.toThrow('Function not found')
    })

    it('should handle malformed JSON in response payload', async () => {
      const mockResponse = {
        StatusCode: 200,
        Payload: 'invalid-json'
      }
      mockPromise.mockResolvedValue(mockResponse)

      await expect(
        client.invokeService('test-function', { data: 'test' })
      ).rejects.toThrow()
    })

    it('should preserve all response fields', async () => {
      const mockResponse = {
        StatusCode: 200,
        FunctionError: undefined,
        LogResult: 'base64-encoded-logs',
        Payload: JSON.stringify({ result: 'success' }),
        ExecutedVersion: '$LATEST'
      }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeService('test-function', {
        data: 'test'
      })

      expect(result).toEqual({
        StatusCode: 200,
        FunctionError: undefined,
        LogResult: 'base64-encoded-logs',
        Payload: { result: 'success' },
        ExecutedVersion: '$LATEST'
      })
    })
  })

  describe('invokeServiceAsync', () => {
    let client: ServiceClient
    let mockPromise: jest.Mock

    beforeEach(() => {
      client = new ServiceClient()
      mockPromise = jest.fn()
      mockInvoke.mockReturnValue({
        promise: mockPromise
      })
    })

    it('should invoke Lambda function asynchronously', async () => {
      const mockResponse = { StatusCode: 202 }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.invokeServiceAsync('test-function', {
        data: 'test'
      })

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'Event',
        Payload: JSON.stringify({ data: 'test' })
      })

      expect(result.StatusCode).toBe(202)
    })

    it('should invoke with additional options', async () => {
      const mockResponse = { StatusCode: 202 }
      mockPromise.mockResolvedValue(mockResponse)

      await client.invokeServiceAsync(
        'test-function',
        { data: 'test' },
        {
          logType: 'Tail',
          qualifier: 'v1'
        }
      )

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'Event',
        Payload: JSON.stringify({ data: 'test' }),
        LogType: 'Tail',
        Qualifier: 'v1'
      })
    })
  })

  describe('validateInvoke', () => {
    let client: ServiceClient
    let mockPromise: jest.Mock

    beforeEach(() => {
      client = new ServiceClient()
      mockPromise = jest.fn()
      mockInvoke.mockReturnValue({
        promise: mockPromise
      })
    })

    it('should perform dry run invocation', async () => {
      const mockResponse = { StatusCode: 204 }
      mockPromise.mockResolvedValue(mockResponse)

      const result = await client.validateInvoke('test-function', {
        data: 'test'
      })

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'DryRun',
        Payload: JSON.stringify({ data: 'test' })
      })

      expect(result.StatusCode).toBe(204)
    })

    it('should validate with additional options', async () => {
      const mockResponse = { StatusCode: 204 }
      mockPromise.mockResolvedValue(mockResponse)

      await client.validateInvoke(
        'test-function',
        { data: 'test' },
        {
          clientContext: 'validation-context'
        }
      )

      expect(mockInvoke).toHaveBeenCalledWith({
        FunctionName: 'test-function',
        InvocationType: 'DryRun',
        Payload: JSON.stringify({ data: 'test' }),
        ClientContext: 'validation-context'
      })
    })
  })

  describe('type safety', () => {
    let client: ServiceClient

    beforeEach(() => {
      client = new ServiceClient()
      mockInvoke.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ StatusCode: 200, Payload: '{}' })
      })
    })

    it('should support typed payload and response', async () => {
      interface TestPayload {
        userId: string
        action: string
      }

      interface TestResponse {
        success: boolean
        data: any[]
      }

      const payload: TestPayload = {
        userId: '123',
        action: 'getData'
      }

      // This should compile without TypeScript errors
      const result = await client.invokeService<TestPayload, TestResponse>(
        'test-function',
        payload
      )

      expect(typeof result).toBe('object')
    })

    it('should support any type for payload when not specified', async () => {
      // These should all compile without TypeScript errors
      await client.invokeService('test-function', { any: 'object' })
      await client.invokeService('test-function', 'string')
      await client.invokeService('test-function', 123)
      await client.invokeService('test-function', null)
      await client.invokeService('test-function', undefined)
    })
  })
})
