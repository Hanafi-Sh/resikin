from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
import asyncio
import logging
from urllib.parse import quote
from urllib.parse import urlparse
from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from app.config import settings
from app.kelurahan import get_kelurahan_name
from app.notification_contract import (
    REPORT_ASSIGNED,
    REPORT_CREATED,
    REPORT_STATUS_CHANGED,
    validate_report_notification_payload,
)

router = APIRouter()
logger = logging.getLogger(__name__)
_notification_bot: Optional[Bot] = None


def get_bot() -> Bot:
    """Return a Bot instance owned by the FastAPI notification runtime."""
    global _notification_bot
    if _notification_bot is None:
        _notification_bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    return _notification_bot


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


STATUS_LABELS = {
    "dikirim": "Dikirim",
    "diterima": "Diterima",
    "ditugaskan": "Ditugaskan",
    "dalam_proses": "Dalam Proses",
    "selesai": "Selesai",
    "ditolak": "Ditolak",
}


def _public_app_url(path: str) -> Optional[str]:
    base_url = (settings.APP_BASE_URL or "").rstrip("/")
    parsed = urlparse(base_url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"}:
        return None
    if hostname in {"localhost", "127.0.0.1", "0.0.0.0"} or hostname.endswith(".local"):
        return None
    return f"{base_url}{path}"


STATUS_MESSAGES = {
    "diterima": "Laporan Anda sudah diterima oleh koordinator dan akan segera ditugaskan kepada petugas.",
    "ditugaskan": "Petugas telah ditunjuk untuk menangani laporan Anda. Mohon tunggu pengerjaannya.",
    "dalam_proses": "Laporan Anda sedang dalam pengerjaan oleh petugas di lapangan.",
    "selesai": "Laporan Anda telah selesai ditangani. Terima kasih telah membantu menjaga kebersihan!",
    "ditolak": "Mohon maaf, laporan Anda tidak dapat kami proses saat ini.",
}


def _format_status_message(report: dict, new_status: str) -> str:
    tracking = report.get("tracking_code") or "-"
    
    # Pesan pembuka spesifik sesuai status
    intro = STATUS_MESSAGES.get(new_status, f"Status laporan Anda telah diperbarui menjadi: {new_status}")

    msg = f"✨ {intro}\n\n"
    msg += f"📍 Kode Laporan: {tracking}"
    
    if new_status == "ditolak" and report.get("reject_reason"):
        msg += f"\n⚠️ Alasan: {report.get('reject_reason')}"
        
    return msg


def _get_reporter_telegram_id(repo, report: dict) -> Optional[str]:
    reporter_id = report.get("reporter_id")
    if reporter_id:
        reporter = repo.get_reporter_by_id(reporter_id)
        if reporter and reporter.get("telegram_id"):
            return reporter.get("telegram_id")
    return report.get("user_id")


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
    for telegram_id, result in zip(telegram_ids, results):
        if isinstance(result, Exception):
            logger.warning("Failed to send Telegram notification to %s: %s", telegram_id, result)
    return sum(1 for r in results if not isinstance(r, Exception))


@router.post("/notifications/report")
async def notify_report(payload: dict, x_resikin_secret: Optional[str] = Header(None)):
    if settings.NOTIFY_WEBHOOK_SECRET and x_resikin_secret != settings.NOTIFY_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = validate_report_notification_payload(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    event = payload["event"]
    report_id = payload["report_id"]

    from repositories.supabase_repo import SupabaseRepo
    repo = SupabaseRepo()
    report = repo.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    markup = None
    if event == REPORT_CREATED:
        links = repo.get_telegram_links_by_kelurahan(report.get("kelurahan_id"), "koordinator")
        telegram_ids = [l.get("telegram_id") for l in links if l.get("telegram_id")]
        text = _format_report_message(report, "📣 LAPORAN BARU MASUK!\nSegera verifikasi laporan warga berikut:")
        
        # Tambahkan tombol link ke dashboard koordinator
        url = _public_app_url(f"/dashboard/laporan/{report_id}")
        if url:
            btn = InlineKeyboardButton(
                text="Lihat & Verifikasi Laporan",
                url=url,
            )
            markup = InlineKeyboardMarkup(inline_keyboard=[[btn]])
        
    elif event == REPORT_ASSIGNED:
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
        url = _public_app_url("/petugas")
        if url:
            btn = InlineKeyboardButton(
                text="Buka Daftar Tugas",
                url=url,
            )
            markup = InlineKeyboardMarkup(inline_keyboard=[[btn]])

    elif event == REPORT_STATUS_CHANGED:
        new_status = payload.get("new_status") or report.get("status")
        telegram_id = _get_reporter_telegram_id(repo, report)
        if not telegram_id:
            return {"sent": 0, "reason": "reporter_telegram_not_found"}
        telegram_ids = [telegram_id]
        text = _format_status_message(report, new_status)

        tracking_code = report.get("tracking_code")
        if tracking_code:
            url = _public_app_url(f"/tracking?code={quote(tracking_code)}")
            if url:
                btn = InlineKeyboardButton(
                    text="Lacak Laporan",
                    url=url,
                )
                markup = InlineKeyboardMarkup(inline_keyboard=[[btn]])
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported event")

    sent = await _send_messages(telegram_ids, text, reply_markup=markup)
    return {"sent": sent, "recipients": len(telegram_ids)}
