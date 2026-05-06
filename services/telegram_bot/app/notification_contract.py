REPORT_CREATED = "report.created"
REPORT_ASSIGNED = "report.assigned"
REPORT_STATUS_CHANGED = "report.status_changed"

LEGACY_EVENT_ALIASES = {
    "created": REPORT_CREATED,
    "assigned": REPORT_ASSIGNED,
    "status_changed": REPORT_STATUS_CHANGED,
}

REQUIRED_FIELDS = {
    REPORT_CREATED: ("report_id",),
    REPORT_ASSIGNED: ("report_id", "petugas_id"),
    REPORT_STATUS_CHANGED: ("report_id", "old_status", "new_status"),
}


def normalize_report_notification_event(event: str) -> str:
    return LEGACY_EVENT_ALIASES.get(event, event)


def validate_report_notification_payload(payload: dict) -> dict:
    event = normalize_report_notification_event((payload or {}).get("event"))
    required_fields = REQUIRED_FIELDS.get(event)
    if not required_fields:
        raise ValueError(f"Unsupported report notification event: {(payload or {}).get('event')}")

    missing = [field for field in required_fields if not (payload or {}).get(field)]
    if missing:
        raise ValueError(f"Missing report notification fields: {', '.join(missing)}")

    return {**payload, "event": event}
