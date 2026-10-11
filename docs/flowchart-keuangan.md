# Alur Sistem Keuangan — Salon POS Pro

Transaksi POS → jurnal → laporan. Semua nilai uang integer (sen/rupiah terkecil), tanpa float.

```mermaid
flowchart TD
    A[Transaksi POS dimulai] --> B[Tambah item: layanan / retail]
    B --> C{Auto-deduct inventaris?}
    C -->|Ya, bahan baku/retail| D[Kurangi stok di inventoryStore]
    D --> E{Stok di bawah ambang?}
    E -->|Ya| F[Trigger low-stock alert]
    E -->|Tidak| G[Lanjut]
    F --> G
    C -->|Tidak, jasa tanpa bahan| G

    G --> H[Hitung subtotal integer/sen]
    H --> I[Terapkan diskon]
    I --> J[Hitung pajak PPN]
    J --> K{Metode pembayaran}
    K -->|Cash| L[Catat pembayaran cash]
    K -->|Midtrans QRIS/CC/VA| M[Buat payment intent Midtrans]
    K -->|Split payment| N[Alokasikan nominal per metode, sisa ke metode terakhir]

    M --> O{Callback Midtrans}
    O -->|settlement| L
    O -->|pending| P[Status: menunggu pembayaran]
    O -->|deny/expire| Q[Transaksi batal, rollback stok]
    Q --> D

    L --> R[Transaksi LUNAS]
    N --> R
    R --> S[Hitung komisi stylist per item]
    S --> T[Tulis entri jurnal operasional harian]
    T --> U[Entry ganda: Debit Kas/Piutang, Kredit Pendapatan Jasa/Retail]
    U --> V[Cetak struk thermal via Bluetooth]
    U --> W[Push ke syncQueue -> offline-first]

    W --> X{Jaringan tersedia?}
    X -->|Tidak| Y[Simpan di SQLite outbox, status PENDING]
    X -->|Ya| Z[POST batch ke Google Apps Script Web App]
    Y --> X
    Z --> AA{Respons 200 + ack?}
    AA -->|Ya| AB[Tandai SYNCED, hapus dari outbox]
    AA -->|Tidak/timeout| AC[Retry exponential backoff, tetap PENDING]
    AC --> X

    T --> AD[Agregasi harian: Jurnal Harian]
    AD --> AE[Hitung Cash Flow: kas masuk - kas keluar - komisi dibayar]
    AD --> AF[Hitung PnL: Pendapatan - HPP bahan - Komisi - Beban Operasional]
    AE --> AG[Dashboard Finance: chart PnL & Cash Flow]
    AF --> AG
    AG --> AH[Export/rekonsiliasi ke Google Sheets Ledger tab]
```

## Prinsip kunci

1. **Semua nominal uang** disimpan sebagai integer dalam satuan rupiah terkecil (tidak ada desimal rupiah → langsung integer rupiah, bukan float). Lihat `src/utils/money.ts`.
2. **Double-entry sederhana**: setiap transaksi POS menghasilkan minimal 2 baris jurnal (debit akun kas/piutang, kredit akun pendapatan), plus baris HPP dan komisi saat berlaku.
3. **Offline-first**: UI tidak pernah menunggu jaringan. Semua write masuk SQLite dulu → outbox table → background sync worker mendorong ke Apps Script.
4. **Idempotent sync**: setiap transaksi punya `localId` (UUID) yang dikirim ke Sheets sebagai primary key, sehingga retry tidak menduplikasi baris (Apps Script melakukan upsert berdasarkan `localId`).
5. **Rollback stok**: jika pembayaran Midtrans deny/expire, stok yang sudah di-deduct dikembalikan.
