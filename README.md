# Salon POS Pro

Aplikasi Kasir (POS) + Manajemen Salon + Finance Profesional. Expo/React
Native, offline-first (SQLite lokal), sync berkala ke Google Sheets via
Apps Script. Responsif penuh Portrait ↔ Landscape, phone ↔ tablet.

## Struktur Folder

```
salon-pos-app/
├── app/                          # expo-router routes
│   ├── _layout.tsx                # root: init DB, seed, sync listener
│   ├── index.tsx                  # PIN login screen
│   └── (tabs)/
│       ├── _layout.tsx            # tab bar, filtered by RBAC role
│       ├── pos.tsx
│       ├── booking.tsx
│       ├── finance.tsx
│       ├── inventory.tsx
│       ├── employees.tsx
│       └── settings.tsx
├── src/
│   ├── components/
│   │   ├── pos/ProductGrid.tsx, CartPanel.tsx, PaymentModal.tsx
│   │   ├── booking/CalendarView.tsx
│   │   ├── finance/PnLChart.tsx, CashFlowChart.tsx
│   │   └── common/Button.tsx, Card.tsx
│   ├── hooks/
│   │   ├── useResponsiveLayout.ts  # orientation/column-count math
│   │   └── useCatalog.ts
│   ├── screens/                    # full-screen compositions used by app/
│   ├── services/
│   │   ├── database.ts             # SQLite schema + migrations
│   │   ├── syncQueue.ts            # offline outbox + push to Apps Script
│   │   ├── printerService.ts       # ESC/POS Bluetooth thermal printing
│   │   └── midtransService.ts      # payment gateway client contract
│   ├── store/                      # zustand: auth, pos, inventory, booking, finance
│   ├── utils/
│   │   ├── money.ts                # integer-Rupiah arithmetic, no floats
│   │   ├── commission.ts
│   │   └── transaction.ts          # cart → totals → journal entries
│   ├── constants/theme.ts          # design tokens
│   └── types/index.ts
├── google-apps-script/Code.gs      # paste into Apps Script editor
├── backend-midtrans/                # Express backend holding Midtrans Server Key
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── flowchart-keuangan.md       # Mermaid: POS → jurnal → PnL
│   └── schema-sync.json            # full sync schema, all sheets/columns
├── app.json / package.json / tsconfig.json / babel.config.js / tailwind.config.js
```

Flowchart lengkap: lihat `docs/flowchart-keuangan.md`.
Skema sync lengkap: lihat `docs/schema-sync.json`.

## Instalasi

```bash
npx create-expo-app@latest salon-pos-app --template blank-typescript
# lalu copy seluruh isi folder ini (app/, src/, google-apps-script/, docs/,
# app.json, babel.config.js, tailwind.config.js, global.css) menimpa hasil create-expo-app

npx expo install expo-router expo-screen-orientation expo-sqlite expo-print \
  expo-constants expo-status-bar expo-haptics expo-linking \
  react-native-safe-area-context react-native-screens react-native-gesture-handler \
  react-native-reanimated react-native-svg

npm install zustand nativewind tailwindcss @react-native-async-storage/async-storage \
  @react-native-community/netinfo date-fns zod \
  react-native-bluetooth-escpos-printer react-native-calendars victory-native

npx tailwindcss init   # only if tailwind.config.js wasn't copied over correctly
```

> `react-native-bluetooth-escpos-printer` dan beberapa modul native lain
> **tidak** jalan di Expo Go — build dev client:
> ```bash
> npx expo install expo-dev-client
> npx expo prebuild
> npx expo run:android   # atau: eas build --profile development --platform android
> ```

## Menjalankan

```bash
npx expo start --dev-client
```

Login demo: pilih karyawan apa saja di PIN pad, PIN = `1111` (lihat
`src/services/seed.ts`). Data katalog, inventaris, dan karyawan contoh
di-seed otomatis saat database kosong.

## Menguji Responsivitas Portrait/Landscape

1. Buka tab **Kasir** di emulator/device tablet.
2. Putar orientasi (Ctrl+F11 di Android emulator, atau rotasi device fisik).
3. Perhatikan:
   - `posGridColumns` berubah (2 kolom di phone sempit → 5 kolom di tablet landscape) — lihat `src/hooks/useResponsiveLayout.ts`.
   - Di landscape lebar ≥700px, keranjang (`CartPanel`) pindah dari bottom-sheet menjadi side-rail tetap (`useSidePanel`).
   - Tab **Booking**: kalender berubah dari agenda list (phone) ke grid kolom-per-stylist (tablet/landscape) — `useWideCalendar`.
4. Tidak perlu reload manual — `useWindowDimensions` dari React Native sudah reaktif terhadap rotasi, jadi re-render terjadi otomatis pada frame yang sama dengan perubahan dimensi.

Untuk mengunci orientasi per-layar (misal POS selalu landscape di tablet
kasir), panggil `useOrientationLock(ScreenOrientation.OrientationLock.LANDSCAPE)`
di dalam screen tersebut — lihat komentar di `useResponsiveLayout.ts`.

## Menguji Integrasi Google Sheets

1. Buka Google Sheets baru → Extensions → Apps Script.
2. Paste isi `google-apps-script/Code.gs`.
3. Ganti `API_KEY` dengan secret acak yang panjang.
4. Deploy → New deployment → Web app → Execute as **Me**, Access **Anyone**.
5. Copy URL `/exec` yang dihasilkan.
6. Di app: tab **Pengaturan** → isi URL dan API Key → **Simpan**.
7. Lakukan transaksi POS apa saja → buka tab **Pengaturan** → **Sync sekarang** (atau tunggu auto-sync saat reconnect jaringan).
8. Cek Google Sheets: tab `Transactions`, `TransactionItems`, `JournalEntries` otomatis terbuat dan terisi.
9. Uji offline: aktifkan mode pesawat, lakukan transaksi (tetap tersimpan lokal), nonaktifkan mode pesawat → sync otomatis berjalan via `NetInfo` listener di `syncQueue.ts`.

## Keamanan — hal yang WAJIB diganti sebelum produksi

- **PIN hashing**: `authStore.ts` dan `seed.ts` memakai hash DJB2 sederhana
  (bukan kriptografis) supaya skill package tetap minim dependency. Ganti
  dengan `expo-crypto`:
  ```ts
  import * as Crypto from "expo-crypto";
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
  ```
  Terapkan di kedua file sekaligus (hash lama tidak akan cocok lagi — reset PIN karyawan setelah migrasi).
- **Midtrans Server Key**: jangan pernah taruh di app. Backend siap pakai
  ada di `backend-midtrans/` (Express + `midtrans-client`):
  ```bash
  cd backend-midtrans
  npm install
  cp .env.example .env   # isi MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, APP_SHARED_KEY
  npm start               # listen di :3000
  ```
  Deploy ke Railway/Render/Fly/Cloud Run, lalu di `src/services/midtransService.ts`
  ganti `CHARGE_ENDPOINT`/`STATUS_ENDPOINT` ke URL deploy, dan `APP_SHARED_KEY`
  samakan dengan `.env`. Set Notification URL di Midtrans Dashboard ke
  `https://<domain-backend>/midtrans/notification` (webhook settlement async).
- **Apps Script API_KEY**: generate dengan `openssl rand -hex 32`, jangan commit ke git.

## Catatan Presisi Keuangan

Semua nominal uang adalah **integer Rupiah**, tidak pernah `float`. Lihat
`src/utils/money.ts` — penjumlahan/pengurangan pakai `BigInt` internal,
persentase (diskon/pajak/komisi) dihitung dalam basis poin (1/10000) lalu
dibulatkan half-up ke Rupiah terdekat. Jangan pernah menyimpan uang sebagai
`number` dengan desimal di bagian manapun dari kode ini.
