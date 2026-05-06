# Report Notification Contract

This contract defines the payload sent by the ResikIn web app to the Telegram bot service at `POST /notifications/report`.

## Transport

- Method: `POST`
- Content type: `application/json`
- Auth header: `x-resikin-secret`
- Receiver: Telegram bot FastAPI service
- Sender: Next.js web app

The sender emits a Notifikasi Laporan only after the database mutation succeeds. The receiver may return `sent: 0` when no Telegram recipient is linked; that is not a sender failure.

## Canonical Events

### `report.created`

Sent after Laporan Intake creates a Laporan Terkirim.

Required payload:

```json
{
  "event": "report.created",
  "report_id": "uuid"
}
```

Recipient: linked koordinator for the report's Kelurahan Laporan.

### `report.assigned`

Sent after Alur Penanganan Laporan assigns a report to a petugas.

Required payload:

```json
{
  "event": "report.assigned",
  "report_id": "uuid",
  "petugas_id": "uuid"
}
```

Recipient: linked assigned petugas.

### `report.status_changed`

Sent after Alur Penanganan Laporan changes a public-facing report status.

Required payload:

```json
{
  "event": "report.status_changed",
  "report_id": "uuid",
  "old_status": "dikirim",
  "new_status": "diterima"
}
```

Recipient: Telegram Pelapor, when the report has a Telegram identity.

## Legacy Event Aliases

The bot may continue accepting old event names during migration:

| Legacy | Canonical |
| ------ | --------- |
| `created` | `report.created` |
| `assigned` | `report.assigned` |
| `status_changed` | `report.status_changed` |

New sender code should emit only canonical event names.

## Error Expectations

- Missing required fields: `400`
- Bad shared secret: `401`
- Unknown report: `404`
- Unsupported event: `400`
- Recipient not linked: `200` with `sent: 0` and a `reason`
