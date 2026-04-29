from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandStart, StateFilter
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.context import FSMContext
from aiogram.types import Message, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from app.config import settings
from domain.models import Report
import asyncio
from app.kelurahan import KELURAHAN_OPTIONS, get_kelurahan_name
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from repositories.supabase_repo import SupabaseRepo

storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()
dp.include_router(router)

_repo = None
_bot = None


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


class ReportStates(StatesGroup):
    PILIH_KELURAHAN = State()
    UPLOAD_FOTO = State()
    INPUT_DESKRIPSI = State()
    SHARE_LOCATION = State()
    KONFIRMASI = State()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    builder = InlineKeyboardBuilder()
    for item in KELURAHAN_OPTIONS:
        builder.button(text=item["name"], callback_data=f"kel:{item['id']}")
    builder.adjust(2)
    kb = builder.as_markup()
    await message.answer("Selamat datang. Silakan pilih kelurahan:", reply_markup=kb)
    await state.set_state(ReportStates.PILIH_KELURAHAN)


@router.callback_query(StateFilter(ReportStates.PILIH_KELURAHAN), F.data.startswith("kel:"))
async def handle_kelurahan(call: CallbackQuery, state: FSMContext):
    kelurahan_id = call.data.split(":", 1)[1] if call.data else ""
    await state.update_data(kelurahan_id=kelurahan_id)
    kel_name = get_kelurahan_name(kelurahan_id)
    await call.message.answer(f"Kelurahan dipilih: {kel_name}. Silakan unggah foto tumpukan sampah.")
    await state.set_state(ReportStates.UPLOAD_FOTO)
    await call.answer()


@router.message(StateFilter(ReportStates.UPLOAD_FOTO), F.photo)
async def handle_photo(message: Message, state: FSMContext):
    file_id = message.photo[-1].file_id
    await state.update_data(file_id=file_id)
    await message.answer("Foto diterima. Silakan ketik deskripsi laporan.")
    await state.set_state(ReportStates.INPUT_DESKRIPSI)


@router.message(StateFilter(ReportStates.INPUT_DESKRIPSI))
async def handle_description(message: Message, state: FSMContext):
    await state.update_data(description=message.text)
    await message.answer("Silakan bagikan lokasi (share location).")
    await state.set_state(ReportStates.SHARE_LOCATION)


@router.message(StateFilter(ReportStates.SHARE_LOCATION), F.location)
async def handle_location(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.update_data(
        latitude=message.location.latitude,
        longitude=message.location.longitude,
    )
    kelurahan_id = data.get("kelurahan_id", "-")
    kel_name = get_kelurahan_name(kelurahan_id)
    summary = (
        "Konfirmasi laporan:\n"
        f"- Kelurahan: {kel_name}\n"
        f"- Deskripsi: {data.get('description', '-') }\n"
        f"- Lokasi: {message.location.latitude}, {message.location.longitude}"
    )
    builder = InlineKeyboardBuilder()
    builder.button(text="Konfirmasi", callback_data="confirm:yes")
    builder.button(text="Batal", callback_data="confirm:no")
    kb = builder.as_markup()
    await message.answer(summary, reply_markup=kb)
    await state.set_state(ReportStates.KONFIRMASI)


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
        kelurahan_id=data.get("kelurahan_id", "unknown"),
        file_id=data.get("file_id"),
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
        if inserted and isinstance(inserted, list) and len(inserted) > 0:
            inserted_id = inserted[0].get("id")
            tracking_code = inserted[0].get("tracking_code")
        elif isinstance(inserted, dict):
            inserted_id = inserted.get("id")
            tracking_code = inserted.get("tracking_code")

        msg = "✅ Laporan diterima, terima kasih!"
        if tracking_code:
            msg += f"\n📋 Kode tracking: {tracking_code}"
        elif inserted_id:
            msg += f"\n🆔 ID laporan: {inserted_id}"
        await call.message.answer(msg)
    except Exception:
        await call.message.answer("Terjadi kesalahan saat menyimpan laporan. Silakan coba lagi nanti.")
    finally:
        await state.clear()
        await call.answer()

