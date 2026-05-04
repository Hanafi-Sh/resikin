from supabase import create_client
from app.config import settings
from typing import Optional, Dict, List
from datetime import datetime, timezone


class SupabaseRepo:
    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("Supabase configuration is missing")
        self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    def insert_report(self, report: dict):
        """Insert a report dict into the `reports` table and create status history."""
        res = self.client.table("reports").insert(report).execute()
        # return the inserted row(s) if available
        try:
            inserted_data = res.data
            if inserted_data and len(inserted_data) > 0:
                report_id = inserted_data[0].get("id")
                # Insert initial status history
                self.client.table("status_history").insert({
                    "report_id": report_id,
                    "old_status": None,
                    "new_status": "dikirim",
                    "notes": "Laporan dibuat melalui bot Telegram"
                }).execute()
            return inserted_data
        except Exception as e:
            print("Error inserting status history:", e)
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

    def update_reporter(self, reporter_id: str, updates: dict) -> None:
        self.client.table("reporters").update(updates).eq("id", reporter_id).execute()

    def create_reporter(self, reporter: dict) -> Optional[Dict]:
        """Insert a new reporter into the `reporters` table.
        Returns the inserted reporter dict.
        """
        res = self.client.table("reporters").insert(reporter).execute()
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return data if isinstance(data, dict) else None

    def create_link_token(self, token: dict) -> Optional[Dict]:
        """Insert a new link token into `telegram_link_tokens`."""
        res = self.client.table("telegram_link_tokens").insert(token).execute()
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return data if isinstance(data, dict) else None

    def get_link_token(self, token_hash: str) -> Optional[Dict]:
        """Fetch a valid (unused, unexpired) link token by hash."""
        now_iso = datetime.now(timezone.utc).isoformat()
        res = (
            self.client.table("telegram_link_tokens")
            .select("*")
            .eq("token_hash", token_hash)
            .is_("used_at", "null")
            .gt("expires_at", now_iso)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return None

    def mark_link_token_used(self, token_id: str) -> None:
        """Mark a link token as used."""
        now_iso = datetime.now(timezone.utc).isoformat()
        self.client.table("telegram_link_tokens").update({"used_at": now_iso}).eq("id", token_id).execute()

    def upsert_telegram_link(self, link: dict) -> Optional[Dict]:
        """Upsert a telegram link by user_id and role."""
        res = (
            self.client.table("telegram_links")
            .upsert(link, on_conflict="user_id,role")
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return data if isinstance(data, dict) else None

    def get_telegram_links_by_kelurahan(self, kelurahan_id: str, role: str) -> List[Dict]:
        res = (
            self.client.table("telegram_links")
            .select("*")
            .eq("role", role)
            .eq("kelurahan_id", kelurahan_id)
            .eq("is_active", True)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        return data if isinstance(data, list) else []

    def get_telegram_links_by_sector(self, sector_id: str, role: str) -> List[Dict]:
        res = (
            self.client.table("telegram_links")
            .select("*")
            .eq("role", role)
            .eq("sector_id", sector_id)
            .eq("is_active", True)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        return data if isinstance(data, list) else []

    def get_sector_for_kelurahan(self, kelurahan_id: str) -> Optional[str]:
        res = (
            self.client.table("sector_kelurahan")
            .select("sector_id")
            .eq("kelurahan_id", kelurahan_id)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0].get("sector_id")
        return None

    def get_report_by_id(self, report_id: str) -> Optional[Dict]:
        try:
            res = (
                self.client.table("reports")
                .select("*")
                .eq("id", report_id)
                .single()
                .execute()
            )
            data = res.data if hasattr(res, "data") else res
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def get_reporter_by_id(self, reporter_id: str) -> Optional[Dict]:
        """Find a reporter by their internal reporter UUID."""
        if not reporter_id:
            return None
        res = (
            self.client.table("reporters")
            .select("*")
            .eq("id", reporter_id)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return None

    def get_telegram_link_by_user_id(self, user_id: str, role: str) -> Optional[Dict]:
        """Find a telegram link by user_id and role."""
        res = (
            self.client.table("telegram_links")
            .select("*")
            .eq("user_id", user_id)
            .eq("role", role)
            .eq("is_active", True)
            .execute()
        )
        data = res.data if hasattr(res, "data") else res
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]
        return None
