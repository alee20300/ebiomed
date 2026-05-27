# CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge two CI workflows into one `ci.yml` with validate→publish jobs, add vitest, Docker healthcheck, health endpoint, and separate dev/prod env vars.

**Architecture:** Single `ci.yml` workflow. `validate` job runs on every push and PR (lint → tsc → vitest → audit → build). `publish` job runs only on push to main/production after validate passes (docker buildx → push GHCR → Coolify webhook on production).

**Tech Stack:** GitHub Actions, Docker Buildx, Vitest, Next.js 16, Node 20 Alpine

---

### File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/app/api/health/route.ts` | Health probe endpoint |
| Create | `src/app/api/health/__tests__/route.test.ts` | Health endpoint test |
| Create | `src/lib/utils/__tests__/cn.test.ts` | cn utility test |
| Create | `vitest.config.ts` | Vitest configuration |
| Modify | `package.json` | Add test scripts + vitest devDeps |
| Modify | `Dockerfile` | Add wget + HEALTHCHECK |
| Create | `.github/workflows/ci.yml` | New unified CI workflow |
| Delete | `.github/workflows/deploy.yml` | Old workflow |
| Delete | `.github/workflows/production-deploy.yml` | Old workflow |

---

### Task 1: Install vitest and configure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest dependencies**

```bash
npm install --save-dev vitest @vitejs/plugin-react @vitest/coverage-v8
```

Expected: Packages installed and added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to package.json**

Edit `package.json` — add `"test"` and `"test:coverage"` to the `scripts` block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:coverage": "vitest --run --coverage"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/lib/types/**",
        "src/components/ui/**",
        "**/__tests__/**",
      ],
    },
  },
})
```

- [ ] **Step 4: Verify vitest works (smoke test)**

```bash
npx vitest --run
```

Expected: "No test files found" or 0 tests — confirms config is valid.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "feat: add vitest test infrastructure"
```

---

### Task 2: Create health endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create route file**

```typescript
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() })
}
```

- [ ] **Step 2: Verify locally (if Next dev server running)**

```bash
curl -s http://localhost:3000/api/health
```

Expected: `{"status":"ok","timestamp":"..."}` with 200 status.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: add health check endpoint"
```

---

### Task 3: Write health endpoint test

**Files:**
- Create: `src/app/api/health/__tests__/route.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from "vitest"
import { GET } from "../route"

describe("GET /api/health", () => {
  it("returns status ok with 200", async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveProperty("status", "ok")
    expect(body).toHaveProperty("timestamp")
    expect(() => new Date(body.timestamp as string)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest --run src/app/api/health/__tests__/route.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health/__tests__/route.test.ts
git commit -m "test: add health endpoint test"
```

---

### Task 4: Write cn utility test

**Files:**
- Create: `src/lib/utils/__tests__/cn.test.ts`

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect } from "vitest"
import { cn } from "../cn"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("removes falsy values", () => {
    expect(cn("px-2", false, undefined, null, "py-1")).toBe("px-2 py-1")
  })

  it("handles empty input", () => {
    expect(cn()).toBe("")
  })

  it("resolves tailwind conflicts (twMerge)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npx vitest --run src/lib/utils/__tests__/cn.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 3: Run full test suite with coverage**

```bash
npm run test:coverage
```

Expected: All 5 tests PASS, coverage report generated.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/__tests__/cn.test.ts
git commit -m "test: add cn utility test"
```

---

### Task 5: Add Docker HEALTHCHECK

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Add wget install + HEALTHCHECK to runner stage**

In the runner stage (after the `RUN adduser` line and before `COPY --from=builder /app/public`), insert:

```dockerfile
# Install wget for healthcheck
RUN apk add --no-cache wget
```

And at the very end of the file (after `CMD ["node", "server.js"]`), add:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
```

The full runner stage should look like:

```dockerfile
# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN apk add --no-cache wget

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
```

- [ ] **Step 2: Verify Dockerfile has no syntax errors**

```bash
docker build --dry-run . 2>&1 | head -5 || echo "Dry run not supported, skip"
```

Build a quick test if Docker is available:

```bash
docker build --no-cache --target deps . 2>&1 | tail -5
```

Expected: Build reaches deps stage without errors.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Docker HEALTHCHECK using health endpoint"
```

---

### Task 6: Write unified ci.yml

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, production]
  pull_request:
    branches: [main, production]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test with coverage
        run: npm run test:coverage

      - name: Audit dependencies
        run: npm audit --audit-level=high --omit=dev

      - name: Build
        run: npm run build

  publish:
    name: Publish
    needs: validate
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set branch-specific variables
        id: vars
        run: |
          if [ "${{ github.ref_name }}" = "production" ]; then
            echo "PREFIX=PROD" >> $GITHUB_OUTPUT
          else
            echo "PREFIX=DEV" >> $GITHUB_OUTPUT
          fi

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=,suffix=,format=short
            type=ref,event=branch

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ secrets[format('{0}_NEXT_PUBLIC_SUPABASE_URL', steps.vars.outputs.PREFIX)] }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets[format('{0}_NEXT_PUBLIC_SUPABASE_ANON_KEY', steps.vars.outputs.PREFIX)] }}
            NEXT_PUBLIC_SITE_URL=${{ secrets[format('{0}_NEXT_PUBLIC_SITE_URL', steps.vars.outputs.PREFIX)] }}

      - name: Trigger Coolify deploy (production only)
        if: github.ref_name == 'production'
        run: |
          if [ -n "${{ secrets.COOLIFY_WEBHOOK_URL }}" ]; then
            curl -X POST \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}" \
              -H "Content-Type: application/json" \
              ${{ secrets.COOLIFY_WEBHOOK_URL }}
          else
            echo "No Coolify webhook configured. Deploy manually from Coolify dashboard."
          fi
```

- [ ] **Step 2: Verify YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 || \
  npx yaml-lint .github/workflows/ci.yml 2>&1 || \
  echo "YAML validation skipped (no yaml tool available)"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: add unified CI workflow with validate and publish jobs"
```

---

### Task 7: Remove old workflow files

**Files:**
- Delete: `.github/workflows/deploy.yml`
- Delete: `.github/workflows/production-deploy.yml`

- [ ] **Step 1: Delete old workflows**

```bash
git rm .github/workflows/deploy.yml .github/workflows/production-deploy.yml
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove old separate CI workflow files"
```

---

### Task 8: GitHub Secrets setup (manual)

No file changes — this is a manual step in the GitHub UI.

- [ ] **Step 1: Go to repo Settings → Secrets and variables → Actions**

- [ ] **Step 2: Add dev secrets**

| Secret Name | Value |
|-------------|-------|
| `DEV_NEXT_PUBLIC_SUPABASE_URL` | URL of dev Supabase project |
| `DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key of dev Supabase project |
| `DEV_NEXT_PUBLIC_SITE_URL` | Dev deployment URL |

- [ ] **Step 3: Add prod secrets**

| Secret Name | Value |
|-------------|-------|
| `PROD_NEXT_PUBLIC_SUPABASE_URL` | `http://supabasekong-blt021qyd19fli8m4lx3ig03.72.62.121.172.sslip.io` |
| `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key (from COOLIFY.md) |
| `PROD_NEXT_PUBLIC_SITE_URL` | Production deployment URL |
| `COOLIFY_WEBHOOK_URL` | Coolify webhook URL |
| `COOLIFY_TOKEN` | Coolify API token |

- [ ] **Step 4: Remove old secrets (optional)**

After the new workflow runs successfully, remove the unprefixed `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` secrets.

---

### Task 9: Push and verify

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Watch CI run**

Go to GitHub Actions tab and verify:
1. `validate` job runs and passes (lint → tsc → test → audit → build)
2. `publish` job runs after validate and pushes image with `:main` and `:sha-<short>` tags

- [ ] **Step 3: Verify image in GHCR**

Check `https://github.com/alee20300/ebiomed/pkgs/container/ebiomed` — should show new tags.

- [ ] **Step 4: Deploy to production (when ready)**

```bash
git checkout production
git merge main
git push origin production
```

Verify production CI runs, pushes `:latest` tag, and Coolify webhook triggers.
