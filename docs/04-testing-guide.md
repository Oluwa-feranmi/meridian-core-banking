# Testing Guide

## Tools

| Tool | Role |
|---|---|
| **Jest** | Test runner and assertion library for all three tiers below. |
| **ts-jest** | Runs TypeScript tests directly, no separate compile step. |
| **Supertest** | Fires real HTTP requests at the Express app in-process (no network socket needed) for API tests. |
| **dotenv-cli** | Loads `.env.test` before the integration/API test scripts run, without polluting the app's normal `.env` loading. |

## The three tiers

This project deliberately separates tests into three tiers with different
speed/realism trade-offs, rather than one undifferentiated `test` folder:

### 1. Unit tests (`tests/unit/`) — no database required

Pure logic only: the fixed-point money arithmetic (`src/utils/money.ts`),
`AppError` factory methods, the account number generator, and Zod schema
validation rules. These import nothing that touches a database or reads
`DB_*` environment variables — that's an intentional architectural
constraint (see the comment at the top of `src/utils/money.ts`), not an
accident. They run in a couple of seconds with zero setup.

```bash
npm run test:unit
```

### 2. Integration tests (`tests/integration/`) — real database, no HTTP

Exercise repositories and services directly against a real PostgreSQL
database — not mocked — because the things worth testing here (the
`UNIQUE` email constraint, the `CHECK (balance >= 0)` constraint, row-level
locking via `SELECT ... FOR UPDATE` preventing lost updates on concurrent
withdrawals) are database behaviors. A mocked `pg` client would let all of
these tests pass while the real thing was broken.

### 3. API tests (`tests/api/`) — real database, real HTTP, full stack

Use Supertest to send actual HTTP requests through the whole Express app
(routing → validation middleware → auth middleware → controller → service
→ repository → database) exactly as a real client would, including
authentication (logging in for a real JWT, not minting one directly) and
role-based access control (confirming a VIEWER really gets a 403, not just
that the code path exists).

Both of these tiers require a running Postgres — see setup below.

```bash
npm run test:integration
npm run test:api
npm test              # runs all three tiers in sequence
npm run test:coverage # full coverage report across all tiers
```

## One-time setup: the test database

You do **not** need a second permanent database sitting around — this is a
disposable, throwaway database, and the same `docker-compose.yml` from
Phase 5 can provide it.

**Option A — using Docker (recommended, matches how you'll actually work):**

```bash
docker compose up -d db
docker compose exec db psql -U meridian_app -d meridian -c "CREATE DATABASE meridian_test;"
cp backend/.env.test.example backend/.env.test
cd backend
DB_NAME=meridian_test npm run migrate
```

**Option B — a local Postgres install (if you have one already):**

```bash
createdb -U meridian_app meridian_test
cp backend/.env.test.example backend/.env.test
cd backend
npm run migrate   # picks up DB_NAME=meridian_test from .env.test if you export it, or edit .env.test directly
```

Either way, `backend/.env.test` must have `DB_NAME` containing the word
`test` — `tests/setup/testDb.ts` refuses to run and throws immediately
otherwise, as a safety net against a misconfigured environment variable
pointing tests at a real database and truncating it between test runs.

You do **not** need to run `npm run seed` against the test database —
each integration/API test creates exactly the data it needs and cleans up
via `TRUNCATE` between tests (see `beforeEach` in each test file), so the
suite is deterministic regardless of what ran before it.

## What "passing" actually proves here

A few of these tests are worth calling out because they verify real
distributed-systems correctness properties, not just "the function
returned what I expected":

- **`accountsService.test.ts` → "serializes concurrent withdrawals..."**
  fires two withdrawal requests at the same account *simultaneously* via
  `Promise.allSettled`, each individually valid but not both together, and
  asserts exactly one succeeds. This is what actually proves the
  `SELECT ... FOR UPDATE` row locking in `accountsRepository` does its
  job — a version of this test running against a broken (unlocked)
  implementation would occasionally let both withdrawals through and
  silently corrupt the balance.
- **`accountsService.test.ts` → "rolls back BOTH sides of a transfer..."**
  proves the deposit and withdrawal halves of a transfer really are one
  atomic database transaction — if the source account has insufficient
  funds, neither balance moves, not "the failing side didn't move but the
  other side already did."

## CI mapping (preview of Phase 7)

`test:unit` has no external dependencies, so it can run on every commit,
in seconds, with no service containers. `test:integration` and `test:api`
need Postgres, so in CI they run against a Postgres *service container*
provided by the CI platform itself (GitHub Actions' `services:` block, for
example) — not against AWS RDS. Nothing in this project's test suite ever
talks to a real AWS resource; that's what keeps CI fast, free, and safe to
run on every pull request. Full pipeline stage breakdown is in
`docs/05-cicd-strategy.md`.
