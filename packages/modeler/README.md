# @myorg/modeler

DynamoDB model access library for AWS SDK v3, providing a lightweight ORM-style base class and batch operation utilities.

## Overview

- **BaseModel class** with built-in CRUD operations (get, save, soft delete, hard delete)
- **Model registry** for mapping classes to DynamoDB tables with hash/range key configuration
- **Auto-generated UUIDs** for hash keys on new records
- **Soft delete support** with `deletedAt` and `deletedReason` fields
- **GSI/LSI query support** via the `get` method with optional index name
- **Batch operations** for bulk put and delete with automatic 25-item chunking
- **Auto-paginating scan** generator for iterating over entire tables
- **Query helper** with hash key, range key, index, and pagination support
- **Pre-configured DynamoDB Document Client** with `removeUndefinedValues` marshalling

## Installation

```bash
yarn add @myorg/modeler
```

## Usage

### Defining a Model

Extend `BaseModel` and register the class with its DynamoDB table metadata:

```typescript
import { BaseModel, registerModel } from '@myorg/modeler'

interface UserProperties {
  id: string
  email: string
  name: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
  deletedReason?: string
}

class User extends BaseModel implements UserProperties {
  public email: string
  public name: string
}

registerModel(User, {
  tableName: 'users',
  hashKey: 'id',
  autoGenerateHashKey: true,
})
```

For tables with a composite key (hash + range):

```typescript
class SessionToken extends BaseModel {
  public userId: string
  public tokenId: string
  public expiresAt: number
}

registerModel(SessionToken, {
  tableName: 'session_tokens',
  hashKey: 'userId',
  rangeKey: 'tokenId',
})
```

### Creating and Saving Records

```typescript
// Create a new record using the static `from` factory
const user = User.from<User>({
  email: 'jane@example.com',
  name: 'Jane Doe',
  createdAt: Date.now(),
})

// Save to DynamoDB (auto-generates UUID for `id` if not set)
await user.save()

console.log(user.id)        // e.g. "a1b2c3d4-..."
console.log(user.updatedAt) // timestamp set automatically
```

### Fetching Records

```typescript
// Get by primary key
const user = await User.get<User>({ id: 'a1b2c3d4-...' })

// Get by primary key with strong consistency
const user = await User.get<User>({ id: 'a1b2c3d4-...' }, undefined, true)

// Query by GSI
const user = await User.get<User>({ email: 'jane@example.com' }, 'email-index')
```

If no item is found by primary key, an `ItemNotFoundException` error is thrown.

### Updating Records

```typescript
const user = await User.get<User>({ id: 'a1b2c3d4-...' })
user.name = 'Jane Smith'
await user.save() // updatedAt is refreshed automatically
```

### Deleting Records

```typescript
// Soft delete (sets deletedAt timestamp and optional reason)
await user.softDelete('Account closed by user')

// Hard delete (permanently removes from DynamoDB)
await user.hardDelete()
```

### Batch Operations

Use `doBatchOp` for bulk writes or deletes within a single table:

```typescript
import { doBatchOp } from '@myorg/modeler'
import { docClient } from '@myorg/modeler'

const items = [
  { id: '1', name: 'Item One' },
  { id: '2', name: 'Item Two' },
]

// Batch put
const putCount = await doBatchOp(docClient, 'put', items, 'my-table')

// Batch delete (pass the key attribute name)
const deleteCount = await doBatchOp(docClient, 'delete', items, 'my-table', 'id')
```

### Processing Large Datasets

Use `runOpsOnItemSet` to iterate over an async generator, apply a transform callback, and batch-write results in chunks of 25:

```typescript
import { runOpsOnItemSet, autoPaginateScan, docClient } from '@myorg/modeler'

const scanner = autoPaginateScan(docClient, {
  TableName: 'my-table',
  FilterExpression: '#status = :active',
  ExpressionAttributeNames: { '#status': 'status' },
  ExpressionAttributeValues: { ':active': 'active' },
})

await runOpsOnItemSet(
  docClient,
  'put',
  async (item) => {
    // Transform each item; return isUpdated: true to include in batch write
    return {
      isUpdated: true,
      updateItem: { ...item, migratedAt: Date.now() },
    }
  },
  scanner,
  'my-table',
  undefined, // keyName (only needed for delete)
  true,       // quiet mode (suppress console output)
)
```

### Auto-Paginating Table Scan

`autoPaginateScan` is an async generator that handles DynamoDB pagination automatically:

```typescript
import { autoPaginateScan, docClient } from '@myorg/modeler'

const scanner = autoPaginateScan(docClient, {
  TableName: 'my-table',
})

for await (const item of scanner) {
  console.log(item)
}
```

### Running Queries

Use `runQuery` for direct DynamoDB queries with hash/range key support:

```typescript
import { runQuery, docClient } from '@myorg/modeler'

// Simple hash key query
const result = await runQuery(docClient, 'my-table', 'userId', 'user-123')

// Hash + range key query
const result = await runQuery(docClient, 'my-table', 'userId', 'user-123', 'date', '2026-01-15')

// Query a GSI
const result = await runQuery(docClient, 'my-table', 'email', 'jane@example.com', undefined, undefined, 'email-index')

// Paginated query (pass LastEvaluatedKey from previous result)
const page2 = await runQuery(docClient, 'my-table', 'userId', 'user-123', undefined, undefined, undefined, result.LastEvaluatedKey)
```

## API Reference

### BaseModel (class)

| Member | Type | Description |
|--------|------|-------------|
| `id` | `string` | Primary identifier |
| `createdAt` | `number` | Creation timestamp (epoch ms) |
| `updatedAt` | `number` | Last update timestamp (epoch ms, set automatically on save) |
| `deletedAt` | `number \| undefined` | Soft delete timestamp |
| `deletedReason` | `string \| undefined` | Soft delete reason |
| `from(obj)` | static | Factory method: creates an instance from a partial object |
| `get(keyObject, indexName?, strongConsistent?)` | static async | Fetches a record by key or GSI query |
| `save()` | async | Persists the instance to DynamoDB (auto-generates hash key UUID if configured) |
| `softDelete(reason?)` | async | Sets `deletedAt`/`deletedReason` and saves |
| `hardDelete()` | async | Permanently removes the record from DynamoDB |

### registerModel(modelClass, metadata)

Registers a model class with its DynamoDB table configuration.

| Parameter | Type | Description |
|-----------|------|-------------|
| `modelClass` | `Function` | The model class constructor |
| `metadata.tableName` | `string` | DynamoDB table name |
| `metadata.hashKey` | `string` | Partition key attribute name |
| `metadata.rangeKey` | `string \| undefined` | Sort key attribute name (optional) |
| `metadata.autoGenerateHashKey` | `boolean \| undefined` | Auto-generate UUID for hash key on save (optional) |

### getMetadata(modelClass)

Returns the registered `ModelMetadata` for a class. Throws if the class has not been registered.

### hasMetadata(modelClass)

Returns `true` if the class has been registered, `false` otherwise.

### docClient

Pre-configured `DynamoDBDocumentClient` instance. Reads `DYNAMODB_REGION` and `DYNAMODB_ENDPOINT` from environment variables. Defaults to `us-east-1`.

### mapper

Legacy alias for `docClient` (backward compatibility).

### doBatchOp(client, operation, items, tableName, keyName?)

Executes a batch write (put or delete) for an array of items.

### runOpsOnItemSet(client, operation, callback, asyncGenerator, tableName, keyName?, isQuiet?)

Iterates over an async generator, applies a callback to each item, and batch-writes updated items in chunks of 25.

### autoPaginateScan(docClient, params)

Async generator that auto-paginates a DynamoDB scan, yielding individual items.

### runQuery(client, tableName, hashField, hashValue, rangeField?, rangeValue?, indexName?, lastEvaluatedKey?)

Executes a DynamoDB query with support for hash key, range key, GSI, and pagination. Returns up to 300 items per call.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DYNAMODB_REGION` | `AWS_REGION` or `us-east-1` | AWS region for DynamoDB client |
| `DYNAMODB_ENDPOINT` | (none) | Custom endpoint URL (useful for local DynamoDB) |

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

# Run tests in watch mode
yarn test:watch

# Clean build artifacts
yarn clean
```

## License

UNLICENSED
