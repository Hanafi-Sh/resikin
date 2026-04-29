import httpx
from app.config import settings


class TelegramClient:
    def __init__(self, token: str | None = None):
        self.token = token or settings.TELEGRAM_BOT_TOKEN
        self.api = f"https://api.telegram.org/bot{self.token}"

    async def get_file_path(self, file_id: str) -> str:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.api}/getFile", params={"file_id": file_id})
            r.raise_for_status()
            data = r.json()
            return data["result"]["file_path"]
