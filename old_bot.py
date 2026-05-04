from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandStart, Command, StateFilter
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.utils.keyboard import InlineKeyboardBuilder
from app.config import settings
from domain.models import Report, Reporter
import asyncio
import logging
import hashlib
from datetime import datetime, timezone
from app.kelurahan import KELURAHAN_OPTIONS, get_kelurahan_name
from typing import TYPE_CHECKING, Dict, List

if TYPE_CHECKING:
    from repositories.supabase_repo import SupabaseRepo

logger = logging.getLogger(__name__)

storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()
dp.include_router(router)

_repo = None
_bot = None

# ── Batas maksimal foto per laporan ──
MAX_PHOTOS = 3

# ── Buffer untuk media group (album) ──
# Ketika user mengirim beberapa foto sekaligus, Telegram mengirim
# setiap foto sebagai Message terpisah dengan media_group_id yang sama.
# Kita kumpulkan semua foto dalam buffer, lalu proses setelah timer selesai.
_media_group_buffer: Dict[str, List[str]] = {}
_media_group_tasks: Dict[str, asyncio.Task] = {}
# Simpan referensi ke message & state agar bisa digunakan saat finalize
_media_group_context: Dict[str, tuple] = {}

# ── Kategori laporan (sesuai DB constraint di 001_initial_schema.sql) ──
CATEGORY_OPTIONS = [
    {"id": "tidak_terangkut", "name": "🚛 Tidak Terangkut"},
    {"id": "tps_penuh",       "name": "🗑️ TPS Penuh"},
    {"id": "sampah_liar",     "name": "🏚️ Sampah Liar"},
    {"id": "bau",             "name": "😷 Bau"},
    {"id": "lainnya",         "name": "📋 Lainnya"},
]


def get_category_name(category_id: str) -> str:
    """Get display name for a category ID."""
    return next(
        (c["name"] for c in CATEGORY_OPTIONS if c["id"] == category_id),
        category_id
    )


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
    """Extract full name from Telegram user object."""
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


# ─────────────────────────────────────────────
# /start — Cek apakah reporter sudah terdaftar
# ─────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    args = message.text.split(maxsplit=1)[1] if message.text and " " in message.text else ""
    if args.startswith("link_"):
        token = args.replace("link_", "", 1).strip()
        await _handle_link_token(message, token)
        return

    await state.clear()
    telegram_id = str(message.from_user.id)
    reporter_name = _get_telegram_name(message.from_user)

    # Cek apakah user sudah pernah melapor
    try:
        repo = get_repo()
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
    except Exception:
        logger.exception("Gagal mengecek reporter")
        existing = None

    if existing and existing.get("phone"):
        # ── Reporter lama: langsung ke pilih kelurahan ──
        await state.update_data(
            reporter_id=existing["id"],
            reporter_name=existing.get("name", reporter_name),
            reporter_phone=existing.get("phone", ""),
        )
        await message.answer(
            f"Halo kembali, {existing.get('name', reporter_name)}! 👋\n"
            "Mari buat laporan baru."
        )
        await _show_kelurahan_picker(message, state)
    else:
        # ── Reporter baru: minta nomor telepon dulu ──
        await state.update_data(
            telegram_id=telegram_id,
            reporter_name=reporter_name,
        )
        contact_kb = ReplyKeyboardMarkup(
            keyboard=[[
                KeyboardButton(
                    text="📱 Bagikan Nomor Telepon",
                    request_contact=True,
                )
            ]],
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        await message.answer(
            f"Selamat datang di ResikIn, {reporter_name}! 🙌\n\n"
            "Untuk memulai, kami perlu nomor telepon Anda.\n"
            "Tekan tombol di bawah untuk membagikannya secara otomatis.",
            reply_markup=contact_kb,
        )
        await state.set_state(ReportStates.INPUT_TELEPON)


# ─────────────────────────────────────────────
# INPUT_TELEPON — Terima contact dari user baru
# ─────────────────────────────────────────────
@router.message(StateFilter(ReportStates.INPUT_TELEPON), F.contact)
async def handle_contact(message: Message, state: FSMContext):
    phone = message.contact.phone_number
    data = await state.get_data()
    telegram_id = data.get("telegram_id", str(message.from_user.id))
    reporter_name = data.get("reporter_name", _get_telegram_name(message.from_user))

    # Simpan reporter baru ke database
    reporter_model = Reporter(
        telegram_id=telegram_id,
        name=reporter_name,
        phone=phone,
    )
    try:
        repo = get_repo()
        # Cek dulu apakah sudah ada (mungkin pernah lapor tanpa telepon)
        existing = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
        if existing:
            reporter_id = existing["id"]
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

    # Hapus reply keyboard, lanjut ke pilih kelurahan
    await message.answer(
        f"✅ Terima kasih! Nomor {phone} tersimpan.\n"
        "Anda tidak perlu memberikan nomor lagi di laporan berikutnya.",
        reply_markup=ReplyKeyboardRemove(),
    )
    await _show_kelurahan_picker(message, state)


@router.message(StateFilter(ReportStates.INPUT_TELEPON))
async def handle_phone_text_fallback(message: Message, state: FSMContext):
    """Fallback jika user mengetik teks alih-alih menekan tombol contact."""
    await message.answer(
        "⚠️ Silakan tekan tombol \"📱 Bagikan Nomor Telepon\" di bawah, "
        "bukan mengetik nomor secara manual."
    )


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


# ─────────────────────────────────────────────
# PILIH_KELURAHAN — Inline keyboard kelurahan
# ─────────────────────────────────────────────
async def _show_kelurahan_picker(message: Message, state: FSMContext):
    """Helper: tampilkan pilihan kelurahan."""
    builder = InlineKeyboardBuilder()
    for item in KELURAHAN_OPTIONS:
        builder.button(text=item["name"], callback_data=f"kel:{item['id']}")
    builder.adjust(2)
    kb = builder.as_markup()
    await message.answer("🏘️ Silakan pilih kelurahan:", reply_markup=kb)
    await state.set_state(ReportStates.PILIH_KELURAHAN)


@router.callback_query(StateFilter(ReportStates.PILIH_KELURAHAN), F.data.startswith("kel:"))
async def handle_kelurahan(call: CallbackQuery, state: FSMContext):
    kelurahan_id = call.data.split(":", 1)[1] if call.data else ""
    await state.update_data(kelurahan_id=kelurahan_id)
    kel_name = get_kelurahan_name(kelurahan_id)

    # Tampilkan pilihan kategori
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


# ─────────────────────────────────────────────
# PILIH_KATEGORI — Inline keyboard kategori
# ─────────────────────────────────────────────
@router.callback_query(StateFilter(ReportStates.PILIH_KATEGORI), F.data.startswith("cat:"))
async def handle_category(call: CallbackQuery, state: FSMContext):
    category_id = call.data.split(":", 1)[1] if call.data else ""
    await state.update_data(category=category_id)
    cat_name = get_category_name(category_id)
    await call.message.answer(
        f"Kategori: {cat_name}\n\n"
        f"📷 Silakan unggah foto tumpukan sampah (maksimal {MAX_PHOTOS} foto)."
    )
    await state.set_state(ReportStates.UPLOAD_FOTO)
    await call.answer()


# ─────────────────────────────────────────────
# UPLOAD_FOTO — Terima foto tunggal atau album
# ─────────────────────────────────────────────
@router.message(StateFilter(ReportStates.UPLOAD_FOTO), F.photo)
async def handle_photo(message: Message, state: FSMContext):
    file_id = message.photo[-1].file_id
    mg_id = message.media_group_id  # None jika foto tunggal

    if mg_id is None:
        # ── Foto tunggal: langsung proses ──
        await state.update_data(file_ids=[file_id])
        await message.answer("✅ 1 foto diterima. Silakan ketik deskripsi laporan.")
        await state.set_state(ReportStates.INPUT_DESKRIPSI)
        return

    # ── Media group (album): kumpulkan foto dulu ──
    if mg_id not in _media_group_buffer:
        _media_group_buffer[mg_id] = []

    _media_group_buffer[mg_id].append(file_id)

    # Simpan referensi message & state terbaru untuk finalize
    _media_group_context[mg_id] = (message, state)

    # Batalkan timer sebelumnya (masih menunggu foto berikutnya)
    if mg_id in _media_group_tasks:
        _media_group_tasks[mg_id].cancel()

    # Set timer: setelah 1 detik tidak ada foto baru, anggap selesai
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


# ─────────────────────────────────────────────
# INPUT_DESKRIPSI — Ketik deskripsi laporan
# ─────────────────────────────────────────────
@router.message(StateFilter(ReportStates.INPUT_DESKRIPSI))
async def handle_description(message: Message, state: FSMContext):
    await state.update_data(description=message.text)
    await message.answer("📍 Silakan bagikan lokasi (share location).")
    await state.set_state(ReportStates.SHARE_LOCATION)


# ─────────────────────────────────────────────
# SHARE_LOCATION — Terima lokasi user
# ─────────────────────────────────────────────
@router.message(StateFilter(ReportStates.SHARE_LOCATION), F.location)
async def handle_location(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.update_data(
        latitude=message.location.latitude,
        longitude=message.location.longitude,
    )
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
        f"- 📍 Lokasi: {message.location.latitude}, {message.location.longitude}"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Konfirmasi", callback_data="confirm:yes")
    builder.button(text="❌ Batal", callback_data="confirm:no")
    kb = builder.as_markup()
    await message.answer(summary, reply_markup=kb)
    await state.set_state(ReportStates.KONFIRMASI)


# ─────────────────────────────────────────────
# KONFIRMASI — Simpan laporan ke database
# ─────────────────────────────────────────────
@router.callback_query(StateFilter(ReportStates.KONFIRMASI), F.data.startswith("confirm:"))
async def handle_confirm(call: CallbackQuery, state: FSMContext):
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
