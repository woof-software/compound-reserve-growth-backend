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

## Built-in Schedules

- History processing uses the `CRON` environment variable.
- Oracle discovery runs every 12 hours.
- CAPO oracle data collection runs every minute.
- CAPO daily aggregation runs every 15 minutes.

## Loaded Configuration

The indexer root module loads only these config loaders:

- [`app.ts`](../../config/app.ts)
- [`database.ts`](../../config/database.ts)
- [`networks.config.ts`](../../config/networks.config.ts)
- [`redis.ts`](../../config/redis.ts)
- [`block-timing.config.ts`](../../config/block-timing.config.ts)

That means the indexer has access to:

- shared app settings such as cron expression, log level, and child-process flag
- database connection settings
- network and RPC configuration
- Redis settings
- block timing settings

The indexer root module does not load:

- [`google.ts`](../../config/google.ts)
- [`admin.ts`](../../config/admin.ts)
- [`reserve-sources.config.ts`](../../config/reserve-sources.config.ts)

The indexer root module also configures:

- `ScheduleModule.forRoot()`
- global cache through Redis
- `MailerModule` using `MAILJET_USER` and `MAILJET_PASS`

## Start Command

```bash
yarn start:indexer
```

This command is intended for the standalone indexer mode.

If the API application is running separately and `INDEXER_CHILD_PROCESS_ENABLED` is not set to `false` for the API process, the API process will still fork its own child indexer. That would leave two indexer processes running at the same time.

## Build Output

Compiled entrypoint:

```text
dist/src/apps/indexer/main.js
```
