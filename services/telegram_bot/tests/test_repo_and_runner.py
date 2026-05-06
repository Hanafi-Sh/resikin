import importlib
from types import SimpleNamespace


def test_insert_report_uses_report_intake_function(monkeypatch):
    import repositories.supabase_repo as repo_module

    calls = {}

    class Client:
        def rpc(self, function_name, payload):
            calls["function_name"] = function_name
            calls["payload"] = payload
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": "report-1", "tracking_code": "RSK-001"}])

    monkeypatch.setattr(repo_module.settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(repo_module.settings, "SUPABASE_SERVICE_ROLE_KEY", "service-role")
    monkeypatch.setattr(repo_module, "create_client", lambda *_args: Client())

    repo = repo_module.SupabaseRepo()
    result = repo.insert_report({
        "reporter_name": "Budi",
        "reporter_phone": "08123456789",
        "user_id": "123",
        "category": "tps_penuh",
        "description": "TPS penuh sekali",
        "latitude": -7.1,
        "longitude": 110.1,
        "kelurahan_id": "terban",
        "file_ids": ["tg-file-1"],
        "source": "telegram",
        "metadata": {"channel": "telegram"},
    })

    assert result == [{"id": "report-1", "tracking_code": "RSK-001"}]
    assert calls["function_name"] == "create_report_intake"
    assert calls["payload"] == {
        "p_reporter_name": "Budi",
        "p_reporter_phone": "08123456789",
        "p_reporter_id": None,
        "p_user_id": "123",
        "p_category": "tps_penuh",
        "p_description": "TPS penuh sekali",
        "p_latitude": -7.1,
        "p_longitude": 110.1,
        "p_address": None,
        "p_kelurahan_id": "terban",
        "p_file_ids": ["tg-file-1"],
        "p_photo_urls": [],
        "p_source": "telegram",
        "p_metadata": {"channel": "telegram"},
        "p_status_history_notes": "Laporan dibuat melalui bot Telegram",
    }


def test_run_fastapi_invokes_uvicorn(monkeypatch):
    run_bot = importlib.import_module("run_bot")
    calls = {}

    def fake_run(app, **kwargs):
        calls["app"] = app
        calls["kwargs"] = kwargs

    monkeypatch.setattr("uvicorn.run", fake_run)

    run_bot.run_fastapi()

    assert calls["kwargs"]["host"] == "0.0.0.0"
    assert calls["kwargs"]["port"] == 8000
    assert calls["kwargs"]["log_level"] == "info"


async def test_run_longpoll_starts_polling(monkeypatch):
    run_bot = importlib.import_module("run_bot")
    calls = {}

    class Bot:
        async def get_me(self):
            return SimpleNamespace(username="resikin_test", full_name="ResikIn Test")

    class Dispatcher:
        async def start_polling(self, bot, **kwargs):
            calls["bot"] = bot
            calls["kwargs"] = kwargs

    bot = Bot()
    monkeypatch.setattr("app.bot.get_bot", lambda: bot)
    monkeypatch.setattr("app.bot.dp", Dispatcher())

    await run_bot.run_longpoll()

    assert calls["bot"] is bot
    assert calls["kwargs"] == {"skip_updates": True}
