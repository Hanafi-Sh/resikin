import importlib
from types import SimpleNamespace


def test_insert_report_creates_initial_status_history(monkeypatch):
    import repositories.supabase_repo as repo_module

    calls = []

    class Query:
        def __init__(self, table_name):
            self.table_name = table_name

        def insert(self, payload):
            calls.append((self.table_name, payload))
            return self

        def execute(self):
            if self.table_name == "reports":
                return SimpleNamespace(data=[{"id": "report-1", "tracking_code": "RSK-001"}])
            return SimpleNamespace(data=[{"id": "history-1"}])

    class Client:
        def table(self, table_name):
            return Query(table_name)

    monkeypatch.setattr(repo_module.settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(repo_module.settings, "SUPABASE_SERVICE_ROLE_KEY", "service-role")
    monkeypatch.setattr(repo_module, "create_client", lambda *_args: Client())

    repo = repo_module.SupabaseRepo()
    result = repo.insert_report({"description": "TPS penuh"})

    assert result == [{"id": "report-1", "tracking_code": "RSK-001"}]
    assert calls[0] == ("reports", {"description": "TPS penuh"})
    assert calls[1] == (
        "status_history",
        {
            "report_id": "report-1",
            "old_status": None,
            "new_status": "dikirim",
            "notes": "Laporan dibuat melalui bot Telegram",
        },
    )


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
