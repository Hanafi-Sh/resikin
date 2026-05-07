import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REPORT_NOTIFICATION_EVENTS,
  buildReportNotificationPayload,
  normalizeReportNotificationEvent,
  validateReportNotificationPayload,
} from '../src/lib/report-notifications.mjs';

test('normalizes legacy report notification events', () => {
  assert.equal(normalizeReportNotificationEvent('created'), REPORT_NOTIFICATION_EVENTS.CREATED);
  assert.equal(normalizeReportNotificationEvent('assigned'), REPORT_NOTIFICATION_EVENTS.ASSIGNED);
  assert.equal(normalizeReportNotificationEvent('status_changed'), REPORT_NOTIFICATION_EVENTS.STATUS_CHANGED);
});

test('builds a canonical assigned payload', () => {
  assert.deepEqual(
    buildReportNotificationPayload(REPORT_NOTIFICATION_EVENTS.ASSIGNED, {
      report_id: 'report-1',
      petugas_id: 'petugas-1',
    }),
    {
      event: REPORT_NOTIFICATION_EVENTS.ASSIGNED,
      report_id: 'report-1',
      petugas_id: 'petugas-1',
    },
  );
});

test('rejects missing required notification fields', () => {
  assert.throws(
    () => validateReportNotificationPayload({ event: REPORT_NOTIFICATION_EVENTS.STATUS_CHANGED, report_id: 'report-1' }),
    /Missing report notification fields: old_status, new_status/,
  );
});
