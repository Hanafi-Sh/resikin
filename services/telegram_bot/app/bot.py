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
import base64
import aiohttp
import re
import time
from datetime import datetime, timezone
from app.kelurahan import KELURAHAN_OPTIONS, get_kelurahan_name
from domain.report_draft import (
    CATEGORY_OPTIONS,
    KELURAHAN_ID_BY_KEY,
    VALID_CATEGORY_IDS,
    default_user_state,
    ensure_user_state,
    get_category_name,
    is_photo_decline_text,
    mark_photo_asked_from_text,
    missing_field_prompt,
    normalize_category,
    normalize_lookup_key,
    user_state,
)
from typing import TYPE_CHECKING, Dict, List, Any, Optional

if TYPE_CHECKING:
    from repositories.supabase_repo import SupabaseRepo

logger = logging.getLogger(__name__)

storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()
dp.include_router(router)

_repo = None
_bot = None

MAIN_MENU_REPORT_TEXT = "📝 Saya mau lapor"
MAIN_MENU_MESSAGE = (
    "Selamat datang di ResikIn! 🙌\n\n"
    "Saya bisa membantu Anda membuat laporan masalah sampah di Kota Yogyakarta. "
    "Tekan tombol di bawah saat Anda ingin mulai melapor."
)


def main_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=MAIN_MENU_REPORT_TEXT)]],
        resize_keyboard=True,
        one_time_keyboard=False,
    )


def contact_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Bagikan Nomor Telepon", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def is_report_button_text(text: Optional[str]) -> bool:
    normalized = (text or "").strip().lower()
    return normalized in {
        MAIN_MENU_REPORT_TEXT.lower(),
        "saya mau lapor",
        "mau lapor",
        "lapor",
    }


def has_active_report_memory(user_id: int) -> bool:
    return user_id in user_state


async def answer_idle_report_prompt(message: Message):
    await message.answer(
        "Untuk membuat laporan baru, tekan tombol di bawah terlebih dahulu.",
        reply_markup=main_menu_kb(),
    )


def is_entrypoint_message(event: TelegramObject) -> bool:
    if not isinstance(event, Message):
        return False
    text = (event.text or "").strip()
    return text.startswith("/start") or is_report_button_text(text)


class AntiSpamMiddleware(BaseMiddleware):
    def __init__(self):
        super().__init__()
        self.last_msg_time = {}
        self.max_chars_per_msg = 2000

    async def __call__(self, handler, event: TelegramObject, data: Dict[str, Any]):
        if getattr(event, "from_user", None) is None:
            return await handler(event, data)
        
        user_id = event.from_user.id
        now_ts = datetime.now(timezone.utc).timestamp()

        is_entrypoint = is_entrypoint_message(event)

        # 1. Cooldown 2 seconds. Entrypoint actions must stay responsive because
        # users often press Telegram's Start and the report button back-to-back.
        last_time = self.last_msg_time.get(user_id, 0)
        if not is_entrypoint and now_ts - last_time < 2.0:
            return # Ignore flood

        if not is_entrypoint:
            self.last_msg_time[user_id] = now_ts

        text_length = 0
        if isinstance(event, Message):
            if event.text: text_length += len(event.text)
            if event.caption: text_length += len(event.caption)

            if text_length > self.max_chars_per_msg:
                await event.answer("⚠️ Pesan terlalu panjang (Maks 2000 karakter).")
                return

        return await handler(event, data)

router.message.middleware(AntiSpamMiddleware())

# ── FSM Helpers ──
async def _start_manual_report_flow(message: Message, state: FSMContext, existing: Optional[dict] = None):
    user_id = message.from_user.id
    telegram_id = str(user_id)

    await state.clear()
    user_state[user_id] = _default_user_state(existing)
    await state.update_data(
        telegram_id=telegram_id,
        reporter_id=(existing or {}).get("id"),
        reporter_name=(existing or {}).get("name") or _get_telegram_name(message.from_user),
        reporter_phone=(existing or {}).get("phone") or "",
    )
    await _show_kelurahan_picker(message, state)


MAX_PHOTOS = 3
_media_group_buffer: Dict[str, List[str]] = {}
_media_group_tasks: Dict[str, asyncio.Task] = {}
_media_group_context: Dict[str, tuple] = {}

_default_user_state = default_user_state
_normalize_lookup_key = normalize_lookup_key
_is_photo_decline_text = is_photo_decline_text
_mark_photo_asked_from_text = mark_photo_asked_from_text
_missing_field_prompt = missing_field_prompt


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
    INPUT_DESKRIPSI = State()
    SHARE_LOCATION = State()
    KONFIRMASI = State()


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
    user_state.pop(user_id, None)
    await message.answer(MAIN_MENU_MESSAGE, reply_markup=main_menu_kb())


async def _begin_report_flow(message: Message, state: FSMContext):
    started_at = time.perf_counter()
    user_id = message.from_user.id
    current_state = await state.get_state()
    if current_state or has_active_report_memory(user_id):
        await message.answer(
            "Laporan Anda masih berjalan. Silakan lanjutkan dengan mengirim data yang diminta, atau ketik /start untuk membatalkan dan kembali ke menu awal.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await state.clear()
    telegram_id = str(user_id)
    lookup_started_at = time.perf_counter()
    try:
        repo = get_repo()
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
    except:
        existing = None
    logger.info(
        "Report start reporter lookup finished for user=%s in %.3fs",
        user_id,
        time.perf_counter() - lookup_started_at,
    )

    if not existing or not existing.get("phone"):
        await state.update_data(
            telegram_id=telegram_id,
            reporter_name=_get_telegram_name(message.from_user),
        )
        await message.answer("Sebelum membuat laporan, kami butuh nomor telepon Anda untuk keperluan petugas saat menindaklanjuti laporan.\n\nSilakan ketik nomor telepon Anda secara manual (contoh: 08123456789) ATAU tekan tombol **'📱 Bagikan Nomor Telepon'** di bawah.", reply_markup=contact_kb(), parse_mode="Markdown")
        await state.set_state(ReportStates.INPUT_TELEPON)
        logger.info(
            "Report start phone prompt sent for new user=%s in %.3fs total",
            user_id,
            time.perf_counter() - started_at,
        )
        return

    await _start_manual_report_flow(message, state, existing)


@router.message(F.text.func(is_report_button_text))
async def handle_report_button(message: Message, state: FSMContext):
    await _begin_report_flow(message, state)


@router.message(StateFilter(None), F.text | F.location | F.photo)
async def handle_idle_report_input(message: Message, state: FSMContext):
    await answer_idle_report_prompt(message)


# ── FSM Manual Handlers ──

async def _show_kelurahan_picker(message: Message, state: FSMContext):
    builder = InlineKeyboardBuilder()
    for item in KELURAHAN_OPTIONS:
        builder.button(text=item["name"], callback_data=f"kel:{item['id']}")
    builder.adjust(2)
    kb = builder.as_markup()
    await message.answer("🏘️ [Mode Manual] Silakan pilih kelurahan:", reply_markup=kb)
    await state.set_state(ReportStates.PILIH_KELURAHAN)


async def validate_telegram_photo(file_id: str, chat_id: int) -> dict:
    try:
        bot = get_bot()
        await bot.send_chat_action(chat_id=chat_id, action="upload_photo")
        file_info = await bot.get_file(file_id)
        downloaded_file = await bot.download_file(file_info.file_path)
        file_bytes = downloaded_file.read()
        base64_str = base64.b64encode(file_bytes).decode("utf-8")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                settings.AI_SERVICE_URL,
                json={"image": f"data:image/jpeg;base64,{base64_str}"},
            ) as resp:
                ai_data = await resp.json()

        if not ai_data.get("success"):
            logger.warning("Photo validation returned unsuccessful response for file_id=%s", file_id)
            return {"accepted": True, "fallback": True, "ai_data": ai_data}

        if ai_data.get("isWaste"):
            return {
                "accepted": True,
                "fallback": False,
                "ai_data": ai_data,
                "suggested_category": normalize_category(ai_data.get("suggested_category")),
            }

        return {
            "accepted": False,
            "fallback": False,
            "ai_data": ai_data,
            "top_label": ai_data.get("top_label"),
        }
    except Exception as exc:
        logger.error("Image validation error for file_id=%s: %s", file_id, exc)
        return {"accepted": True, "fallback": True, "ai_data": {}}


async def _collect_valid_photo_ids(file_ids: List[str], message: Message, state: FSMContext) -> tuple[List[str], int, bool, Optional[str]]:
    accepted_ids: List[str] = []
    rejected_count = 0
    used_fallback = False
    suggested_category = None

    for file_id in file_ids:
        result = await validate_telegram_photo(file_id, message.chat.id)
        if result.get("accepted"):
            accepted_ids.append(file_id)
            used_fallback = used_fallback or bool(result.get("fallback"))
            suggested_category = suggested_category or result.get("suggested_category")
        else:
            rejected_count += 1
            logger.info(
                "Photo rejected by validation for user=%s file_id=%s top_label=%s",
                message.from_user.id,
                file_id,
                result.get("top_label"),
            )

    accepted_ids = accepted_ids[:MAX_PHOTOS]
    state_data = await state.get_data()
    existing_ids = list(state_data.get("file_ids") or [])
    combined_ids = (existing_ids + accepted_ids)[:MAX_PHOTOS]

    update = {
        "file_ids": combined_ids,
        "photo_was_asked": True,
        "photo_received": bool(combined_ids),
        "photo_declined": False,
        "photo_validated_as_waste": bool(combined_ids) and not used_fallback,
    }
    if suggested_category:
        update["suggested_category"] = suggested_category

    await state.update_data(**update)

    draft = ensure_user_state(message.from_user.id)
    draft.update(update)

    return accepted_ids, rejected_count, used_fallback, suggested_category

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
    await _start_manual_report_flow(
        message,
        state,
        {"id": reporter_id, "name": reporter_name, "phone": phone},
    )

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
    await _start_manual_report_flow(
        message,
        state,
        {"id": reporter_id, "name": reporter_name, "phone": phone},
    )

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
    if not _is_photo_decline_text(message.text):
        await message.answer(
            f"Silakan unggah foto tumpukan sampah (maksimal {MAX_PHOTOS} foto), atau ketik '-' untuk melewati foto."
        )
        return

    await state.update_data(
        file_ids=[],
        photo_was_asked=True,
        photo_received=False,
        photo_declined=True,
        photo_validated_as_waste=False,
    )
    draft = ensure_user_state(message.from_user.id)
    draft.update({
        "file_ids": [],
        "photo_was_asked": True,
        "photo_received": False,
        "photo_declined": True,
        "photo_validated_as_waste": False,
    })
    await message.answer("✅ Foto dilewati. Silakan ketik deskripsi laporan.")
    await state.set_state(ReportStates.INPUT_DESKRIPSI)

@router.message(StateFilter(ReportStates.UPLOAD_FOTO), F.photo)
async def handle_photo_manual(message: Message, state: FSMContext):
    file_id = message.photo[-1].file_id
    mg_id = message.media_group_id

    if mg_id is None:
        accepted_ids, rejected_count, used_fallback, _ = await _collect_valid_photo_ids([file_id], message, state)
        if not accepted_ids:
            await message.answer(
                "Foto belum terdeteksi sebagai bukti sampah. Silakan kirim foto tumpukan sampah yang lebih jelas, atau ketik '-' untuk melewati foto."
            )
            return

        suffix = " Sistem validasi foto sedang tidak tersedia, jadi foto tetap diterima." if used_fallback else ""
        await message.answer(f"✅ 1 foto diterima.{suffix} Silakan ketik deskripsi laporan.")
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

        accepted_ids, rejected_count, used_fallback, _ = await _collect_valid_photo_ids(collected, ctx_msg, ctx_state)

        if not accepted_ids:
            await ctx_msg.answer(
                "Foto belum terdeteksi sebagai bukti sampah. Silakan kirim foto tumpukan sampah yang lebih jelas, atau ketik '-' untuk melewati foto."
            )
            return

        if truncated:
            await ctx_msg.answer(
                f"⚠️ Maksimal {MAX_PHOTOS} foto per laporan. "
                f"Hanya {MAX_PHOTOS} foto pertama yang disimpan."
            )
        if rejected_count:
            await ctx_msg.answer(
                f"{rejected_count} foto belum terdeteksi sebagai bukti sampah dan tidak disimpan."
            )

        suffix = " Sistem validasi foto sedang tidak tersedia untuk sebagian foto, jadi foto tersebut tetap diterima." if used_fallback else ""
        await ctx_msg.answer(
            f"✅ {len(accepted_ids)} foto diterima.{suffix} Silakan ketik deskripsi laporan."
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
        await call.message.answer("Laporan dibatalkan. Tekan tombol di bawah jika ingin membuat laporan baru.", reply_markup=main_menu_kb())
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
        await call.message.answer(msg, reply_markup=main_menu_kb())

        if inserted_row:
            await _notify_koordinator_for_report(inserted_row)
    except Exception:
        logger.exception("Gagal menyimpan laporan")
        await call.message.answer("Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi nanti.")
    finally:
        await state.clear()
        await call.answer()
