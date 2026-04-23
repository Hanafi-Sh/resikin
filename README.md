# 🌿 ResikIn — Sistem Pelaporan & Koordinasi Sampah Kelurahan

> Laporkan. Pantau. Bersihkan.

ResikIn adalah platform web untuk pelaporan dan koordinasi masalah sampah di tingkat kelurahan Kota Yogyakarta. Dibangun sebagai solusi atas masalah komunikasi yang tidak terstruktur antara warga, koordinator kelurahan, dan petugas lapangan DLH.

## 🎯 Fitur Utama

- **📝 Pelaporan Warga** — Form digital sederhana, tanpa perlu membuat akun
- **🔍 Tracking Realtime** — Pantau status laporan dengan nomor tracking unik
- **📊 Dashboard Koordinator** — Kelola semua laporan dari satu tempat
- **👷 Panel Petugas** — Daftar tugas harian dengan navigasi lokasi
- **🔔 Notifikasi Status** — Perubahan status tercatat dan dapat dilacak
- **📋 Info Publik** — Pengumuman dan tips kebersihan

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14+ (React) + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Maps | Leaflet.js + OpenStreetMap |
| Deploy | Vercel |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ dan npm
- Akun [Supabase](https://supabase.com) (gratis)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-username/resikin.git
cd resikin

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.local.example .env.local
# Edit .env.local dan isi SUPABASE_URL + SUPABASE_ANON_KEY

# 4. Setup database
# Buka Supabase Dashboard → SQL Editor
# Jalankan file: supabase/migrations/001_initial_schema.sql

# 5. Run development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## 📁 Struktur Folder

```
src/
├── app/              # Halaman (App Router)
│   ├── page.js       # Landing page
│   ├── lapor/        # Form laporan
│   ├── tracking/     # Tracking status
│   ├── dashboard/    # Dashboard koordinator
│   ├── petugas/      # Panel petugas
│   └── api/          # API Routes
├── components/       # Komponen reusable
│   ├── ui/           # Button, Card, Badge, dll.
│   ├── layout/       # Navbar, Footer
│   ├── forms/        # Form components
│   └── maps/         # Map components
└── lib/              # Utilities & config
    ├── supabase/     # Supabase clients
    ├── constants.js  # Enums & constants
    └── utils.js      # Helper functions
```

## 👥 Tim

**Tim MyMusicFavoriteGueh** — OmahTI UGM Internship 2026

| No | Nama | Role |
|----|------|------|
| 1 | *(isi)* | Project Manager & Product Owner |
| 2 | *(isi)* | UI/UX Designer |
| 3 | *(isi)* | Frontend Developer |
| 4 | *(isi)* | Backend Developer |
| 5 | *(isi)* | Fullstack Developer |

## 📅 Timeline

- **20 April** — Start
- **30 April** — Mid-check (GitHub + SRS)
- **7 Mei** — Final Submission (Video Demo)

## 📄 License

This project is built for the OmahTI UGM Internship 2026 competition.
