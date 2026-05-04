import asyncio
import logging
import sys
import threading

# Configure logging FIRST — without this, aiogram's INFO messages are hidden
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


def run_fastapi():
    """Run FastAPI server in a separate thread for receiving webhook notifications."""
    import uvicorn
    from app.main import app
    from app.config import settings

    logger.info("Starting FastAPI notification server on %s:%s", settings.HOST, settings.PORT)
    uvicorn.run(app, host=settings.HOST, port=settings.PORT, log_level="info")


async def run_longpoll():
    # Import inside function so any import errors are caught below
    from app.bot import dp, get_bot

    bot = get_bot()
    me = await bot.get_me()
    logger.info("Bot connected: @%s (%s)", me.username, me.full_name)
    logger.info("Send /start to the bot in Telegram to test it!")

    await dp.start_polling(bot, skip_updates=True)


if __name__ == '__main__':
    try:
        # Start FastAPI in a background thread
        api_thread = threading.Thread(target=run_fastapi, daemon=True)
        api_thread.start()

        # Start Telegram polling in the main thread
        asyncio.run(run_longpoll())
    except KeyboardInterrupt:
        logger.info("Bot stopped.")
    except Exception as e:
        logger.error("Failed to start bot: %s", e, exc_info=True)
        sys.exit(1)
