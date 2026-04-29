from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    TELEGRAM_BOT_TOKEN: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    REDIS_URL: str = ""
    REDIS_TTL_SECONDS: int = 3600

    model_config = ConfigDict(env_file=".env")


settings = Settings()
