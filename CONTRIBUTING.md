# Kontribusi ke Fokusin

Terima kasih sudah mau bantu. Baca ini dulu, singkat kok.

## Yang paling dibutuhkan sekarang

1. **Hasil tes di HP asli.** Yang sudah diuji cuma emulasi viewport di Chrome desktop.
   Belum ada data dari perangkat sungguhan, terutama:
   - iOS Safari (add to home screen, perilaku Wake Lock, audio setelah layar mati)
   - Android setelah app lama di background (apakah timer masih akurat saat dibuka lagi)
   - Notifikasi web dan getar
2. **Terjemahan** ke bahasa lain, tanpa membuang rasa kasualnya.
3. **Perbaikan aksesibilitas**, terutama screen reader.

Buka issue dengan menyebut perangkat, versi OS, dan browsernya. Screenshot membantu.

## Aturan gaya (ini yang bikin app ini nggak terasa template)

**Jangan tambah dependency.** Nol `npm install` di project ini. Kalau menurutmu perlu
library, jelaskan dulu di issue kenapa vanilla nggak cukup.

**Jangan ganti timer ke counter `setInterval`.** Timer pakai deadline timestamp
(`S.endAt`) dengan alasan yang ditulis di komentar `js/app.js`. Mengubahnya memasukkan
kembali bug drift dan mati di tab background.

**Naikkan cache buster setiap ubah CSS atau JS.** Tiga tempat sekaligus:
- `index.html`: `style.css?v=N` dan `app.js?v=N`
- `sw.js`: dua entri di array `SHELL`
- `sw.js`: konstanta `CACHE`

Lupa satu saja, pengguna lama akan lihat versi basi.

**Ikon digenerate, jangan diedit manual.** Ubah `tools/make-icons.js` lalu jalankan ulang
`node tools/make-icons.js`.

**Teks Bahasa Indonesia harus terdengar orang, bukan hasil translate.**
- Benar: "Gas, satu sesi dulu", "lagi ngerjain apa?", "Jangan buka HP"
- Salah: "Silakan memulai sesi fokus Anda", "Selamat datang di aplikasi kami"

**Warna lewat custom property, jangan hardcode hex di komponen.** Aksen per mode diatur
lewat `[data-mode="..."]` di elemen `<html>`.

**Kontras wajib lolos WCAG AA di KEDUA tema.** Teks di bawah 14px butuh rasio >= 4.5:1.
Cek terang dan gelap, jangan salah satu. Sudah pernah ada warna yang lolos di gelap tapi
gagal di terang.

**Komentar hanya untuk yang tidak jelas dari kode.** Jangan tulis komentar yang cuma
mengulang nama fungsi.

## Sebelum kirim PR

Nggak ada CI, jadi tolong cek manual:

```bash
# 1. sintaks
node --check js/app.js
node --check sw.js
node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8'))"

# 2. karakter non-ASCII nyasar ke CSS (pernah kejadian, diam-diam bikin aturan diabaikan)
grep -nP '[^\x00-\x7F]' css/style.css

# 3. jalankan dan buka
python -m http.server 4810
```

Lalu di browser:
- Konsol harus **nol error**
- Klik semua tombol yang tersentuh perubahanmu
- Cek 3 ukuran: 390x844, 360x640, 820x1180
- Kalau menyentuh timer: jalankan sesi sampai kelar, jangan cuma dilihat 3 detik

Saat menguji, **unregister service worker dan hapus cache dulu**, kalau tidak kamu
menguji versi lama:

```js
const regs = await navigator.serviceWorker.getRegistrations();
await Promise.all(regs.map(r => r.unregister()));
const keys = await caches.keys();
await Promise.all(keys.map(k => caches.delete(k)));
```

## Di deskripsi PR, tulis

- Apa yang berubah dan kenapa
- Apa yang **sudah kamu jalankan dan lihat hasilnya** (bukan "seharusnya jalan")
- Apa yang **belum kamu tes**, sebut apa adanya

Jujur soal yang belum dites itu dihargai, bukan dianggap kelemahan.

## Yang kemungkinan besar ditolak

- Sistem akun, sinkronisasi cloud, backend apa pun
- Iklan, langganan, analytics, tracking
- Framework (React, Vue, Svelte) untuk app sekecil ini
- Ring progress lingkaran (dibuang dengan sengaja)
- Font Inter (diganti dengan sengaja)
- Membuat sesi yang di-Lewati dihitung ke statistik
- Fitur besar yang belum didiskusikan di issue

Kalau ragu apakah idemu masuk kategori ini, buka issue dulu sebelum coding. Lebih baik
diskusi 10 menit daripada PR 3 jam yang ditolak.
