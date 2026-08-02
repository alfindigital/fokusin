# Fokusin

Timer pomodoro Bahasa Indonesia. Offline, tanpa akun, tanpa iklan, tanpa tracking.

**[Coba sekarang -> fokusin.pages.dev](https://fokusin.pages.dev/)**

Nol dependency. Nol build step. 154 KB. Buka `index.html`, jalan.

---

## Kenapa ini ada

Hampir semua app pomodoro punya masalah yang sama: minta bikin akun, kasih iklan,
timernya melenceng kalau tab pindah ke background, dan tampilannya seragam karena semua
pakai ring progress lingkaran yang sama.

Fokusin dibikin buat memperbaiki empat hal itu sekaligus, dalam satu file HTML yang bisa
dibuka tanpa internet.

## Fitur

- **Timer anti-drift.** Pakai deadline timestamp, bukan counter `setInterval`. Terukur
  meleset **0 detik** setelah 5 detik berjalan, dan tetap akurat walau tab di background.
- **Offline sungguhan.** Service worker cache-first. Sekali dibuka, jalan tanpa internet.
- **Installable (PWA).** Tambahkan ke home screen, jalan fullscreen seperti app biasa.
- **Progress sebagai halaman keisi**, bukan ring lingkaran. Layar terisi dari bawah
  seiring waktu, ditambah garis rambut yang naik.
- **Aksen berganti per mode.** Fokus oranye, Rehat hijau, Rehat Panjang biru.
- **Statistik jujur.** Sesi yang di-**Lewati tidak dihitung**. Kalau skip tetap dihitung,
  statistik dan streak jadi nggak berarti.
- **Wake Lock.** Layar nggak mati selama sesi berjalan (butuh HTTPS).
- **Tema gelap dan terang**, keduanya lolos kontras WCAG AA.
- **Pintasan keyboard.** `Space` mulai/jeda, `R` ulang, `S` lewati, `1/2/3` ganti mode.
- **Nol tracking.** Nol analytics, nol cookie, nol permintaan ke server pihak ketiga
  selain font Google. Semua data di `localStorage` perangkat kamu.

## Jalanin lokal

Nggak ada `npm install`. Cukup layani foldernya lewat HTTP (service worker butuh
`http://` atau `https://`, nggak jalan dari `file://`):

```bash
git clone https://github.com/alfindigital/fokusin.git
cd fokusin
python -m http.server 4810
```

Buka http://localhost:4810

## Struktur

```
fokusin/
├─ index.html               markup, semua panel inline
├─ css/style.css            semua style, cache buster di query
├─ js/app.js                semua logic, satu IIFE, nol global
├─ sw.js                    service worker
├─ manifest.webmanifest
├─ privasi.html             kebijakan privasi
├─ _headers                 header keamanan + kebijakan cache (Cloudflare Pages)
├─ icons/                   DIGENERATE, jangan edit manual
├─ tools/make-icons.js      generator ikon PNG, nol dependency (zlib bawaan Node)
├─ tools/build-dist.js      bikin dist/ dari daftar putih, wajib sebelum deploy
├─ tools/build-twa.md       resep bungkus jadi APK Play Store (belum dijalankan)
└─ TIPS-DAN-TRIK.md         catatan teknis: kenapa app AI kelihatan AI, jebakan nyata
```

Regenerate ikon (cuma kalau warna atau bentuk berubah):

```bash
node tools/make-icons.js
```

## Keputusan teknis

| Keputusan | Alasan |
|---|---|
| Deadline timestamp, bukan `setInterval` | Counter yang dikurangi itu drift, dan tab background di-throttle jadi ~1x per menit. Timer 25 menit bisa jadi 40 menit nyata |
| Vanilla, nol dependency | Tool kecil nggak butuh React. Nol supply chain risk, nol `npm audit`, nol build step |
| Progress halaman keisi, bukan ring | Setiap app pomodoro pakai ring. Ini pembeda visual paling murah |
| Sesi di-Lewati tidak dihitung | Kalau skip dihitung, statistiknya bohong dan streak jadi nggak berarti |
| Font Bricolage Grotesque | Bukan Inter. Punya axis lebar variabel, dan Inter itu penanda visual "app generik" |
| Deploy dari `dist/` daftar putih | `wrangler pages deploy .` mengunggah semua file termasuk dokumen internal. Lihat `TIPS-DAN-TRIK.md` |

Alasan lengkap plus 14 jebakan yang sudah kena ada di **[TIPS-DAN-TRIK.md](TIPS-DAN-TRIK.md)**.

## Sudah diverifikasi

Dijalankan di browser sungguhan lewat Chrome DevTools, dibaca dari DOM asli, bukan asumsi:

| Tes | Hasil |
|---|---|
| Akurasi timer | meleset **0 detik** (lokal dan live HTTPS) |
| Sesi penuh sampai kelar | auto pindah ke Rehat, statistik tercatat, streak naik |
| Lewati tidak dihitung | jumlah sesi tidak berubah |
| Reload saat offline | CSS+JS dari cache, timer tetap jalan |
| Kontras WCAG AA | gelap 8.01:1, terang 6.21:1 |
| Konsol | nol error, nol warning |
| Nol scroll horizontal | 390x844, 360x640, 820x1180 |
| Wake Lock | berhasil di HTTPS |

**Belum diuji, jujur:** HP asli (yang dites emulasi viewport Chrome desktop), iOS Safari,
notifikasi web, getar, sesi 25 menit penuh (yang dites 1 menit).

## Deploy sendiri

Static file, jadi bisa di mana saja. Untuk Cloudflare Pages:

```bash
node tools/build-dist.js
npx wrangler pages deploy dist --project-name NAMA --branch main
```

**Deploy dari `dist`, jangan dari `.`** Perintah `wrangler pages deploy .` mengunggah
SEMUA file di folder. Kalau kamu punya catatan pribadi di situ, catatan itu jadi publik.
`.assetsignore` tidak menolong, itu fitur Workers Assets bukan Pages. Detailnya di
`TIPS-DAN-TRIK.md`.

## Play Store

Resep TWA ada di `tools/build-twa.md`, **tapi belum dijalankan.** Baca peringatannya dulu:
timer background di TWA tidak bisa diandalkan karena Android bisa mematikan proses,
akibatnya alarm tidak bunyi. Untuk app pomodoro itu masalah serius. Fix sejatinya butuh
foreground service native, bukan wrapper web.

## Kontribusi

Isu dan PR diterima. Baca [CONTRIBUTING.md](CONTRIBUTING.md) dulu, ada aturan gaya yang
bikin app ini nggak terasa seperti template.

Yang paling dibutuhkan sekarang: **hasil tes di HP asli**, terutama iOS Safari dan
perilaku timer setelah app lama di background.

## Lisensi

[MIT](LICENSE). Silakan fork, ubah, jual, terserah. Atribusi dihargai tapi tidak wajib.

---

Dibuat oleh [@alfindigital](https://alfindigital.com)
