# System Context Document: Telegram Bot Pelaporan Sampah Jogja

## 1. Project Overview

Sistem ini menggantikan alur pelaporan sampah manual via WhatsApp yang membebani koordinator kelurahan. Telegram bot menjadi kanal input warga yang terhubung ke Supabase dan dashboard web ResikIn.

Target MVP tetap sama: warga bisa mengirim laporan yang cukup lengkap, koordinator bisa memverifikasi laporan, petugas bisa menerima tugas, dan warga bisa melacak status.

## 2. Tech Stack & Infrastructure

- **Backend Framework:** Python dengan FastAPI.
- **Telegram Library:** aiogram 3.x dengan FSM untuk fallback/manual flow.
- **Conversational AI:** DeepSeek via OpenAI-compatible SDK.
- **Image AI:** AI microservice melalui `AI_SERVICE_URL`.
- **Database:** Supabase PostgreSQL.
- **Dev Runtime:** Long polling Telegram.
- **API Runtime:** `run_bot.py` menjalankan FastAPI di background thread dan Telegram polling di main thread.

## 3. Core Architectural Decisions & Constraints

AI agent atau developer yang mengubah bot wajib mematuhi prinsip berikut:

- **Single Bot Architecture:** Satu bot terpusat untuk semua 45 kelurahan Kota Yogyakarta. Tidak ada multi-tenant bot token.
- **Hybrid AI + Deterministic Validator:** DeepSeek boleh mengarahkan percakapan dan mengekstrak kandidat data, tetapi Python validator adalah sumber kebenaran akhir sebelum laporan disimpan.
- **FSM Fallback:** FSM aiogram tetap wajib dipertahankan untuk fallback saat AI timeout, user terkena limit, atau bot membutuhkan pilihan manual seperti kelurahan/kategori.
- **No Supabase Storage:** Foto Telegram tidak diunggah ke Supabase Storage. Bot menyimpan `file_id`/`file_ids`, dan FastAPI menyediakan endpoint proxy gambar.
- **Simple Spatial Data:** Koordinat disimpan sebagai `latitude` dan `longitude` float, bukan PostGIS.
- **External Web App:** Dashboard/tracking dibuka lewat link web biasa, bukan Telegram Mini App.
- **AI Failure Must Be Safe:** Jika DeepSeek atau AI image service gagal, bot tidak boleh menyimpan laporan yang tidak lengkap. Fallback ke FSM/manual prompt harus tersedia.

## 4. Expected Bot Flow

Flow utama saat ini bukan FSM linear penuh, tetapi hybrid:

1. **/start**
   - Jika user belum punya nomor telepon, bot meminta contact button atau input nomor manual.
   - Jika user lama sudah punya nomor telepon, bot mulai mode percakapan AI.

2. **Percakapan AI**
   - User bisa menjelaskan masalah secara natural.
   - DeepSeek mengekstrak kandidat: nama, deskripsi, kelurahan, kategori.
   - Bot menyimpan progres di `user_state`.

3. **Lokasi GPS**
   - Lokasi wajib berasal dari Telegram location.
   - Bot mencoba reverse geocoding via Nominatim/OpenStreetMap.
   - Jika kelurahan hasil GPS bisa dipetakan ke daftar resmi, `kelurahan_id` diisi otomatis.
   - Jika tidak bisa dipetakan, bot meminta pilihan kelurahan manual.

4. **Foto**
   - Foto opsional, tetapi bot harus pernah menanyakan foto.
   - Jika user mengirim foto, bot memvalidasi gambar lewat `AI_SERVICE_URL`.
   - Foto valid disimpan sebagai Telegram `file_id`.
   - Foto spam/non-sampah tidak dihitung sebagai bukti laporan.
   - User boleh lanjut tanpa foto dengan menjawab seperti `tidak ada foto`, `skip`, atau `lewati`.

5. **Deterministic Validation**
   - Laporan hanya boleh disimpan jika validator Python menyatakan lengkap.
   - DeepSeek JSON `status: complete` hanya dianggap kandidat, bukan keputusan final.

6. **Persistence**
   - Bot menyimpan laporan ke Supabase dengan `source='telegram'` dan status awal `dikirim`.
   - Repository membuat entry awal di `status_history`.
   - Bot mengirim kode tracking ke warga.

## 5. Required Validation Before Save

Sebelum membuat `Report`, validator wajib memastikan:

- `reporter_name` ada.
- `description` minimal 10 karakter.
- `latitude` dan `longitude` ada.
- `kelurahan_id` cocok dengan salah satu dari 45 kelurahan resmi.
- `category` termasuk kategori resmi: `tidak_terangkut`, `tps_penuh`, `sampah_liar`, `bau`, `lainnya`.
- Salah satu benar: `photo_received=True` atau `photo_declined=True`.

Jika ada field kurang, bot harus bertanya field paling prioritas dan tidak menyimpan laporan.

## 6. Base Data Contract

Payload laporan dari bot ke Supabase minimal berisi:

- `id` UUID
- `user_id` Telegram user ID
- `reporter_id`
- `reporter_name`
- `reporter_phone`
- `kelurahan_id`
- `category`
- `file_ids`
- `description`
- `latitude`
- `longitude`
- `status='dikirim'`
- `source='telegram'`
- `metadata`

`tracking_code` dihasilkan oleh database trigger.
