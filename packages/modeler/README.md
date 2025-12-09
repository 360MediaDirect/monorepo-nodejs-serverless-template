# Modeler

A TypeScript DynamoDB modeling library built on top of AWS DynamoDB DataMapper, providing base model classes and utilities for data persistence in the Periodical platform.

## Overview

The modeler package provides a `BaseModel` class and DynamoDB mapper utilities that services use to define their data models. It abstracts DynamoDB operations and provides consistent patterns for data access across all Periodical services.

## Installation

This package is only available to other packages and services in this monorepo. To add it as a dependency:

```shell
yarn lerna add @360mediadirect/modeler --scope YOUR_PACKAGE_NAME
```

## Core Components

### BaseModel Class

The `BaseModel` provides common functionality for all DynamoDB models:

- Automatic timestamp management (`createdAt`, `updatedAt`)
- Common query patterns and utilities
- Type-safe attribute definitions
- Consistent error handling

### DynamoDB Mapper

Pre-configured DynamoDB DataMapper instance with optimized settings for the Periodical platform.

## Usage

### Creating a Model

```typescript
import { BaseModel } from '@360mediadirect/modeler'
import {
  attribute,
  hashKey,
  rangeKey,
  globalSecondaryIndex,
  table
} from '@aws/dynamodb-data-mapper-annotations'

@table('subscriptions')
export class SubscriptionModel extends BaseModel {
  @hashKey()
  @attribute()
  id: string

  @attribute()
  userId: string

  @attribute() 
  umc: string

  @attribute()
  totalIssuesIncluded: number

  @attribute()
  issuesDelivered: number

  @attribute()
  firstIssueDate?: string

  @attribute()
  deactivatedAt?: number

  @globalSecondaryIndex('UserIdIndex')
  @attribute()
  gsi1pk: string // Set to userId for querying by user

  @globalSecondaryIndex('UmcIndex', 'rangeKey')
  @attribute()
  gsi2sk: string // Set to umc for querying by magazine
}
```

### Basic Operations

```typescript
import { mapper } from '@360mediadirect/modeler'

// Create a new subscription
const subscription = new SubscriptionModel()
subscription.id = 'sub-123'
subscription.userId = 'user-456'
subscription.umc = 'tech-today'
subscription.totalIssuesIncluded = 12

// Save to DynamoDB
const saved = await mapper.put(subscription)

// Get by primary key
const retrieved = await SubscriptionModel.get({ id: 'sub-123' })

// Update
subscription.issuesDelivered = 3
await subscription.save()

// Delete
await mapper.delete(subscription)
```

### Query Operations

```typescript
// Query by Global Secondary Index
const userSubscriptions = []
for await (const subscription of mapper.query(
  SubscriptionModel,
  { userId: 'user-456' },
  { indexName: 'UserIdIndex' }
)) {
  userSubscriptions.push(subscription)
}

// Scan with filters
const activeSubscriptions = []
for await (const subscription of mapper.scan(SubscriptionModel, {
  filter: {
    type: 'And',
    conditions: [
      {
        subject: 'deactivatedAt',
        type: 'IsNull'
      }
    ]
  }
})) {
  activeSubscriptions.push(subscription)
}
```

### Custom Model Methods

Add business logic methods to your models:

```typescript
export class SubscriptionModel extends BaseModel {
  // ... attribute definitions

  static async getActiveSubscriptions(userId: string): Promise<SubscriptionModel[]> {
    const subscriptions: SubscriptionModel[] = []
    
    for await (const subscription of mapper.query(
      SubscriptionModel,
      { userId },
      { indexName: 'UserIdIndex' }
    )) {
      if (!subscription.deactivatedAt) {
        subscriptions.push(subscription)
      }
    }
    
    return subscriptions
  }

  isActive(): boolean {
    return !this.deactivatedAt
  }

  hasRemainingIssues(): boolean {
    return this.issuesDelivered < this.totalIssuesIncluded
  }

  async deactivate(): Promise<void> {
    this.deactivatedAt = Date.now()
    await this.save()
  }
}
```

### Batch Operations

```typescript
import { mapper } from '@360mediadirect/modeler'

// Batch write
const subscriptions = [
  new SubscriptionModel(), 
  new SubscriptionModel()
  // ... populate with data
]

for await (const persisted of mapper.batchPut(subscriptions)) {
  console.log(`Saved subscription: ${persisted.id}`)
}

// Batch get
const ids = ['sub-1', 'sub-2', 'sub-3']
const keys = ids.map(id => ({ id }))

for await (const subscription of mapper.batchGet(
  SubscriptionModel,
  keys
)) {
  console.log(`Retrieved subscription: ${subscription.id}`)
}
```

## BaseModel Features

### Automatic Timestamps

All models extending `BaseModel` automatically get:

```typescript
@attribute()
createdAt: number // Set on first save

@attribute()  
updatedAt: number // Updated on every save
```

### Pagination Support

```typescript
// Get paginated results
const { items, lastEvaluatedKey } = await SubscriptionModel.getPaginated({
  limit: 20,
  startKey: previousLastKey
})

// Continue pagination
const nextPage = await SubscriptionModel.getPaginated({
  limit: 20,
  startKey: lastEvaluatedKey
})
```

### Error Handling

```typescript
try {
  const subscription = await SubscriptionModel.get({ id: 'invalid-id' })
} catch (error) {
  if (error.name === 'ItemNotFoundException') {
    console.log('Subscription not found')
  } else {
    console.error('Database error:', error)
  }
}
```

## Table Design Patterns

### Single Table Design

For related entities, use single table design with composite keys:

```typescript
@table('periodical-data')
export class EntitlementModel extends BaseModel {
  @hashKey()
  @attribute()
  pk: string // USER#userId

  @rangeKey()
  @attribute()
  sk: string // ENTITLEMENT#issueId

  // GSI for querying by subscription
  @globalSecondaryIndex('SubscriptionIndex')
  @attribute()
  gsi1pk: string // SUBSCRIPTION#subscriptionId

  @attribute()
  userId: string

  @attribute()
  issueId: string

  @attribute() 
  subscriptionId?: string
}
```

### Access Patterns

Design your indexes around query patterns:

```typescript
// Access Pattern 1: Get user's entitlements
// Query: PK = USER#userId

// Access Pattern 2: Get entitlements for subscription  
// Query GSI: gsi1pk = SUBSCRIPTION#subscriptionId

// Access Pattern 3: Get specific entitlement
// Get: PK = USER#userId, SK = ENTITLEMENT#issueId
```

## Testing

### Mock DynamoDB

For unit tests, mock the mapper:

```typescript
import { mapper } from '@360mediadirect/modeler'

// Mock mapper operations
const mockPut = jest.fn()
const mockGet = jest.fn()
const mockQuery = jest.fn()

jest.mock('@360mediadirect/modeler', () => ({
  mapper: {
    put: mockPut,
    get: mockGet,
    query: mockQuery
  }
}))

// In tests
mockPut.mockResolvedValue(subscriptionInstance)
mockGet.mockResolvedValue(subscriptionInstance) 
mockQuery.mockReturnValue(async function* () {
  yield subscriptionInstance
})
```

### Integration Tests with DynamoDB Local

Use Docker DynamoDB Local for integration testing:

```typescript
import { mapper } from '@360mediadirect/modeler'

// Configure for local DynamoDB
process.env.AWS_DYNAMODB_ENDPOINT = 'http://localhost:8000'

beforeAll(async () => {
  // Create test tables
  await mapper.ensureTableExists(SubscriptionModel)
})

afterEach(async () => {
  // Clean up test data
  for await (const item of mapper.scan(SubscriptionModel)) {
    await mapper.delete(item)
  }
})
```

## Performance Optimization

### Connection Pool

The mapper uses connection pooling by default:

```typescript
// Configure connection limits
const mapper = new DataMapper({
  client: new DynamoDB({
    maxRetries: 3,
    httpOptions: {
      connectTimeout: 5000,
      timeout: 10000
    }
  })
})
```

### Batch Operations

Use batch operations for bulk data:

```typescript
// More efficient than individual puts
for await (const result of mapper.batchPut(items)) {
  // Process results
}

// More efficient than individual gets
for await (const item of mapper.batchGet(SubscriptionModel, keys)) {
  // Process items  
}
```

### Query Optimization

- Use specific queries instead of scans
- Leverage Global Secondary Indexes for access patterns
- Implement pagination for large result sets
- Use projection expressions to limit returned data

## Environment Configuration

Set DynamoDB configuration through environment variables:

```bash
# For local development
AWS_DYNAMODB_ENDPOINT=http://localhost:8000

# For production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Table name prefix
TABLE_NAME_PREFIX=periodical-dev-
```

## Migration Support

The modeler supports schema migrations:

```typescript
// Migration: Add new attribute with default value
export class SubscriptionModel extends BaseModel {
  @attribute()
  newField?: string = 'default-value'

  // Migrate existing items
  async migrateSchema(): Promise<void> {
    if (!this.newField) {
      this.newField = 'default-value'
      await this.save()
    }
  }
}
```

## Legal

The Periodical Modeler package is Copyright 360 Media Direct and is not licensed or authorized for public or third party use.
