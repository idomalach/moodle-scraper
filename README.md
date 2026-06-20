# Moodle Sync — Israeli Universities

One-click download of all your Moodle course materials into organized folders. Install the Chrome extension once and it works automatically on any Israeli university Moodle.

## What it does

- Downloads every file from all your Moodle courses (lectures, exercises, assignments, exams, syllabi)
- Organizes them into clean folders with sensible names
- Merges numbered sections (e.g. "הרצאה 1", "הרצאה 2", ... into a single "הרצאות" folder)
- Groups exam files by year, semester, and moed into separate subfolders
- Handles Google Docs/Slides/Sheets links (exports as PDF/XLSX)
- Handles Dropbox links
- Extracts ZIP archives automatically
- Removes duplicate files when both PDF and Office versions exist
- Generates a per-course status Excel file (`סטטוס סנכרון.xlsx`) and a semester-level combined report
- Generates an Excel log of anything it couldn't download (with reasons)
- Supports incremental sync — after the first run, only downloads new/updated files

## What you need

1. **Chrome** browser
2. **Logged into your university's Moodle** in Chrome (active session)

## Quick start — Chrome Extension (recommended)

### Step 1: Install the extension

1. Download or clone the `bgu-moodle-sync-extension/` folder
2. Open Chrome → `chrome://extensions/` → enable **Developer mode**
3. Click **Load unpacked** → select the `bgu-moodle-sync-extension` folder

### Step 2: Visit your Moodle dashboard

1. Go to your university's Moodle and log in (click the login button even if the page looks logged in)
2. The extension auto-detects your university and enrolled courses

### Step 3: Configure in Settings

1. Click the extension icon → **Settings**
2. Your university and courses should be pre-filled from auto-detection
3. Review the course list — toggle off any courses you don't want synced, edit folder names as needed
4. Click **Save**

### Step 4: Run the seed download

1. Navigate to any page on your Moodle
2. Click the extension icon → **Seed Run (Full)**
3. A folder picker opens — select your **year folder** (e.g. `שנה ג׳`). The engine navigates into the semester subfolder automatically.
4. A floating toast shows real-time progress. A full run of 5 courses takes about 2–3 minutes.
5. When you see `SYNC COMPLETE`, you're done.

### Step 5: Check results

Open your semester folder. You should see:

```
שנה ג׳/סמסטר ב׳/
  .moodle_manifest.json           ← tracks what's been downloaded (don't delete)
  קבצים שלא הורדו.xlsx            ← items that couldn't be downloaded (with reasons)
  סטטוס סנכרון - כל הקורסים.xlsx  ← combined sync status for all courses
  הנדסת חשמל/
    סטטוס סנכרון.xlsx
    הרצאות/
    תרגולים/
    ...
  מימון/
    סטטוס סנכרון.xlsx
    ...
```

## Updating (during the semester)

Professors upload new files throughout the semester. To grab only the new stuff:

1. Navigate to your Moodle in Chrome
2. Click the extension icon → **Incremental Sync**
3. Done — only new files are downloaded. The folder handle is cached after the first run.

## Next semester

1. Open the extension Settings
2. Update **Semester identifier** and **Semester folder name**
3. Replace courses with the new semester's course IDs (or use "Apply auto-detected courses" after visiting the new dashboard)
4. Click **Save** → run **Seed Run** again

## Automated daily sync (optional, requires Claude Desktop)

If you use [Claude Desktop](https://claude.ai) with the Claude in Chrome extension, you can set up a scheduled task that runs the incremental sync automatically every day. Ask Claude: "set up the Moodle scheduled sync" and it will configure everything.

## Alternative: Console paste (no extension)

You can also run the engine directly by pasting `moodle_sync.js` into Chrome DevTools (F12 → Console) on any Moodle page. This is useful for quick one-off syncs without installing the extension.

## Files in this repo

| File | Purpose |
|------|---------|
| `moodle_sync.js` | The sync engine (v3.0, with safety patches S1–S12). Paste into Chrome console or use the Chrome extension. |
| `moodle_sync_config.json` | Your personal config (courses, paths). **Not tracked in git** — create your own. The `semesterAbsolutePath` and `syncScriptPath` fields are only used by the scheduled task. |
| `moodle_sync_spec.md` | Full technical spec with all rules and edge cases. Read this if you want to understand or modify the engine. |
| `moodle-course-setup-SKILL.md` | Claude Desktop skill file for guided setup. |
| `bgu-moodle-sync-extension/` | Chrome extension (Manifest V3) — auto-injects the engine on Moodle pages. Supports 40+ Israeli institutions. |
| `moodle_israel_research.md` | Research on all Israeli university Moodle instances — compatibility tiers, auth methods, URL patterns. |
| `PROJECT_STATUS.md` | Project status, roadmap, and decisions. Read this to understand where the project is headed. |

## Limitations

- **Colab notebooks** can't be downloaded automatically (Google blocks cross-origin access). The Excel log will list them — download manually from Colab.
- **BGU admin syllabi** (`bgu4u.bgu.ac.il`) require an SSO session on that domain. The engine logs these — you can download them manually by right-clicking the link on Moodle and opening in a new tab (repeat if redirected).
- **RAR files** are saved as-is (no browser-based RAR extraction). ZIP files are extracted automatically.
- **Video links** (YouTube, Zoom recordings) are skipped — they're noted in the Excel log.
- The browser's folder picker appears on the first run only. After that, the directory handle is cached in IndexedDB and reused automatically — no repeated clicks needed.

## FAQ

**Q: Can I use this on a Mac/Windows/Linux?**
A: Yes — it runs in Chrome, which works on all three.

**Q: Will this work with other universities?**
A: A Chrome extension is being built to support all Israeli Moodle instances. See `bgu-moodle-sync-extension/` and `moodle_israel_research.md` for details. The core engine is university-agnostic — it uses the standard Moodle DOM structure. Only the config (URL, courses, semester naming) changes per institution.

**Q: Is my Moodle password stored anywhere?**
A: No. The engine uses your existing browser session cookie. It never sees or stores your password.

**Q: What if a download fails?**
A: Failed downloads are logged in the Excel file with the reason. The next incremental sync will retry them automatically (since they won't be in the manifest).
