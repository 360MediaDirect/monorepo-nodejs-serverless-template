# @myorg/auth-helper

JWT authentication helper for platform services, built on top of the Embassy token library with AWS SSM Parameter Store key management.

## Overview

- Creates and configures Embassy instances for JWT token creation and verification
- Retrieves signing keys (public and private) from AWS SSM Parameter Store
- Supports environment-aware audience and issuer derivation (dev, staging, prod)
- Provides magic link token creation and validation for passwordless authentication
- Uses ES256 (ECDSA with P-256 curve) as the JWT signing algorithm
- Exports the full Embassy API for advanced use cases

## Installation

```bash
yarn add @myorg/auth-helper
```

## Configuration

### Environment Variables

| Variable                | Required | Default            | Description                                 |
| ----------------------- | -------- | ------------------ | ------------------------------------------- |
| `STAGE`                 | No       | `dev`              | Deployment stage (`dev`, `staging`, `prod`) |
| `REGION`                | No       | `us-east-1`        | AWS region for SSM Parameter Store          |
| `TOKEN_EXPIRATION_SECS` | No       | `86400` (24h)      | Access token lifetime in seconds            |
| `MAGIC_EXPIRATION_SECS` | No       | `86400` (24h)      | Magic link token lifetime in seconds        |
| `TOKEN_AUDIENCE`        | No       | Derived from stage | Override the token audience string          |
| `SIGNING_KEY_ID`        | No       | `20251211`         | ID of the signing key pair in SSM           |

### AWS SSM Parameter Store

The package retrieves cryptographic keys from SSM Parameter Store at these paths:

| Parameter Path             | Type         | Description                   |
| -------------------------- | ------------ | ----------------------------- |
| `/auth/keys/private/{kid}` | SecureString | Private signing key (ES256)   |
| `/auth/keys/public/{kid}`  | String       | Public verification key (PEM) |

The Lambda execution role must have `ssm:GetParameter` permissions for these paths.

### Environment Variable Key Overrides (Testing Only)

For local testing, keys can be provided via environment variables instead of SSM:

- `PRIVKEY_{KID}` -- Private key (pipe characters `|` are replaced with newlines)
- `PUBKEY_{KID}` -- Public key (pipe characters `|` are replaced with newlines)

These should never be used in production.

### Audience and Issuer

The audience string is derived from the `STAGE` environment variable:

| Stage                 | Audience                  | Issuer                         |
| --------------------- | ------------------------- | ------------------------------ |
| `prod` / `production` | `api.example.com`         | `api.example.com/auth`         |
| `dev`                 | `api-dev.example.com`     | `api-dev.example.com/auth`     |
| `staging`             | `api-staging.example.com` | `api-staging.example.com/auth` |

## Usage

### Setting Up an Authorizer (Standard Service Pattern)

Every service creates a shared Embassy instance in `src/lib/authorizer.ts`:

```typescript
// src/lib/authorizer.ts
import { getEmbassy, issuer } from '@myorg/auth-helper'

export const embassy = getEmbassy()
export { issuer }
```

The `embassy` instance is then passed to `createApp` from `@myorg/restler` to enable JWT middleware on all routes:

```typescript
// src/index.ts
import { createApp } from '@myorg/restler'
import { embassy } from './lib/authorizer'
import * as controllers from './controllers'
import apiSpec from './openapi.json'

const app = createApp({ controllers, apiSpec, log, embassy })
```

### Customizing the Embassy Instance

`getEmbassy` accepts an options object to override defaults:

```typescript
import { getEmbassy } from '@myorg/auth-helper'
import { SSMClient } from '@aws-sdk/client-ssm'

const embassy = getEmbassy({
  ssm: new SSMClient({ region: 'eu-west-1' }),
  audience: 'custom-audience.example.com',
  issuer: 'custom-audience.example.com/auth',
  expiresInSecs: 3600, // 1 hour
})
```

### Creating Magic Link Tokens

Magic tokens are short-lived JWTs used for passwordless authentication via email:

```typescript
import { createMagicToken } from '@myorg/auth-helper'

const token = await createMagicToken({
  email: 'user@example.com',
  userId: '42',
  expiresInSecs: 900, // Optional: 15 minutes (default: 24 hours)
})

// Send `token` in a magic link URL to the user
```

### Validating Magic Link Tokens

```typescript
import { validateMagicToken } from '@myorg/auth-helper'

try {
  const token = await validateMagicToken(tokenString)
  const userId = token.claims.sub
  const email = token.claims.email as string
  const issuedAt = token.claims.iat * 1000 // milliseconds
} catch (error) {
  // Token is invalid or expired (status 401)
}
```

You can also pass an existing Embassy instance:

```typescript
import { validateMagicToken, getEmbassy } from '@myorg/auth-helper'

const embassy = getEmbassy()
const token = await validateMagicToken(tokenString, embassy)
```

## API Reference

### `getEmbassy(opts?)`

Creates and returns a configured Embassy instance with SSM-backed key retrieval.

**Parameters:**

| Name                 | Type        | Description                           |
| -------------------- | ----------- | ------------------------------------- |
| `opts.ssm`           | `SSMClient` | Custom AWS SSM client instance        |
| `opts.audience`      | `string`    | Override the token audience           |
| `opts.issuer`        | `string`    | Override the token issuer             |
| `opts.expiresInSecs` | `number`    | Override the default token expiration |

**Returns:** `Embassy` -- A configured Embassy instance.

### `createMagicToken(opts)`

Creates a signed magic link token for passwordless authentication.

**Parameters:**

| Name                 | Type      | Required | Description                               |
| -------------------- | --------- | -------- | ----------------------------------------- |
| `opts.email`         | `string`  | Yes      | User's email address                      |
| `opts.userId`        | `string`  | Yes      | User's ID                                 |
| `opts.embassy`       | `Embassy` | No       | Embassy instance (creates one if omitted) |
| `opts.expiresInSecs` | `number`  | No       | Token lifetime (default: 24 hours)        |

**Returns:** `Promise<string>` -- The signed JWT string.

### `validateMagicToken(tokenStr, embassy?)`

Validates a magic link token for authenticity and expiration.

**Parameters:**

| Name       | Type      | Required | Description                               |
| ---------- | --------- | -------- | ----------------------------------------- |
| `tokenStr` | `string`  | Yes      | The magic token string to validate        |
| `embassy`  | `Embassy` | No       | Embassy instance (creates one if omitted) |

**Returns:** `Promise<Token>` -- The parsed and verified Embassy Token instance with `claims.sub`, `claims.email`, and `claims.iat`.

**Throws:** Error with status 401 if validation fails.

### `issuer`

Exported `string` constant representing the token issuer for the current stage (e.g., `api-dev.example.com/auth`).

### `audience`

Exported `string` constant representing the token audience for the current stage (e.g., `api-dev.example.com`).

### Re-exported Embassy API

The package re-exports all types and classes from `@myorg/embassy`, so consumers do not need to install Embassy directly.

## Domain Scopes

The package includes a `domainScopes.json` configuration that defines permission scopes:

| Domain  | Scope              | Level |
| ------- | ------------------ | ----- |
| `admin` | `dashboard`        | 0     |
| `auth`  | `getUsers`         | 0     |
| `auth`  | `createUser`       | 1     |
| `auth`  | `getAnyUser`       | 2     |
| `auth`  | `getOrganizations` | 3     |

These scopes are passed to the Embassy instance and can be used for fine-grained authorization checks in services.

## Development

```bash
# Build the package
yarn build

# Clean build artifacts
yarn clean
```

The package requires Node.js >= 22.x and TypeScript 5.x.

## License

UNLICENSED
