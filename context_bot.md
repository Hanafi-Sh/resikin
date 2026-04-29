# **System Context Document: Telegram Bot Pelaporan Sampah Jogja**

## **1\. Project Overview**

Sistem ini bertujuan untuk menggantikan alur pelaporan sampah manual via WhatsApp yang membebani koordinator kelurahan (500-2.000 KK per kelurahan). Sistem memanfaatkan bot Telegram sebagai pintu masuk (input) tunggal untuk masyarakat , yang terhubung dengan sistem *backend* untuk validasi dan manajemen data. Target MVP difokuskan pada penyediaan kanal komunikasi yang jelas bagi warga dan *dashboard* manajemen sederhana bagi koordinator.

## **2\. Tech Stack & Infrastructure**

* **Backend Framework:** Python dengan FastAPI.

* **Telegram Library:** aiogram (mendukung *asynchronous* dan *Finite State Machine* / FSM).

* **Database:** Supabase (PostgreSQL).

* **Dev Environment:** Long Polling untuk *development* lokal.

* **Prod Environment:** Webhook untuk *deployment* akhir.

## **3\. Core Architectural Decisions & Constraints**

AI Agent WAJIB mematuhi arsitektur berikut saat meng- *generate* kode:

* **Single Bot Architecture:** Menggunakan satu entitas bot terpusat untuk semua 45 kelurahan di Jogja. Pengguna wajib memilih kelurahan mereka di awal alur pelaporan. Tidak ada implementasi *multi-tenant bot token*.

* **Sequential Input (FSM):** API Telegram tidak mengirimkan foto, teks, dan lokasi dalam satu *request*. Oleh karena itu, *state management* (FSM) via aiogram WAJIB diimplementasikan secara terurut: PILIH\_KELURAHAN \-\> UPLOAD\_FOTO \-\> INPUT\_DESKRIPSI \-\> SHARE\_LOCATION.

* **No Supabase Storage (MVP Hack):** Mengingat keterbatasan *resource* dan efisiensi, sistem TIDAK mengunggah file foto ke Supabase Storage. *Backend* hanya akan menyimpan file\_id dari Telegram API ke dalam PostgreSQL. *Backend* harus menyediakan sebuah *endpoint proxy* yang akan mengunduh dan men-*serve* gambar dari Telegram API secara *on-demand* (dengan *caching*) saat *frontend web* memintanya.

* **Data Spasial Simpel:** Koordinat lokasi dari Telegram disimpan menggunakan format *flat columns* bertipe float8 (latitude dan longitude) di dalam Supabase, bukan ekstensi PostGIS, untuk mempercepat iterasi MVP.

* **External Web App:** Integrasi *frontend dashboard* dilakukan murni via eksternal *link button* (membuka *browser* bawaan OS), bukan di-*embed* sebagai Telegram Mini App.

## **4\. Expected Bot Flow (Finite State Machine)**

Alur interaksi bot dengan pengguna harus berjalan persis seperti ini:

1. **/start:** Bot merespons dengan ucapan selamat datang dan *Inline Keyboard* berisi daftar kelurahan.  
2. **State: PILIH\_KELURAHAN:** Pengguna memilih kelurahan. Bot mengonfirmasi dan meminta foto.  
3. **State: UPLOAD\_FOTO:** Pengguna mengunggah gambar tumpukan sampah. Bot menangkap file\_id  dan meminta deskripsi teks.

4. **State: INPUT\_DESKRIPSI:** Pengguna mengetik detail pelaporan. Bot meminta koordinat lokasi.  
5. **State: SHARE\_LOCATION:** Pengguna mengirimkan *attachment location*. Bot merangkum laporan, meminta konfirmasi akhir.  
6. **Data Persistence:** Setelah dikonfirmasi, data disuntikkan ke Supabase, bot mengirim ID Laporan/Status penerimaan ke pengguna, dan FSM di-*reset*.

## **5\. Base API Contract (Database Schema Draft)**

Tabel pelaporan (misal: reports) minimal harus memuat skema berikut:

* id (UUID, Primary Key)  
* user\_id (String/BigInt, ID Telegram pengguna)  
* kelurahan\_id (Integer/String, referensi lokasi kelurahan)  
* file\_id (String, referensi gambar di server Telegram)

* description (Text)  
* latitude (Float8)

* longitude (Float8)

* status (Enum: pending, valid, invalid, resolved)  
* metadata (JSONB, celah fleksibilitas untuk *frontend* menambahkan atribut tanpa memecah skema *backend*)  
* created\_at (Timestamp)

