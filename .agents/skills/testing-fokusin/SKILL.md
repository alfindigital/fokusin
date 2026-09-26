---
name: testing-fokusin
description: How to run and end-to-end test the Fokusin pomodoro PWA locally (serving, secure context, beforeunload dialog, steppers, service-worker offline checks)
---

# Testing Fokusin locally

Zero-dependency static PWA (index.html + js/app.js + sw.js). No build needed to test.

## Serve & browse
- Serve from repo root: `python3 -m http.server 4810`. The service worker requires an http(s) origin — `file://` will silently not register it.
- Use desktop Chrome for Testing (`~/.local/bin/google-chrome`) on `http://localhost:4810` — localhost IS a secure context, so SW/manifest/wake-lock all work.
- The Playwright MCP runs in docker; it can only reach the host server via `http://172.17.0.1:4810`, which is NOT a secure context (SW + notifications dead there). Prefer the real localhost browser tooling.
- Console check: the `browser_console` tool reads the foreground Chrome tab's console (empty = clean).

## beforeunload quirk
- Reloading/navigating while a FOCUS session is running pops Chrome's "Reload site? / Leave site?" dialog (`S.running && S.mode==='focus'` in app.js ~line 645). The confirm button sits top-center-right (~x619,y120 at 1024x768 maximized). Paused or break-mode reloads show NO dialog.
- Each computer-tool call can take 10–45s of wall time; a 1-minute timer keeps counting down through it. For a crisp mid-run resume capture, batch `F5 → wait 1.5s → left_click Reload button → wait → screenshot` in ONE call so the dialog is dismissed fast.
- Trust screenshots over the returned DOM dump during navigations — the DOM can transiently show an error/pending page while pixels already show the app.

## Driving the UI
- Set focus to 1 min for fast tests: gear icon (Setelan) → click "−" on the Fokus row 24 times (25→1, min is 1). Buttons have `data-step="focusMin:-1"`.
- Key elements: `#btnStart`/`#btnStartLabel` (Mulai/Jeda/Lanjut), `#btnReset` (Ulang), `#btnSkip` (Lewati), `#modes button[data-mode]` (focus/short/long), `#btnStats`, `#btnSettings`, `#taskInput`, stats `#statToday #statSessions #statTotal`, settings values `#valFocusMin #valShortMin #valLongMin #valRounds`, `#themeSegs button[data-theme]`.
- localStorage key is `fokusin.v1`; wipe via Setelan → "Hapus semua data".

## Offline check
- Kill the server (`pkill -f "http.server 4810"`, verify curl → 000), then reload — SW serves the shell from cache. Note: the error-page "Reload" button may bypass the SW once (race); a normal F5 afterwards renders from cache. Verify `navigator.serviceWorker.controller.state === 'activated'` and `caches.keys()` contains the current `fokusin-vN`.
- Restart the server afterwards: `cd repo && nohup python3 -m http.server 4810 &`.
