# Moodle Sync — Project Status & Roadmap

> Last updated: 2026-04-05 — Settings Tab UI Redesign (v3) implemented

## What this project is

A browser-based tool that automatically downloads all course materials from a university's Moodle LMS into organized local folders. Started as a personal tool for BGU, now being generalized into a Chrome extension for all Israeli students.

## Current state

### Engine (moodle_sync.js v3.0) — GENERALIZED, STABLE, IN DAILY USE

The core sync engine is production-ready and running daily via a scheduled task. Now generalized for multi-university use. It handles seed runs (full download) and incremental syncs (new/updated files only) across 40+ Israeli universities. ~2,100 lines (core), ~85KB.

Key capabilities: course scraping, section-to-folder mapping, stem merging, Google Docs/Sheets/Slides export, Dropbox link handling, ZIP extraction, duplicate detection, manifest-based incremental sync, Excel log generation, per-course status file generation. Now adds: configurable login detection, basePath support, institution auto-detection, semester flexibility.

Safety patches S1–S11 address: empty manifest protection, IndexedDB backups, directory handle caching, download count safety valve, login enforcement, config backup, stale rootPath warning, seed-into-populated-folder abort, persistent sync lock, IDB-first manifest save, filesystem health check.

S8 (updated 2026-04-05): Seed run check now verifies actual disk content (not just manifest). If folders exist on disk → abort. If disk is clean but manifest is stale → clear manifest and proceed.

S12 (added 2026-04-04) adds cached engine injection with SHA-256 hash-based invalidation.

### Changes made 2026-04-05

1. **Dry Run button removed** — Removed from popup UI (HTML, CSS, JS) and engine toast handler. Internal dryRun plumbing kept but no user-facing entry point.

2. **Exam folder logic rewritten** — Old `extractMoed()` (just moed letter → one folder per moed) replaced with `extractExamIdentity()` that extracts full identity (year + semester + moed). Each unique exam gets its own subfolder: `מבחנים/2024 סמסטר א מועד א/test.pdf + solution.pdf`. Supports patterns: Hebrew dates (מועד א' סמסטר ב' 2020), compact S12024, Hebrew academic years (תשפ"ד), 2024A/B shorthand, and מועד מיוחד/חוזר. Falls back to generic exam folder when identity can't be extracted.

3. **S8 seed safety improved** — Now checks actual filesystem (iterates directory entries looking for course folder names) instead of just the manifest. Stale manifests are cleared automatically when disk is clean.

4. **Moodle HTML page filter** — Downloads that resolve to `text/html` content from the Moodle hostname are silently skipped (recording redirect pages, embedded viewers). Non-Moodle HTML files still download normally. No retry on skipped HTML.

5. **README.md replaced with sync status** — Per-course README now shows: last sync date/time, total files downloaded count, and list of items that weren't downloaded with reasons. No more folder hierarchy listing (redundant since folder structure is self-explanatory).

6. **Rich completion toast** — End-of-sync toast stays visible until user closes it. Seed runs show success/failure summary + scrollable list of items not downloaded. Incremental syncs show list of newly downloaded files. Both mention failures with pointer to Excel file.

### Changes made 2026-04-05 (session 2 — UX polish)

7. **S8 error message improved** — Now names the specific course folders found on disk instead of just a count. Clear instructions on what to do (delete for re-seed, or use incremental).

8. **Per-course README.md → XLS** — `README.md` in each course folder replaced with `סטטוס סנכרון.xlsx`. First row: merged "עדכון אחרון: [date] [time]". Remaining rows: same columns as semester skip report (קורס, מיקום במוודל, שם, קישור, סיבה, תאריך). Old README.md files are automatically cleaned up.

9. **Toast count mismatch fixed** — The completion toast was double-counting failed items (failed items were both in the `failed` counter and pushed to `skipQueue`). Now uses `skipQueue.length` alone since failed items are already included.

10. **Settings page direction fixed** — Changed from `dir="rtl"` to `dir="ltr"` since labels are English. Hebrew input values still render correctly via Unicode bidi.

11. **Settings page cleanup** — Import/Export moved into the Advanced `<details>` section. University dropdown now auto-detects from dashboard when config is empty (hostname fuzzy matching).

12. **Popup redesign** — Shows full course name list instead of just count. Added "Download folder" row with current folder name and "change" button. Changed from RTL to LTR layout. English labels left-aligned, Hebrew values right-aligned.

13. **Semester-level combined status XLS** — After syncing, generates `סטטוס סנכרון - כל הקורסים.xlsx` at the semester folder level when all configured courses have manifest entries. Same format as per-course XLS but with rows from all courses merged.

### Changes made 2026-04-05 (session 3 — Settings Tab UI Redesign v3)

Full rewrite of `options.html`, `options.js`, `options.css` per `SETTINGS_TAB_UI_SPEC.md`. Visual refresh of `popup.html`, `popup.css`, `popup.js`. One-line engine change for disabled course support.

14. **Onboarding screen** — First-time users see a friendly welcome with SVG illustration and 3-step setup guide. Shown only when no config and no detected courses exist. Hides automatically once data arrives.

15. **University card: locked/edit toggle** — Default view shows university name as plain text with an Edit link. Clicking Edit reveals the full form (preset dropdown, URL, path, display name). "Done" collapses back. First-time users start in edit mode.

16. **Semester card: locked/edit toggle** — Same pattern. Default shows semester folder name as plain text. Edit reveals identifier + folder name fields. Auto-suggest fills folder name from identifier (סמ 2 → סמסטר ב׳).

17. **Course toggles** — Each course row now has an iOS-style on/off switch. Toggle off = course skipped during sync (row greys out, sinks to bottom of list). Toggle on = moves back to top. Engine filters `course.disabled` at sync time.

18. **Course row layout redesigned** — New column order: Folder Name | Course Name | ID | Toggle | Remove. Folder name is the editable primary field. Course name is read-only (grey, auto-filled from detection).

19. **Course search dropdown** — Focusing the Course ID field opens a floating dropdown showing all auto-detected courses. Searchable in real-time (filters by name or ID). Selecting an item fills ID, course name, and folder name (with cleanup).

20. **Folder name cleanup** — Auto-fill strips semester identifiers (סמ 2, סמסטר ב, etc.), academic year patterns (2024-25, תשפ"ה), leftover separators, and collapses whitespace.

21. **"Apply auto-detected" button** — Replaces entire course list with detected courses. All toggled on. "Remove All" button clears everything (red danger style).

22. **Dirty-state save button** — Save bar is always visible at bottom. Grey when no changes, turns blue on any form change. Compares current form data JSON to last-saved snapshot.

23. **Import/Export removed** — Cut entirely from Advanced section. Advanced renamed to "Fine-tuning".

24. **mergeThreshold default changed** — 3 → 2.

25. **Body direction changed** — `direction: rtl` → `direction: ltr` on options page. English labels left-aligned, Hebrew inputs remain RTL via `dir="rtl"`.

26. **All UI text rewritten** — Friendly, minimalist, professional tone throughout. No jargon, short sentences.

27. **Popup visual refresh** — Matched card styling, border radius, font, colors to new design language. Disabled courses shown with strikethrough + reduced opacity. Semester folder name shown instead of just identifier.

28. **Engine: disabled course filter** — `const activeCourses = CONFIG.courses.filter(c => !c.disabled)` added to sync loop. Disabled courses skipped during scraping, downloading, manifest saving, report generation, and summary logging.

### Chrome extension (v3.0) — REDESIGNED

Built 2026-04-04, bug-fixed 2026-04-05, UI redesigned 2026-04-05. Lives in `bgu-moodle-sync-extension/`. Manifest V3 compliant.

What it does: injects the generalized engine automatically on any Moodle page. Features floating toast UI with completion reports, extensible popup controls (seed + incremental), auto-detection of courses from dashboard. Settings page with 40+ university presets, locked/edit cards, per-course toggles, search dropdown, dirty-state save, and onboarding screen. Popup shows course list (with disabled indicators), folder display, and change-folder button.

### Scheduled task — ACTIVE

`moodle-incremental-sync` runs daily at 4:00 PM.

### Israeli university research — COMPLETE

Output: `moodle_israel_research.md`. Covers 60+ Israeli higher education institutions.

## Project files

| File | What it is | When to read it |
|------|-----------|-----------------|
| `moodle_sync.js` | The engine (v3.0). Source of truth for all sync logic. | When debugging sync behavior or adding features |
| `moodle_sync_config.json` | Ido's personal config (BGU, semester B, 5 courses) | When setting up a new semester or understanding config structure |
| `moodle_sync_spec.md` | Full technical spec: architecture, safety rules, edge cases | When modifying the engine or understanding why something works the way it does |
| `moodle-course-setup-SKILL.md` | Claude Desktop skill for guided first-time setup | When running a seed sync via Claude Desktop |
| `README.md` | User-facing quick start guide (BGU-focused) | When onboarding yourself or explaining the tool to someone |
| `bgu-moodle-sync-extension/` | Chrome extension (v3.0) | When testing or modifying the extension |
| `moodle_israel_research.md` | Research on all Israeli Moodle instances (COMPLETE) | Before starting generalization work |
| `PROJECT_STATUS.md` | This file | When resuming work or onboarding a new session |

### Changes made 2026-04-05 (session 4 — Settings UX + XLS cleanup)

29. **Semester auto-fill by majority** — When auto-populating config from detected courses, semester rootPath is now auto-filled from the detected semesterCheck using SEMESTER_MAP. If courses are from mixed semesters, the majority determines the semester (already handled by detectSemester in content.js).

30. **Add Course: no duplicates** — The course dropdown now excludes courses already in the course list. Prevents adding the same course twice.

31. **All courses detection (active + hidden)** — content.js now makes a second API call with `classification: 'hidden'` to fetch non-active courses. Both lists are stored separately: active in chrome.storage.sync (`detectedCourses`), all in chrome.storage.local (`allDetectedCourses`). The Add Course dropdown shows active courses first, then hidden/past courses — giving access to every enrolled course.

32. **Course row layout reordered** — Column order changed from Toggle | Folder | Name | ID | Remove to Folder | Name | ID | Toggle | Remove. Toggle now sits between the ID and the remove button.

33. **Removed "קבצים שלא הורדו.xlsx"** — The separate skip-report Excel at the semester level is removed. Only two types of status XLS remain: per-course `סטטוס סנכרון.xlsx` and semester-level `סטטוס סנכרון - כל הקורסים.xlsx`.

34. **Fixed RTL on XLS files** — Rewrote `patchXlsxRtl()` to handle all cases: existing sheetView tags, empty sheetViews, and missing sheetViews sections. Now iterates all sheet files (sheet1.xml, sheet2.xml, etc.) instead of only sheet1.

## Known issues / Next fixes (prioritized)

All items from the April 5 sessions have been resolved. No open issues at this time.

**Next potential work:**
- Chrome Web Store submission
- Multi-language support (English UI for non-Hebrew-speaking students)

## Decisions made

| Decision | Why | Date |
|----------|-----|------|
| Browser-only (no server) | Students shouldn't need to install anything beyond a Chrome extension. File System Access API provides local disk writes. | 2026-04 |
| Config externalizes all university-specific details | Engine is university-agnostic by design. All BGU-specific values (URL, courses, semester naming) live in config. | 2026-04 |
| IndexedDB as backup layer (S2, S3, S6, S12) | Filesystem can be unreliable (FUSE deadlocks, permission issues). IDB provides a fast, reliable fallback that survives tab crashes. | 2026-04-03 |
| Chrome extension over userscript/bookmarklet | MV3 extension auto-injects on page load, manages config via chrome.storage.sync, and can be distributed via Chrome Web Store. | 2026-04-04 |
| Floating toast over sidebar for sync progress | Sidebar (420px fixed right) blocks Moodle navigation. Replaced with small bottom-right toast. | 2026-04-04 |
| Auto-detect courses from dashboard | On dashboard page load, scrape enrolled courses and pre-fill config. Zero-config first-time experience. | 2026-04-04 |
| Exam folders by full identity (year+semester+moed) | Old per-moed grouping was useless. Each exam needs its own folder for easy browsing. Falls back to generic folder when identity is unclear. | 2026-04-05 |
| Skip Moodle HTML pages at download time | Recording links resolve to HTML redirect pages. Filter by Content-Type + Moodle hostname rather than blanket-blocking all HTML. | 2026-04-05 |
| S8 checks disk, not manifest | Manifest can be stale after manual folder deletion. Checking actual filesystem entries is the only reliable way to know if a seed is safe. | 2026-04-05 |
| Completion toast stays until dismissed | User needs time to read the report. Auto-removing it was frustrating. | 2026-04-05 |
| Locked/edit cards over always-visible forms | Most settings are set-and-forget. Clean locked summary + edit toggle reduces clutter. | 2026-04-05 |
| Per-course toggle over deleting courses | Users want to temporarily skip courses (e.g., finals period). Toggle is non-destructive. | 2026-04-05 |
| Import/Export JSON removed | Never used. Config is auto-detected and synced via chrome.storage. Unnecessary complexity. | 2026-04-05 |
| mergeThreshold default 3→2 | 3 was too aggressive — small sections with 2 files were being incorrectly merged. | 2026-04-05 |
| Body direction LTR | Labels and structure are English. RTL body broke alignment. Hebrew values use inline `dir="rtl"`. | 2026-04-05 |
| All-courses list via hidden API call | Students need to add past/hidden courses too. Two API calls (inprogress + hidden) give the full picture. Stored in chrome.storage.local to avoid sync quota limits. | 2026-04-05 |
| Single skip-report XLS removed | Two XLS files at semester level was confusing. The combined status XLS (`סטטוס סנכרון - כל הקורסים.xlsx`) already contains all skip info. | 2026-04-05 |

## How to resume work

1. Read this file first.
2. Read `moodle_sync_spec.md` for engine details (especially the safety rules section).
3. The engine file (`moodle_sync.js`) is the source of truth. The spec describes it; the engine IS it.
4. For UI work: read `popup.html/css/js` and `options.html/css/js` in the extension folder.
5. Check "Known issues / Next fixes" section above for prioritized work.

**IMPORTANT — 3 engine copies must stay in sync:**
1. `moodle_sync.js` (root — used by scheduled task)
2. `bgu-moodle-sync-extension/moodle_sync.js` (used by extension content script)
3. `bgu-moodle-sync-extension/engine/moodle_sync.js` (bundled engine copy)

After any engine change, copy to all 3 locations.

## Style guidelines

- Hebrew for user-facing file names and content in downloaded folders
- English for extension UI labels, code, and developer-facing content
- Target audience: Israeli university students — UX should be clean and minimal
- Ido's preference: one-click automation, no unnecessary configuration, visible feedback on every action, never fail silently
