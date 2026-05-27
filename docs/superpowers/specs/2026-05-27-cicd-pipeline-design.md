# CI/CD Pipeline Design

## Context

eBiomed has a partially configured CI/CD pipeline with two separate GitHub Actions workflows (`deploy.yml` for main, `production-deploy.yml` for production) that build and push Docker images to GHCR. It lacks validation steps (linting, type checking, testing, security audit) and a healthcheck endpoint. A reference app with a mature pipeline (validate → publish → Coolify deploy) exists as the target pattern.

## Goal

Align eBiomed's CI/CD pipeline with the reference pipeline: single `ci.yml` workflow with sequenced `validate` and `publish` jobs, per-branch image tags, Docker healthcheck, separate dev/prod env vars, and test infrastructure.

## Architecture

```
git push (main or production) + PRs to main/production
       │
       ▼
ci.yml ─── validate job (runs on every push + PR)
       │    lint → tsc --noEmit → vitest + coverage → npm audit → next build
       │
       └── publish job (only if validate passes AND push to main/production)
            │
            ├─ docker buildx → push to ghcr.io
            │    main       → :main + :sha-<short>
            │    production → :latest + :prod-<short>
            │
            └─ Coolify webhook (production branch only)
                 ▼
           Coolify watches tag → redeploys container
```

## Branch → Environment Mapping

| GitHub Branch | Environment | Image Tags                    | Supabase Env Vars |
|---------------|-------------|-------------------------------|--------------------|
| `main`        | dev         | `:main`, `:sha-<short>`       | `DEV_*` secrets    |
| `production`  | prod        | `:latest`, `:prod-<short>`    | `PROD_*` secrets   |

PRs run only the validate job — no image is pushed.

## Changes (6 workstreams)

### 1. Merge into single `ci.yml`

Replace `.github/workflows/deploy.yml` and `.github/workflows/production-deploy.yml` with a single `.github/workflows/ci.yml`.

**validate job:**
- Triggers: `push` to `main`/`production`, `pull_request` to `main`/`production`
- Steps: checkout → setup node 20 → npm ci → `npm run lint` → `npx tsc --noEmit` → `npm run test -- --run --coverage` → `npm audit --audit-level=high --omit=dev` → `npm run build`

**publish job:**
- Needs: `validate`
- If: `github.event_name == 'push'` (never on PRs)
- Steps: checkout → docker metadata (branch-dependent tags) → docker buildx → push → Coolify webhook (production only)
- Build args: `NEXT_PUBLIC_*` from secrets, mapped by branch (main gets `DEV_*`, production gets `PROD_*`)

### 2. Test infrastructure (vitest)

Add to `package.json`:
```json
"test": "vitest",
"test:coverage": "vitest --run --coverage"
```

Add devDependencies: `vitest`, `@vitejs/plugin-react`, `@vitest/coverage-v8`

Create `vitest.config.ts` with React plugin and coverage config.

Initial tests:
- `src/app/api/health/__tests__/route.test.ts` — verifies health endpoint returns 200
- `src/lib/utils/__tests__/cn.test.ts` — verifies `cn()` utility

### 3. Enable type checking in CI

The `next.config.ts` currently has `typescript.ignoreBuildErrors: true` to avoid build failures during development. This stays as-is for local dev, but CI runs `npx tsc --noEmit` as a separate step which enforces strict type checking regardless.

### 4. Docker healthcheck

Add to Dockerfile runner stage:
```dockerfile
RUN apk add --no-cache wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
```

Uses `127.0.0.1` explicitly (not `localhost`) — Alpine busybox wget defaults to IPv6 which Next.js doesn't bind.

### 5. Health endpoint

New file: `src/app/api/health/route.ts`
```typescript
export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() })
}
```

No auth — this is a probe endpoint accessible to Docker healthcheck and Coolify/Traefik.

### 6. Separate dev/prod env vars

New GitHub Secret naming:
| Secret | Used By |
|--------|---------|
| `DEV_NEXT_PUBLIC_SUPABASE_URL` | main branch builds |
| `DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY` | main branch builds |
| `DEV_NEXT_PUBLIC_SITE_URL` | main branch builds |
| `PROD_NEXT_PUBLIC_SUPABASE_URL` | production branch builds |
| `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY` | production branch builds |
| `PROD_NEXT_PUBLIC_SITE_URL` | production branch builds |
| `COOLIFY_WEBHOOK_URL` | production deploy step |
| `COOLIFY_TOKEN` | production deploy step |

The CI workflow selects the right set based on `github.ref_name`.

## What stays the same

- **Next.js standalone Docker output** — `output: 'standalone'`, `CMD ["node", "server.js"]` on port 3000. This is correct for Next.js (unlike the reference Vite app which needs nginx:alpine).
- **Coolify configuration** — already set up on the server; no changes needed.
- **Supabase migrations** — remain manual (`supabase db push` or `psql`). CI does not manage database schema.
- **Branch strategy** — `main` for dev work, `production` merges from main for deploys.
- **Docker multi-stage build** — base → deps → builder → runner (node:20-alpine).
- **PR behavior** — images are built but not pushed (existing behavior preserved).

## GitHub Secrets to set up

After merging this change, add all `DEV_*` and `PROD_*` secrets in repo Settings → Secrets and variables → Actions. The old `NEXT_PUBLIC_*` secrets (without prefix) can be removed once the new workflow is active.

## Sequence of work

1. Add health endpoint (`src/app/api/health/route.ts`)
2. Add vitest + initial tests + vitest config
3. Update Dockerfile (healthcheck + wget)
4. Write the new `ci.yml`
5. Remove old workflow files
6. Set up GitHub secrets (`DEV_*`, `PROD_*`)
7. Push and verify
