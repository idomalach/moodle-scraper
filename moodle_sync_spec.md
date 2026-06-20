# Moodle Scraper - Engine Specification (v3)

## Goal
Download and organize all course materials from BGU Moodle into a clean, browsable folder structure. The initial run (seed) downloads everything from scratch. Subsequent runs (incremental) detect and download only new or changed files.

This spec is **reusable across semesters**. See "New Semester Setup" at the bottom for how to adapt it.

**Current semester:** סמסטר ב׳ (סמ 2), תשפ"ו (2025-2026).

**Important:** All courses must match the current semester. Verify the page title includes the expected semester identifier (e.g., "סמ 2") before scraping. If a course ID loads the wrong semester, search Moodle for the correct offering.

---

## Courses

| Course Name (Moodle) | Moodle ID | Folder Name |
|---|---|---|
| הנדסת חשמל ומערכות ספרתיות סמ 2 | 64674 | הנדסת חשמל |
| יסודות המימון לתעו"נ קב 1 סמ 2 | 65670 | מימון |
| מודלים של רגרסיה ליניארית סמ 2 | 64660 | רגרסיה |
| ניהול פרוייקטים סמ 2 | 63518 | ניהול פרוייקטים |
| סימולציה סמ 2 | 64673 | סימולציה |

**Folder names are manually defined** - they do not derive from the Moodle course title. To add a new course, add a row to this table with all three columns.

---

## Disk Structure

```
שנה ג׳/סמסטר ב׳/
  .moodle_manifest.json          ← sync state tracker
  קבצים שלא הורדו.xlsx           ← all skipped items, all courses
  קורסים שנה ג׳ סמסטר ב׳.xlsx    ← existing course overview, keep untouched
  הנדסת חשמל/
    סטטוס סנכרון.xlsx             ← auto-generated sync status
    הרצאות/
      חוברת קורס חשמל ומערכות ספרתיות 2026.rar
      ...
    תרגול כיתה/
      תרגול 1.pdf
      תרגול 2.pdf
      ...
    תרגילי בית/
      תרגיל בית מספר 1.pdf
      תרגיל בית מספר 2.pdf
      ...
      פתרונות/                   ← merged from "פתרונות תרגילי בית" section
        פתרון תרגיל בית 1.pdf
        ...
    מבחנים משנים קודמות/
      מועד א 22.7.20/            ← subfolder per מועד when exam+solution exist
        מועד א 22.7.20.pdf
        פתרון מועד א 22.7.20.pdf
      מבחן ופתרון מועד א 2025.pdf ← combined files stay flat
    הגשות/                       ← only if Moodle section is named הגשות (Pattern B files go to their section folder)
      פתרונות/                   ← only if professor uploaded solutions
  רגרסיה/
    README.md
    תרגולים/
      תרגול 1 - מבוא/            ← mod/folder → subfolder
        [child files]
      תרגול 2 - מעבדה ב-R/
        [child files]
    תרגילים/
      תרגיל 1/                   ← mod/folder for question files
        [child files]
      ...
      פתרונות/
        תרגיל 1 - פתרון
        ...
    פרויקט/
      הנחיות חלק א׳
      ...
    חומרי עזר/
      טבלת Z
      ...
  מימון/
    README.md
    ...
  סימולציה/
    README.md
    מעבדות/
      תרגול 3- התאמת התפלגות/    ← mod/folder → subfolder
        [child files]
      תרגול 4- דגימה 1           ← mod/resource → flat in section
      ...
    ...
```

**Rules:**
- Folder names mirror Moodle section titles exactly (Hebrew, as shown on course page), including parenthetical descriptions (e.g., "שיעורים (מצגות וחומרים נוספים חשובים)").
- Only create a folder if at least one file was successfully downloaded into it. No empty folders.
- No automatic `הגשות` submission folder for the user - user creates that manually if needed.
- **Syllabus exception:** Regardless of which Moodle section a syllabus file sits under (כללי, הרצאות, or any other), it is always saved to the **root folder** of the course - never inside a section subfolder. Syllabuses are the only files that behave this way.

---

## Section Merging Rules

### Numbered stem merging
If 3 or more Moodle sections share the same name differing only by a trailing number (e.g., "הרצאה 1", "הרצאה 2", "הרצאה 12"), merge all their files into a single folder named after the stem ("הרצאה"). Threshold is ≥ 3 occurrences.

**Numbering within merged folders:** When files from multiple numbered sections are merged into one folder, prefix each filename with its zero-padded original section number to preserve chronological order. Format: `"NN - original name"`. Examples:
- File "סיכום פרק 1" from "הרצאה 1" → `"01 - סיכום פרק 1"`
- File "סיכום פרק 2" from "הרצאה 2" → `"02 - סיכום פרק 2"`
- File "סיכום פרק 12" from "הרצאה 12" → `"12 - סיכום פרק 12"`

Zero-pad to match the widest number in the group (2 digits if max ≤ 99).

**Header/divider sections** (sections that contain no downloadable items - e.g., "---", "מבחנים" as a title-only section, "יחידת־הוראה N" with no items): ignore completely. They do not break a merge chain, and they do not create folders.

### Solution handling

**Homework solutions** - simple rule: all solution files for homework/assignments go into a single `פתרונות` subfolder inside the assignments folder. Whether solutions come from a separate Moodle section (e.g., "פתרונות תרגילי בית") or are mixed into the same section as the questions, they all end up in one place: `תרגילי בית/פתרונות/`.

Detection: a file whose name **starts with** "פתרון" or "solution" (case-insensitive) is a solution file. Files where "פתרון" appears mid-name (e.g., "מבחן ופתרון") are NOT standalone solutions - they stay in their parent folder.

**Exam solutions** - when an exam section contains two separate files for the same מועד (one test-only, one solution), create a subfolder for that מועד and put both inside it. Combined files like "מבחן ופתרון מועד א 2025" that contain both in one document stay flat - no subfolder needed.

If a section name starts with "פתרונות" and there's a matching parent section (e.g., "פתרונות תרגילי בית" → "תרגילי בית"), merge its files into that parent's `פתרונות/` subfolder. If no match, keep it as its own folder.

### Pattern A vs Pattern B assignments

**Pattern A:** The question PDF is a `mod/resource` on the main course page. The `mod/assign` item is just an upload portal (no file in its intro). In this case the question PDF already has a natural section folder. The `mod/assign` portal itself is silently ignored - no folder created, not logged to Excel.

**Pattern B:** The question PDF is *only* accessible by clicking into the `mod/assign` submission page (embedded as a pluginfile in the assignment intro HTML). There is no `mod/resource` on the main page for that question. In this case, the question PDF is saved into the **section folder that the `mod/assign` lives in** on Moodle (e.g., if the assign is under "תרגילי בית", the file goes to `תרגילי בית/`). No special consolidation folder is created - the file follows the same section-to-folder mapping as everything else.

**Detection:** For every `mod/assign` item encountered, always fetch its submission page and look for `pluginfile.php` links in the intro HTML. If found → Pattern B, download to the section folder the assign lives in. If not found → Pattern A, ignore silently.

**Real example found:** In סימולציה, the assign "תרגיל בית - מונחה עצמים" contains "HW 2026B.pdf" as a pluginfile - this is Pattern B.

### Projects vs Assignments
Projects may also have their question/brief only inside a `mod/assign` page (same Pattern B situation). These follow the same rule: the file goes into whatever section folder the assign belongs to. If the section is named "פרוייקט" or similar, the file naturally lands in the project folder.

**Note:** Project sections often also contain `mod/resource` items (guidelines, datasets). These are NOT Pattern B - they are direct resources and go into the `פרוייקט` folder directly (the section folder IS "פרוייקט").

### פתרונות subfolder (applies everywhere)
The solution handling rules above apply to **all** section folders. If a Pattern B assignment page contains a solution file → it goes to `<section folder>/פתרונות`. Only create the subfolder when at least one solution file exists.

---

## File Naming Rules

1. Use the **Moodle display name** (not the raw server filename).
2. **PDF files** are saved **with** the `.pdf` extension. ~~(v3 originally said "without" - this was reversed after the first seed run proved that macOS cannot open extensionless files; they display as binary gibberish.)~~
3. **Non-PDF files that keep their extension:** archives (ZIP/RAR), Jupyter notebooks (.ipynb), images (PNG/JPG/GIF), code files (.py, .m, .r, .c, .R), data files (.csv, .xlsx, .xls, .json, .xml), plain text (.txt), HTML (.html), and any other non-PDF type. These are saved as-is with their original extension.
4. **Normalize** display names before saving:
   - Strip invisible Unicode characters: RTL marks (U+200F), LTR marks (U+200E), zero-width spaces (U+200B), zero-width non-joiners (U+200C), zero-width joiners (U+200D), and other Unicode control characters.
   - Strip trailing underscores, trailing dots, trailing punctuation (except closing parentheses).
   - Collapse multiple consecutive spaces into one.
   - Strip leading/trailing whitespace.
   - Replace characters illegal in filenames (`/ \ : * ? " < > |`) with `-`.
   - Examples: `"תרגול 1_"` → `"תרגול 1"`, `"פתרון מועד א  3.2.26.."` → `"פתרון מועד א 3.2.26"`, `"‏‏‏‏Examples questions"` → `"Examples questions"`
5. **Long filenames**: If a normalized filename exceeds 80 characters, shorten it to the clearest possible form - keep the most meaningful portion (course code, topic, date) and drop redundant words. Aim for clarity over completeness.
6. **Duplicate names** in the same folder: append ` (2)`, ` (3)`, etc.
7. **Merged-folder prefix**: files inside a merged folder get a `"NN - "` prefix (see Section Merging Rules above). The prefix is applied *before* duplicate detection.

---

## Download Pipeline by Item Type

### `mod/resource` (direct file attached to Moodle)
- Fetch file, inspect MIME type or extension.
- **PDF** → save with `.pdf` extension.
- **DOCX / PPTX / DOC / PPT / ODT / ODP** → save as-is with original extension. ~~(v3 originally specified LibreOffice conversion to PDF, but the engine runs in the browser where LibreOffice is unavailable. In practice, most professors upload a PDF alongside the Office file, handled by PDF-sibling dedup. Standalone Office files are rare and usable as-is.)~~
- **ZIP** → download the archive, then **extract its contents** using JSZip (loaded from CDN). Place the extracted files in the appropriate folder. The original archive is not saved - only the extracted files are written to disk. If extraction fails → save the archive as-is with its extension and log to Excel with reason `extraction error`.
- **RAR** → save as-is with `.rar` extension. Browser-based RAR extraction is not supported. The user will see RAR files in the output and must extract them manually.
- **Images** (PNG/JPG/GIF/BMP or `image/*` MIME) → save as-is, keep extension.
- **Code / notebooks** (.py, .m, .ipynb, .r, .R, .c, .java) → save as-is, keep extension.
- **Data files** (.csv, .xlsx, .xls, .json, .xml, .txt, .html, .css, .js) → save as-is, keep extension.
- **Video** (MP4/AVI/MOV/WMV or `video/*` MIME) → skip silently (no Excel entry).
- **Other** → attempt download, save as-is with original extension. If download fails → log to Excel with reason `download error`.

### `mod/url` (external link)
**Resolution:** `mod/url` items do NOT auto-redirect. Navigating to `mod/url/view.php?id=X` shows a Moodle page with the destination link. Extract the actual target URL from the `.urlworkaround a` element on that page. Then classify by domain:
- `drive.google.com` / `docs.google.com` / `sheets.google.com` / `slides.google.com` → export as PDF. For Google Docs: use `https://docs.google.com/document/d/{ID}/export?format=pdf`. For Google Slides: use `https://docs.google.com/presentation/d/{ID}/export/pdf`. **Do NOT use `credentials: 'include'`** - Google export URLs redirect cross-origin, and credentials cause CORS failures. Use `fetch(url, { redirect: 'follow' })` without credentials. The Google Drive MCP only works for Google Docs; it fails on Slides (`MIME type` error) and Colab notebooks.
- `colab.research.google.com` → extract the file ID from the URL (e.g., `/drive/1eMFd78R5oDKbRTs-9vbg1KonFPAZl-fr`), download as `.ipynb` by **navigating to the Colab page in Chrome and extracting from `colab.global.notebook`**. Google Drive MCP does NOT work for Colab files.
- `dropbox.com` → rewrite URL: replace `?dl=0` with `?dl=1` (or append `?dl=1`) to get direct download. Download and convert if needed. For Dropbox shared folders: navigate to the folder page in Chrome (user must be logged in), extract individual file URLs from anchor elements, then download each with `?dl=1`. Use `fetch(url, { credentials: 'include', redirect: 'follow' })` from the Dropbox tab.
- `youtube.com` / `youtu.be` / `zoom.us` / `vimeo.com` → skip silently (no Excel entry).
- `sites.google.com` → log to Excel with reason `Google Sites - check manually for linked files`. ~~(v3 originally specified automated exploration, but Google Sites pages are cross-origin from Moodle - the engine cannot navigate or scrape them. During the seed run, linked files on Google Sites should be explored manually.)~~
- BGU internal domains (`in.bgu.ac.il`, `iguide.bgu.ac.il`, `bgu4u.bgu.ac.il`) → **probe for downloadable files before skipping.** Fetch the page with `credentials: 'include'` (same browser session). If the response is itself a file (PDF, DOCX, etc. by Content-Type), download it directly. If it's an HTML page, scan for links to downloadable files (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.zip`, `.rar`, `pluginfile.php`) and embedded viewers (`<embed>`, `<iframe>`, `<object>` with PDF src). If a downloadable file is found → download it like any other resource. If the page contains no downloadable content → log to Excel with reason `BGU internal page - no downloadable files found`. ~~(v3 originally skipped all BGU internal links as "BGU admin page", but many of these - especially syllabus links to bgu4u - are reachable and contain PDFs when fetched within the logged-in browser session.)~~
- Everything else → log to Excel with reason `external link - manual required`.

### `mod/assign` (homework/project submission portal)
- Always fetch the submission page.
- Look for `pluginfile.php` links in the assignment intro HTML.
- If found (Pattern B) → download the file(s) to the section folder the assign belongs to. Apply the פתרונות rule: solution files within the same assignment go to `<section folder>/פתרונות`.
- If not found (Pattern A) → silently ignore. Do NOT log to Excel - it's just a portal, not a file.

### `mod/folder`
- **Expansion:** Navigate to `mod/folder/view.php?id=X` to list all child items. Each child file appears as a link to `pluginfile.php`.
- **If the folder contains 2 or more child files:** create a subfolder named after the `mod/folder` title inside the section folder. Place all child files there.
- **If the folder contains exactly 1 child file:** place the file directly in the section folder (no subfolder).
- Apply `mod/resource` rules to each child file.
- **PDF-sibling dedup:** If a `mod/folder` contains both a PDF and a DOCX/PPTX of the same content (detected by matching base filenames, e.g., "תרגול 3.pdf" and "תרגול 3.pptx"), download **only the PDF**. Skip the Office file silently (do not log to Excel). The professor uploaded both; the PDF is the rendered version.

### Silent skips (no Excel entry needed)
`mod/label`, `mod/page`, `mod/zoom`, `mod/lti`, `mod/forum`, `mod/choicegroup` - these are UI elements or live sessions, not files. Skip without logging.

### Unknown types
Any `mod/` type not listed above → log to Excel with reason `unknown type: mod/<typename>` and the URL. Never skip silently.

---

## Cross-Section Duplicates

If the same file (same Moodle resource ID) appears in multiple sections, download it to **each** section's folder independently. Each copy gets its own manifest entry keyed by its unique resource ID, so no special handling is needed.

If a professor links the same URL or uploads an identical file under different resource IDs in different sections, treat them as separate items - download both. Deduplication is not performed.

---

## Manifest (`.moodle_manifest.json`)

Stored at `סמסטר ב׳/.moodle_manifest.json`. Keyed by course ID → cmid (course module ID, parsed from the `module-NNNNN` DOM attribute). For `mod/folder` children, the key is `parentCmid:childName` since all children share the parent's cmid.

```json
{
  "64674": {
    "courseName": "הנדסת חשמל",
    "folderName": "הנדסת חשמל",
    "lastSync": "2026-03-31T10:00:00Z",
    "items": {
      "3253468": {
        "section": "תרגילי בית",
        "sectionIndex": 6,
        "moodleName": "תרגיל בית מספר 1",
        "type": "resource",
        "status": "downloaded",
        "savedAs": "תרגילי בית/תרגיל בית מספר 1",
        "fileSize": 204800,
        "etag": "abc123",
        "downloadedAt": "2026-03-31T10:00:00Z"
      },
      "3146059": {
        "section": "תרגול כיתה",
        "sectionIndex": 5,
        "moodleName": "תרגול 1_",
        "type": "resource",
        "status": "downloaded",
        "savedAs": "תרגול כיתה/תרגול 1",
        "fileSize": 512000,
        "etag": "def456",
        "downloadedAt": "2026-03-31T10:00:00Z"
      }
    }
  }
}
```

**Status values:** `downloaded`, `extracted` (ZIP was unpacked - savedAs is an array of paths), `skipped:external`, `skipped:bgu_admin`, `skipped:error`, `skipped:unknown_type`, `removed_from_moodle`

**Update detection:** On each sync run, for IDs already in the manifest, compare `fileSize` (from HTTP `Content-Length`) and/or `etag` (from HTTP `ETag` header) against stored values. If either differs → **delete the old file on disk**, download the new version, update the manifest entry. No duplicates, no stale versions.

**Deletion detection:** If a resource ID exists in the manifest but is no longer present on the Moodle course page → **keep the local file on disk**, set status to `removed_from_moodle`, add a `removedAt` timestamp. The file stays accessible but is clearly flagged. The sync summary reports these as "removed from Moodle."

---

## "Not Downloaded" Excel (`קבצים שלא הורדו.xlsx`)

One file at the semester root, shared across all courses. **Updated on every sync run** (both seed and incremental). Each incremental sync updates this file when it finishes, reflecting any new skipped items discovered.

| Column | Description |
|---|---|
| קורס | Course short name (e.g., "הנדסת חשמל") |
| מיקום במוודל | Moodle section title the item sits under |
| שם | Moodle display name of the item |
| סוג | Item type (e.g., "url", "resource", "assign") |
| סיבה | Standardized reason (see below) |
| קישור | Full URL of the item or its destination |
| תאריך | Date the item was first logged (ISO format) |

**Standardized reasons:** `video`, `external link`, `BGU internal page - no downloadable files found`, `BGU internal page - HTTP <status>`, `BGU internal page - fetch error: <msg>`, `conversion error`, `download error`, `unknown type: mod/<xyz>`

---

## Per-Course Status (`סטטוס סנכרון.xlsx`)

Each course folder contains an auto-generated `סטטוס סנכרון.xlsx` that shows sync status. It is regenerated on every sync run (seed or incremental). Format:

- **First row (merged):** `עדכון אחרון: [date] [time]` - the last sync timestamp
- **Remaining rows:** Items that weren't downloaded, with columns matching the semester-level skip report (קורס, מיקום במוודל, שם, קישור, סיבה, תאריך)

A semester-level combined report (`סטטוס סנכרון - כל הקורסים.xlsx`) is also generated when all configured courses have manifest entries. It merges rows from all per-course status files.

**Note:** Old per-course `README.md` files from previous versions are automatically cleaned up by the engine.

---

## Technical Download Mechanism

- **BGU blocks `curl`** - all Moodle file downloads must go through browser JavaScript with the active session cookie.
- Use `fetch(url, { credentials: 'include' })` in browser JS to retrieve `pluginfile.php` URLs as blobs.
- Use `showDirectoryPicker()` **once** at the start of each session to get a writable directory handle for the semester folder.
- Loop through all new/updated file URLs, fetch each as a blob, write to the correct subfolder path using the File System Access API. No per-file button clicks needed after the initial folder grant.
- **Google Drive files:** handled via the Google Drive MCP (only works for Google Docs/Sheets/Slides - NOT for Colab notebooks or arbitrary Drive files).
- **Colab notebooks:** must be downloaded via browser. Open the Colab URL in a Chrome tab, wait for the notebook model to load (`colab.global.notebook.cells.length > 0`), then extract cell content via JS and build an .ipynb JSON. For batch downloads, open multiple Colab tabs and use `BroadcastChannel` to collect all notebooks into one tab for a single `showDirectoryPicker()` save.
- **LibreOffice conversion:** runs in the Linux VM. Command: `libreoffice --headless --convert-to pdf <inputfile>` - available in the Cowork environment. If the command exits with a non-zero code or produces no output file → conversion has failed.
- **Batch downloads preferred:** Always batch file downloads into a single `showDirectoryPicker()` session whenever possible. Never default to downloading files one-by-one when a batch approach exists. For Colab notebooks, open all tabs simultaneously and use `BroadcastChannel` to collect them. For Moodle files, loop through all URLs in one JS execution. For Google exports, queue all URLs and save in one batch. The user should only need to click the folder picker once per download session.

---

## Sync Modes

### Seed Run (first time)
1. Delete all existing downloaded files in `סמסטר ב׳/` (except `.moodle_manifest.json`, the xlsx files, and this spec file).
2. For each course: load course page. **Verify the page title contains "סמ 2".**
3. Scrape all sections and item IDs from DOM.
4. Identify and group sections for merging (numbered stem rule, solution section merging). Ignore header/divider sections.
5. For each `mod/assign`: fetch submission page to detect Pattern A vs Pattern B.
6. For each `mod/folder`: expand to list child items. Detect PDF-sibling duplicates.
7. Download all files according to pipeline rules.
8. Build manifest from scratch.
9. Write initial `קבצים שלא הורדו.xlsx`.
10. Generate `README.md` for each course folder.
11. Print sync summary.

### Incremental Run (subsequent syncs)
1. For each course: load course page, scrape current section + item IDs.
2. Read manifest. Compute diff: new IDs = current IDs − manifest IDs.
3. For existing IDs: check ETag/size for updates.
4. For manifest IDs not found on Moodle: mark as `removed_from_moodle` (keep file on disk).
5. Download only new + updated files.
6. Append new skipped items to Excel (don't duplicate existing rows).
7. Update manifest.
8. Regenerate `README.md` for each course folder.
9. Print sync summary.

### Sync Summary (printed after every run)
```
Sync complete - 2026-03-31
  הנדסת חשמל:     3 new, 0 updated, 1 skipped, 0 removed from Moodle
  מימון:          1 new, 0 updated, 0 skipped, 0 removed from Moodle
  רגרסיה:         0 new, 1 updated, 0 skipped, 0 removed from Moodle
  ניהול פרוייקטים: 2 new, 0 updated, 1 skipped, 0 removed from Moodle
  סימולציה:       0 new, 0 updated, 0 skipped, 0 removed from Moodle
קבצים שלא הורדו.xlsx updated with 2 new entries.
```

---

## Self-Documenting Process

**Instruction for the executing chat:** As you implement and run this spec, you WILL encounter implementation details, selectors, workarounds, and behaviors not documented here. **You must add them to this spec file** so that future runs (and future semesters) benefit from what you learned.

Specifically, document:
- The exact CSS selectors / DOM queries that work for scraping sections, items, and item types from course pages.
- Any Moodle quirks discovered during download (e.g., redirect behaviors, cookie requirements, rate limiting, timeouts).
- Any file type edge cases not already listed (new MIME types, unexpected formats).
- Any mod/ types encountered that aren't in the spec.
- Workarounds applied (e.g., retry logic, session refresh patterns).
- Per-course structural notes - add or update them as you discover new patterns.

Add these notes inline in the relevant section. The goal is that this spec file becomes the single source of truth - anyone (or any future chat) reading it has everything they need to run a sync without guessing.

---

## New Semester Setup

This spec is designed to be reused each semester. Here's what to change:

### 1. Update the header
- Change "Current semester" to the new semester (e.g., "סמסטר א׳ (סמ 1), תשפ"ז").
- Change the semester identifier check from "סמ 2" to "סמ 1" (or vice versa).

### 2. Update the courses table
- For each course: search Moodle (`/course/search.php?search=COURSE_NAME`) for the new semester's offering.
- Verify each result by loading the course page and confirming the title contains the correct semester.
- Update the Moodle ID column with the new IDs.
- Add or remove courses as needed. Update folder names if desired.

### 3. Update the disk structure
- Change `rootPath` if needed (e.g., `סמסטר א׳` instead of `סמסטר ב׳`). The user picks the year folder (e.g. `שנה ד׳`) in the directory picker; `rootPath` is relative to that.
- The manifest, Excel log, and README files will be created fresh in the new folder.

### 4. Run the audit
- Before the seed run, re-audit all course pages (as was done for v3). Each professor structures their course differently, and the same professor may change their structure between semesters.
- Add any new edge cases to the relevant spec sections.

### 5. Run the seed
- Execute the seed run in a new chat.
- From that point, run incremental syncs (סנכרון) from the extension popup whenever you want to pull new or changed files.

---

## Unified Sync Engine (`moodle_sync.js` v3.0)

The entire download pipeline is encoded in a single JavaScript file (`moodle_sync.js`) that runs in any Moodle tab. It handles both seed and incremental syncs. The engine runs via the Chrome extension: sync is controlled from the extension popup and progress is displayed via a floating toast. The engine exposes `window.__MOODLE_SYNC_API__` for the popup to drive programmatically.

### How to Run

1. Install the Chrome extension and navigate to any Moodle page in Chrome (must be logged in).
2. The content script loads the bundled engine (`engine/moodle_sync.js`) automatically. No manual injection is required.
3. The engine initializes and exposes `window.__MOODLE_SYNC_API__` with `startSync(mode)`, `getStatus()`, and `getLog()`. The popup provides **הורדה ראשונית** (Initial Download / seed) and **סנכרון** (Sync / incremental) buttons. Progress is shown in a floating toast in the bottom-right corner of the page.
4. On the first run, a folder picker opens (via a toast button that provides the required user gesture) - point it to the **year folder** (e.g. `שנה ג׳`). The engine navigates into the semester subfolder (e.g. `סמסטר ב׳`) automatically via `rootPath`. The handle is cached in IndexedDB (S3 patch), so subsequent runs skip the picker.
5. The engine scrapes all active courses (those not toggled off via `course.disabled`), resolves URLs, expands folders, downloads files, saves the manifest, generates per-course status XLS files, and produces the Excel log. All automatically.

### Architecture (8-step pipeline)

1. **Folder access** - `showDirectoryPicker()` → user picks the year folder (e.g. `שנה ג׳`), engine navigates into `סמסטר ב׳` via `rootPath`.
2. **Load manifest** - read `.moodle_manifest.json` from the semester folder (empty object on first run).
3. **Scrape courses** - for each course: fetch `course/view.php?id=X`, extract sections and items via DOM selectors, build section-to-folder mapping (stem merging, solution merging, syllabus exception).
4. **Resolve & expand** - for each item:
   - `mod/resource` → queue for direct download.
   - `mod/folder` → expand children via `view.php`, apply PDF-sibling dedup, queue children.
   - `mod/url` → resolve target via `.urlworkaround a`, classify (Google export / Dropbox / Colab / external / BGU admin), queue or skip accordingly.
   - `mod/assign` → check for Pattern B (embedded `pluginfile.php` links), queue found files.
   - Silent-skip types (`label`, `page`, `zoom`, `lti`, `forum`, `choicegroup`) → ignore.
5. **Incremental filter** (incremental mode only) - remove items already in the manifest. Uses smart HEAD optimization: if a course's scraped cmid set is identical to its manifest cmid set, all HEAD requests for that course are skipped entirely (no items changed). Only courses with new or removed items trigger HEAD checks for update detection. This reduces HEAD requests from O(total items) to O(changed items) on typical days.
6. **Download** - fetch each queued file (with up to 3 retries and exponential backoff), detect extension from headers, normalize filename, try ZIP extraction (JSZip, bundled in the extension), write to correct subfolder via File System Access API. Handle duplicates by appending `(2)`, `(3)`, etc. A progress bar shows real-time completion percentage.
7. **Save manifest** - write updated manifest with section mappings, file sizes, timestamps.
8. **Generate outputs** - write `סטטוס סנכרון.xlsx` per course (last sync time + list of items not downloaded), generate `סטטוס סנכרון - כל הקורסים.xlsx` at the semester level, and merge new entries into `קבצים שלא הורדו.xlsx` (SheetJS, bundled in extension or loaded from CDN) preserving previous entries and deduplicating by URL+Name.

### Manifest Structure (`.moodle_manifest.json`)

```json
{
  "64674": {
    "courseName": "הנדסת חשמל",
    "folderName": "הנדסת חשמל",
    "lastSync": "2026-04-01T16:00:00.000Z",
    "sectionMap": {
      "הרצאות": { "folder": "הרצאות", "isMerged": false },
      "תרגול כיתה 1": { "folder": "תרגול כיתה", "isMerged": true, "numberPrefix": 1 },
      ...
    },
    "items": {
      "3312001": {
        "section": "הרצאות",
        "moodleName": "חוברת קורס חשמל",
        "type": "resource",
        "status": "downloaded",
        "savedAs": "הרצאות/חוברת קורס חשמל.rar",
        "fileSize": 4521234,
        "downloadedAt": "2026-04-01T16:05:23.000Z"
      },
      "3312002:Lab3_ClassEx.docx": {
        "section": "מעבדות",
        "moodleName": "Lab3_ClassEx.docx",
        "type": "folder",
        "status": "downloaded",
        "savedAs": "מעבדות/תרגול 3/Lab3_ClassEx.docx",
        "fileSize": 23456,
        "downloadedAt": "2026-04-01T16:05:25.000Z"
      }
    }
  }
}
```

Key design decisions:
- **Manifest keys:** `cmid` for top-level items, `parentCmid:childName` for mod/folder children (since all children share the parent's cmid).
- **Section mapping stored per course** so subsequent syncs know exactly which folder a new item in a given section should land in - no need to re-derive the mapping.
- **File sizes tracked** for future ETag/content-length-based update detection in incremental mode.
- **Status values:** `downloaded`, `extracted` (ZIP was unpacked), `removed_from_moodle` (item disappeared from Moodle but file kept on disk).

### Known Limitations (v3.0)

- **Colab notebooks:** Skipped with a log entry. Colab requires navigating to each notebook URL in a separate tab and extracting via `colab.global.notebook` - cannot be done from the Moodle tab. A future version could open Colab tabs and use `BroadcastChannel` to collect notebooks.
- **BGU admin syllabi:** Skipped with a log entry. Requires same-origin fetch from a `bgu4u.bgu.ac.il` tab with active SSO session - cannot be done cross-origin from Moodle.
- **RAR extraction:** Not supported in browser. RAR files are saved as-is.
- **Google Sites exploration:** Logged as external link. Requires manual navigation to discover linked files.

### CDN Dependencies

The engine loads two libraries from CDN at runtime (only when needed):
- **SheetJS** (`xlsx.full.min.js` v0.20.3) - for generating the Excel log.
- **JSZip** (v3.10.1) - for extracting ZIP archives.

Both are loaded lazily: SheetJS only when generating the Excel file, JSZip only when a ZIP file is downloaded.

---

## Safety Rules (S1-S8 added 2026-04-03, S9-S11 added 2026-04-03 evening)

These rules were added after an incident where the scheduled incremental sync re-downloaded every file because `loadManifest()` silently returned `{}` when the FUSE mount was deadlocked. The silent `catch { return {} }` in loadManifest was the single point of failure - an empty manifest in incremental mode is indistinguishable from a seed run.

### S1 - Abort on empty manifest (incremental mode)

If mode is `incremental` and the loaded manifest has 0 courses and 0 items, the engine throws immediately and refuses to proceed. This prevents blind full re-downloads when the manifest file is unreadable.

### S2 - IndexedDB manifest backup

After every successful sync, the manifest is saved to **both** the filesystem (`.moodle_manifest.json`) and **IndexedDB** (`MoodleSyncBackup` database, key `manifest`). On load, the engine tries the filesystem first; if that returns empty or fails, it falls back to the IndexedDB copy. This provides resilience against filesystem failures (FUSE deadlocks, permission issues, etc.).

### S3 - IndexedDB directory handle cache

After the first `showDirectoryPicker()` call, the returned `FileSystemDirectoryHandle` is stored in IndexedDB (key `directoryHandle`). On subsequent runs, the engine tries the cached handle first with `queryPermission({ mode: 'readwrite' })`. If granted, it skips the picker entirely. If permission was revoked, it calls `requestPermission()` to re-prompt. Only falls back to `showDirectoryPicker()` if the cached handle is unavailable. This eliminates the folder picker blocker on repeat runs.

### S4 - Download count safety valve

In incremental mode, after filtering the download queue: if the queue length exceeds **50% of total scraped items** AND is greater than **10 items**, the engine aborts. This catches cases where manifest corruption causes most items to appear "new" - which would otherwise trigger a mass re-download.

### S5 - Login enforcement

Before any sync operation, the engine first confirms login status (`M.cfg.userId > 1` or a user-menu element). Only when the user is logged OUT does it click a login button (`התחברות` / `Log in`) and then abort so the user can finish logging in. It must NOT click a login link when already logged in: on some institutions the login link points to an external SSO / exam system, so clicking it navigates the page away mid-run (this broke HUJI; fixed in v3.0.3). The login-status check still catches the subtle case where a cached dashboard looks logged-in but the session has expired — running sync without login would otherwise produce empty course pages or redirect errors.

### S6 - Config backup in IndexedDB

The config object is saved to IndexedDB (key `config`) whenever it's loaded from `window.__MOODLE_SYNC_CONFIG__` or saved from the setup form. If config loading fails on a subsequent run (e.g., the injection didn't happen, the config file is unreachable), the engine falls back to the IndexedDB copy. This prevents the setup form from appearing unexpectedly on later runs.

### S7 - Stale rootPath warning

When config is restored from IndexedDB (S6 fallback), the engine checks if `rootPath` contains multiple path segments (e.g. `שנה ג׳/סמסטר ב׳`). This was the old format from when the user picked the Documents folder as root. Since Chrome blocks picking system folders like Documents, the current convention is: **pick the year folder** (e.g. `שנה ג׳`) and set `rootPath` to just the semester name (e.g. `סמסטר ב׳`). A multi-segment rootPath combined with picking the year folder creates duplicate nested directories and an empty manifest (clean re-download). The engine logs a warning if this is detected.

### S8 - Abort seed into populated folder

If mode is `seed` and the loaded manifest has more than 0 items, the engine aborts immediately. This prevents accidentally re-seeding into an already-populated semester folder, which would create duplicate files (e.g. `תרגול 1 (2).pdf`). The user is told to either change `rootPath` to a new semester folder or manually delete the manifest and course folders if they truly want a fresh start.

### S9 - Persistent sync lock in IndexedDB

Before sync starts, the engine writes a lock object to IndexedDB (key `syncLock`) with `{ running: true, startedAt: <ISO timestamp>, mode: <seed/incremental> }`. The lock is cleared in the `finally` block after sync completes (or fails). On startup, `acquireSyncLock()` checks for an existing lock:

- **Lock exists and is < 10 minutes old** → refuse to start (another tab may be running). The user is told to wait or reload.
- **Lock exists and is ≥ 10 minutes old** → stale lock from an interrupted run. Clear it, log a warning, and proceed.
- **No lock** → proceed normally.

This prevents two failure modes: (1) concurrent syncs from multiple tabs, and (2) the engine not knowing that a previous run was interrupted. The 10-minute threshold balances safety (a normal sync takes 2–3 minutes) with practicality (the user doesn't have to wait forever after killing a run).

### S10 - IndexedDB-first manifest save

`saveManifest()` now writes to IndexedDB **before** the filesystem. Previously, the filesystem was written first - if the tab was closed mid-write (during `createWritable()` → `write()` → `close()`), both the filesystem copy and the IndexedDB backup could be left inconsistent. Now IndexedDB is always at least as fresh as the filesystem. If the filesystem write fails or is interrupted, the IndexedDB copy remains intact and will be used on the next run via the S2 fallback.

### S11 - Filesystem health check

Before reading the manifest, the engine performs a canary write: creates a small temporary file (`.moodle_sync_canary`), writes `"ok"`, closes it, and deletes it. This is wrapped in a 5-second timeout via `Promise.race()`. If the canary write times out or throws, the FUSE mount is considered deadlocked, and the engine skips the filesystem entirely - going straight to the IndexedDB manifest backup (S2). This prevents the silent `catch { return {} }` scenario that caused the 2026-04-03 re-download incident.

---

## Chrome Extension Architecture (v2.0 / Engine v3.0)

### UI Model: Floating Toast + Popup Controls

The engine no longer creates an in-page sidebar. Instead:

- **Extension Popup** is the primary control surface: shows university, semester, course count, and provides three sync buttons (Seed Run, Incremental Sync, Dry Run). The popup does not need to stay open during sync.
- **Floating Toast** is a small (300×80px) non-blocking overlay in the bottom-right corner that appears only during sync. Shows progress bar, current operation text, and percentage. Has a dismiss button. Disappears automatically on completion.
- **Desktop Notification** fires when sync finishes with a summary of results.

### Engine API

The engine exposes `window.__MOODLE_SYNC_API__` for external control:

| Method | Returns | Description |
|--------|---------|-------------|
| `startSync(mode)` | void | Starts a sync. Mode: `'seed'`, `'incremental'`, or `'dry'` |
| `getStatus()` | object | `{ running, progress, mode, results, needsConfig, ready, courses, currentOp }` |
| `getLog()` | string[] | Full log array |

### Communication Flow

```
Popup → chrome.runtime.sendMessage → Content Script → inject <script> → Engine API
Engine API → window.postMessage → Content Script → sendResponse → Popup
```

The content script bridges between the popup (extension context) and the engine (page main world) using injected script snippets and `window.postMessage`.

### Generalization Features

1. **basePath**: Configurable URL path prefix (e.g., `/moodle/` for BGU, `/2025-26/` for HUJI). All Moodle URL constructions use `CONFIG.basePath`.
2. **Login Selectors**: `CONFIG.loginSelectors` (CSS selectors) and `CONFIG.loginTextMatches` (text patterns) replace hardcoded login detection.
3. **Semester Flexibility**: `CONFIG.semesterCheck` supports comma-separated values (e.g., `"סמ 2,סמסטר ב,2025B"`).
4. **Bundled Libraries**: SheetJS and JSZip are bundled in the extension (`engine/lib/`) with CDN fallback.
5. **Institution Auto-Detection**: Content script matches `window.location.hostname` against known presets.
6. **Dashboard Course Detection**: On Moodle dashboard pages, enrolled courses are automatically scraped and stored for config pre-fill.

### Extension File Map

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest with 40+ Israeli Moodle domains |
| `content.js` | Injection orchestrator, message bridge, dashboard detection |
| `popup.html/js/css` | Sync controls and status display |
| `options.html/js/css` | Full config editor with 30+ university presets |
| `engine/moodle_sync.js` | The sync engine (v3.0) |
| `engine/lib/xlsx.full.min.js` | Bundled SheetJS |
| `engine/lib/jszip.min.js` | Bundled JSZip |
