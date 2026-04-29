import pytest
import importlib
import os
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Update
from aiogram.fsm.storage.base import StorageKey


class DummyBot(Bot):
    async def __call__(self, *args, **kwargs):
        return True


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
async def test_fsm_flow_happy_path_cancel():
    os.environ["TELEGRAM_BOT_TOKEN"] = "123:TEST"
    bot_module = importlib.import_module("app.bot")
    ReportStates = bot_module.ReportStates
    dp = bot_module.dp
    storage = bot_module.storage
    bot = DummyBot(token="123:TEST")

    key = StorageKey(bot_id=bot.id, chat_id=1, user_id=1)

    await _feed_message(dp, bot, text="/start")
    assert await storage.get_state(key) == ReportStates.PILIH_KELURAHAN.state

    await _feed_callback(dp, bot, data="kel:kotabaru")
    assert await storage.get_state(key) == ReportStates.UPLOAD_FOTO.state

    photo = [{"file_id": "file-1", "file_unique_id": "fu-1", "width": 1, "height": 1, "file_size": 1}]
    await _feed_message(dp, bot, photo=photo)
    assert await storage.get_state(key) == ReportStates.INPUT_DESKRIPSI.state

    await _feed_message(dp, bot, text="Ada sampah menumpuk")
    assert await storage.get_state(key) == ReportStates.SHARE_LOCATION.state

    await _feed_message(dp, bot, location={"latitude": -7.8, "longitude": 110.4})
    assert await storage.get_state(key) == ReportStates.KONFIRMASI.state

    await _feed_callback(dp, bot, data="confirm:no")
    assert await storage.get_state(key) is None
