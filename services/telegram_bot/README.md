# 🤖 ResikIn — Telegram Bot Service

> Bot Telegram untuk pelaporan sampah di 45 kelurahan Kota Yogyakarta.

Service ini adalah **service Python terpisah** dari web app Next.js. Bot ini menjadi pintu masuk bagi warga untuk melaporkan masalah sampah melalui Telegram, yang datanya disimpan ke database Supabase yang sama dengan web app.

---

## 📋 Daftar Isi

- [Tech Stack](#-tech-stack)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Struktur Folder](#-struktur-folder)
- [Alur Bot (FSM)](#-alur-bot-fsm)
- [Setup & Menjalankan Lokal](#-setup--menjalankan-lokal)
- [Environment Variables](#-environment-variables)
- [Database Migration](#-database-migration)
- [API Endpoints (FastAPI)](#-api-endpoints-fastapi)
- [Skema Data](#-skema-data)
- [Keputusan Arsitektur](#-keputusan-arsitektur)
- [Troubleshooting](#-troubleshooting)

---

## 🛠 Tech Stack

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Bot Framework | [aiogram 3.27](https://docs.aiogram.dev/) | Async Telegram bot framework dengan FSM |
| API Server | [FastAPI](https://fastapi.tiangolo.com/) | Untuk image proxy & health check |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) | Shared dengan web app Next.js |
| HTTP Client | httpx | Untuk komunikasi ke Telegram API |
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
│  foto        │     │  │ Bot      │  │  - /health          │   │     │ reports  │
│  deskripsi   │     │  │ (polling)│  │  - /telegram/file/  │   │     │ table    │
│  lokasi      │     │  └──────────┘  └────────────────────┘   │     │          │
└─────────────┘     └──────────────────────────────────────────┘     └──────────┘
                         run_bot.py       uvicorn app.main
                         (Terminal 1)     (Terminal 2, opsional)
```

**Dua proses terpisah:**
- **`run_bot.py`** — Bot Telegram (long polling), **wajib** dijalankan.
- **`uvicorn app.main`** — FastAPI server untuk image proxy, **opsional** untuk development (hanya diperlukan jika web dashboard perlu menampilkan foto laporan).

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
└── tests/                      # Unit & integration tests
```

---

## 🔄 Alur Bot (FSM)

Bot menggunakan **Finite State Machine (FSM)** dari aiogram untuk mengelola alur percakapan secara berurutan. Ini diperlukan karena Telegram tidak bisa mengirim foto, teks, dan lokasi dalam satu pesan sekaligus.

```
/start
  │
  ▼
┌─────────────────┐
│ PILIH_KELURAHAN  │ ← Inline keyboard, 45 kelurahan (2 kolom)
└────────┬────────┘
         │ user klik salah satu kelurahan
         ▼
┌─────────────────┐
│ UPLOAD_FOTO      │ ← User kirim foto tumpukan sampah
└────────┬────────┘
         │ bot tangkap file_id (resolusi tertinggi)
         ▼
┌─────────────────┐
│ INPUT_DESKRIPSI  │ ← User ketik deskripsi/detail laporan
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SHARE_LOCATION   │ ← User kirim lokasi via attachment > Location
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ KONFIRMASI       │ ← Bot tampilkan ringkasan + tombol Konfirmasi/Batal
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Konfirmasi  Batal
    │         │
    ▼         ▼
 Simpan ke   Reset FSM,
 Supabase    user mulai ulang
    │
    ▼
 Bot kirim kode tracking
 (format: RSK-YYYYMMDD-XXXXX)
```

> **Catatan:** States didefinisikan di `app/bot.py` class `ReportStates`.

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
```

> ⚠️ **Gunakan Service Role Key** (bukan Anon Key) karena bot perlu bypass RLS.
> Lihat Supabase Dashboard → Settings → API untuk mendapatkan credentials.

### Langkah 4: Setup Database

Pastikan **dua migration SQL** sudah dijalankan di Supabase SQL Editor **(secara berurutan)**:

1. `supabase/migrations/001_initial_schema.sql` — Skema dasar
2. `supabase/migrations/002_telegram_bot_support.sql` — Kolom tambahan untuk bot

> Buka Supabase Dashboard → SQL Editor → copy-paste isi file → Run.

### Langkah 5: Jalankan Bot

```bash
# Pastikan venv aktif
source .venv/bin/activate

# Jalankan bot
python run_bot.py
```

Output yang diharapkan:
```
2026-04-29 16:56:34 [INFO] __main__: Bot connected: @NamaBotKamu (NamaBot)
2026-04-29 16:56:34 [INFO] __main__: Send /start to the bot in Telegram to test it!
2026-04-29 16:56:34 [INFO] aiogram.dispatcher: Start polling
2026-04-29 16:56:34 [INFO] aiogram.dispatcher: Run polling for bot @NamaBotKamu id=1234567890 - 'NamaBot'
```

### Langkah 6: Tes di Telegram

1. Buka Telegram di HP/desktop
2. Cari username bot kamu (yang didaftarkan di BotFather)
3. Klik **Start** atau ketik `/start`
4. Ikuti alur: pilih kelurahan → kirim foto → ketik deskripsi → share lokasi → konfirmasi

### (Opsional) Jalankan FastAPI Server

Hanya perlu jika web dashboard butuh menampilkan foto dari laporan bot:

```bash
# Di terminal terpisah
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

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

> **File `.env` tidak boleh di-commit ke Git!** File sudah dimasukkan di `.gitignore`.

---

## 🗃 Database Migration

Bot memerlukan migration `002_telegram_bot_support.sql` yang menambahkan kolom-kolom berikut ke tabel `reports`:

| Kolom Baru | Tipe | Keterangan |
|------------|------|------------|
| `user_id` | `VARCHAR(64)` | ID user Telegram |
| `file_id` | `TEXT` | ID foto di server Telegram |
| `metadata` | `JSONB` | Data tambahan fleksibel |
| `source` | `VARCHAR(20)` | Asal laporan: `'web'` atau `'telegram'` |

Migration juga:
- Membuat `tracking_code`, `reporter_name`, `reporter_phone`, `category` menjadi **nullable** (bot tidak mengumpulkan data ini)
- Menambahkan status `'pending'` ke constraint
- Mengubah `kelurahan_id` dari `UUID` ke `VARCHAR(100)` (bot menggunakan string ID seperti `'baciro'`)
- Membuat **trigger** untuk auto-generate `tracking_code` format `RSK-YYYYMMDD-XXXXX`

---

## 🌐 API Endpoints (FastAPI)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/health` | Health check, return `{"status": "ok"}` |
| `GET` | `/telegram/file/{file_id}` | Proxy foto dari Telegram API. Digunakan oleh web dashboard untuk menampilkan foto laporan tanpa mengekspos bot token. |

### Contoh penggunaan image proxy:
```
GET http://localhost:8000/telegram/file/AgACAgIAAxkBAAI...
→ Response: binary image (JPEG/PNG) dengan header content-type yang sesuai
```

---

## 📦 Skema Data

### Report Model (`domain/models.py`)

Data yang dikirim bot ke Supabase:

```python
{
    "id": "uuid-v4",              # Auto-generated
    "user_id": "123456789",       # Telegram user ID
    "kelurahan_id": "baciro",     # String ID kelurahan
    "file_id": "AgACAgIAA...",    # Telegram photo file_id
    "description": "Sampah ...",  # Deskripsi dari user
    "latitude": -7.797068,        # Dari share location
    "longitude": 110.360871,      # Dari share location
    "status": "dikirim",          # Status awal
    "source": "telegram",         # Penanda asal laporan
    "metadata": {},               # Data tambahan (kosong untuk MVP)
    # tracking_code → auto-generated oleh DB trigger
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
| **Service Python terpisah** dari web Next.js | Stack berbeda (Python vs Node.js), bisa di-deploy independen |
| **Koordinat `float`**, bukan PostGIS | Cukup untuk MVP, menghindari kompleksitas ekstensi PostGIS |
| **`source` column** di tabel reports | Membedakan laporan dari web (`'web'`) dan Telegram (`'telegram'`) |
| **`tracking_code` auto-generated** | Trigger DB generate format `RSK-YYYYMMDD-XXXXX`, user-friendly |

---

## 🔧 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Tidak ada output saat `python run_bot.py` | Versi `run_bot.py` lama tidak punya `logging.basicConfig()` | Pastikan pakai versi terbaru (cek ada `logging.basicConfig` di baris awal) |
| `ModuleNotFoundError` | Virtual environment tidak aktif | Jalankan `source .venv/bin/activate` terlebih dahulu |
| `TELEGRAM_BOT_TOKEN is missing` | File `.env` belum dibuat/diisi | Salin `.env.example` → `.env` dan isi semua credential |
| `Supabase configuration is missing` | `SUPABASE_URL` atau `SUPABASE_SERVICE_ROLE_KEY` kosong | Isi di file `.env` (ambil dari Supabase Dashboard → Settings → API) |
| Bot tidak merespons `/start` | `run_bot.py` tidak sedang berjalan | Pastikan proses `python run_bot.py` aktif di terminal |
| Error saat simpan laporan | Migration `002` belum dijalankan | Jalankan `002_telegram_bot_support.sql` di Supabase SQL Editor |
| `tracking_code` duplicate | Collision di random 5-digit | Sangat jarang terjadi; re-run bot untuk retry |
| Redis connection error | Redis tidak terinstall/berjalan | Aman diabaikan — Redis opsional, hanya untuk cache image proxy |

---

## 🧪 Testing

```bash
# Aktifkan venv
source .venv/bin/activate

# Jalankan tests
pytest tests/ -v
```

---

## 📝 Catatan untuk Tim

1. **Jangan commit file `.env`** — sudah ada di `.gitignore`
2. Setiap anggota tim perlu **membuat bot sendiri** di BotFather untuk development lokal (1 token = 1 bot = 1 developer)
3. **Supabase project bisa di-share** — cukup share URL dan Service Role Key ke anggota tim (via channel privat, bukan commit ke Git)
4. Jika ingin menambah **state baru** ke FSM, definisikan di class `ReportStates` di `app/bot.py`
5. Untuk menambah **kelurahan**, edit list di `app/kelurahan.py`
