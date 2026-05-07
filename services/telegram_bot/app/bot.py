from aiogram import Bot, Dispatcher, F, Router, BaseMiddleware
from aiogram.filters import CommandStart, Command, StateFilter
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove, TelegramObject
from aiogram.utils.keyboard import InlineKeyboardBuilder
from app.config import settings
from domain.models import Report, Reporter
import asyncio
import logging
import hashlib
import json
import base64
import aiohttp
import re
from datetime import datetime, timezone
from app.kelurahan import KELURAHAN_OPTIONS, get_kelurahan_name
from typing import TYPE_CHECKING, Dict, List, Any, Optional
from openai import AsyncOpenAI

if TYPE_CHECKING:
    from repositories.supabase_repo import SupabaseRepo

logger = logging.getLogger(__name__)

storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()
dp.include_router(router)

_repo = None
_bot = None

deepseek_client = AsyncOpenAI(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com/v1"
)

# ── Anti Spam & LLM Memory ──
chat_history: Dict[int, List[dict]] = {}
user_state: Dict[int, dict] = {} 

class AntiSpamMiddleware(BaseMiddleware):
    def __init__(self):
        super().__init__()
        self.last_msg_time = {}
        self.daily_stats = {}
        self.max_chars_per_msg = 2000
        self.max_chars_per_day = 50000
        self.max_chats_per_day = 100

    async def __call__(self, handler, event: TelegramObject, data: Dict[str, Any]):
        if getattr(event, "from_user", None) is None:
            return await handler(event, data)
        
        user_id = event.from_user.id
        now = datetime.now(timezone.utc)
        now_ts = now.timestamp()
        today = now.strftime("%Y-%m-%d")

        # 1. Cooldown 2 seconds
        last_time = self.last_msg_time.get(user_id, 0)
        if now_ts - last_time < 2.0:
            return # Ignore flood

        self.last_msg_time[user_id] = now_ts

        # 2. Daily limits
        if user_id not in self.daily_stats or self.daily_stats[user_id]["date"] != today:
            self.daily_stats[user_id] = {"date": today, "chats": 0, "chars": 0}

        text_length = 0
        if isinstance(event, Message):
            if event.text: text_length += len(event.text)
            if event.caption: text_length += len(event.caption)

            if text_length > self.max_chars_per_msg:
                await event.answer("⚠️ Pesan terlalu panjang (Maks 2000 karakter).")
                return

        # Check if FSM is active. If active, we don't count towards LLM limits.
        state: FSMContext = data.get("state")
        current_state = await state.get_state() if state else None
        
        # We only apply LLM rate limits if NOT in FSM (LLM mode)
        if current_state is None and isinstance(event, Message) and (event.text or event.photo) and not (event.text and event.text.startswith('/')):
            if self.daily_stats[user_id]["chats"] >= self.max_chats_per_day:
                await event.answer("⚠️ Anda telah mencapai batas obrolan AI harian (100 chat). Mengalihkan ke mode manual...")
                await _force_fallback(event, state)
                return

            if self.daily_stats[user_id]["chars"] + text_length > self.max_chars_per_day:
                await event.answer("⚠️ Anda telah mencapai batas karakter AI harian. Mengalihkan ke mode manual...")
                await _force_fallback(event, state)
                return

            self.daily_stats[user_id]["chats"] += 1
            self.daily_stats[user_id]["chars"] += text_length

        return await handler(event, data)

router.message.middleware(AntiSpamMiddleware())

# ── Fallback Helpers ──
async def _force_fallback(message: Message, state: FSMContext):
    user_id = message.from_user.id
    if user_id in chat_history:
        del chat_history[user_id]
        
    await state.clear()
    
    telegram_id = str(user_id)
    try:
        repo = get_repo()
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
    except:
        existing = None

    if existing and existing.get("phone"):
        await state.update_data(
            reporter_id=existing["id"],
            reporter_name=existing.get("name", ""),
            reporter_phone=existing.get("phone", ""),
            telegram_id=telegram_id
        )
        await _show_kelurahan_picker(message, state)
    else:
        await state.update_data(
            telegram_id=telegram_id,
            reporter_name=_get_telegram_name(message.from_user),
        )
        contact_kb = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="📱 Bagikan Nomor Telepon", request_contact=True)]],
            resize_keyboard=True, one_time_keyboard=True
        )
        await message.answer("Silakan tekan tombol di bawah untuk membagikan nomor telepon agar dapat melanjutkan:", reply_markup=contact_kb)
        await state.set_state(ReportStates.INPUT_TELEPON)


# ── FSM Core ──
MAX_PHOTOS = 3
_media_group_buffer: Dict[str, List[str]] = {}
_media_group_tasks: Dict[str, asyncio.Task] = {}
_media_group_context: Dict[str, tuple] = {}

CATEGORY_OPTIONS = [
    {"id": "tidak_terangkut", "name": "🚛 Tidak Terangkut"},
    {"id": "tps_penuh",       "name": "🗑️ TPS Penuh"},
    {"id": "sampah_liar",     "name": "🏚️ Sampah Liar"},
    {"id": "bau",             "name": "😷 Bau"},
    {"id": "lainnya",         "name": "📋 Lainnya"},
]

VALID_CATEGORY_IDS = {cat["id"] for cat in CATEGORY_OPTIONS}


def _normalize_lookup_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())


KELURAHAN_ID_BY_KEY = {}
for item in KELURAHAN_OPTIONS:
    KELURAHAN_ID_BY_KEY[_normalize_lookup_key(item["id"])] = item["id"]
    KELURAHAN_ID_BY_KEY[_normalize_lookup_key(item["name"])] = item["id"]


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
    return KELURAHAN_ID_BY_KEY.get(_normalize_lookup_key(raw_value))


def _default_user_state(existing_reporter: Optional[dict] = None) -> dict:
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
        user_state[user_id] = _default_user_state(existing_reporter)
    elif existing_reporter:
        state_data = user_state[user_id]
        state_data["reporter_id"] = state_data.get("reporter_id") or existing_reporter.get("id")
        state_data["reporter_name"] = state_data.get("reporter_name") or existing_reporter.get("name") or ""
        state_data["reporter_phone"] = state_data.get("reporter_phone") or existing_reporter.get("phone") or ""
    return user_state[user_id]


def _is_photo_decline_text(text: Optional[str]) -> bool:
    key = _normalize_lookup_key(text or "")
    return key in PHOTO_DECLINE_WORDS or key.startswith("tidakadafoto") or key.startswith("gakadafoto")


def _mark_photo_asked_from_text(user_id: int, text: str) -> None:
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


def _missing_field_prompt(missing_fields: List[str]) -> str:
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


async def _ask_for_missing_fields(user_id: int, message: Message, state: FSMContext, missing_fields: List[str]) -> None:
    prompt = _missing_field_prompt(missing_fields)
    if missing_fields and missing_fields[0] == "kelurahan_id":
        await message.answer(prompt)
        if state is not None:
            await _show_kelurahan_picker(message, state)
        return
    if missing_fields and missing_fields[0] == "category":
        if state is None:
            await message.answer(prompt)
            return
        builder = InlineKeyboardBuilder()
        for cat in CATEGORY_OPTIONS:
            builder.button(text=cat["name"], callback_data=f"cat:{cat['id']}")
        builder.adjust(2)
        await message.answer(prompt, reply_markup=builder.as_markup())
        await state.set_state(ReportStates.PILIH_KATEGORI)
        return

    loc_kb = None
    if "location" in missing_fields:
        loc_kb = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="📍 Bagikan Lokasi Saat Ini", request_location=True)]],
            resize_keyboard=True,
        )
    await message.answer(prompt, reply_markup=loc_kb)

def get_repo() -> "SupabaseRepo":
    global _repo
    if _repo is None:
        from repositories.supabase_repo import SupabaseRepo
        _repo = SupabaseRepo()
    return _repo

def get_bot() -> Bot:
    global _bot
    if _bot is None:
        _bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    return _bot

def _get_telegram_name(user) -> str:
    name = user.first_name or ""
    if user.last_name:
        name += f" {user.last_name}"
    return name.strip() or "Anonim"

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

async def _notify_koordinator_for_report(report: dict) -> None:
    try:
        repo = get_repo()
        links = repo.get_telegram_links_by_kelurahan(report.get("kelurahan_id"), "koordinator")
        telegram_ids = [l.get("telegram_id") for l in links if l.get("telegram_id")]
        if not telegram_ids:
            return
        tracking = report.get("tracking_code") or "-"
        kel_name = get_kelurahan_name(report.get("kelurahan_id"))
        category = report.get("category") or "-"
        text = (
            "📣 LAPORAN BARU MASUK!\n"
            "Segera verifikasi laporan warga berikut di dashboard:\n\n"
            f"- Kode: {tracking}\n"
            f"- Kelurahan: {kel_name}\n"
            f"- Kategori: {category}\n"
            f"- Deskripsi: {report.get('description', '-')}"
        )
        bot = get_bot()
        tasks = []
        for tid in telegram_ids:
            try:
                chat_id = int(tid)
            except Exception:
                chat_id = tid
            tasks.append(bot.send_message(chat_id=chat_id, text=text))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    except Exception:
        logger.exception("Gagal mengirim notifikasi ke koordinator")

class ReportStates(StatesGroup):
    INPUT_TELEPON = State()
    PILIH_KELURAHAN = State()
    PILIH_KATEGORI = State()
    UPLOAD_FOTO = State()
    KONFIRMASI_FOTO = State()  # Tambahan untuk konfirmasi foto bukan sampah
    INPUT_DESKRIPSI = State()
    SHARE_LOCATION = State()
    KONFIRMASI = State()


# ── LLM Core ──
SYSTEM_PROMPT = """Kamu adalah Asisten ResikIn, bot lapor sampah di Yogyakarta.
Kumpulkan info berikut:
1. Nama Pelapor
2. Kelurahan (Sistem otomatis mendeteksi dari GPS. JIKA warga sudah kirim lokasi GPS, MAKA SYARAT KELURAHAN OTOMATIS LENGKAP. JANGAN PERNAH TANYAKAN KELURAHAN JIKA GPS SUDAH ADA!).
3. Deskripsi Masalah (Intinya saja: bau, numpuk, lokasi spesifik, dll).
4. Foto Bukti (OPSIONAL tapi HARUS DITANYAKAN SEKALI. Tanya "ada foto sampahnya?" sebelum finalisasi. Jika warga bilang tidak ada atau menolak, terima saja dan lanjut).
5. Lokasi GPS (WAJIB. Suruh tekan tombol 'Bagikan Lokasi' jika belum ada).

ATURAN GAYA BAHASA (SANGAT PENTING):
- Balas dengan 2-4 kalimat. Cukup singkat tapi tetap hangat dan natural seperti teman ngobrol, BUKAN robot.
- Boleh pakai 1 emoji per pesan agar terasa ramah.
- JANGAN membuat daftar (bullet points). Tanya cukup 1 hal per pesan.
- Contoh BENAR: "Halo! Terima kasih sudah mau lapor, pasti mengganggu banget ya kalau sampah numpuk. 😊 Boleh tahu nama kamu siapa?"
- Contoh BENAR 2: "Oke, deskripsinya sudah saya catat. Kalau sempat, boleh kirim foto sampahnya biar lebih jelas. Tapi kalau tidak ada juga tidak apa-apa!"
- Contoh SALAH: "Bau sampah pasti mengganggu. Nama Anda siapa ya?" (terlalu kaku dan dingin)
- Contoh SALAH 2: (Menjelaskan panjang lebar 5+ kalimat dengan bullet points).

Jika warga mengirim foto, [System] akan memberikan hasil Vision AI. Jika spam, tolak dengan sopan.

Jika menurutmu data sudah cukup, berikan respons JSON rahasia di akhir pesanmu. Sistem Python tetap akan memvalidasi ulang data wajib sebelum laporan benar-benar disimpan. Format JSON harus PERSIS seperti ini (dalam blok code json):
```json
{
  "status": "complete",
  "data": {
    "reporter_name": "nama lengkap warga",
    "kelurahan_id": "nama kelurahan (jika tahu), atau isi dengan 'dari_gps' jika tidak tahu dan mengandalkan sistem",
    "description": "deskripsi detail",
    "suggested_category": "kategori dari AI (tps_penuh, sampah_liar, tidak_terangkut, bau, lainnya)"
  }
}
```"""

class DeepSeekTimeoutError(Exception):
    pass

async def call_deepseek(user_id: int) -> str:
    for attempt in range(3):
        try:
            response = await deepseek_client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=chat_history[user_id],
                max_tokens=800,
                temperature=0.5,
                timeout=5.0
            )
            reply = response.choices[0].message.content
            chat_history[user_id].append({"role": "assistant", "content": reply})
            return reply
        except Exception as e:
            logger.warning(f"DeepSeek API Error (attempt {attempt+1}): {e}")
            await asyncio.sleep(0.5)
            
    raise DeepSeekTimeoutError("DeepSeek gagal merespons setelah 3 kali percobaan.")

async def process_llm_response(user_id: int, message: Message, reply_text: str, state: FSMContext):
    _mark_photo_asked_from_text(user_id, reply_text)
    # Check for JSON block
    match = re.search(r'```json\n(.*?)\n```', reply_text, re.DOTALL)
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            if data.get("status") == "complete":
                text_part = reply_text[:match.start()].strip()
                merge_ai_data(user_id, data.get("data") or {})
                missing = validate_report_readiness(user_id)
                if missing:
                    if text_part:
                        await message.answer(text_part)
                    await _ask_for_missing_fields(user_id, message, state, missing)
                    return

                if text_part:
                    await message.answer(text_part, reply_markup=ReplyKeyboardRemove())
                else:
                    await message.answer("Laporan Anda sudah lengkap, sedang kami proses...", reply_markup=ReplyKeyboardRemove())

                await save_report_from_state(user_id, message)
                return
        except Exception as e:
            logger.error(f"Failed to parse JSON from LLM: {e}")
    
    from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
    loc_kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📍 Bagikan Lokasi Saat Ini", request_location=True)]],
        resize_keyboard=True
    )
    await message.answer(reply_text, reply_markup=loc_kb)


async def save_report(user_id: int, data: dict, message: Message):
    merge_ai_data(user_id, data or {})
    missing = validate_report_readiness(user_id)
    if missing:
        await _ask_for_missing_fields(user_id, message, None, missing)
        return
    await save_report_from_state(user_id, message)


async def save_report_from_state(user_id: int, message: Message):
    try:
        repo = get_repo()
        telegram_id = str(user_id)
        state_data = ensure_user_state(user_id)
        missing = validate_report_readiness(user_id)
        if missing:
            await _ask_for_missing_fields(user_id, message, None, missing)
            return

        reporter_name = (state_data.get("reporter_name") or "Anonim").strip()
        existing_reporter = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
        
        reporter_phone = state_data.get("reporter_phone") or ""
        if existing_reporter:
            reporter_id = existing_reporter["id"]
            reporter_phone = existing_reporter.get("phone", "") or reporter_phone
        else:
            created = await asyncio.to_thread(repo.create_reporter, {
                "telegram_id": telegram_id,
                "name": reporter_name,
                "phone": reporter_phone
            })
            reporter_id = created["id"] if created else None

        report_model = Report(
            user_id=telegram_id,
            reporter_id=reporter_id,
            reporter_name=reporter_name,
            reporter_phone=reporter_phone,
            kelurahan_id=state_data.get("kelurahan_id"),
            category=state_data.get("category"),
            file_ids=state_data.get("file_ids", []),
            description=state_data.get("description", ""),
            latitude=state_data.get("latitude"),
            longitude=state_data.get("longitude"),
            status="dikirim",
            source="telegram",
            metadata={}
        )

        inserted = await asyncio.to_thread(repo.insert_report, report_model.dict_for_db())
        
        tracking_code = None
        inserted_row = None
        if inserted and isinstance(inserted, list) and len(inserted) > 0:
            tracking_code = inserted[0].get("tracking_code")
            inserted_row = inserted[0]
        elif isinstance(inserted, dict):
            tracking_code = inserted.get("tracking_code")
            inserted_row = inserted

        msg = "✅ Laporan berhasil disimpan ke sistem pusat! Terima kasih."
        if tracking_code:
            msg += f"\n📋 Kode pelacakan Anda: {tracking_code}"
            
        await message.answer(msg)
        
        if inserted_row:
            await _notify_koordinator_for_report(inserted_row)
            
        # Reset state after completion
        if user_id in chat_history:
            del chat_history[user_id]
        if user_id in user_state:
            del user_state[user_id]
        
    except Exception as e:
        logger.exception("Failed to save report from LLM JSON")
        await message.answer("Terjadi kesalahan sistem saat menyimpan laporan. Mohon maaf.")

# ── Handlers ──

@router.message(Command("link"))
async def cmd_link(message: Message):
    token = message.text.split(maxsplit=1)[1] if message.text and " " in message.text else ""
    await _handle_link_token(message, token)

async def _handle_link_token(message: Message, token: str) -> None:
    if not token:
        await message.answer("Gunakan format: /link <kode>\nContoh: /link A1B2C3")
        return

    try:
        repo = get_repo()
        token_hash = _hash_token(token)
        link_token = await asyncio.to_thread(repo.get_link_token, token_hash)
    except Exception:
        logger.exception("Gagal memvalidasi token link")
        await message.answer("Terjadi kesalahan saat memverifikasi token.")
        return

    if not link_token:
        await message.answer("Token tidak valid atau sudah kedaluwarsa.")
        return

    link = {
        "user_id": link_token.get("user_id"),
        "role": link_token.get("role"),
        "kelurahan_id": link_token.get("kelurahan_id"),
        "sector_id": link_token.get("sector_id"),
        "telegram_id": str(message.from_user.id),
        "telegram_username": message.from_user.username,
        "is_active": True,
        "linked_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await asyncio.to_thread(repo.upsert_telegram_link, link)
        await asyncio.to_thread(repo.mark_link_token_used, link_token.get("id"))
        await message.answer("✅ Akun Telegram berhasil dihubungkan.")
    except Exception:
        logger.exception("Gagal menyimpan telegram link")
        await message.answer("Gagal menghubungkan akun. Silakan coba lagi.")


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    args = message.text.split(maxsplit=1)[1] if message.text and " " in message.text else ""
    if args.startswith("link_"):
        token = args.replace("link_", "", 1).strip()
        await _handle_link_token(message, token)
        return

    await state.clear()
    user_id = message.from_user.id
    
    # INTERCEPT: Force phone number for new users
    telegram_id = str(user_id)
    try:
        repo = get_repo()
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
    except:
        existing = None

    if not existing or not existing.get("phone"):
        await state.update_data(
            telegram_id=telegram_id,
            reporter_name=_get_telegram_name(message.from_user),
        )
        from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
        contact_kb = ReplyKeyboardMarkup(
            keyboard=[[KeyboardButton(text="📱 Bagikan Nomor Telepon", request_contact=True)]],
            resize_keyboard=True, one_time_keyboard=True
        )
        await message.answer("Selamat datang di ResikIn! 🙌\n\nUntuk memulai, kami butuh nomor telepon Anda untuk keperluan petugas saat menindaklanjuti laporan.\n\nSilakan ketik nomor telepon Anda secara manual (contoh: 08123456789) ATAU tekan tombol **'📱 Bagikan Nomor Telepon'** di bawah.", reply_markup=contact_kb, parse_mode="Markdown")
        await state.set_state(ReportStates.INPUT_TELEPON)
        return

    chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    user_state[user_id] = _default_user_state(existing)
    
    chat_history[user_id].append({"role": "user", "content": f"Halo, saya {_get_telegram_name(message.from_user)}. Saya ingin melapor masalah sampah."})
    
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    
    try:
        reply = await call_deepseek(user_id)
        await process_llm_response(user_id, message, reply, state)
    except DeepSeekTimeoutError:
        await message.answer("⚠️ Sistem AI kami sedang mengalami gangguan jaringan. Mari kita gunakan mode pelaporan manual.")
        await _force_fallback(message, state)


@router.message(StateFilter(None), F.text)
async def handle_text_llm(message: Message, state: FSMContext):
    user_id = message.from_user.id
    if user_id not in chat_history:
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    state_data = ensure_user_state(user_id)
    if _is_photo_decline_text(message.text):
        state_data["photo_was_asked"] = True
        state_data["photo_declined"] = True

    chat_history[user_id].append({"role": "user", "content": message.text})
    
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    
    try:
        reply = await call_deepseek(user_id)
        await process_llm_response(user_id, message, reply, state)
    except DeepSeekTimeoutError:
        await message.answer("⚠️ Sistem AI cerdas kami gagal memproses setelah 3 kali percobaan. Jangan khawatir, mari alihkan ke form manual.")
        await _force_fallback(message, state)


@router.message(StateFilter(None), F.location)
async def handle_location_llm(message: Message, state: FSMContext):
    user_id = message.from_user.id
    if user_id not in chat_history:
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    state_data = ensure_user_state(user_id)

    lat = message.location.latitude
    lon = message.location.longitude
    state_data["latitude"] = lat
    state_data["longitude"] = lon
    
    # Lakukan Reverse Geocoding secara diam-diam
    import aiohttp
    kelurahan_detected = ""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
            async with session.get(url, headers={'User-Agent': 'ResikinBot/1.0'}, timeout=5) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    addr = data.get("address", {})
                    # Cari nama desa/kelurahan
                    kelurahan_detected = addr.get("village") or addr.get("suburb") or addr.get("town") or ""
    except Exception:
        pass

    if kelurahan_detected:
        system_note = f"[System] Warga telah membagikan lokasi GPS (Lat: {lat}, Lon: {lon}). Berdasarkan GPS, lokasi ini berada di Kelurahan {kelurahan_detected}. Syarat 'Kelurahan' dan 'Lokasi GPS' sudah LENGKAP. JANGAN tanyakan lagi soal kelurahan atau lokasi!"
        state_data["kelurahan_detected"] = kelurahan_detected
        normalized_kelurahan = normalize_kelurahan(kelurahan_detected, state_data)
        if normalized_kelurahan:
            state_data["kelurahan_id"] = normalized_kelurahan
    else:
        system_note = f"[System] Warga telah membagikan lokasi GPS (Lat: {lat}, Lon: {lon}). Syarat 'Lokasi GPS' dan 'Kelurahan' sudah LENGKAP dan TERPENUHI. JANGAN tanyakan lagi soal kelurahan atau lokasi!"
        
    chat_history[user_id].append({"role": "system", "content": system_note})
    
    # Langsung konfirmasi tanpa tanya AI lagi (agar tidak mengulangi "kirim GPS")
    kel_text = f" di Kelurahan {kelurahan_detected}" if kelurahan_detected else ""
    confirm_msg = f"📍 Lokasi GPS{kel_text} sudah diterima, terima kasih! 😊"
    chat_history[user_id].append({"role": "assistant", "content": confirm_msg})
    
    from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
    loc_kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📍 Bagikan Lokasi Saat Ini", request_location=True)]],
        resize_keyboard=True
    )
    await message.answer(confirm_msg, reply_markup=loc_kb)
    
    # Selalu panggil AI setelah konfirmasi GPS agar percakapan lanjut
    chat_history[user_id].append({"role": "system", "content": "[System] Lokasi GPS sudah diterima. Lanjutkan tanya data yang masih kurang, atau keluarkan JSON jika semua data sudah lengkap."})
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    try:
        reply = await call_deepseek(user_id)
        await process_llm_response(user_id, message, reply, state)
    except DeepSeekTimeoutError:
        await message.answer("⚠️ Sistem AI sedang gangguan. Mari beralih ke form manual.", reply_markup=ReplyKeyboardRemove())
        await _force_fallback(message, state)

@router.message(StateFilter(None), F.photo)
async def handle_photo_llm(message: Message, state: FSMContext):
    user_id = message.from_user.id
    if user_id not in chat_history:
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    state_data = ensure_user_state(user_id)

    file_id = message.photo[-1].file_id
    state_data["photo_was_asked"] = True
    
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="upload_photo")
    
    try:
        file_info = await bot.get_file(file_id)
        downloaded_file = await bot.download_file(file_info.file_path)
        file_bytes = downloaded_file.read()
        base64_str = base64.b64encode(file_bytes).decode('utf-8')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                settings.AI_SERVICE_URL,
                json={"image": f"data:image/jpeg;base64,{base64_str}"}
            ) as resp:
                ai_data = await resp.json()
                
        if ai_data.get("success"):
            if ai_data.get("isWaste"):
                cat = ai_data.get("suggested_category")
                state_data["file_ids"].append(file_id)
                state_data["photo_received"] = True
                state_data["photo_validated_as_waste"] = True
                category = normalize_category(cat)
                if category:
                    state_data["suggested_category"] = category
                    state_data["category"] = category
                system_note = f"[System] Warga baru saja mengirim foto BUKTI SAMPAH YANG VALID. Vision AI menyarankan kategori: '{cat}'. Lanjutkan percakapan untuk mengonfirmasi atau menanyakan data lain yang kurang."
            else:
                top_label = ai_data.get("top_label")
                state_data["photo_received"] = False
                state_data["photo_validated_as_waste"] = False
                
                # Tambahkan logika konfirmasi manusia
                builder = InlineKeyboardBuilder()
                builder.button(text="✅ Ya, Tetap Gunakan", callback_data="photo_confirm:yes")
                builder.button(text="❌ Tidak, Kirim Ulang", callback_data="photo_confirm:no")
                
                await message.answer(
                    "⚠️ **Sistem mendeteksi bahwa foto ini kemungkinan bukan sampah.**\n\n"
                    "Apakah Anda yakin foto ini adalah bukti tumpukan sampah yang ingin dilaporkan?",
                    reply_markup=builder.as_markup(),
                    parse_mode="Markdown"
                )
                
                # Set state agar message lain tidak masuk ke LLM dulu sebelum diputuskan
                await state.set_state(ReportStates.KONFIRMASI_FOTO)
                await state.update_data(pending_file_id=file_id, pending_ai_data=ai_data)
                return  # Berhenti di sini, tunggu callback
        else:
            state_data["file_ids"].append(file_id)
            state_data["photo_received"] = True
            system_note = "[System] Warga mengirim foto, namun Vision AI gagal memproses. Anggap saja foto sudah diterima, dan tanyakan data lain yang kurang."
            
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        state_data["file_ids"].append(file_id)
        state_data["photo_received"] = True
        system_note = "[System] Warga mengirim foto. Vision AI sedang offline. Anggap foto diterima, tanyakan data lain yang kurang."

    chat_history[user_id].append({"role": "system", "content": system_note})
    
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    
    try:
        reply = await call_deepseek(user_id)
        await process_llm_response(user_id, message, reply, state)
    except DeepSeekTimeoutError:
        await message.answer("⚠️ Sistem AI gambar kami sedang gangguan. Mari kita gunakan pelaporan manual.")
        await _force_fallback(message, state)


@router.callback_query(StateFilter(ReportStates.KONFIRMASI_FOTO), F.data.startswith("photo_confirm:"))
async def handle_photo_confirmation(call: CallbackQuery, state: FSMContext):
    decision = call.data.split(":", 1)[1] if call.data else ""
    user_id = call.from_user.id
    state_data = ensure_user_state(user_id)
    data = await state.get_data()
    
    file_id = data.get("pending_file_id")
    ai_data = data.get("pending_ai_data") or {}

    if decision == "yes":
        # Manusia memaksa bahwa ini adalah sampah
        state_data["file_ids"].append(file_id)
        state_data["photo_received"] = True
        state_data["photo_validated_as_waste"] = True
        
        system_note = "[System] Warga MENGONFIRMASI bahwa foto tersebut ADALAH SAMPAH (meskipun Vision AI sempat ragu). Terima foto ini sebagai bukti valid. Lanjutkan tanya data yang kurang."
        await call.message.edit_text("✅ Baik, foto telah diterima sebagai bukti. Silakan lanjutkan laporan Anda.")
    else:
        # Manusia setuju ini bukan sampah / ingin kirim ulang
        system_note = "[System] Warga SETUJU bahwa foto tersebut bukan sampah atau memilih untuk mengirim ulang. Tolak foto tersebut dan minta foto tumpukan sampah yang sebenarnya."
        await call.message.edit_text("❌ Foto dibatalkan. Silakan kirimkan foto tumpukan sampah yang ingin dilaporkan.")

    await state.clear() # Kembali ke mode LLM (None state)
    
    # Update LLM history with the human decision
    if user_id not in chat_history:
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    chat_history[user_id].append({"role": "system", "content": system_note})
    
    # Panggil AI untuk merespon keputusan tersebut
    bot = get_bot()
    await bot.send_chat_action(chat_id=call.message.chat.id, action="typing")
    try:
        reply = await call_deepseek(user_id)
        await process_llm_response(user_id, call.message, reply, state)
    except DeepSeekTimeoutError:
        await call.message.answer("⚠️ Terjadi gangguan. Mari gunakan mode manual.")
        await _force_fallback(call.message, state)
    
    await call.answer()


@router.message(StateFilter(ReportStates.KONFIRMASI_FOTO))
async def handle_waiting_for_photo_confirmation(message: Message):
    await message.answer("⚠️ Mohon konfirmasi foto di atas terlebih dahulu dengan menekan tombol yang tersedia sebelum melanjutkan.")


# ── FSM Manual Handlers ──

async def _show_kelurahan_picker(message: Message, state: FSMContext):
    builder = InlineKeyboardBuilder()
    for item in KELURAHAN_OPTIONS:
        builder.button(text=item["name"], callback_data=f"kel:{item['id']}")
    builder.adjust(2)
    kb = builder.as_markup()
    await message.answer("🏘️ [Mode Manual] Silakan pilih kelurahan:", reply_markup=kb)
    await state.set_state(ReportStates.PILIH_KELURAHAN)

@router.message(StateFilter(ReportStates.INPUT_TELEPON), F.contact)
async def handle_contact(message: Message, state: FSMContext):
    phone = message.contact.phone_number
    data = await state.get_data()
    telegram_id = data.get("telegram_id", str(message.from_user.id))
    reporter_name = data.get("reporter_name", _get_telegram_name(message.from_user))

    reporter_model = Reporter(
        telegram_id=telegram_id,
        name=reporter_name,
        phone=phone,
    )
    try:
        repo = get_repo()
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
        if existing:
            reporter_id = existing["id"]
            if not existing.get("phone"):
                await asyncio.to_thread(repo.update_reporter, reporter_id, {"phone": phone})
        else:
            created = await asyncio.to_thread(repo.create_reporter, reporter_model.dict_for_db())
            reporter_id = created["id"] if created else None
    except Exception:
        logger.exception("Gagal menyimpan reporter")
        reporter_id = None

    await state.update_data(
        reporter_id=reporter_id,
        reporter_phone=phone,
    )

    await message.answer(
        f"✅ Terima kasih! Nomor {phone} berhasil diamankan.",
        reply_markup=ReplyKeyboardRemove(),
    )
    # Redirect back to LLM flow by calling cmd_start programmatically
    await cmd_start(message, state)

@router.message(StateFilter(ReportStates.INPUT_TELEPON))
async def handle_phone_text_fallback(message: Message, state: FSMContext):
    phone = re.sub(r"[^\d+]", "", message.text or "")
    if len(phone) < 8:
        await message.answer("⚠️ Nomor telepon belum valid. Contoh format: 08123456789.")
        return

    data = await state.get_data()
    telegram_id = data.get("telegram_id", str(message.from_user.id))
    reporter_name = data.get("reporter_name", _get_telegram_name(message.from_user))
    try:
        repo = get_repo()
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
        if existing:
            reporter_id = existing["id"]
            if not existing.get("phone"):
                await asyncio.to_thread(repo.update_reporter, reporter_id, {"phone": phone})
        else:
            reporter_model = Reporter(telegram_id=telegram_id, name=reporter_name, phone=phone)
            created = await asyncio.to_thread(repo.create_reporter, reporter_model.dict_for_db())
            reporter_id = created["id"] if created else None
    except Exception:
        logger.exception("Gagal menyimpan nomor telepon manual")
        reporter_id = None

    await state.update_data(reporter_id=reporter_id, reporter_phone=phone)
    await message.answer(f"✅ Terima kasih! Nomor {phone} berhasil diamankan.", reply_markup=ReplyKeyboardRemove())
    await cmd_start(message, state)

@router.callback_query(StateFilter(ReportStates.PILIH_KELURAHAN), F.data.startswith("kel:"))
async def handle_kelurahan(call: CallbackQuery, state: FSMContext):
    kelurahan_id = call.data.split(":", 1)[1] if call.data else ""
    await state.update_data(kelurahan_id=kelurahan_id)
    kel_name = get_kelurahan_name(kelurahan_id)

    builder = InlineKeyboardBuilder()
    for cat in CATEGORY_OPTIONS:
        builder.button(text=cat["name"], callback_data=f"cat:{cat['id']}")
    builder.adjust(2)
    kb = builder.as_markup()
    await call.message.answer(
        f"Kelurahan dipilih: {kel_name}.\n\n"
        "📂 Pilih kategori laporan:",
        reply_markup=kb,
    )
    await state.set_state(ReportStates.PILIH_KATEGORI)
    await call.answer()

@router.callback_query(StateFilter(ReportStates.PILIH_KATEGORI), F.data.startswith("cat:"))
async def handle_category(call: CallbackQuery, state: FSMContext):
    category_id = call.data.split(":", 1)[1] if call.data else ""
    await state.update_data(category=category_id)
    cat_name = get_category_name(category_id)
    await call.message.answer(
        f"Kategori: {cat_name}\n\n"
        f"📷 Silakan unggah foto tumpukan sampah (maksimal {MAX_PHOTOS} foto) atau ketik '-' untuk melewati (Opsional)."
    )
    await state.set_state(ReportStates.UPLOAD_FOTO)
    await call.answer()

@router.message(StateFilter(ReportStates.UPLOAD_FOTO), F.text)
async def handle_photo_skip(message: Message, state: FSMContext):
    await state.update_data(file_ids=[])
    await message.answer("✅ Foto dilewati. Silakan ketik deskripsi laporan.")
    await state.set_state(ReportStates.INPUT_DESKRIPSI)

@router.message(StateFilter(ReportStates.UPLOAD_FOTO), F.photo)
async def handle_photo_manual(message: Message, state: FSMContext):
    file_id = message.photo[-1].file_id
    mg_id = message.media_group_id

    if mg_id is None:
        await state.update_data(file_ids=[file_id])
        await message.answer("✅ 1 foto diterima. Silakan ketik deskripsi laporan.")
        await state.set_state(ReportStates.INPUT_DESKRIPSI)
        return

    if mg_id not in _media_group_buffer:
        _media_group_buffer[mg_id] = []

    _media_group_buffer[mg_id].append(file_id)
    _media_group_context[mg_id] = (message, state)

    if mg_id in _media_group_tasks:
        _media_group_tasks[mg_id].cancel()

    async def finalize_group():
        await asyncio.sleep(1.0)
        collected = _media_group_buffer.pop(mg_id, [])
        _media_group_tasks.pop(mg_id, None)
        ctx_msg, ctx_state = _media_group_context.pop(mg_id, (message, state))

        truncated = False
        if len(collected) > MAX_PHOTOS:
            truncated = True
            collected = collected[:MAX_PHOTOS]

        await ctx_state.update_data(file_ids=collected)

        if truncated:
            await ctx_msg.answer(
                f"⚠️ Maksimal {MAX_PHOTOS} foto per laporan. "
                f"Hanya {MAX_PHOTOS} foto pertama yang disimpan."
            )

        await ctx_msg.answer(
            f"✅ {len(collected)} foto diterima. Silakan ketik deskripsi laporan."
        )
        await ctx_state.set_state(ReportStates.INPUT_DESKRIPSI)

    task = asyncio.create_task(finalize_group())
    _media_group_tasks[mg_id] = task

@router.message(StateFilter(ReportStates.INPUT_DESKRIPSI))
async def handle_description(message: Message, state: FSMContext):
    await state.update_data(description=message.text)
    from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
    loc_kb = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📍 Bagikan Lokasi Saat Ini", request_location=True)]],
        resize_keyboard=True
    )
    await message.answer("📍 Lokasi wajib diisi untuk memudahkan petugas! Silakan tekan tombol 'Bagikan Lokasi Saat Ini' di bawah, atau gunakan menu Lampiran (📎) -> Lokasi untuk memilih titik di peta secara manual jika Anda tidak berada di lokasi.", reply_markup=loc_kb)
    await state.set_state(ReportStates.SHARE_LOCATION)

@router.message(StateFilter(ReportStates.SHARE_LOCATION))
async def handle_location(message: Message, state: FSMContext):
    if not message.location:
        await message.answer("⚠️ Laporan tidak bisa dilanjutkan tanpa lokasi. Silakan tekan tombol '📍 Bagikan Lokasi Saat Ini' atau kirimkan via menu Lampiran (📎).")
        return

    data = await state.get_data()
    
    await state.update_data(
        latitude=message.location.latitude,
        longitude=message.location.longitude,
    )
    lat = message.location.latitude
    lon = message.location.longitude

    kelurahan_id = data.get("kelurahan_id", "-")
    kel_name = get_kelurahan_name(kelurahan_id)
    category = data.get("category", "-")
    cat_name = get_category_name(category)
    file_ids = data.get("file_ids", [])
    summary = (
        "📋 Konfirmasi laporan:\n"
        f"- 👤 Nama: {data.get('reporter_name', '-')}\n"
        f"- 📱 Telepon: {data.get('reporter_phone', '-')}\n"
        f"- 🏘️ Kelurahan: {kel_name}\n"
        f"- 📂 Kategori: {cat_name}\n"
        f"- 📷 Jumlah foto: {len(file_ids)}\n"
        f"- 📝 Deskripsi: {data.get('description', '-')}\n"
        f"- 📍 Lokasi: {lat}, {lon}"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Konfirmasi", callback_data="confirm:yes")
    builder.button(text="❌ Batal", callback_data="confirm:no")
    kb = builder.as_markup()
    # Remove the location keyboard before sending the inline keyboard
    from aiogram.types import ReplyKeyboardRemove
    await message.answer("Lokasi diterima.", reply_markup=ReplyKeyboardRemove())
    await message.answer(summary, reply_markup=kb)
    await state.set_state(ReportStates.KONFIRMASI)

@router.callback_query(StateFilter(ReportStates.KONFIRMASI), F.data.startswith("confirm:"))
async def handle_confirm_manual(call: CallbackQuery, state: FSMContext):
    decision = call.data.split(":", 1)[1] if call.data else ""
    if decision != "yes":
        await call.message.answer("Laporan dibatalkan. Ketik /start untuk memulai lagi.")
        await state.clear()
        await call.answer()
        return

    data = await state.get_data()
    report_model = Report(
        user_id=str(call.from_user.id),
        reporter_id=data.get("reporter_id"),
        reporter_name=data.get("reporter_name"),
        reporter_phone=data.get("reporter_phone"),
        kelurahan_id=data.get("kelurahan_id", "unknown"),
        category=data.get("category"),
        file_ids=data.get("file_ids", []),
        description=data.get("description", ""),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        status="dikirim",
        source="telegram",
        metadata={}
    )

    try:
        repo = get_repo()
        inserted = await asyncio.to_thread(repo.insert_report, report_model.dict_for_db())
        inserted_id = None
        tracking_code = None
        inserted_row = None
        if inserted and isinstance(inserted, list) and len(inserted) > 0:
            inserted_id = inserted[0].get("id")
            tracking_code = inserted[0].get("tracking_code")
            inserted_row = inserted[0]
        elif isinstance(inserted, dict):
            inserted_id = inserted.get("id")
            tracking_code = inserted.get("tracking_code")
            inserted_row = inserted

        msg = "✅ Laporan diterima, terima kasih!"
        if tracking_code:
            msg += f"\n📋 Kode tracking: {tracking_code}"
        elif inserted_id:
            msg += f"\n🆔 ID laporan: {inserted_id}"
        await call.message.answer(msg)

        if inserted_row:
            await _notify_koordinator_for_report(inserted_row)
    except Exception:
        logger.exception("Gagal menyimpan laporan")
        await call.message.answer("Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi nanti.")
    finally:
        await state.clear()
        await call.answer()
