import pytest
from app.kelurahan import KELURAHAN_OPTIONS, get_kelurahan_name


def test_kelurahan_list_count():
    assert len(KELURAHAN_OPTIONS) == 45


def test_kelurahan_name_lookup():
    assert get_kelurahan_name("kotabaru") == "Kotabaru"


def test_report_states_exist():
    pytest.importorskip("aiogram")
    import os
    os.environ["TELEGRAM_BOT_TOKEN"] = "123:TEST"
    from app.bot import ReportStates
    assert hasattr(ReportStates, "PILIH_KELURAHAN")
    assert hasattr(ReportStates, "UPLOAD_FOTO")
    assert hasattr(ReportStates, "INPUT_DESKRIPSI")
    assert hasattr(ReportStates, "SHARE_LOCATION")
    assert hasattr(ReportStates, "KONFIRMASI")
