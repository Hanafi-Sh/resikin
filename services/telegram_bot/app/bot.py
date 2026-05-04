from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from app.config import settings
from domain.models import Report, Reporter
import asyncio
import logging
import hashlib
import json
import base64
import aiohttp
from datetime import datetime, timezone
from app.kelurahan import KELURAHAN_OPTIONS, get_kelurahan_name
from typing import TYPE_CHECKING, Dict, List
from openai import AsyncOpenAI

if TYPE_CHECKING:
    from repositories.supabase_repo import SupabaseRepo

logger = logging.getLogger(__name__)

dp = Dispatcher()
router = Router()
dp.include_router(router)

_repo = None
_bot = None

deepseek_client = AsyncOpenAI(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com/v1"
)

chat_history: Dict[int, List[dict]] = {}
user_state: Dict[int, dict] = {} 

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

SYSTEM_PROMPT = """Kamu adalah Asisten ResikIn, bot pelaporan sampah di Yogyakarta.
Tugas utamamu adalah mengumpulkan laporan masalah sampah dari warga melalui percakapan alami yang santai.
Kumpulkan 4 informasi ini:
1. Nama Pelapor
2. Kelurahan (harus dicocokkan dengan salah satu dari 45 kelurahan di Kota Yogyakarta).
3. Deskripsi Masalah (apa yang terjadi, misalnya bau, menumpuk, dll).
4. Foto Bukti (Sistem akan menyisipkan hasil foto warga ke dalam obrolan jika warga sudah mengirim foto).

Sapa warga dengan ramah. Tanyakan informasi yang kurang. JANGAN meminta semua data sekaligus seperti robot form, tanyakan perlahan.
Jika warga sudah memberikan foto, [System] akan memberikan info dari Vision AI. Jika Vision AI bilang itu bukan sampah (spam), tegur warga dengan sopan dan minta foto sampah yang asli.

JIKA SEMUA DATA SUDAH LENGKAP (Nama, Kelurahan, Deskripsi, Foto tervalidasi AI), berikan respons JSON rahasia di akhir pesanmu dengan format PERSIS seperti ini (dalam blok code json):

```json
{
  "status": "complete",
  "data": {
    "reporter_name": "nama lengkap warga",
    "kelurahan_id": "nama kelurahan dalam huruf kecil (contoh: wirobrajan, ngupasan)",
    "description": "deskripsi detail",
    "suggested_category": "kategori dari AI (tps_penuh, sampah_liar, tidak_terangkut, bau, lainnya)"
  }
}
```

Hanya keluarkan JSON jika datanya 100% lengkap! Jika belum lengkap, cukup balas dengan teks percakapan biasa tanpa JSON.
"""

async def process_llm_response(user_id: int, message: Message, reply_text: str):
    import re
    # Check for JSON block
    match = re.search(r'```json\n(.*?)\n```', reply_text, re.DOTALL)
    if match:
        json_str = match.group(1)
        try:
            data = json.loads(json_str)
            if data.get("status") == "complete":
                # Extract conversational text (everything before the json block)
                text_part = reply_text[:match.start()].strip()
                if text_part:
                    await message.answer(text_part)
                else:
                    await message.answer("Laporan Anda sudah lengkap, sedang kami proses...")
                
                # Save to database
                await save_report(user_id, data["data"], message)
                return
        except Exception as e:
            logger.error(f"Failed to parse JSON from LLM: {e}")
    
    # If no valid JSON or not complete, just send the reply
    await message.answer(reply_text)

async def save_report(user_id: int, data: dict, message: Message):
    try:
        repo = get_repo()
        telegram_id = str(user_id)
        
        # Ensure reporter exists
        reporter_name = data.get("reporter_name", "Anonim")
        existing_reporter = await asyncio.to_thread(repo.find_reporter_by_telegram_id, telegram_id)
        if existing_reporter:
            reporter_id = existing_reporter["id"]
        else:
            created = await asyncio.to_thread(repo.create_reporter, {
                "telegram_id": telegram_id,
                "name": reporter_name,
                "phone": ""
            })
            reporter_id = created["id"] if created else None

        # Create report
        report_model = Report(
            user_id=telegram_id,
            reporter_id=reporter_id,
            reporter_name=reporter_name,
            reporter_phone="",
            kelurahan_id=data.get("kelurahan_id", "unknown"),
            category=data.get("suggested_category", "lainnya"),
            file_ids=user_state.get(user_id, {}).get("file_ids", []),
            description=data.get("description", ""),
            latitude=None,
            longitude=None,
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
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
        user_state[user_id] = {"file_ids": [], "suggested_category": None}
        
    except Exception as e:
        logger.exception("Failed to save report from LLM JSON")
        await message.answer("Terjadi kesalahan sistem saat menyimpan laporan. Mohon maaf.")

async def call_deepseek(user_id: int) -> str:
    try:
        response = await deepseek_client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=chat_history[user_id],
            max_tokens=800,
            temperature=0.5
        )
        reply = response.choices[0].message.content
        chat_history[user_id].append({"role": "assistant", "content": reply})
        return reply
    except Exception as e:
        logger.error(f"DeepSeek API Error: {e}")
        return "Maaf, sistem AI sedang beristirahat. Silakan coba sebentar lagi ya."

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
async def cmd_start(message: Message):
    args = message.text.split(maxsplit=1)[1] if message.text and " " in message.text else ""
    if args.startswith("link_"):
        token = args.replace("link_", "", 1).strip()
        await _handle_link_token(message, token)
        return

    user_id = message.from_user.id
    chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
    user_state[user_id] = {"file_ids": [], "suggested_category": None}
    
    # Seed the chat with user's opening intent
    chat_history[user_id].append({"role": "user", "content": f"Halo, saya {_get_telegram_name(message.from_user)}. Saya ingin melapor masalah sampah."})
    
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    
    reply = await call_deepseek(user_id)
    await process_llm_response(user_id, message, reply)

@router.message(Command("link"))
async def cmd_link(message: Message):
    token = message.text.split(maxsplit=1)[1] if message.text and " " in message.text else ""
    await _handle_link_token(message, token)

@router.message(F.text)
async def handle_text(message: Message):
    user_id = message.from_user.id
    if user_id not in chat_history:
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
        user_state[user_id] = {"file_ids": [], "suggested_category": None}
        
    chat_history[user_id].append({"role": "user", "content": message.text})
    
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    
    reply = await call_deepseek(user_id)
    await process_llm_response(user_id, message, reply)

@router.message(F.photo)
async def handle_photo(message: Message):
    user_id = message.from_user.id
    if user_id not in chat_history:
        chat_history[user_id] = [{"role": "system", "content": SYSTEM_PROMPT}]
        user_state[user_id] = {"file_ids": [], "suggested_category": None}
        
    file_id = message.photo[-1].file_id
    user_state[user_id]["file_ids"].append(file_id)
    
    bot = get_bot()
    await bot.send_chat_action(chat_id=message.chat.id, action="upload_photo")
    
    # Download and validate image
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
                user_state[user_id]["suggested_category"] = cat
                system_note = f"[System] Warga baru saja mengirim foto BUKTI SAMPAH YANG VALID. Vision AI menyarankan kategori: '{cat}'. Lanjutkan percakapan untuk mengonfirmasi atau menanyakan data lain yang kurang."
            else:
                top_label = ai_data.get("top_label")
                system_note = f"[System] Warga baru saja mengirim foto, TETAPI Vision AI mendeteksi itu BUKAN SAMPAH (spam/terdeteksi sebagai '{top_label}'). Tolak foto ini dengan sopan dan minta foto tumpukan sampah yang sebenarnya."
        else:
            system_note = "[System] Warga mengirim foto, namun Vision AI gagal memproses. Anggap saja foto sudah diterima, dan tanyakan data lain yang kurang."
            
    except Exception as e:
        logger.error(f"Image validation error: {e}")
        system_note = "[System] Warga mengirim foto. Vision AI sedang offline. Anggap foto diterima, tanyakan data lain yang kurang."

    chat_history[user_id].append({"role": "system", "content": system_note})
    
    await bot.send_chat_action(chat_id=message.chat.id, action="typing")
    reply = await call_deepseek(user_id)
    await process_llm_response(user_id, message, reply)
