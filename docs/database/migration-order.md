# Database Migration Order

Run Supabase migrations manually in this canonical order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_telegram_bot_support.sql`
3. `supabase/migrations/003_multi_photo_support.sql`
4. `supabase/migrations/004_reporters_and_categories.sql`
5. `supabase/migrations/003_telegram_linking_and_sectors.sql`
6. `supabase/migrations/005_create_report_intake_function.sql`
7. `supabase/migrations/006_create_report_workflow_function.sql`
8. `supabase/migrations/007_fix_report_workflow_ambiguous_columns.sql`

There are two historical `003_*` files. Do not rename them after they may have been run manually in existing Supabase projects; use this document as the source of truth for ordering.

Migration `007_fix_report_workflow_ambiguous_columns.sql` replaces `apply_report_workflow` with qualified table column references. Run it on existing databases that already ran migration 006 to fix `column reference "report_id" is ambiguous` during petugas status updates.

## Rules For New Migrations

- Append only; do not rewrite or rename existing migration files.
- Use the next numeric prefix, currently `008_*`.
- Prefer idempotent DDL where practical, especially for functions and indexes.
- Document any new required migration in this file and in the setup section of `README.md`.
