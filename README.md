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
- **🤖 Validasi Foto AI** — Foto laporan dianalisis lewat AI microservice untuk mendeteksi apakah gambar relevan dengan sampah
- **🧭 Rekomendasi Petugas AI** — Dashboard dapat meminta rekomendasi penugasan petugas berdasarkan kategori dan beban kerja aktif
- **🔍 Tracking Realtime** — Pantau status laporan dengan nomor tracking unik
- **📊 Dashboard Koordinator** — Kelola semua laporan dari satu tempat
- **👷 Panel Petugas** — Daftar tugas harian dengan navigasi lokasi
- **🔔 Notifikasi Status Telegram** — Warga pelapor dari bot menerima update saat status laporan berubah
- **📋 Info Publik** — Pengumuman dan tips kebersihan

### 🤖 Telegram Bot
- **💬 Pelaporan via FSM Telegram** — Warga membuat laporan lewat alur terstruktur yang konsisten dan mudah diuji
- **🛡️ Guardrail Deterministik** — Data laporan tetap divalidasi Python sebelum disimpan
- **📷 Foto Opsional + Validasi AI** — Foto bisa dikirim dari chat dan divalidasi lewat AI service; warga juga bisa lanjut tanpa foto
- **📍 Share Lokasi Wajib** — Gunakan fitur location Telegram untuk titik koordinat yang akurat
- **🏘️ Deteksi/Pilih Kelurahan** — Bot mencoba membaca kelurahan dari GPS dan fallback ke pilihan manual 45 kelurahan Yogyakarta
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
| AI Proxy | Next.js API Routes ke AI microservice |
| Deploy | Vercel |

### Telegram Bot

| Layer | Teknologi |
|-------|-----------|
| Bot Framework | aiogram 3.27 (Python, async) |
| API Server | FastAPI (notifikasi status, image proxy & health check) |
| Image AI | Python AI microservice via `AI_SERVICE_URL` |
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
# Untuk endpoint server web yang perlu bypass RLS:
#   - SUPABASE_SERVICE_ROLE_KEY (server-only, jangan pakai NEXT_PUBLIC_)
# Optional (notifikasi bot):
#   - BOT_NOTIFY_URL (contoh: https://bot.example.com)
#   - BOT_NOTIFY_SECRET (shared secret)
#   - NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (untuk deep link /start)
# Optional (AI microservice):
#   - AI_SERVICE_URL (contoh: https://ai.example.com)

# 4. Setup database
# Buka Supabase Dashboard → SQL Editor
# Jalankan file secara berurutan:
#   - supabase/migrations/001_initial_schema.sql
#   - supabase/migrations/002_telegram_bot_support.sql
#   - supabase/migrations/003_multi_photo_support.sql
#   - supabase/migrations/004_reporters_and_categories.sql
#   - supabase/migrations/003_telegram_linking_and_sectors.sql
#   - supabase/migrations/005_create_report_intake_function.sql
#   - supabase/migrations/006_create_report_workflow_function.sql

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
#   - AI_SERVICE_URL (untuk validasi foto dari bot)

# 4. Jalankan bot + FastAPI notification server dalam satu proses
python run_bot.py
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

`run_bot.py` terbaru menjalankan Telegram long polling dan FastAPI notification server sekaligus. FastAPI tetap dapat dijalankan terpisah dengan `uvicorn app.main:app` jika hanya ingin men-debug endpoint API, tetapi untuk operasi bot normal cukup jalankan `python run_bot.py`.

Karena tombol Telegram harus memakai URL publik, `APP_BASE_URL` tidak boleh `localhost` jika dibuka dari HP. Untuk testing lokal, gunakan tunnel seperti ngrok atau Cloudflare Tunnel.

Untuk testing paling stabil lewat tunnel:

```bash
# Terminal 1: web production lokal
npm run build
npm run start

# Terminal 2: tunnel ke web
ngrok http 3000

# Terminal 3: bot polling + FastAPI bot service
cd services/telegram_bot
source .venv/bin/activate
python run_bot.py
```

Jika memakai `npm run dev` lewat ngrok, tambahkan domain ngrok ke `allowedDevOrigins` di `next.config.mjs`, atau gunakan wildcard seperti `*.ngrok-free.dev`. Dev mode memakai HMR/WebSocket dan bisa kurang stabil lewat tunnel.

## 📷 Foto Laporan di Website

Website menampilkan foto laporan dari dua sumber berbeda:

| Sumber | Lokasi Data | Cara Ditampilkan |
|--------|-------------|------------------|
| Form web / foto penyelesaian petugas | `report_photos.photo_url` | URL Supabase Storage langsung |
| Telegram bot | `reports.file_ids` | URL proxy `BOT_NOTIFY_URL/telegram/file/{file_id}` |

Foto yang dikirim warga lewat Telegram **tidak di-upload ulang ke Supabase Storage**. Bot menyimpan `file_id` Telegram di `reports.file_ids`, lalu web API menormalisasi data tersebut menjadi item `report_photos` sementara agar komponen UI bisa menampilkan semua foto lewat bentuk data yang sama.

Endpoint web yang menggabungkan foto Storage dan foto Telegram:

- `GET /api/reports`
- `GET /api/reports/[id]`
- `GET /api/assignments`
- `GET /api/tracking/[code]`
- `GET /api/public-reports`

Syarat agar foto Telegram muncul:

1. Laporan di Supabase punya `reports.file_ids`.
2. `BOT_NOTIFY_URL` di `.env.local` web mengarah ke FastAPI bot service.
3. FastAPI bot service aktif dan endpoint `GET /telegram/file/{file_id}` bisa diakses dari browser.

Contoh lokal:

```env
BOT_NOTIFY_URL=http://localhost:8000
```

Lalu jalankan:

```bash
# Terminal 1
cd services/telegram_bot
source .venv/bin/activate
python run_bot.py

# Terminal 2
npm run dev
```

UI memakai galeri foto reusable dengan thumbnail lebih besar dan modal zoom saat foto diklik. Galeri ini dipakai di detail laporan koordinator, detail tugas petugas, dan tracking warga.

### Foto Bukti Penyelesaian Petugas

Saat petugas menandai tugas sebagai `selesai`, foto bukti penyelesaian di-upload lewat `POST /api/upload` dengan payload form-data:

| Field | Keterangan |
|-------|------------|
| `file` | File gambar |
| `report_id` | ID laporan |
| `type` | `completion` |

Route `/api/upload` melakukan dua hal:

1. Upload file ke bucket Supabase Storage `report-photos`.
2. Insert metadata ke tabel `report_photos` dengan `type='completion'`.

Karena insert ke `report_photos` bisa terkena Row Level Security, `.env.local` root web perlu punya:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

Key ini hanya boleh dipakai server-side. Jangan pernah menamainya `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, karena prefix `NEXT_PUBLIC_` akan mengekspos nilainya ke browser.

Env web dan env bot terpisah. Key yang ada di `services/telegram_bot/.env` hanya dibaca oleh service Python bot, sedangkan route Next.js membaca `.env.local` di root project.

Jika muncul error `new row violates row-level security policy` saat petugas upload foto penyelesaian, biasanya `SUPABASE_SERVICE_ROLE_KEY` belum ada di `.env.local`, server Next.js belum di-restart setelah env ditambahkan, atau deployment belum memasang env tersebut.

## 🤖 AI Services

ResikIn memakai AI di dua tempat:

| Area | Env | Fungsi |
|------|-----|--------|
| Web App | `AI_SERVICE_URL` | Proxy validasi foto laporan dan rekomendasi petugas ke AI microservice |
| Telegram Bot | `AI_SERVICE_URL` | Validasi foto dari Telegram sebelum dianggap bukti sampah |

Endpoint AI microservice yang dipakai web app:

```txt
POST <AI_SERVICE_URL>/api/ai/validate-image
POST <AI_SERVICE_URL>/api/ai/recommend-assignment
```

Di web app, `AI_SERVICE_URL` adalah base URL service. Di bot Telegram, `AI_SERVICE_URL` menunjuk langsung ke endpoint validasi foto, misalnya `https://ai.example.com/api/validate-image`. Jika AI service tidak tersedia, web route akan memberi respons error/fallback sesuai endpoint, sedangkan bot tetap melanjutkan FSM dan menjaga data wajib sebelum laporan disimpan.

## 🗄️ Database

Menggunakan **Supabase** (PostgreSQL). File migration yang harus dijalankan:

| File | Deskripsi |
|------|-----------|
| `001_initial_schema.sql` | Skema awal: tabel `reports`, `users`, `report_photos`, `assignments`, `status_history`, `schedules` + RLS policies |
| `002_telegram_bot_support.sql` | Menambahkan kolom `user_id`, `file_id`, `metadata`, `source` ke tabel `reports` untuk mendukung pelaporan dari Telegram bot |
| `003_multi_photo_support.sql` | Dukungan multi foto laporan |
| `004_reporters_and_categories.sql` | Tabel `reporters` untuk identitas warga Telegram dan relasi `reports.reporter_id` |
| `003_telegram_linking_and_sectors.sql` | Menambahkan tabel `sectors`, `sector_kelurahan`, dan tabel linking Telegram untuk koordinator/petugas |
| `005_create_report_intake_function.sql` | Memusatkan pembuatan laporan baru, kode tracking, foto awal, dan status history awal dalam fungsi database |
| `006_create_report_workflow_function.sql` | Memusatkan perubahan status, assignment, foto penyelesaian, dan status history alur penanganan laporan dalam fungsi database |

> Jalankan di Supabase Dashboard → SQL Editor. Perhatikan dependensi: `004_reporters_and_categories.sql` membutuhkan fungsi `update_updated_at_column()` dari migration awal.
> Urutan canonical juga dicatat di [`docs/database/migration-order.md`](docs/database/migration-order.md).

## 🔔 Kontrak Notifikasi

Kontrak event antara web app dan Telegram bot service dicatat di [`docs/contracts/report-notifications.md`](docs/contracts/report-notifications.md). Kode baru harus memakai event canonical `report.created`, `report.assigned`, dan `report.status_changed`.

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
