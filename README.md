# Monorepo Node.js Serverless Template

A monorepo template for building serverless applications using Node.js, TypeScript, and AWS services.

## Overview

This is a **Yarn workspace monorepo** using **Yarn PnP (Plug'n'Play)** for dependency management and **Lerna** for orchestrating tasks across packages.

### Project Structure

```
monorepo-nodejs-serverless-template/
├── packages/          # Shared libraries and utilities
│   ├── auth-helper/
│   ├── modeler/
│   ├── restler/
│   └── service-client/
├── services/          # Serverless services
│   ├── api/
│   ├── api-docs/
│   ├── auth/
│   └── logs/
├── ui/                # Frontend applications
├── common/            # Shared common files
```

## Prerequisites

- **Node.js**: v22.x or higher
- **Yarn**: 4.9.4 (specified in `packageManager` field)

## Initial Setup

### 1. Install Dependencies

```bash
yarn install
```

This command:

- Installs all dependencies using Yarn PnP (no `node_modules` folder)
- Creates `.pnp.cjs` for dependency resolution
- Builds native packages (nx, tree-sitter, etc.)

### 2. Generate IDE SDKs

For VS Code to properly resolve TypeScript types and dependencies:

```bash
yarn dlx @yarnpkg/sdks vscode
```

This creates:

- `.yarn/sdks/typescript/` - TypeScript language server SDK
- `.yarn/sdks/eslint/` - ESLint SDK
- `.yarn/sdks/prettier/` - Prettier SDK

### 3. Reload VS Code

After generating SDKs:

1. Press `Cmd/Ctrl + Shift + P`
2. Run **"Developer: Reload Window"**
3. When prompted to use the workspace TypeScript version, click **"Allow"**

## Understanding Yarn PnP

This project uses **Yarn Plug'n'Play** instead of traditional `node_modules`:

- ✅ **No `node_modules` folder** - Dependencies are resolved via `.pnp.cjs`
- ✅ **Faster installs** - No need to copy files to `node_modules`
- ✅ **Strict dependency resolution** - Prevents phantom dependencies
- ⚠️ **Requires IDE SDK** - Your editor needs the SDK to resolve types

If you see TypeScript errors about missing modules, make sure you've:

1. Run `yarn install`
2. Generated SDKs with `yarn dlx @yarnpkg/sdks vscode`
3. Reloaded VS Code

## Available Scripts

### Building

```bash
yarn build                # Build all packages and services
yarn build:services       # Build only services
```

### Linting

```bash
yarn lint                 # Lint all packages
yarn lint:fix             # Lint and auto-fix issues
```

### Cleaning

```bash
yarn clean                # Clean all packages + remove .yarn cache
```

**Important**: After running `yarn clean`, you need to reinstall:

```bash
yarn install
yarn dlx @yarnpkg/sdks vscode
```

### Deployment

```bash
yarn deploy:dev           # Deploy to dev environment
yarn deploy:staging       # Deploy to staging environment
yarn deploy:prod          # Deploy to production environment
```

## Workspace Management

This monorepo uses **Lerna** to run commands across multiple packages:

- Workspaces are defined in `package.json` under `workspaces`
- Lerna automatically detects workspaces and runs tasks in parallel
- Use `lerna run <command>` to run a command in all packages that define it

## Troubleshooting

### TypeScript can't find modules

1. Ensure dependencies are installed: `yarn install`
2. Generate SDKs: `yarn dlx @yarnpkg/sdks vscode`
3. Reload VS Code: `Cmd/Ctrl + Shift + P` → "Developer: Reload Window"
4. Accept workspace TypeScript version when prompted

### Lerna command fails

If you see errors about missing packages (like `nx`), run:

```bash
yarn install
```

This ensures all unplugged packages are materialized on disk.

### After switching branches

When switching branches, always run:

```bash
yarn install
```

Yarn PnP requires unplugged packages to be present on disk, and they may differ between branches.

## VS Code Configuration

The repository includes pre-configured VS Code settings (`.vscode/settings.json`):

- TypeScript SDK path configured
- Prettier path configured for PnP
- ESLint node path configured
- Yarn set as package manager

Recommended extensions (`.vscode/extensions.json`):

- `arcanis.vscode-zipfs` - For PnP zip file support
- `esbenp.prettier-vscode` - Code formatting
- `dbaeumer.vscode-eslint` - Linting

## Contributing

1. Create a feature branch from `master`
2. Make your changes
3. Run `yarn lint` to check for issues
4. Run `yarn build` to ensure everything compiles
5. Commit your changes
6. Create a pull request

## License

UNLICENSED - Private repository
