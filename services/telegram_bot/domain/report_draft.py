import re
from typing import Dict, List, Optional

from app.kelurahan import KELURAHAN_OPTIONS


CATEGORY_OPTIONS = [
    {"id": "tidak_terangkut", "name": "🚛 Tidak Terangkut"},
    {"id": "tps_penuh",       "name": "🗑️ TPS Penuh"},
    {"id": "sampah_liar",     "name": "🏚️ Sampah Liar"},
    {"id": "bau",             "name": "😷 Bau"},
    {"id": "lainnya",         "name": "📋 Lainnya"},
]

VALID_CATEGORY_IDS = {cat["id"] for cat in CATEGORY_OPTIONS}

PHOTO_DECLINE_WORDS = {
    "tidak",
    "tidakada",
    "ga",
    "gak",
    "nggak",
    "ngga",
    "gakada",
    "nggakada",
    "skip",
    "lewati",
    "tanpafoto",
    "tidakpunya",
}


def normalize_lookup_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())


KELURAHAN_ID_BY_KEY = {}
for item in KELURAHAN_OPTIONS:
    KELURAHAN_ID_BY_KEY[normalize_lookup_key(item["id"])] = item["id"]
    KELURAHAN_ID_BY_KEY[normalize_lookup_key(item["name"])] = item["id"]


user_state: Dict[int, dict] = {}


def get_category_name(category_id: str) -> str:
    return next((c["name"] for c in CATEGORY_OPTIONS if c["id"] == category_id), category_id)


def normalize_category(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip().lower()
    return normalized if normalized in VALID_CATEGORY_IDS else ("lainnya" if value else None)


def normalize_kelurahan(value: Optional[str], state_data: Optional[dict] = None) -> Optional[str]:
    state_data = state_data or {}
    raw_value = (value or "").strip()
    if raw_value.lower() == "dari_gps":
        raw_value = state_data.get("kelurahan_detected") or state_data.get("kelurahan_id") or ""
    return KELURAHAN_ID_BY_KEY.get(normalize_lookup_key(raw_value))


def default_user_state(existing_reporter: Optional[dict] = None) -> dict:
    existing_reporter = existing_reporter or {}
    return {
        "reporter_id": existing_reporter.get("id"),
        "reporter_name": existing_reporter.get("name") or "",
        "reporter_phone": existing_reporter.get("phone") or "",
        "description": "",
        "category": None,
        "kelurahan_id": None,
        "latitude": None,
        "longitude": None,
        "file_ids": [],
        "photo_was_asked": False,
        "photo_received": False,
        "photo_declined": False,
        "photo_validated_as_waste": False,
        "kelurahan_detected": "",
        "suggested_category": None,
        "missing_fields": [],
        "last_ai_data": {},
    }


def ensure_user_state(user_id: int, existing_reporter: Optional[dict] = None) -> dict:
    if user_id not in user_state:
        user_state[user_id] = default_user_state(existing_reporter)
    elif existing_reporter:
        state_data = user_state[user_id]
        state_data["reporter_id"] = state_data.get("reporter_id") or existing_reporter.get("id")
        state_data["reporter_name"] = state_data.get("reporter_name") or existing_reporter.get("name") or ""
        state_data["reporter_phone"] = state_data.get("reporter_phone") or existing_reporter.get("phone") or ""
    return user_state[user_id]


def is_photo_decline_text(text: Optional[str]) -> bool:
    key = normalize_lookup_key(text or "")
    return key in PHOTO_DECLINE_WORDS or key.startswith("tidakadafoto") or key.startswith("gakadafoto")


def mark_photo_asked_from_text(user_id: int, text: str) -> None:
    if "foto" in (text or "").lower():
        ensure_user_state(user_id)["photo_was_asked"] = True


def merge_ai_data(user_id: int, ai_data: dict) -> dict:
    state_data = ensure_user_state(user_id)
    state_data["last_ai_data"] = ai_data or {}
    reporter_name = (ai_data or {}).get("reporter_name")
    description = (ai_data or {}).get("description")
    if reporter_name:
        state_data["reporter_name"] = reporter_name.strip()
    if description:
        state_data["description"] = description.strip()

    category = normalize_category((ai_data or {}).get("suggested_category") or (ai_data or {}).get("category"))
    if category:
        state_data["category"] = category
        state_data["suggested_category"] = category

    kelurahan_id = normalize_kelurahan((ai_data or {}).get("kelurahan_id"), state_data)
    if kelurahan_id:
        state_data["kelurahan_id"] = kelurahan_id

    return state_data


def validate_report_readiness(user_id: int) -> List[str]:
    state_data = ensure_user_state(user_id)
    if state_data.get("category") not in VALID_CATEGORY_IDS:
        normalized_category = normalize_category(state_data.get("category") or state_data.get("suggested_category"))
        if normalized_category:
            state_data["category"] = normalized_category

    normalized_kelurahan = normalize_kelurahan(state_data.get("kelurahan_id"), state_data)
    if normalized_kelurahan:
        state_data["kelurahan_id"] = normalized_kelurahan

    missing = []
    if not (state_data.get("reporter_name") or "").strip():
        missing.append("reporter_name")
    if len((state_data.get("description") or "").strip()) < 10:
        missing.append("description")
    if state_data.get("latitude") is None or state_data.get("longitude") is None:
        missing.append("location")
    if not state_data.get("photo_received") and not state_data.get("photo_declined"):
        missing.append("photo")
    if state_data.get("kelurahan_id") not in KELURAHAN_ID_BY_KEY.values():
        missing.append("kelurahan_id")
    if state_data.get("category") not in VALID_CATEGORY_IDS:
        missing.append("category")

    state_data["missing_fields"] = missing
    return missing


def missing_field_prompt(missing_fields: List[str]) -> str:
    first = missing_fields[0] if missing_fields else ""
    prompts = {
        "reporter_name": "Boleh tahu nama lengkap Anda untuk laporan ini?",
        "description": "Tolong ceritakan detail masalah sampahnya minimal 10 karakter, misalnya jenis masalah dan patokan lokasinya.",
        "location": "Lokasi GPS wajib diisi agar petugas bisa menemukan titiknya. Silakan tekan tombol Bagikan Lokasi Saat Ini.",
        "photo": "Kalau ada, kirim foto sampahnya agar petugas lebih mudah memverifikasi. Kalau tidak ada, balas saja: tidak ada foto.",
        "kelurahan_id": "Saya belum bisa memastikan kelurahannya. Silakan pilih kelurahan secara manual.",
        "category": "Saya belum bisa menentukan kategori laporan. Silakan pilih kategori secara manual.",
    }
    return prompts.get(first, "Data laporan masih belum lengkap. Tolong lengkapi informasi yang masih kurang.")
