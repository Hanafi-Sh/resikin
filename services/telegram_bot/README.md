# 🤖 ResikIn — Telegram Bot Service

> Bot Telegram untuk pelaporan sampah di 45 kelurahan Kota Yogyakarta.

Service ini adalah **service Python terpisah** dari web app Next.js. Bot ini menjadi pintu masuk bagi warga untuk melaporkan masalah sampah melalui Telegram, yang datanya disimpan ke database Supabase yang sama dengan web app.

---

## 📋 Daftar Isi

- [Tech Stack](#-tech-stack)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Struktur Folder](#-struktur-folder)
- [Alur Bot FSM + Validasi Foto](#-alur-bot-fsm--validasi-foto)
- [Setup & Menjalankan Lokal](#-setup--menjalankan-lokal)
- [Environment Variables](#-environment-variables)
- [Database Migration](#-database-migration)
- [Validasi Foto & Guardrails](#-validasi-foto--guardrails)
- [API Endpoints (FastAPI)](#-api-endpoints-fastapi)
- [Skema Data](#-skema-data)
- [Keputusan Arsitektur](#-keputusan-arsitektur)
- [Testing Lokal dengan Tunnel](#-testing-lokal-dengan-tunnel)
- [Troubleshooting](#-troubleshooting)
- [Testing](#-testing)

---

## 🛠 Tech Stack

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Bot Framework | [aiogram 3.27](https://docs.aiogram.dev/) | Async Telegram bot framework dengan FSM |
| API Server | [FastAPI](https://fastapi.tiangolo.com/) | Untuk notifikasi status, image proxy, dan health check |
| AI Microservice | HTTP service via `AI_SERVICE_URL` | Validasi foto sampah dari Telegram |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) | Shared dengan web app Next.js |
| HTTP Client | httpx | Untuk komunikasi ke Telegram API |
| Async HTTP | aiohttp | Reverse geocoding dan request ke AI service |
| Config | pydantic-settings | Type-safe configuration dari `.env` |
| Cache | Redis (opsional) | Cache gambar yang di-proxy dari Telegram |
| Python | 3.12+ | Minimum version yang didukung |

---

## 🏗 Arsitektur Sistem

```
┌─────────────┐     ┌──────────────────────────────────────────┐     ┌──────────┐
│  Telegram    │     │  Bot Service (Python)                    │     │ Supabase │
│  User (HP)   │◄───►│                                          │◄───►│ (Postgre │
│              │     │  ┌──────────┐  ┌────────────────────┐   │     │  SQL)    │
│  /start      │     │  │ aiogram  │  │  FastAPI            │   │     │          │
│  chat/foto   │     │  │ Bot      │  │  - /health          │   │     │ reports  │
│  lokasi      │     │  │ + AI     │  │  - /notifications/  │   │     │ table    │
│              │     │  │ guards   │  │  - /telegram/file/  │   │     │          │
│              │     │  └──────────┘  └────────────────────┘   │     │          │
└─────────────┘     └──────────────────────────────────────────┘     └──────────┘
                         run_bot.py menjalankan polling + FastAPI
                         FastAPI terpisah via uvicorn hanya untuk debug API
```

**Proses utama:**
- **`run_bot.py`** — Menjalankan FastAPI notification server di background thread, lalu Telegram long polling di main thread.
- **`uvicorn app.main`** — Opsional untuk debugging endpoint FastAPI secara terpisah. Jangan jalankan bersamaan di port yang sama dengan `run_bot.py`.

**Komponen validasi:**
- FSM di `app/bot.py` mengumpulkan Draf Laporan secara eksplisit.
- Python validator tetap menjadi penentu akhir apakah laporan boleh disimpan.
- AI microservice di `AI_SERVICE_URL` dipakai untuk validasi foto dari Telegram.

---

## 📁 Struktur Folder

```
services/telegram_bot/
├── run_bot.py                  # Entry point bot (long polling)
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Container image (production)
├── Makefile                    # Shortcut commands
├── .env.example                # Template environment variables
├── .env                        # (TIDAK di-commit) Credential lokal
│
├── app/                        # Application layer
│   ├── __init__.py
│   ├── bot.py                  # Bot handlers & FSM states
│   ├── config.py               # Settings (dari .env via pydantic)
│   ├── kelurahan.py            # Data 45 kelurahan Jogja
│   ├── main.py                 # FastAPI app instance
│   └── api/                    # FastAPI endpoints
│       ├── health.py           # GET /health
│       ├── notifications.py    # POST /notifications/report
│       └── image_proxy.py      # GET /telegram/file/{file_id}
│
├── domain/                     # Domain models
│   ├── __init__.py
│   └── models.py               # Report model (Pydantic)
│
├── infra/                      # Infrastructure clients
│   ├── __init__.py
│   └── telegram_client.py      # Telegram API HTTP client
│
├── repositories/               # Data access layer
│   ├── __init__.py
│   └── supabase_repo.py        # Supabase CRUD operations
│
├── scripts/                    # Script manual untuk cek data operasional
│   └── check_notification_data.py
│
└── tests/                      # Unit & integration tests
```

---

## 🔄 Alur Bot FSM + Validasi Foto

Bot memakai pendekatan **FSM deterministik**:

- **FSM** mengarahkan Pelapor lewat pilihan dan input eksplisit.
- **Python validator** menyimpan state terstruktur dan memutuskan apakah laporan sudah lengkap.
- **Validasi Foto Laporan** tetap memakai AI microservice lewat `AI_SERVICE_URL`.

Flow utama:

```txt
/start
  |
  +-- Bot menampilkan menu awal + tombol "📝 Saya mau lapor"
        |
        +-- User menekan tombol saat idle
              |
              +-- User baru/tanpa nomor telepon
              |     -> bot meminta nomor via contact button atau input manual
              |
              +-- User lama
                    -> bot meminta pilih kelurahan
                    -> bot meminta pilih kategori
                    -> bot meminta foto atau skip
                    -> bot meminta deskripsi
                    -> bot meminta lokasi
                    -> bot menampilkan konfirmasi
                    -> jika lengkap, laporan disimpan ke Supabase
                    -> bot mengirim kode tracking dan menampilkan tombol lapor lagi
```

Tombol **📝 Saya mau lapor** hanya ditampilkan saat user tidak sedang mengisi laporan. Saat flow laporan berjalan, bot menyembunyikan tombol tersebut. Jika user menekan/mengetik tombol itu saat laporan masih aktif, bot tidak mereset laporan dan meminta user melanjutkan data yang sedang diminta.

Syarat deterministik sebelum laporan disimpan:

| Field | Aturan |
|-------|--------|
| Nama pelapor | Harus ada, dari reporter lama atau nama Telegram |
| Deskripsi | Minimal 10 karakter |
| Lokasi | `latitude` dan `longitude` wajib dari share location Telegram |
| Kelurahan | Harus cocok dengan id/nama dari 45 kelurahan resmi |
| Kategori | Harus salah satu kategori resmi |
| Foto | Opsional, tetapi bot harus pernah menerima foto valid atau user eksplisit menolak foto |

Foto dikirim ke AI microservice. Jika terdeteksi sampah, `file_id` disimpan. Jika terdeteksi spam/non-sampah, foto tidak dihitung sebagai bukti laporan dan bot meminta foto lain atau user boleh lanjut tanpa foto.

FSM memakai state:

```txt
INPUT_TELEPON -> PILIH_KELURAHAN -> PILIH_KATEGORI -> UPLOAD_FOTO -> INPUT_DESKRIPSI -> SHARE_LOCATION -> KONFIRMASI
```

Jika validasi foto gagal karena AI service tidak tersedia, bot tetap menerima foto agar Pelapor tidak terblokir.

---

## 🚀 Setup & Menjalankan Lokal

### Prasyarat

- **Python 3.12+** terinstall (`python3 --version`)
- **Akun Supabase** dengan project yang sudah dibuat
- **Bot Telegram** yang sudah dibuat via [@BotFather](https://t.me/BotFather)

### Langkah 1: Buat Bot di BotFather (jika belum)

1. Buka Telegram → cari `@BotFather`
2. Ketik `/newbot` → ikuti instruksi (beri nama & username)
3. Salin **API Token** yang diberikan (format: `1234567890:AABBCCDDEEFFaabbccddeeff...`)

### Langkah 2: Clone & Install Dependencies

```bash
# Masuk ke folder bot
cd services/telegram_bot

# Buat virtual environment
python3 -m venv .venv

# Aktifkan venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Langkah 3: Konfigurasi Environment Variables

```bash
# Salin template
cp .env.example .env
```

Edit file `.env`:
```env
TELEGRAM_BOT_TOKEN=1234567890:AABBCCDDEEFFaabbccddeeff...
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
HOST=0.0.0.0
PORT=8000
NOTIFY_WEBHOOK_SECRET=your-shared-secret
APP_BASE_URL=http://127.0.0.1:3000
AI_SERVICE_URL=http://localhost:8001/api/validate-image
```

> ⚠️ **Gunakan Service Role Key** (bukan Anon Key) karena bot perlu bypass RLS.
> Lihat Supabase Dashboard → Settings → API untuk mendapatkan credentials.

### Langkah 4: Setup Database

Pastikan migration SQL sudah dijalankan di Supabase SQL Editor **(secara berurutan)**:

1. `supabase/migrations/001_initial_schema.sql` — Skema dasar
2. `supabase/migrations/002_telegram_bot_support.sql` — Kolom tambahan untuk bot
3. `supabase/migrations/003_multi_photo_support.sql` — Dukungan multi foto laporan
4. `supabase/migrations/004_reporters_and_categories.sql` — Tabel `reporters` dan kategori laporan
5. `supabase/migrations/003_telegram_linking_and_sectors.sql` — Linking Telegram koordinator/petugas dan sektor
6. `supabase/migrations/005_create_report_intake_function.sql` — Fungsi database untuk membuat laporan baru, kode tracking, foto awal, dan status history awal
7. `supabase/migrations/006_create_report_workflow_function.sql` — Fungsi database untuk perubahan status, assignment, foto penyelesaian, dan status history alur penanganan laporan

> Buka Supabase Dashboard → SQL Editor → copy-paste isi file → Run.
> Urutan canonical juga dicatat di [`../../docs/database/migration-order.md`](../../docs/database/migration-order.md).

### Langkah 5: Jalankan Bot

`run_bot.py` sekarang menjalankan dua komponen dalam satu proses:

- FastAPI notification server di background thread.
- Telegram long polling di main thread.

```bash
# Pastikan venv aktif
source .venv/bin/activate

# Jalankan bot + FastAPI service
python run_bot.py
```

Output yang diharapkan:
```
2026-04-29 16:56:34 [INFO] __main__: Bot connected: @NamaBotKamu (NamaBot)
2026-04-29 16:56:34 [INFO] __main__: Send /start to the bot in Telegram to test it!
2026-04-29 16:56:34 [INFO] aiogram.dispatcher: Start polling
2026-04-29 16:56:34 [INFO] aiogram.dispatcher: Run polling for bot @NamaBotKamu id=1234567890 - 'NamaBot'
```

### Langkah 6: Tes FastAPI Server

Karena `run_bot.py` sudah menjalankan FastAPI, health check bisa langsung dites selama proses bot aktif:

```bash
curl http://localhost:8000/health
```

Output yang diharapkan:

```json
{"status":"ok"}
```

Jika hanya ingin men-debug FastAPI tanpa polling bot, jalankan manual:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Jangan jalankan `uvicorn` dan `python run_bot.py` bersamaan di port yang sama.

### Langkah 7: Tes di Telegram

1. Buka Telegram di HP/desktop
2. Cari username bot kamu (yang didaftarkan di BotFather)
3. Klik **Start** atau ketik `/start`
4. Tekan tombol **📝 Saya mau lapor**
5. Jika diminta nomor telepon, tekan contact button atau ketik nomor manual
6. Pilih kelurahan dan kategori laporan
7. Kirim foto jika ada, atau balas `-` untuk melewati foto
8. Ketik deskripsi masalah sampah
9. Kirim lokasi GPS saat diminta
10. Konfirmasi laporan dan tunggu kode tracking

### Testing Notifikasi Status dari Web

Untuk notifikasi perubahan status ke warga:

1. Pastikan `run_bot.py` aktif.
2. Pastikan `BOT_NOTIFY_URL` mengarah ke host/port FastAPI dari bot.
3. Pastikan `NOTIFY_WEBHOOK_SECRET` sama dengan `BOT_NOTIFY_SECRET` di web.
4. Pastikan `APP_BASE_URL` mengarah ke web app yang bisa dibuka publik jika tombol dibuka dari HP.
5. Buat laporan lewat bot, lalu ubah status dari dashboard web.

Pesan status dikirim untuk perubahan status yang benar-benar berubah. PATCH ke status yang sama tidak mengirim pesan ulang.

Kontrak event antara web app dan bot service dicatat di [`../../docs/contracts/report-notifications.md`](../../docs/contracts/report-notifications.md). Kode baru harus memakai event canonical `report.created`, `report.assigned`, dan `report.status_changed`; alias lama masih diterima sementara untuk kompatibilitas.

---

## 🔐 Environment Variables

| Variable | Wajib | Deskripsi |
|----------|-------|-----------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Token dari BotFather |
| `SUPABASE_URL` | ✅ | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (bypass RLS) |
| `HOST` | ❌ | Host server FastAPI (default: `0.0.0.0`) |
| `PORT` | ❌ | Port server FastAPI (default: `8000`) |
| `REDIS_URL` | ❌ | URL Redis untuk cache image proxy |
| `REDIS_TTL_SECONDS` | ❌ | TTL cache Redis dalam detik (default: `3600`) |
| `NOTIFY_WEBHOOK_SECRET` | ✅ untuk notifikasi | Shared secret. Harus sama dengan `BOT_NOTIFY_SECRET` di web app |
| `APP_BASE_URL` | ✅ untuk tombol Telegram | URL web app publik untuk tombol tracking, misalnya domain production atau URL ngrok |
| `AI_SERVICE_URL` | ✅ untuk validasi foto | URL endpoint validasi foto. Default bot: `http://localhost:8001/api/validate-image` |

> **File `.env` tidak boleh di-commit ke Git!** File sudah dimasukkan di `.gitignore`.

Catatan `AI_SERVICE_URL`:

- Di bot Telegram, nilai ini harus menunjuk langsung ke endpoint validasi foto, misalnya `https://ai.example.com/api/validate-image`.
- Di web app, env `AI_SERVICE_URL` menunjuk ke base URL service, lalu Next.js menambahkan path `/api/ai/validate-image` atau `/api/ai/recommend-assignment`.

---

## 🗃 Database Migration

Bot memerlukan beberapa migration yang membuat tabel/kolom berikut tersedia:

| Data | Keterangan |
|------|------------|
| `reports.user_id` | ID user Telegram |
| `reports.reporter_id` | Relasi ke tabel `reporters` untuk identitas warga |
| `reports.file_ids` / multi photo support | Daftar `file_id` Telegram untuk foto laporan |
| `reports.metadata` | Data tambahan fleksibel |
| `reports.source` | Asal laporan: `'web'` atau `'telegram'` |
| `reporters` | Nama, nomor HP, dan Telegram ID warga pelapor |
| `telegram_links` | Akun Telegram koordinator/petugas untuk notifikasi |
| `status_history` | Riwayat status, termasuk status awal dari laporan bot |

Bot mengirim data laporan ke fungsi database `create_report_intake`. Fungsi ini menyimpan status awal `dikirim`, membuat kode tracking, dan membuat entry awal di `status_history` dengan catatan laporan dibuat melalui bot Telegram.

## 🧠 Validasi Foto & Guardrails

Bot mengumpulkan Draf Laporan lewat FSM eksplisit. Validasi Foto Laporan memakai AI microservice, tetapi Python validator tetap menentukan apakah laporan boleh disimpan.

Data yang dilacak di `user_state`:

| Field | Keterangan |
|-------|------------|
| `reporter_name`, `reporter_phone`, `reporter_id` | Identitas warga |
| `description` | Deskripsi masalah sampah |
| `category`, `suggested_category` | Kategori resmi laporan dan saran kategori dari validasi foto |
| `kelurahan_id`, `kelurahan_detected` | Kelurahan resmi atau hasil deteksi internal |
| `latitude`, `longitude` | Koordinat wajib dari Telegram location |
| `file_ids` | Foto valid yang disimpan sebagai Telegram `file_id` |
| `photo_was_asked`, `photo_received`, `photo_declined`, `photo_validated_as_waste` | Status validasi foto |
| `missing_fields`, `last_ai_data` | Debug/progress internal |

Validator menahan penyimpanan jika data belum lengkap. Urutan FSM utama adalah kelurahan, kategori, foto, deskripsi, lokasi, konfirmasi, lalu simpan.

### Validasi Foto AI

Handler foto mengunduh file dari Telegram, mengubahnya ke base64, lalu mengirim ke `AI_SERVICE_URL`. Respons yang diharapkan:

```json
{
  "success": true,
  "isWaste": true,
  "suggested_category": "tps_penuh",
  "top_label": "overflowing waste bin",
  "confidence": 0.92
}
```

Jika `isWaste=true`, `file_id` disimpan dan kategori saran dicatat sebagai `suggested_category` tanpa menimpa kategori yang sudah dipilih Pelapor. Jika `isWaste=false`, foto tidak masuk `file_ids` dan bot meminta foto lain atau Pelapor boleh melewati foto. Jika AI service gagal, bot tetap menerima foto agar warga tidak terblokir total, tetapi validator tetap menjaga field wajib lain.

### Anti-Spam

Bot memiliki middleware anti-spam:

| Limit | Nilai |
|-------|-------|
| Cooldown antar pesan | 2 detik |
| Maks karakter per pesan | 2000 |

---

## 🌐 API Endpoints (FastAPI)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/health` | Health check, return `{"status": "ok"}` |
| `POST` | `/notifications/report` | Webhook internal dari web app untuk notifikasi laporan baru, tugas petugas, dan status warga |
| `GET` | `/telegram/file/{file_id}` | Proxy foto dari Telegram API. Digunakan oleh web dashboard untuk menampilkan foto laporan tanpa mengekspos bot token. |

### Event `/notifications/report`

Endpoint ini dipanggil oleh web app lewat `BOT_NOTIFY_URL`.

| Event | Penerima | Keterangan |
|-------|----------|------------|
| `created` | Koordinator yang punya link Telegram sesuai kelurahan laporan | Laporan baru masuk |
| `assigned` | Petugas yang ditugaskan dan sudah link Telegram | Tugas baru untuk petugas |
| `status_changed` | Warga pelapor dari `reports.reporter_id -> reporters.telegram_id`, fallback ke `reports.user_id` | Update status laporan warga |

Untuk event `status_changed`, tombol **Lacak Laporan** dibuat dari:

```txt
APP_BASE_URL/tracking?code=<tracking_code>
```

Jika `APP_BASE_URL` masih `localhost`, Telegram bisa menolak tombol atau HP tidak bisa membuka link. Gunakan URL publik saat testing dari Telegram mobile.

### Contoh penggunaan image proxy:
```
GET http://localhost:8000/telegram/file/AgACAgIAAxkBAAI...
→ Response: binary image (JPEG/PNG) dengan header content-type yang sesuai
```

### Integrasi Foto Telegram ke Web

Bot menyimpan foto warga sebagai `reports.file_ids`, bukan sebagai URL Storage. Web app kemudian membuat URL gambar dari:

```txt
BOT_NOTIFY_URL/telegram/file/{file_id}
```

Karena itu, agar foto laporan Telegram tampil di dashboard, halaman petugas, dan tracking warga:

1. Service bot/FastAPI harus berjalan.
2. `BOT_NOTIFY_URL` di `.env.local` web harus mengarah ke host service bot.
3. `TELEGRAM_BOT_TOKEN` di `.env` bot harus valid karena endpoint proxy mengambil file dari Telegram API.

Redis tetap opsional. Jika `REDIS_URL` kosong, endpoint proxy langsung mengambil file dari Telegram API setiap kali gambar dibuka. Redis hanya dipakai sebagai cache untuk mengurangi request berulang ke Telegram.

Foto bukti penyelesaian dari petugas berbeda dari foto Telegram warga. Foto penyelesaian di-upload oleh web app ke Supabase Storage dan disimpan di tabel `report_photos` dengan `type='completion'`.

---

## 📦 Skema Data

### Report Model (`domain/models.py`)

Data yang dikirim bot ke Supabase:

```python
{
    "id": "uuid-v4",                    # Auto-generated
    "user_id": "123456789",             # Telegram user ID
    "reporter_id": "uuid-reporter",     # Relasi ke tabel reporters
    "reporter_name": "Budi",            # Nama warga
    "reporter_phone": "08123456789",    # Nomor warga
    "kelurahan_id": "baciro",           # String ID kelurahan resmi
    "category": "tps_penuh",            # Kategori resmi
    "file_ids": ["AgACAgIAA..."],       # Telegram photo file_id valid
    "description": "Sampah ...",        # Deskripsi dari user/AI extraction
    "latitude": -7.797068,              # Dari share location
    "longitude": 110.360871,            # Dari share location
    "status": "dikirim",                # Status awal
    "source": "telegram",               # Penanda asal laporan
    "metadata": {},                     # Data tambahan
    # tracking_code -> auto-generated oleh DB trigger
}
```

### Daftar Kelurahan (`app/kelurahan.py`)

45 kelurahan dari 14 kemantren di Kota Yogyakarta. Format:
```python
{"id": "baciro", "name": "Baciro", "kemantren": "Gondokusuman"}
```

---

## 🧠 Keputusan Arsitektur

| Keputusan | Alasan |
|-----------|--------|
| **Single Bot** untuk semua 45 kelurahan | Lebih sederhana dari multi-tenant, user pilih kelurahan di awal |
| **Long Polling** (dev) vs Webhook (prod) | Long polling tidak butuh public URL, cocok untuk development |
| **Foto disimpan sebagai `file_id`**, bukan di-upload ke Storage | Hemat storage Supabase, foto tetap bisa diakses via proxy endpoint |
| **Foto penyelesaian petugas disimpan di Storage** | File berasal dari web app, bukan Telegram, sehingga disimpan sebagai URL di `report_photos` |
| **Service Python terpisah** dari web Next.js | Stack berbeda (Python vs Node.js), bisa di-deploy independen |
| **Koordinat `float`**, bukan PostGIS | Cukup untuk MVP, menghindari kompleksitas ekstensi PostGIS |
| **`source` column** di tabel reports | Membedakan laporan dari web (`'web'`) dan Telegram (`'telegram'`) |
| **`tracking_code` auto-generated** | Trigger DB generate format `RSK-YYYYMMDD-XXXXX`, user-friendly |
| **Identitas warga memakai tabel `reporters`** | Warga Telegram disimpan sebagai reporter, bukan `telegram_links`; `telegram_links` dipakai untuk koordinator/petugas |
| **`run_bot.py` menjalankan polling + FastAPI** | Satu proses cukup untuk bot dan endpoint notifikasi/image proxy |
| **FSM menjadi alur utama Draf Laporan** | Bot tidak bergantung pada LLM chat untuk mengumpulkan data laporan |
| **Validasi Foto Laporan tetap berbasis AI service** | AI dipakai hanya untuk memeriksa apakah foto relevan sebagai bukti sampah |
| **Foto opsional tetapi eksplisit** | Laporan boleh tanpa foto hanya jika user sudah ditanya dan menolak foto |
| **AI service failure tidak boleh merusak data** | Bot tetap melanjutkan flow, tetapi validator mencegah laporan tidak lengkap tersimpan |
| **Tracking link dirender server-side** | Halaman `/tracking?code=...` mengambil report awal dari server agar stabil saat dibuka dari Telegram/ngrok |

---

## 🌍 Testing Lokal dengan Tunnel

Telegram membutuhkan URL publik untuk tombol inline keyboard. Untuk development lokal, gunakan ngrok atau tunnel sejenis ke port web app:

```bash
# Terminal web
npm run dev

# Terminal tunnel
ngrok http 3000
```

Setelah mendapatkan URL seperti:

```txt
https://contoh.ngrok-free.dev
```

set di `.env` bot:

```env
APP_BASE_URL=https://contoh.ngrok-free.dev
```

Jika memakai Next dev server (`npm run dev`) lewat ngrok, tambahkan domain tunnel ke `allowedDevOrigins` di `next.config.mjs`:

```js
allowedDevOrigins: ['*.ngrok-free.dev']
```

Untuk flow end-to-end yang lebih stabil, terutama login dan redirect, gunakan mode production lokal:

```bash
npm run build
npm run start
ngrok http 3000
```

Mode production tidak memakai HMR/WebSocket Next dev server, sehingga lebih cocok diuji lewat tunnel.

## 🔧 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Tidak ada output saat `python run_bot.py` | Versi `run_bot.py` lama tidak punya `logging.basicConfig()` | Pastikan pakai versi terbaru (cek ada `logging.basicConfig` di baris awal) |
| `ModuleNotFoundError` | Virtual environment tidak aktif | Jalankan `source .venv/bin/activate` terlebih dahulu |
| `TELEGRAM_BOT_TOKEN is missing` | File `.env` belum dibuat/diisi | Salin `.env.example` → `.env` dan isi semua credential |
| `Supabase configuration is missing` | `SUPABASE_URL` atau `SUPABASE_SERVICE_ROLE_KEY` kosong | Isi di file `.env` (ambil dari Supabase Dashboard → Settings → API) |
| `AI_SERVICE_URL` salah | Validasi foto gagal | Pastikan URL menunjuk endpoint validasi foto yang bisa diakses dari service bot |
| Foto valid selalu dianggap spam | Model/endpoint AI service salah klasifikasi | Cek response `top_label` dan threshold di AI service |
| Bot tidak merespons `/start` | `run_bot.py` tidak sedang berjalan | Pastikan proses `python run_bot.py` aktif di terminal |
| Error saat simpan laporan | Migration `002` belum dijalankan | Jalankan `002_telegram_bot_support.sql` di Supabase SQL Editor |
| `tracking_code` duplicate | Collision di random 5-digit | Sangat jarang terjadi; re-run bot untuk retry |
| Redis connection error | Redis tidak terinstall/berjalan | Aman diabaikan — Redis opsional, hanya untuk cache image proxy |
| Foto Telegram tidak tampil di web | `BOT_NOTIFY_URL` kosong/salah atau FastAPI bot tidak berjalan | Jalankan `python run_bot.py` dan set `BOT_NOTIFY_URL` ke host service bot |
| Warga tidak menerima notifikasi status | FastAPI tidak jalan, secret mismatch, atau Telegram menolak URL tombol | Pastikan `run_bot.py` aktif, cek `NOTIFY_WEBHOOK_SECRET`, dan pastikan `APP_BASE_URL` URL publik |
| Endpoint notifikasi merespons `{"sent":0,"recipients":1}` | Penerima ditemukan, tetapi `bot.send_message` gagal | Biasanya URL tombol invalid/localhost; gunakan tunnel/domain publik |
| Link tracking dari Telegram loading terus | Halaman client belum hydrate atau tunnel/dev server bermasalah | Pastikan versi terbaru memakai server-side initial report di `/tracking?code=...`; coba production mode lokal |
| Login reload sendiri lewat ngrok | Next dev HMR/WebSocket atau origin dev lewat tunnel tidak stabil | Tambahkan `allowedDevOrigins` untuk domain ngrok atau pakai `npm run build && npm run start` |

---

## 🧪 Testing

```bash
# Aktifkan venv
source .venv/bin/activate

# Jalankan tests
pytest tests/ -v
```

Test suite mencakup:

- Guardrail validator sebelum laporan disimpan.
- Handler FSM untuk nomor telepon, kelurahan, kategori, foto, deskripsi, lokasi, dan konfirmasi.
- Validasi Foto Laporan, termasuk foto spam/non-sampah dan fallback saat AI service gagal.
- Anti-spam middleware.
- Endpoint notifikasi FastAPI.
- Repository Laporan Intake dan runner `run_bot.py`.

External service seperti Telegram, Supabase, dan AI microservice dimock di unit test.

### Cek Data Notifikasi Manual

Script ini dipakai untuk debugging data Supabase yang menentukan routing notifikasi Telegram. Ini bukan unit test dan tidak dijalankan oleh `pytest`.

```bash
# Dari folder services/telegram_bot
python scripts/check_notification_data.py

# Filter user tertentu
python scripts/check_notification_data.py --user-name "petugas krasak"
```

Secara default Telegram ID dimasking di output. Gunakan `--show-telegram-ids` hanya saat benar-benar perlu cek nilai lengkap.

---

## 📝 Catatan untuk Tim

1. **Jangan commit file `.env`** — sudah ada di `.gitignore`
2. Setiap anggota tim perlu **membuat bot sendiri** di BotFather untuk development lokal (1 token = 1 bot = 1 developer)
3. **Supabase project bisa di-share** — cukup share URL dan Service Role Key ke anggota tim (via channel privat, bukan commit ke Git)
4. Jika mengubah alur AI, pastikan validator Python tetap menjadi sumber kebenaran akhir sebelum simpan laporan
5. Jika ingin menambah **state baru** ke FSM, definisikan di class `ReportStates` di `app/bot.py`
6. Untuk menambah **kelurahan**, edit list di `app/kelurahan.py`
