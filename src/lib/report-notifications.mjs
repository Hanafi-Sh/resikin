export const REPORT_NOTIFICATION_EVENTS = Object.freeze({
  CREATED: 'report.created',
  ASSIGNED: 'report.assigned',
  STATUS_CHANGED: 'report.status_changed',
});

const LEGACY_EVENT_ALIASES = Object.freeze({
  created: REPORT_NOTIFICATION_EVENTS.CREATED,
  assigned: REPORT_NOTIFICATION_EVENTS.ASSIGNED,
  status_changed: REPORT_NOTIFICATION_EVENTS.STATUS_CHANGED,
});

const REQUIRED_FIELDS = Object.freeze({
  [REPORT_NOTIFICATION_EVENTS.CREATED]: ['report_id'],
  [REPORT_NOTIFICATION_EVENTS.ASSIGNED]: ['report_id', 'petugas_id'],
  [REPORT_NOTIFICATION_EVENTS.STATUS_CHANGED]: ['report_id', 'old_status', 'new_status'],
});

export function normalizeReportNotificationEvent(event) {
  return LEGACY_EVENT_ALIASES[event] || event;
}

export function buildReportNotificationPayload(event, fields = {}) {
  const canonicalEvent = normalizeReportNotificationEvent(event);
  const payload = { event: canonicalEvent, ...fields };
  validateReportNotificationPayload(payload);
  return payload;
}

export function validateReportNotificationPayload(payload) {
  const event = normalizeReportNotificationEvent(payload?.event);
  const requiredFields = REQUIRED_FIELDS[event];

  if (!requiredFields) {
    throw new Error(`Unsupported report notification event: ${payload?.event || ''}`);
  }

  const missing = requiredFields.filter((field) => !payload?.[field]);
  if (missing.length > 0) {
    throw new Error(`Missing report notification fields: ${missing.join(', ')}`);
  }

  return { ...payload, event };
}
