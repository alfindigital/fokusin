# Tips & Trik: bikin web tool yang nggak kelihatan buatan AI

Catatan dari pembangunan **Fokusin** (timer pomodoro, 1 Agu 2026). Nol sampai live di
HTTPS dalam satu sesi, nol dependency, biaya Rp 0.

Live: https://fokusin.pages.dev/
Skill Claude Code: `/pwa-tool-cepat`

---

## 1. Kenapa app buatan AI kelihatan buatan AI

Bukan karena kodenya jelek. Karena semuanya **memilih default yang sama**. Begitu kamu
lihat kombinasi ini, otak langsung curiga:

| Sidik jari | Kenapa muncul |
|---|---|
| Font Inter | default semua template, aman, netral, nol karakter |
| Gradien ungu-biru | warna "AI" sejak 2023 |
| Ring progress lingkaran | tiap tutorial timer pakai ini |
| Kartu bayangan di mana-mana | pola shadcn tanpa dipikir |
| Emoji sebagai ikon | jalan pintas karena bikin SVG repot |
| `border-radius: 8px` semua | satu nilai dipukul rata |
| "Selamat datang di aplikasi kami!" | teks tidak pernah ditulis ulang |

Yang aku pakai di Fokusin sebagai gantinya:

| Slot | Pilihan | Alasan |
|---|---|---|
| Font | Bricolage Grotesque, `wdth` 82-88 | punya axis lebar variabel. Template nggak bisa niru ini |
| Warna | oranye `#FF5F3D` + off-black `#0B0B0C` | `#000` murni itu mati. Off-black terasa dicetak |
| Progress | **halaman keisi dari bawah** + garis rambut naik | ini pembeda paling murah dan paling kelihatan |
| Aksen | ganti per mode: oranye / hijau / biru | app terasa merespons, bukan cuma ganti angka |
| Sudut | 10 / 16 / 26 / 999px | tiap ukuran punya peran, bukan satu nilai dipukul rata |
| Gerak | 2 kurva saja | `(.22,1,.36,1)` untuk geser, `(.34,1.56,.64,1)` untuk yang mantul |
| Teks | "Gas, satu sesi dulu", "lagi ngerjain apa?" | suara orang, bukan hasil translate |

**Tes 5 detik:** kalau desainnya bisa ditempel ke produk lain tanpa terasa aneh, dia belum
punya sikap. Ulangi.

---

## 2. Trik desain yang dampaknya paling besar

**a. Buang elemen yang semua orang pakai, ganti satu.**
Ring progress dibuang, diganti halaman yang keisi. Satu keputusan ini yang paling banyak
mengubah kesan. Cari elemen paling klise di kategorimu, ganti itu saja, sisanya standar.

**b. Angka besar itu gratis dan berhasil.**
Jam 132px dengan `letter-spacing: -.055em` dan `font-variant-numeric: tabular-nums`.
Tabular-nums wajib untuk angka berubah, kalau tidak lebarnya goyang tiap detik.

**c. Animasi digit, bukan seluruh jam.**
Cuma digit yang berubah yang beranimasi. Ini butuh trik:
```js
node.classList.remove('tick');
void node.offsetWidth;      // paksa reflow, tanpa ini animasi tidak terulang
node.classList.add('tick');
```

**d. Aksen sebagai variabel, bukan hex di komponen.**
```css
[data-mode="focus"]{ --accent:#FF5F3D; }
[data-mode="short"]{ --accent:#3DDC97; }
```
Ganti satu atribut di `<html>`, seluruh app ikut berubah. Nol JS untuk pewarnaan.

**e. Teks acak bikin app terasa hidup.**
```js
const EYEBROWS = {
  idle: ['Gas, satu sesi dulu', 'Mulai dari yang kecil', 'Nggak harus mood dulu'],
  run:  ['Jangan buka HP', 'Fokus ke satu ini aja', 'Bagus, terus'],
};
```
Dipakai seminggu tetap terasa segar. Biaya: 10 menit nulis.

---

## 3. Jebakan teknis yang paling mahal

**a. Timer: JANGAN pakai counter `setInterval`.**
```js
setInterval(() => { sisa--; }, 1000);   // SALAH
```
Dua sebab: `setInterval` tidak pernah tepat 1000ms (drift menumpuk), dan tab background
di-throttle jadi **~1x per menit**. Timer 25 menit bisa jadi 40 menit.

Benar: simpan `endAt = Date.now() + sisa`, hitung ulang tiap frame. Terverifikasi meleset
**0 detik**.

**b. `.assetsignore` tidak jalan di Cloudflare Pages.**
`wrangler pages deploy .` mengunggah SEMUA file termasuk `HANDOFF.md`. Punyaku sempat
terbuka publik lengkap dengan path PC dan hitungan biaya langganan. `.assetsignore` itu
fitur Workers Assets, bukan Pages. Yang jalan: folder `dist/` daftar putih.

**c. Aset lama menempel di project Pages.**
Deploy bersih tidak menghapus file yang pernah terunggah. Kalau rahasia pernah bocor,
deploy ulang **tidak cukup**: hapus project, bikin ulang.

**d. Status 200 itu bohong.**
Path yang tidak ada mengembalikan `index.html` status **200** (SPA fallback). Cek
kebocoran pakai **isi**, bukan status code.

**e. Service worker menyembunyikan perubahanmu.**
Deploy sukses tapi footer baru tidak muncul: SW menyajikan HTML lama. Naikkan `?v=N` di
`index.html` DAN `sw.js`, plus nama `CACHE`. Saat menguji, unregister SW dan hapus cache
dulu, kalau tidak kamu menguji versi lama.

**f. Kontras teks kecil gampang gagal diam-diam.**
Footer 10.5px kontrasnya 3.07:1 di tema terang, gagal WCAG AA. Di tema gelap lolos, jadi
kalau cuma cek satu tema, luput. **Hitung kedua tema pakai angka**, jangan dikira-kira.

---

## 4. Cara verifikasi yang benar

**"Selesai" berarti sudah dijalankan dan dilihat hasilnya.** Ini yang membedakan laporan
jujur dari klaim kosong.

- **Screenshot bukan bukti** untuk warna, ukuran font, jarak. Pakai `getComputedStyle`.
- **Uji alur sampai kelar.** Sesi 25 menit? Kecilkan ke 1 menit lewat UI, tunggu 63 detik
  beneran. Jangan suntik localStorage, itu menguji suntikanmu.
- **Curigai hasil tesmu sendiri.** Aku pernah dapat `offBy: -1440` yang tampak seperti bug
  besar. Ternyata rumusku salah baca durasi. Cek rumusnya dulu sebelum menyalahkan app.
- **Konsol nol error itu syarat, bukan bonus.**
- **Tulis yang belum dites.** Emulasi viewport bukan bukti HP asli.

Di Fokusin ketemu 6 cacat lewat cara ini, semuanya sudah diperbaiki. Menyebutkan cacat
yang ditemukan itu **menaikkan** kepercayaan, bukan menurunkan.

---

## 5. Uang

| Item | Fokusin |
|---|---|
| Dependency | 0 |
| Biaya infra | Rp 0 (Cloudflare Pages gratis) |
| Domain baru | Rp 0 (pakai `.pages.dev`) |
| Ukuran total | 154 KB |
| Waktu | 1 sesi |

Kalau lanjut ke Play Store: **USD 25 sekali bayar** + 4 jam. Pemasukan Rp 0 karena
diputuskan gratis. Jadi itu **pengeluaran murni**, dan pembenarannya harus jelas: corong
ke produk lain, latihan rilis buat app yang memang dijual, atau kesenangan pribadi.

**Jangan beli domain sebelum ada user.** `.pages.dev` cukup untuk membuktikan kamu sendiri
memakai appnya.

---

## 6. Kalau ada yang janji "top 1 Play Store"

Kode cuma syarat masuk. Ranking itu hasil **distribusi dan retensi**. Yang jujur harus
disebut untuk PWA yang dibungkus TWA:

1. **Timer background tidak bisa diandalkan.** Android mematikan proses, alarm tidak
   bunyi. Untuk app pomodoro itu pemicu bintang 1 nomor satu. Fix sejati butuh foreground
   service native.
2. **Google menolak wrapper tipis.** TWA legal, tapi app sederhana berisiko kena.
3. **Pasarnya berdarah.** Pembeda Fokusin cuma bahasa Indonesia asli + nol iklan. Celah
   nyata tapi sempit.

---

## Ringkasan satu layar

1. Tanya **2 hal saja**: web atau native, dan model duitnya. Sisanya putuskan sendiri.
2. Buang **satu elemen paling klise** di kategorimu, ganti dengan yang lain.
3. Font berkarakter, off-black bukan `#000`, aksen sebagai variabel per mode.
4. Timer pakai **deadline timestamp**, bukan counter.
5. Deploy dari **`dist/` daftar putih**, jangan dari `.`
6. Verifikasi pakai **DOM asli dan angka**, bukan screenshot dan asumsi.
7. Laporkan **URL produksi saja**, bukan alias per-deploy.
8. Tulis yang **belum dites**. Jujur itu bagian dari selesai.
