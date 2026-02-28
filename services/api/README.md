# API Service

Core API Gateway infrastructure service. This service provisions the shared AWS API Gateway REST API, CORS gateway responses, the DynamoDB mutex locks table, and exports CloudFormation outputs consumed by all downstream services.

## Overview

The API service is the **Phase 1 foundation** of the deployment pipeline. It does not contain business logic Lambda functions -- its purpose is to create and configure the shared API Gateway that every other service attaches its endpoints to. It also provisions shared infrastructure resources (mutex locks table and IAM role) used across the platform.

The only Lambda function defined here is a lightweight `/version` endpoint that returns the current build version string (package version plus abbreviated git SHA).

## Architecture

```
API Service (Phase 1 -- deploys first)
  |
  +-- AWS API Gateway REST API
  |     +-- CORS Gateway Responses (4XX, 5XX, MISSING_AUTHENTICATION_TOKEN)
  |     +-- /version endpoint (Lambda)
  |
  +-- DynamoDB Mutex Locks Table
  |     +-- Partition key: id (String)
  |     +-- Sort key: group (String)
  |     +-- TTL on "ttl" attribute
  |     +-- PAY_PER_REQUEST billing
  |
  +-- IAM LocksRole (assumed by Lambda functions needing mutex access)
  |
  +-- CloudFormation Outputs (consumed by all other services)
        +-- ExtApiGatewayRestApiId
        +-- ExtApiGatewayRestApiRootResourceId
        +-- LocksRoleArn
```

All other services (auth, logs, publishers, offers, etc.) import the API Gateway ID and Root Resource ID via `Fn::ImportValue` to attach their own endpoints to this shared gateway.

## Setup

```bash
cd services/api
yarn install
```

## Configuration

### serverless.yml

| Setting | Value | Description |
|---------|-------|-------------|
| Service name | `myapp-api` | Derived from `projectName.lower` |
| Runtime | `nodejs22.x` | Node.js 22 |
| Region | `us-east-1` | Primary deployment region |
| Stage | `${opt:stage}` | `dev` or `prod` |

### CloudFormation Resources

| Resource | Type | Purpose |
|----------|------|---------|
| `GatewayResponseDefault4XX` | `AWS::ApiGateway::GatewayResponse` | Adds CORS headers to all 4XX error responses |
| `GatewayResponseDefault5XX` | `AWS::ApiGateway::GatewayResponse` | Adds CORS headers to all 5XX error responses |
| `GatewayResponseMissingAuthToken` | `AWS::ApiGateway::GatewayResponse` | Converts 403 MISSING_AUTHENTICATION_TOKEN to 200 with CORS headers for preflight OPTIONS requests |
| `MutexLocksTable` | `AWS::DynamoDB::Table` | Distributed mutex lock table with TTL support |
| `LocksRole` | `AWS::IAM::Role` | IAM role granting full DynamoDB access to the locks table |

### CloudFormation Outputs

| Output | Export Name | Consumed By |
|--------|-------------|-------------|
| `ApiGatewayRestApiId` | `myapp-{stage}-ExtApiGatewayRestApiId` | All downstream services |
| `ApiGatewayRestApiRootResourceId` | `myapp-{stage}-ExtApiGatewayRestApiRootResourceId` | All downstream services |
| `LocksRoleArn` | `myapp-{stage}-LocksRoleArn` | Services requiring distributed locking |

### CORS Configuration

The gateway responses inject the following headers on all error responses so that browsers receive proper CORS headers even when the request never reaches a Lambda function:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: *`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`

The `MISSING_AUTHENTICATION_TOKEN` response type specifically handles the case where API Gateway returns a 403 because no OPTIONS mock integration exists for a given path. This response overrides the status code to 200 so that browser CORS preflight requests succeed.

## Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/version` | `versionHandler` | Returns the current API version (`{pkg.version}-{gitSha}`) |

## Build Process

```bash
yarn build
```

The build script (`scripts/build.sh`) performs the following steps:

1. Copies `src/` to `dist/`
2. Reads the version from `package.json`
3. Gets the abbreviated git SHA from HEAD
4. Overwrites `dist/version.js` with the concatenated version string (e.g., `1.0.0-a3f632b`)

## Development

```bash
# Run tests
yarn test

# Clean build artifacts
yarn clean
```

Tests run with `--passWithNoTests` since this service has minimal application logic.

### Deployment Order

This service **must be deployed before all other services** because they depend on its CloudFormation outputs. The CI/CD pipeline enforces this ordering:

1. **Phase 1:** `api` (this service)
2. **Phase 2:** `api-docs`, `auth`, `logs` (parallel)
3. **Phase 3:** `publishers`, `properties`, `admin`, and other entity services (parallel)

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) -- Project-wide development guidelines
- [common/serverless/serverless.custom.yml](/common/serverless/serverless.custom.yml) -- Shared serverless configuration
- [.github/workflows/deploy.yml](/.github/workflows/deploy.yml) -- CI/CD deployment pipeline

## License

UNLICENSED
