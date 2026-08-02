/* Fokusin - app.js
 * Timer pakai deadline timestamp (Date.now), BUKAN counter setInterval.
 * Alasan: setInterval di tab background di-throttle jadi ~1x/menit, dan drift
 * numpuk. Dengan deadline, sisa waktu selalu dihitung ulang dari jam sistem,
 * jadi akurat walau tab di-background atau HP sleep.
 */
(() => {
'use strict';

const LS = 'fokusin.v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- state ---------------- */

const DEFAULTS = {
  focusMin: 25, shortMin: 5, longMin: 15, rounds: 4,
  autoBreak: false, autoFocus: false,
  sound: 'bell', volume: 70, vibrate: true,
  theme: 'dark', wakeLock: true, notify: false,
};

const LIMITS = {
  focusMin: [1, 180], shortMin: [1, 60], longMin: [1, 60], rounds: [2, 12],
};

let S = {
  cfg: { ...DEFAULTS },
  round: 1,                 // sesi fokus ke-berapa dalam siklus
  mode: 'focus',
  endAt: null,              // timestamp ms kapan sesi habis
  remain: DEFAULTS.focusMin * 60 * 1000,  // dipakai saat pause / idle
  running: false,
  task: '',
  days: {},                 // "2026-08-01": { ms, sessions }
  totalMs: 0,
  totalSessions: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: null,
};

function load() {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return;
    const d = JSON.parse(raw);
    S.cfg = { ...DEFAULTS, ...(d.cfg || {}) };
    S.days = d.days || {};
    S.totalMs = d.totalMs || 0;
    S.totalSessions = d.totalSessions || 0;
    S.streak = d.streak || 0;
    S.bestStreak = d.bestStreak || 0;
    S.lastDay = d.lastDay || null;
    S.round = d.round || 1;
    S.task = d.task || '';
  } catch (_) { /* data korup, pakai default */ }
}

function save() {
  try {
    localStorage.setItem(LS, JSON.stringify({
      cfg: S.cfg, days: S.days, totalMs: S.totalMs,
      totalSessions: S.totalSessions, streak: S.streak,
      bestStreak: S.bestStreak, lastDay: S.lastDay,
      round: S.round, task: S.task,
    }));
  } catch (_) { /* storage penuh atau private mode */ }
}

/* ---------------- helpers ---------------- */

const durOf = m => ({ focus: S.cfg.focusMin, short: S.cfg.shortMin, long: S.cfg.longMin })[m] * 60000;
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayKeyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function fmtShort(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h}j` : `${h}j ${min % 60}m`;
}
function fmtLong(ms) {
  const min = Math.floor(ms / 60000);
  return `${Math.floor(min / 60)}j ${min % 60}m`;
}

const EYEBROWS = {
  idle:   ['Gas, satu sesi dulu', 'Mulai dari yang kecil', 'Nggak harus mood dulu', 'Satu sesi, bukan seharian'],
  run:    ['Jangan buka HP', 'Lanjut, udah jalan', 'Fokus ke satu ini aja', 'Bagus, terus'],
  paused: ['Kepending. Lanjut?', 'Nge-pause itu bukan gagal'],
  break:  ['Rehat dulu, beneran rehat', 'Jauhin layar bentar', 'Minum, jalan-jalan', 'Istirahat itu bagian kerjanya'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------------- audio ---------------- */

let ac = null;
function actx() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ac = new C();
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

function beep(ctx, t, freq, dur, gain, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

function playAlarm(kind = S.cfg.sound) {
  if (kind === 'none' || S.cfg.volume === 0) return;
  const ctx = actx(); if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  const v = (S.cfg.volume / 100) * 0.5;

  if (kind === 'bell') {
    [0, 0.16, 0.32].forEach((d, i) => {
      beep(ctx, t + d, 880, 1.1 - i * 0.2, v * (1 - i * 0.22));
      beep(ctx, t + d, 1320, 0.7, v * 0.3 * (1 - i * 0.25), 'triangle');
    });
  } else if (kind === 'knock') {
    [0, 0.13, 0.26].forEach(d => beep(ctx, t + d, 200, 0.14, v * 0.9, 'square'));
  } else if (kind === 'rise') {
    [523, 659, 784, 1047].forEach((f, i) => beep(ctx, t + i * 0.11, f, 0.42, v * 0.75, 'triangle'));
  }
}

function tickSound() {
  const ctx = actx(); if (!ctx || S.cfg.volume === 0) return;
  beep(ctx, ctx.currentTime + 0.01, 660, 0.06, (S.cfg.volume / 100) * 0.12, 'sine');
}

function buzz(pattern) {
  if (!S.cfg.vibrate) return;
  try { navigator.vibrate?.(pattern); } catch (_) {}
}

/* ---------------- wake lock ---------------- */

let wl = null;
async function wakeOn() {
  if (!S.cfg.wakeLock || !('wakeLock' in navigator)) return;
  try { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
  catch (_) {}
}
function wakeOff() { try { wl?.release(); } catch (_) {} wl = null; }

/* ---------------- notification ---------------- */

async function askNotify() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch (_) { return false; }
}

function notify(title, body) {
  if (!S.cfg.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'fokusin', renotify: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (_) {}
}

/* ---------------- render ---------------- */

const el = {
  fill: $('#fill'), hairline: $('#hairline'),
  clock: $('#clock'), clockSr: $('#clockSr'),
  eyebrow: $('#eyebrow'),
  roundDots: $('#roundDots'), roundLabel: $('#roundLabel'),
  btnStart: $('#btnStart'), btnStartLabel: $('#btnStartLabel'),
  btnSkip: $('#btnSkip'), btnReset: $('#btnReset'),
  modes: $('#modes'), modePill: $('#modePill'),
  streakValue: $('#streakValue'), streakChip: $('#streakChip'),
  statToday: $('#statToday'), statSessions: $('#statSessions'), statTotal: $('#statTotal'),
  taskInput: $('#taskInput'),
  toast: $('#toast'),
};

let lastDigits = ['2', '5', '0', '0'];

function remainingMs() {
  if (!S.running) return S.remain;
  return Math.max(0, S.endAt - Date.now());
}

function paintClock(ms) {
  const total = Math.ceil(ms / 1000);
  const mm = Math.floor(total / 60), ss = total % 60;
  const mStr = String(mm).padStart(2, '0');           // 3 digit kalau >= 100 menit
  const sStr = String(ss).padStart(2, '0');
  const chars = [...mStr, ':', ...sStr];

  // jumlah slot bisa berubah (25:00 -> 4 digit, 120:00 -> 5 digit)
  if (el.clock.children.length !== chars.length) {
    el.clock.innerHTML = chars
      .map(c => c === ':' ? '<span class="clock__sep">:</span>' : `<span class="clock__d">${c}</span>`)
      .join('');
  } else {
    [...el.clock.children].forEach((node, i) => {
      const v = chars[i];
      if (node.textContent === v) return;
      node.textContent = v;
      node.classList.remove('tick');
      void node.offsetWidth;          // paksa reflow biar animasi bisa diulang
      node.classList.add('tick');
    });
  }

  document.title = S.running
    ? `${mStr}:${sStr} - ${S.mode === 'focus' ? 'Fokus' : 'Rehat'} | Fokusin`
    : 'Fokusin - Timer Pomodoro';
}

function paintFill(ms) {
  const total = durOf(S.mode);
  const pct = total ? Math.min(100, Math.max(0, (1 - ms / total) * 100)) : 0;
  el.fill.style.height = pct + '%';
  el.hairline.style.bottom = pct + '%';
}

function paintRounds() {
  const n = S.cfg.rounds;
  if (el.roundDots.children.length !== n) {
    el.roundDots.innerHTML = Array.from({ length: n }, () => '<i></i>').join('');
  }
  $$('i', el.roundDots).forEach((d, i) => {
    const idx = i + 1;
    d.dataset.on = idx < S.round ? '1' : '0';
    d.dataset.now = (idx === S.round && S.mode === 'focus') ? '1' : '0';
  });
  el.roundLabel.textContent = S.mode === 'long'
    ? 'Rehat panjang'
    : `Sesi ${Math.min(S.round, n)} dari ${n}`;
}

function paintModes() {
  $$('button', el.modes).forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === S.mode)));
  const i = ['focus', 'short', 'long'].indexOf(S.mode);
  el.modePill.style.transform = `translateX(${i * 100}%)`;
}

function paintStats() {
  const t = S.days[todayKey()] || { ms: 0, sessions: 0 };
  el.statToday.textContent = fmtShort(t.ms);
  el.statSessions.textContent = String(t.sessions);
  el.statTotal.textContent = fmtShort(S.totalMs);
  el.streakValue.textContent = String(S.streak);
  el.streakChip.dataset.hot = S.streak > 0 ? '1' : '0';
}

function paintButtons() {
  el.btnStartLabel.textContent = S.running ? 'Jeda' : (remainingMs() < durOf(S.mode) ? 'Lanjut' : 'Mulai');
  el.btnReset.disabled = !S.running && remainingMs() >= durOf(S.mode);
}

function setEyebrow(kind) {
  el.eyebrow.style.opacity = '0';
  setTimeout(() => { el.eyebrow.textContent = pick(EYEBROWS[kind]); el.eyebrow.style.opacity = '1'; }, 160);
}

function render() {
  const ms = remainingMs();
  document.documentElement.dataset.mode = S.mode;
  document.body.dataset.running = S.running ? '1' : '0';
  document.body.dataset.paused = (!S.running && ms < durOf(S.mode)) ? '1' : '0';
  paintClock(ms); paintFill(ms); paintRounds(); paintModes(); paintStats(); paintButtons();
}

let toastT;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.dataset.show = '1';
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.toast.dataset.show = '0'; }, 2600);
}

/* ---------------- loop ---------------- */

let raf = null, lastSec = -1;

function loop() {
  if (!S.running) return;
  const ms = remainingMs();
  const sec = Math.ceil(ms / 1000);

  if (sec !== lastSec) {
    lastSec = sec;
    paintClock(ms); paintFill(ms);
    if (sec === 3 || sec === 2 || sec === 1) tickSound();
    if (sec % 15 === 0) el.clockSr.textContent = `${Math.floor(sec / 60)} menit ${sec % 60} detik tersisa`;
  }

  if (ms <= 0) { complete(); return; }
  raf = requestAnimationFrame(loop);
}

/* Backup buat kondisi rAF mati total (tab background lama).
   setInterval juga di-throttle, tapi tetap jalan ~1x/menit, cukup buat
   nyalain complete() begitu tab balik aktif. */
setInterval(() => { if (S.running && remainingMs() <= 0) complete(); }, 1000);

/* ---------------- actions ---------------- */

function start() {
  if (S.running) return;
  actx();                              // unlock audio di gesture user
  S.endAt = Date.now() + S.remain;
  S.running = true;
  lastSec = -1;
  wakeOn();
  setEyebrow(S.mode === 'focus' ? 'run' : 'break');
  render();
  raf = requestAnimationFrame(loop);
}

function pause() {
  if (!S.running) return;
  S.remain = remainingMs();
  S.running = false;
  cancelAnimationFrame(raf);
  wakeOff();
  setEyebrow('paused');
  render(); save();
}

function toggle() { S.running ? pause() : start(); }

function setMode(mode, { keepRound = true } = {}) {
  S.mode = mode;
  S.running = false;
  cancelAnimationFrame(raf);
  wakeOff();
  S.remain = durOf(mode);
  S.endAt = null;
  if (!keepRound) S.round = 1;
  setEyebrow(mode === 'focus' ? 'idle' : 'break');
  render(); save();
}

function reset() {
  S.running = false;
  cancelAnimationFrame(raf);
  wakeOff();
  S.remain = durOf(S.mode);
  S.endAt = null;
  setEyebrow('idle');
  render(); save();
  toast('Timer di-reset');
}

function recordFocus(ms) {
  const k = todayKey();
  const day = S.days[k] || { ms: 0, sessions: 0 };
  day.ms += ms; day.sessions += 1;
  S.days[k] = day;
  S.totalMs += ms;
  S.totalSessions += 1;

  // streak: hitung ulang berdasarkan hari yang punya minimal 1 sesi
  if (S.lastDay !== k) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.streak = (S.lastDay === dayKeyOf(y)) ? S.streak + 1 : 1;
    S.lastDay = k;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
  }

  // buang data > 400 hari biar localStorage nggak numpuk
  const keys = Object.keys(S.days);
  if (keys.length > 400) keys.sort().slice(0, keys.length - 400).forEach(k2 => delete S.days[k2]);
}

function nextAfterFocus() {
  const isLong = S.round >= S.cfg.rounds;
  return isLong ? 'long' : 'short';
}

function complete() {
  cancelAnimationFrame(raf);
  S.running = false;
  wakeOff();

  const finished = S.mode;

  if (finished === 'focus') {
    recordFocus(durOf('focus'));
    playAlarm();
    buzz([120, 70, 120, 70, 220]);
    const nxt = nextAfterFocus();
    notify('Sesi fokus kelar', nxt === 'long' ? 'Rehat panjang, kamu udah nyelesein satu siklus.' : 'Waktunya rehat bentar.');
    S.mode = nxt;
    S.round = (nxt === 'long') ? 1 : S.round + 1;
    S.remain = durOf(S.mode);
    S.endAt = null;
    render(); save();
    setEyebrow('break');
    toast(nxt === 'long' ? 'Siklus kelar. Rehat panjang.' : 'Sesi kelar. Rehat dulu.');
    if (S.cfg.autoBreak) setTimeout(start, 900);
  } else {
    playAlarm('rise');
    buzz([90, 60, 90]);
    notify('Rehat selesai', 'Balik fokus?');
    S.mode = 'focus';
    S.remain = durOf('focus');
    S.endAt = null;
    render(); save();
    setEyebrow('idle');
    toast('Rehat kelar. Balik fokus.');
    if (S.cfg.autoFocus) setTimeout(start, 900);
  }
}

function skip() {
  if (S.mode === 'focus') {
    // sesi fokus di-skip TIDAK dihitung. Jangan curangi statistik sendiri.
    const nxt = nextAfterFocus();
    S.mode = nxt;
    S.round = (nxt === 'long') ? 1 : S.round + 1;
    toast('Sesi dilewati, nggak dihitung');
  } else {
    S.mode = 'focus';
    toast('Rehat dilewati');
  }
  S.running = false;
  cancelAnimationFrame(raf);
  wakeOff();
  S.remain = durOf(S.mode);
  S.endAt = null;
  setEyebrow(S.mode === 'focus' ? 'idle' : 'break');
  render(); save();
}

/* ---------------- sheets ---------------- */

const scrim = $('#scrim');
const sheets = { settings: $('#sheetSettings'), stats: $('#sheetStats') };
let openSheet = null;

function sheetOpen(name) {
  if (openSheet) sheetClose();
  const s = sheets[name]; if (!s) return;
  if (name === 'stats') paintStatsSheet();
  scrim.hidden = false; s.hidden = false;
  void s.offsetWidth;
  scrim.dataset.show = '1'; s.dataset.show = '1';
  openSheet = name;
  $('[data-close]', s)?.focus();
}

function sheetClose() {
  if (!openSheet) return;
  const s = sheets[openSheet];
  s.dataset.show = '0'; scrim.dataset.show = '0';
  const done = () => { s.hidden = true; scrim.hidden = true; };
  setTimeout(done, 420);
  openSheet = null;
}

/* ---------------- settings UI ---------------- */

function paintSettings() {
  $('#valFocusMin').textContent = S.cfg.focusMin;
  $('#valShortMin').textContent = S.cfg.shortMin;
  $('#valLongMin').textContent = S.cfg.longMin;
  $('#valRounds').textContent = S.cfg.rounds;

  $$('[data-toggle]').forEach(b => b.setAttribute('aria-checked', String(!!S.cfg[b.dataset.toggle])));
  $$('#soundSegs button').forEach(b => b.dataset.on = b.dataset.sound === S.cfg.sound ? '1' : '0');
  $$('#themeSegs button').forEach(b => b.dataset.on = b.dataset.theme === S.cfg.theme ? '1' : '0');
  $('#volRange').value = S.cfg.volume;

  const n = $('#notifyNote');
  if (!('Notification' in window)) n.textContent = 'Browser ini nggak dukung notifikasi.';
  else if (Notification.permission === 'denied') n.textContent = 'Notifikasi diblokir di setelan browser. Buka izin situs buat ngaktifin.';
  else n.textContent = 'Kalau app ditutup total, notifikasi bisa telat. Biarkan tab tetap terbuka pas timer jalan.';
}

function applyTheme() {
  const t = S.cfg.theme === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : S.cfg.theme;
  document.documentElement.dataset.theme = t;
  $('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F5F3EF' : '#0B0B0C');
}

function paintStatsSheet() {
  $('#sTotal').textContent = fmtLong(S.totalMs);
  $('#sStreak').textContent = String(S.streak);
  $('#sBest').textContent = String(S.bestStreak);

  const NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const rec = S.days[dayKeyOf(d)] || { ms: 0, sessions: 0 };
    days.push({ name: NAMES[d.getDay()], ms: rec.ms });
  }
  const max = Math.max(...days.map(d => d.ms), 1);
  $('#chart').innerHTML = days.map(d => {
    const h = d.ms ? Math.max(4, Math.round((d.ms / max) * 100)) : 3;
    return `<div class="bar" data-empty="${d.ms ? 0 : 1}" title="${d.name}: ${fmtShort(d.ms)}">
      <span style="height:${h}%"></span><small>${d.name}</small></div>`;
  }).join('');

  const keys = Object.keys(S.days).sort().reverse().slice(0, 14);
  $('#historyRows').innerHTML = keys.length
    ? keys.map(k => {
        const r = S.days[k];
        const d = new Date(k + 'T00:00:00');
        const label = k === todayKey() ? 'Hari ini'
          : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        return `<div class="hist"><b>${label}</b><span>${r.sessions} sesi &middot; ${fmtShort(r.ms)}</span></div>`;
      }).join('')
    : '<div class="empty">Belum ada sesi. Selesaikan satu dulu.</div>';
}

/* ---------------- events ---------------- */

el.btnStart.addEventListener('click', toggle);
el.btnReset.addEventListener('click', reset);
el.btnSkip.addEventListener('click', skip);

el.modes.addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  if (b.dataset.mode === S.mode) return;
  setMode(b.dataset.mode);
});

$('#btnSettings').addEventListener('click', () => { paintSettings(); sheetOpen('settings'); });
$('#btnStats').addEventListener('click', () => sheetOpen('stats'));
el.streakChip.addEventListener('click', () => sheetOpen('stats'));
scrim.addEventListener('click', sheetClose);
$$('[data-close]').forEach(b => b.addEventListener('click', sheetClose));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && openSheet) { sheetClose(); return; }
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); toggle(); }
  else if (e.key.toLowerCase() === 'r') reset();
  else if (e.key.toLowerCase() === 's') skip();
  else if (e.key === '1') setMode('focus');
  else if (e.key === '2') setMode('short');
  else if (e.key === '3') setMode('long');
});

/* stepper */
$$('[data-step]').forEach(b => b.addEventListener('click', () => {
  const [key, deltaStr] = b.dataset.step.split(':');
  const [min, max] = LIMITS[key];
  const next = Math.min(max, Math.max(min, S.cfg[key] + Number(deltaStr)));
  if (next === S.cfg[key]) return;
  S.cfg[key] = next;

  // timer idle langsung ikut durasi baru. Yang lagi jalan jangan diganggu.
  if (!S.running && ['focusMin', 'shortMin', 'longMin'].includes(key)) {
    const owner = { focusMin: 'focus', shortMin: 'short', longMin: 'long' }[key];
    if (owner === S.mode) { S.remain = durOf(S.mode); }
  }
  if (key === 'rounds' && S.round > next) S.round = 1;

  paintSettings(); render(); save();
  buzz(12);
}));

/* switch */
$$('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
  const key = b.dataset.toggle;
  const next = !S.cfg[key];

  if (key === 'notify' && next) {
    const ok = await askNotify();
    if (!ok) { toast('Izin notifikasi ditolak browser'); paintSettings(); return; }
  }
  S.cfg[key] = next;
  if (key === 'wakeLock') next && S.running ? wakeOn() : wakeOff();
  paintSettings(); save();
  buzz(12);
}));

/* segmented: sound */
$$('#soundSegs button').forEach(b => b.addEventListener('click', () => {
  S.cfg.sound = b.dataset.sound;
  paintSettings(); save();
  playAlarm(S.cfg.sound);
}));

/* segmented: theme */
$$('#themeSegs button').forEach(b => b.addEventListener('click', () => {
  S.cfg.theme = b.dataset.theme;
  applyTheme(); paintSettings(); save();
}));

$('#volRange').addEventListener('input', e => { S.cfg.volume = Number(e.target.value); });
$('#volRange').addEventListener('change', () => { save(); playAlarm(); });

$('#btnWipe').addEventListener('click', () => {
  if (!confirm('Hapus semua statistik, streak, dan setelan? Nggak bisa dibalikin.')) return;
  try { localStorage.removeItem(LS); } catch (_) {}
  S = {
    cfg: { ...DEFAULTS }, round: 1, mode: 'focus', endAt: null,
    remain: DEFAULTS.focusMin * 60000, running: false, task: '',
    days: {}, totalMs: 0, totalSessions: 0, streak: 0, bestStreak: 0, lastDay: null,
  };
  el.taskInput.value = '';
  applyTheme(); paintSettings(); render();
  sheetClose(); toast('Semua data dihapus');
});

el.taskInput.addEventListener('input', e => { S.task = e.target.value; });
el.taskInput.addEventListener('change', save);
el.taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

/* jam sistem berubah / tab balik aktif: sinkron ulang dari deadline */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (S.running) {
    if (remainingMs() <= 0) complete();
    else { lastSec = -1; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); wakeOn(); }
  }
});

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (S.cfg.theme === 'system') applyTheme();
});

window.addEventListener('beforeunload', e => {
  save();
  if (S.running && S.mode === 'focus') { e.preventDefault(); e.returnValue = ''; }
});

/* ---------------- boot ---------------- */

load();
S.remain = durOf(S.mode);
el.taskInput.value = S.task;
applyTheme();
paintSettings();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

})();
