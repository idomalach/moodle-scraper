---
name: moodle-course-setup
description: Downloads and organizes all course materials from BGU Moodle for a given semester. Use this skill at the start of every semester, when setting up a new course, or when sharing the system with a friend. It configures the sync engine, runs the seed download, and sets up the daily scheduled task. Trigger whenever the user mentions Moodle, course setup, semester start, downloading university materials, or organizing academic content.
---

# Moodle Course Setup — Unified Skill

This skill sets up the complete Moodle sync system for a semester: configures courses, runs the seed download, and activates the daily incremental sync. It works for any BGU student with any set of courses.

## System overview

The sync system has these key files:

| File | What it does |
|------|-------------|
| `moodle_sync_config.json` | Course list, semester ID, folder paths. **Edit this** to change courses. |
| `moodle_sync.js` | The sync engine (v3.0). Runs in a Moodle browser tab. Course-agnostic — reads config at runtime. Includes safety patches S1–S12. |
| `moodle_sync_spec.md` | Full specification with all rules, edge cases, safety rules, and implementation notes. Reference doc. |
| `bgu-moodle-sync-extension/` | Chrome extension (v3.0, Manifest V3). Auto-injects the engine on any Israeli Moodle page. |

All files live in the user's working folder (e.g. "Moodle content download" in Documents/Claude/Projects). The engine exists in 3 identical copies that must stay in sync (root, extension root, extension/engine/).

---

## When to use this skill

- **New semester:** User says "set up my courses for this semester" or "download my Moodle materials"
- **New user / friend sharing:** User says "set this up for me" or "I want to use your Moodle downloader"
- **Add/change courses:** User says "add a course" or "I dropped a course"
- **Re-run seed:** User says "redownload everything" or "start fresh"

---

## Steps

### Step 1 — Gather inputs

Ask the user (use AskUserQuestion tool):

1. **Semester identifier** — the string that appears in Moodle course titles (e.g. "סמ 2" for semester B, "סמ 1" for semester A)
2. **Year and semester** — the year folder the user will pick in the directory picker (e.g. "שנה ג׳") and the semester subfolder name for `rootPath` (e.g. "סמסטר ב׳")
3. **Courses** — for each course:
   - The Moodle course ID (from the URL: `course/view.php?id=XXXXX`)
   - The short folder name they want (e.g. "רגרסיה" instead of the full Moodle title)
4. **Download folder location** — where on their computer should the semester folder live (default: Documents)

If the user already has a `moodle_sync_config.json`, read it and confirm whether to reuse or update.

### Step 2 — Create/update the config file

Write `moodle_sync_config.json` with the gathered inputs:

```json
{
  "baseUrl": "https://moodle.bgu.ac.il",
  "semesterCheck": "<semester identifier>",
  "rootPath": "<semester>",
  "semesterAbsolutePath": "<absolute path to semester folder>",
  "syncScriptPath": "<absolute path to moodle_sync.js>",
  "courses": [
    { "id": <moodle_id>, "moodleName": "", "folderName": "<short name>" }
  ],
  "silentSkipTypes": ["label", "page", "zoom", "lti", "forum", "choicegroup"],
  "mergeThreshold": 2,
  "delayBetweenFetches": 200,
  "batchPause": 500
}
```

The `moodleName` field can be left empty — it's only used for display.

### Step 3 — Verify Moodle access

Navigate to `https://moodle.bgu.ac.il/moodle/my/` in Chrome. **Important:** Always click the "התחברות" (login) link first, even if the page looks like a dashboard — the page can appear logged-in while the session is actually expired. Confirm:
- The user is logged in (user menu visible, not just a cached page)
- Each course ID loads correctly (visit `course/view.php?id=X` for each)
- The page title contains the semester identifier

If any course fails, help the user find the correct ID via Moodle search.

### Step 4 — Run the seed sync

1. Read the config file from disk at its `syncScriptPath` location.
2. Compute the engine hash in bash:
   ```bash
   ENGINE_HASH=$(shasum -a 256 "<path to moodle_sync.js>" | cut -d' ' -f1)
   ```
3. Inject the config into the Moodle tab via `javascript_tool`:
   ```javascript
   window.__MOODLE_SYNC_CONFIG__ = <config JSON>;
   ```
4. Inject the **S12 bootstrapper** via `javascript_tool` — this attempts to load the engine from IndexedDB cache:
   ```javascript
   (async () => {
     const EXPECTED_HASH = "<ENGINE_HASH>";
     function openIDB() {
       return new Promise((resolve, reject) => {
         const req = indexedDB.open('MoodleSyncBackup', 2);
         req.onupgradeneeded = (e) => {
           const db = e.target.result;
           if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups');
         };
         req.onsuccess = () => resolve(req.result);
         req.onerror = () => reject(req.error);
       });
     }
     async function idbGet(key) {
       const db = await openIDB();
       return new Promise((resolve, reject) => {
         const tx = db.transaction('backups', 'readonly');
         const req = tx.objectStore('backups').get(key);
         req.onsuccess = () => resolve(req.result ?? null);
         req.onerror = () => reject(req.error);
       });
     }
     try {
       const cachedHash = await idbGet('engineHash');
       if (cachedHash === EXPECTED_HASH) {
         const cachedSource = await idbGet('engineSource');
         if (cachedSource) { eval(cachedSource); return 'ENGINE_CACHED'; }
       }
     } catch (e) {}
     return 'ENGINE_MISS';
   })()
   ```
   - **If `ENGINE_CACHED`:** Engine is loaded. Skip to step 7 (sidebar appears). **Total: 2 `javascript_tool` calls.**
   - **If `ENGINE_MISS`:** Continue to step 5 (full chunked injection).
5. **(Only on cache miss)** Compress and inject the engine via gzip + base64 chunks. The sandbox `localhost` is not reachable from the Mac's Chrome, so a local server won't work:
   ```bash
   gzip -c "<path to moodle_sync.js>" | base64 | tr -d '\n' | fold -w 15000 > /tmp/engine_chunks.txt
   ```
   For each chunk (lines in `/tmp/engine_chunks.txt`), call `javascript_tool`:
   ```javascript
   window.__EC = (window.__EC || []); window.__EC.push("<chunk contents>");
   ```
6. **(Only on cache miss)** Final call — decompress, **cache in IndexedDB (S12)**, and execute:
   ```javascript
   (async () => {
     const EXPECTED_HASH = "<ENGINE_HASH>";
     const b64 = window.__EC.join('');
     const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
     const ds = new DecompressionStream('gzip');
     const writer = ds.writable.getWriter();
     writer.write(bytes); writer.close();
     const reader = ds.readable.getReader();
     let chunks = [];
     while (true) { const {done, value} = await reader.read(); if (done) break; chunks.push(value); }
     const text = new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));
     try {
       const db = await new Promise((resolve, reject) => {
         const req = indexedDB.open('MoodleSyncBackup', 2);
         req.onupgradeneeded = (e) => {
           if (!e.target.result.objectStoreNames.contains('backups'))
             e.target.result.createObjectStore('backups');
         };
         req.onsuccess = () => resolve(req.result);
         req.onerror = () => reject(req.error);
       });
       await new Promise((resolve, reject) => {
         const tx = db.transaction('backups', 'readwrite');
         const store = tx.objectStore('backups');
         store.put(text, 'engineSource');
         store.put(EXPECTED_HASH, 'engineHash');
         tx.oncomplete = () => resolve();
         tx.onerror = () => reject(tx.error);
       });
     } catch (e) { console.warn('[MoodleSync] Failed to cache engine:', e); }
     eval(text);
     return 'Engine loaded and cached';
   })()
   ```
   Full injection takes ~22 `javascript_tool` calls but only happens on first run or after code changes. No server or network access needed — pure in-browser decompression via the native `DecompressionStream` API (Chrome 80+).
4. The engine initializes and exposes `window.__MOODLE_SYNC_API__`. Tell the user to click **"Seed Run (Full)"** in the extension popup.
5. The directory picker opens — user selects the **year folder** (e.g. `שנה ג׳`). The engine navigates into the semester subfolder via `rootPath`. After this first selection, the handle is cached in IndexedDB (S3 patch) so future runs skip the picker.
6. Monitor the log for "SYNC COMPLETE".
7. Report results: files downloaded, items skipped, any errors.

### Step 5 — Review skipped items

After the seed run, check the Excel log in the semester folder. For each skipped item, determine if manual intervention is needed:

- **Colab notebooks:** Need browser extraction (open each Colab URL, extract via JS)
- **BGU admin syllabi:** Need link-hopping technique (right-click → open in new tab, repeat)
- **External links:** Informational only, no action needed
- **Download errors:** Retry or investigate

Walk the user through any manual steps.

### Step 6 — Set up the scheduled task

Create (or update) the `moodle-incremental-sync` scheduled task:
- Runs daily at 4 PM (16:00)
- Reads config from the absolute path to `moodle_sync_config.json`
- Compresses the engine in bash (`gzip -c moodle_sync.js | base64`), splits into ~15KB chunks
- Injects config via `javascript_tool`, then injects engine chunks (2-3 calls), then a final decompress-and-eval call
- Triggers incremental sync

**Important:** The task must read the engine from the local filesystem. Do NOT fetch from GitHub — the local file is the source of truth. The gzip+base64 chunked injection means no local server is needed — the engine is compressed in bash and decompressed in-browser via `DecompressionStream`.

Update the task prompt with the correct absolute paths from the config.

Recommend the user click "Run now" once to pre-approve tool permissions and cache the directory handle.

### Step 7 — Confirm everything works

Checklist:
- [ ] All courses have folders with downloaded files
- [ ] `סטטוס סנכרון.xlsx` exists in each course folder
- [ ] `.moodle_manifest.json` exists in the semester folder
- [ ] Excel log lists only genuinely un-downloadable items
- [ ] Scheduled task is active and shows next run time
- [ ] Directory handle cached in IndexedDB (future runs skip the picker)
- [ ] User understands: "Just stay logged into Moodle. New files appear automatically."

---

## Updating for a new semester

1. Edit `moodle_sync_config.json` with new course IDs, semester check, and root path
2. Run this skill again — it will detect the existing config and ask what to update
3. The sync engine and scheduled task need no code changes

## Sharing with a friend

1. Give them `moodle_sync.js` and `moodle_sync_spec.md`
2. They run the engine in their Moodle tab — it shows the setup form since no config exists
3. They enter their courses and click "Save Config & Continue"
4. They click "Seed Run (Full)" and pick their download folder
5. Done. They can set up the scheduled task via Claude.

---

## Reference

- Full spec: `moodle_sync_spec.md` in the working folder
- Engine source: `moodle_sync.js` in the working folder
- Config: `moodle_sync_config.json` in the working folder (and semester folder after first run)
- GitHub repo: [`github.com/idomalach/bgu-moodle-sync`](https://github.com/idomalach/bgu-moodle-sync) (for open-source sharing, not for runtime use)
