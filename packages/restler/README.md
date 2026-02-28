# @myorg/restler

Express + OpenAPI validation framework for AWS Lambda.

## Overview

Restler is the API framework used by all services. It wires together
Express, OpenAPI 3.0 request/response validation, JWT authentication, structured
logging, CORS, rate limiting, and the
[@codegenie/serverless-express](https://github.com/CodeGenieApp/serverless-express)
adapter into a single `createHandler` call that produces an AWS Lambda handler.

What the package provides:

- **OpenAPI-driven routing** -- routes and controllers are resolved from an
  `openapi.json` spec via `operationId`.
- **Automatic request validation** -- path parameters, query strings, headers,
  and request bodies are validated against the OpenAPI schema before your
  controller runs.
- **JWT authentication** -- Bearer tokens are verified through Embassy and
  attached to `req.token`. Security schemes (`JWTAuth`, `BasicAuth`, `Internal`)
  are enforced per-endpoint.
- **Rate limiting** -- distributed, DynamoDB-backed rate limiting configurable at
  the service level with per-IP, per-email, per-user, or custom key strategies.
- **Structured logging** -- every request gets a child logger with a unique
  request ID, and request/response bodies are logged with configurable redaction.
- **Error handling** -- throw `createError(status, message)` anywhere in a
  controller and the framework returns a consistent JSON error response.

## Installation

```bash
yarn add @myorg/restler
```

Peer/transitive dependencies that must be available in the service:

- `@myorg/auth-helper`
- `@myorg/embassy`
- `@myorg/log`

## Quick Start

### 1. Define an OpenAPI spec (`src/openapi.json`)

```json
{
  "openapi": "3.0.0",
  "info": { "title": "My Service", "version": "1.0.0" },
  "paths": {
    "/items": {
      "get": {
        "operationId": "getAllItems",
        "parameters": [
          { "name": "limit", "in": "query", "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "List of items" }
        }
      }
    },
    "/items/{id}": {
      "get": {
        "operationId": "getItemById",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": {
          "200": { "description": "Single item" }
        }
      }
    }
  }
}
```

### 2. Write controllers (`src/controllers/index.ts`)

```typescript
import { createController, createError } from '@myorg/restler'
import { itemModel } from './models/item'

export const getAllItems = createController(async (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100
  const items = await itemModel.list({ limit })
  res.json({ success: true, data: items, count: items.length })
})

export const getItemById = createController(async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const item = await itemModel.getById(id)
  if (!item) throw createError(404, 'Item not found')
  res.json({ success: true, data: item })
})
```

### 3. Create the Lambda handler (`src/index.ts`)

```typescript
import { createHandler } from '@myorg/restler'
import log from '@myorg/log'
import * as controllers from './controllers'
import apiSpec from './openapi.json'
import { embassy } from './lib/authorizer'

export const httpHandler = createHandler({
  controllers,
  apiSpec,
  log,
  embassy,
})
```

That is all you need. `httpHandler` is a Lambda-compatible function that routes
requests through the full middleware pipeline.

## API Reference

### `createHandler(options): LambdaHandler`

Creates an AWS Lambda handler by building an Express app with `createApp` and
wrapping it with `@codegenie/serverless-express`.

```typescript
import { createHandler } from '@myorg/restler'

export const httpHandler = createHandler({
  controllers, // Record<string, Middleware> -- keyed by operationId
  apiSpec,      // OpenAPI 3.0 spec object or path to spec file
  log,          // Logger instance (optional)
  embassy,      // Embassy instance for JWT verification (optional)
  basicAuth,    // Basic auth credentials string (optional)
  rateLimit,    // RateLimitOptions or RateLimitOptions[] (optional)
})
```

**`AppOptions` fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `controllers` | `Record<string, Middleware>` | Yes | Map of `operationId` to controller middleware |
| `apiSpec` | `object \| string` | Yes | OpenAPI 3.0 spec (inline object or file path) |
| `log` | `Logger` | No | Structured logger. Falls back to a no-op logger |
| `embassy` | `Embassy` | No | Embassy instance for JWT token verification. Omit for public APIs |
| `basicAuth` | `string` | No | Basic auth credentials |
| `rateLimit` | `RateLimitOptions \| RateLimitOptions[]` | No | Rate limiting configuration (see Rate Limiting section) |

### `createController(fn): Middleware`

Wraps an async handler function as Express middleware with logging, redaction,
cache-control headers, and error propagation.

```typescript
import { createController } from '@myorg/restler'

export const myEndpoint = createController(async (req, res) => {
  // req.token  -- verified JWT token (if present)
  // req.log    -- child logger with request ID
  // req.query  -- validated query parameters
  // req.params -- validated path parameters
  // req.body   -- validated request body

  res.json({ success: true, data: { hello: 'world' } })
})
```

The controller function receives `RestRequest` and `Response` objects. Any
thrown error is forwarded to the error-handling middleware. Use `createError` to
throw HTTP errors with proper status codes.

**OpenAPI schema extensions** recognized by `createController`:

| Extension | Type | Description |
|-----------|------|-------------|
| `x-restler-request-redact` | `string[]` | Field paths to redact from request body logs |
| `x-restler-response-redact` | `string[]` | Field paths to redact from response body logs |
| `x-restler-cache-control` | `string` | Override `Cache-Control` header (default: `no-cache, no-store`) |

### `createError(status, message, properties?)`

Re-exported from the `http-errors` package. Creates an HTTP error that the
framework catches and converts into a JSON response.

```typescript
import { createError } from '@myorg/restler'

// 400 Bad Request
throw createError(400, 'Missing required field: name')

// 404 Not Found
throw createError(404, 'Entity not found')

// 429 with extra properties
throw createError(429, 'Rate limit exceeded', { retryAfter: 3600 })
```

The error handler returns:

```json
{
  "error": "Missing required field: name",
  "details": []
}
```

Errors with `status >= 500` are logged at the `error` level. The actual message
is hidden from the client and replaced with `"Internal server error"` unless
`expose` is set to `true`.

### `createApp(options): Application`

Creates the underlying Express application without the Lambda adapter. This is
useful in integration tests where you want to drive the app with `supertest`.

```typescript
import { createApp } from '@myorg/restler'
import request from 'supertest'

const app = createApp({ controllers, apiSpec, log, embassy })

const res = await request(app).get('/items').expect(200)
```

### Presets

Two convenience presets are exported for common rate-limiting scenarios:

```typescript
import {
  loginRateLimiterPreset,
  apiRateLimiterPreset,
} from '@myorg/restler'

// Returns [ipLimiter, emailLimiter] middleware tuple
const [ipLimiter, emailLimiter] = loginRateLimiterPreset(tableName)

// Returns a single IP-based middleware (100 req/min default)
const apiLimiter = apiRateLimiterPreset(100, 60, tableName)
```

## Middleware Pipeline

When a request arrives, it passes through the following middleware stack in
order:

1. **addStartTime** -- stamps `req.startTime`
2. **express.json** -- parses JSON bodies (1 MB limit)
3. **apiGateway** -- normalizes API Gateway event data
4. **restoreApiGatewayPath** -- restores the original path after stage prefix
5. **setCorsHeaders** -- sets CORS response headers
6. **addRequestId** -- generates and attaches `req.id`
7. **addBasicAuth** -- checks Basic auth credentials
8. **addVerifiedToken** -- verifies Bearer JWT via Embassy
9. **addLogger** -- creates `req.log` child logger
10. **exposeResponse** -- captures `res.json` output for logging
11. **rateLimiter(s)** -- rate limiting (if configured)
12. **logBeforeValidation** -- logs incoming request summary
13. **openApiRoutes** -- validates request and dispatches to controller
14. **handleError** -- converts errors to JSON responses
15. **logResponse** -- logs outgoing response summary
16. **endResponse** -- finalizes the response

## OpenAPI Validation

Restler uses [express-openapi-validator](https://github.com/cdimascio/express-openapi-validator)
to validate every request against your `openapi.json` spec. Validation runs
automatically before your controller is invoked.

### What is validated

- **Path parameters** -- type, format, required
- **Query parameters** -- type, format, enum, required
- **Request body** -- JSON schema, required fields, additional properties
- **Security** -- `JWTAuth`, `BasicAuth`, and `Internal` schemes

### Routing via `operationId`

The `operationId` field in the OpenAPI spec must match a key in the
`controllers` map passed to `createHandler`:

```json
{
  "paths": {
    "/publishers": {
      "get": {
        "operationId": "getAllPublishers"
      }
    }
  }
}
```

```typescript
// controllers/index.ts
export { getAllPublishers } from './publisherController'
```

If no matching controller is found for an `operationId`, the framework logs an
error and returns 404.

### Security schemes

Define security schemes in your OpenAPI spec and Restler enforces them:

```json
{
  "components": {
    "securitySchemes": {
      "JWTAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" },
      "BasicAuth": { "type": "http", "scheme": "basic" }
    }
  },
  "paths": {
    "/secure": {
      "get": {
        "security": [{ "JWTAuth": [] }],
        "operationId": "getSecureData"
      }
    }
  }
}
```

- **JWTAuth** -- requires a valid Bearer token. Optional `scopes` are checked
  via `token.hasScopes(scopes)`. Returns 401 if missing, 403 if insufficient.
- **BasicAuth** -- requires valid Basic auth credentials. Returns 401 if missing.
- **Internal** -- requires the request to be flagged as internal. Returns 401 if
  not.

## Rate Limiting

Restler includes built-in distributed rate limiting backed by DynamoDB. Each
service gets its own isolated rate-limits table so there is no cross-service
interference.

### Architecture

```
Service A (auth)              Service B (publishers)
     |                               |
auth-rate-limits-{stage}     publishers-rate-limits-{stage}
     (DynamoDB)                      (DynamoDB)
```

Each rate-limit record is stored with a composite key of
`{path}:{identifier}` (for example `/auth/login/magiclink:192.168.1.100`). A
TTL attribute automatically cleans up expired records.

The middleware follows a **fail-open** strategy: if DynamoDB is unreachable, the
request is allowed through and the error is logged.

### Setup

Three additions are required in your `serverless.yml`.

**A. Environment variable** (under `provider.environment`):

```yaml
RATE_LIMIT_TABLE_NAME: ${self:service}-rate-limits-${self:provider.stage}
```

**B. IAM permissions** (under `provider.iam.role.statements`):

```yaml
- Effect: Allow
  Action:
    - 'dynamodb:GetItem'
    - 'dynamodb:PutItem'
    - 'dynamodb:UpdateItem'
  Resource:
    - Fn::GetAtt:
        - RateLimitsTable
        - Arn
```

**C. DynamoDB table resource** (under `resources.Resources`):

```yaml
RateLimitsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: ${self:service}-rate-limits-${self:provider.stage}
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: key
        AttributeType: S
    KeySchema:
      - AttributeName: key
        KeyType: HASH
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
```

Then pass a `rateLimit` option to `createHandler` in `src/index.ts`:

```typescript
export const httpHandler = createHandler({
  controllers,
  apiSpec,
  log,
  embassy,
  rateLimit: {
    maxRequests: 100,
    windowSeconds: 60,
    keyExtractor: 'ip',
  },
})
```

### Configuration Options

The `RateLimitOptions` interface:

```typescript
interface RateLimitOptions {
  tableName?: string      // Defaults to RATE_LIMIT_TABLE_NAME env var
  maxRequests: number     // Max requests allowed in the window
  windowSeconds: number   // Window duration in seconds
  keyExtractor?: 'ip' | 'email' | 'userId' | ((req: RestRequest) => string)
  message?: string        // Custom 429 error message
  skip?: (req: RestRequest) => boolean | Promise<boolean>
  enabled?: boolean       // Default true
}
```

**Key extractors:**

| Value | Resolves to | Use case |
|-------|-------------|----------|
| `'ip'` (default) | Client IP from `X-Forwarded-For`, `X-Real-IP`, or socket | General API protection |
| `'email'` | `req.body.email` (lowercased) | Login / magic-link endpoints |
| `'userId'` | `req.token.sub` | Authenticated per-user limits |
| `(req) => string` | Return value of the function | Any custom logic |

### Usage Examples

**Simple IP-based limiting (100 req/min):**

```typescript
rateLimit: {
  maxRequests: 100,
  windowSeconds: 60,
  keyExtractor: 'ip',
}
```

**Multiple layers (IP + authenticated user):**

```typescript
rateLimit: [
  {
    maxRequests: 100,
    windowSeconds: 3600,
    keyExtractor: 'ip',
  },
  {
    maxRequests: 1000,
    windowSeconds: 3600,
    keyExtractor: 'userId',
    skip: (req) => !req.token,
  },
]
```

**Selective -- login endpoints only:**

```typescript
rateLimit: {
  maxRequests: 5,
  windowSeconds: 3600,
  keyExtractor: 'email',
  skip: (req) => !req.path.includes('/login'),
  message: 'Too many login attempts. Please try again in an hour.',
}
```

**Auth service dual-layer protection:**

```typescript
rateLimit: [
  {
    maxRequests: 10,
    windowSeconds: 3600,
    keyExtractor: 'ip',
    message: 'Too many requests from this IP address. Please try again in an hour.',
    skip: (req) => !req.path.includes('/login'),
  },
  {
    maxRequests: 5,
    windowSeconds: 3600,
    keyExtractor: 'email',
    message: 'Too many login attempts for this email address. Please try again in an hour.',
    skip: (req) => !req.path.includes('/login') || !req.body?.email,
  },
]
```

**Conditional -- skip admin users:**

```typescript
rateLimit: {
  maxRequests: 100,
  windowSeconds: 60,
  keyExtractor: 'userId',
  skip: async (req) => {
    if (!req.token) return false
    return req.token.hasPermission('admin', 'bypass-rate-limit')
  },
}
```

**Development vs production:**

```typescript
const isDev = process.env.STAGE === 'dev'

rateLimit: {
  maxRequests: isDev ? 1000 : 100,
  windowSeconds: 60,
  keyExtractor: 'ip',
  enabled: !isDev,  // optionally disable entirely in dev
}
```

### Response Headers

When rate limiting is active, every response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds until the window resets (only on 429 responses) |

### Testing Rate Limits

**Send a burst of requests:**

```bash
for i in {1..15}; do
  curl -X POST http://localhost:3000/auth/login/magiclink \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}' \
    -i
  echo "Request $i"
  sleep 0.5
done
```

**Inspect response headers:**

```bash
curl -I http://localhost:3000/api/endpoint

# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 87
# X-RateLimit-Reset: 1641280800
```

**Query the DynamoDB table directly:**

```bash
aws dynamodb scan \
  --table-name auth-rate-limits-dev \
  --region us-east-1

aws dynamodb get-item \
  --table-name auth-rate-limits-dev \
  --key '{"key": {"S": "/auth/login/magiclink:192.168.1.100"}}' \
  --region us-east-1
```

### Troubleshooting

**Rate limiting not working:**

1. Verify `RATE_LIMIT_TABLE_NAME` environment variable is set in `serverless.yml`.
2. Confirm the DynamoDB table exists in AWS.
3. Confirm IAM permissions include `dynamodb:GetItem`, `PutItem`, `UpdateItem`.
4. Confirm `rateLimit` is present in `createHandler` options.
5. Confirm `enabled` is not explicitly set to `false`.

Debug with a temporary `skip` function:

```typescript
rateLimit: {
  maxRequests: 100,
  windowSeconds: 60,
  skip: (req) => {
    console.log('Rate limit check:', req.path, req.ip)
    return false
  },
}
```

**All requests returning 429:**

Possible causes: limits set too low (`maxRequests: 1`), key extractor returning
the same value for every request, or window set too long. Temporarily increase
limits and log the resolved key:

```typescript
rateLimit: {
  maxRequests: 1000,
  windowSeconds: 60,
  keyExtractor: (req) => {
    console.log('Key:', req.ip)
    return req.ip
  },
}
```

**Different services sharing rate limits:**

Ensure the table name is service-specific:

```yaml
# Wrong -- shared across services
RATE_LIMIT_TABLE_NAME: rate-limits-dev

# Correct -- scoped to this service
RATE_LIMIT_TABLE_NAME: ${self:service}-rate-limits-${self:provider.stage}
```

**Rate limits not resetting:**

Check that TTL is enabled on the DynamoDB table:

```bash
aws dynamodb describe-table \
  --table-name auth-rate-limits-dev \
  --query 'Table.TimeToLiveDescription'
```

Expected output:

```json
{ "TimeToLiveStatus": "ENABLED", "AttributeName": "ttl" }
```

Enable TTL if it is missing:

```bash
aws dynamodb update-time-to-live \
  --table-name auth-rate-limits-dev \
  --time-to-live-specification "Enabled=true, AttributeName=ttl"
```

**CloudFormation deployment fails with "table already exists":**

```bash
# Delete the existing table (dev environment only)
aws dynamodb delete-table \
  --table-name auth-rate-limits-dev \
  --region us-east-1

# Or rename the table in serverless.yml
TableName: ${self:service}-rate-limits-v2-${self:provider.stage}
```

### Best Practices

1. **Use service-specific table names.** Always follow the pattern
   `${self:service}-rate-limits-${self:provider.stage}` to avoid cross-service
   interference.

2. **Apply multiple layers.** Combine IP-based and user-based limits for defense
   in depth:
   ```typescript
   rateLimit: [
     { maxRequests: 100, windowSeconds: 60, keyExtractor: 'ip' },
     { maxRequests: 1000, windowSeconds: 60, keyExtractor: 'userId' },
   ]
   ```

3. **Choose appropriate windows.**

   | Use case | Recommended window |
   |----------|-------------------|
   | Login endpoints | 3600 s (1 hour) |
   | General API endpoints | 60 s (1 minute) |
   | Heavy/expensive operations | 300 s (5 minutes) |

4. **Provide clear error messages** so callers know what to do:
   ```typescript
   message: 'Too many login attempts. Please try again in an hour or contact support.'
   ```

5. **Monitor 429 rates.** Set up a CloudWatch alarm:
   ```yaml
   RateLimitAlarm:
     Type: AWS::CloudWatch::Alarm
     Properties:
       AlarmName: ${self:service}-${self:provider.stage}-rate-limit-exceeded
       MetricName: 4XXError
       Namespace: AWS/ApiGateway
       Statistic: Sum
       Period: 300
       EvaluationPeriods: 1
       Threshold: 100
       ComparisonOperator: GreaterThanThreshold
   ```

## Development

```bash
# Install dependencies
yarn install

# Build
yarn build

# Run linter
yarn lint

# Auto-fix lint issues
yarn lint:fix

# Run tests with coverage
yarn test

# Watch mode
yarn test:watch

# Clean build artifacts
yarn clean
```

The test suite uses Jest with `ts-jest`. Tests live in `__tests__/` and match
the `**/__tests__/**/*.spec.{js,ts}` pattern.

## License

UNLICENSED
