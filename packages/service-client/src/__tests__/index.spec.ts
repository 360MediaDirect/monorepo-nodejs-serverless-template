import {
  ServiceClient,
  ServiceClientOptions,
  InvokeServiceOptions,
  ServiceResponse,
} from '../index'

describe('service-client exports', () => {
  it('should export ServiceClient class', () => {
    expect(ServiceClient).toBeDefined()
    expect(typeof ServiceClient).toBe('function')
  })

  it('should export ServiceClientOptions interface', () => {
    // Test that interface is properly typed by creating valid objects
    const validOptions1: ServiceClientOptions = {}
    const validOptions2: ServiceClientOptions = {
      region: 'us-west-2',
    }
    const validOptions3: ServiceClientOptions = {
      region: 'us-west-2',
      endpoint: 'http://localhost:3001',
    }
    const validOptions4: ServiceClientOptions = {
      region: 'us-west-2',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    }

    expect(validOptions1).toBeDefined()
    expect(validOptions2).toBeDefined()
    expect(validOptions3).toBeDefined()
    expect(validOptions4).toBeDefined()
  })

  it('should export InvokeServiceOptions interface', () => {
    // Test that interface is properly typed
    const validOptions1: InvokeServiceOptions = {}
    const validOptions2: InvokeServiceOptions = {
      invocationType: 'RequestResponse',
    }
    const validOptions3: InvokeServiceOptions = {
      invocationType: 'Event',
      logType: 'Tail',
    }
    const validOptions4: InvokeServiceOptions = {
      invocationType: 'DryRun',
      logType: 'None',
      clientContext: 'test-context',
      qualifier: '$LATEST',
    }

    expect(validOptions1).toBeDefined()
    expect(validOptions2).toBeDefined()
    expect(validOptions3).toBeDefined()
    expect(validOptions4).toBeDefined()
  })

  it('should export ServiceResponse interface', () => {
    // Test that interface is properly typed
    const validResponse1: ServiceResponse = {}
    const validResponse2: ServiceResponse<string> = {
      StatusCode: 200,
      Payload: 'test response',
    }
    const validResponse3: ServiceResponse<{ data: number }> = {
      StatusCode: 200,
      FunctionError: undefined,
      LogResult: 'logs',
      Payload: { data: 123 },
      ExecutedVersion: '$LATEST',
    }

    expect(validResponse1).toBeDefined()
    expect(validResponse2).toBeDefined()
    expect(validResponse3).toBeDefined()
  })

  it('should enforce correct InvocationType values', () => {
    // This test ensures TypeScript compilation catches invalid values
    const validInvocationType1: InvokeServiceOptions['invocationType'] = 'Event'
    const validInvocationType2: InvokeServiceOptions['invocationType'] =
      'RequestResponse'
    const validInvocationType3: InvokeServiceOptions['invocationType'] =
      'DryRun'
    const validInvocationType4: InvokeServiceOptions['invocationType'] =
      undefined

    expect(validInvocationType1).toBe('Event')
    expect(validInvocationType2).toBe('RequestResponse')
    expect(validInvocationType3).toBe('DryRun')
    expect(validInvocationType4).toBeUndefined()
  })

  it('should enforce correct LogType values', () => {
    // This test ensures TypeScript compilation catches invalid values
    const validLogType1: InvokeServiceOptions['logType'] = 'None'
    const validLogType2: InvokeServiceOptions['logType'] = 'Tail'
    const validLogType3: InvokeServiceOptions['logType'] = undefined

    expect(validLogType1).toBe('None')
    expect(validLogType2).toBe('Tail')
    expect(validLogType3).toBeUndefined()
  })

  it('should allow ServiceClient instantiation with different option combinations', () => {
    expect(() => new ServiceClient()).not.toThrow()
    expect(() => new ServiceClient({})).not.toThrow()
    expect(() => new ServiceClient({ region: 'us-west-1' })).not.toThrow()
    expect(
      () =>
        new ServiceClient({
          region: 'us-west-1',
          endpoint: 'http://localhost:3001',
        }),
    ).not.toThrow()
  })
})
