from supabase import create_client
from app.config import settings
from typing import Optional, Dict


class SupabaseRepo:
    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("Supabase configuration is missing")
        self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    def insert_report(self, report: dict):
        """Insert a report dict into the `reports` table."""
        res = self.client.table("reports").insert(report).execute()
        # return the inserted row(s) if available
        try:
            return res.data
        except Exception:
            return res

    def find_reporter_by_telegram_id(self, telegram_id: str) -> Optional[Dict]:
        """Find a reporter by their Telegram user ID.
        Returns the reporter dict if found, None otherwise.
        """
        res = (
            self.client.table("reporters")
            .select("*")
            .eq("telegram_id", telegram_id)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return None

    def create_reporter(self, reporter: dict) -> Optional[Dict]:
        """Insert a new reporter into the `reporters` table.
        Returns the inserted reporter dict.
        """
        res = self.client.table("reporters").insert(reporter).execute()
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return data if isinstance(data, dict) else None
