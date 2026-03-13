# Indexer Application

## Purpose

This application runs background jobs without starting an HTTP server.

## Entry Point

- Bootstrap: [`main.ts`](main.ts)
- Root module: [`indexer-app.module.ts`](indexer-app.module.ts)

## What It Does

- Creates a Nest application context
- Registers signal handlers for `SIGINT` and `SIGTERM`
- Closes the Nest context on shutdown

## Main Imported Modules

- [`HistoryCronModule`](../../modules/history/history-cron.module.ts)
- [`OracleDiscoveryModule`](../../modules/oracle/background/oracle-discovery.module.ts)
- [`CapoBackgroundModule`](../../modules/capo/capo-background.module.ts)

## Start Command

```bash
yarn start:indexer
```

## Build Output

Compiled entrypoint:

```text
dist/src/apps/indexer/main.js
```
