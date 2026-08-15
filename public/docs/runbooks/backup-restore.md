# Backup and Restore Runbook

## Backup

1. Confirm no large import or migration is running.
2. Export Supabase Postgres with `supabase db dump --linked --file ebiomed-backup.sql`.
3. Export storage buckets used for work-order photos, certificates, documents, and public fault-report images.
4. Record the application commit SHA, Supabase migration version, and environment variables used by the deployment.
5. Store database, storage, and configuration artifacts in the hospital-approved encrypted backup location.

## Restore

1. Provision a clean Supabase project or maintenance database.
2. Apply migrations through the latest committed migration.
3. Restore the database dump with `psql` or Supabase restore tooling.
4. Restore storage objects to their original bucket paths.
5. Reconfigure OIDC, SMTP/email adapter, API keys, and deployment environment variables.
6. Run smoke checks for login, equipment search, work-order creation, inventory value report, and report export.

## Recovery Objectives

- Daily database backups are the minimum operating baseline.
- Storage exports should run on the same cadence as database backups.
- API keys and SSO secrets must be rotated after restoring into any non-production environment.
