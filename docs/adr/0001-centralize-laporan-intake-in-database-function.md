# Centralize Laporan Intake in a database function

Laporan Intake is shared by the web app and Telegram bot, and both channels must create the same kind of stored report: status `dikirim`, one database-generated Kode Tracking, initial status history, and any initial Foto Laporan. We will centralize this creation path in a Supabase database function instead of duplicating the lifecycle across Next.js route handlers and the Python bot repository, because the database is the shared seam both channels already depend on.

## Considered Options

- Keep Laporan Intake in each caller: simpler per caller, but keeps tracking code generation and initial status history duplicated.
- Move Laporan Intake to a shared application package: cleaner application code, but harder to share between the JavaScript web app and Python Telegram bot.
- Use a database function: concentrates the invariant at the shared persistence seam and gives both channels one Interface for creating a Laporan Terkirim.

## Consequences

The web app and Telegram bot should stop generating Kode Tracking or inserting initial status history directly. Future changes to Laporan Intake should start at the database function, then adapt callers to its returned shape.
