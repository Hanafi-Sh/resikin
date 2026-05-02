from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
import asyncio
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from app.config import settings
from app.bot import get_bot
from app.kelurahan import get_kelurahan_name

router = APIRouter()


def _format_report_message(report: dict, title: str) -> str:
    tracking = report.get("tracking_code") or "-"
    kelurahan_id = report.get("kelurahan_id") or "-"
    kel_name = get_kelurahan_name(kelurahan_id)
    category = report.get("category") or "-"
    description = report.get("description") or "-"
    return (
        f"{title}\n"
        f"- Kode: {tracking}\n"
        f"- Kelurahan: {kel_name}\n"
        f"- Kategori: {category}\n"
        f"- Deskripsi: {description}"
    )


async def _send_messages(telegram_ids: List[str], text: str, reply_markup: Optional[InlineKeyboardMarkup] = None) -> int:
    bot = get_bot()
    tasks = []
    for telegram_id in telegram_ids:
        try:
            chat_id = int(telegram_id)
        except Exception:
            chat_id = telegram_id
        tasks.append(bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_markup))
    if not tasks:
        return 0
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return sum(1 for r in results if not isinstance(r, Exception))


@router.post("/notifications/report")
async def notify_report(payload: dict, x_resikin_secret: Optional[str] = Header(None)):
    if settings.NOTIFY_WEBHOOK_SECRET and x_resikin_secret != settings.NOTIFY_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    event = payload.get("event")
    report_id = payload.get("report_id")
    if not event or not report_id:
        raise HTTPException(status_code=400, detail="Missing event or report_id")

    from repositories.supabase_repo import SupabaseRepo
    repo = SupabaseRepo()
    report = repo.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    markup = None
    if event == "created":
        links = repo.get_telegram_links_by_kelurahan(report.get("kelurahan_id"), "koordinator")
        telegram_ids = [l.get("telegram_id") for l in links if l.get("telegram_id")]
        text = _format_report_message(report, "📣 LAPORAN BARU MASUK!\nSegera verifikasi laporan warga berikut:")
        
        # Tambahkan tombol link ke dashboard koordinator
        btn = InlineKeyboardButton(
            text="Lihat & Verifikasi Laporan", 
            url=f"http://127.0.0.1:3000/dashboard/laporan/{report_id}"
        )
        markup = InlineKeyboardMarkup(inline_keyboard=[[btn]])
        
    elif event == "assigned":
        petugas_id = payload.get("petugas_id")
        if not petugas_id:
            return {"sent": 0, "reason": "missing_petugas_id"}
        # Cari telegram_id dari petugas yang di-assign berdasarkan user_id
        link = repo.get_telegram_link_by_user_id(petugas_id, "petugas")
        if not link or not link.get("telegram_id"):
            return {"sent": 0, "reason": "petugas_telegram_not_linked"}
        telegram_ids = [link.get("telegram_id")]
        text = _format_report_message(report, "📋 TUGAS BARU UNTUK ANDA!\nAnda telah ditugaskan untuk menangani laporan sampah berikut:")
        
        # Tambahkan tombol link ke dashboard petugas
        btn = InlineKeyboardButton(
            text="Buka Daftar Tugas", 
            url="http://127.0.0.1:3000/petugas"
        )
        markup = InlineKeyboardMarkup(inline_keyboard=[[btn]])
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported event")

    sent = await _send_messages(telegram_ids, text, reply_markup=markup)
    return {"sent": sent, "recipients": len(telegram_ids)}
