# Handoff — Fokusin

Status: **PRODUCTION — verified live** (26 Sep 2026). PWA timer pomodoro offline-first, nol backend, nol dependency runtime.

## Live & repo
- Live: https://fokusin.pages.dev (Cloudflare Pages, deploy manual via wrangler)
- Repo: https://github.com/alfindigital/fokusin (publik, MIT)
- Versi cache aktif: `fokusin-v6` — **wajib bump `CACHE` di `sw.js` + `?v=N` di `index.html` tiap release.**

## Terverifikasi empiris (26 Sep 2026)
- Timer anti-drift berbasis deadline `S.endAt`; state sesi (`mode/running/endAt/remain`) persist di `localStorage["fokusin.v1"]` — reload melanjutkan, tab-tertutup-saat-habis tercatat saat buka lagi (fix PR #1, commit `3c74076`)
- Offline penuh via SW cache; installable (manifest + maskable icons, `Page.getInstallabilityErrors` = kosong)
- Responsif 320–1180px, nol horizontal scroll; keyboard: Space/R/1/2/3/Escape
- Header `_headers` teraplikasi di Pages (nosniff, SAMEORIGIN, no-referrer; `sw.js` no-cache; ikon immutable)

## Cara kerja (invariants)
- Deploy HANYA via `node tools/build-dist.js` → `npx wrangler pages deploy dist --project-name fokusin --branch main` (whitelist — jangan `deploy .`)
- Ikon digenerate `node tools/make-icons.js` — jangan edit manual
- Batas setelan: fokus 1–180 mnt, rehat 1–60 mnt, ronde 2–12

## Belum selesai (bloking eksternal)
- Tes HP asli / iOS Simulator (Add to Home Screen + alarm saat suspend) — belum pernah jalan di device fisik
- Store: Play perlu TWA (`tools/build-twa.md`, alarm-suspend butuh notifikasi native); Apple perlu wrapper Capacitor + risiko Guideline 4.2
- Nama "Fokusin" bentrok dengan merek obat (tamsulosin) — pertimbangkan sebelum komersial
- Aset listing store (screenshot, feature graphic) belum dibuat
