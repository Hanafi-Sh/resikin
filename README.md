# 🌿 ResikIn — Sistem Pelaporan & Koordinasi Sampah Kelurahan

> Laporkan. Pantau. Bersihkan.

ResikIn adalah platform pelaporan dan koordinasi masalah sampah di tingkat kelurahan Kota Yogyakarta. Dibangun sebagai solusi atas masalah komunikasi yang tidak terstruktur antara warga, koordinator kelurahan, dan petugas lapangan DLH.

Sistem ini terdiri dari **dua komponen utama**:
- **Web App** — Dashboard untuk koordinator & petugas, serta form pelaporan & tracking untuk warga.
- **Telegram Bot** — Kanal pelaporan alternatif melalui Telegram untuk kemudahan warga di lapangan.

---

## 🎯 Fitur Utama

### 🌐 Web App
- **📝 Pelaporan Warga** — Form digital sederhana, tanpa perlu membuat akun
- **🔍 Tracking Realtime** — Pantau status laporan dengan nomor tracking unik
- **📊 Dashboard Koordinator** — Kelola semua laporan dari satu tempat
- **👷 Panel Petugas** — Daftar tugas harian dengan navigasi lokasi
- **🔔 Notifikasi Status Telegram** — Warga pelapor dari bot menerima update saat status laporan berubah
- **📋 Info Publik** — Pengumuman dan tips kebersihan

### 🤖 Telegram Bot
- **💬 Pelaporan via Chat** — Warga bisa melapor langsung dari Telegram tanpa buka browser
- **📷 Upload Foto** — Kirim foto tumpukan sampah langsung di chat
- **📍 Share Lokasi** — Gunakan fitur location Telegram untuk titik koordinat yang akurat
- **🏘️ Pilih Kelurahan** — 45 kelurahan di Kota Yogyakarta tersedia sebagai pilihan
- **📋 Kode Tracking** — Setiap laporan mendapat kode tracking otomatis (format: `RSK-YYYYMMDD-XXXXX`)
- **🔔 Update Status** — Mengirim pesan ke warga saat laporan diterima, ditugaskan, diproses, selesai, atau ditolak

---

## 🛠️ Tech Stack

### Web App

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 16 (React 19) + Tailwind CSS v4 |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth |
| Maps | Leaflet.js + OpenStreetMap |
| Deploy | Vercel |

### Telegram Bot

| Layer | Teknologi |
|-------|-----------|
| Bot Framework | aiogram 3.27 (Python, async) |
| API Server | FastAPI (notifikasi status, image proxy & health check) |
| Database | Supabase (shared dengan web app) |
| Runtime | Python 3.12+ |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ dan npm
- Python 3.12+ (untuk Telegram bot)
- Akun [Supabase](https://supabase.com) (gratis)
- Bot Telegram dari [@BotFather](https://t.me/BotFather) (untuk Telegram bot)

### Web App Setup

```bash
# 1. Clone repository
git clone https://github.com/Hanafi-Sh/resikin.git
cd resikin

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.local.example .env.local
# Edit .env.local dan isi SUPABASE_URL + SUPABASE_ANON_KEY
# Optional (notifikasi bot):
#   - BOT_NOTIFY_URL (contoh: https://bot.example.com)
#   - BOT_NOTIFY_SECRET (shared secret)
#   - NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (untuk deep link /start)

# 4. Setup database
# Buka Supabase Dashboard → SQL Editor
# Jalankan file secara berurutan:
#   - supabase/migrations/001_initial_schema.sql
#   - supabase/migrations/002_telegram_bot_support.sql
#   - supabase/migrations/003_multi_photo_support.sql
#   - supabase/migrations/004_reporters_and_categories.sql
#   - supabase/migrations/003_telegram_linking_and_sectors.sql

# 5. Run development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Telegram Bot Setup

```bash
# 1. Masuk ke folder bot
cd services/telegram_bot

# 2. Buat virtual environment & install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Setup environment variables
cp .env.example .env
# Edit .env dan isi:
#   - TELEGRAM_BOT_TOKEN (dari BotFather)
#   - SUPABASE_URL
#   - SUPABASE_SERVICE_ROLE_KEY
#   - NOTIFY_WEBHOOK_SECRET (harus sama dengan BOT_NOTIFY_SECRET)
#   - APP_BASE_URL (URL web publik untuk tombol notifikasi Telegram)

# 4. Jalankan bot polling
python run_bot.py

# 5. Di terminal lain, jalankan FastAPI bot service
# Wajib untuk notifikasi status dan proxy foto Telegram.
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> 📖 Dokumentasi lengkap Telegram bot tersedia di [`services/telegram_bot/README.md`](services/telegram_bot/README.md)

---

## 📁 Struktur Folder

```
resikin/
├── src/                        # Web App (Next.js)
│   ├── app/                    # Halaman (App Router)
│   │   ├── page.js             # Landing page
│   │   ├── layout.js           # Root layout
│   │   ├── globals.css         # Global styles
│   │   ├── lapor/              # Form laporan warga
│   │   ├── tracking/           # Tracking status laporan
│   │   ├── dashboard/          # Dashboard koordinator
│   │   ├── petugas/            # Panel petugas
│   │   ├── login/              # Halaman login
│   │   ├── info/               # Info publik
│   │   └── api/                # API Routes
│   ├── components/             # Komponen reusable
│   │   ├── ui/                 # Button, Card, Badge, dll.
│   │   └── layout/             # Navbar, Footer
│   └── lib/                    # Utilities & config
│       ├── supabase/           # Supabase clients
│       ├── constants.js        # Enums & constants
│       └── utils.js            # Helper functions
│
├── services/                   # External services
│   └── telegram_bot/           # Telegram Bot (Python)
│       ├── run_bot.py          # Entry point bot
│       ├── app/                # Bot handlers, config, API
│       ├── domain/             # Domain models
│       ├── repositories/       # Data access (Supabase)
│       └── infra/              # Infrastructure clients
│
├── supabase/                   # Database
│   └── migrations/             # SQL migration files
│       ├── 001_initial_schema.sql
│       └── 002_telegram_bot_support.sql
│
└── public/                     # Static assets
```

---

## 🔔 Notifikasi Status Telegram

Alur notifikasi status berjalan lintas dua service:

1. Warga membuat laporan dari Telegram bot. Bot menyimpan `reports.user_id` dan `reports.reporter_id`.
2. Koordinator/petugas mengubah status laporan dari web.
3. Route web `PATCH /api/reports/[id]` memanggil `BOT_NOTIFY_URL/notifications/report`.
4. FastAPI bot service mencari Telegram ID warga dari tabel `reporters`, lalu mengirim pesan Telegram.
5. Pesan berisi tombol **Lacak Laporan** ke `APP_BASE_URL/tracking?code=<tracking_code>`.

Karena tombol Telegram harus memakai URL publik, `APP_BASE_URL` tidak boleh `localhost` jika dibuka dari HP. Untuk testing lokal, gunakan tunnel seperti ngrok atau Cloudflare Tunnel.

Untuk testing paling stabil lewat tunnel:

```bash
# Terminal 1: web production lokal
npm run build
npm run start

# Terminal 2: tunnel ke web
ngrok http 3000

# Terminal 3: bot polling
cd services/telegram_bot
source .venv/bin/activate
python run_bot.py

# Terminal 4: FastAPI bot service
cd services/telegram_bot
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Jika memakai `npm run dev` lewat ngrok, tambahkan domain ngrok ke `allowedDevOrigins` di `next.config.mjs`, atau gunakan wildcard seperti `*.ngrok-free.dev`. Dev mode memakai HMR/WebSocket dan bisa kurang stabil lewat tunnel.

## 🗄️ Database

Menggunakan **Supabase** (PostgreSQL). File migration yang harus dijalankan:

| File | Deskripsi |
|------|-----------|
| `001_initial_schema.sql` | Skema awal: tabel `reports`, `users`, `report_photos`, `assignments`, `status_history`, `schedules` + RLS policies |
| `002_telegram_bot_support.sql` | Menambahkan kolom `user_id`, `file_id`, `metadata`, `source` ke tabel `reports` untuk mendukung pelaporan dari Telegram bot |
| `003_multi_photo_support.sql` | Dukungan multi foto laporan |
| `004_reporters_and_categories.sql` | Tabel `reporters` untuk identitas warga Telegram dan relasi `reports.reporter_id` |
| `003_telegram_linking_and_sectors.sql` | Menambahkan tabel `sectors`, `sector_kelurahan`, dan tabel linking Telegram untuk koordinator/petugas |

> Jalankan di Supabase Dashboard → SQL Editor. Perhatikan dependensi: `004_reporters_and_categories.sql` membutuhkan fungsi `update_updated_at_column()` dari migration awal.

---

## 👥 Tim

**Tim MyMusicFavoriteGueh** — OmahTI UGM Internship 2026

| No | Nama | Role |
|----|------|------|
| 1 | *(isi)* | Project Manager & Product Owner |
| 2 | *(isi)* | AI Engineer |
| 3 | *(isi)* | Frontend Developer |
| 4 | *(isi)* | Backend Developer |
| 5 | *(isi)* | Business |

## 📅 Timeline

- **20 April** — Start
- **30 April** — Mid-check (GitHub + SRS)
- **7 Mei** — Final Submission (Video Demo)

## 📄 License

This project is built for the OmahTI UGM Internship 2026 competition.
