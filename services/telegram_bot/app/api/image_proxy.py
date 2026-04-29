from fastapi import APIRouter, HTTPException, Response
import httpx
from app.config import settings
import redis.asyncio as redis
import base64

router = APIRouter()


async def get_redis_client():
    if not settings.REDIS_URL:
        return None
    return redis.from_url(settings.REDIS_URL)


@router.get("/file/{file_id}")
async def proxy_file(file_id: str):
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN not configured")

    rcli = await get_redis_client()
    cache_key = f"tg:file:{file_id}"
    if rcli:
        cached = await rcli.hgetall(cache_key)
        if cached and b"data" in cached:
            content = base64.b64decode(cached[b"data"])
            content_type = cached.get(b"content_type", b"application/octet-stream").decode()
            return Response(content=content, media_type=content_type)

    async with httpx.AsyncClient() as client:
        r = await client.get(f"https://api.telegram.org/bot{token}/getFile", params={"file_id": file_id}, timeout=30.0)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to get file info from Telegram")
        data = r.json()
        if not data.get("ok"):
            raise HTTPException(status_code=502, detail="Telegram API error")
        file_path = data["result"]["file_path"]
        file_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        resp = await client.get(file_url, timeout=60.0)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to download file from Telegram")
        content_type = resp.headers.get("content-type", "application/octet-stream")
        content = resp.content

    if rcli:
        try:
            await rcli.hset(cache_key, mapping={
                "data": base64.b64encode(content),
                "content_type": content_type,
            })
            await rcli.expire(cache_key, settings.REDIS_TTL_SECONDS)
        except Exception:
            pass

    return Response(content=content, media_type=content_type)
