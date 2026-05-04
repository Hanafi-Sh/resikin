import re

# Read old FSM handlers
with open('old_bot.py', 'r') as f:
    old_content = f.read()

with open('services/telegram_bot/app/bot.py', 'r') as f:
    new_content = f.read()

# We will just write a new bot.py from scratch to ensure correctness.
