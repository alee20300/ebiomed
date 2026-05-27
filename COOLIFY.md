# Coolify Deployment Guide

## Production Supabase (NovelTech)

**Instance URL:** `http://supabasekong-xebsia6795nd6fpm7kcqlege.72.62.121.172.sslip.io`
**Admin:** admin@ebiomed.local / password123

### Apply Migrations to Production

```bash
# Set production database URL
export DB_URL="postgresql://postgres:SUgXRawpWfMwqDkA1BEiw0ckaDwo8J57@72.62.121.172:5432/postgres"

# Apply migrations in order
psql $DB_URL < supabase/migrations/0001_initial_schema.sql
psql $DB_URL < supabase/migrations/0002_parts_trigger.sql
psql $DB_URL < supabase/migrations/0003_fault_report_columns.sql
psql $DB_URL < supabase/migrations/0004_wo_comments.sql
psql $DB_URL < supabase/migrations/0005_rls_policies.sql
psql $DB_URL < supabase/migrations/0006_departments.sql
psql $DB_URL < supabase/migrations/0006_end_user_checklists.sql

# Seed data (optional)
psql $DB_URL < supabase/seed.sql
```

## GitHub Secrets

Set in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `DEV_NEXT_PUBLIC_SUPABASE_URL` | `http://supabasekong-xebsia6795nd6fpm7kcqlege.72.62.121.172.sslip.io` |
| `DEV_NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` |
| `PROD_NEXT_PUBLIC_SUPABASE_URL` | `http://supabasekong-xebsia6795nd6fpm7kcqlege.72.62.121.172.sslip.io` |
| `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` |
| `DEV_NEXT_PUBLIC_SITE_URL` | Your dev domain |
| `PROD_NEXT_PUBLIC_SITE_URL` | Your production domain |
| `COOLIFY_WEBHOOK_URL` | From Coolify dashboard |
| `COOLIFY_TOKEN` | From Coolify settings |

## Deploy to Coolify

### Option 1: Auto-deploy via Webhook (Recommended)

1. In Coolify, create a new resource from **GitHub Source**
2. Select `alee20300/ebiomed` → `production` branch
3. Build method: **Dockerfile**
4. Port: `3000`
5. Copy the **Webhook URL** from Coolify
6. Add it as `COOLIFY_WEBHOOK_URL` in GitHub secrets
7. Push to `production` branch → auto-deploys

### Option 2: Manual Deploy

1. Build image locally:
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=<url> \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<key> \
  --build-arg NEXT_PUBLIC_SITE_URL=<domain> \
  -t ebiomed:latest .
```

2. Push to registry or deploy directly in Coolify dashboard

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Development, CI builds only |
| `production` | Production deployments, triggers Coolify auto-deploy |

### Deploy to Production

```bash
git checkout production
git merge main
git push origin production
```

## Environment Variables in Coolify

Add these in Coolify dashboard for the resource:

```
NEXT_PUBLIC_SUPABASE_URL=http://supabasekong-xebsia6795nd6fpm7kcqlege.72.62.121.172.sslip.io
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3OTg4MDM4MCwiZXhwIjo0OTM1NTUzOTgwLCJyb2xlIjoiYW5vbiJ9.bwapNU7LxmZE5WY6IsMxn-2VxbQeRSPgzGUqdxeQidM
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```
