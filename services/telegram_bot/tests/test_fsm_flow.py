import pytest
import importlib
import os
from types import SimpleNamespace
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Update
from aiogram.fsm.storage.base import StorageKey

from tests.conftest import FakeCallback, FakeMessage, FakeState


class DummyBot(Bot):
    async def __call__(self, *args, **kwargs):
        return True

class DummyRepo:
    def find_reporter_by_telegram_id(self, tid):
        return {"id": "123", "phone": "08123456789"}
    def insert_report(self, data):
        data["id"] = "test-id"
        data["tracking_code"] = "TEST-123"
        return [data]
    def get_telegram_links_by_kelurahan(self, kel_id, role):
        return []


def _base_user():
    return {"id": 1, "is_bot": False, "first_name": "Test"}


def _base_chat():
    return {"id": 1, "type": "private"}


async def _feed_message(dp: Dispatcher, bot: Bot, text: str | None = None, photo: list | None = None, location: dict | None = None):
    payload = {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "date": 0,
            "chat": _base_chat(),
            "from": _base_user(),
        },
    }
    if text is not None:
        payload["message"]["text"] = text
    if photo is not None:
        payload["message"]["photo"] = photo
    if location is not None:
        payload["message"]["location"] = location

    update = Update.model_validate(payload)
    await dp.feed_update(bot, update)


async def _feed_callback(dp: Dispatcher, bot: Bot, data: str):
    payload = {
        "update_id": 2,
        "callback_query": {
            "id": "cbq-1",
            "from": _base_user(),
            "data": data,
            "chat_instance": "ci-1",
            "message": {
                "message_id": 2,
                "date": 0,
                "chat": _base_chat(),
                "from": _base_user(),
                "text": "callback source",
            },
        },
    }
    update = Update.model_validate(payload)
    await dp.feed_update(bot, update)


@pytest.mark.asyncio
async def test_fsm_flow_happy_path_cancel(monkeypatch):
    os.environ["TELEGRAM_BOT_TOKEN"] = "123:TEST"
    bot_module = importlib.import_module("app.bot")
    monkeypatch.setattr(bot_module, "get_repo", lambda: DummyRepo())

    async def immediate_to_thread(func, /, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(bot_module.asyncio, "to_thread", immediate_to_thread)
    async def fake_validate_photo(file_id, chat_id):
        return {"accepted": True, "fallback": False, "ai_data": {"success": True, "isWaste": True}}

    monkeypatch.setattr(bot_module, "validate_telegram_photo", fake_validate_photo)
    
    ReportStates = bot_module.ReportStates
    state = FakeState(
        data={
            "reporter_id": "123",
            "reporter_name": "Test",
            "reporter_phone": "08123456789",
            "telegram_id": "1",
        },
        state=ReportStates.PILIH_KELURAHAN.state,
    )
    assert await state.get_state() == ReportStates.PILIH_KELURAHAN.state

    await bot_module.handle_kelurahan(FakeCallback(data="kel:kotabaru"), state)
    assert await state.get_state() == ReportStates.PILIH_KATEGORI.state

    await bot_module.handle_category(FakeCallback(data="cat:tps_penuh"), state)
    assert await state.get_state() == ReportStates.UPLOAD_FOTO.state

    photo = [SimpleNamespace(file_id="file-1", file_unique_id="fu-1", width=1, height=1, file_size=1)]
    await bot_module.handle_photo_manual(FakeMessage(photo=photo), state)
    assert await state.get_state() == ReportStates.INPUT_DESKRIPSI.state

    await bot_module.handle_description(FakeMessage(text="Ada sampah menumpuk"), state)
    assert await state.get_state() == ReportStates.SHARE_LOCATION.state

    location = SimpleNamespace(latitude=-7.8, longitude=110.4)
    await bot_module.handle_location(FakeMessage(location=location), state)
    assert await state.get_state() == ReportStates.KONFIRMASI.state

    await bot_module.handle_confirm_manual(FakeCallback(data="confirm:no"), state)
    assert await state.get_state() is None
