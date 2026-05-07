from types import SimpleNamespace

import pytest

from tests.conftest import DummyRepo, FakeCallback, FakeMessage, FakeState


@pytest.mark.asyncio
async def test_start_shows_main_menu(bot_module):
    message = FakeMessage(text="/start")
    state = FakeState(state="old-state")

    await bot_module.cmd_start(message, state)

    assert state.state is None
    assert "saya bisa membantu" in message.answers[0]["text"].lower()
    assert message.answers[0]["reply_markup"].keyboard[0][0].text == bot_module.MAIN_MENU_REPORT_TEXT


@pytest.mark.asyncio
async def test_report_button_new_user_requires_phone(bot_module, monkeypatch, immediate_to_thread):
    repo = DummyRepo(reporter=None)
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    message = FakeMessage(text=bot_module.MAIN_MENU_REPORT_TEXT)
    state = FakeState()

    await bot_module.handle_report_button(message, state)

    assert state.state == bot_module.ReportStates.INPUT_TELEPON.state
    assert "nomor telepon" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_report_button_existing_user_enters_fsm_flow(
    bot_module, monkeypatch, immediate_to_thread
):
    repo = DummyRepo(reporter={"id": "reporter-1", "phone": "08123", "name": "Budi"})
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    message = FakeMessage(text=bot_module.MAIN_MENU_REPORT_TEXT, user_id=7)
    state = FakeState()

    await bot_module.handle_report_button(message, state)

    assert state.state == bot_module.ReportStates.PILIH_KELURAHAN.state
    assert bot_module.user_state[7]["file_ids"] == []
    assert bot_module.user_state[7]["suggested_category"] is None
    assert bot_module.user_state[7]["reporter_id"] == "reporter-1"
    assert bot_module.user_state[7]["reporter_phone"] == "08123"
    assert "pilih kelurahan" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_report_button_does_not_reset_active_fsm(bot_module):
    message = FakeMessage(text=bot_module.MAIN_MENU_REPORT_TEXT, user_id=7)
    state = FakeState(state=bot_module.ReportStates.INPUT_DESKRIPSI.state)

    await bot_module.handle_report_button(message, state)

    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state
    assert "masih berjalan" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_report_button_does_not_reset_active_draft(bot_module):
    bot_module.user_state[7] = bot_module._default_user_state()
    message = FakeMessage(text=bot_module.MAIN_MENU_REPORT_TEXT, user_id=7)
    state = FakeState()

    await bot_module.handle_report_button(message, state)

    assert state.state is None
    assert "masih berjalan" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_idle_text_prompts_main_menu(bot_module):
    message = FakeMessage(text="Ada sampah menumpuk", user_id=7)
    state = FakeState()

    await bot_module.handle_idle_report_input(message, state)

    assert "tekan tombol" in message.answers[0]["text"].lower()
    assert message.answers[0]["reply_markup"].keyboard[0][0].text == bot_module.MAIN_MENU_REPORT_TEXT


@pytest.mark.asyncio
async def test_contact_updates_existing_reporter_and_enters_fsm(
    bot_module, monkeypatch, immediate_to_thread
):
    repo = DummyRepo(reporter={"id": "reporter-1", "phone": "", "name": "Budi"})
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    message = FakeMessage(contact=SimpleNamespace(phone_number="081234"))
    state = FakeState(data={"telegram_id": "1", "reporter_name": "Budi"})

    await bot_module.handle_contact(message, state)

    assert repo.updated_reporters == [("reporter-1", {"phone": "081234"})]
    assert state.data["reporter_phone"] == "081234"
    assert state.state == bot_module.ReportStates.PILIH_KELURAHAN.state


@pytest.mark.asyncio
async def test_phone_text_is_accepted_and_enters_fsm(bot_module, monkeypatch, immediate_to_thread):
    repo = DummyRepo(reporter=None)
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    message = FakeMessage(text="08123456789")
    state = FakeState(data={"telegram_id": "1", "reporter_name": "Budi"})

    await bot_module.handle_phone_text_fallback(message, state)

    assert repo.created_reporters[0]["phone"] == "08123456789"
    assert state.data["reporter_phone"] == "08123456789"
    assert state.state == bot_module.ReportStates.PILIH_KELURAHAN.state


@pytest.mark.asyncio
async def test_photo_manual_valid_waste_keeps_user_category(bot_module, monkeypatch):
    photo = [SimpleNamespace(file_id="file-1")]
    message = FakeMessage(photo=photo, user_id=8)
    state = FakeState(data={"category": "sampah_liar"})

    async def fake_validate(file_id, chat_id):
        return {
            "accepted": True,
            "fallback": False,
            "suggested_category": "tps_penuh",
            "ai_data": {"success": True, "isWaste": True},
        }

    monkeypatch.setattr(bot_module, "validate_telegram_photo", fake_validate)

    await bot_module.handle_photo_manual(message, state)

    assert state.data["file_ids"] == ["file-1"]
    assert state.data["category"] == "sampah_liar"
    assert state.data["suggested_category"] == "tps_penuh"
    assert state.data["photo_received"] is True
    assert state.data["photo_validated_as_waste"] is True
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state


@pytest.mark.asyncio
async def test_additional_photo_before_description_is_kept(bot_module, monkeypatch):
    photo = [SimpleNamespace(file_id="file-2")]
    message = FakeMessage(photo=photo, user_id=8)
    state = FakeState(
        data={"category": "sampah_liar", "file_ids": ["file-1"]},
        state=bot_module.ReportStates.INPUT_DESKRIPSI.state,
    )

    async def fake_validate(file_id, chat_id):
        return {"accepted": True, "fallback": False, "ai_data": {"success": True, "isWaste": True}}

    monkeypatch.setattr(bot_module, "validate_telegram_photo", fake_validate)

    await bot_module.handle_additional_photo_before_description(message, state)

    assert state.data["file_ids"] == ["file-1", "file-2"]
    assert state.data["photo_received"] is True
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state
    assert "total foto: 2" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_description_requires_text(bot_module):
    message = FakeMessage(photo=[SimpleNamespace(file_id="file-2")], user_id=8)
    state = FakeState(data={"file_ids": ["file-1"]}, state=bot_module.ReportStates.INPUT_DESKRIPSI.state)

    await bot_module.handle_description(message, state)

    assert "deskripsi laporan" in message.answers[0]["text"].lower()
    assert "description" not in state.data
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state


@pytest.mark.asyncio
async def test_description_requires_minimum_length(bot_module):
    message = FakeMessage(text="pendek", user_id=8)
    state = FakeState(state=bot_module.ReportStates.INPUT_DESKRIPSI.state)

    await bot_module.handle_description(message, state)

    assert "minimal 10 karakter" in message.answers[0]["text"].lower()
    assert "description" not in state.data
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state


@pytest.mark.asyncio
async def test_confirm_with_short_description_keeps_draft_and_asks_description(bot_module, monkeypatch):
    repo = DummyRepo()
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    state = FakeState(
        data={
            "reporter_id": "reporter-1",
            "reporter_name": "Budi",
            "reporter_phone": "08123456789",
            "kelurahan_id": "kotabaru",
            "category": "tps_penuh",
            "file_ids": ["file-1"],
            "photo_received": True,
            "description": "pendek",
            "latitude": -7.8,
            "longitude": 110.4,
        },
        state=bot_module.ReportStates.KONFIRMASI.state,
    )
    call = FakeCallback(data="confirm:yes", user_id=8)

    await bot_module.handle_confirm_manual(call, state)

    assert repo.inserted_reports == []
    assert state.cleared is False
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state
    assert "minimal 10 karakter" in call.message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_confirm_insert_error_keeps_draft(bot_module, monkeypatch, immediate_to_thread):
    class FailingRepo(DummyRepo):
        def insert_report(self, report):
            self.inserted_reports.append(report)
            raise RuntimeError("db rejected")

    repo = FailingRepo()
    monkeypatch.setattr(bot_module, "get_repo", lambda: repo)
    state = FakeState(
        data={
            "reporter_id": "reporter-1",
            "reporter_name": "Budi",
            "reporter_phone": "08123456789",
            "kelurahan_id": "kotabaru",
            "category": "tps_penuh",
            "file_ids": ["file-1"],
            "photo_received": True,
            "description": "Sampah menumpuk dekat pasar",
            "latitude": -7.8,
            "longitude": 110.4,
        },
        state=bot_module.ReportStates.KONFIRMASI.state,
    )
    call = FakeCallback(data="confirm:yes", user_id=8)

    await bot_module.handle_confirm_manual(call, state)

    assert len(repo.inserted_reports) == 1
    assert state.cleared is False
    assert state.state == bot_module.ReportStates.KONFIRMASI.state
    assert "draft anda belum dihapus" in call.message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_photo_manual_non_waste_is_rejected(bot_module, monkeypatch):
    photo = [SimpleNamespace(file_id="file-spam")]
    message = FakeMessage(photo=photo, user_id=9)
    state = FakeState()

    async def fake_validate(file_id, chat_id):
        return {"accepted": False, "fallback": False, "top_label": "selfie"}

    monkeypatch.setattr(bot_module, "validate_telegram_photo", fake_validate)

    await bot_module.handle_photo_manual(message, state)

    assert state.data["file_ids"] == []
    assert state.data["photo_received"] is False
    assert state.state is None
    assert "belum terdeteksi" in message.answers[0]["text"].lower()


@pytest.mark.asyncio
async def test_photo_manual_validation_error_accepts_fallback(bot_module, monkeypatch):
    photo = [SimpleNamespace(file_id="file-1")]
    message = FakeMessage(photo=photo, user_id=9)
    state = FakeState()

    async def fake_validate(file_id, chat_id):
        return {"accepted": True, "fallback": True, "ai_data": {}}

    monkeypatch.setattr(bot_module, "validate_telegram_photo", fake_validate)

    await bot_module.handle_photo_manual(message, state)

    assert state.data["file_ids"] == ["file-1"]
    assert state.data["photo_received"] is True
    assert state.data["photo_validated_as_waste"] is False
    assert "tetap diterima" in message.answers[0]["text"].lower()
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state


@pytest.mark.asyncio
async def test_manual_photo_skip_and_required_location(bot_module):
    state = FakeState()
    skip_message = FakeMessage(text="-")

    await bot_module.handle_photo_skip(skip_message, state)

    assert state.data["file_ids"] == []
    assert state.data["photo_declined"] is True
    assert state.state == bot_module.ReportStates.INPUT_DESKRIPSI.state

    state = FakeState(data={"file_ids": []}, state=bot_module.ReportStates.SHARE_LOCATION.state)
    bad_location = FakeMessage(text="lokasinya di dekat pasar")

    await bot_module.handle_location(bad_location, state)

    assert state.state == bot_module.ReportStates.SHARE_LOCATION.state
    assert "tanpa lokasi" in bad_location.answers[0]["text"]
