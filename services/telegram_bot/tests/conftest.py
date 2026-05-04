import importlib
import os
from dataclasses import dataclass
from io import BytesIO
from types import SimpleNamespace

import pytest


os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123:TEST")
os.environ.setdefault("DEEPSEEK_API_KEY", "test-key")


@dataclass
class FakeUser:
    id: int = 1
    first_name: str = "Test"
    last_name: str = ""
    username: str = "tester"


@dataclass
class FakeChat:
    id: int = 1
    type: str = "private"


class FakeMessage:
    def __init__(
        self,
        text=None,
        contact=None,
        location=None,
        photo=None,
        caption=None,
        user_id=1,
        media_group_id=None,
    ):
        self.text = text
        self.caption = caption
        self.contact = contact
        self.location = location
        self.photo = photo
        self.media_group_id = media_group_id
        self.from_user = FakeUser(id=user_id)
        self.chat = FakeChat(id=user_id)
        self.answers = []

    async def answer(self, text, **kwargs):
        self.answers.append({"text": text, **kwargs})
        return SimpleNamespace(message_id=len(self.answers), text=text)


class FakeCallback:
    def __init__(self, data="confirm:yes", user_id=1):
        self.data = data
        self.from_user = FakeUser(id=user_id)
        self.message = FakeMessage(user_id=user_id)
        self.answered = False

    async def answer(self):
        self.answered = True


class FakeState:
    def __init__(self, data=None, state=None):
        self.data = data or {}
        self.state = state
        self.cleared = False

    async def clear(self):
        self.data = {}
        self.state = None
        self.cleared = True

    async def update_data(self, **kwargs):
        self.data.update(kwargs)

    async def get_data(self):
        return dict(self.data)

    async def set_state(self, state):
        self.state = getattr(state, "state", state)

    async def get_state(self):
        return self.state


class DummyRepo:
    def __init__(self, reporter=None, inserted=None):
        self.reporter = reporter
        self.inserted = inserted or [{"id": "report-1", "tracking_code": "RSK-001"}]
        self.created_reporters = []
        self.updated_reporters = []
        self.inserted_reports = []
        self.link_queries = []

    def find_reporter_by_telegram_id(self, telegram_id):
        return self.reporter

    def create_reporter(self, reporter):
        self.created_reporters.append(reporter)
        return {"id": "reporter-new", **reporter}

    def update_reporter(self, reporter_id, updates):
        self.updated_reporters.append((reporter_id, updates))

    def insert_report(self, report):
        self.inserted_reports.append(report)
        inserted = dict(self.inserted[0])
        inserted.update(report)
        return [inserted]

    def get_telegram_links_by_kelurahan(self, kelurahan_id, role):
        self.link_queries.append((kelurahan_id, role))
        return []

    def get_link_token(self, token_hash):
        return None


class DummyBot:
    def __init__(self):
        self.messages = []
        self.actions = []
        self.files = {}

    async def send_message(self, **kwargs):
        self.messages.append(kwargs)
        return {"ok": True}

    async def send_chat_action(self, **kwargs):
        self.actions.append(kwargs)

    async def get_file(self, file_id):
        return SimpleNamespace(file_path=f"photos/{file_id}.jpg")

    async def download_file(self, file_path):
        return BytesIO(b"fake-image")


@pytest.fixture
def bot_module(monkeypatch):
    module = importlib.import_module("app.bot")
    module.chat_history.clear()
    module.user_state.clear()
    module._repo = None
    module._bot = None
    yield module
    module.chat_history.clear()
    module.user_state.clear()
    module._repo = None
    module._bot = None


@pytest.fixture
def immediate_to_thread(monkeypatch, bot_module):
    async def immediate(func, /, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(bot_module.asyncio, "to_thread", immediate)


@pytest.fixture
def dummy_bot(monkeypatch, bot_module):
    bot = DummyBot()
    monkeypatch.setattr(bot_module, "get_bot", lambda: bot)
    return bot
