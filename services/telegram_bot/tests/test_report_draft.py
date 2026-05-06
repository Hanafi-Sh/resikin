from domain.report_draft import (
    default_user_state,
    merge_ai_data,
    user_state,
    validate_report_readiness,
)


def test_validator_normalizes_kelurahan_and_category():
    user_state[10] = {
        **default_user_state(),
        "reporter_name": "Budi",
        "description": "Sampah menumpuk dekat pasar",
        "category": "bad-category",
        "kelurahan_id": "dari_gps",
        "kelurahan_detected": "Kotabaru",
        "latitude": -7.8,
        "longitude": 110.4,
        "photo_declined": True,
    }

    merge_ai_data(10, {"suggested_category": "not-real", "kelurahan_id": "dari_gps"})
    missing = validate_report_readiness(10)

    assert missing == []
    assert user_state[10]["category"] == "lainnya"
    assert user_state[10]["kelurahan_id"] == "kotabaru"

    user_state.pop(10, None)
