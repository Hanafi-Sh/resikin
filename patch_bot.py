import re

with open('services/telegram_bot/app/bot.py', 'r') as f:
    old_content = f.read()

# the top part is fine, let's keep everything up to cmd_link
# Wait, it's easier to just write the whole thing.
