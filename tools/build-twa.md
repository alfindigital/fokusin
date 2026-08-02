# Bungkus Fokusin jadi APK/AAB Play Store

Resep TWA (Trusted Web Activity) pakai Bubblewrap. **Belum dijalankan.** Ini rencana,
bukan laporan. Baca `HANDOFF.md` §9 dulu, ada tiga risiko nyata di situ.

## Prasyarat (belum ada di PC ini, sudah dicek 1 Agu 2026)

| Alat | Status | Cara pasang |
|---|---|---|
| Node 24.15 | ADA | sudah |
| JDK 17 | **TIDAK ADA** | https://adoptium.net (Temurin 17, installer .msi) |
| Android SDK | **TIDAK ADA** | Android Studio, atau cmdline-tools saja |
| Bubblewrap | belum | `npm i -g @bubblewrap/cli` |

Bubblewrap bisa mengunduh JDK dan SDK sendiri saat `init` pertama kalau kamu izinkan.
Sekitar 3-5 GB.

## Syarat mutlak: app harus sudah live di HTTPS

TWA memuat situs asli, bukan file lokal. Deploy dulu:

```
cd path/ke/fokusin
node tools/build-dist.js
npx wrangler pages deploy dist --project-name fokusin
```

**Dari `dist`, jangan dari `.`** Alasannya di `TIPS-DAN-TRIK.md`, jebakan G.

Catat URL hasilnya. Semua langkah di bawah butuh URL itu.

## Langkah

```
npm i -g @bubblewrap/cli
mkdir ../fokusin-android
cd ../fokusin-android

bubblewrap init --manifest https://GANTI-DOMAIN-KAMU/manifest.webmanifest
```

Jawaban yang disarankan saat ditanya:

| Pertanyaan | Jawaban |
|---|---|
| Application ID | `id.alfindigital.fokusin` (harus unik selamanya, tidak bisa diubah setelah rilis) |
| App name | `Fokusin` |
| Launcher name | `Fokusin` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#0B0B0C` |
| Splash color | `#0B0B0C` |
| Icon URL | `https://GANTI-DOMAIN-KAMU/icons/icon-512.png` |
| Maskable icon URL | `https://GANTI-DOMAIN-KAMU/icons/maskable-512.png` |
| Include support for shortcuts | `yes` |
| Signing key | bikin baru. **Backup file .keystore dan passwordnya.** Hilang = tidak bisa update app selamanya. |

Build:

```
bubblewrap build
```

Output: `app-release-signed.aab` (untuk Play Store) dan `app-release-signed.apk`
(untuk tes langsung di HP).

Tes di HP dulu sebelum submit:

```
adb install app-release-signed.apk
```

## Digital Asset Links (WAJIB, kalau lupa app tampil dengan address bar Chrome)

`bubblewrap build` menghasilkan `assetlinks.json`. File itu **harus** disajikan di:

```
https://GANTI-DOMAIN-KAMU/.well-known/assetlinks.json
```

Taruh di `Fokusin/.well-known/assetlinks.json` lalu deploy ulang. Verifikasi:

```
curl https://GANTI-DOMAIN-KAMU/.well-known/assetlinks.json
```

Harus mengembalikan JSON, bukan 404. Kalau 404, TWA jatuh ke mode Custom Tab dan
address bar Chrome kelihatan. Itu terlihat murahan dan sering ditolak review.

## Aset Play Store yang harus disiapkan

| Aset | Spek | Status |
|---|---|---|
| Ikon app | 512x512 PNG | ADA (`icons/icon-512.png`) |
| Feature graphic | 1024x500 PNG | **BELUM** |
| Screenshot HP | min 2, min 1080x1920 | **BELUM** (bisa diambil dari Chrome DevTools mode perangkat) |
| Deskripsi singkat | maks 80 karakter | **BELUM** |
| Deskripsi lengkap | maks 4000 karakter | **BELUM** |
| Kebijakan privasi | URL publik, WAJIB | **BELUM** |
| Kuesioner keamanan data | isi di Play Console | **BELUM** |

Kebijakan privasi bisa satu halaman statis. Isinya jujur saja: app ini tidak mengumpulkan
data apapun, tidak ada analytics, tidak ada server, semua disimpan di localStorage
perangkat pengguna. Itu benar, dan itu justru poin jual.

## Biaya

- Akun developer Google Play: **USD 25 sekali bayar seumur hidup**
- Sisanya nol

## Peringatan jujur

Baca `HANDOFF.md` §9. Ringkasnya: **timer background tidak akan bisa diandalkan di TWA.**
Kalau Android mematikan proses, alarm tidak bunyi. Untuk app pomodoro itu masalah
serius dan pemicu ulasan bintang 1 nomor satu. Selesaikan itu dulu, atau terima
keterbatasannya dan tulis apa adanya di deskripsi Play Store.
