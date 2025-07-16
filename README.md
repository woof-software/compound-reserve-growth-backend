# Compound Reserve Growth Backend

> **License:** MIT
>
> A NestJS service that indexes on‑chain reserve growth for Compound‑based lending markets (v2 & v3/Comet) across multiple EVM networks, enriches the data with historical token prices, and exposes it via a PostgreSQL database & REST/Swagger API.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Local Development](#local-development)

   1. [Prerequisites](#prerequisites)
   2. [Environment Variables](#environment-variables)
   3. [Quick Start](#quick-start)
   4. [Database Migrations](#database-migrations)

4. [Production Deployment](#production-deployment)
5. [Managing Sources & Assets](#managing-sources--assets)
6. [Historical Data Collection Flow](#historical-data-collection-flow)
7. [CLI Reference](#cli-reference)
8. [License](#license)

---

## Project Overview

The **Compound Reserve Growth Backend** continuously tracks the growth of protocol reserves for every supported Compound market. It:

- Discovers markets automatically (v2 via the Comptroller ➜ `getAllMarkets`, v3 via `roots.json` in `compound-finance/comet`).
- Stores on‑chain reserve balances **per‑day** together with USD valuations (fetched from on‑chain or CoinGecko) in PostgreSQL.
- Serves data through a typed REST API (Swagger‑documented) & can push alerts by email.
- Caches expensive blockchain operations in Redis for massive speed‑ups.

Use‑cases include treasury dashboards, risk monitoring, and on‑chain accounting.

---

## Architecture

```text
┌─────────────┐        Cron/NestJS Scheduler        ┌────────────────────┐
│  External   │  ┌───────────┐  reserves  ┌──────┐  │  PostgreSQL        │
│  EVM RPCs   │──► Provider  │────────────► Core │──►  history, sources │
└─────────────┘  │   Factory │  prices    │      │  └────────────────────┘
                 └───────────┘            │      │
                                          │      │
             ┌────────────────────┐       │      │
             │ Redis (cache)      │◄──────┘      │
             └────────────────────┘              │
                                                ▼
                                         REST API / Swagger
```

Key components:

| Module       | Responsibility                                                               |
| ------------ | ---------------------------------------------------------------------------- |
| **Network**  | Provides RPC providers per network (alchemy, quicknode, etc.).               |
| **Contract** | Reads state, computes reserve snapshots, handles chain quirks.               |
| **Price**    | Fetches historical token prices (CoinGecko) with a fallback for stablecoins. |
| **Source**   | Metadata for each market (address, network, algorithm).                      |
| **History**  | Daily reserve snapshots (quantity, USD value, block).                        |
| **Event**    | One‑off protocol announcements (merges, sunsets) to annotate charts.         |

---

## Local Development

### Prerequisites

- **Node.js ≥ 20** (LTS recommended)
- **PostgreSQL ≥ 15** (with `uuid‑ossp` extension enabled)
- **Redis ≥ 7** (optional but strongly recommended)
- `yarn` or `npm`

### Environment Variables

Copy `.env.example` to `.env` and fill in the blanks:

```bash
cp .env.example .env
```

| Variable                                  | Required | Description                                              |
| ----------------------------------------- | -------- | -------------------------------------------------------- |
| `APP_HOST`, `APP_PORT`                    | no       | Host/port the HTTP server binds to.                      |
| `APP_CORS_ORIGIN`                         | no       | Comma‑separated whitelist for CORS.                      |
| `LOG_LEVEL`                               | no       | `error`, `warn`, `log`, `debug`, `verbose`.              |
| `DB_*`                                    | **yes**  | PostgreSQL connection params.                            |
| `REDIS_*`                                 | yes\*    | Redis host, TLS toggle, connection timeout, default TTL. |
| `ANKR_KEY`, `UNICHAIN_QUICKNODE_KEY`      | **yes**  | RPC keys, per network in `config/networks.config.ts`.    |
| `COINGECKO_API_KEY`                       | no       | Raises rate limits for price fetcher.                    |
| `GOOGLE_SHEETS_*`                         | no       | Optional Google Sheets export.                           |
| `MAILJET_USER`, `MAILJET_PASS`, `EMAIL_*` | no       | Email notifications (price failures, cron errors).       |

> ℹ️ Anything not provided falls back to sensible defaults (e.g. in‑memory cache instead of Redis).

### Quick Start

```bash
# 1. Install deps
yarn ci

# 2. Compile TypeScript
yarn build

# 3. Run DB migrations
yarn migration:run

# 4. Boot the API in watch‑mode
yarn start:dev

# Swagger 📑 ➜ http://localhost:3005/api
```

### Database Migrations

Create a new migration after editing entities:

```bash
yarn migration:generate -- -n add_new_table
```

Revert the last migration:

```bash
yarn migration:revert
```

---

## Production Deployment

1. **Build** the project into `dist/`:

   ```bash
   yarn build
   ```

2. **Run migrations** automatically on boot or via CI step:

   ```bash
   yarn migration:run
   ```

3. **Start** the compiled app under a process manager (PM2, systemd):

   ```bash
   NODE_ENV=production yarn start:prod
   ```

> **Tip:** Configure `LOG_LEVEL=warn` and point `ConfigModule` to production `.env`.

---

## Managing Sources & Assets

| Task             | Command                | What it does                                                                                   |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **Initial seed** | `yarn cli:source-fill` | ➜ Crawls Comptrollers & `roots.json`, inserts missing rows into **source** & **asset** tables. |
| **Sync events**  | `yarn cli:event-fill`  | ➜ Loads hard‑coded protocol events (`modules/event/constants/events.ts`).                      |

Adding a brand‑new market/network:

1. Update `config/networks.config.ts` with RPC endpoint & avgBlockTime.
2. Append an entry to `modules/source/constants/sources.ts` _or_ deploy a new Comptroller/Comet so the crawler picks it up.
3. Run `cli:source-fill`.

Assets are auto‑created via `AssetService.findOrCreate`. Manual updates can be made with SQL or a dedicated admin script.

---

## Historical Data Collection Flow

```
┌────────────────────────────┐
│ Cron (EVERY_DAY_AT_NOON)   │
└────────────┬───────────────┘
             │ (UTC)
             ▼
┌────────────────────────────┐   1. Pull all sources
│ HistoryGetCron             │───► `SourceService.listAll()`
└────────────────────────────┘
             │
             ▼ per source
┌────────────────────────────┐   2. For each midnight UTC since `creationBlock`…
│ ContractService.getHistory │───► `findBlockByTimestamp()` (binary search + cache)
└────────────────────────────┘   3. Read reserves:
             │                     • **Market v2:** `totalReserves()`
             │                     • **Comet (v3):** `getReserves()`
             │                     • **Fallback:** ERC‑20 balance / native ETH
             ▼
┌────────────────────────────┐   4. Fetch USD price (`PriceService` → CoinGecko)
│ HistoryService.create      │─┬─► Persist `history` row (block, qty, price, value)
└────────────────────────────┘ │
                               └─► Update `source.checkedAt` & `blockNumber`

Resilience features:
- **Redis block cache** (30 days) to avoid duplicate RPC calls.
- **Arbitrum period model** for pre‑nitro vs nitro timings.
- Failed price lookups default to `$1` and are logged + emailed.
```

---

## CLI Reference

| Command                      | Shortcut                               | Description                                     |
| ---------------------------- | -------------------------------------- | ----------------------------------------------- |
| `nest start --watch`         | `yarn start:dev`                       | Start API with live reload.                     |
| `nest start`                 | `yarn start`                           | Start compiled API.                             |
| `nestjs build`               | `yarn build`                           | Transpile TS ➜ JS.                              |
| `typeorm migration:run`      | `yarn migration:run`                   | Apply DB migrations.                            |
| `typeorm migration:generate` | `yarn migration:generate -- -n <name>` | Create migration diff.                          |
| **Source seed**              | `yarn cli:source-fill`                 | Insert markets into DB.                         |
| **Event seed**               | `yarn cli:event-fill`                  | Insert protocol events.                         |
| **History backfill**         | `yarn cli:history-get`                 | One‑off history sync (same code as daily cron). |

---

## License

Released under the **MIT License** — see `LICENSE` for details.
