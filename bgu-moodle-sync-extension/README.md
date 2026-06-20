# Moodle Scraper — Chrome Extension

Chrome extension that auto-injects the Moodle Scraper engine into any Israeli university Moodle page. No console paste, no scheduled tasks — install once and sync is controlled from the extension popup with a floating toast for progress.

## Installation

1. Download or clone this folder (`bgu-moodle-sync-extension/`)
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `bgu-moodle-sync-extension` folder
5. The extension icon (blue "M") appears in the Chrome toolbar

## First-Time Setup

1. Navigate to your Moodle dashboard and log in (always click the login button, even if the page looks logged in)
2. The extension auto-detects your university and enrolled courses
3. Click the extension icon → **Settings**
4. Review the pre-filled setup — your university, semester, and courses should already be detected
5. Edit folder names if needed, toggle off courses you don't want synced
6. Click **Save**
7. Navigate to any Moodle page → use the popup to start a sync

## Supported Universities

The extension ships with presets for:

- Ben-Gurion University (BGU)
- Technion
- Tel Aviv University (TAU)
- Hebrew University (HUJI)
- Bar-Ilan University (BIU)
- University of Haifa
- Ariel University
- The Open University
- Afeka, HIT, JCE, SCE, MTA, Ruppin, Colman, Reichman (IDC/Runi)

Any other Moodle instance can be added via the "Custom / Other" option.

## New Semester Setup

1. Open Settings (click extension icon → Settings)
2. Update **Semester identifier** and **Semester folder name**
3. Visit the new semester's Moodle dashboard to auto-detect new courses, or add them manually
4. Use "Apply auto-detected courses" to import detected courses, or edit the list manually
5. Click **Save**
6. Go to Moodle → click **Seed Run (Full)** in the popup

## Sharing with a Friend

1. They install the extension
2. They visit their Moodle dashboard — the extension auto-detects university and courses
3. They review Settings and click Save
4. Done — no config file exchange needed

## How It Works

The extension has three layers:

1. **content.js** — runs on every matching Moodle URL. Detects if it's a real Moodle page, auto-detects courses from the dashboard, loads your config from Chrome storage, and injects it into the page as `window.__MOODLE_SYNC_CONFIG__`. Then injects the engine script.

2. **engine/moodle_sync.js** — the full sync engine (v3.0). Runs in the page context with access to all browser APIs (File System Access, IndexedDB, fetch with cookies, etc.). Exposes `window.__MOODLE_SYNC_API__` for popup control. Shows a floating toast for progress.

3. **popup + options** — the extension UI for sync control (seed/incremental), status display, and settings management (locked/edit cards, per-course toggles, search dropdown, onboarding).

## Troubleshooting

**Sync doesn't start:**
- Make sure you're logged into Moodle (click "התחברות" even if the page looks logged-in)
- Try clicking the extension icon → **Re-inject Engine**
- Check the browser console (F12) for errors

**"Blocked loading of script" error:**
- The engine file needs to be in `web_accessible_resources`. If you modified the manifest, make sure the engine path is listed.

**Config not loading:**
- Check Settings — are courses configured?
- Look in the console for `[MoodleSync Extension] Config injected: X courses`

**Extension not activating on my university's Moodle:**
- Your university URL might not be in the preset list. Go to Settings → select "Custom / Other" → enter your Moodle URL → Save
- If the URL pattern isn't in the manifest's `content_scripts` matches, the extension won't auto-inject. For unlisted universities, you can use the popup's "Re-inject Engine" button after navigating to Moodle. For a permanent fix, add the URL pattern to `manifest.json` → `content_scripts` → `matches` and reload the extension.

## Files

```
bgu-moodle-sync-extension/
├── manifest.json        — Extension config (Manifest V3)
├── content.js           — Injection orchestrator + dashboard auto-detection
├── moodle_sync.js       — Sync engine copy (used by content script)
├── popup.html/js/css    — Toolbar popup UI
├── options.html/js/css  — Full settings page (v3 redesign)
├── engine/
│   ├── moodle_sync.js   — Bundled sync engine copy
│   └── lib/
│       ├── xlsx.full.min.js  — SheetJS (bundled)
│       └── jszip.min.js      — JSZip (bundled)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            — This file
```
