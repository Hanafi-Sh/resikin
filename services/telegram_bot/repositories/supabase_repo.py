from supabase import create_client
from app.config import settings


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
