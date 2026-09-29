# CI/CD Strategy

No pipeline files are generated in this phase — you're building the actual
GitHub Actions workflow yourself. This document explains the stages that
belong in it, why each exists, what command it runs, and — specific to
this project's cost model — why **CD (continuous deployment) is
deliberately not "continuous" here** the way it would be in a always-on
production system.

## Branching model assumed

A standard trunk-based flow: short-lived feature branches, opened as a
pull request against `main`, merged after CI passes. Nothing exotic —
GitFlow-style `develop`/`release` branches would be overkill for a
portfolio project with one deploy environment.

## Pipeline stages (on every pull request)

Run in this order specifically because each stage is cheaper than the
next — fail fast on a typo before spending CI minutes spinning up a
database.

### 1. Checkout + setup

```bash
# actions/checkout, then actions/setup-node with npm cache enabled for
# both backend/package-lock.json and frontend/package-lock.json
```
**Why first:** everything else depends on it. Caching `node_modules`
(keyed on the lockfile hash) is what keeps a CI run from re-downloading
~600 backend packages and ~fifty-some frontend packages on every push.

### 2. Install dependencies

```bash
cd backend && npm ci
cd frontend && npm ci
```
`npm ci` (not `npm install`) — it installs exactly what's in
`package-lock.json` and fails if the lockfile and `package.json` have
drifted, which is exactly the strictness you want in CI (and is faster,
since it skips dependency resolution).

### 3. Lint

```bash
cd backend && npm run lint
cd frontend && npm run lint
```
**Why it exists:** catches style/correctness issues (unused variables,
`no-explicit-any` warnings) before they reach a human reviewer. Cheap and
fast — this should fail in seconds, not minutes.

### 4. Type check

```bash
cd backend && npx tsc -p tsconfig.json --noEmit
cd frontend && npx tsc -b --noEmit
```
**Why separate from build:** a full `vite build` or `tsc` compile also
does bundling/emitting, which is slower than just checking types. Failing
fast on a type error before attempting a full build saves CI minutes on
every broken PR.

### 5. Unit tests

```bash
cd backend && npm run test:unit
```
**Why it exists, and why before integration tests:** these need no
external services (see `docs/04-testing-guide.md`), so they're the
fastest possible signal that core logic (money math, validation, error
handling) is intact. No reason to pay for a Postgres service container
just to find out a unit test is failing.

### 6. Integration + API tests (needs a database)

```yaml
# GitHub Actions service container example
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: meridian_test
      POSTGRES_USER: meridian_app
      POSTGRES_PASSWORD: ci_only_password
    ports: ["5432:5432"]
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```
```bash
cd backend
DB_HOST=localhost DB_NAME=meridian_test npm run migrate
npm run test:integration
npm run test:api
```
**Why a service container, not RDS:** this is a genuinely important cost
and security decision, not just convenience. CI should never authenticate
to real AWS infrastructure just to run a test suite — it's slower (network
round-trip to AWS vs. localhost), it costs money per CI run, and it means
every PR (including ones from a mistaken fork, if this were ever a public
repo accepting external contributions) would need real AWS credentials
sitting in CI secrets. A disposable Postgres container that dies with the
CI job has none of those problems.

### 7. Frontend build

```bash
cd frontend && npm run build
```
**Why it exists:** proves the production Vite build actually succeeds
(catches issues `tsc --noEmit` alone wouldn't, like a broken asset import)
before anyone tries to build the Docker image around it.

### 8. Dependency vulnerability scan

```bash
npm audit --audit-level=high
```
**Why it exists:** catches known-vulnerable transitive dependencies
before they ship. `--audit-level=high` avoids blocking merges on every
low-severity advisory (which would train the team to ignore the check
entirely) while still failing on things that matter.

### 9. Docker image build (on merge to `main` only, not every PR)

```bash
docker build -t meridian-backend:$(git rev-parse --short HEAD) ./backend
docker build -t meridian-frontend:$(git rev-parse --short HEAD) ./frontend
```
**Why only on merge, not every PR:** building and pushing a container
image is the most expensive CI stage in wall-clock time. Every PR needs to
prove the code is *correct* (stages 1–8); only code that's actually
landing on `main` needs an *image* built for it. This also naturally
tags every image with the commit SHA that produced it — useful for
correlating "which commit is running in this ECS task" during an
incident, straight from CloudWatch Logs.

### 10. Push to ECR (on merge to `main` only)

```bash
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker push <account>.dkr.ecr.<region>.amazonaws.com/meridian-backend:$(git rev-parse --short HEAD)
docker push <account>.dkr.ecr.<region>.amazonaws.com/meridian-frontend:$(git rev-parse --short HEAD)
```
Requires AWS credentials in CI (via OIDC federation to an IAM role scoped
*only* to ECR push — not long-lived access keys — is the modern, more
secure pattern worth using here over static secrets).

## Why deployment (step 11) is intentionally manual, not automatic

In a normal always-on production service, the next stage would be:
"automatically run `terraform apply` / `aws ecs update-service` the moment
an image lands in ECR." **This project deliberately does not do that,**
for a reason specific to your cost constraint: the infrastructure isn't
meant to run continuously. Auto-deploying on every merge to `main` would
mean either (a) infrastructure is up 24/7 waiting to receive deploys,
defeating the entire "spin up, test, tear down" cost model, or (b) the
pipeline would need to `terraform apply` (stand the whole stack up) as
part of every single deploy, which is a much heavier and slower action
than a normal rolling ECS deployment expects.

Instead, the realistic flow for this project is:

1. CI (stages 1–10) runs on every PR and merge, same as any real project
   — this is what proves the *code* is good, continuously.
2. **You** decide when you actually want to demo or test the live system,
   and manually run `terraform apply` (which you own) followed by an ECS
   service update pointing at the latest image — a deliberate, occasional
   action, not a side effect of merging code.
3. When you're done, `terraform destroy` tears it back down.

This is worth stating plainly in an interview: "CI runs continuously and
would gate an automatic deploy in a persistent system; here, deployment is
a manual, deliberate step because the infrastructure's lifecycle is
intentionally short-lived, not because the pipeline is incomplete."
