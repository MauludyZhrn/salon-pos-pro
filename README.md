# Salon POS Pro

Aplikasi kasir (POS), manajemen salon, membership loyalitas, booking jadwal, inventaris, dan pembukuan keuangan berbasis **Expo / React Native**. Dirancang **offline-first** menggunakan SQLite lokal sebagai sumber data utama, dilengkapi sinkronisasi multi-perangkat via **Supabase**, laporan **Google Sheets**, ekspor **Excel (.xlsx)**, serta cetak struk thermal Bluetooth (**ESC/POS**). Antarmuka responsif untuk mode **Portrait ↔ Landscape** pada smartphone maupun tablet.

---

## Fitur Utama

- **Kasir (POS) & Keranjang**
  - Katalog layanan (`service`) dan produk retail (`retail`) dengan pencarian, filter kategori, dan penyesuaian grid otomatis (`useResponsiveLayout`).
  - Pilihan stylist per layanan untuk perhitungan komisi otomatis.
  - Promo, diskon, dan biaya tambahan otomatis sesuai periode (`Settings > Promo, diskon & biaya tambahan`).
  - Metode pembayaran **Tunai**, **QRIS**, **Kartu (EDC BCA)**, dan **Split Payment** (serta kerangka integrasi **Midtrans** di `backend-midtrans/`).
- **Membership & Poin Loyalitas (`Profil > Membership & Poin`)**
  - **1x treatment = 10 poin**; produk retail tidak dihitung sebagai poin treatment.
  - **100 poin (10x treatment) = Gratis 1x treatment** yang bisa ditukar langsung di keranjang kasir (memotong 1 unit layanan 100%) atau diklaim dari halaman Membership.
  - Kartu visual **10-Stamp Treatment**, kode member otomatis (`MBR-0001`, dst.), catatan riwayat poin (`member_point_logs`), dan pembalikan poin otomatis bila transaksi di-*void*.
- **Booking Jadwal Stylist**
  - Tampilan agenda harian (smartphone) dan grid kolom per stylist (tablet/landscape).
  - Deteksi bentrok jadwal per stylist dan pelacakan status (`booked`, `confirmed`, `checked_in`, `in_progress`, `completed`, `no_show`, `cancelled`).
- **Riwayat & Koreksi Transaksi (`Profil > Riwayat Transaksi`)**
  - Filter periode (`Hari ini`, `7 hari`, `30 hari`, `Semua`), pencarian nomor struk/pelanggan, pratinjau & cetak ulang struk, serta koreksi transaksi untuk role yang berhak (`admin`).
- **Keuangan & Ekspor Excel (`Profil > Keuangan`)**
  - Jurnal akuntansi *double-entry* otomatis (`kas`, `piutang`, `pendapatan_jasa`, `pendapatan_retail`, `hpp_retail`, `hpp_bahan`, `beban_komisi`, `beban_operasional`, `hutang_komisi`).
  - Grafik **Laba Rugi (PnL)** dan **Arus Kas Harian** menggunakan `victory-native` + `@shopify/react-native-skia`.
  - Ekspor laporan 30 hari terakhir ke file `.xlsx`.
- **Layanan, Inventaris, Karyawan & RBAC**
  - Pengelolaan menu layanan beserta BOM (*bill of materials*) untuk pengurangan stok bahan baku otomatis saat transaksi.
  - Pengaturan komisi default (persentase basis poin / nominal tetap) dan akses berbasis role (**Admin**, **Kasir**, **Stylist**).
  - Login cepat dengan **PIN 4 digit** (setup akun Owner saat aplikasi pertama kali dijalankan).
- **Printer Thermal Bluetooth & Struk (`Profil > Printer & Struk`)**
  - Dukungan kertas **58 mm** (32 karakter) dan **80 mm** (48 karakter), logo hitam-putih 1-bit pada struk, serta info poin member.
- **Sinkronisasi Cloud & Google Sheets**
  - **Cloud Multi-Device (Supabase)**: replikasi tabel lokal (`sync_dirty` → `sync_rows`) antar perangkat kasir dan owner.
  - **Google Sheets (Apps Script)**: pengiriman laporan satu arah (`sheets_dirty` → Google Sheets tabs) secara otomatis saat online.

---

## Teknologi

| Komponen | Paket / Layanan |
| --- | --- |
| Framework | Expo SDK 57 (`~57.0.33`), React Native `0.86.3`, React `19.2.3` |
| Navigasi | `expo-router` (`~57.0.31`) |
| Styling | NativeWind v4 (`^4.2.7`) + Tailwind CSS v3 + tema token `Loyal Pink` |
| State Management | Zustand (`^5.0.15`) |
| Database Lokal | `expo-sqlite` (`~57.0.5`) — mode WAL, offline-first |
| Grafik & Export | `victory-native`, `@shopify/react-native-skia`, `xlsx` |
| Printer Thermal | `react-native-thermal-receipt-printer-image-qr` (dengan `patch-package`) |
| Build & OTA | EAS Build & EAS Update (`eas.json`) |

---

## Struktur Folder

```text
.
├── app/                              # File-based routing (Expo Router)
│   ├── _layout.tsx                   # Inisialisasi SQLite, seed, cloud sync, dan store
│   ├── index.tsx                     # Layar login PIN / setup Owner awal
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab bar utama (RBAC-filtered)
│   │   ├── pos.tsx                   # Tab Kasir
│   │   ├── booking.tsx               # Tab Booking
│   │   ├── cart.tsx                  # Tab Keranjang
│   │   └── more.tsx                  # Tab Profil (menu sekunder)
│   ├── membership.tsx                # Halaman Membership & Poin
│   ├── employees.tsx                 # Halaman Karyawan & Komisi
│   ├── history.tsx                   # Halaman Riwayat Transaksi
│   ├── finance.tsx                   # Halaman Keuangan & Export Excel
│   ├── services.tsx                  # Halaman Manajemen Layanan
│   ├── printer.tsx                   # Halaman Printer & Pengaturan Struk
│   ├── inventory.tsx                 # Halaman Inventaris
│   └── settings.tsx                  # Halaman Pengaturan, Promo, Cloud & Sheets
├── src/
│   ├── components/                   # Komponen UI per modul (booking, catalog, common, employee, finance, history, inventory, member, pos, printer, promo)
│   ├── constants/                    # Design tokens (theme.ts) & konfigurasi Supabase (cloud.ts)
│   ├── hooks/                        # useCatalog, useReceiptConfig, useResponsiveLayout, useStylists, useTodaySales
│   ├── screens/                      # Implementasi layar
│   ├── services/                     # SQLite database, cloudSync, syncQueue, printer, exportFinance, transactionRepo
│   ├── store/                        # Zustand stores (auth, booking, finance, inventory, member, pos, promo)
│   ├── types/                        # Definisi tipe TypeScript
│   └── utils/                        # Aritmetika uang integer (money.ts), membership, promo, komisi, struk, excel
├── google-apps-script/
│   └── Code.gs                       # Script Google Apps Script untuk sinkronisasi Google Sheets
├── supabase/
│   └── schema.sql                    # Skema tabel & RLS policy `public.sync_rows` di Supabase
├── backend-midtrans/                 # Server Express opsional untuk integrasi Midtrans Core API
├── docs/
│   ├── flowchart-keuangan.md         # Alur POS → jurnal → PnL
│   └── schema-sync.json              # Referensi skema sinkronisasi
├── patches/                          # Patch native library printer thermal (`patch-package`)
├── tools/
│   └── make-logo.py                  # Utilitas konversi logo ke PNG 1-bit untuk printer thermal
├── app.json
└── eas.json
```

---

## Prasyarat & Instalasi

1. **Node.js** (LTS), **npm**, dan **Expo / EAS CLI**.
2. Clone repository lalu instal dependensi:

```bash
git clone https://github.com/MauludyZhrn/salon-pos-pro.git
cd salon-pos-pro
npm install
```

> File `.npmrc` sudah menyertakan `legacy-peer-deps=true` dan `package.json` menjalankan `patch-package` pada tahap `postinstall`.

3. **Typecheck**:

```bash
npx tsc --noEmit
```

---

## Menjalankan & Build (Expo / EAS)

Karena aplikasi menggunakan modul native seperti `expo-sqlite`, `@shopify/react-native-skia`, dan `react-native-thermal-receipt-printer-image-qr`, aplikasi dijalankan menggunakan **Development Build** (bukan Expo Go standar).

### 1. Menjalankan Dev Server Lokal

```bash
npx expo start --dev-client
```

Atau jalankan native build lokal Android:

```bash
npx expo run:android
```

### 2. Build APK via EAS

Konfigurasi profil build tersedia di `eas.json` (`development`, `preview`, `production`):

```bash
# Build development client Android (APK)
npx eas-cli build --profile development --platform android

# Build internal preview Android (APK)
npx eas-cli build --profile preview --platform android
```

### 3. Mengirim Update OTA (EAS Update)

```bash
npx eas-cli update --branch preview --environment preview --message "Deskripsi perubahan"
```

---

## Setup Sinkronisasi (Opsional)

### A. Cloud Multi-Device (Supabase)

1. Buat project Supabase dan jalankan isi `supabase/schema.sql` pada **Supabase SQL Editor** (membuat tabel `public.sync_rows`, sequence `sync_seq`, serta RLS policy untuk user `authenticated`).
2. Buat akun user outlet di **Supabase Authentication > Users** (email & password).
3. Sesuaikan `CLOUD_URL` dan `CLOUD_ANON_KEY` di `src/constants/cloud.ts` dengan project Supabase Anda.
4. Masuk melalui **Pengaturan > Cloud (multi-device)** pada perangkat kasir dan owner dengan akun yang sama.

### B. Laporan Google Sheets (Apps Script)

1. Buat Google Sheets baru → **Extensions > Apps Script**.
2. Salin isi `google-apps-script/Code.gs` ke editor Apps Script.
3. Simpan `API_KEY` rahasia di **Project Settings > Script Properties** dengan nama key `API_KEY` (atau isi langsung pada variabel `API_KEY` di editor Apps Script).
4. **Deploy > New deployment > Web app** → *Execute as: Me*, *Who has access: Anyone*.
5. Salin URL `/exec` dan `API_KEY` ke menu **Pengaturan > Google Sheets (laporan)** di dalam aplikasi.

### C. Backend Midtrans (Opsional)

```bash
cd backend-midtrans
npm install
cp .env.example .env   # Isi MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, dan APP_SHARED_KEY
npm start
```

Lalu sesuaikan endpoint dan `APP_SHARED_KEY` di `src/services/midtransService.ts`.

---

## Catatan Keamanan & Keuangan

- **Jangan pernah menyimpan secret produksi di Git**: `MIDTRANS_SERVER_KEY`, `API_KEY` Apps Script, file `.env`, dan file keystore (`.jks`/`.keystore`) diabaikan oleh `.gitignore`.
- **PIN Hashing**: `src/store/authStore.ts` saat ini memakai fungsi hash ringan (`v1:...`). Untuk pengerasan keamanan produksi, disarankan menggantinya dengan hash kriptografis seperti `expo-crypto` (SHA-256).
- **Presisi Keuangan**: Seluruh perhitungan uang menggunakan **integer Rupiah** (tanpa floating-point) dengan bantuan `BigInt` di `src/utils/money.ts`. Persentase diskon/komisi dihitung dalam *basis poin* ($1/10000$) dan dibulatkan *half-up* ke Rupiah terdekat.

---

## Lisensi

Lihat file [LICENSE](LICENSE).
