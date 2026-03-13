# API Application

## Purpose

This application starts the HTTP API.

## Entry Point

- Bootstrap: [`main.ts`](main.ts)
- Root module: [`api-app.module.ts`](api-app.module.ts)

## What It Does

- Creates a Nest HTTP application
- Enables shutdown hooks
- Sets the global prefix to `api`
- Enables global validation with `ValidationPipe`
- Enables CORS from `app.cors`
- Starts Swagger at `api/docs` only when `app.apiDocumentation` is enabled

## Main Imported Modules

- [`HistoryModule`](../../modules/history/history.module.ts)
- [`CapoModule`](../../modules/capo/capo.module.ts)
- [`ContractModule`](../../modules/contract/contract.module.ts)
- [`SourceModule`](../../modules/source/source.module.ts)
- [`PriceModule`](../../modules/price/price.module.ts)
- [`BackgroundWorkerModule`](../../infrastructure/process/background-worker.module.ts)

## Start Commands

```bash
yarn start
yarn start:dev
yarn start:debug
yarn start:prod
```

## Build Output

Compiled entrypoint:

```text
dist/src/apps/api/main.js
```
