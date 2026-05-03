import pytest
import httpx

from app.main import app
from app.api import notifications
import repositories.supabase_repo as supabase_repo


REPORT = {
    "id": "report-1",
    "tracking_code": "RSK-001",
    "kelurahan_id": "kotabaru",
    "category": "tps_penuh",
    "description": "TPS di dekat pasar sudah penuh",
}


class DummyRepo:
    def __init__(self):
        self.link_queries = []

    def get_report_by_id(self, report_id):
        return REPORT if report_id == REPORT["id"] else None

    def get_telegram_links_by_kelurahan(self, kelurahan_id, role):
        self.link_queries.append(("kelurahan", kelurahan_id, role))
        if kelurahan_id == "kotabaru" and role == "koordinator":
            return [
                {"telegram_id": "1001"},
                {"telegram_id": "1002"},
                {"telegram_id": ""},
            ]
        return []

    def get_telegram_link_by_user_id(self, user_id, role):
        self.link_queries.append(("user", user_id, role))
        if user_id == "petugas-1" and role == "petugas":
            return {"telegram_id": "2001"}
        return None


class DummyBot:
    def __init__(self):
        self.messages = []

    async def send_message(self, **kwargs):
        self.messages.append(kwargs)
        return {"ok": True}


@pytest.fixture
def notification_fakes(monkeypatch):
    repo = DummyRepo()
    bot = DummyBot()

    monkeypatch.setattr(supabase_repo, "SupabaseRepo", lambda: repo)
    monkeypatch.setattr(notifications, "get_bot", lambda: bot)
    monkeypatch.setattr(notifications.settings, "NOTIFY_WEBHOOK_SECRET", "")

    return repo, bot


@pytest.mark.asyncio
async def test_notify_report_created_sends_to_kelurahan_koordinators(notification_fakes):
    repo, bot = notification_fakes
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/notifications/report",
            json={"event": "created", "report_id": REPORT["id"]},
        )

    assert response.status_code == 200
    assert response.json() == {"sent": 2, "recipients": 2}
    assert repo.link_queries == [("kelurahan", "kotabaru", "koordinator")]
    assert [message["chat_id"] for message in bot.messages] == [1001, 1002]

    message = bot.messages[0]
    assert "LAPORAN BARU MASUK" in message["text"]
    assert "- Kode: RSK-001" in message["text"]
    assert "- Kelurahan: Kotabaru" in message["text"]
    assert "- Kategori: tps_penuh" in message["text"]
    assert "- Deskripsi: TPS di dekat pasar sudah penuh" in message["text"]

    button = message["reply_markup"].inline_keyboard[0][0]
    assert button.text == "Lihat & Verifikasi Laporan"
    assert button.url == "http://127.0.0.1:3000/dashboard/laporan/report-1"


@pytest.mark.asyncio
async def test_notify_report_assigned_sends_to_assigned_petugas(notification_fakes):
    repo, bot = notification_fakes
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/notifications/report",
            json={
                "event": "assigned",
                "report_id": REPORT["id"],
                "petugas_id": "petugas-1",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"sent": 1, "recipients": 1}
    assert repo.link_queries == [("user", "petugas-1", "petugas")]
    assert len(bot.messages) == 1

    message = bot.messages[0]
    assert message["chat_id"] == 2001
    assert "TUGAS BARU UNTUK ANDA" in message["text"]
    assert "- Kode: RSK-001" in message["text"]
    assert "- Kelurahan: Kotabaru" in message["text"]

    button = message["reply_markup"].inline_keyboard[0][0]
    assert button.text == "Buka Daftar Tugas"
    assert button.url == "http://127.0.0.1:3000/petugas"


@pytest.mark.asyncio
async def test_notify_report_assigned_without_link_returns_reason(notification_fakes):
    repo, bot = notification_fakes
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/notifications/report",
            json={
                "event": "assigned",
                "report_id": REPORT["id"],
                "petugas_id": "petugas-missing-link",
            },
        )

    assert response.status_code == 200
    assert response.json() == {"sent": 0, "reason": "petugas_telegram_not_linked"}
    assert repo.link_queries == [("user", "petugas-missing-link", "petugas")]
    assert bot.messages == []
