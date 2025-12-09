import { Lambda } from 'aws-sdk'

export interface ServiceClientOptions {
  region?: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
}

export interface InvokeServiceOptions {
  invocationType?: 'Event' | 'RequestResponse' | 'DryRun'
  logType?: 'None' | 'Tail'
  clientContext?: string
  qualifier?: string
}

export interface ServiceResponse<T = any> {
  StatusCode?: number
  FunctionError?: string
  LogResult?: string
  Payload?: T
  ExecutedVersion?: string
}

export class ServiceClient {
  private lambda: Lambda

  constructor(options: ServiceClientOptions = {}) {
    const { region, endpoint, ...credentials } = options

    this.lambda = new Lambda({
      region: region || process.env.AWS_REGION || 'us-east-1',
      ...(endpoint && { endpoint }),
      ...(credentials.accessKeyId &&
        credentials.secretAccessKey &&
        credentials),
    })
  }

  /**
   * Invokes a Lambda service with the given payload
   * @param serviceHandler - The name or ARN of the Lambda function
   * @param payload - The payload to send to the Lambda function
   * @param options - Additional invoke options
   * @returns Promise resolving to the Lambda invoke response
   */
  async invokeService<TPayload = any, TResponse = any>(
    serviceHandler: string,
    payload: TPayload,
    options: InvokeServiceOptions = {},
  ): Promise<ServiceResponse<TResponse>> {
    const {
      invocationType = 'RequestResponse',
      logType,
      clientContext,
      qualifier,
    } = options

    const response = await this.lambda
      .invoke({
        FunctionName: serviceHandler,
        InvocationType: invocationType,
        Payload: JSON.stringify(payload),
        ...(logType && { LogType: logType }),
        ...(clientContext && { ClientContext: clientContext }),
        ...(qualifier && { Qualifier: qualifier }),
      })
      .promise()

    return {
      ...response,
      Payload: response.Payload
        ? JSON.parse(response.Payload.toString())
        : undefined,
    }
  }

  /**
   * Invokes a Lambda service asynchronously (fire-and-forget)
   * @param serviceHandler - The name or ARN of the Lambda function
   * @param payload - The payload to send to the Lambda function
   * @param options - Additional invoke options
   * @returns Promise resolving to the Lambda invoke response
   */
  async invokeServiceAsync<TPayload = any>(
    serviceHandler: string,
    payload: TPayload,
    options: Omit<InvokeServiceOptions, 'invocationType'> = {},
  ): Promise<ServiceResponse<void>> {
    return this.invokeService(serviceHandler, payload, {
      ...options,
      invocationType: 'Event',
    })
  }

  /**
   * Performs a dry run invocation to validate parameters and user permissions
   * @param serviceHandler - The name or ARN of the Lambda function
   * @param payload - The payload to send to the Lambda function
   * @param options - Additional invoke options
   * @returns Promise resolving to the Lambda invoke response
   */
  async validateInvoke<TPayload = any>(
    serviceHandler: string,
    payload: TPayload,
    options: Omit<InvokeServiceOptions, 'invocationType'> = {},
  ): Promise<ServiceResponse<void>> {
    return this.invokeService(serviceHandler, payload, {
      ...options,
      invocationType: 'DryRun',
    })
  }
}
