#!/usr/bin/env python
"""Smoke-test the Telegram notification webhook against a real report.

Run this on the VPS from ``services/telegram_bot`` after the bot service is
deployed. It reads ``.env``, finds a recent Telegram report when ``--report-id``
is omitted, then POSTs a canonical notification payload to the FastAPI service.
The script intentionally sends a real Telegram message to the report owner.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
load_dotenv(SERVICE_ROOT / ".env")

from app.config import settings  # noqa: E402
from repositories.supabase_repo import SupabaseRepo  # noqa: E402


def _find_recent_telegram_report(client: Any) -> dict | None:
    response = (
        client.table("reports")
        .select("id, tracking_code, status, reporter_id, user_id, source, created_at")
        .eq("source", "telegram")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    reports = response.data if isinstance(response.data, list) else []
    for report in reports:
        if report.get("reporter_id") or report.get("user_id"):
            return report
    return reports[0] if reports else None


async def _post_notification(target_url: str, payload: dict) -> httpx.Response:
    headers = {
        "content-type": "application/json",
        "x-resikin-secret": settings.NOTIFY_WEBHOOK_SECRET,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        return await client.post(target_url, headers=headers, json=payload)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Send a real report.status_changed notification through the bot webhook."
    )
    parser.add_argument("--report-id", help="Report UUID. Defaults to latest Telegram report.")
    parser.add_argument(
        "--target-url",
        default=f"http://127.0.0.1:{settings.PORT}/notifications/report",
        help="Webhook URL to test. Defaults to local FastAPI service.",
    )
    parser.add_argument("--old-status", default="dikirim")
    parser.add_argument("--new-status", default="diterima")
    args = parser.parse_args()

    if not settings.NOTIFY_WEBHOOK_SECRET:
        raise SystemExit("NOTIFY_WEBHOOK_SECRET is empty in services/telegram_bot/.env")

    repo = SupabaseRepo()
    report = None
    if args.report_id:
        report = repo.get_report_by_id(args.report_id)
    else:
        report = _find_recent_telegram_report(repo.client)

    if not report:
        raise SystemExit("No report found. Pass --report-id with a known Telegram report UUID.")

    payload = {
        "event": "report.status_changed",
        "report_id": report["id"],
        "old_status": args.old_status,
        "new_status": args.new_status,
    }

    response = asyncio.run(_post_notification(args.target_url, payload))
    print(
        json.dumps(
            {
                "target_url": args.target_url,
                "report_id": report["id"],
                "tracking_code": report.get("tracking_code"),
                "http_status": response.status_code,
                "response": response.json() if response.content else None,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    response.raise_for_status()


if __name__ == "__main__":
    main()
