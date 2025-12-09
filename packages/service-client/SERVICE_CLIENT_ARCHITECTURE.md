# Service Client Architecture

This document explains how the service client works between services in the Periodical platform, enabling cross-service communication within the serverless architecture.

## Overview

The service client architecture allows services to communicate with each other through direct Lambda invocations rather than HTTP API calls. This provides better performance, security, and reliability for internal service-to-service communication.

## Components

### 1. Service Client Package (`@360mediadirect/service-client`)

Located in `/packages/service-client/src/index.ts`, this package provides a simple wrapper around AWS Lambda invocations:

```typescript
import { Lambda } from 'aws-sdk'

export class ServiceClient {
  private lambda = new Lambda()

  async invokeService(serviceHandler: string, payload: any) {
    return this.lambda
      .invoke({
        FunctionName: serviceHandler,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload)
      })
      .promise()
  }
}
```

### 2. Internal API Handlers

Each service that wants to be callable by other services implements an `internalAPI.ts` handler that acts as a routing layer.

**Example from Issues Service** (`services/issues/src/internalAPI.ts`):

```typescript
export const fire: Handler = async (event, _context, _callback) => {
  log.debug('Issues Internal API', { event })

  switch (event.route) {
    case 'getIssueById':
      return await getIssueById(event)
    case 'findIssues':
      return await findIssues(event)
    default:
      break
  }
}
```

The internal API handler:
- Receives an event with a `route` parameter that determines which function to call
- Calls the appropriate service method based on the route
- Returns the result directly (no HTTP response formatting needed)

### 3. Service Client Usage

Services use the service client to invoke other services' internal APIs:

**Example from Email Service** (`services/email/src/controllers/sendSeeds.ts`):

```typescript
import { ServiceClient } from '@360mediadirect/service-client'

export const serviceClient = new ServiceClient()

// Usage
const res = await serviceClient.invokeService(
  `periodical-issues-${process.env.STAGE}-internalAPI`,
  { route: 'getIssueById', id: issueId }
)
const issues = res.Payload ? JSON.parse(res.Payload as string)?.issues : []
```

## Implementation Pattern

### Step 1: Create Internal API Handler

In the target service (the one being called), create `src/internalAPI.ts`:

```typescript
import log from '@360mediadirect/log'
import { Handler } from 'aws-lambda'
import { YourModel } from './models/YourModel'

const getSomethingById = async (event) => {
  const { id } = event
  
  let item
  try {
    item = await YourModel.get({ id })
  } catch (e) {
    log.error('Internal API: Could not get Item', { e, id })
  }
  return { items: [item] }
}

export const fire: Handler = async (event, _context, _callback) => {
  log.debug('Your Service Internal API', { event })

  switch (event.route) {
    case 'getSomethingById':
      return await getSomethingById(event)
    default:
      break
  }
}
```

### Step 2: Register Handler in serverless.yml

Add the internal API handler to your service's `serverless.yml`:

```yaml
functions:
  internalAPI:
    handler: src/internalAPI.fire
    events: [] # No external triggers, only direct invocations
```

### Step 3: Use Service Client in Calling Service

In the service that needs to call another service:

```typescript
import { ServiceClient } from '@360mediadirect/service-client'

const serviceClient = new ServiceClient()

// Call another service
const result = await serviceClient.invokeService(
  `periodical-{service-name}-${process.env.STAGE}-internalAPI`,
  { 
    route: 'getSomethingById', 
    id: 'some-id',
    // ... other parameters
  }
)

const data = result.Payload ? JSON.parse(result.Payload as string) : null
```

## Function Naming Convention

Service functions follow this naming pattern:
```
periodical-{service-name}-{stage}-internalAPI
```

Examples:
- `periodical-issues-dev-internalAPI`
- `periodical-subscriptions-prod-internalAPI`
- `periodical-entitlements-dev-internalAPI`

## Advantages

1. **Performance**: Direct Lambda invocations are faster than HTTP API calls
2. **Security**: No public endpoints exposed; communication happens within AWS VPC
3. **Reliability**: Less network overhead and fewer failure points
4. **Cost**: Lambda-to-Lambda invocations are cheaper than API Gateway calls
5. **Simplicity**: No need for authentication tokens or HTTP client configuration

## Migration Pattern

Services are being migrated from using the HTTP API client (`@360mediadirect/api-client`) to the service client for internal communication:

**Before** (using API client):
```typescript
const subscription = await client.updateSubscription(
  { id: subscription.id },
  { ...subscription, lastIssueId: issue.id }
)
```

**After** (using service client):
```typescript
const result = await serviceClient.invokeService(
  `periodical-subscriptions-${process.env.STAGE}-internalAPI`,
  { 
    route: 'updateSubscription',
    id: subscription.id,
    data: { ...subscription, lastIssueId: issue.id }
  }
)
```

## Testing Service Clients

When testing functions that use service clients, mock the `invokeService` method:

```typescript
import { ServiceClient } from '@360mediadirect/service-client'

// In test setup
const mockInvokeService = jest.fn()
ServiceClient.prototype.invokeService = mockInvokeService

// In test
mockInvokeService.mockResolvedValue({
  Payload: JSON.stringify({ items: [mockData] })
})
```

## Current Usage

The service client pattern is currently implemented in:
- **Issues Service**: Exposes `getIssueById` and `findIssues` via internal API
- **Email Service**: Uses service client to call Issues service for getting issue data

Services still using the HTTP API client for internal calls should be migrated to use the service client pattern for better performance and reliability.