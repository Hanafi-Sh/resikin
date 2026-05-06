# Centralize Alur Penanganan Laporan mutations in a database function

Alur Penanganan Laporan changes a stored report's operational state and may also create assignments, status history, completion photos, and notification events. We will centralize the database mutation part of this workflow in a Supabase database function so status transitions, assignment creation, terminal statuses, and status history stay atomic at the shared persistence seam used by the web app and Telegram-facing flows.

## Considered Options

- Keep workflow mutations in Next.js route handlers: simpler to call, but status changes, assignments, and status history can drift or partially succeed.
- Move workflow mutations to an application module only: improves code locality in JavaScript, but does not protect shared database invariants as strongly.
- Use a database function for mutation and keep external notifications in the route handler: concentrates database invariants while keeping Telegram notification side effects outside the transaction.

## Consequences

Callers should perform explicit workflow actions such as accept, assign, start work, complete work, or reject instead of directly setting arbitrary statuses. External notifications should be sent only after the database function succeeds.
