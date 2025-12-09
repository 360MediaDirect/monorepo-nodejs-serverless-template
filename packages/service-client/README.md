# Service Client

A TypeScript library for direct Lambda-to-Lambda communication within the Periodical platform, providing high-performance service-to-service calls without HTTP overhead.

## Overview

The service client enables direct invocation of AWS Lambda functions from other Lambda functions, bypassing API Gateway for internal service communication. This provides better performance, security, and cost-effectiveness for service-to-service interactions.

## Installation

This package is only available to other packages and services in this monorepo. To add it as a dependency:

```shell
yarn lerna add @360mediadirect/service-client --scope YOUR_PACKAGE_NAME
```

## Core Components

### ServiceClient Class

The main class that wraps AWS Lambda SDK for direct function invocations:

```typescript
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

## Usage

### Basic Service Invocation

```typescript
import { ServiceClient } from '@360mediadirect/service-client'

const serviceClient = new ServiceClient()

// Call another service's internal API
const result = await serviceClient.invokeService(
  `periodical-issues-${process.env.STAGE}-internalAPI`,
  { 
    route: 'getIssueById', 
    id: 'issue-123' 
  }
)

// Parse the response
const response = result.Payload ? JSON.parse(result.Payload as string) : null
const issues = response?.issues || []
```

### Service Discovery Pattern

Use consistent naming for service functions:

```typescript
const serviceName = 'issues'
const stage = process.env.STAGE || 'dev'
const functionName = `periodical-${serviceName}-${stage}-internalAPI`

const result = await serviceClient.invokeService(functionName, {
  route: 'getIssueById',
  id: issueId
})
```

### Error Handling

```typescript
try {
  const result = await serviceClient.invokeService(functionName, payload)
  
  // Check for Lambda execution errors
  if (result.FunctionError) {
    throw new Error(`Service error: ${result.FunctionError}`)
  }
  
  const response = JSON.parse(result.Payload as string)
  return response
  
} catch (error) {
  console.error('Service invocation failed:', error)
  throw error
}
```

## Service Integration Patterns

### Issues Service Integration

```typescript
// Get issue data from issues service
const getIssueById = async (issueId: string) => {
  const result = await serviceClient.invokeService(
    `periodical-issues-${process.env.STAGE}-internalAPI`,
    { route: 'getIssueById', id: issueId }
  )
  
  const response = JSON.parse(result.Payload as string)
  return response.issues?.[0] || null
}

// Search for multiple issues
const findIssues = async (criteria: any) => {
  const result = await serviceClient.invokeService(
    `periodical-issues-${process.env.STAGE}-internalAPI`,
    { route: 'findIssues', ...criteria }
  )
  
  const response = JSON.parse(result.Payload as string)
  return response.issues || []
}
```

### Subscriptions Service Integration

```typescript
// Update subscription via service client
const updateSubscription = async (subscriptionId: string, updates: any) => {
  const result = await serviceClient.invokeService(
    `periodical-subscriptions-${process.env.STAGE}-internalAPI`,
    {
      route: 'updateSubscription',
      id: subscriptionId,
      data: updates
    }
  )
  
  return JSON.parse(result.Payload as string)
}
```

### User Service Integration  

```typescript
// Get user data
const getUserById = async (userId: string) => {
  const result = await serviceClient.invokeService(
    `periodical-auth-${process.env.STAGE}-internalAPI`,
    { route: 'getUserById', id: userId }
  )
  
  const response = JSON.parse(result.Payload as string)
  return response.users?.[0] || null
}
```

## Internal API Handler Pattern

Services expose internal APIs using consistent patterns:

```typescript
// services/[service-name]/src/internalAPI.ts
import { Handler } from 'aws-lambda'

const getItemById = async (event) => {
  const { id } = event
  
  try {
    const item = await Model.get({ id })
    return { items: [item] }
  } catch (error) {
    console.error('Internal API error:', error)
    throw error
  }
}

export const fire: Handler = async (event) => {
  console.log('Internal API called:', event)
  
  switch (event.route) {
    case 'getItemById':
      return await getItemById(event)
      
    case 'findItems':
      return await findItems(event)
      
    default:
      throw new Error(`Unknown route: ${event.route}`)
  }
}
```

## Advanced Usage

### Batch Operations

```typescript
// Process multiple items efficiently
const processBatch = async (items: any[]) => {
  const batchSize = 10
  const results = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(item => 
        serviceClient.invokeService(functionName, {
          route: 'processItem',
          item
        })
      )
    )
    results.push(...batchResults)
  }
  
  return results
}
```

### Response Caching

```typescript
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 300 }) // 5 minute cache

const cachedServiceCall = async (cacheKey: string, payload: any) => {
  // Check cache first
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }
  
  // Make service call
  const result = await serviceClient.invokeService(functionName, payload)
  const response = JSON.parse(result.Payload as string)
  
  // Cache the result
  cache.set(cacheKey, response)
  
  return response
}
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private isOpen = false
  
  async callService(functionName: string, payload: any) {
    if (this.isOpen && Date.now() - this.lastFailureTime < 60000) {
      throw new Error('Circuit breaker is open')
    }
    
    try {
      const result = await serviceClient.invokeService(functionName, payload)
      this.failures = 0
      this.isOpen = false
      return result
      
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()
      
      if (this.failures >= 3) {
        this.isOpen = true
      }
      
      throw error
    }
  }
}
```

## Testing

### Mock Service Client

```typescript
import { ServiceClient } from '@360mediadirect/service-client'

// Mock for unit tests
jest.mock('@360mediadirect/service-client')

const mockServiceClient = new ServiceClient()
mockServiceClient.invokeService = jest.fn()

// Setup mock responses
;(mockServiceClient.invokeService as jest.Mock).mockResolvedValue({
  Payload: JSON.stringify({ issues: [mockIssue] })
})
```

### Integration Testing

```typescript
describe('Service Integration', () => {
  const serviceClient = new ServiceClient()
  
  it('should call issues service successfully', async () => {
    const result = await serviceClient.invokeService(
      'periodical-issues-test-internalAPI',
      { route: 'getIssueById', id: 'test-id' }
    )
    
    expect(result.StatusCode).toBe(200)
    
    const response = JSON.parse(result.Payload as string)
    expect(response.issues).toBeDefined()
  })
  
  it('should handle service errors gracefully', async () => {
    await expect(
      serviceClient.invokeService('invalid-function', {})
    ).rejects.toThrow()
  })
})
```

## Performance Optimization

### Connection Reuse

```typescript
// Lambda containers reuse connections
const lambda = new AWS.Lambda({
  maxRetries: 3,
  httpOptions: {
    keepAlive: true,
    keepAliveMsecs: 1000
  }
})

export class ServiceClient {
  private lambda = lambda // Reuse connection
  
  // ... rest of implementation
}
```

### Parallel Invocations

```typescript
// Call multiple services in parallel
const getRelatedData = async (issueId: string) => {
  const [issue, subscriptions, entitlements] = await Promise.all([
    serviceClient.invokeService('periodical-issues-prod-internalAPI', {
      route: 'getIssueById',
      id: issueId
    }),
    serviceClient.invokeService('periodical-subscriptions-prod-internalAPI', {
      route: 'getSubscriptionsByIssue',
      issueId
    }),
    serviceClient.invokeService('periodical-entitlements-prod-internalAPI', {
      route: 'getEntitlementsByIssue', 
      issueId
    })
  ])
  
  return {
    issue: JSON.parse(issue.Payload as string),
    subscriptions: JSON.parse(subscriptions.Payload as string),
    entitlements: JSON.parse(entitlements.Payload as string)
  }
}
```

### Request Optimization

```typescript
// Optimize payload size
const optimizedPayload = {
  route: 'getIssueById',
  id: issueId,
  // Only include necessary fields
  fields: ['id', 'title', 'coverImageUrl']
}

const result = await serviceClient.invokeService(functionName, optimizedPayload)
```

## Environment Configuration

```bash
# AWS Configuration
AWS_REGION=us-east-1

# Stage for function naming
STAGE=dev|prod

# Lambda configuration
LAMBDA_TIMEOUT=30000
LAMBDA_MEMORY=512
```

## Function Naming Convention

All internal API functions follow this pattern:
```
periodical-{service-name}-{stage}-internalAPI
```

Examples:
- `periodical-issues-dev-internalAPI`
- `periodical-subscriptions-prod-internalAPI`
- `periodical-entitlements-dev-internalAPI`
- `periodical-auth-prod-internalAPI`

## Migration from API Client

When migrating from HTTP API calls to service client:

**Before (HTTP API Client):**
```typescript
const subscription = await client.updateSubscription(
  { id: subscription.id },
  { totalIssuesIncluded: 24 }
)
```

**After (Service Client):**
```typescript
const result = await serviceClient.invokeService(
  `periodical-subscriptions-${process.env.STAGE}-internalAPI`,
  {
    route: 'updateSubscription',
    id: subscription.id,
    data: { totalIssuesIncluded: 24 }
  }
)

const response = JSON.parse(result.Payload as string)
```

## Benefits

### Performance
- **Faster**: Direct Lambda invocation eliminates HTTP overhead
- **Lower Latency**: No API Gateway processing time
- **Better Throughput**: Higher concurrent execution limits

### Security  
- **VPC Internal**: Communication stays within AWS VPC
- **No Public Endpoints**: No exposure to internet
- **IAM Controlled**: Function-level permissions

### Cost
- **No API Gateway Costs**: Eliminates per-request API Gateway charges
- **Reduced Data Transfer**: Lower costs for large payloads
- **Efficient Resource Usage**: Better Lambda utilization

## Error Handling Patterns

```typescript
const safeServiceCall = async (functionName: string, payload: any) => {
  try {
    const result = await serviceClient.invokeService(functionName, payload)
    
    if (result.FunctionError === 'Handled') {
      // Service returned an error response
      const errorResponse = JSON.parse(result.Payload as string)
      throw new Error(`Service error: ${errorResponse.message}`)
    }
    
    if (result.FunctionError === 'Unhandled') {
      // Service had an unhandled exception
      throw new Error('Service experienced an unhandled error')
    }
    
    return JSON.parse(result.Payload as string)
    
  } catch (error) {
    console.error('Service call failed:', {
      functionName,
      payload,
      error: error.message
    })
    
    // Re-throw with context
    throw new Error(`Failed to call ${functionName}: ${error.message}`)
  }
}
```

## Legal

The Periodical Service Client package is Copyright 360 Media Direct and is not licensed or authorized for public or third party use.