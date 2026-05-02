from fastapi import FastAPI
from app.api import health, image_proxy, notifications

app = FastAPI(title="ResikIn Telegram Bot Service")

app.include_router(health.router)
app.include_router(image_proxy.router, prefix="/telegram")
app.include_router(notifications.router)
