# Use FSM Telegram Draf Laporan with Validasi Foto Laporan

Telegram Draf Laporan will be collected through an explicit FSM instead of an LLM chat flow. DeepSeek is removed from the Telegram bot runtime. Validasi Foto Laporan remains available through `AI_SERVICE_URL`, and Python validation remains the final guardrail before Laporan Intake creates a Laporan Terkirim.

## Considered Options

- Keep DeepSeek as the main Telegram conversation path: preserves natural chat, but keeps deployment dependent on `DEEPSEEK_API_KEY` and makes Draf Laporan behaviour harder to test.
- Keep DeepSeek behind an environment flag: reduces immediate risk, but keeps two conversation implementations and makes the bot's Interface ambiguous.
- Use FSM as the only Draf Laporan path and keep Validasi Foto Laporan: concentrates conversation behaviour in one deterministic flow while preserving AI leverage for Foto Laporan validation.

## Consequences

Bot deployment no longer requires `DEEPSEEK_API_KEY` or the OpenAI-compatible SDK. Pelapor input follows the explicit FSM order: phone, Foto Laporan, category, Kelurahan Laporan, location, description, and confirmation. Foto Laporan is collected early so Validasi Foto Laporan can suggest a category before the Pelapor chooses one. If Validasi Foto Laporan returns `isWaste=false`, the bot asks the Pelapor to confirm or resend the photo. If Validasi Foto Laporan is unavailable, the bot accepts the photo so the Pelapor is not blocked by an external runtime failure.
