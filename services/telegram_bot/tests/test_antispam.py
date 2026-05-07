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


def make_photo_message(user_id=1, media_group_id="album-1"):
    return Message.model_validate(
        {
            "message_id": 1,
            "date": 0,
            "chat": {"id": user_id, "type": "private"},
            "from": {"id": user_id, "is_bot": False, "first_name": "Test"},
            "media_group_id": media_group_id,
            "photo": [
                {
                    "file_id": "file-1",
                    "file_unique_id": "unique-1",
                    "width": 100,
                    "height": 100,
                }
            ],
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
async def test_antispam_allows_album_photos_inside_cooldown(bot_module):
    middleware = bot_module.AntiSpamMiddleware()
    event = make_photo_message()
    calls = 0

    async def handler(_event, _data):
        nonlocal calls
        calls += 1
        return "ok"

    await middleware(handler, event, {"state": FakeState()})
    await middleware(handler, event, {"state": FakeState()})

    assert calls == 2


@pytest.mark.asyncio
async def test_antispam_allows_start_and_report_button_inside_cooldown(bot_module):
    middleware = bot_module.AntiSpamMiddleware()
    start_event = make_message("/start")
    report_event = make_message(bot_module.MAIN_MENU_REPORT_TEXT)
    calls = []

    async def handler(event, _data):
        calls.append(event.text)
        return "ok"

    await middleware(handler, start_event, {"state": FakeState()})
    await middleware(handler, report_event, {"state": FakeState()})

    assert calls == ["/start", bot_module.MAIN_MENU_REPORT_TEXT]


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
async def test_antispam_allows_message_when_outside_fsm(bot_module):
    middleware = bot_module.AntiSpamMiddleware()
    event = make_message("deskripsi laporan")
    calls = 0

    async def handler(_event, _data):
        nonlocal calls
        calls += 1

    await middleware(handler, event, {"state": FakeState()})

    assert calls == 1
