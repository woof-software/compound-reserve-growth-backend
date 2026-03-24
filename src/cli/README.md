# CLI Conventions

This directory contains standalone command-line entrypoints for operational tasks that must run outside the HTTP API and outside the background indexer runtime.

## Purpose

CLI commands in this project are used for explicit, operator-triggered flows such as:

- one-off data collection
- backfills
- preload jobs
- data synchronization
- event seeding

These commands are not request-driven API flows. They are started manually through `package.json` scripts or direct Node execution of the compiled entrypoints.

## Current Structure

Each CLI group follows the same structure:

```text
src/cli/<name>/
  cli-<name>.ts
  <name>-cli.module.ts
```

Examples:

- [`history`](history)
- [`sources-update`](sources-update)
- [`event`](event)
- [`price`](price)

## Project Pattern

Each CLI command is split into three layers:

1. CLI bootstrap in `src/cli/...`
2. CLI module in `src/cli/...`
3. Command implementation in the owning feature module under `src/modules/.../cli`

### 1. CLI bootstrap

The bootstrap file:

- calls `CommandFactory.run(...)`
- selects the CLI root module
- sets logger levels
- exits with code `0` on success
- exits with code `1` on bootstrap failure

Examples:

- [`cli-history-get.ts`](history/cli-history-get.ts)
- [`cli-sources-update.ts`](sources-update/cli-sources-update.ts)
- [`cli-event-fill.ts`](event/cli-event-fill.ts)
- [`cli-price-preload.ts`](price/cli-price-preload.ts)

### 2. CLI module

The CLI module wires only the dependencies required for that command group.

Typical responsibilities:

- `ConfigModule.forRoot(...)`
- `DatabaseModule`
- importing the owning feature module

Examples:

- [`history-cli.module.ts`](history/history-cli.module.ts)
- [`sources-update-cli.module.ts`](sources-update/sources-update-cli.module.ts)
- [`event-cli.module.ts`](event/event-cli.module.ts)
- [`price-cli.module.ts`](price/price-cli.module.ts)

### 3. Command implementation

The command implementation belongs to the feature module that owns the use case.

Pattern:

- file location: `src/modules/<feature>/cli/*.command.ts`
- class extends `CommandRunner`
- class uses `@Command(...)`
- command delegates to feature services
- command does not contain database wiring or bootstrap logic

Examples:

- [`history-get.command.ts`](../modules/history/cli/history-get.command.ts)
- [`stats-get.command.ts`](../modules/history/cli/stats-get.command.ts)
- [`event-fill.command.ts`](../modules/event/cli/event-fill.command.ts)
- [`price-preload.command.ts`](../modules/price/cli/price-preload.command.ts)
- [`sources-update.command.ts`](../modules/sources-update/cli/sources-update.command.ts)

## How To Add A New CLI Command

Use the existing pattern instead of introducing a new bootstrap style.

1. Put the command class in the owning module under `src/modules/<feature>/cli`.
2. Keep business logic in services and repositories of that feature module.
3. Register the command provider in the feature module or the dedicated CLI module path already used by that feature.
4. Add or reuse a CLI module in `src/cli/<group>/...` that imports only the required runtime dependencies.
5. Add a bootstrap file in `src/cli/<group>/...` only if a new CLI group is needed.
6. Add a `package.json` script that points to the compiled CLI entrypoint.

## Rules For New CLI Commands

- Reuse existing feature services. Do not duplicate business logic in command classes.
- Keep command classes thin. They should orchestrate, not implement domain logic.
- Do not access the database directly from command classes.
- Keep dependencies minimal in the CLI module. Import only what the command needs.
- Keep logs and error messages in English.
- Return a non-zero exit code on failure.
- If the command changes database schema assumptions, add a migration separately. Do not hide schema changes inside CLI code.

## When Not To Add A CLI

Do not add a new CLI when the flow belongs to:

- the HTTP API
- the background indexer runtime
- a recurring cron job that already has a runtime owner

Use CLI only for explicit operational execution paths.
