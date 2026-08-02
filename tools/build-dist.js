#!/usr/bin/env node
/* Bikin folder dist/ yang isinya HANYA aset publik, lalu deploy dari situ.
 * Alasan: `wrangler pages deploy .` mengunggah SEMUA file di folder, termasuk
 * HANDOFF.md dan AGENTS.md yang isinya path lokal, hitungan biaya, dan alasan
 * bisnis. `.assetsignore` TIDAK bekerja untuk `pages deploy` (itu cuma buat
 * Workers Assets). Sudah dites 1 Agu 2026: dokumen tetap kena-publish.
 *
 * Jalankan: node tools/build-dist.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Hanya ini yang boleh tayang. Daftar putih, bukan daftar hitam:
// kalau ada file baru dan lupa didaftarkan, dia TIDAK tayang. Itu arah
// gagal yang benar.
const ALLOW = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  '_headers',
  'css/style.css',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

fs.rmSync(DIST, { recursive: true, force: true });

let n = 0;
for (const rel of ALLOW) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) {
    console.error(`HILANG: ${rel}`);
    process.exitCode = 1;
    continue;
  }
  const dst = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  n++;
}

// Pagar: pastikan nggak ada .md atau folder tools yang nyelip
const leaked = [];
(function walk(dir, base = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), rel);
    else if (/\.md$/i.test(rel) || rel.startsWith('tools/')) leaked.push(rel);
  }
})(DIST);

if (leaked.length) {
  console.error('BOCOR ke dist:', leaked);
  process.exitCode = 1;
} else {
  console.log(`dist/ siap: ${n} file, nol dokumen internal`);
  console.log('deploy: npx wrangler pages deploy dist --project-name fokusin --branch main --commit-dirty=true');
}
