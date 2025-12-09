# Restler

A TypeScript library for building Express-based REST APIs that run on AWS Lambda and API Gateway, providing middleware, controllers, and OpenAPI integration for the Periodical platform.

## Overview

Restler abstracts the complexity of running Express applications on AWS Lambda while maintaining familiar Express patterns. It provides middleware for authentication, CORS, logging, error handling, and automatic OpenAPI route generation.

## Installation

This package is only available to other packages and services in this monorepo. To add it as a dependency:

```shell
yarn lerna add @360mediadirect/restler --scope YOUR_PACKAGE_NAME
```

## Core Components

### createHandler
Converts Express apps into Lambda-compatible handlers with API Gateway integration.

### createController 
Wrapper for Express route handlers with automatic error handling and logging.

### createApp
Creates Express applications with pre-configured middleware stack.

## Usage

### Basic API Handler

```typescript
import { createHandler, createApp } from '@360mediadirect/restler'
import { getUserController, createUserController } from './controllers'

const app = createApp()

// Define routes
app.get('/users/:id', getUserController)
app.post('/users', createUserController) 
app.put('/users/:id', updateUserController)

// Export Lambda handler
export const handler = createHandler(app)
```

### Creating Controllers

```typescript
import { createController } from '@360mediadirect/restler'
import createError from 'http-errors'

export const getUserController = createController(async (req, res) => {
  const { id } = req.params
  
  // Business logic
  const user = await UserService.findById(id)
  
  if (!user) {
    throw createError(404, 'User not found')
  }
  
  res.json({ user })
})

export const createUserController = createController(async (req, res) => {
  const userData = req.body
  
  // Validation
  if (!userData.email) {
    throw createError(400, 'Email is required')
  }
  
  const user = await UserService.create(userData)
  res.status(201).json({ user })
})
```

### Advanced App Configuration

```typescript
import { createApp } from '@360mediadirect/restler'

const app = createApp({
  // Custom middleware
  middleware: [
    // Add custom middleware before defaults
    myCustomMiddleware,
  ],
  
  // CORS configuration
  cors: {
    origin: ['https://app.periodical.com'],
    credentials: true
  },
  
  // Logging configuration
  logger: {
    level: 'info',
    redactPaths: ['password', 'token']
  }
})
```

## Built-in Middleware

### Authentication Middleware

Automatically validates JWT tokens and adds user context:

```typescript
// Token validation is automatic
export const protectedController = createController(async (req, res) => {
  // req.user is populated from JWT token
  const userId = req.user.sub
  const userScopes = req.user.scopes
  
  // Check permissions
  if (!userScopes.includes('users:read')) {
    throw createError(403, 'Insufficient permissions')
  }
  
  res.json({ message: 'Authorized access' })
})
```

### CORS Middleware

Handles cross-origin requests with configurable options:

```typescript
// CORS is configured automatically
// Supports preflight requests
// Configurable origins, methods, headers
```

### Request ID Middleware

Adds unique request IDs for tracing:

```typescript
export const someController = createController(async (req, res) => {
  // req.id contains unique request ID
  console.log('Processing request:', req.id)
  
  // Request ID is included in all logs
  res.json({ requestId: req.id })
})
```

### Error Handling Middleware

Centralized error handling with structured responses:

```typescript
// Automatically handles:
// - HTTP errors (http-errors)
// - Validation errors
// - Database errors
// - Unexpected errors

// Returns consistent error format:
// {
//   "error": "Not Found",
//   "message": "User not found",
//   "statusCode": 404,
//   "requestId": "req-123"
// }
```

### Logging Middleware

Request/response logging with sensitive data redaction:

```typescript
// Automatically logs:
// - Request details (method, path, headers)
// - Response details (status, timing)
// - Errors with stack traces
// - Performance metrics

// Redacts sensitive fields automatically
```

## OpenAPI Integration

### Automatic Route Generation

```typescript
import { createApp } from '@360mediadirect/restler'

const app = createApp({
  openapi: {
    enabled: true,
    spec: './openapi.yml' // Path to OpenAPI spec
  }
})

// Routes are automatically generated from OpenAPI spec
// No manual route definitions needed
// Validation is applied based on schema
```

### Custom OpenAPI Handlers

```typescript
// Define handlers that match OpenAPI operationId
export const getUserById = createController(async (req, res) => {
  // This matches operationId: "getUserById" in OpenAPI spec
  const user = await UserService.findById(req.params.id)
  res.json({ user })
})

// Export handlers for automatic discovery
export default {
  getUserById,
  createUser,
  updateUser,
  deleteUser
}
```

## Request Validation

### Automatic Schema Validation

```typescript
// Validation is applied automatically based on OpenAPI spec
export const createUserController = createController(async (req, res) => {
  // req.body is already validated against OpenAPI schema
  // Invalid requests return 400 with validation errors
  
  const user = await UserService.create(req.body)
  res.status(201).json({ user })
})
```

### Custom Validation

```typescript
import { createController } from '@360mediadirect/restler'
import createError from 'http-errors'

export const customValidationController = createController(async (req, res) => {
  // Custom business logic validation
  if (req.body.age < 18) {
    throw createError(400, 'User must be 18 or older')
  }
  
  res.json({ status: 'valid' })
})
```

## Error Handling

### HTTP Errors

```typescript
import createError from 'http-errors'

export const errorController = createController(async (req, res) => {
  // Create structured HTTP errors
  throw createError(404, 'Resource not found')
  throw createError(400, 'Invalid input', { field: 'email' })
  throw createError(403, 'Access denied')
  throw createError(500, 'Internal server error')
})
```

### Custom Error Types

```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const customErrorController = createController(async (req, res) => {
  throw new ValidationError('Email is invalid', 'email')
  // Automatically converted to appropriate HTTP response
})
```

## Testing

### Unit Testing Controllers

```typescript
import request from 'supertest'
import { createApp } from '@360mediadirect/restler'

const app = createApp()
app.get('/test', testController)

describe('Test Controller', () => {
  it('should return success', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200)
    
    expect(response.body).toEqual({ status: 'ok' })
  })
  
  it('should handle errors', async () => {
    const response = await request(app)
      .get('/test/error')
      .expect(400)
    
    expect(response.body.error).toBeDefined()
  })
})
```

### Integration Testing

```typescript
import { createHandler } from '@360mediadirect/restler'
import { handler } from '../src/index'

describe('Lambda Handler', () => {
  it('should process API Gateway events', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/users/123',
      headers: {},
      body: null
    }
    
    const result = await handler(event, {})
    
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toMatchObject({
      user: expect.any(Object)
    })
  })
})
```

## Performance Optimization

### Connection Reuse

```typescript
// Lambda handlers reuse connections between invocations
const app = createApp({
  keepAlive: true, // Enable connection pooling
  maxSockets: 50   // Limit concurrent connections
})
```

### Response Compression

```typescript
import compression from 'compression'

const app = createApp({
  middleware: [
    compression(), // Enable gzip compression
  ]
})
```

### Caching Headers

```typescript
export const cacheableController = createController(async (req, res) => {
  // Set cache headers
  res.set('Cache-Control', 'public, max-age=3600')
  res.set('ETag', calculateETag(data))
  
  res.json(data)
})
```

## Environment Configuration

### Lambda Environment

```bash
# Stage configuration
STAGE=dev|prod

# Logging
LOG_LEVEL=info|debug|warn|error

# Authentication
JWT_SECRET=your-jwt-secret
TOKEN_AUDIENCE=api.periodical.com

# CORS
CORS_ORIGINS=https://app.periodical.com,https://admin.periodical.com
```

### Local Development

```typescript
// For local testing
if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 3000
  app.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })
}
```

## Best Practices

### Controller Organization

```typescript
// controllers/users.ts
export const getUser = createController(async (req, res) => { /* */ })
export const createUser = createController(async (req, res) => { /* */ })
export const updateUser = createController(async (req, res) => { /* */ })
export const deleteUser = createController(async (req, res) => { /* */ })

// controllers/index.ts
export * from './users'
export * from './subscriptions'
export * from './issues'
```

### Error Handling Strategy

```typescript
// Use specific error types
throw createError(400, 'Validation failed', { 
  field: 'email',
  code: 'INVALID_FORMAT'
})

// Log context for debugging
console.log('User creation failed', {
  userId: req.user?.sub,
  requestId: req.id,
  data: req.body
})
```

### Response Formatting

```typescript
// Consistent response structure
export const successController = createController(async (req, res) => {
  const data = await service.getData()
  
  res.json({
    data,
    meta: {
      requestId: req.id,
      timestamp: new Date().toISOString()
    }
  })
})
```

## Deployment

### Serverless Framework Integration

```yaml
# serverless.yml
service: my-api

functions:
  api:
    handler: src/index.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
```

### API Gateway Configuration

The handler automatically formats responses for API Gateway:

```typescript
// Lambda response format
{
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(data)
}
```

## Legal

The Periodical Restler package is Copyright 360 Media Direct and is not licensed or authorized for public or third party use.
