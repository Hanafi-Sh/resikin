#!/usr/bin/env python
"""Manual Supabase data check for Telegram notification routing.

This script is intentionally not named test_*.py so pytest will not collect it.
It reads the service .env through python-dotenv and uses the existing
SupabaseRepo configuration path.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))
load_dotenv(SERVICE_ROOT / ".env")

from repositories.supabase_repo import SupabaseRepo  # noqa: E402


def _mask(value: Any) -> Any:
    if not value:
        return value
    text = str(value)
    if len(text) <= 4:
        return "*" * len(text)
    return f"{text[:2]}***{text[-2:]}"


def _print_section(title: str, data: Any) -> None:
    print(f"\n## {title}")
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))


def _select_users(client: Any, limit: int, user_name: str | None) -> list[dict]:
    query = client.table("users").select("id, name, role, is_active, sector_id")
    if user_name:
        query = query.ilike("name", f"%{user_name}%")
    response = query.limit(limit).execute()
    return response.data if isinstance(response.data, list) else []


def _select_telegram_links(client: Any, limit: int, show_telegram_ids: bool) -> list[dict]:
    response = (
        client.table("telegram_links")
        .select("user_id, role, telegram_id, kelurahan_id, sector_id, is_active")
        .limit(limit)
        .execute()
    )
    links = response.data if isinstance(response.data, list) else []
    if show_telegram_ids:
        return links
    return [{**link, "telegram_id": _mask(link.get("telegram_id"))} for link in links]


def _select_sector_mapping(client: Any, limit: int) -> list[dict]:
    response = (
        client.table("sector_kelurahan")
        .select("sector_id, kelurahan_id")
        .limit(limit)
        .execute()
    )
    return response.data if isinstance(response.data, list) else []


def _select_recent_reports(client: Any, limit: int) -> list[dict]:
    response = (
        client.table("reports")
        .select("id, tracking_code, kelurahan_id, status, assigned_to, created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return response.data if isinstance(response.data, list) else []


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check Supabase data used by Telegram notification routing."
    )
    parser.add_argument("--limit", type=int, default=5, help="Rows per section.")
    parser.add_argument(
        "--user-name",
        help="Filter users by name, for example: --user-name 'petugas krasak'.",
    )
    parser.add_argument(
        "--show-telegram-ids",
        action="store_true",
        help="Show full Telegram IDs instead of masked values.",
    )
    args = parser.parse_args()

    repo = SupabaseRepo()
    client = repo.client

    _print_section("Users", _select_users(client, args.limit, args.user_name))
    _print_section(
        "Telegram Links",
        _select_telegram_links(client, args.limit, args.show_telegram_ids),
    )
    _print_section("Sector Kelurahan Mapping", _select_sector_mapping(client, args.limit))
    _print_section("Recent Reports", _select_recent_reports(client, args.limit))


if __name__ == "__main__":
    main()
