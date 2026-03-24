# Compound Reserve Growth Backend

Backend repository for Compound Reserve Growth. The codebase is organized as one domain codebase with two NestJS runtime applications:

- API application: serves HTTP endpoints and Swagger
- Indexer application: runs background synchronization, cron jobs, and queue workers

The two applications share domain modules from `src/modules`, but they have separate composition roots under `src/apps`.

## Runtime Overview

```text
src/
  apps/
    api/          HTTP application bootstrap and root module
    indexer/      background application bootstrap and root module
  modules/        domain and feature modules
  infrastructure/ process, Redis, HTTP, logger, and other technical wiring
  common/         shared blockchain/network helpers
  config/         env-backed configuration loaders
  database/       TypeORM setup and migrations
```

## Applications

### API application

Location:

- [`src/apps/api/main.ts`](src/apps/api/main.ts)
- [`src/apps/api/api-app.module.ts`](src/apps/api/api-app.module.ts)

Responsibilities:

- starts the Nest HTTP server
- sets the global prefix to `api`
- enables global validation
- enables CORS from configuration
- exposes Swagger at `api/docs` when `API_DOCUMENTATION=true`
- starts the background worker child process through the process infrastructure module

Main imported modules:

- [`HistoryModule`](src/modules/history/history.module.ts)
- [`CapoModule`](src/modules/capo/capo.module.ts)
- [`ContractModule`](src/modules/contract/contract.module.ts)
- [`SourceModule`](src/modules/source/source.module.ts)
- [`AssetModule`](src/modules/asset/asset.module.ts)
- [`TreasuryModule`](src/modules/treasury/treasury.module.ts)
- [`RevenueModule`](src/modules/revenue/revenue.module.ts)
- [`PriceModule`](src/modules/price/price.module.ts)
- [`RunwayModule`](src/modules/runway/runway.module.ts)
- [`EventModule`](src/modules/event/event.module.ts)
- [`BackgroundWorkerModule`](src/infrastructure/process/background-worker.module.ts)

See also: [`src/apps/api/README.md`](src/apps/api/README.md)

### Indexer application

Location:

- [`src/apps/indexer/main.ts`](src/apps/indexer/main.ts)
- [`src/apps/indexer/indexer-app.module.ts`](src/apps/indexer/indexer-app.module.ts)

Responsibilities:

- starts a Nest application context without an HTTP server
- runs scheduled jobs and background processing
- handles graceful shutdown on `SIGINT` and `SIGTERM`

Main imported modules:

- [`HistoryCronModule`](src/modules/history/history-cron.module.ts)
- [`OracleDiscoveryModule`](src/modules/oracle/background/oracle-discovery.module.ts)
- [`CapoBackgroundModule`](src/modules/capo/capo-background.module.ts)

Loaded config modules:

- [`src/config/app.ts`](src/config/app.ts)
- [`src/config/database.ts`](src/config/database.ts)
- [`src/config/networks.config.ts`](src/config/networks.config.ts)
- [`src/config/redis.ts`](src/config/redis.ts)
- [`src/config/block-timing.config.ts`](src/config/block-timing.config.ts)

See also: [`src/apps/indexer/README.md`](src/apps/indexer/README.md)

## Process Model

By default, the API application starts the indexer as a child process during API bootstrap.

Process infrastructure:

- [`src/infrastructure/process/background-worker.module.ts`](src/infrastructure/process/background-worker.module.ts)
- [`src/infrastructure/process/background-worker-child-process.service.ts`](src/infrastructure/process/background-worker-child-process.service.ts)

Current behavior:

1. The API application boots.
2. [`BackgroundWorkerChildProcessService`](src/infrastructure/process/background-worker-child-process.service.ts) runs during application bootstrap.
3. If `INDEXER_CHILD_PROCESS_ENABLED` is not set to `false`, the service forks:

```text
dist/src/apps/indexer/main.js
```

4. The child process inherits stdio.
5. The child process receives `INDEXER_CHILD_PROCESS_ENABLED=false` to avoid recursive spawning.
6. If the child process fails to start or exits unexpectedly, the API process is terminated.
7. On API shutdown, the child process receives `SIGTERM`.

## Supported Runtime Modes

There are two supported ways to run the applications:

### 1. Run only the API application

In this mode, the API process starts the indexer automatically as a child process.

Requirements:

- Keep `INDEXER_CHILD_PROCESS_ENABLED` enabled or unset
- Start the API normally with `yarn start`, `yarn start:dev`, `yarn start:debug`, or `yarn start:prod`

Effect:

- One API process runs
- One child indexer process is forked by the API process

### 2. Run the API application and the indexer application separately

In this mode, the indexer is started manually as its own process.

Requirements:

- Set `INDEXER_CHILD_PROCESS_ENABLED=false` for the API process
- Start the API process
- Start the indexer process separately with `yarn start:indexer`

Important:

- If you run `yarn start:indexer` separately and do not disable `INDEXER_CHILD_PROCESS_ENABLED` for the API process, the API process will still fork another indexer child process
- That results in two indexer processes running at the same time

See also: [`src/infrastructure/process/README.md`](src/infrastructure/process/README.md)

## Execution Flow

```text
HTTP client
  -> API application
     -> controllers / services / repositories
     -> background worker launcher
        -> forks indexer application
           -> cron jobs
           -> queue workers
           -> background synchronization flows
```

This separation keeps user-facing HTTP handling in the API process and background work in the indexer process.

Related runtime documentation:

- API runtime: [`src/apps/api/README.md`](src/apps/api/README.md)
- Indexer runtime: [`src/apps/indexer/README.md`](src/apps/indexer/README.md)
- Process launcher: [`src/infrastructure/process/README.md`](src/infrastructure/process/README.md)

## Repository Structure

Top-level source directories:

- [`src/apps`](src/apps) - application entrypoints and root modules
- [`src/modules`](src/modules) - domain and feature modules
- [`src/infrastructure`](src/infrastructure) - technical runtime concerns
- [`src/common`](src/common) - shared blockchain and network helpers
- [`src/config`](src/config) - configuration loaders
- [`src/database`](src/database) - TypeORM config and migrations
- [`src/cli`](src/cli) - CLI entrypoints

Example layout:

```text
src/
  apps/
    api/
    indexer/
  modules/
    admin/
    asset/
    capo/
    contract/
    event/
    github/
    history/
    mail/
    oracle/
    price/
    revenue/
    runway/
    source/
    sources-update/
    treasury/
  infrastructure/
    http/
    logger/
    process/
    redis/
```

Module examples:

- [`src/modules/history`](src/modules/history)
- [`src/modules/capo`](src/modules/capo)
- [`src/modules/oracle`](src/modules/oracle)

## Local Development

### Install dependencies

```bash
yarn install
```

### Build

```bash
yarn build
```

Scripts reference: [`package.json`](package.json)

### Run the API application

```bash
yarn start
```

By default, this also starts the indexer as a child process.

Development mode:

```bash
yarn start:dev
```

Debug mode:

```bash
yarn start:debug
```

Production-style API start from compiled output:

```bash
yarn start:prod
```

### Run the indexer application directly

```bash
yarn start:indexer
```

This command builds the project and then starts the compiled indexer entrypoint.

If you run the indexer separately from the API process, set `INDEXER_CHILD_PROCESS_ENABLED=false` for the API process first. Otherwise the API process will fork an additional child indexer.

## Environment Configuration

Shared application configuration is defined in [`src/config/app.ts`](src/config/app.ts).

Relevant variables used there:

- `APP_HOST` - HTTP bind host for the API application
- `APP_PORT` - HTTP port for the API application
- `APP_CORS_ORIGIN` - CORS origin mode or origin list
- `API_DOCUMENTATION` - enables Swagger when set to `true`
- `LOG_LEVEL` - comma-separated Nest logger levels
- `EMAIL_TO` - recipient list used by mail-related flows
- `CRON` - cron expression used by scheduled history processing
- `INDEXER_CHILD_PROCESS_ENABLED` - enables or disables child process startup from the API process

Other runtime configuration is loaded from:

- [`src/config/database.ts`](src/config/database.ts)
- [`src/config/networks.config.ts`](src/config/networks.config.ts)
- [`src/config/redis.ts`](src/config/redis.ts)
- [`src/config/google.ts`](src/config/google.ts)
- [`src/config/admin.ts`](src/config/admin.ts)
- [`src/config/reserve-sources.config.ts`](src/config/reserve-sources.config.ts)
- [`src/config/block-timing.config.ts`](src/config/block-timing.config.ts)

The API and indexer applications do not load exactly the same configuration set. Each application only loads the config that its root module imports.

Indexer config set:

- [`src/config/app.ts`](src/config/app.ts)
- [`src/config/database.ts`](src/config/database.ts)
- [`src/config/networks.config.ts`](src/config/networks.config.ts)
- [`src/config/redis.ts`](src/config/redis.ts)
- [`src/config/block-timing.config.ts`](src/config/block-timing.config.ts)

The indexer root module does not load:

- [`src/config/google.ts`](src/config/google.ts)
- [`src/config/admin.ts`](src/config/admin.ts)
- [`src/config/reserve-sources.config.ts`](src/config/reserve-sources.config.ts)

## Build Output

Compiled runtime entrypoints:

- `dist/src/apps/api/main.js`
- `dist/src/apps/indexer/main.js`

CLI entrypoints are compiled under `dist/src/cli/...`.

## Database Migrations

Migration commands:

```bash
yarn migration:run
yarn migration:revert
yarn migration:show
yarn migration:create
yarn migration:generate
```

TypeORM configuration:

- [`src/database/typeorm.config.ts`](src/database/typeorm.config.ts)

Migrations directory:

- [`src/database/migrations`](src/database/migrations)

## CLI Commands

Available project CLI commands:

```bash
yarn cli:sources-update
yarn cli:history-get
yarn cli:stats:get
yarn cli:event-fill
yarn cli:price-preload
yarn cli:collateral-search-markets-v3
```

### Local-only collateral discovery command

`yarn cli:collateral-search-markets-v3` is a local-only utility command.

Its purpose is to help a developer or operator manually inspect Compound v3 collateral market discovery results outside the normal application runtime.

Intended use cases:

- local investigation during development
- one-off export of discovery output for review
- manual comparison of collateral scan results while changing collateral logic

This command is not part of the supported production execution flow:

- it is not started by the API application
- it is not started by the indexer application
- it is not a cron-driven background job
- it should not be used as a CI/CD step
- it should not be treated as a persistent project dataset generator

Current behavior:

- it runs the compiled CLI entrypoint
- it executes the `collateral:search-markets-v3` command
- it writes the generated artifact to `collateral-markets-v3.json` in the current working directory

The generated file is a local workspace artifact and is intentionally ignored by Git.

CLI sources:

- [`src/cli/README.md`](src/cli/README.md)
- [`src/cli/sources-update`](src/cli/sources-update)
- [`src/cli/history`](src/cli/history)
- [`src/cli/event`](src/cli/event)
- [`src/cli/price`](src/cli/price)
- [`src/cli/collateral`](src/cli/collateral)

CLI entry files:

- [`src/cli/sources-update/cli-sources-update.ts`](src/cli/sources-update/cli-sources-update.ts)
- [`src/cli/history/cli-history-get.ts`](src/cli/history/cli-history-get.ts)
- [`src/cli/history/cli-stats-get.ts`](src/cli/history/cli-stats-get.ts)
- [`src/cli/event/cli-event-fill.ts`](src/cli/event/cli-event-fill.ts)
- [`src/cli/price/cli-price-preload.ts`](src/cli/price/cli-price-preload.ts)
- [`src/cli/collateral/cli-collateral-search-markets-v3.ts`](src/cli/collateral/cli-collateral-search-markets-v3.ts)

## Docker

The current [`Dockerfile`](Dockerfile) starts the API application from compiled output:

```text
node dist/src/apps/api/main.js
```

## Related Documentation

- [`src/apps/api/README.md`](src/apps/api/README.md)
- [`src/apps/indexer/README.md`](src/apps/indexer/README.md)
- [`src/infrastructure/process/README.md`](src/infrastructure/process/README.md)
