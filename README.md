# Monorepo Node.js Serverless Template

A monorepo template for building serverless applications using Node.js, TypeScript, and AWS services. Includes JWT authentication, OpenAPI-validated REST APIs, DynamoDB modeling, and structured logging out of the box.

## Project Structure

```
monorepo-nodejs-serverless-template/
├── packages/              # Shared libraries (workspace packages)
│   ├── auth-helper/       # JWT auth utilities (EC256 keys via SSM)
│   ├── modeler/           # DynamoDB ORM (BaseModel, CRUD, soft deletes)
│   ├── restler/           # REST framework (OpenAPI, rate limiting, CORS)
│   └── service-client/    # Lambda-to-Lambda invocation client
├── services/              # Serverless services (deployed to AWS Lambda)
│   ├── api/               # API Gateway + shared infrastructure
│   ├── api-docs/          # Swagger UI docs (merged OpenAPI specs)
│   └── logs/              # Client-side logging endpoint
├── common/                # Shared TypeScript interfaces, constants, and utilities
│   ├── constants.ts       # App-wide constants and defaults
│   ├── interfaces/        # Shared type definitions (User, Organization, etc.)
│   └── util/              # Shared utility functions
├── ui/                    # Frontend applications (placeholder)
│   ├── admin/
│   └── dashboard/
├── .pnp.cjs              # Yarn PnP dependency resolution
└── lerna.json             # Lerna task orchestration config
```

## Packages

| Package | Description |
| ------- | ----------- |
| **auth-helper** | JWT authentication utilities for creating and verifying tokens using EC256 keys stored in AWS SSM Parameter Store. |
| **modeler** | Lightweight DynamoDB ORM with a BaseModel class providing CRUD operations, auto-generated IDs, soft deletes, and model metadata registration. |
| **restler** | Express-based REST framework with OpenAPI validation, JWT auth middleware, rate limiting, CORS, and structured request/response logging for Lambda services. |
| **service-client** | Typed client for invoking other Lambda-based services within the monorepo via the AWS Lambda SDK. |

## Services

| Service | Description |
| ------- | ----------- |
| **api** | API Gateway and shared infrastructure service that provisions the REST API, deployment bucket, and CloudFormation exports used by other services. |
| **api-docs** | Auto-generated Swagger UI documentation site built from merged OpenAPI specs across all services. |
| **logs** | Client-side logging service that accepts log messages via API and routes them to the structured logging system. |

## How Services Work

Each service follows the same pattern:

1. **OpenAPI spec** (`src/openapi.json`) defines routes, request/response schemas, and security
2. **Controllers** (`src/controllers/`) implement route handlers using `createController()` from restler
3. **Models** (`src/models/`) extend `BaseModel` from modeler for DynamoDB access
4. **Serverless config** (`serverless.yml`) defines Lambda functions, IAM roles, and AWS resources
5. **Common code** is copied into `src/common/` at build time via a script hook

The `restler` package ties it all together — it creates an Express app with OpenAPI validation, wires up controllers to routes, and wraps everything in a Lambda-compatible handler via `@codegenie/serverless-express`.

## Configuration

### Domain Setup

All domain references use `example.com` as a placeholder. To configure for your domain, update:

- `common/constants.ts` — `ALLOWED_URL_DOMAINS` and `IGNORE_MAX_CLIENTS_DOMAIN`
- `packages/auth-helper/src/constants.ts` — `AUDIENCE_SUFFIX` and `IGNORE_MAX_CLIENTS_DOMAIN`
- `services/*/src/openapi.json` — Server URLs
- Serverless custom config files — `tld` and `projectName`

### Environment Variables

Services use environment variables defined in their `serverless.yml`. Local development overrides are in `common/serverless/local.serverless.yml` (per-service). Key variables:

| Variable | Description |
| -------- | ----------- |
| `TLD` | Top-level domain |
| `STAGE` | Deployment stage (dev, staging, prod) |
| `SIGNING_KEY_ID` | SSM key ID for JWT signing |
| `REFRESH_DURATION` | Refresh token TTL in seconds |
| `FROM_EMAIL` | Sender email for transactional emails |
| `LOG_LEVEL` | Logging verbosity (debug, info, warn, error) |

## Prerequisites

- **Node.js**: v22.x or higher
- **Yarn**: 4.9.4 (specified in `packageManager` field)

## Initial Setup

### 1. Install Dependencies

```bash
yarn install
```

This installs all dependencies using Yarn PnP (no `node_modules` folder) and creates `.pnp.cjs` for dependency resolution.

### 2. Generate IDE SDKs

For VS Code to properly resolve TypeScript types and dependencies:

```bash
yarn dlx @yarnpkg/sdks vscode
```

### 3. Reload VS Code

1. Press `Cmd/Ctrl + Shift + P`
2. Run **"Developer: Reload Window"**
3. When prompted to use the workspace TypeScript version, click **"Allow"**

## Available Scripts

### Root

```bash
yarn build                # Build all packages and services
yarn build:services       # Build only services
yarn lint                 # Lint all packages
yarn lint:fix             # Lint and auto-fix issues
yarn test                 # Run all tests
yarn clean                # Clean all build artifacts + .yarn cache
```

### Per-package / Per-service

```bash
yarn lerna run test --scope=<name>    # Run tests for a specific package
yarn lerna run lint --scope=<name>    # Lint a specific package
yarn lerna run build --scope=<name>   # Build a specific package
```

### Deployment

```bash
yarn deploy:dev           # Deploy to dev environment
yarn deploy:staging       # Deploy to staging environment
yarn deploy:prod          # Deploy to production environment
```

## Adding a New Service

1. Create a directory under `services/` with `package.json`, `serverless.yml`, and `tsconfig.json`
2. Add an `src/openapi.json` defining your API routes
3. Create controllers in `src/controllers/` using `createController()` from restler
4. Create models in `src/models/` extending `BaseModel` from modeler (if using DynamoDB)
5. Wire up the entry point in `src/index.ts` using `createHandler()` from restler
6. Add the service's OpenAPI spec to `services/api-docs/openapi-merge.json` for merged docs

## Understanding Yarn PnP

This project uses **Yarn Plug'n'Play** instead of traditional `node_modules`:

- **No `node_modules` folder** — Dependencies are resolved via `.pnp.cjs`
- **Faster installs** — No need to copy files to `node_modules`
- **Strict dependency resolution** — Prevents phantom dependencies
- **Requires IDE SDK** — Your editor needs the SDK to resolve types

## Troubleshooting

### TypeScript can't find modules

1. Ensure dependencies are installed: `yarn install`
2. Generate SDKs: `yarn dlx @yarnpkg/sdks vscode`
3. Reload VS Code: `Cmd/Ctrl + Shift + P` → "Developer: Reload Window"
4. Accept workspace TypeScript version when prompted

### After switching branches

Always run `yarn install` after switching branches. Yarn PnP requires unplugged packages to be present on disk, and they may differ between branches.

## VS Code Configuration

The repository includes pre-configured VS Code settings (`.vscode/settings.json`):

- TypeScript SDK path configured for PnP
- Prettier and ESLint paths configured
- Yarn set as package manager

Recommended extensions (`.vscode/extensions.json`):

- `arcanis.vscode-zipfs` — PnP zip file support
- `esbenp.prettier-vscode` — Code formatting
- `dbaeumer.vscode-eslint` — Linting

## License

UNLICENSED - Private repository
