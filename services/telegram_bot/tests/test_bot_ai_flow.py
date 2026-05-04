from types import SimpleNamespace

import pytest

from tests.conftest import DummyRepo, FakeMessage, FakeState


@pytest.mark.asyncio
async def test_call_deepseek_appends_assistant_reply(bot_module, monkeypatch):
    bot_module.chat_history[1] = [{"role": "user", "content": "halo"}]

    class Completion:
        async def create(self, **kwargs):
            assert kwargs["model"] == "deepseek-v4-flash"
            assert kwargs["messages"] == bot_module.chat_history[1]
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="Baik, saya bantu."))]
            )

    monkeypatch.setattr(
        bot_module,
        "deepseek_client",
        SimpleNamespace(chat=SimpleNamespace(completions=Completion())),
    )

    reply = await bot_module.call_deepseek(1)

    assert reply == "Baik, saya bantu."
    assert bot_module.chat_history[1][-1] == {"role": "assistant", "content": "Baik, saya bantu."}


@pytest.mark.asyncio
async def test_call_deepseek_raises_after_three_failures(bot_module, monkeypatch):
    bot_module.chat_history[1] = [{"role": "user", "content": "halo"}]
    attempts = 0

    class Completion:
        async def create(self, **kwargs):
            nonlocal attempts
            attempts += 1
            raise RuntimeError("down")

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(
        bot_module,
        "deepseek_client",
        SimpleNamespace(chat=SimpleNamespace(completions=Completion())),
    )
    monkeypatch.setattr(bot_module.asyncio, "sleep", no_sleep)

    with pytest.raises(bot_module.DeepSeekTimeoutError):
        await bot_module.call_deepseek(1)

    assert attempts == 3


@pytest.mark.asyncio
async def test_process_llm_response_without_json_sends_location_keyboard(bot_module):
    message = FakeMessage()
    state = FakeState()

    await bot_module.process_llm_response(1, message, "Boleh ceritakan masalah sampahnya?", state)

    assert message.answers[0]["text"] == "Boleh ceritakan masalah sampahnya?"
    assert message.answers[0]["reply_markup"].keyboard[0][0].request_location is True


@pytest.mark.asyncio
async def test_process_llm_response_complete_json_waits_for_missing_location_and_photo(bot_module, monkeypatch):
    message = FakeMessage(user_id=1)
    state = FakeState()
    called = {"saved": False}

    async def fake_save_report_from_state(user_id, msg):
        called["saved"] = True

    monkeypatch.setattr(bot_module, "save_report_from_state", fake_save_report_from_state)
    reply = """Siap, laporannya saya simpan.
```json
{
  "status": "complete",
  "data": {
    "reporter_name": "Budi",
    "kelurahan_id": "kotabaru",
    "description": "TPS penuh sekali",
    "suggested_category": "tps_penuh"
  }
}
```"""

    await bot_module.process_llm_response(1, message, reply, state)

    assert message.answers[0]["text"] == "Siap, laporannya saya simpan."
    assert called["saved"] is False
    assert bot_module.user_state[1]["reporter_name"] == "Budi"
    assert bot_module.user_state[1]["category"] == "tps_penuh"
    assert bot_module.user_state[1]["missing_fields"] == ["location", "photo"]
    assert "Lokasi GPS wajib" in message.answers[1]["text"]


@pytest.mark.asyncio
async def test_process_llm_response_complete_json_saves_after_validator_passes(bot_module, monkeypatch):
    message = FakeMessage(user_id=1)
    state = FakeState()
    called = {}
    bot_module.user_state[1] = {
        **bot_module._default_user_state(),
        "latitude": -7.8,
        "longitude": 110.4,
        "photo_declined": True,
    }

    async def fake_save_report_from_state(user_id, msg):
        called["user_id"] = user_id
        called["message"] = msg

    monkeypatch.setattr(bot_module, "save_report_from_state", fake_save_report_from_state)
    reply = """Siap, laporannya saya simpan.
```json
{
  "status": "complete",
  "data": {
    "reporter_name": "Budi",
    "kelurahan_id": "kotabaru",
    "description": "TPS penuh dekat pasar",
    "suggested_category": "invalid_category"
  }
}
```"""

    await bot_module.process_llm_response(1, message, reply, state)

    assert called["user_id"] == 1
    assert bot_module.user_state[1]["category"] == "lainnya"


@pytest.mark.asyncio
async def test_save_report_uses_existing_reporter_and_cleans_memory(
    bot_module, monkeypatch, immediate_to_thread
):
    repo = DummyRepo(reporter={"id": "reporter-1", "phone": "08123", "name": "Budi"})
    message = FakeMessage(user_id=99)
    bot_module.chat_history[99] = [{"role": "system", "content": "x"}]
    bot_module.user_state[99] = {
        **bot_module._default_user_state(),
        "file_ids": ["file-1"],
        "latitude": -7.8,
        "longitude": 110.4,
        "photo_received": True,
        "photo_was_asked": True,
    }
    notified = {}

    async def fake_notify(report):
        notified["report"] = report

    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    monkeypatch.setattr(bot_module, "_notify_koordinator_for_report", fake_notify)

    await bot_module.save_report(
        99,
        {
            "reporter_name": "Budi",
            "kelurahan_id": "kotabaru",
            "description": "TPS penuh dekat pasar",
            "suggested_category": "tps_penuh",
        },
        message,
    )

    inserted = repo.inserted_reports[0]
    assert inserted["user_id"] == "99"
    assert inserted["reporter_id"] == "reporter-1"
    assert inserted["reporter_phone"] == "08123"
    assert inserted["file_ids"] == ["file-1"]
    assert inserted["latitude"] == -7.8
    assert inserted["longitude"] == 110.4
    assert inserted["status"] == "dikirim"
    assert "RSK-001" in message.answers[-1]["text"]
    assert notified["report"]["tracking_code"] == "RSK-001"
    assert 99 not in bot_module.chat_history
    assert 99 not in bot_module.user_state


@pytest.mark.asyncio
async def test_save_report_creates_reporter_when_missing(bot_module, monkeypatch, immediate_to_thread):
    repo = DummyRepo(reporter=None)
    message = FakeMessage(user_id=42)
    bot_module.user_state[42] = {
        **bot_module._default_user_state(),
        "latitude": -7.8,
        "longitude": 110.4,
        "kelurahan_detected": "Kotabaru",
        "photo_declined": True,
        "photo_was_asked": True,
    }
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)

    async def fake_notify(_report):
        return None

    monkeypatch.setattr(bot_module, "_notify_koordinator_for_report", fake_notify)

    await bot_module.save_report(
        42,
        {
            "reporter_name": "Sari",
            "kelurahan_id": "dari_gps",
            "description": "Sampah menumpuk",
            "suggested_category": "sampah_liar",
        },
        message,
    )

    assert repo.created_reporters[0]["telegram_id"] == "42"
    assert repo.inserted_reports[0]["reporter_id"] == "reporter-new"
    assert repo.inserted_reports[0]["kelurahan_id"] == "kotabaru"


def test_validator_normalizes_kelurahan_and_category(bot_module):
    bot_module.user_state[10] = {
        **bot_module._default_user_state(),
        "reporter_name": "Budi",
        "description": "Sampah menumpuk dekat pasar",
        "category": "bad-category",
        "kelurahan_id": "dari_gps",
        "kelurahan_detected": "Kotabaru",
        "latitude": -7.8,
        "longitude": 110.4,
        "photo_declined": True,
    }

    bot_module.merge_ai_data(10, {"suggested_category": "not-real", "kelurahan_id": "dari_gps"})
    missing = bot_module.validate_report_readiness(10)

    assert missing == []
    assert bot_module.user_state[10]["category"] == "lainnya"
    assert bot_module.user_state[10]["kelurahan_id"] == "kotabaru"
