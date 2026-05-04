from types import SimpleNamespace

import pytest
from aiogram.types import Message

from tests.conftest import FakeState


def make_message(text="halo", user_id=1):
    return Message.model_validate(
        {
            "message_id": 1,
            "date": 0,
            "chat": {"id": user_id, "type": "private"},
            "from": {"id": user_id, "is_bot": False, "first_name": "Test"},
            "text": text,
        }
    )


@pytest.mark.asyncio
async def test_antispam_ignores_second_message_inside_cooldown(bot_module):
    middleware = bot_module.AntiSpamMiddleware()
    event = make_message()
    calls = 0

    async def handler(_event, _data):
        nonlocal calls
        calls += 1
        return "ok"

    await middleware(handler, event, {"state": FakeState()})
    result = await middleware(handler, event, {"state": FakeState()})

    assert result is None
    assert calls == 1


@pytest.mark.asyncio
async def test_antispam_rejects_too_long_message(bot_module, monkeypatch):
    middleware = bot_module.AntiSpamMiddleware()
    event = make_message("x" * 2001)
    answers = []

    async def fake_answer(self, text, **kwargs):
        answers.append(text)

    async def handler(_event, _data):
        raise AssertionError("handler should not be called")

    monkeypatch.setattr(Message, "answer", fake_answer)

    await middleware(handler, event, {"state": FakeState()})

    assert "Pesan terlalu panjang" in answers[0]


@pytest.mark.asyncio
async def test_antispam_daily_limit_forces_fallback(bot_module, monkeypatch):
    middleware = bot_module.AntiSpamMiddleware()
    middleware.max_chats_per_day = 0
    event = make_message("lapor sampah")
    state = FakeState()
    answers = []
    fallback = {}

    async def fake_answer(self, text, **kwargs):
        answers.append(text)

    async def fake_force_fallback(message, passed_state):
        fallback["message"] = message
        await passed_state.set_state("manual")

    async def handler(_event, _data):
        raise AssertionError("handler should not be called")

    monkeypatch.setattr(Message, "answer", fake_answer)
    monkeypatch.setattr(bot_module, "_force_fallback", fake_force_fallback)

    await middleware(handler, event, {"state": state})

    assert "batas obrolan AI harian" in answers[0]
    assert fallback["message"] is event
    assert state.state == "manual"


@pytest.mark.asyncio
async def test_antispam_does_not_count_when_fsm_active(bot_module):
    middleware = bot_module.AntiSpamMiddleware()
    event = make_message("deskripsi laporan")
    state = FakeState(state=bot_module.ReportStates.INPUT_DESKRIPSI.state)
    calls = 0

    async def handler(_event, _data):
        nonlocal calls
        calls += 1

    await middleware(handler, event, {"state": state})

    assert calls == 1
    assert middleware.daily_stats[1]["chats"] == 0
    assert middleware.daily_stats[1]["chars"] == 0
