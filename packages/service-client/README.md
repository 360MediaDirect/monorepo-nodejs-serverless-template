# @myorg/service-client

A typed AWS Lambda invocation client for service-to-service communication within the platform.

## Overview

- Wraps the AWS SDK v3 `@aws-sdk/client-lambda` with a simplified, type-safe interface
- Supports synchronous (`RequestResponse`), asynchronous (`Event`), and dry-run (`DryRun`) invocations
- Automatic JSON serialization of request payloads and deserialization of response payloads
- Configurable AWS region, custom endpoint, and explicit credentials
- Generic type parameters for both request payloads and response types
- Handles `Buffer` and string response payloads transparently

## Installation

```bash
yarn add @myorg/service-client
```

## Configuration

### Constructor Options

The `ServiceClient` constructor accepts an optional `ServiceClientOptions` object:

| Option           | Type     | Default                               | Description                              |
| ---------------- | -------- | ------------------------------------- | ---------------------------------------- |
| `region`         | `string` | `process.env.AWS_REGION \|\| 'us-east-1'` | AWS region for the Lambda client         |
| `endpoint`       | `string` | (none)                                | Custom endpoint URL (useful for local testing) |
| `accessKeyId`    | `string` | (none)                                | AWS access key ID (explicit credentials) |
| `secretAccessKey` | `string` | (none)                                | AWS secret access key (explicit credentials) |

**Region resolution order:**

1. `region` option passed to constructor
2. `AWS_REGION` environment variable
3. Falls back to `us-east-1`

**Credentials:** Both `accessKeyId` and `secretAccessKey` must be provided together. If only one is supplied, explicit credentials are ignored and the SDK falls back to its default credential chain (IAM role, environment variables, etc.).

## Usage

### Basic Invocation (Synchronous)

```typescript
import { ServiceClient } from '@myorg/service-client'

const client = new ServiceClient({ region: 'us-east-1' })

const response = await client.invokeService('myapp-dev-publishers', {
  httpMethod: 'GET',
  path: '/publishers',
  queryStringParameters: { limit: '10' },
})

if (response.FunctionError) {
  console.error('Lambda error:', response.Payload)
} else {
  console.log('Result:', response.Payload)
}
```

### Typed Payloads and Responses

```typescript
interface GetPublishersPayload {
  httpMethod: string
  path: string
  queryStringParameters: Record<string, string>
}

interface GetPublishersResponse {
  statusCode: number
  body: string
}

const response = await client.invokeService<GetPublishersPayload, GetPublishersResponse>(
  'myapp-dev-publishers',
  {
    httpMethod: 'GET',
    path: '/publishers',
    queryStringParameters: { limit: '10' },
  },
)

// response.Payload is typed as GetPublishersResponse | undefined
```

### Asynchronous Invocation (Fire-and-Forget)

Use `invokeServiceAsync` to trigger a Lambda function without waiting for the result. The invocation type is set to `Event`, and AWS returns a `202` status code immediately.

```typescript
const response = await client.invokeServiceAsync('myapp-dev-process-job', {
  jobId: 'abc-123',
  action: 'recalculate',
})

console.log(response.StatusCode) // 202
```

### Dry Run Validation

Use `validateInvoke` to verify that the caller has permission to invoke the function and the payload is valid, without actually executing the function.

```typescript
const response = await client.validateInvoke('myapp-dev-publishers', {
  httpMethod: 'GET',
  path: '/publishers',
})

console.log(response.StatusCode) // 204 if validation passes
```

### Custom Endpoint (Local Development)

```typescript
const client = new ServiceClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:3001',
})
```

### Invoke Options

All invocation methods accept an optional `InvokeServiceOptions` object:

| Option           | Type                                         | Default             | Description                                     |
| ---------------- | -------------------------------------------- | ------------------- | ----------------------------------------------- |
| `invocationType` | `'Event' \| 'RequestResponse' \| 'DryRun'`  | `'RequestResponse'` | Lambda invocation type                          |
| `logType`        | `'None' \| 'Tail'`                           | (none)              | Set to `'Tail'` to include execution logs       |
| `clientContext`   | `string`                                     | (none)              | Custom client context passed to the function    |
| `qualifier`      | `string`                                     | (none)              | Function version or alias (e.g., `'$LATEST'`)  |

```typescript
const response = await client.invokeService(
  'myapp-dev-publishers',
  { httpMethod: 'GET', path: '/publishers' },
  {
    logType: 'Tail',
    qualifier: '$LATEST',
  },
)

// Access execution logs (base64-encoded)
console.log(response.LogResult)
```

## API Reference

### `ServiceClient`

#### `constructor(options?: ServiceClientOptions)`

Creates a new service client instance backed by an AWS Lambda client.

#### `invokeService<TPayload, TResponse>(serviceHandler, payload, options?): Promise<ServiceResponse<TResponse>>`

Invokes a Lambda function synchronously (default `RequestResponse`). The payload is JSON-serialized automatically. The response payload is JSON-deserialized into the `TResponse` type.

**Parameters:**

- `serviceHandler` (`string`) -- Lambda function name or ARN
- `payload` (`TPayload`) -- Request data (will be JSON-stringified)
- `options` (`InvokeServiceOptions`, optional) -- Invocation options

#### `invokeServiceAsync<TPayload>(serviceHandler, payload, options?): Promise<ServiceResponse<void>>`

Invokes a Lambda function asynchronously with `invocationType: 'Event'`. Returns immediately with a `202` status code. The `invocationType` option cannot be overridden.

#### `validateInvoke<TPayload>(serviceHandler, payload, options?): Promise<ServiceResponse<void>>`

Performs a dry-run invocation with `invocationType: 'DryRun'`. Validates permissions and parameters without executing the function. Returns `204` on success. The `invocationType` option cannot be overridden.

### `ServiceResponse<T>`

| Field             | Type                  | Description                                        |
| ----------------- | --------------------- | -------------------------------------------------- |
| `StatusCode`      | `number \| undefined` | HTTP status code from Lambda                       |
| `FunctionError`   | `string \| undefined` | Error type if the function failed (e.g., `'Unhandled'`) |
| `LogResult`       | `string \| undefined` | Base64-encoded execution logs (when `logType: 'Tail'`) |
| `Payload`         | `T \| undefined`      | Deserialized response payload                      |
| `ExecutedVersion` | `string \| undefined` | Version of the function that was executed           |

### `ServiceClientOptions`

| Field            | Type                  | Description                  |
| ---------------- | --------------------- | ---------------------------- |
| `region`         | `string \| undefined` | AWS region                   |
| `endpoint`       | `string \| undefined` | Custom Lambda endpoint URL   |
| `accessKeyId`    | `string \| undefined` | AWS access key ID            |
| `secretAccessKey` | `string \| undefined` | AWS secret access key        |

### `InvokeServiceOptions`

| Field            | Type                                                        | Description                    |
| ---------------- | ----------------------------------------------------------- | ------------------------------ |
| `invocationType` | `'Event' \| 'RequestResponse' \| 'DryRun' \| undefined`    | Lambda invocation type         |
| `logType`        | `'None' \| 'Tail' \| undefined`                             | Whether to include logs        |
| `clientContext`  | `string \| undefined`                                       | Custom client context          |
| `qualifier`      | `string \| undefined`                                       | Function version or alias      |

## Error Handling

The client does not catch errors from the AWS SDK. Callers should handle errors appropriately:

```typescript
try {
  const response = await client.invokeService('my-function', payload)

  // Check for Lambda-level function errors
  if (response.FunctionError) {
    console.error('Function error:', response.FunctionError, response.Payload)
    return
  }

  // Use the response
  console.log(response.Payload)
} catch (error) {
  // AWS SDK errors (network issues, permission denied, function not found, etc.)
  console.error('Invocation failed:', error)
}
```

**Note:** If the Lambda response contains malformed JSON in the payload, the deserialization step will throw a `SyntaxError`.

## Development

```bash
# Install dependencies
yarn install

# Run linter and tests with coverage
yarn test

# Run tests in watch mode
yarn test:watch

# Lint only
yarn lint

# Lint and auto-fix
yarn lint:fix

# Build
yarn build

# Clean build artifacts
yarn clean
```

## License

UNLICENSED
