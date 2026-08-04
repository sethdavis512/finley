# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Finley is a VoltAgent AI agent app (scaffolded from create-voltagent-app). A single `Agent` plus workflows are registered in `src/index.ts` and served over HTTP by `@voltagent/server-hono` on port 3141 (health check at `/health`).

## Commands

- `bun run dev` -- dev server with hot reload (`bun --watch`; Bun auto-loads `.env`)
- `bun start` -- run the server (`bun src/index.ts`, no build step)
- `bun run lint` / `bun run lint:fix` -- Biome
- `bun run typecheck` -- `tsc --noEmit`
- `bun scripts/railway.ts <cmd>` -- Railway ops: `setup`, `deploy`, `db`, `domain`, `vars`, `logs`, `status`, `open`

There are no tests.

## Architecture

- `src/index.ts` -- composition root: creates logger, `Memory`, the `finley` agent, and the `VoltAgent` server. Register new agents/workflows here.
- `src/tools/` -- one file per tool (see `weather.ts`), re-exported from `src/tools/index.ts`. Tools are created with `createTool` + Zod schemas.
- `src/workflows/` -- workflows built with `createWorkflowChain`. `expenseApprovalWorkflow` demonstrates suspend/resume (human-in-the-loop) with `resumeSchema`; its file header documents test payloads for the VoltOps console.
- Memory: uses `PostgreSQLMemoryAdapter` when `DATABASE_URL` is set, otherwise in-memory. No Prisma/migrations; the adapter manages its own tables.
- Model: `anthropic/claude-3-5-sonnet` via the `ai` SDK string form; requires `ANTHROPIC_API_KEY` in `.env`.

## Conventions and gotchas

- Use the `voltagent-best-practices` and `voltagent-docs-bundle` skills for VoltAgent API questions; docs are version-matched in `node_modules/@voltagent/core/docs`.
- Managed skills are pinned in `skills-lock.json`; don't hand-edit it.
- Bun is the runtime and package manager everywhere: it runs the TypeScript source directly (no bundler, no `dist/`). Deployment is a single-stage `oven/bun` Docker image targeting Railway. `bun.lock` is the lockfile.
- VoltOps observability is scaffolded but commented out in `src/index.ts` (needs `VOLTAGENT_PUBLIC_KEY`/`VOLTAGENT_SECRET_KEY`).
