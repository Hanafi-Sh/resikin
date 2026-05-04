from types import SimpleNamespace

import pytest

from tests.conftest import DummyRepo, FakeMessage, FakeState


@pytest.mark.asyncio
async def test_start_new_user_requires_phone(bot_module, monkeypatch, immediate_to_thread):
    repo = DummyRepo(reporter=None)
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    message = FakeMessage(text="/start")
    state = FakeState()

    await bot_module.cmd_start(message, state)

    assert state.state == bot_module.ReportStates.INPUT_TELEPON.state
    assert "nomor telepon" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_start_existing_user_enters_llm_flow(
    bot_module, monkeypatch, immediate_to_thread, dummy_bot
):
    repo = DummyRepo(reporter={"id": "reporter-1", "phone": "08123", "name": "Budi"})
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)

    async def fake_call_deepseek(user_id):
        return "Apa detail masalah sampahnya?"

    monkeypatch.setattr(bot_module, "call_deepseek", fake_call_deepseek)
    message = FakeMessage(text="/start", user_id=7)
    state = FakeState()

    await bot_module.cmd_start(message, state)

    assert bot_module.chat_history[7][0]["role"] == "system"
    assert bot_module.user_state[7]["file_ids"] == []
    assert bot_module.user_state[7]["suggested_category"] is None
    assert bot_module.user_state[7]["reporter_id"] == "reporter-1"
    assert bot_module.user_state[7]["reporter_phone"] == "08123"
    assert message.answers[0]["text"] == "Apa detail masalah sampahnya?"
    assert dummy_bot.actions[0]["action"] == "typing"


@pytest.mark.asyncio
async def test_contact_updates_existing_reporter_without_phone(
    bot_module, monkeypatch, immediate_to_thread
):
    repo = DummyRepo(reporter={"id": "reporter-1", "phone": "", "name": "Budi"})
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)

    async def fake_cmd_start(message, state):
        await state.set_state("llm-started")

    monkeypatch.setattr(bot_module, "cmd_start", fake_cmd_start)
    message = FakeMessage(contact=SimpleNamespace(phone_number="081234"))
    state = FakeState(data={"telegram_id": "1", "reporter_name": "Budi"})

    await bot_module.handle_contact(message, state)

    assert repo.updated_reporters == [("reporter-1", {"phone": "081234"})]
    assert state.data["reporter_phone"] == "081234"
    assert state.state == "llm-started"


@pytest.mark.asyncio
async def test_phone_text_is_accepted(bot_module, monkeypatch, immediate_to_thread):
    repo = DummyRepo(reporter=None)
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)

    async def fake_cmd_start(message, state):
        await state.set_state("llm-started")

    monkeypatch.setattr(bot_module, "cmd_start", fake_cmd_start)
    message = FakeMessage(text="08123456789")
    state = FakeState(data={"telegram_id": "1", "reporter_name": "Budi"})

    await bot_module.handle_phone_text_fallback(message, state)

    assert repo.created_reporters[0]["phone"] == "08123456789"
    assert state.data["reporter_phone"] == "08123456789"
    assert state.state == "llm-started"


@pytest.mark.asyncio
async def test_text_llm_timeout_forces_manual_fallback(bot_module, monkeypatch, dummy_bot):
    message = FakeMessage(text="Ada sampah menumpuk", user_id=5)
    state = FakeState()
    called = {}

    async def timeout(_user_id):
        raise bot_module.DeepSeekTimeoutError("timeout")

    async def fake_force_fallback(msg, st):
        called["message"] = msg
        await st.set_state("manual")

    monkeypatch.setattr(bot_module, "call_deepseek", timeout)
    monkeypatch.setattr(bot_module, "_force_fallback", fake_force_fallback)

    await bot_module.handle_text_llm(message, state)

    assert called["message"] is message
    assert state.state == "manual"
    assert "gagal memproses" in message.answers[0]["text"]


@pytest.mark.asyncio
async def test_text_llm_marks_photo_declined(bot_module, monkeypatch, dummy_bot):
    message = FakeMessage(text="tidak ada foto", user_id=12)
    state = FakeState()

    async def fake_call_deepseek(user_id):
        return "Baik, saya lanjutkan tanpa foto."

    monkeypatch.setattr(bot_module, "call_deepseek", fake_call_deepseek)

    await bot_module.handle_text_llm(message, state)

    assert bot_module.user_state[12]["photo_was_asked"] is True
    assert bot_module.user_state[12]["photo_declined"] is True


@pytest.mark.asyncio
async def test_location_llm_records_gps_and_continues_ai(bot_module, monkeypatch, dummy_bot):
    message = FakeMessage(location=SimpleNamespace(latitude=-7.8, longitude=110.4), user_id=6)
    state = FakeState()

    class FakeResponse:
        status = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def json(self):
            return {"address": {"suburb": "Kotabaru"}}

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def get(self, *args, **kwargs):
            return FakeResponse()

    async def fake_call_deepseek(user_id):
        return "Ada foto sampahnya?"

    monkeypatch.setattr(bot_module.aiohttp, "ClientSession", lambda: FakeSession())
    monkeypatch.setattr(bot_module, "call_deepseek", fake_call_deepseek)

    await bot_module.handle_location_llm(message, state)

    assert bot_module.user_state[6]["latitude"] == -7.8
    assert bot_module.user_state[6]["longitude"] == 110.4
    assert bot_module.user_state[6]["kelurahan_detected"] == "Kotabaru"
    assert "Kelurahan Kotabaru" in message.answers[0]["text"]
    assert message.answers[-1]["text"] == "Ada foto sampahnya?"


@pytest.mark.asyncio
async def test_photo_llm_valid_waste_records_category(bot_module, monkeypatch, dummy_bot):
    photo = [SimpleNamespace(file_id="file-1")]
    message = FakeMessage(photo=photo, user_id=8)
    state = FakeState()

    class FakeResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def json(self):
            return {"success": True, "isWaste": True, "suggested_category": "tps_penuh"}

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def post(self, *args, **kwargs):
            self.payload = kwargs["json"]
            return FakeResponse()

    async def fake_call_deepseek(user_id):
        return "Lokasinya di mana?"

    monkeypatch.setattr(bot_module.aiohttp, "ClientSession", lambda: FakeSession())
    monkeypatch.setattr(bot_module, "call_deepseek", fake_call_deepseek)

    await bot_module.handle_photo_llm(message, state)

    assert bot_module.user_state[8]["file_ids"] == ["file-1"]
    assert bot_module.user_state[8]["suggested_category"] == "tps_penuh"
    assert bot_module.user_state[8]["photo_received"] is True
    assert bot_module.user_state[8]["photo_validated_as_waste"] is True
    assert "Bukti Sampah".lower() in bot_module.chat_history[8][-1]["content"].lower()
    assert message.answers[0]["text"] == "Lokasinya di mana?"


@pytest.mark.asyncio
async def test_photo_llm_spam_does_not_count_as_received(bot_module, monkeypatch, dummy_bot):
    photo = [SimpleNamespace(file_id="file-spam")]
    message = FakeMessage(photo=photo, user_id=9)
    state = FakeState()

    class FakeResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def json(self):
            return {"success": True, "isWaste": False, "top_label": "selfie"}

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        def post(self, *args, **kwargs):
            return FakeResponse()

    async def fake_call_deepseek(user_id):
        return "Foto itu belum terlihat seperti sampah. Bisa kirim foto tumpukan sampah?"

    monkeypatch.setattr(bot_module.aiohttp, "ClientSession", lambda: FakeSession())
    monkeypatch.setattr(bot_module, "call_deepseek", fake_call_deepseek)

    await bot_module.handle_photo_llm(message, state)

    assert bot_module.user_state[9]["file_ids"] == []
    assert bot_module.user_state[9]["photo_was_asked"] is True
    assert bot_module.user_state[9]["photo_received"] is False


@pytest.mark.asyncio
async def test_manual_photo_skip_and_required_location(bot_module):
    state = FakeState()
    skip_message = FakeMessage(text="-")

    await bot_module.handle_photo_skip(skip_message, state)

    assert state.data["file_ids"] == []
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state

    state = FakeState(data={"file_ids": []}, state=bot_module.ReportStates.SHARE_LOCATION.state)
    bad_location = FakeMessage(text="lokasinya di dekat pasar")

    await bot_module.handle_location(bad_location, state)

    assert state.state == bot_module.ReportStates.SHARE_LOCATION.state
    assert "tanpa lokasi" in bad_location.answers[0]["text"]
