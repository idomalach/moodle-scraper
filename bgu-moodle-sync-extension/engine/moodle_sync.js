/**
 * Moodle Sync Engine v3.0 (generalized, floating toast UI, REST API, parameterized login detection, basePath support)
 *
 * Unified engine for both seed runs and incremental syncs.
 * Inject this into any Moodle tab and control via REST API or directly.
 *
 * Usage: Paste into Chrome DevTools console on any Moodle page,
 *        or inject via Claude in Chrome's javascript_tool.
 *        Call window.__MOODLE_SYNC_API__.startSync('seed') or 'incremental'.
 *
 * Configuration is loaded from moodle_sync_config.json (same folder as
 * this script). To change courses, semester, or paths — edit that file,
 * not this one. The engine is course-agnostic.
 *
 * Configuration is handled by the extension options page. The engine
 * exposes a REST-like API at window.__MOODLE_SYNC_API__ for programmatic control.
 */

(function () {
  'use strict';

  // ============================================================
  // CONFIGURATION — loaded at runtime from config file or UI form
  // ============================================================

  // Defaults — overridden by moodle_sync_config.json if present
  let CONFIG = {
    baseUrl: 'https://moodle.bgu.ac.il',
    basePath: '/moodle/',   // e.g. '/moodle/' for BGU, '/2025-26/' for HUJI
    semesterCheck: '',      // e.g. 'סמ 2' — set via config (comma-separated for alternatives)
    rootPath: '',           // e.g. 'סמסטר ב׳' — set via config (relative to the folder picked in the directory picker)
    courses: [],            // populated from config or setup form
    loginSelectors: ['a[href*="login/index.php"]', 'a.btn-login', 'a[data-title="login,moodle"]'],  // CSS selectors for login button
    loginTextMatches: ['התחברות', 'Log in', 'כניסה', 'Sign in'],  // text to match in links
    silentSkipTypes: ['label', 'page', 'zoom', 'lti', 'forum', 'choicegroup'],
    mergeThreshold: 3,
    delayBetweenFetches: 200,
    batchPause: 500,
  };

  /**
   * Try to load config from a JSON file picked by the user,
   * or injected by the scheduled task via window.__MOODLE_SYNC_CONFIG__.
   */
  async function loadConfig() {
    // Option 1: Config injected into window (by scheduled task or script)
    if (window.__MOODLE_SYNC_CONFIG__) {
      const ext = window.__MOODLE_SYNC_CONFIG__;
      Object.assign(CONFIG, ext);
      log('Config loaded from window.__MOODLE_SYNC_CONFIG__');
      // S6 — Backup config to IndexedDB
      try { await idbSet('config', CONFIG); } catch {}
      return true;
    }

    // Option 1.5: Config from DOM bridge (set by Chrome extension content script — CSP-safe)
    const bridgeEl = document.getElementById('moodle-sync-bridge');
    if (bridgeEl) {
      const bridgeConfig = bridgeEl.getAttribute('data-config');
      if (bridgeConfig) {
        try {
          Object.assign(CONFIG, JSON.parse(bridgeConfig));
          log('Config loaded from DOM bridge (extension content script)');
          // Also read lib base and icon from bridge
          const libBase = bridgeEl.getAttribute('data-lib-base');
          if (libBase) window.__MOODLE_SYNC_LIB_BASE__ = libBase;
          const iconUrl = bridgeEl.getAttribute('data-icon');
          if (iconUrl) window.__MOODLE_SYNC_ICON__ = iconUrl;
          // S6 — Backup config to IndexedDB
          try { await idbSet('config', CONFIG); } catch {}
          return true;
        } catch (e) {
          console.warn('[MoodleSync] Failed to parse DOM bridge config:', e);
          /* fall through */
        }
      }
    }

    // S6 — Fallback: try IndexedDB config backup
    try {
      const cachedConfig = await idbGet('config');
      if (cachedConfig && cachedConfig.courses && cachedConfig.courses.length > 0) {
        Object.assign(CONFIG, cachedConfig);
        log('Config restored from IndexedDB backup');
        // S7 — Warn if cached rootPath uses the old two-part format
        const segments = CONFIG.rootPath ? CONFIG.rootPath.split('/').filter(p => p.length > 0).length : 0;
        if (segments > 1) {
          log('  ⚠️ WARNING: rootPath has multiple segments ("' + CONFIG.rootPath + '") — this may create duplicate folders.');
          log('  ⚠️ If you pick the year folder (e.g. שנה ג׳), rootPath should be just the semester (e.g. סמסטר ב׳).');
          log('  ⚠️ Re-run with injected config or use the setup form to fix the IndexedDB cache.');
        }
        return true;
      }
    } catch {}

    return false;
  }

  // ============================================================
  // STATE
  // ============================================================

  let state = {
    mode: null,           // 'seed' or 'incremental'
    rootHandle: null,     // FileSystem root directory handle
    semesterHandle: null, // semester folder handle (e.g. סמסטר ב׳ inside the picked year folder)
    manifest: null,       // loaded manifest JSON
    sectionMap: {},       // courseId -> sectionMapping
    items: [],            // all scraped items across courses
    downloadQueue: [],    // items to download
    skipQueue: [],        // items to log to Excel
    results: { downloaded: 0, failed: 0, skipped: 0, newItems: 0, updated: 0 },
    log: [],
    running: false,
    holdsLock: false,     // whether THIS tab currently holds the persistent sync lock
    toastEl: null,        // floating toast UI element
    // Progress tracking
    progressPercent: 0,
    progressStep: '',     // e.g. 'Scraping courses...', 'Downloading 5/20...'
    totalDownloads: 0,
    completedDownloads: 0,
  };

  // ============================================================
  // BUNDLED LIBRARY LOADER
  // ============================================================

  async function loadLibrary(name, url, globalName) {
    if (window[globalName]) return window[globalName];
    log(`Loading ${name}...`);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        if (window[globalName]) {
          log(`  ${name} loaded`);
          resolve(window[globalName]);
        } else {
          reject(new Error(`${name} loaded but ${globalName} not found on window`));
        }
      };
      script.onerror = () => reject(new Error(`Failed to load ${name}`));
      document.head.appendChild(script);
    });
  }

  async function ensureSheetJS() {
    if (window.XLSX) return window.XLSX;
    const extBase = window.__MOODLE_SYNC_LIB_BASE__;
    if (!extBase) throw new Error('SheetJS unavailable: extension library base not set');
    await loadLibrary('SheetJS', extBase + 'lib/xlsx.full.min.js', 'XLSX');
    return window.XLSX;
  }

  async function ensureJSZip() {
    if (window.JSZip) return window.JSZip;
    const extBase = window.__MOODLE_SYNC_LIB_BASE__;
    if (!extBase) throw new Error('JSZip unavailable: extension library base not set');
    await loadLibrary('JSZip', extBase + 'lib/jszip.min.js', 'JSZip');
    return window.JSZip;
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  function log(msg) {
    const timestamp = `[${new Date().toLocaleTimeString()}]`;
    state.log.push(`${timestamp} ${msg}`);
    console.log(`[MoodleSync] ${msg}`);
    // Update toast if running
    if (state.running && state.toastEl) {
      const toastText = state.toastEl.querySelector('#moodle-sync-toast-text');
      if (toastText) {
        toastText.textContent = msg;
      }
    }
    // Update DOM bridge status (for extension popup)
    if (typeof updateBridgeStatus === 'function') {
      try { updateBridgeStatus(); } catch {}
    }
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /** Normalize a filename per spec rules */
  function normalizeName(name) {
    if (!name) return 'unnamed';
    let n = name;
    // Strip invisible Unicode + control chars (control chars are illegal on Windows)
    n = n.replace(/[\u200F\u200E\u200B\u200C\u200D\u061C\uFEFF]/g, '');
    n = n.replace(/[\x00-\x1F]/g, '');
    // Replace chars illegal on Windows/macOS filesystems
    n = n.replace(/[\/\\:*?"<>|]/g, '-');
    // Collapse multiple spaces
    n = n.replace(/\s+/g, ' ');
    // Strip trailing underscores, dots, punctuation (except closing parens)
    n = n.replace(/[_.!,;:]+$/g, '');
    // Trim
    n = n.trim();
    // Truncate if > 80 chars. No trailing "..." \u2014 Windows forbids names ending
    // in a dot or space.
    if (n.length > 80) n = n.substring(0, 80).replace(/[ ._]+$/g, '').trim();
    // Avoid Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(n)) n = '_' + n;
    return n || 'unnamed';
  }

  /** Detect extension from Content-Disposition or Content-Type */
  function detectExtension(resp, fallbackName) {
    const cd = resp.headers.get('content-disposition') || '';
    const match = cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (match) {
      const serverName = decodeURIComponent(match[1].replace(/"/g, ''));
      const dotIdx = serverName.lastIndexOf('.');
      if (dotIdx > 0) return serverName.substring(dotIdx);
    }
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/pdf')) return '.pdf';
    if (ct.includes('spreadsheetml')) return '.xlsx';
    if (ct.includes('presentationml')) return '.pptx';
    if (ct.includes('wordprocessingml')) return '.docx';
    if (ct.includes('x-rar')) return '.rar';
    if (ct.includes('zip')) return '.zip';
    if (ct.includes('text/html')) return '.html';
    if (ct.includes('text/plain')) return '.txt';
    if (ct.includes('image/png')) return '.png';
    if (ct.includes('image/jpeg')) return '.jpg';
    // Check fallback name
    if (fallbackName) {
      const idx = fallbackName.lastIndexOf('.');
      if (idx > 0) return fallbackName.substring(idx);
    }
    return '';
  }

  /** Check if a file is a solution based on name */
  function isSolutionFile(name) {
    const n = (name || '').trim();
    return n.startsWith('פתרון') || n.toLowerCase().startsWith('solution');
  }

  /** Check if a name is a syllabus */
  function isSyllabus(name) {
    const n = (name || '').toLowerCase();
    return n.includes('סילבוס') || n.includes('סיליבוס') || n.includes('syllabus');
  }

  /** Check if a name/section relates to exams */
  function isExamRelated(name) {
    const n = (name || '').trim();
    return /מבחנ|בחינ|מועד|exam/i.test(n);
  }

  /**
   * Hebrew academic year to Gregorian mapping.
   * תשפ"א = 5781 → 2020-2021, etc.
   */
  function hebrewYearToGregorian(hebrewYear) {
    const cleaned = hebrewYear.replace(/[""״׳']/g, '');
    // Map Hebrew letters to numeric values
    const vals = { 'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9 };
    // Common academic years: תשפא..תשפט, תשצא..
    // "תשפ" prefix = 5780, last letter is units
    const lastChar = cleaned.slice(-1);
    if (vals[lastChar] !== undefined) {
      const base = cleaned.startsWith('תשצ') ? 5790 : cleaned.startsWith('תשפ') ? 5780 : 0;
      if (base) {
        const hebrewNumeric = base + vals[lastChar];
        return hebrewNumeric - 3760; // Convert to Gregorian (start year of academic year)
      }
    }
    return null;
  }

  /**
   * Normalize moed letter to Hebrew א/ב/ג.
   */
  function normalizeMoed(raw) {
    if (!raw) return null;
    const c = raw.trim().toUpperCase();
    const map = { 'A':'א', 'B':'ב', 'C':'ג', 'D':'ד', '1':'א', '2':'ב', '3':'ג',
                  'א':'א', 'ב':'ב', 'ג':'ג', 'ד':'ד' };
    return map[c] || null;
  }

  /**
   * Normalize semester to Hebrew א/ב.
   */
  function normalizeSemester(raw) {
    if (!raw) return null;
    const c = raw.trim();
    // Hebrew: א / ב / a / b / 1 / 2
    const map = { 'א':'א', 'ב':'ב', 'a':'א', 'b':'ב', 'A':'א', 'B':'ב', '1':'א', '2':'ב' };
    return map[c] || null;
  }

  /**
   * Extract the full exam identity from a filename or title.
   * Tries to find year, semester, and moed to build a unique subfolder name.
   * Returns a folder name string like "2024 סמסטר א מועד א", or null if
   * insufficient info is found (falls back to generic exam folder).
   *
   * Supports patterns observed across Israeli Moodle instances:
   *   - "מבחן ופתרון, מועד א' סמסטר א' 2020"
   *   - "מבחן ופתרון-מועד א' סמסטר א' 2024"
   *   - "מבחן + פתרון 2026 מועד א סמסטר א"
   *   - "Final exam S12024"  (S = semester, 1 = sem number, 2024 = year)
   *   - "מועדי א/ב תשפד"   (Hebrew academic year)
   *   - "2024A" / "2024B"   (compact year+moed)
   *   - "מועד א 2023"       (moed + year, no semester)
   *   - "מבחן סמסטר ב 2022 מועד ב"
   */
  function extractExamIdentity(name) {
    const n = (name || '').trim();
    if (!n) return null;

    let year = null, semester = null, moed = null;

    // ── Extract year ──────────────────────────────────────────
    // Gregorian year: 2018-2029
    const yearMatch = n.match(/(20[12]\d)/);
    if (yearMatch) year = yearMatch[1];

    // Hebrew academic year: תשפ"ד, תשפד, תשצ"א, etc.
    if (!year) {
      const hebrewYearMatch = n.match(/תש[פצ][""״׳']?[אבגדהוזחט]/);
      if (hebrewYearMatch) {
        const greg = hebrewYearToGregorian(hebrewYearMatch[0]);
        if (greg) year = String(greg);
      }
    }

    // ── Extract semester ──────────────────────────────────────
    // "סמסטר א'" / "סמסטר ב'" / "סמסטר א" / "סמ א" / "סמ 2"
    const semMatch = n.match(/סמ(?:סטר)?\s*['׳]?([אב12])['׳]?/);
    if (semMatch) semester = normalizeSemester(semMatch[1]);

    // English compact: S12024, S22023 — semester + year
    if (!semester) {
      const sCompact = n.match(/S([12])(20[12]\d)/i);
      if (sCompact) {
        semester = normalizeSemester(sCompact[1]);
        if (!year) year = sCompact[2];
      }
    }

    // ── Extract moed ──────────────────────────────────────────
    // "מועד א'" / "מועד ב" / "מועד מיוחד" / "מועד חוזר"
    const moedHeb = n.match(/מועד\s*['׳]?([אבגדA-Da-d])['׳]?/);
    if (moedHeb) moed = normalizeMoed(moedHeb[1]);

    // "מועד מיוחד" / "מועד חוזר" — special moeds
    if (!moed) {
      if (/מועד\s*מיוחד/.test(n)) moed = 'מיוחד';
      if (/מועד\s*חוזר/.test(n)) moed = 'חוזר';
    }

    // "מועד 1" / "מועד 2"
    if (!moed) {
      const moedNum = n.match(/מועד\s*(\d)/);
      if (moedNum) moed = normalizeMoed(moedNum[1]);
    }

    // English: "Moed A" / "Moed B"
    if (!moed) {
      const moedEng = n.match(/moed\s*([A-Da-d])/i);
      if (moedEng) moed = normalizeMoed(moedEng[1]);
    }

    // Compact year+moed: "2024A" / "2024B" (only if not already parsed)
    if (!moed) {
      const compact = n.match(/(20[12]\d)\s*([ABab])(?:\s|$|[^a-zA-Z])/);
      if (compact) {
        moed = normalizeMoed(compact[2]);
        if (!year) year = compact[1];
      }
    }

    // ── Build subfolder name ──────────────────────────────────
    // Need at least year + moed to create a meaningful subfolder.
    // If we only have moed (no year), we can't distinguish exams → return null → generic folder.
    if (!year && !moed) return null;

    // If we have year but no moed, still create a year-based folder (e.g. "2024")
    // This handles cases like "Final exam S12024" where moed isn't specified
    let folderName = '';
    if (year) folderName += year;
    if (semester) folderName += ` סמסטר ${semester}`;
    if (moed) {
      if (moed === 'מיוחד' || moed === 'חוזר') {
        folderName += ` מועד ${moed}`;
      } else {
        folderName += ` מועד ${moed}`;
      }
    }

    return folderName.trim() || null;
  }

  /**
   * Legacy wrapper — extract just the moed letter for backwards compatibility.
   * Used only where the full identity isn't needed.
   */
  function extractMoed(name) {
    const identity = extractExamIdentity(name);
    // For legacy callers, return the identity string (or null)
    return identity;
  }

  /** Generate a unique manifest key for an item */
  function manifestKey(item) {
    // mod/folder children share a cmid — use cmid:childName for uniqueness
    if (item.isChild && item.parentCmid) {
      return `${item.parentCmid}:${item.name}`;
    }
    return item.cmid;
  }

  /**
   * Has this cmid already been seen in a prior sync — either downloaded OR
   * recorded as skipped/failed? Checks both the direct cmid key and any
   * child keys (`cmid:childName`). Used in incremental mode to avoid
   * re-resolving items we already handled (especially slow cross-origin
   * mod/url targets like Colab, external sites, and the BGU syllabus portal,
   * which fail every run and otherwise make incremental syncs crawl).
   */
  function isKnownInManifest(courseId, cmid) {
    const cm = state.manifest[courseId];
    if (!cm || !cm.items) return false;
    if (cm.items[cmid]) return true;
    const prefix = `${cmid}:`;
    return Object.keys(cm.items).some(k => k.startsWith(prefix));
  }

  /** SHA-256 hex of a Blob — used for content-based de-duplication. */
  async function sha256Hex(blob) {
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Fetch a CROSS-ORIGIN URL (e.g. the BGU bgu4u syllabus portal) via the
   * extension background service worker. The engine runs in the page main
   * world where such a fetch is CORS-blocked; the background worker (granted
   * host_permissions) can fetch it with the user's session and bypass CORS.
   * We message it through the content-script relay (window.postMessage bridge),
   * which returns the bytes base64-encoded. Returns { ok, blob, contentType }.
   */
  function crossOriginFetchBlob(url) {
    return new Promise((resolve) => {
      const id = 'xf_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
      let done = false;
      function onMsg(e) {
        if (e.source !== window) return;
        const d = e.data;
        if (!d || !d.__moodleSyncXFetchResult || d.id !== id) return;
        done = true;
        window.removeEventListener('message', onMsg);
        const r = d.result || {};
        if (r.ok && typeof r.dataB64 === 'string') {
          try {
            const bytes = Uint8Array.from(atob(r.dataB64), c => c.charCodeAt(0));
            resolve({ ok: true, blob: new Blob([bytes], { type: r.contentType || '' }), contentType: r.contentType || '' });
          } catch (err) {
            resolve({ ok: false, error: 'decode failed: ' + err.message });
          }
        } else {
          resolve({ ok: false, error: r.error || 'cross-origin fetch failed' });
        }
      }
      window.addEventListener('message', onMsg);
      window.postMessage({ __moodleSyncXFetch: true, id, url }, '*');
      setTimeout(() => {
        if (done) return;
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, error: 'cross-origin fetch timeout (is the extension background worker active?)' });
      }, 30000);
    });
  }

  // ============================================================
  // DOM SCRAPING — extract items from course pages
  // ============================================================

  /** Fetch a Moodle page and parse it */
  async function fetchMoodlePage(url) {
    const resp = await fetch(url, { credentials: 'include', redirect: 'follow' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    const html = await resp.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /** Scrape all sections and items from a course page */
  async function scrapeCourse(courseId, folderName) {
    log(`Scraping course ${folderName} (${courseId})...`);
    const url = `${CONFIG.baseUrl}${CONFIG.basePath}course/view.php?id=${courseId}`;
    const doc = await fetchMoodlePage(url);

    // Verify semester (support comma-separated alternatives)
    const title = doc.title || '';
    const checks = CONFIG.semesterCheck ? CONFIG.semesterCheck.split(',').map(s => s.trim()) : [];
    if (checks.length > 0 && !checks.some(check => title.includes(check))) {
      log(`  WARNING: title doesn't match any of [${checks.join(', ')}]: ${title}`);
    }

    const sections = doc.querySelectorAll('li.section.main');
    const items = [];
    const sectionNames = [];

    for (const section of sections) {
      const sectionNameEl = section.querySelector('.sectionname');
      const sectionName = sectionNameEl
        ? sectionNameEl.textContent.trim()
        : (section.getAttribute('aria-label') || '').trim();

      if (!sectionName) continue;

      const activities = section.querySelectorAll('li.activity');
      if (activities.length === 0) continue;

      sectionNames.push({ name: sectionName, items: [] });

      for (const act of activities) {
        const classes = act.className || '';
        const typeMatch = classes.match(/modtype_(\w+)/);
        if (!typeMatch) continue;
        const modType = typeMatch[1];

        const idAttr = act.id || '';
        const cmidMatch = idAttr.match(/module-(\d+)/);
        if (!cmidMatch) continue;
        const cmid = cmidMatch[1];

        const nameEl = act.querySelector('.instancename');
        let displayName = nameEl ? nameEl.textContent.trim() : '';
        const accessHide = nameEl ? nameEl.querySelector('.accesshide') : null;
        if (accessHide) {
          displayName = displayName.replace(accessHide.textContent.trim(), '').trim();
        }

        const linkEl = act.querySelector('a');
        const href = linkEl ? linkEl.href : '';

        items.push({
          courseId,
          courseName: folderName,
          section: sectionName,
          cmid,
          type: modType,
          name: displayName,
          url: href,
          direct: false,
          isChild: false,
          parentCmid: null,
          children: [],
        });

        sectionNames[sectionNames.length - 1].items.push(cmid);
      }
    }

    // Mark items in "assignment sections" — any section that contains a
    // submission box (mod/assign). Their question files get grouped under a
    // "תרגילים" subfolder so the section holds only תרגילים / הגשות / פתרונות מרצה.
    const assignSecs = new Set(items.filter(i => i.type === 'assign').map(i => i.section));
    for (const it of items) it.inAssignSection = assignSecs.has(it.section);

    log(`  Found ${items.length} items in ${sectionNames.length} sections`);
    return { items, sectionNames };
  }

  // ============================================================
  // SECTION → FOLDER MAPPING
  // ============================================================

  function buildSectionMapping(sectionNames, folderName) {
    const mapping = {};

    // Step 1: Detect numbered stem groups for merging
    const stemGroups = {};
    for (const s of sectionNames) {
      const match = s.name.match(/^(.+?)\s*(\d+)\s*$/);
      if (match) {
        const stem = match[1].trim();
        const num = parseInt(match[2]);
        if (!stemGroups[stem]) stemGroups[stem] = [];
        stemGroups[stem].push({ name: s.name, number: num });
      }
    }

    // Stems with >= threshold get merged
    for (const [stem, group] of Object.entries(stemGroups)) {
      if (group.length >= CONFIG.mergeThreshold) {
        for (const g of group) {
          mapping[g.name] = { folder: stem, isMerged: true, numberPrefix: g.number };
        }
      }
    }

    // Step 2: Handle solution sections
    for (const s of sectionNames) {
      if (mapping[s.name]) continue;
      if (s.name.startsWith('פתרונות')) {
        const parentName = s.name.replace(/^פתרונות\s*/, '').trim();
        const parentSection = sectionNames.find(p =>
          p.name === parentName ||
          parentName.includes(p.name) ||
          p.name.includes(parentName)
        );
        if (parentSection && parentSection.name !== s.name) {
          const parentFolder = mapping[parentSection.name]?.folder || parentSection.name;
          mapping[s.name] = { folder: `${parentFolder}/פתרונות מרצה`, isMerged: false, mergedInto: parentFolder };
        } else {
          mapping[s.name] = { folder: s.name, isMerged: false };
        }
      }
    }

    // Step 3: All remaining sections get their own folder
    for (const s of sectionNames) {
      if (!mapping[s.name]) {
        mapping[s.name] = { folder: s.name, isMerged: false };
      }
    }

    return mapping;
  }

  /** Determine the disk path for an item given the section mapping */
  function getItemDiskPath(item, sectionMapping) {
    if (isSyllabus(item.name)) return '';

    const mapEntry = sectionMapping[item.section];
    if (!mapEntry) return item.section;

    let folder = mapEntry.folder;

    // Exam organization: each exam gets its own subfolder by identity (year+semester+moed)
    // e.g. "מבחנים/2024 סמסטר א מועד א/exam.pdf" and "מבחנים/2024 סמסטר א מועד א/solution.pdf"
    if (isExamRelated(item.section) || isExamRelated(item.name)) {
      const identity = extractExamIdentity(item.name) || extractExamIdentity(item.section);
      if (identity) {
        folder = `${folder}/${identity}`;
        return folder; // test + solution go together in the identity folder
      }
      // No identity extracted — fall back to generic exam folder (no subfolder)
      return folder;
    }

    // Lecturer solution files → "פתרונות מרצה" subfolder
    if (isSolutionFile(item.name)) {
      return folder.includes('פתרונות מרצה') ? folder : `${folder}/פתרונות מרצה`;
    }

    // Assignment sections (those with a submission box): group the loose
    // question files under "תרגילים", so the section holds only תרגילים /
    // הגשות / פתרונות מרצה. mod/folder items keep their own named subfolder
    // (so we don't get תרגילים/תרגילים). Other sections are unchanged.
    if (item.inAssignSection && item.type !== 'folder') {
      return `${folder}/תרגילים`;
    }

    return folder;
  }

  // ============================================================
  // ITEM RESOLUTION
  // ============================================================

  async function resolveModUrl(item) {
    try {
      const doc = await fetchMoodlePage(item.url);
      const linkEl = doc.querySelector('.urlworkaround a');
      if (!linkEl) return null;
      const targetUrl = linkEl.href;
      let hostname;
      try { hostname = new URL(targetUrl).hostname; } catch { return { type: 'external', url: targetUrl, reason: 'malformed URL' }; }

      if (hostname.includes('colab.research.google.com')) {
        return { type: 'colab', url: targetUrl };
      }
      if (hostname.includes('docs.google.com') || hostname.includes('slides.google.com')) {
        const id = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!id) return { type: 'external', url: targetUrl, reason: 'external link' };
        if (targetUrl.includes('/presentation/')) {
          return { type: 'google_slides', url: `https://docs.google.com/presentation/d/${id[1]}/export/pdf` };
        }
        if (targetUrl.includes('/document/')) {
          return { type: 'google_docs', url: `https://docs.google.com/document/d/${id[1]}/export?format=pdf` };
        }
        if (targetUrl.includes('/spreadsheets/')) {
          return { type: 'google_sheets', url: `https://docs.google.com/spreadsheets/d/${id[1]}/export?format=xlsx` };
        }
        return { type: 'google_drive', url: targetUrl };
      }
      if (hostname.includes('drive.google.com')) {
        // Try to extract file ID for direct download
        const fileId = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || targetUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (fileId) {
          return { type: 'google_drive_direct', url: `https://drive.google.com/uc?export=download&id=${fileId[1]}` };
        }
        return { type: 'google_drive', url: targetUrl, reason: 'Google Drive folder — explore manually' };
      }
      if (hostname.includes('dropbox.com')) {
        let dbUrl = targetUrl.replace(/\?dl=0/, '?dl=1').replace(/&dl=0/, '&dl=1');
        // If no dl param was present at all, append it
        if (!dbUrl.includes('dl=1')) {
          dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'dl=1';
        }
        return { type: 'dropbox', url: dbUrl };
      }
      if (hostname.includes('sites.google.com')) {
        return { type: 'google_sites', url: targetUrl, reason: 'Google Sites — explore for linked files' };
      }
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be') ||
          hostname.includes('zoom.us') || hostname.includes('vimeo.com')) {
        return { type: 'video', url: targetUrl, reason: 'video' };
      }
      if (hostname.includes('bgu4u.bgu.ac.il') || hostname.includes('in.bgu.ac.il') || hostname.includes('iguide.bgu.ac.il')) {
        return { type: 'bgu_internal', url: targetUrl };
      }
      if (hostname.includes('github.com')) {
        return { type: 'external', url: targetUrl, reason: 'GitHub link' };
      }
      return { type: 'external', url: targetUrl, reason: 'external link' };
    } catch (e) {
      return { type: 'error', url: item.url, reason: 'URL resolution error: ' + e.message };
    }
  }

  async function expandModFolder(item) {
    try {
      const url = item.url || `${CONFIG.baseUrl}${CONFIG.basePath}mod/folder/view.php?id=${item.cmid}`;
      const doc = await fetchMoodlePage(url);
      const links = doc.querySelectorAll('.fp-filename-icon a');
      const children = [];
      for (const link of links) {
        const nameEl = link.querySelector('.fp-filename');
        const childName = nameEl ? nameEl.textContent.trim() : link.textContent.trim();
        children.push({ name: childName, url: link.href, direct: true });
      }
      return children;
    } catch (e) {
      log(`  Error expanding folder ${item.name}: ${e.message}`);
      return [];
    }
  }

  async function checkAssignPatternB(item) {
    try {
      const url = item.url || `${CONFIG.baseUrl}${CONFIG.basePath}mod/assign/view.php?id=${item.cmid}`;
      const doc = await fetchMoodlePage(url);
      const pluginLinks = doc.querySelectorAll('a[href*="pluginfile.php"]');
      const files = [];
      for (const link of pluginLinks) {
        // Classify by the pluginfile component (the segment after the contextid):
        //   assignsubmission_file → the student's own uploaded submission
        //   mod_assign (intro / introattachment) → the assignment brief/question
        const m = link.href.match(/pluginfile\.php\/\d+\/([^\/]+)\//);
        const component = m ? m[1] : '';
        const isSubmission = /assignsubmission/.test(component);
        files.push({
          name: link.textContent.trim() || (isSubmission ? 'submission_file' : 'assignment_file'),
          url: link.href,
          direct: true,
          isSubmission,
        });
      }
      return files;
    } catch (e) {
      return [];
    }
  }

  // ============================================================
  // BGU INTERNAL LINK PROBING
  // ============================================================

  /**
   * Attempt to fetch a BGU internal page (bgu4u, iguide, in.bgu, etc.)
   * and find a downloadable file linked from it (PDF, document, etc.).
   * These pages often host syllabuses or course documents behind an extra
   * click — but if opened in the same browser profile they're reachable.
   *
   * Returns { found: true, url, name } if a downloadable link is found,
   * or { found: false, reason } if the page is truly admin-only or empty.
   */
  async function probeBguInternalLink(targetUrl) {
    try {
      const resp = await fetch(targetUrl, { credentials: 'include', redirect: 'follow' });
      if (!resp.ok) {
        return { found: false, reason: 'BGU internal page — HTTP ' + resp.status };
      }
      const contentType = resp.headers.get('content-type') || '';

      // Case 1: The URL itself redirected straight to a file (PDF, etc.)
      if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') ||
          contentType.includes('application/zip') || contentType.includes('application/vnd.')) {
        // It's a direct file download — return the final URL
        const blob = await resp.blob();
        return { found: true, directBlob: blob, contentType, finalUrl: resp.url };
      }

      // Case 2: It's an HTML page — parse it and look for file links
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Look for common patterns: direct PDF links, pluginfile links, embedded objects
      const candidates = [];

      // Links with file extensions
      const allLinks = doc.querySelectorAll('a[href]');
      for (const a of allLinks) {
        const href = a.href;
        if (!href) continue;
        // Match common downloadable file extensions
        if (/\.(pdf|docx?|pptx?|xlsx?|zip|rar)(\?|$)/i.test(href)) {
          candidates.push({ url: href, name: a.textContent.trim() || 'document' });
        }
        // Match pluginfile.php links (Moodle-style)
        if (href.includes('pluginfile.php')) {
          candidates.push({ url: href, name: a.textContent.trim() || 'document' });
        }
      }

      // Embedded PDF viewers (<embed>, <iframe>, <object>)
      const embeds = doc.querySelectorAll('embed[src], iframe[src], object[data]');
      for (const el of embeds) {
        const src = el.src || el.getAttribute('data') || '';
        if (src && /\.(pdf)(\?|$)/i.test(src)) {
          candidates.push({ url: src, name: 'embedded_document' });
        }
      }

      if (candidates.length > 0) {
        // Return the first (most likely) candidate
        return { found: true, url: candidates[0].url, name: candidates[0].name };
      }

      return { found: false, reason: 'BGU internal page — no downloadable files found' };
    } catch (e) {
      return { found: false, reason: 'BGU internal page — fetch error: ' + e.message };
    }
  }

  // ============================================================
  // PDF-SIBLING DEDUP
  // ============================================================

  function dedupPdfSiblings(children) {
    const byBase = {};
    for (const child of children) {
      const dotIdx = child.name.lastIndexOf('.');
      const base = dotIdx > 0 ? child.name.substring(0, dotIdx) : child.name;
      const ext = dotIdx > 0 ? child.name.substring(dotIdx).toLowerCase() : '';
      if (!byBase[base]) byBase[base] = [];
      byBase[base].push({ ...child, ext });
    }

    const result = [];
    for (const [base, files] of Object.entries(byBase)) {
      const hasPdf = files.some(f => f.ext === '.pdf');
      const hasOffice = files.some(f => ['.docx', '.pptx', '.doc', '.ppt'].includes(f.ext));
      if (hasPdf && hasOffice) {
        result.push(...files.filter(f => f.ext === '.pdf'));
      } else {
        result.push(...files);
      }
    }
    return result;
  }

  // ============================================================
  // ZIP / RAR EXTRACTION
  // ============================================================

  /**
   * If the downloaded blob is a ZIP, extract its contents and write them individually.
   * Returns an array of { name, blob } objects. If not a zip or extraction fails, returns null.
   */
  async function tryExtractZip(blob, fileName) {
    const ext = fileName.toLowerCase();
    if (!ext.endsWith('.zip') && !ext.endsWith('.rar')) return null;

    if (ext.endsWith('.rar')) {
      // RAR extraction not supported in browser — save as-is
      log(`  RAR file detected (${fileName}) — saving as-is (no browser RAR support)`);
      return null;
    }

    try {
      const JSZip = await ensureJSZip();
      const zip = await JSZip.loadAsync(blob);
      const extracted = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue; // Skip directories
        const content = await entry.async('blob');
        // Use just the filename, not the full path inside the zip
        const parts = path.split('/');
        let name = parts[parts.length - 1];
        if (!name) continue;
        extracted.push({ name: normalizeName(name), blob: content });
      }

      log(`  Extracted ${extracted.length} files from ${fileName}`);
      return extracted.length > 0 ? extracted : null;
    } catch (e) {
      log(`  ZIP extraction failed for ${fileName}: ${e.message}`);
      return null;
    }
  }

  // ============================================================
  // FILE DOWNLOAD & SAVE
  // ============================================================

  /**
   * Sanitize a single path segment (folder name) so it's accepted by the
   * File System Access API on a *native* filesystem. Chrome rejects names
   * containing < > : " / \ | ? * (Windows-reserved set) for local handles —
   * even on macOS/OPFS where they'd otherwise be legal. Course folder names
   * and section names can contain these (e.g. the " in `תעו"נ`), so every
   * segment must be cleaned before getDirectoryHandle, or the whole run throws.
   */
  function sanitizeSegment(seg) {
    if (!seg) return '';
    let s = seg
      .replace(/[‏‎​‌‍؜﻿]/g, '') // invisible Unicode
      .replace(/[\x00-\x1F]/g, '')    // control chars (illegal on Windows)
      .replace(/[\\:*?"<>|]/g, '-')   // Windows-reserved chars (/ already split out by caller)
      .replace(/\s+/g, ' ')
      .replace(/[ .]+$/g, '')          // Windows disallows trailing dots/spaces in dir names
      .trim();
    if (s.length > 80) s = s.substring(0, 80).replace(/[ .]+$/g, '').trim();
    // Avoid Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s)) s = '_' + s;
    return s;
  }

  async function getNestedDir(rootHandle, path) {
    if (!path) return rootHandle;
    const parts = path.split('/').map(sanitizeSegment).filter(p => p.length > 0);
    let current = rootHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }

  /** Write a blob to a directory, handling duplicate names */
  async function writeFile(targetDir, fileName, blob) {
    let finalName = fileName;
    let dupeCount = 1;
    while (true) {
      try {
        await targetDir.getFileHandle(finalName);
        dupeCount++;
        const dotIdx = fileName.lastIndexOf('.');
        if (dotIdx > 0) {
          finalName = `${fileName.substring(0, dotIdx)} (${dupeCount})${fileName.substring(dotIdx)}`;
        } else {
          finalName = `${fileName} (${dupeCount})`;
        }
      } catch {
        break;
      }
    }
    const fh = await targetDir.getFileHandle(finalName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
    return finalName;
  }

  /** Download a file and save it to the correct location (with retry) */
  async function downloadAndSave(item, courseHandle, seenHashes, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await _downloadAndSaveOnce(item, courseHandle, seenHashes);
      if (result.success || result.skippedHtml || result.skippedDuplicate || attempt === maxRetries) return result;
      log(`  ⟳ Retry ${attempt}/${maxRetries - 1} for ${item.name} (${result.error})`);
      await delay(1000 * attempt); // 1s, 2s, 3s backoff
    }
  }

  async function _downloadAndSaveOnce(item, courseHandle, seenHashes) {
    const fetchUrl = item.fetchUrl || (item.direct
      ? item.url
      : `${CONFIG.baseUrl}${CONFIG.basePath}mod/resource/view.php?id=${item.cmid}`);

    try {
      let resp;
      if (item.crossOrigin) {
        // Cross-origin (e.g. the BGU bgu4u syllabus portal). A page-context
        // fetch is CORS-blocked, so the extension background worker fetches it
        // with the user's session and returns the bytes (see content.js relay).
        const r = await crossOriginFetchBlob(fetchUrl);
        if (!r.ok) throw new Error(r.error || 'cross-origin fetch failed');
        const ct = r.contentType || '';
        if (ct.includes('text/html')) {
          // Got a portal/wrapper page, not the actual file.
          return { success: false, error: 'BGU internal page — no direct file (open manually)', skippedHtml: true };
        }
        const cblob = r.blob;
        resp = {
          ok: true,
          url: fetchUrl,
          headers: { get: (h) => (h && h.toLowerCase() === 'content-type') ? ct : null },
          blob: async () => cblob,
        };
      } else {
        const fetchOpts = { redirect: 'follow' };
        // Google exports: absolute URL, NO credentials (CORS fix for cross-origin redirect)
        if (item.googleExport) {
          // No credentials — Google rejects cross-origin requests with cookies
        } else {
          fetchOpts.credentials = 'include';
        }
        resp = await fetch(fetchUrl, fetchOpts);
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      // Skip HTML pages served from Moodle — these are redirect/wrapper pages
      // (e.g. recording links, embedded viewers), not real downloadable files.
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const finalUrl = resp.url || fetchUrl;
        try {
          const u = new URL(finalUrl);
          const moodleHost = new URL(CONFIG.baseUrl).hostname;
          if (u.hostname === moodleHost) {
            // Distinguish a genuine access restriction (group/role/date-locked
            // resource the user can't see) from a generic redirect/wrapper page,
            // so the skip report tells the user *why* it's missing.
            let reason = 'Moodle HTML page — not a downloadable file';
            try {
              const html = await resp.text();
              if (/availabilityinfo|isrestricted|זמין רק למי|לא זמין|Not available|access is restricted/i.test(html)) {
                reason = 'access restricted — not available to you (group/role restriction)';
              }
            } catch (e) { /* couldn't read body — keep generic reason */ }
            log(`  ⏭ Skipping "${item.name}" — ${reason}`);
            return { success: false, error: reason, skippedHtml: true };
          }
        } catch (e) { /* URL parse failed — continue with download */ }
      }

      const blob = await resp.blob();
      const ext = detectExtension(resp, item.name);
      const contentLength = blob.size;
      const etag = resp.headers.get('etag') || '';

      // Content hash (for the manifest + de-duplication).
      let contentHash = '';
      try { contentHash = await sha256Hex(blob); } catch (e) { /* hashing is best-effort */ }
      // Assign-page professor files are de-duplicated against the main course
      // page: if this exact file (byte-identical) was already saved in this
      // course, drop the assign copy. Unique files (e.g. an assign-only
      // question) have no match and are kept.
      if (item.dedupAgainstCourse && contentHash && seenHashes && seenHashes.has(contentHash)) {
        return { success: false, skippedDuplicate: true, error: 'duplicate of a file already on the main course page', contentHash };
      }

      // Build filename
      let fileName = normalizeName(item.name);
      if (ext && !fileName.toLowerCase().endsWith(ext.toLowerCase())) {
        fileName += ext;
      }
      if (item.mergePrefix !== undefined) {
        const pad = String(item.mergePrefix).padStart(2, '0');
        fileName = `${pad} - ${fileName}`;
      }

      // Get target directory
      const targetDir = await getNestedDir(courseHandle, item.diskFolder);

      // Try ZIP extraction
      const extracted = await tryExtractZip(blob, fileName);
      if (extracted) {
        // Write each extracted file individually
        const savedFiles = [];
        for (const entry of extracted) {
          const savedName = await writeFile(targetDir, entry.name, entry.blob);
          savedFiles.push(savedName);
        }
        return {
          success: true,
          savedAs: savedFiles.map(f => item.diskFolder ? `${item.diskFolder}/${f}` : f),
          fileSize: contentLength,
          etag,
          contentHash,
          extracted: true,
          extractedCount: savedFiles.length,
        };
      }

      // Normal file — write directly
      const finalName = await writeFile(targetDir, fileName, blob);

      return {
        success: true,
        savedAs: item.diskFolder ? `${item.diskFolder}/${finalName}` : finalName,
        fileSize: contentLength,
        etag,
        contentHash,
        extracted: false,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ============================================================
  // INDEXEDDB HELPERS (S2, S3, S6 — backup & cache layer)
  // ============================================================

  function openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('MoodleSyncBackup', 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    try {
      const db = await openIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('backups', 'readonly');
        const store = tx.objectStore('backups');
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      log(`  IDB read failed for "${key}": ${e.message}`);
      return null;
    }
  }

  async function idbSet(key, value) {
    try {
      const db = await openIDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('backups', 'readwrite');
        const store = tx.objectStore('backups');
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      log(`  IDB write failed for "${key}": ${e.message}`);
    }
  }

  // ============================================================
  // S11 — FILESYSTEM HEALTH CHECK
  // ============================================================

  async function isFilesystemHealthy(dirHandle) {
    // Try a canary write/delete to verify the FUSE mount is responsive.
    // If this times out or fails, the mount is deadlocked.
    const CANARY = '.moodle_sync_canary';
    const TIMEOUT_MS = 5000;
    try {
      const result = await Promise.race([
        (async () => {
          const fh = await dirHandle.getFileHandle(CANARY, { create: true });
          const w = await fh.createWritable();
          await w.write('ok');
          await w.close();
          await dirHandle.removeEntry(CANARY);
          return true;
        })(),
        new Promise(resolve => setTimeout(() => resolve(false), TIMEOUT_MS)),
      ]);
      if (!result) log('  ⚠️ Filesystem health check timed out (FUSE mount may be deadlocked)');
      return result;
    } catch (e) {
      log(`  ⚠️ Filesystem health check failed: ${e.message}`);
      return false;
    }
  }

  // ============================================================
  // S9 — PERSISTENT SYNC LOCK
  // ============================================================

  const STALE_LOCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  async function acquireSyncLock(mode) {
    const existing = await idbGet('syncLock');
    if (existing && existing.running) {
      const age = Date.now() - new Date(existing.startedAt).getTime();
      if (age < STALE_LOCK_THRESHOLD_MS) {
        // Recent lock — another tab may be running
        const mins = Math.max(1, Math.ceil((STALE_LOCK_THRESHOLD_MS - age) / 60000));
        log(`  ⚠️ Sync lock held since ${existing.startedAt} (${Math.round(age / 1000)}s ago) — refusing to start.`);
        log(`  Reloading the page does NOT clear this lock. If no other sync is actually running, use "Start anyway", or it auto-clears in ~${mins} min.`);
        return false;
      }
      // Stale lock — previous run was interrupted
      log(`  ⚠️ Found stale sync lock from ${existing.startedAt} (${Math.round(age / 60000)} min ago).`);
      log('  Previous sync was likely interrupted. Clearing lock and proceeding.');
    }
    await idbSet('syncLock', { running: true, startedAt: new Date().toISOString(), mode });
    state.holdsLock = true;
    return true;
  }

  async function releaseSyncLock() {
    state.holdsLock = false;
    await idbSet('syncLock', { running: false, clearedAt: new Date().toISOString() });
  }

  // ============================================================
  // MANIFEST MANAGEMENT (patched: S1, S2, S10, S11)
  // ============================================================

  async function loadManifest(semesterHandle) {
    // S11 — Check filesystem health before attempting read
    const fsHealthy = await isFilesystemHealthy(semesterHandle);

    if (fsHealthy) {
      // Try filesystem first
      try {
        const fh = await semesterHandle.getFileHandle('.moodle_manifest.json');
        const file = await fh.getFile();
        const text = await file.text();
        const manifest = JSON.parse(text);
        if (manifest && Object.keys(manifest).length > 0) {
          log('  Manifest loaded from filesystem');
          return manifest;
        }
      } catch {
        // filesystem failed — fall through to IndexedDB
      }
    } else {
      log('  Skipping filesystem manifest read (health check failed) — going straight to IndexedDB');
    }

    // S2 — Fallback: try IndexedDB backup (only if it matches the current folder)
    log('  Filesystem manifest empty or missing — trying IndexedDB backup...');
    const backup = await idbGet('manifest');
    if (backup && Object.keys(backup).length > 0) {
      // Check if the backup belongs to the current folder
      const backupFolder = await idbGet('manifestFolderName');
      const currentFolder = state.rootHandle ? state.rootHandle.name : '';
      if (!backupFolder) {
        // No folder tag (legacy backup from before this check existed).
        // The filesystem manifest was already empty/missing — this backup
        // is very likely from a DIFFERENT folder. Don't trust it.
        log(`  IndexedDB manifest has no folder tag — filesystem was empty, so ignoring potentially stale backup`);
        log(`  (If this is wrong, run a Seed sync to re-download and tag the backup.)`);
      } else if (currentFolder && backupFolder !== currentFolder) {
        log(`  IndexedDB manifest belongs to "${backupFolder}", not current folder "${currentFolder}" — ignoring stale backup`);
      } else {
        log('  Manifest restored from IndexedDB backup');
        return backup;
      }
    }

    log('  No manifest found in filesystem or IndexedDB');
    return {};
  }

  async function saveManifest(semesterHandle, manifest) {
    // S10 — Save to IndexedDB FIRST (atomic, survives interruption)
    await idbSet('manifest', manifest);
    // Tag the backup with the folder name so we can detect stale backups on folder switch
    if (state.rootHandle) {
      await idbSet('manifestFolderName', state.rootHandle.name);
    }
    log('  Manifest saved to IndexedDB backup');

    // Then save to filesystem (may be interrupted by tab close / FUSE issues)
    try {
      const fh = await semesterHandle.getFileHandle('.moodle_manifest.json', { create: true });
      const writable = await fh.createWritable();
      await writable.write(JSON.stringify(manifest, null, 2));
      await writable.close();
      log('  Manifest saved to filesystem');
    } catch (e) {
      log(`  ⚠️ Filesystem manifest save failed: ${e.message} — IndexedDB backup is intact`);
    }
  }

  /**
   * Detect a "mislocated" manifest: previous downloads tracked in a DIFFERENT
   * place than where we're currently pointed — the tell-tale sign that the
   * destination folder or semester (rootPath) changed since the last sync.
   * Searches the picked-folder root and its immediate subfolders for a
   * .moodle_manifest.json that tracks the currently-configured courses.
   * Runs ONLY on the abort/failure path, so it adds no cost to normal syncs.
   * Returns { location, matchedCourses } or null.
   */
  async function findMislocatedManifest() {
    try {
      if (!state.rootHandle) return null;
      const wantIds = new Set(CONFIG.courses.filter(c => !c.disabled).map(c => String(c.id)));
      if (wantIds.size === 0) return null;

      const candidates = [{ name: '(folder root)', handle: state.rootHandle }];
      try {
        for await (const [name, handle] of state.rootHandle.entries()) {
          if (handle.kind === 'directory') candidates.push({ name, handle });
        }
      } catch {}

      for (const cand of candidates) {
        // Skip the location we already loaded the (empty) manifest from.
        try { if (state.semesterHandle && await cand.handle.isSameEntry(state.semesterHandle)) continue; } catch {}
        let manifest;
        try {
          const fh = await cand.handle.getFileHandle('.moodle_manifest.json');
          manifest = JSON.parse(await (await fh.getFile()).text());
        } catch { continue; }
        if (!manifest || typeof manifest !== 'object') continue;
        let matched = 0;
        for (const [cid, c] of Object.entries(manifest)) {
          const n = c && c.items ? Object.keys(c.items).length : 0;
          if (n > 0 && wantIds.has(String(cid))) matched++;
        }
        if (matched >= 1) return { location: cand.name, matchedCourses: matched };
      }
    } catch {}
    return null;
  }

  /**
   * Recovery guidance appended to "no tracking record" aborts. If a mislocated
   * manifest is found, it points the user to where their downloads actually
   * live (so they re-point instead of re-downloading); otherwise it gives the
   * generic first-run guidance.
   */
  async function recoveryHint() {
    const mis = await findMislocatedManifest();
    if (mis) {
      const where = mis.location === '(folder root)'
        ? 'the folder you picked (with no semester subfolder)'
        : `the "${mis.location}" subfolder inside your download folder`;
      return `\n\n📁 Your previous downloads look like they're in ${where} — tracking ${mis.matchedCourses} of your courses. The destination folder or semester likely changed since you seeded.\n→ To keep updating them: set your folder/semester to match that location in Settings, then Sync.\n→ To start fresh in the current location instead: run Seed (הורדה ראשונית).`;
    }
    return `\n\nRun Seed (הורדה ראשונית) to build the tracking file, or re-pick the folder where your downloads actually live.`;
  }

  // ============================================================
  // EXCEL STYLING HELPERS
  // ============================================================

  const XLS_BORDER_THIN = { style: 'thin', color: { rgb: '999999' } };
  const XLS_BORDER = { top: XLS_BORDER_THIN, bottom: XLS_BORDER_THIN, left: XLS_BORDER_THIN, right: XLS_BORDER_THIN };
  const XLS_HEADER_STYLE = {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '4472C4' } },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
    border: XLS_BORDER,
  };
  const XLS_CELL_STYLE = {
    font: { sz: 11 },
    alignment: { horizontal: 'right', vertical: 'center', wrapText: false },
    border: XLS_BORDER,
  };
  const XLS_TITLE_STYLE = {
    font: { bold: true, sz: 13 },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  /**
   * Apply styling to a worksheet that has a title row (row 0, merged)
   * followed by a header row (row 1) and data rows (row 2+).
   * @param {object} ws - SheetJS worksheet
   * @param {number} numCols - number of columns
   * @param {boolean} hasHeaders - true if row 1 is a header row (false for success-only sheets)
   */
  function styleWorksheet(ws, numCols, hasHeaders) {
    const XL = window.XLSX;
    const range = XL.utils.decode_range(ws['!ref'] || 'A1');
    const colLetters = [];
    for (let c = 0; c < numCols; c++) colLetters.push(XL.utils.encode_col(c));

    // Style title row (row 0)
    const titleRef = colLetters[0] + '1';
    if (ws[titleRef]) ws[titleRef].s = XLS_TITLE_STYLE;

    if (hasHeaders) {
      // Style header row (row 1 → Excel row 2)
      for (const col of colLetters) {
        const ref = col + '2';
        if (ws[ref]) ws[ref].s = XLS_HEADER_STYLE;
      }
      // Style data rows (row 2+ → Excel row 3+)
      for (let r = 2; r <= range.e.r; r++) {
        for (const col of colLetters) {
          const ref = col + (r + 1);
          if (ws[ref]) ws[ref].s = XLS_CELL_STYLE;
        }
      }
    } else {
      // Style the single content row (row 1 → Excel row 2)
      for (const col of colLetters) {
        const ref = col + '2';
        if (ws[ref]) ws[ref].s = { ...XLS_CELL_STYLE, font: { bold: true, sz: 12 } };
      }
    }
  }

  /**
   * Post-process an XLSX buffer to add RTL sheet direction.
   * Uses JSZip to patch the sheet XML with rightToLeft="1".
   * @param {Uint8Array} xlsxData - raw XLSX as array
   * @returns {Promise<Uint8Array>} patched XLSX data
   */
  async function patchXlsxRtl(xlsxData) {
    try {
      const JSZip = await ensureJSZip();
      if (!JSZip) { log('  ⚠️ JSZip not available — skipping RTL patch'); return xlsxData; }
      const zip = await JSZip.loadAsync(xlsxData);

      // Patch all sheet files (sheet1.xml, sheet2.xml, etc.)
      const sheetFiles = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/);
      if (sheetFiles.length === 0) return xlsxData;

      let patched = false;
      for (const sheetFile of sheetFiles) {
        let xml = await sheetFile.async('string');
        if (xml.includes('rightToLeft')) continue; // already RTL

        if (xml.includes('<sheetView')) {
          // Add rightToLeft="1" to existing <sheetView> tag
          // Handles: <sheetView>, <sheetView/>, <sheetView ...>
          xml = xml.replace(/<sheetView(?=[\s>\/])/g, '<sheetView rightToLeft="1"');
          zip.file(sheetFile.name, xml);
          patched = true;
        } else if (xml.includes('<sheetViews')) {
          // sheetViews exists but empty — inject a sheetView
          xml = xml.replace('<sheetViews>', '<sheetViews><sheetView rightToLeft="1"/>');
          xml = xml.replace('</sheetViews>', '</sheetViews>');
          zip.file(sheetFile.name, xml);
          patched = true;
        } else {
          // No sheetViews at all — inject before <sheetData> or <sheetFormatPr>
          const insertBefore = xml.includes('<sheetFormatPr') ? '<sheetFormatPr' :
                               xml.includes('<sheetData') ? '<sheetData' : null;
          if (insertBefore) {
            xml = xml.replace(insertBefore,
              '<sheetViews><sheetView rightToLeft="1"/></sheetViews>' + insertBefore);
            zip.file(sheetFile.name, xml);
            patched = true;
          }
        }
      }

      if (patched) {
        return await zip.generateAsync({ type: 'uint8array' });
      }
      return xlsxData;
    } catch (e) {
      log(`  ⚠️ RTL patch failed: ${e.message}`);
      return xlsxData;
    }
  }

  /**
   * Write a styled XLSX blob to a file handle, with RTL patching.
   */
  async function writeStyledXlsx(dirHandle, fileName, wb) {
    let xlsxData = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    xlsxData = await patchXlsxRtl(xlsxData);
    const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fh = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  // ============================================================
  // PER-COURSE STATUS XLS GENERATION
  // ============================================================

  async function generateCourseStatus(courseHandle, courseName, courseManifest, courseSkipped) {
    log(`  Generating status XLS for ${courseName}...`);
    try {
      const XLSX = await ensureSheetJS();
      if (!XLSX || !XLSX.utils) {
        log(`  ⚠️ SheetJS not available — cannot generate status XLS for ${courseName}`);
        return;
      }
      log(`  SheetJS loaded OK (version: ${XLSX.version || 'unknown'})`);

      const now = new Date();
      const dateStr = now.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

      // Build AOA (array of arrays) for the sheet
      const aoa = [];
      aoa.push([`עדכון אחרון: ${dateStr} ${timeStr}`]);

      const skippedItems = courseSkipped || [];
      const hasHeaders = skippedItems.length > 0;
      if (hasHeaders) {
        aoa.push(['קורס', 'מיקום במודל', 'שם', 'קישור', 'סיבה', 'תאריך']);
        for (const item of skippedItems) {
          aoa.push([
            courseName,
            item.section || '',
            item.name || '',
            item.url || '',
            item.reason || '',
            new Date().toISOString().split('T')[0],
          ]);
        }
      } else {
        aoa.push(['כל הקבצים הורדו בהצלחה.']);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Merge first row across all columns
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      ws['!cols'] = [
        { wch: 18 }, // קורס
        { wch: 22 }, // מיקום במודל
        { wch: 35 }, // שם
        { wch: 50 }, // קישור
        { wch: 30 }, // סיבה
        { wch: 12 }, // תאריך
      ];

      // Apply styling
      styleWorksheet(ws, 6, hasHeaders);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'סטטוס סנכרון');

      await writeStyledXlsx(courseHandle, 'סטטוס סנכרון.xlsx', wb);
      log(`  ✓ Status XLS written for ${courseName}`);

      // Clean up old README.md if it exists
      try { await courseHandle.removeEntry('README.md'); } catch {}

    } catch (e) {
      log(`  ❌ ERROR generating course status XLS for ${courseName}: ${e.message}`);
      console.error('[MoodleSync] generateCourseStatus error:', e);
    }
  }

  // ============================================================
  // SEMESTER-LEVEL COMBINED STATUS XLS
  // ============================================================

  /**
   * Generate a combined status XLS at the semester folder level.
   * Only generated when ALL configured courses have a manifest entry
   * (i.e., all courses were part of the sync).
   */
  async function generateCombinedStatusXls(semesterHandle, manifest, skipByCourse) {
    try {
      // Check: does every configured course have a manifest entry?
      const coursesToCheck = CONFIG.courses.filter(c => !c.disabled);
      const allSynced = coursesToCheck.every(c => manifest[c.id] && manifest[c.id].items);
      if (!allSynced) {
        log('  Skipping combined status XLS — not all courses synced');
        return;
      }

      const XLSX = await ensureSheetJS();
      const now = new Date();
      const dateStr = now.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

      const wb = XLSX.utils.book_new();

      // Collect all skipped items across all active courses
      const allSkipped = [];
      for (const course of coursesToCheck) {
        const courseSkipped = skipByCourse[course.folderName] || [];
        for (const item of courseSkipped) {
          allSkipped.push({
            'קורס': course.folderName,
            'מיקום במודל': item.section || '',
            'שם': item.name || '',
            'קישור': item.url || '',
            'סיבה': item.reason || '',
            'תאריך': new Date().toISOString().split('T')[0],
          });
        }
      }

      const aoa = [];
      aoa.push([`עדכון אחרון: ${dateStr} ${timeStr}`]);
      const hasHeaders = allSkipped.length > 0;
      if (hasHeaders) {
        aoa.push(['קורס', 'מיקום במודל', 'שם', 'קישור', 'סיבה', 'תאריך']);
        for (const r of allSkipped) {
          aoa.push([r['קורס'], r['מיקום במודל'], r['שם'], r['קישור'], r['סיבה'], r['תאריך']]);
        }
      } else {
        aoa.push(['כל הקבצים הורדו בהצלחה בכל הקורסים.']);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      ws['!cols'] = [
        { wch: 18 }, // קורס
        { wch: 22 }, // מיקום במודל
        { wch: 35 }, // שם
        { wch: 50 }, // קישור
        { wch: 30 }, // סיבה
        { wch: 12 }, // תאריך
      ];

      // Apply styling
      styleWorksheet(ws, 6, hasHeaders);

      XLSX.utils.book_append_sheet(wb, ws, 'סטטוס סנכרון');

      await writeStyledXlsx(semesterHandle, 'סטטוס סנכרון - כל הקורסים.xlsx', wb);

      log(`  Combined status XLS generated: ${allSkipped.length} items across ${CONFIG.courses.length} courses`);
    } catch (e) {
      log(`  ERROR generating combined status XLS: ${e.message}`);
    }
  }

  // ============================================================
  // MAIN SYNC ORCHESTRATOR
  // ============================================================

  async function runSync(mode, options = {}) {
    const dryRun = options.dryRun || false;

    if (state.running) {
      console.log('[MoodleSync] Sync already running — ignoring');
      return;
    }

    // S9 — Acquire persistent sync lock (survives tab close) — skip for dry runs
    if (!dryRun) {
      let lockAcquired = await acquireSyncLock(mode);
      if (!lockAcquired) {
        // Don't dead-end on a possibly-stale lock — offer an explicit override.
        if (!state.toastEl) createToast();
        const titleEl = state.toastEl && state.toastEl.querySelector('span');
        if (titleEl) titleEl.textContent = 'Sync may be running';
        log('A sync lock is held — offering a "Start anyway" override.');
        const proceed = await confirmStartAnywayViaToast();
        if (!proceed) {
          log('Sync not started — lock held and override declined.');
          removeToast();
          return;
        }
        // Override: clear the (likely stale) lock and re-acquire it for this run.
        log('User chose "Start anyway" — clearing the existing sync lock.');
        await releaseSyncLock();
        lockAcquired = await acquireSyncLock(mode);
        if (!lockAcquired) {
          log('Could not acquire the lock even after override — aborting.');
          removeToast();
          return;
        }
      }
    }

    state.running = true;
    state.mode = mode;
    state.log = [];
    state.results = { downloaded: 0, failed: 0, skipped: 0, newItems: 0, updated: 0 };
    state.progressPercent = 0;
    state.progressStep = 'Starting...';
    state.totalDownloads = 0;
    state.completedDownloads = 0;

    // Ensure toast is displayed
    if (!state.toastEl) {
      createToast();
    }

    log(`=== Starting ${mode.toUpperCase()}${dryRun ? ' DRY RUN' : ''} sync ===`);
    log('');

    try {
      // S5 — Login enforcement.
      log('Step 0: Ensuring login...');

      // Determine login status FIRST. Moodle pages routinely include a
      // login/index.php link (and "Log in" text) even when the user IS logged
      // in — in a footer, a "log in as" control, or a guest-access block. So we
      // must NOT blindly click it: on some institutions (e.g. HUJI) that link
      // points at an external SSO / exam system, and clicking it navigates the
      // page away, killing the run and leaving the sync lock stuck. Only attempt
      // a login click when we are genuinely logged OUT.
      const isLoggedIn =
        (typeof M !== 'undefined' && M.cfg && M.cfg.userId && M.cfg.userId > 1) ||
        !!document.querySelector('.usermenu, .usertext, #user-menu-toggle, .logininfo .username, [data-region="user-menu"], .userbutton');

      if (isLoggedIn) {
        log('  Login confirmed.');
      } else {
        // Logged out — try the configured login button, then a text match, then
        // abort so the user can finish logging in and re-run.
        const loginSelectors = CONFIG.loginSelectors || ['a[href*="login/index.php"]', 'a.btn-login', 'a[data-title="login,moodle"]'];
        for (const selector of loginSelectors) {
          const loginBtn = document.querySelector(selector);
          if (loginBtn) {
            log('  Not logged in — opening login (selector: ' + selector + ')...');
            loginBtn.click();
            await delay(3000);
            await safetyAbort('🔑 Not logged in — please log in and re-run sync.');
            return;
          }
        }
        const loginTextMatches = CONFIG.loginTextMatches || ['התחברות', 'Log in', 'כניסה', 'Sign in'];
        for (const link of document.querySelectorAll('a')) {
          if (loginTextMatches.includes(link.textContent.trim())) {
            log('  Not logged in — opening login (' + link.textContent.trim() + ')...');
            link.click();
            await delay(3000);
            await safetyAbort('🔑 Not logged in — please log in and re-run sync.');
            return;
          }
        }
        log('  WARNING: Could not confirm login status — proceeding cautiously.');
      }

      // Step 1: Get directory handle (S3 — try cached handle first)
      state.progressPercent = 2; state.progressStep = 'Requesting folder access...';
      updateToast(state.progressStep, state.progressPercent);
      log('Step 1/8: Requesting folder access...');
      let dirHandle = null;

      // S3 — Try cached directory handle from IndexedDB
      const expectedFolderName = CONFIG.savedFolderName || '';
      try {
        const cachedHandle = await idbGet('directoryHandle');
        if (cachedHandle) {
          // If user picked a different folder in settings, invalidate the cache
          if (expectedFolderName && cachedHandle.name !== expectedFolderName) {
            log(`  Cached folder "${cachedHandle.name}" differs from settings folder "${expectedFolderName}" — re-picking...`);
          } else {
            const perm = await cachedHandle.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
              dirHandle = cachedHandle;
              log('  Using cached directory handle from IndexedDB');
            } else {
              const requested = await cachedHandle.requestPermission({ mode: 'readwrite' });
              if (requested === 'granted') {
                dirHandle = cachedHandle;
                log('  Re-authorized cached directory handle');
              }
            }
          }
        }
      } catch (e) {
        log(`  Cached handle unavailable: ${e.message}`);
      }

      // Fall back to picker if no cached handle (or cache was invalidated)
      // NOTE: showDirectoryPicker() requires a user gesture. Since sync is
      // triggered via MutationObserver (not a click), we show a button in the
      // toast and wait for the user to click it — that click IS a gesture.
      if (!dirHandle) {
        const reason = expectedFolderName
          ? `Settings folder "${expectedFolderName}" differs from cache — please pick the correct folder.`
          : 'No saved folder — please pick a folder for your Moodle files.';
        dirHandle = await requestDirectoryViaToastButton(reason);
        // S3 — Cache the handle for future runs
        await idbSet('directoryHandle', dirHandle);
        log('  Directory handle cached in IndexedDB for future runs');
      }

      // Notify content script of the chosen folder name (for settings display)
      try {
        const bridge = document.getElementById('moodle-sync-bridge');
        if (bridge) {
          bridge.setAttribute('data-folder-name', dirHandle.name);
        }
      } catch (e) { /* ignore */ }

      state.rootHandle = dirHandle;
      // Walk CONFIG.rootPath dynamically (e.g. "סמסטר ב׳" → one nested dir inside the picked year folder)
      let semHandle = state.rootHandle;
      const pathParts = CONFIG.rootPath.split('/').filter(p => p.length > 0);
      for (const part of pathParts) {
        // Avoid double-nesting: if the picked folder already IS this segment
        // (e.g. the user picked ".../סמסטר ב׳" and rootPath is also "סמסטר ב׳"),
        // don't create a redundant nested copy (…/סמסטר ב׳/סמסטר ב׳).
        if (semHandle.name === part) {
          log(`  Skipping redundant path segment "${part}" — picked folder already matches it`);
          continue;
        }
        semHandle = await semHandle.getDirectoryHandle(part, { create: true });
      }
      state.semesterHandle = semHandle;
      log(`  Folder access granted (root path: ${CONFIG.rootPath})`);

      // Step 1b: Save config to semester folder if entered via form
      if (window.__MOODLE_SYNC_CONFIG_PENDING__) {
        const cfgHandle = await state.semesterHandle.getFileHandle('moodle_sync_config.json', { create: true });
        const cfgWritable = await cfgHandle.createWritable();
        await cfgWritable.write(JSON.stringify(window.__MOODLE_SYNC_CONFIG_PENDING__, null, 2));
        await cfgWritable.close();
        log('  Config saved to moodle_sync_config.json');
        // S6 — Also backup config to IndexedDB
        await idbSet('config', window.__MOODLE_SYNC_CONFIG_PENDING__);
        delete window.__MOODLE_SYNC_CONFIG_PENDING__;
      }

      // Step 2: Load manifest
      state.progressPercent = 8; state.progressStep = 'Loading manifest...';
      updateToast(state.progressStep, state.progressPercent);
      log('Step 2/8: Loading manifest...');
      state.manifest = await loadManifest(state.semesterHandle);
      const courseCount = Object.keys(state.manifest).length;
      log(`  Manifest loaded: ${courseCount} courses tracked`);

      // S1 — Abort on empty manifest in incremental mode
      if (mode === 'incremental' && courseCount === 0) {
        const totalManifestItems = Object.values(state.manifest)
          .reduce((sum, c) => sum + (c.items ? Object.keys(c.items).length : 0), 0);
        if (totalManifestItems === 0) {
          await safetyAbort('🛑 No tracking file found for this folder — either this is your first run, or the destination folder/semester changed since you seeded.' + await recoveryHint());
          return;
        }
      }

      // S8 — Abort a seed only into folders whose courses the manifest still
      // TRACKS. Orphaned course folders (on disk but absent from the manifest —
      // because the tracking file was lost, or the destination folder/semester
      // changed since seeding) are safe to overwrite, so Seed is allowed to
      // proceed and rebuild. This is what breaks the "Incremental says run Seed /
      // Seed says use Incremental" deadlock: in that state the folders aren't in
      // the manifest, so Seed goes through and restores a correct tracking file.
      if (mode === 'seed') {
        // Folder names the manifest actually tracks with real downloaded content.
        const trackedFolderNames = new Set(
          Object.values(state.manifest)
            .filter(c => c && c.items && Object.values(c.items).some(it => it && it.status !== 'skipped'))
            .flatMap(c => [c.folderName, c.courseName].filter(Boolean))
        );
        const existingFolderNames = [];
        const configFolderNames = new Set(CONFIG.courses.map(c => c.folderName));
        try {
          for await (const [name, handle] of state.semesterHandle.entries()) {
            if (handle.kind === 'directory' && configFolderNames.has(name) && trackedFolderNames.has(name)) {
              existingFolderNames.push(name);
            }
          }
        } catch (e) { /* directory iteration failed — treat as empty */ }

        if (existingFolderNames.length > 0) {
          const listStr = existingFolderNames.map(n => `  • ${n}`).join('\n');
          await safetyAbort(`🛑 These courses are already downloaded and tracked here:\n${listStr}\n\nTo update them, use Incremental Sync (סנכרון).\nTo re-download from scratch, delete those folders first, then run Seed.`);
          return;
        }
        // No tracked course content here — either a clean folder, or orphaned
        // folders with no matching tracking record. Clear any stale manifest so
        // the seed rebuilds a correct one as it downloads.
        const totalManifestItems = Object.values(state.manifest)
          .reduce((sum, c) => sum + (c.items ? Object.keys(c.items).length : 0), 0);
        if (totalManifestItems > 0) {
          log(`  Seed run: no tracked content here, but manifest has ${totalManifestItems} stale items — clearing manifest to rebuild`);
          state.manifest = {};
        }
      }

      // Step 3: Scrape all courses
      state.progressPercent = 12; state.progressStep = 'Scraping courses...';
      updateToast(state.progressStep, state.progressPercent);
      log('Step 3/8: Scraping courses...');
      const allItems = [];
      const activeCourses = CONFIG.courses.filter(c => !c.disabled);

      // Guard: two active courses pointing at the same folder name will write
      // into the same directory, colliding (files get " (2)" suffixes) and
      // churning on every sync. Usually a stale/wrong-semester duplicate left
      // in the config. Warn loudly so the user can remove or rename one.
      const folderCounts = {};
      for (const c of activeCourses) {
        const f = (c.folderName || '').trim();
        if (f) folderCounts[f] = (folderCounts[f] || 0) + 1;
      }
      const dupeFolders = Object.keys(folderCounts).filter(f => folderCounts[f] > 1);
      if (dupeFolders.length > 0) {
        log(`  ⚠️ WARNING: ${dupeFolders.length} folder name(s) used by more than one active course: ${dupeFolders.join(', ')}.`);
        log('     Their files will be merged into one folder and collide. Remove or rename the duplicate course in Settings (often a wrong-semester leftover).');
      }

      for (const course of activeCourses) {
        try {
          const { items, sectionNames } = await scrapeCourse(course.id, course.folderName);
          const sectionMapping = buildSectionMapping(sectionNames, course.folderName);
          state.sectionMap[course.id] = sectionMapping;

          for (const item of items) {
            if (CONFIG.silentSkipTypes.includes(item.type)) continue;
            item.diskFolder = getItemDiskPath(item, sectionMapping);

            const mapEntry = sectionMapping[item.section];
            if (mapEntry && mapEntry.isMerged && mapEntry.numberPrefix !== undefined) {
              item.mergePrefix = mapEntry.numberPrefix;
            }

            allItems.push(item);
          }

          await delay(CONFIG.delayBetweenFetches);
        } catch (e) {
          log(`  ERROR scraping ${course.folderName}: ${e.message}`);
        }
      }

      log(`  Total items scraped: ${allItems.length}`);

      // Step 4: Resolve URLs, expand folders, check assignments
      state.progressPercent = 25; state.progressStep = 'Resolving URLs...';
      updateToast(state.progressStep, state.progressPercent);
      log('Step 4/8: Resolving URLs and expanding folders...');
      const downloadQueue = [];
      const skipQueue = [];
      // Professor files from assign pages — queued LAST so main-page copies are
      // downloaded (and hashed) first, letting content-dedup drop the assign
      // copy when it's identical to a main-page file (keeping unique ones).
      const lateQueue = [];
      // Track cmids we skip re-resolving in incremental mode (already known),
      // so the "unchanged course" fast-path below still counts them.
      const knownSkippedCmids = {};

      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        if (i > 0 && i % 10 === 0) {
          await delay(CONFIG.batchPause);
          log(`  Processing ${i}/${allItems.length}...`);
        }

        if (item.type === 'resource') {
          // Force a direct file download. Resources set to "embed"/"in-page"
          // display return an HTML wrapper page (img/object src=pluginfile) that
          // we'd otherwise skip as a Moodle HTML page; &redirect=1 makes Moodle
          // serve the file itself. Harmless for normal force-download resources.
          item.fetchUrl = `${CONFIG.baseUrl}${CONFIG.basePath}mod/resource/view.php?id=${item.cmid}&redirect=1`;
          downloadQueue.push(item);

        } else if (item.type === 'folder') {
          const children = await expandModFolder(item);
          const deduped = dedupPdfSiblings(children);
          const useSubfolder = deduped.length >= 2;

          for (const child of deduped) {
            downloadQueue.push({
              ...item,
              name: child.name,
              url: child.url,
              direct: true,
              fetchUrl: child.url,
              isChild: true,
              parentCmid: item.cmid,
              diskFolder: useSubfolder
                ? `${item.diskFolder}/${normalizeName(item.name)}`.replace(/^\//, '')
                : item.diskFolder,
            });
          }
          await delay(CONFIG.delayBetweenFetches);

        } else if (item.type === 'url') {
          // Incremental: if we already downloaded or already gave up on this
          // link in a previous run, don't re-resolve it. mod/url targets are
          // cross-origin (Colab, Google Sites, bgu4u) and the un-downloadable
          // ones fail slowly with retries on every run.
          if (mode === 'incremental' && isKnownInManifest(item.courseId, item.cmid)) {
            (knownSkippedCmids[item.courseId] = knownSkippedCmids[item.courseId] || new Set()).add(item.cmid);
            continue;
          }
          const resolved = await resolveModUrl(item);
          if (!resolved) {
            skipQueue.push({ ...item, reason: 'URL resolution failed' });
          } else if (['google_docs', 'google_slides', 'google_sheets'].includes(resolved.type)) {
            downloadQueue.push({
              ...item,
              fetchUrl: resolved.url,
              googleExport: true,
              name: item.name + (resolved.type === 'google_sheets' ? '.xlsx' : '.pdf'),
            });
          } else if (resolved.type === 'google_drive_direct') {
            downloadQueue.push({
              ...item,
              fetchUrl: resolved.url,
              googleExport: true, // no credentials needed
            });
          } else if (resolved.type === 'colab') {
            skipQueue.push({ ...item, reason: 'Colab notebook — requires manual browser extraction', url: resolved.url });
          } else if (resolved.type === 'dropbox') {
            downloadQueue.push({ ...item, fetchUrl: resolved.url, direct: true });
          } else if (resolved.type === 'video') {
            // Intentionally silent — videos are not downloaded and not logged to Excel
          } else if (resolved.type === 'bgu_internal') {
            // Cross-origin (bgu4u / in.bgu / iguide). A page-context fetch is
            // CORS-blocked, so route through the background worker (crossOrigin).
            let targetUrl = resolved.url;
            // BGU syllabus portal: !app.gate?app=ann&… renders a JS frameset
            // whose inner !app.ann frame serves the PDF. Build that inner URL
            // directly: swap the path, drop app, add lang=he, keep step + rn_*.
            try {
              const u = new URL(targetUrl);
              if (/!app\.gate/.test(u.pathname) && u.searchParams.get('app') === 'ann') {
                u.pathname = u.pathname.replace('!app.gate', '!app.ann');
                u.searchParams.delete('app');
                u.searchParams.set('lang', 'he');
                targetUrl = u.href;
              }
            } catch (e) { /* keep original URL */ }
            log(`  → BGU internal — fetching via background worker`);
            downloadQueue.push({ ...item, fetchUrl: targetUrl, crossOrigin: true, direct: true });
          } else {
            skipQueue.push({ ...item, reason: resolved.reason || 'external link', url: resolved.url || '' });
          }
          await delay(CONFIG.delayBetweenFetches);

        } else if (item.type === 'assign') {
          const files = await checkAssignPatternB(item);
          if (files.length > 0) {
            // Base off the SECTION folder (not item.diskFolder, which already
            // carries the /תרגילים grouping) so submissions/solutions/questions
            // sit as siblings: <section>/תרגילים, /הגשות, /פתרונות מרצה.
            const sm = state.sectionMap[item.courseId] || {};
            const baseFolder = (sm[item.section] && sm[item.section].folder) || item.section;
            for (const file of files) {
              if (file.isSubmission) {
                // The student's OWN submission — always kept, → הגשות.
                downloadQueue.push({
                  ...item, name: file.name, url: file.url, direct: true,
                  fetchUrl: file.url, isChild: true, parentCmid: item.cmid,
                  diskFolder: `${baseFolder}/הגשות`,
                });
              } else {
                // Professor's brief/solution on the assign page. Usually ALSO on
                // the main course page → flag for content-dedup and queue last,
                // so an exact duplicate of a main-page file is dropped while a
                // unique one (e.g. an assign-only question) is kept.
                const diskFolder = isSolutionFile(file.name) ? `${baseFolder}/פתרונות מרצה` : `${baseFolder}/תרגילים`;
                lateQueue.push({
                  ...item, name: file.name, url: file.url, direct: true,
                  fetchUrl: file.url, isChild: true, parentCmid: item.cmid,
                  diskFolder, dedupAgainstCourse: true,
                });
              }
            }
          }
          await delay(CONFIG.delayBetweenFetches);

        } else {
          skipQueue.push({ ...item, reason: `unknown type: mod/${item.type}` });
        }
      }

      // Append assign professor-files last, so main-page files are downloaded
      // and hashed first and win the content-dedup.
      downloadQueue.push(...lateQueue);

      log(`  Download queue: ${downloadQueue.length} files`);
      log(`  Skip queue: ${skipQueue.length} items`);

      // Snapshot all resolved keys (including folder/assign children) BEFORE
      // the incremental filter removes unchanged items.  Used later for
      // removal detection so that existing children are not misidentified
      // as "removed from Moodle".
      const allResolvedKeys = new Set();
      for (const item of allItems) allResolvedKeys.add(manifestKey(item));
      for (const item of downloadQueue) allResolvedKeys.add(manifestKey(item));

      // Step 5: Filter for incremental mode
      if (mode === 'incremental') {
        log('Step 5/8: Filtering — incremental mode (with smart update detection)...');
        const filtered = [];
        let updatedCount = 0;
        let headRequestCount = 0;

        // Smart optimization: build a set of known keys per course from the
        // download queue (post-expansion). If a course's scraped key set is
        // identical to its manifest key set, skip HEAD requests entirely for
        // that course — nothing could have changed.
        const scrapedKeysByCourse = {};
        for (const item of downloadQueue) {
          const cid = item.courseId;
          if (!scrapedKeysByCourse[cid]) scrapedKeysByCourse[cid] = new Set();
          scrapedKeysByCourse[cid].add(manifestKey(item));
        }
        // Add back the already-downloaded links we skipped re-resolving above —
        // otherwise the course looks "changed" (missing keys) and we'd HEAD
        // every file, defeating the fast-path and re-checking unchanged items.
        for (const [cid, set] of Object.entries(knownSkippedCmids)) {
          for (const cmid of set) {
            const e = state.manifest[cid] && state.manifest[cid].items[cmid];
            if (e && (e.status === 'downloaded' || e.status === 'extracted')) {
              if (!scrapedKeysByCourse[cid]) scrapedKeysByCourse[cid] = new Set();
              scrapedKeysByCourse[cid].add(cmid);
            }
          }
        }

        const unchangedCourses = new Set();
        for (const [cid, scrapedKeys] of Object.entries(scrapedKeysByCourse)) {
          const courseManifest = state.manifest[cid];
          if (!courseManifest || !courseManifest.items) continue;
          const manifestKeys = new Set(Object.keys(courseManifest.items).filter(k => {
            const s = courseManifest.items[k].status;
            return s !== 'removed_from_moodle' && s !== 'skipped';
          }));
          // Same keys = same items on Moodle. Skip HEAD checks for this course.
          if (scrapedKeys.size === manifestKeys.size &&
              [...scrapedKeys].every(k => manifestKeys.has(k))) {
            unchangedCourses.add(cid);
          }
        }
        if (unchangedCourses.size > 0) {
          const names = CONFIG.courses
            .filter(c => unchangedCourses.has(String(c.id)))
            .map(c => c.folderName);
          log(`  Skipping HEAD checks for ${unchangedCourses.size} unchanged course(s): ${names.join(', ')}`);
        }

        for (const item of downloadQueue) {
          const courseManifest = state.manifest[item.courseId];
          const key = manifestKey(item);
          if (courseManifest && courseManifest.items && courseManifest.items[key]) {
            const existing = courseManifest.items[key];

            // Previously skipped/failed (restricted, unsupported, or errored in
            // an earlier run) — don't retry it every sync. A fresh Seed run
            // re-attempts everything from scratch.
            if (existing.status === 'skipped') continue;

            // If this course has identical items to the manifest, skip the
            // expensive HEAD request — no new/removed items means updates are
            // extremely unlikely for typical Moodle usage.
            if (unchangedCourses.has(String(item.courseId))) {
              continue; // unchanged — skip without HEAD
            }

            // Update detection: HEAD request to compare ETag / Content-Length
            try {
              headRequestCount++;
              const fetchUrl = item.fetchUrl || (item.direct
                ? item.url
                : `${CONFIG.baseUrl}${CONFIG.basePath}mod/resource/view.php?id=${item.cmid}`);
              const fetchOpts = { method: 'HEAD', redirect: 'follow' };
              if (!item.googleExport) fetchOpts.credentials = 'include';
              const headResp = await fetch(fetchUrl, fetchOpts);
              if (headResp.ok) {
                const newSize = parseInt(headResp.headers.get('content-length') || '0');
                // Only trust STRONG, reliable validators. Weak etags (W/"...")
                // can differ between requests/server-nodes for identical content
                // (BGU serves weak etags + gzip with no Content-Length), which
                // caused every file to look "updated" and get re-downloaded.
                // Ignore weak etags; rely on a real size change otherwise.
                const rawEtag = headResp.headers.get('etag') || '';
                const newStrongEtag = rawEtag && !rawEtag.startsWith('W/') ? rawEtag : '';
                const storedStrongEtag = existing.etag && !String(existing.etag).startsWith('W/') ? existing.etag : '';
                const sizeChanged = newSize > 0 && existing.fileSize && newSize !== existing.fileSize;
                const etagChanged = newStrongEtag && storedStrongEtag && newStrongEtag !== storedStrongEtag;
                if (sizeChanged || etagChanged) {
                  log(`  UPDATE detected: ${item.name} (size: ${existing.fileSize}→${newSize})`);
                  item._deleteOldFile = existing.savedAs; // mark old file for deletion
                  item._isUpdate = true;
                  filtered.push(item);
                  updatedCount++;
                  continue;
                }
              }
            } catch { /* HEAD failed — skip update check, keep existing */ }
            continue; // no change detected — skip
          }
          filtered.push(item);
        }
        const newCount = filtered.length - updatedCount;
        const skippedCount = downloadQueue.length - filtered.length;
        log(`  ${newCount} new, ${updatedCount} updated, ${skippedCount} unchanged (${headRequestCount} HEAD requests sent)`);
        downloadQueue.length = 0;
        downloadQueue.push(...filtered);

        // S4 — Download count safety valve
        const totalScraped = allItems.length;
        if (filtered.length > 10 && totalScraped > 0 && filtered.length > totalScraped * 0.5) {
          await safetyAbort(`🛑 ${filtered.length}/${totalScraped} files have no tracking record for this folder — the tracking file wasn't found where these were seeded.` + await recoveryHint());
          return;
        }
        // Removal detection: flag manifest items no longer on Moodle
        // Uses allResolvedKeys (built BEFORE filtering) so unchanged
        // folder/assign children are not incorrectly flagged as removed.
        let removedCount = 0;
        for (const [courseId, courseData] of Object.entries(state.manifest)) {
          if (!courseData.items) continue;
          for (const [key, entry] of Object.entries(courseData.items)) {
            if (entry.status === 'removed_from_moodle') continue; // already flagged
            if (!allResolvedKeys.has(key)) {
              entry.status = 'removed_from_moodle';
              entry.removedAt = new Date().toISOString();
              removedCount++;
            }
          }
        }
        if (removedCount > 0) {
          log(`  ${removedCount} items removed from Moodle (files kept on disk, flagged in manifest)`);
        }

      } else {
        log('Step 5/8: Seed mode — downloading all items');
      }

      // Step 6: Download all files
      state.totalDownloads = downloadQueue.length;
      state.completedDownloads = 0;
      state.progressPercent = 40; state.progressStep = `Downloading 0/${downloadQueue.length}...`;
      updateToast(state.progressStep, state.progressPercent);
      log(`Step 6/8: Downloading ${downloadQueue.length} files...`);
      let downloaded = 0;
      let failed = 0;
      let deduped = 0;
      const downloadedFiles = [];  // track names for end-of-sync report

      // Per-course content-hash sets for de-duplication. Preload hashes already
      // recorded in the manifest so assign files also dedupe against files
      // downloaded in earlier runs.
      const seenHashesByCourse = {};
      for (const [cid, cdata] of Object.entries(state.manifest)) {
        if (!cdata.items) continue;
        const set = new Set();
        for (const e of Object.values(cdata.items)) {
          if (e.contentHash && (e.status === 'downloaded' || e.status === 'extracted')) set.add(e.contentHash);
        }
        seenHashesByCourse[cid] = set;
      }

      // === DRY RUN: skip download, manifest, and output generation ===
      if (dryRun) {
        log('');
        log('╔══════════════════════════════════════╗');
        log('║        DRY RUN COMPLETE              ║');
        log('║  (no files downloaded or modified)    ║');
        log('╚══════════════════════════════════════╝');
        log('');
        if (downloadQueue.length === 0 && skipQueue.length === 0) {
          log('  Nothing to do — all courses are up to date.');
        } else {
          if (downloadQueue.length > 0) {
            log(`  WOULD DOWNLOAD (${downloadQueue.length} files):`);
            for (const item of downloadQueue) {
              const tag = item._isUpdate ? '↻ update' : '+ new';
              log(`    [${tag}] ${item.courseName}/${item.diskFolder || ''}/${normalizeName(item.name)}`);
            }
            log('');
          }
          if (skipQueue.length > 0) {
            log(`  WOULD SKIP (${skipQueue.length} items):`);
            for (const item of skipQueue) {
              log(`    [skip] ${item.courseName}/${item.name} — ${item.reason}`);
            }
          }
        }
        log('');
        log('Run an Incremental Sync to execute these actions for real.');

        state.results = { downloaded: 0, failed: 0, skipped: skipQueue.length };
        state.skipQueue = skipQueue;

      } else {
        // === REAL RUN: download, save, generate ===

        for (let i = 0; i < downloadQueue.length; i++) {
          const item = downloadQueue[i];
          if (i > 0 && i % 10 === 0) {
            await delay(CONFIG.batchPause);
          }
          if (i % 5 === 0 || i === downloadQueue.length - 1) {
            log(`  [${i + 1}/${downloadQueue.length}] ${item.courseName}/${item.name}`);
          }

          // Per-item guard: a single failure (bad name, transient FS/network
          // error) must never abort the whole run and lose every later course.
          try {
          const courseHandle = await getNestedDir(state.semesterHandle, item.courseName);

          // If this is an update, delete the old file on disk first
          if (item._isUpdate && item._deleteOldFile) {
            try {
              const oldPaths = Array.isArray(item._deleteOldFile) ? item._deleteOldFile : [item._deleteOldFile];
              for (const oldPath of oldPaths) {
                if (!oldPath) continue;
                const lastSlash = oldPath.lastIndexOf('/');
                const oldDir = lastSlash > 0 ? oldPath.substring(0, lastSlash) : '';
                const oldName = lastSlash > 0 ? oldPath.substring(lastSlash + 1) : oldPath;
                const dirHandle = await getNestedDir(courseHandle, oldDir);
                await dirHandle.removeEntry(oldName);
                log(`  Deleted old version: ${oldPath}`);
              }
            } catch (e) {
              log(`  Could not delete old file: ${e.message} (will overwrite)`);
            }
          }

          const courseHashes = seenHashesByCourse[item.courseId] || (seenHashesByCourse[item.courseId] = new Set());
          const result = await downloadAndSave(item, courseHandle, courseHashes);
          const key = manifestKey(item);

          // Update progress
          state.completedDownloads = i + 1;
          state.progressPercent = 40 + Math.round(((i + 1) / downloadQueue.length) * 50);
          state.progressStep = `Downloading ${i + 1}/${downloadQueue.length}...`;
          updateToast(state.progressStep, state.progressPercent);

          // Ensure course entry in manifest
          if (!state.manifest[item.courseId]) {
            state.manifest[item.courseId] = {
              courseName: item.courseName,
              folderName: item.courseName,
              lastSync: new Date().toISOString(),
              sectionMap: state.sectionMap[item.courseId] || {},
              items: {},
            };
          }

          if (result.success) {
            downloaded++;
            downloadedFiles.push({ name: item.name, course: item.courseName, savedAs: result.savedAs });
            const status = result.extracted ? 'extracted' : 'downloaded';
            state.manifest[item.courseId].items[key] = {
              section: item.section,
              moodleName: item.name,
              type: item.type,
              status,
              savedAs: result.savedAs,
              fileSize: result.fileSize,
              etag: result.etag || '',
              contentHash: result.contentHash || '',
              downloadedAt: new Date().toISOString(),
            };
            if (result.contentHash) courseHashes.add(result.contentHash);
            if (result.extracted) {
              log(`  ✓ Extracted ${result.extractedCount} files from ${item.name}`);
            }
          } else if (result.skippedDuplicate) {
            // An assign-page copy of a file already saved from the main course
            // page. Record it as skipped so incremental runs don't re-fetch +
            // re-dedup it every time.
            deduped++;
            log(`  ⏭ Deduplicated "${item.name}" — already on the main course page`);
            state.manifest[item.courseId].items[key] = {
              section: item.section,
              moodleName: item.name,
              type: item.type,
              status: 'skipped',
              reason: 'duplicate of main course page',
              skippedAt: new Date().toISOString(),
            };
          } else {
            failed++;
            log(`  ✗ FAILED: ${item.name} — ${result.error}`);
            skipQueue.push({ ...item, reason: `download error: ${result.error}` });
          }
          } catch (e) {
            failed++;
            log(`  ✗ ERROR: ${item.courseName}/${item.name} — ${e.message} (skipped, continuing)`);
            skipQueue.push({ ...item, reason: `processing error: ${e.message}` });
          }

          await delay(CONFIG.delayBetweenFetches);
        }

        log(`  Downloads complete: ${downloaded} ok, ${failed} failed, ${deduped} duplicates skipped`);

        // Step 7: Save manifest with section mappings
        state.progressPercent = 92; state.progressStep = 'Saving manifest...';
        updateToast(state.progressStep, state.progressPercent);
        log('Step 7/8: Saving manifest and section mappings...');
        for (const course of activeCourses) {
          if (state.manifest[course.id]) {
            state.manifest[course.id].lastSync = new Date().toISOString();
            state.manifest[course.id].sectionMap = state.sectionMap[course.id] || {};
          }
        }

        // Record skipped/failed items in the manifest so future incremental
        // syncs know not to retry them (external links, restricted resources,
        // Colab, the BGU syllabus portal, download errors). A fresh Seed run
        // starts clean and re-attempts everything.
        for (const sk of skipQueue) {
          if (!sk || sk.courseId == null) continue;
          if (!state.manifest[sk.courseId]) {
            state.manifest[sk.courseId] = {
              courseName: sk.courseName, folderName: sk.courseName,
              lastSync: new Date().toISOString(),
              sectionMap: state.sectionMap[sk.courseId] || {}, items: {},
            };
          }
          const k = manifestKey(sk);
          const prev = state.manifest[sk.courseId].items[k];
          // Never let a skip clobber a successful download of the same item.
          if (prev && (prev.status === 'downloaded' || prev.status === 'extracted')) continue;
          state.manifest[sk.courseId].items[k] = {
            section: sk.section,
            moodleName: sk.name,
            type: sk.type,
            status: 'skipped',
            reason: sk.reason || 'skipped',
            skippedAt: new Date().toISOString(),
          };
        }

        await saveManifest(state.semesterHandle, state.manifest);
        log('  Manifest saved');

        // Step 8: Generate per-course XLS, combined semester XLS, and skip Excel
        state.progressPercent = 96; state.progressStep = 'Generating reports...';
        updateToast(state.progressStep, state.progressPercent);
        log('Step 8/8: Generating status files and Excel...');
        // Group skipped items by course for per-course status
        const skipByCourse = {};
        for (const item of skipQueue) {
          const cname = item.courseName || 'unknown';
          if (!skipByCourse[cname]) skipByCourse[cname] = [];
          skipByCourse[cname].push(item);
        }
        for (const course of activeCourses) {
          log(`  Checking course ${course.folderName} (id=${course.id}): manifest entry exists = ${!!state.manifest[course.id]}`);
          if (state.manifest[course.id]) {
            const courseHandle = await getNestedDir(state.semesterHandle, course.folderName);
            await generateCourseStatus(courseHandle, course.folderName, state.manifest[course.id], skipByCourse[course.folderName] || []);
          } else {
            log(`  ⚠️ Skipping status XLS for ${course.folderName} — no manifest entry (id=${course.id})`);
          }
        }
        log('  Course status files generated');

        await generateCombinedStatusXls(state.semesterHandle, state.manifest, skipByCourse);

        // Summary
        log('');
        log('╔══════════════════════════════════╗');
        log('║        SYNC COMPLETE             ║');
        log('╚══════════════════════════════════╝');
        log(`Mode: ${mode}`);
        log(`Downloaded: ${downloaded}`);
        log(`Failed: ${failed}`);
        log(`Skipped: ${skipQueue.length}`);
        log('');
        for (const course of activeCourses) {
          const m = state.manifest[course.id];
          const count = m ? Object.keys(m.items).length : 0;
          log(`  ${course.folderName}: ${count} items`);
        }
        log('');
        log('Done!');
        state.progressPercent = 100; state.progressStep = 'Complete!';

        state.results = { downloaded, failed, skipped: skipQueue.length };
        state.skipQueue = skipQueue;

        // Show rich completion report in the toast (stays until user closes)
        showCompletionReport(mode, downloaded, failed, skipQueue, downloadedFiles);

        // Desktop notification so unattended scheduled syncs are visible
        try {
          if (Notification.permission === 'granted') {
            new Notification('Moodle Sync Complete', {
              body: `${downloaded} downloaded, ${failed} failed, ${skipQueue.length} skipped`,
              icon: '📚',
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        } catch {}
      } // end if dryRun/else

    } catch (e) {
      log(`FATAL ERROR: ${e.message}`);
      log(e.stack || '');
    } finally {
      state.running = false;
      // S9 — Release persistent sync lock (skip for dry runs — no lock was acquired)
      if (!dryRun) {
        try { await releaseSyncLock(); } catch {}
      }
      // Don't remove toast here — the completion report stays until user closes it.
      // Only remove if sync failed fatally (no report was shown).
      if (state.progressPercent < 100) {
        removeToast();
      }
    }
  }

  // ============================================================
  // FLOATING TOAST UI
  // ============================================================

  function createToast() {
    // Remove existing toast
    removeToast();

    const toast = document.createElement('div');
    toast.id = 'moodle-sync-toast';
    toast.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; width: 300px; z-index: 999999;
      background: rgba(0, 0, 0, 0.85); color: white; border-radius: 8px;
      padding: 12px 16px; font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    toast.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600;">Syncing...</span>
        <button id="moodle-sync-toast-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; padding: 0;">×</button>
      </div>
      <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 8px;">
        <div id="moodle-sync-toast-text" style="flex: 1; min-width: 0; height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Starting sync...</div>
        <button id="moodle-sync-toast-expand" title="Show full message" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 13px; line-height: 20px; padding: 0 2px; flex-shrink: 0;">⌄</button>
      </div>
      <div style="background: rgba(255, 255, 255, 0.2); border-radius: 4px; height: 4px; margin-bottom: 4px;">
        <div id="moodle-sync-toast-progress" style="background: #1565C0; height: 100%; border-radius: 4px; width: 0%; transition: width 0.3s;"></div>
      </div>
      <div id="moodle-sync-toast-percent" style="font-size: 11px; color: rgba(255, 255, 255, 0.7);">0%</div>
    `;

    document.body.appendChild(toast);
    state.toastEl = toast;

    document.getElementById('moodle-sync-toast-close').onclick = (e) => {
      e.preventDefault();
      removeToast();
    };

    // "See more" — expand/collapse long messages that would otherwise be
    // clipped to a single line with an ellipsis.
    const expandBtn = document.getElementById('moodle-sync-toast-expand');
    const expandTextEl = document.getElementById('moodle-sync-toast-text');
    if (expandBtn && expandTextEl) {
      expandBtn.onclick = (e) => {
        e.preventDefault();
        const collapsed = expandTextEl.style.whiteSpace !== 'normal';
        if (collapsed) {
          expandTextEl.style.whiteSpace = 'normal';
          expandTextEl.style.height = 'auto';
          expandTextEl.style.maxHeight = '40vh';
          expandTextEl.style.overflowY = 'auto';
          expandTextEl.style.textOverflow = 'clip';
          expandTextEl.style.wordBreak = 'break-word';
          expandBtn.textContent = '⌃';
          expandBtn.title = 'Collapse message';
        } else {
          expandTextEl.style.whiteSpace = 'nowrap';
          expandTextEl.style.height = '20px';
          expandTextEl.style.maxHeight = '';
          expandTextEl.style.overflow = 'hidden';
          expandTextEl.style.overflowY = '';
          expandTextEl.style.textOverflow = 'ellipsis';
          expandTextEl.style.wordBreak = '';
          expandBtn.textContent = '⌄';
          expandBtn.title = 'Show full message';
        }
      };
    }
  }

  function updateToast(text, percent) {
    const toast = state.toastEl;
    if (!toast) return;

    if (text) {
      const textEl = document.getElementById('moodle-sync-toast-text');
      if (textEl) textEl.textContent = text;
    }

    if (percent !== undefined) {
      const progressEl = document.getElementById('moodle-sync-toast-progress');
      const percentEl = document.getElementById('moodle-sync-toast-percent');
      if (progressEl) progressEl.style.width = Math.min(100, Math.max(0, percent)) + '%';
      if (percentEl) percentEl.textContent = Math.round(percent) + '%';
    }
  }

  function removeToast() {
    const existing = document.getElementById('moodle-sync-toast');
    if (existing) {
      existing.remove();
      state.toastEl = null;
    }
  }

  /**
   * Show a rich completion report in the toast.
   * - Seed: shows success/failure summary + list of items that weren't downloaded.
   * - Incremental: shows list of newly downloaded files.
   * Toast stays visible until the user closes it.
   */
  function showCompletionReport(mode, downloaded, failed, skipQueue, downloadedFiles) {
    removeToast();

    const toast = document.createElement('div');
    toast.id = 'moodle-sync-toast';
    toast.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; width: 340px; max-height: 70vh; z-index: 999999;
      background: rgba(0, 0, 0, 0.92); color: white; border-radius: 10px;
      padding: 14px 16px; font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      display: flex; flex-direction: column;
    `;

    const isFullySuccessful = failed === 0 && skipQueue.length === 0;
    const modeLabel = mode === 'seed' ? 'Seed Run' : 'Incremental Sync';
    const statusIcon = isFullySuccessful ? '✅' : '⚠️';
    // Note: failed items are already included in skipQueue (pushed there on download error),
    // so we use skipQueue.length alone to avoid double-counting.
    const statusText = isFullySuccessful ? 'Complete — all files downloaded' : `Complete — ${skipQueue.length} item(s) not downloaded`;

    let listHtml = '';

    if (mode === 'seed') {
      // Seed: focus on what WASN'T downloaded
      if (isFullySuccessful) {
        listHtml = `<div style="color: #81C784; padding: 8px 0;">${downloaded} files downloaded successfully.</div>`;
      } else {
        if (downloaded > 0) {
          listHtml += `<div style="color: #81C784; margin-bottom: 6px;">${downloaded} files downloaded successfully.</div>`;
        }
        const failItems = skipQueue.slice(0, 30); // cap at 30 to avoid overflow
        listHtml += `<div style="color: #FFB74D; margin-bottom: 4px; font-weight: 600;">Not downloaded:</div>`;
        listHtml += '<div style="max-height: 40vh; overflow-y: auto; padding-right: 4px;">';
        for (const item of failItems) {
          const reason = item.reason || '';
          listHtml += `<div style="padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1); direction: rtl; text-align: right;">
            <span style="color: #fff;">${item.name}</span>
            <span style="color: rgba(255,255,255,0.5); font-size: 11px; display: block;">${item.courseName || ''} — ${reason}</span>
          </div>`;
        }
        if (skipQueue.length > 30) {
          listHtml += `<div style="color: rgba(255,255,255,0.5); padding: 4px 0; font-size: 11px;">ועוד ${skipQueue.length - 30} פריטים...</div>`;
        }
        listHtml += '</div>';
      }
    } else {
      // Incremental: focus on what WAS downloaded
      if (downloadedFiles.length === 0) {
        listHtml = `<div style="color: #81C784; padding: 8px 0;">הכל מעודכן — אין קבצים חדשים.</div>`;
      } else {
        listHtml += `<div style="color: #81C784; margin-bottom: 4px; font-weight: 600;">${downloadedFiles.length} קבצים חדשים:</div>`;
        listHtml += '<div style="max-height: 40vh; overflow-y: auto; padding-right: 4px;">';
        for (const file of downloadedFiles) {
          listHtml += `<div style="padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.1); direction: rtl; text-align: right;">
            <span style="color: #fff;">${file.name}</span>
            <span style="color: rgba(255,255,255,0.5); font-size: 11px; display: block;">${file.course}</span>
          </div>`;
        }
        listHtml += '</div>';
      }
      // Also mention failures if any
      if (skipQueue.length > 0) {
        listHtml += `<div style="color: #FFB74D; margin-top: 6px; font-size: 11px;">${skipQueue.length} פריטים לא הורדו — ראה סטטוס סנכרון - כל הקורסים.xlsx</div>`;
      }
    }

    toast.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-weight: 700; font-size: 13px;">${statusIcon} ${modeLabel}</span>
        <button id="moodle-sync-report-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; padding: 0; line-height: 1;">×</button>
      </div>
      <div style="color: rgba(255,255,255,0.8); margin-bottom: 8px; font-size: 12px;">${statusText}</div>
      ${listHtml}
    `;

    document.body.appendChild(toast);
    state.toastEl = toast;

    document.getElementById('moodle-sync-report-close').onclick = (e) => {
      e.preventDefault();
      removeToast();
    };
  }

  /**
   * When the persistent sync lock is held by a (possibly stale) run, show an
   * explicit override in the toast instead of dead-ending. Resolves true if the
   * user chooses to start anyway, false if they cancel.
   */
  function confirmStartAnywayViaToast() {
    return new Promise((resolve) => {
      if (!state.toastEl) createToast();
      const textEl = document.getElementById('moodle-sync-toast-text');
      if (textEl) textEl.textContent = 'A sync may already be running in another tab. If you are sure none is, you can start anyway.';

      // Hide the progress bar/percent while prompting
      const progressBar = state.toastEl.querySelector('#moodle-sync-toast-progress');
      const percentEl = document.getElementById('moodle-sync-toast-percent');
      if (progressBar) progressBar.parentElement.style.display = 'none';
      if (percentEl) percentEl.style.display = 'none';

      const row = document.createElement('div');
      row.id = 'moodle-sync-lock-confirm';
      row.style.cssText = 'display: flex; gap: 6px; margin-top: 8px;';

      const startBtn = document.createElement('button');
      startBtn.textContent = '▶ Start anyway';
      startBtn.style.cssText = 'flex: 1; padding: 8px 0; background: #1565C0; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'flex: 1; padding: 8px 0; background: rgba(255,255,255,0.15); color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;';

      const cleanup = () => {
        row.remove();
        if (progressBar) progressBar.parentElement.style.display = '';
        if (percentEl) percentEl.style.display = '';
      };
      startBtn.onclick = (e) => { e.preventDefault(); cleanup(); resolve(true); };
      cancelBtn.onclick = (e) => { e.preventDefault(); cleanup(); resolve(false); };

      row.appendChild(startBtn);
      row.appendChild(cancelBtn);
      state.toastEl.appendChild(row);
    });
  }

  /**
   * Shows a "Pick Folder" button inside the toast and returns a Promise
   * that resolves with the directory handle once the user clicks it.
   * The click IS a user gesture, so showDirectoryPicker() works.
   */
  function requestDirectoryViaToastButton(promptMessage) {
    return new Promise((resolve, reject) => {
      // Ensure toast exists
      if (!state.toastEl) createToast();

      // Brave (and some privacy browsers) block the File System Access API
      // entirely — window.showDirectoryPicker is undefined. Fail with a clear
      // message instead of offering a Pick Folder button that can never open.
      if (typeof window.showDirectoryPicker !== 'function') {
        const blockedMsg = 'This browser blocks folder access (common in Brave). Please run the sync in Chrome or Edge.';
        const tEl = document.getElementById('moodle-sync-toast-text');
        if (tEl) tEl.textContent = blockedMsg;
        log('  ✗ ' + blockedMsg);
        reject(new Error(blockedMsg));
        return;
      }

      const textEl = document.getElementById('moodle-sync-toast-text');
      if (textEl) textEl.textContent = promptMessage || 'Please pick a folder to continue.';

      // Hide progress bar during this prompt
      const progressBar = state.toastEl.querySelector('#moodle-sync-toast-progress');
      const percentEl = document.getElementById('moodle-sync-toast-percent');
      if (progressBar) progressBar.parentElement.style.display = 'none';
      if (percentEl) percentEl.style.display = 'none';

      // Create the button
      const btn = document.createElement('button');
      btn.id = 'moodle-sync-pick-folder-btn';
      btn.textContent = '📂 Pick Folder';
      btn.style.cssText = `
        display: block; width: 100%; margin-top: 8px; padding: 8px 0;
        background: #1565C0; color: white; border: none; border-radius: 4px;
        cursor: pointer; font-size: 13px; font-weight: 600;
      `;
      btn.onmouseenter = () => { btn.style.background = '#1976D2'; };
      btn.onmouseleave = () => { btn.style.background = '#1565C0'; };

      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = 'Opening picker...';
        try {
          const handle = await showDirectoryPicker({ mode: 'readwrite' });
          // Restore progress bar
          if (progressBar) progressBar.parentElement.style.display = '';
          if (percentEl) percentEl.style.display = '';
          btn.remove();
          resolve(handle);
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '📂 Pick Folder (try again)';
          if (e.name === 'AbortError') {
            // User cancelled — let them try again, don't reject
            log('  Folder picker cancelled — click the button to try again.');
          } else {
            btn.remove();
            reject(e);
          }
        }
      };

      // Insert button into toast
      state.toastEl.appendChild(btn);
    });
  }

  /**
   * Safety abort helper — shows a message in the toast and keeps it visible
   * for `durationMs` so the user actually reads it, then returns.
   * Call this INSTEAD of `state.running = false; return;`.
   */
  async function safetyAbort(message, durationMs = 8000) {
    log('');
    log(message);
    // Force-update the toast text even though state.running is about to become false
    updateToast(message, 0);
    // Expand the text element so long abort messages are fully readable
    const textEl = document.getElementById('moodle-sync-toast-text');
    if (textEl) {
      textEl.style.height = 'auto';
      textEl.style.whiteSpace = 'normal';
      textEl.style.overflow = 'visible';
      textEl.style.lineHeight = '1.4';
    }
    // Style the toast to indicate an abort (red accent)
    const progressEl = document.getElementById('moodle-sync-toast-progress');
    if (progressEl) progressEl.style.background = '#e53935';
    const titleEl = state.toastEl && state.toastEl.querySelector('span');
    if (titleEl) titleEl.textContent = 'Sync Aborted';
    state.running = false;
    await delay(durationMs);
    // Don't removeToast here — the finally block will do it
  }

  // ============================================================
  // ============================================================
  // REST-LIKE API
  // ============================================================

  window.__MOODLE_SYNC_API__ = {
    startSync: async function(mode) {
      // Reload config from DOM bridge before each sync (settings may have changed)
      await loadConfig();
      console.log(`[MoodleSync] Config reloaded. ${CONFIG.courses.length} courses.`);

      if (mode === 'seed') {
        createToast();
        runSync('seed').catch(e => console.error('Sync failed:', e.message));
      } else if (mode === 'incremental') {
        createToast();
        runSync('incremental').catch(e => console.error('Sync failed:', e.message));
      }
    },
    getStatus: function() {
      return {
        running: state.running,
        progress: state.progressPercent,
        currentOp: state.progressStep,
        mode: state.mode,
        results: state.results,
        needsConfig: !CONFIG.courses || CONFIG.courses.length === 0,
        ready: CONFIG.courses && CONFIG.courses.length > 0,
        courses: CONFIG.courses ? CONFIG.courses.length : 0,
        totalDownloads: state.totalDownloads,
        completedDownloads: state.completedDownloads,
      };
    },
    getLog: function() {
      return state.log;
    },
  };

  // ============================================================
  // INITIALIZE
  // ============================================================

  // ============================================================
  // DOM BRIDGE — Status writing & command watching (CSP-safe)
  // The content script creates #moodle-sync-bridge and reads
  // data-status. It writes data-command for us to pick up.
  // ============================================================

  function updateBridgeStatus() {
    const bridge = document.getElementById('moodle-sync-bridge');
    if (!bridge) return;
    try {
      bridge.setAttribute('data-status', JSON.stringify(window.__MOODLE_SYNC_API__.getStatus()));
    } catch (e) { /* ignore serialization errors */ }
  }

  function updateBridgeLog() {
    const bridge = document.getElementById('moodle-sync-bridge');
    if (!bridge) return;
    try {
      // Only keep last 200 log entries to avoid attribute size issues
      const recentLog = state.log.slice(-200);
      bridge.setAttribute('data-log', JSON.stringify(recentLog));
    } catch (e) { /* ignore */ }
  }

  function setupBridgeCommandWatcher() {
    const bridge = document.getElementById('moodle-sync-bridge');
    if (!bridge) return;
    let lastCommandTs = 0;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-command') {
          const raw = bridge.getAttribute('data-command');
          if (!raw) continue;
          try {
            const cmd = JSON.parse(raw);
            // Deduplicate by timestamp
            if (cmd._ts && cmd._ts <= lastCommandTs) continue;
            lastCommandTs = cmd._ts || 0;
            if (cmd.action === 'startSync' && cmd.mode) {
              console.log(`[MoodleSync] Received command from extension: startSync(${cmd.mode})`);
              window.__MOODLE_SYNC_API__.startSync(cmd.mode);
            }
          } catch (e) {
            console.warn('[MoodleSync] Failed to parse bridge command:', e);
          }
        }
      }
    });
    observer.observe(bridge, { attributes: true, attributeFilter: ['data-command'] });
    console.log('[MoodleSync] Bridge command watcher active.');
  }

  (async function init() {
    // Best-effort: if this tab holds the persistent sync lock when the page is
    // unloaded (e.g. a mid-sync reload), release it so the next run isn't blocked.
    window.addEventListener('pagehide', () => {
      if (state.holdsLock) { try { releaseSyncLock(); } catch (e) {} }
    });

    // Load config from window, DOM bridge, or IndexedDB
    const configLoaded = await loadConfig();

    // Set API status
    if (configLoaded && CONFIG.courses.length > 0) {
      window.__MOODLE_SYNC_API__.ready = true;
      window.__MOODLE_SYNC_API__.needsConfig = false;
      console.log(`[MoodleSync] Engine v3.0 initialized. ${CONFIG.courses.length} courses configured.`);
      console.log('[MoodleSync] Call window.__MOODLE_SYNC_API__.startSync("seed") or "incremental" to begin.');
    } else {
      window.__MOODLE_SYNC_API__.ready = false;
      window.__MOODLE_SYNC_API__.needsConfig = true;
      console.log('[MoodleSync] Engine v3.0 initialized. No config found.');
      console.log('[MoodleSync] Config must be injected via window.__MOODLE_SYNC_CONFIG__ or set up via the extension options page.');
    }

    // Start DOM bridge integration (for Chrome extension communication)
    updateBridgeStatus();
    updateBridgeLog();
    setInterval(() => {
      updateBridgeStatus();
      updateBridgeLog();
    }, 500);
    setupBridgeCommandWatcher();
  })();

})();
