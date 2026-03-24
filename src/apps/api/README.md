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
- Starts the indexer as a child process by default through the process infrastructure layer

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

By default, these commands also start the indexer as a child process.

If you want to run the indexer separately, start the API process with:

```bash
INDEXER_CHILD_PROCESS_ENABLED=false yarn start
```

In that mode, the API process will not fork the indexer.

## Build Output

Compiled entrypoint:

```text
dist/src/apps/api/main.js
```
