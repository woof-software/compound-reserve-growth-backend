# Process Infrastructure

## Purpose

This directory contains the code that starts the indexer application as a child process from the API application.

## Files

- [`background-worker.module.ts`](background-worker.module.ts)
- [`background-worker-child-process.service.ts`](background-worker-child-process.service.ts)

## Current Behavior

- The service runs during API application bootstrap
- It reads `app.indexerChildProcessEnabled`
- If the flag is enabled, it forks:

```text
dist/src/apps/indexer/main.js
```

- The child process inherits stdio
- The child process receives `INDEXER_CHILD_PROCESS_ENABLED=false`
- On API shutdown, the service sends `SIGTERM` to the child process
- If the child process fails to start or exits unexpectedly, the API process is terminated

## Scope

This layer is runtime orchestration only. It does not contain domain logic from `history`, `oracle`, or `capo`.
