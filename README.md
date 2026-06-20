# Moodle Scraper — Israeli Universities

One-click download of all your Moodle course materials into clean, organized folders on your own computer. A Chrome extension that works on 40+ Israeli university Moodle sites.

**Website & install guide:** https://moodle-scraper.pages.dev

## What it does

- Downloads every file from all your Moodle courses (lectures, exercises, assignments, exams, syllabi)
- Organizes them into clean folders per course, with sensible names
- Merges numbered sections (e.g. "הרצאה 1", "הרצאה 2" → a single "הרצאות" folder)
- Splits assignments into תרגילים / הגשות / פתרונות מרצה, with content-hash de-duplication
- Groups exam files by year, semester, and מועד
- Fetches content that isn't directly attached: BGU internal syllabus pages, Google Slides/Docs (→ PDF), Google Sheets (→ Excel), files inside folders, embedded files, and ZIP archives (auto-extracted)
- Prefers the PDF when both a PDF and an Office version of the same file exist
- Generates per-course and semester-level Excel status reports, plus a log of anything it couldn't download (with reasons)
- Incremental sync — after the first run, only new/updated files are downloaded; known failures aren't retried endlessly

Everything runs locally in your browser. No server, no tracking, no data leaves your device. See [PRIVACY.md](bgu-moodle-sync-extension/PRIVACY.md).

## Install (Chrome)

End users: follow the guide at **https://moodle-scraper.pages.dev**.

From source:
1. `chrome://extensions` → enable **Developer mode** (top-right)
2. **Load unpacked** → select the `bgu-moodle-sync-extension/` folder
3. Pin the extension, open your university's Moodle and log in
4. Extension popup → **הגדרות** to pick a download folder and confirm the auto-detected courses
5. Popup → **הורדה ראשונית** for the first full download; **סנכרון** for updates afterward

## Repository layout

| Path | Purpose |
|------|---------|
| `bgu-moodle-sync-extension/` | The Chrome extension (Manifest V3). This is the product. |
| `bgu-moodle-sync-extension/engine/moodle_sync.js` | The sync engine — the single source of truth for all download/organize logic. |
| `moodle_sync_spec.md` | Engine specification: architecture, rules, edge cases, safety rules. Read before modifying the engine. |
| `moodle_israel_research.md` | Research on Israeli Moodle instances — compatibility, auth methods, URL patterns. |
| `landing/` | Source for the marketing / install website (deployed to Cloudflare Pages). |
| `build.sh` | Rebuilds the distributable zip and refreshes the landing-page download. |

## Build the distributable

```
./build.sh
```

Produces `moodle-scraper-v3.0.0.zip` (gitignored) and copies it to `landing/assets/` for the website download.

## Limitations

- **Colab notebooks** and **Google Sites** course pages can't be auto-downloaded (cross-origin) — they're listed in the Excel log.
- **RAR** files are saved as-is (browsers can't extract RAR); **ZIP** is auto-extracted.
- **Video links** (YouTube, Zoom) are skipped.
- The browser's folder picker appears once; the directory handle is cached afterward.

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
