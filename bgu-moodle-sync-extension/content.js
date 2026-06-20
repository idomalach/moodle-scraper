/**
 * Moodle Sync — Content Script (Injection Orchestrator)
 *
 * Runs in the content script's ISOLATED WORLD on every matched Moodle page.
 * Its job:
 *   1. Detect if we're actually on a Moodle page (not just a matching URL)
 *   2. Prevent double-injection (check for DOM bridge element)
 *   3. Load config from chrome.storage.sync
 *   4. Pass config to engine via DOM bridge (CSP-safe — no inline scripts)
 *   5. Inject the engine script into the PAGE context via <script src="...">
 *   6. Run dashboard auto-detection and course scraping
 *   7. Bridge popup ↔ engine messages via DOM bridge element
 *
 * IMPORTANT: All cross-world communication uses a hidden DOM element
 * (#moodle-sync-bridge) instead of inline scripts. This avoids CSP
 * violations on Moodle pages with strict Content Security Policies.
 *
 * The engine MUST run in the main world because it uses:
 *   - showDirectoryPicker() (File System Access API)
 *   - indexedDB (for manifest/config caching)
 *   - fetch() with Moodle session cookies
 *   - Notification API
 *   - Dynamic CDN script loading (SheetJS, JSZip)
 */

(function () {
  'use strict';

  // ── DOM Bridge Element ──────────────────────────────────────────
  // All cross-world communication goes through this hidden DOM element.
  // Content script writes data-* attributes; engine reads them.
  // Engine writes status to a separate element; content script reads it.
  const BRIDGE_ID = 'moodle-sync-bridge';

  function getOrCreateBridge() {
    let bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) {
      bridge = document.createElement('div');
      bridge.id = BRIDGE_ID;
      bridge.style.display = 'none';
      (document.body || document.documentElement).appendChild(bridge);
    }
    return bridge;
  }

  // ── Moodle Detection ─────────────────────────────────────────────
  function isMoodlePage() {
    if (document.body && document.body.id === 'page-wrapper') return true;
    if (document.body && document.body.classList.contains('pagelayout-standard')) return true;
    if (document.body && document.body.classList.contains('pagelayout-course')) return true;
    if (document.body && document.body.classList.contains('pagelayout-mydashboard')) return true;
    if (document.body && document.body.classList.contains('pagelayout-admin')) return true;
    if (document.body && document.body.classList.contains('pagelayout-incourse')) return true;
    const meta = document.querySelector('meta[name="generator"]');
    if (meta && /moodle/i.test(meta.content)) return true;
    if (document.querySelector('.navbar-brand, #logo, a[href*="moodle"]')) return true;
    if (/\/(moodle|course|mod|my|user|login)\//i.test(window.location.pathname)) return true;
    return false;
  }

  // ── Double-Injection Guard ───────────────────────────────────────
  // Check if the bridge element already exists (engine was already injected)
  function isAlreadyInjected() {
    return !!document.getElementById(BRIDGE_ID);
  }

  // ── Engine Injection ─────────────────────────────────────────────
  function injectEngine() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('engine/moodle_sync.js');
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = (err) => {
        reject(new Error('Failed to load Moodle Sync engine: ' + err));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  // ── Moodle root + sesskey (isolated-world safe) ──────────────────
  // The content script runs in the ISOLATED world, where the page-world
  // global `M` (and `M.cfg.wwwroot` / `M.cfg.sesskey`) is NOT visible. The old
  // code fell back to `location.origin`, which drops a path prefix like
  // BGU's `/moodle/` and makes the web-service call hit a 404 ("File not
  // found"). Derive both from the DOM/URL instead.
  function getWwwroot() {
    const origin = window.location.origin;
    // Everything before the first known Moodle route segment is the prefix.
    const m = window.location.pathname.match(
      /^(.*?)\/(my|course|mod|user|login|grade|calendar|admin|blocks|dashboard|theme|pluginfile|lib)(\/|$)/
    );
    const prefix = m ? m[1] : '';
    return origin + prefix; // e.g. https://moodle.bgu.ac.il/moodle  or  https://x.ac.il
  }

  function getSesskey() {
    const inp = document.querySelector('input[name="sesskey"]');
    if (inp && inp.value) return inp.value;
    const link = document.querySelector('a[href*="sesskey="]');
    if (link) {
      const m = link.href.match(/[?&]sesskey=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    return '';
  }

  // ── Dashboard Auto-Detection (Workstream 3) ──────────────────────
  // Detects courses from the My Courses block on the Moodle dashboard.
  // Strategy:
  //   1. Primary: Read rendered course cards from [data-region="courses-view"]
  //      inside block_mycourses — these respect the user's active filter
  //      (e.g. "קורסים פעילים" on BGU).
  //   2. Fallback: Call Moodle's web service API to get enrolled courses
  //      classified as "inprogress".
  //   3. Never scrape random course links from sidebars/drawers.
  async function detectDashboardCourses() {
    const isDashboard = /\/my\/?$/.test(window.location.pathname) ||
      document.body?.classList.contains('pagelayout-mydashboard') ||
      window.location.pathname === '/' ||
      window.location.pathname.endsWith('/');

    if (!isDashboard) return;

    let detected = [];

    // ── Strategy 1: Rendered course cards in the My Courses block ──
    // Moodle 4.x renders course cards lazily. Wait up to 5 seconds for them.
    detected = await waitForRenderedCourses(5000);

    // ── Strategy 2: Moodle Web Service API fallback ──
    if (detected.length === 0) {
      console.log('[MoodleSync Extension] No rendered cards found, trying Moodle API...');
      detected = await detectCoursesViaAPI();
    }

    if (detected.length === 0) {
      console.log('[MoodleSync Extension] No courses detected on dashboard.');
      return;
    }

    const baseUrl = window.location.origin;
    let basePath = '/';
    const pathBefore = window.location.pathname.replace(/\/my\/?$/, '').replace(/\/?$/, '/');
    if (pathBefore && pathBefore !== '/') basePath = pathBefore;

    const semesterCheck = detectSemester(detected.map(c => c.moodleName));

    try {
      const existing = await chrome.storage.sync.get(['moodleSyncConfig', 'detectedCourses']);
      const detectedData = {
        courses: detected,
        baseUrl,
        basePath,
        semesterCheck,
        detectedAt: new Date().toISOString(),
        hostname: window.location.hostname,
      };

      await chrome.storage.sync.set({ detectedCourses: detectedData });
      console.log(`[MoodleSync Extension] Detected ${detected.length} active courses on dashboard`);

      // Also fetch ALL courses (active + hidden) for the settings dropdown
      detectAllCourses(detected).catch(e => {
        console.warn('[MoodleSync Extension] Failed to detect all courses:', e);
      });

      if (!existing.moodleSyncConfig || !existing.moodleSyncConfig.courses || existing.moodleSyncConfig.courses.length === 0) {
        const autoConfig = {
          baseUrl,
          basePath,
          universityName: detectUniversityName(window.location.hostname),
          semesterCheck: semesterCheck || '',
          rootPath: '',
          courses: detected,
          silentSkipTypes: ['label', 'page', 'zoom', 'lti', 'forum', 'choicegroup'],
          mergeThreshold: 3,
          delayBetweenFetches: 200,
          batchPause: 500,
        };
        await chrome.storage.sync.set({ moodleSyncConfig: autoConfig });
        console.log('[MoodleSync Extension] Auto-populated config from dashboard');
      }
    } catch (e) {
      console.warn('[MoodleSync Extension] Failed to store detected courses:', e);
    }
  }

  /**
   * Wait for course cards to render inside [data-region="courses-view"],
   * then extract unique courses from .dashboard-card[data-course-id] elements.
   * These cards respect the user's selected filter (e.g. "קורסים פעילים").
   */
  function waitForRenderedCourses(timeoutMs) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;

      function tryExtract() {
        const coursesView = document.querySelector('[data-region="courses-view"]');
        if (!coursesView) {
          if (Date.now() < deadline) { setTimeout(tryExtract, 500); return; }
          resolve([]);
          return;
        }

        const pagedContent = coursesView.querySelector('[data-region="paged-content-page"]');
        if (!pagedContent || pagedContent.innerHTML.length < 100) {
          if (Date.now() < deadline) { setTimeout(tryExtract, 500); return; }
          resolve([]);
          return;
        }

        // Extract unique courses from rendered cards
        const cards = pagedContent.querySelectorAll('[data-course-id]');
        const seen = new Set();
        const courses = [];

        cards.forEach(card => {
          const idStr = card.getAttribute('data-course-id');
          const id = parseInt(idStr, 10);
          if (!id || id < 2 || seen.has(id)) return;
          seen.add(id);

          // Get course name from the card's title link
          const nameEl = card.querySelector('.multiline') ||
                         card.querySelector('.coursename a') ||
                         card.querySelector('a[title]');
          let name = '';
          if (nameEl) {
            name = nameEl.getAttribute('title') || nameEl.textContent.trim();
          }
          // Clean up whitespace artifacts
          name = name.replace(/\s+/g, ' ').trim();
          if (!name) return;

          // Also grab the course URL if available
          const link = card.querySelector('a[href*="course/view.php"]');
          const viewUrl = link ? link.href : '';

          courses.push({ id, moodleName: name, folderName: deriveFolderName(name), viewUrl });
        });

        if (courses.length > 0) {
          console.log(`[MoodleSync Extension] Found ${courses.length} courses from rendered cards.`);
          resolve(courses);
        } else if (Date.now() < deadline) {
          setTimeout(tryExtract, 500);
        } else {
          resolve([]);
        }
      }

      tryExtract();
    });
  }

  /**
   * Fallback: Call Moodle's web service API to get enrolled courses.
   * Uses core_course_get_enrolled_courses_by_timeline_classification
   * with classification "inprogress" to get currently active courses.
   * This works across all Moodle 3.6+ instances.
   */
  async function detectCoursesViaAPI() {
    try {
      // Need M.cfg for sesskey and wwwroot — these are set by Moodle's boot JS
      const sesskey = getSesskey();
      const wwwroot = getWwwroot();

      if (!sesskey) {
        console.log('[MoodleSync Extension] No sesskey found, skipping API detection.');
        return [];
      }

      const resp = await fetch(wwwroot + '/lib/ajax/service.php?sesskey=' + sesskey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          index: 0,
          methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
          args: { offset: 0, limit: 0, classification: 'inprogress', sort: 'fullname' }
        }])
      });

      const data = await resp.json();
      if (!data[0] || !data[0].data || !data[0].data.courses) return [];

      const apiCourses = data[0].data.courses;
      const now = Date.now() / 1000;

      // Filter to courses that started within the last ~8 months (current academic year)
      // This avoids pulling in old "inprogress" courses from previous years
      const eightMonthsAgo = now - (8 * 30 * 24 * 3600);
      const recent = apiCourses.filter(c => c.startdate > eightMonthsAgo);

      // If filtering reduced to zero, fall back to all inprogress
      const source = recent.length > 0 ? recent : apiCourses;

      const courses = source.map(c => ({
        id: c.id,
        moodleName: c.fullname,
        folderName: deriveFolderName(c.fullname),
        viewUrl: c.viewurl || ''
      }));

      console.log(`[MoodleSync Extension] API returned ${apiCourses.length} inprogress, using ${courses.length} recent courses.`);
      return courses;
    } catch (e) {
      console.warn('[MoodleSync Extension] API course detection failed:', e);
      return [];
    }
  }

  /**
   * Fetch hidden (non-active) courses via Moodle API and combine with
   * active courses to produce a full list stored in chrome.storage.
   * This list powers the "Add Course" dropdown in the settings page.
   */
  /**
   * Fetch ALL enrolled courses via the timeline classification API with
   * classification='all', then combine with active courses (active first,
   * rest after) and store in chrome.storage.local.
   *
   * On BGU (and many Israeli Moodle instances), the 'hidden'/'past'
   * classifications return 0 results — all courses sit under 'inprogress'.
   * Using 'all' reliably returns every enrolled course across all semesters.
   * core_enrol_get_users_courses is disabled on many instances, so we
   * don't attempt it.
   */
  async function detectAllCourses(activeCourses) {
    try {
      const sesskey = getSesskey();
      const wwwroot = getWwwroot();
      if (!sesskey) {
        console.log('[MoodleSync Extension] No sesskey — cannot fetch all courses.');
        return;
      }

      const resp = await fetch(wwwroot + '/lib/ajax/service.php?sesskey=' + sesskey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          index: 0,
          methodname: 'core_course_get_enrolled_courses_by_timeline_classification',
          args: { offset: 0, limit: 0, classification: 'all', sort: 'fullname' }
        }])
      });

      const data = await resp.json();
      if (!data[0] || data[0].error || !data[0].data || !data[0].data.courses) {
        console.log('[MoodleSync Extension] All-courses API returned no results.');
        await chrome.storage.local.set({ allDetectedCourses: activeCourses });
        return;
      }

      const apiCourses = data[0].data.courses
        .map(c => ({
          id: c.id,
          moodleName: c.fullname || '',
          folderName: deriveFolderName(c.fullname || ''),
          viewUrl: c.viewurl || ''
        }))
        .filter(c => c.id && c.id > 1); // Filter site-level course (id=1)

      // Combine: active courses first, then the rest (deduped)
      const activeIds = new Set(activeCourses.map(c => c.id));
      const otherCourses = apiCourses.filter(c => !activeIds.has(c.id));
      const allCourses = [...activeCourses, ...otherCourses];

      await chrome.storage.local.set({ allDetectedCourses: allCourses });
      console.log(`[MoodleSync Extension] Stored ${allCourses.length} total courses (${activeCourses.length} active + ${otherCourses.length} other)`);
    } catch (e) {
      console.warn('[MoodleSync Extension] detectAllCourses error:', e);
      try { await chrome.storage.local.set({ allDetectedCourses: activeCourses }); } catch {}
    }
  }

  function deriveFolderName(name) {
    let n = name;
    n = n.replace(/\s*סמ['׳]?\s*[12אב]\s*/g, '');
    n = n.replace(/\s*סמסטר\s*[אבגABab]['׳]?\s*/g, '');
    n = n.replace(/\s*קב['׳]?\s*\d+\s*/g, '');
    n = n.replace(/\s*קבוצ[הת]\s*\d+\s*/g, '');
    n = n.replace(/\s*תש[פרשת]["״]?[א-ת]\s*/g, '');
    n = n.replace(/\s*20\d{2}[-\/]?\d{0,2}[AB]?\s*/g, '');
    n = n.replace(/^[\s\-–—:,.|]+|[\s\-–—:,.|]+$/g, '');
    n = n.trim();
    return n || name.trim();
  }

  function detectSemester(courseNames) {
    const patterns = ['סמ 1', 'סמ 2', 'סמסטר א', 'סמסטר ב', '2025A', '2025B', '2026A', '2026B'];
    const counts = {};
    for (const p of patterns) {
      counts[p] = courseNames.filter(n => n.includes(p)).length;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return (best && best[1] > 0) ? best[0] : '';
  }

  function detectUniversityName(hostname) {
    const KNOWN_HOSTS = {
      'moodle.bgu.ac.il': 'אוניברסיטת בן-גוריון',
      'moodle.technion.ac.il': 'הטכניון',
      'moodle.tau.ac.il': 'אוניברסיטת תל-אביב',
      'moodle.huji.ac.il': 'האוניברסיטה העברית',
      'moodle4.cs.huji.ac.il': 'האוניברסיטה העברית',
      'lemida.biu.ac.il': 'אוניברסיטת בר-אילן',
      'moodlearn.ariel.ac.il': 'אוניברסיטת אריאל',
      'moodle.runi.ac.il': 'אוניברסיטת רייכמן',
      'moodle.colman.ac.il': 'המכללה למנהל',
      'moodle.afeka.ac.il': 'אפקה',
      'moodle.braude.ac.il': 'בראודה',
      'moodle.hit.ac.il': 'HIT',
      'moodle.sce.ac.il': 'SCE',
      'moodle.jct.ac.il': 'JCT',
      'online.shenkar.ac.il': 'שנקר',
      'moodle.aac.ac.il': 'אשקלון',
      'moodle.bezalel.ac.il': 'בצלאל',
      'moodle.mta.ac.il': 'MTA',
      'moodle.ruppin.ac.il': 'רופין',
      'moodle.sapir.ac.il': 'ספיר',
      'moodle.wgalil.ac.il': 'גליל מערבי',
      'moodle.zefat.ac.il': 'צפת',
      'moodle.gordon.ac.il': 'גורדון',
      'moodle.smkb.ac.il': 'סמינר הקיבוצים',
      'moodle.levinsky.ac.il': 'לוינסקי-וינגייט',
      'mymoodle.oranim.ac.il': 'אורנים',
      'moodle.yvc.ac.il': 'עמק יזרעאל',
    };
    if (KNOWN_HOSTS[hostname]) return KNOWN_HOSTS[hostname];
    if (/^mw\d+\.haifa\.ac\.il$/.test(hostname)) return 'אוניברסיטת חיפה';
    if (/^moodle\d+\.kinneret\.ac\.il$/.test(hostname)) return 'כנרת';
    return '';
  }

  // ── Refresh Bridge Config from Storage ──────────────────────────
  // Re-reads config from chrome.storage.sync and updates the bridge element.
  // Called before each sync to ensure the engine gets the latest settings.
  async function refreshBridgeConfig() {
    const bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) return;
    try {
      const stored = await chrome.storage.sync.get(['moodleSyncConfig', 'savedFolderName']);
      if (stored.moodleSyncConfig && stored.moodleSyncConfig.courses) {
        const config = stored.moodleSyncConfig;
        const engineConfig = {
          baseUrl: config.baseUrl,
          basePath: config.basePath || '/',
          semesterCheck: config.semesterCheck,
          rootPath: config.rootPath,
          courses: config.courses,
          silentSkipTypes: config.silentSkipTypes,
          mergeThreshold: config.mergeThreshold,
          delayBetweenFetches: config.delayBetweenFetches,
          batchPause: config.batchPause,
          loginSelectors: config.loginSelectors,
          loginTextMatches: config.loginTextMatches,
          savedFolderName: stored.savedFolderName || '',
        };
        bridge.setAttribute('data-config', JSON.stringify(engineConfig));
        console.log(`[MoodleSync Extension] Bridge config refreshed: ${config.courses.length} courses.`);
      }
    } catch (e) {
      console.warn('[MoodleSync Extension] Failed to refresh bridge config:', e);
    }
  }

  // ── Read Engine Status from DOM Bridge ──────────────────────────
  // The engine writes its status as a JSON data attribute on the bridge element.
  // This is CSP-safe: no inline scripts needed.
  function readEngineStatus() {
    const bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) return { notInjected: true };
    const raw = bridge.getAttribute('data-status');
    if (!raw) return { notInjected: true };
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { notInjected: true };
    }
  }

  // ── Send Command to Engine via DOM Bridge ───────────────────────
  function sendEngineCommand(action, params) {
    const bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) return;
    bridge.setAttribute('data-command', JSON.stringify({ action, ...params, _ts: Date.now() }));
  }

  // ── Read Engine Log from DOM Bridge ─────────────────────────────
  function readEngineLog() {
    const bridge = document.getElementById(BRIDGE_ID);
    if (!bridge) return [];
    const raw = bridge.getAttribute('data-log');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  // ── Cross-Origin Fetch Relay (engine → background) ───────────────
  // The engine (page main world) can't fetch cross-origin URLs like the BGU
  // bgu4u syllabus portal (CORS). It posts a window message; we forward it to
  // the background service worker (which has host_permissions and bypasses
  // CORS), then post the base64 result back to the page.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || !d.__moodleSyncXFetch || !d.url) return;
    try {
      chrome.runtime.sendMessage({ type: 'xfetch', url: d.url }, (result) => {
        const err = chrome.runtime.lastError;
        window.postMessage({
          __moodleSyncXFetchResult: true,
          id: d.id,
          result: err ? { ok: false, error: err.message } : (result || { ok: false, error: 'no response from background' }),
        }, '*');
      });
    } catch (e) {
      window.postMessage({ __moodleSyncXFetchResult: true, id: d.id, result: { ok: false, error: e.message } }, '*');
    }
  });

  // ── Message Listener — Bridge popup ↔ engine ─────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getStatus') {
      // Read status directly from DOM bridge — no inline scripts needed
      sendResponse(readEngineStatus());
      return false; // synchronous
    }

    if (message.action === 'startSync') {
      // Refresh bridge config from storage before starting sync
      // (user may have changed settings since page load)
      refreshBridgeConfig().then(() => {
        sendEngineCommand('startSync', { mode: message.mode });
        // Give the engine a moment to pick up the command via MutationObserver
        setTimeout(() => {
          const status = readEngineStatus();
          sendResponse({ success: true, ...status });
        }, 300);
      }).catch(() => {
        sendEngineCommand('startSync', { mode: message.mode });
        setTimeout(() => {
          sendResponse({ success: true, ...readEngineStatus() });
        }, 300);
      });
      return true; // async
    }

    if (message.action === 'getLog') {
      sendResponse(readEngineLog());
      return false; // synchronous
    }

    if (message.action === 'reinject') {
      main().then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });

  // ── Main ─────────────────────────────────────────────────────────
  async function main() {
    // Step 1: Verify Moodle page
    if (!isMoodlePage()) {
      return;
    }

    // Step 2: Double-injection guard
    if (isAlreadyInjected()) {
      console.log('[MoodleSync Extension] Engine already injected — skipping.');
      return;
    }

    // Step 3: Load config from chrome.storage.sync
    let config = null;
    try {
      const stored = await chrome.storage.sync.get('moodleSyncConfig');
      if (stored.moodleSyncConfig && stored.moodleSyncConfig.courses && stored.moodleSyncConfig.courses.length > 0) {
        config = stored.moodleSyncConfig;
      }
    } catch (err) {
      console.warn('[MoodleSync Extension] Failed to load config from storage:', err);
    }

    // Step 4: Create DOM bridge element with all data the engine needs
    // This is CSP-safe — we write data attributes, engine reads them from DOM
    const bridge = getOrCreateBridge();

    // Pass lib base URL
    bridge.setAttribute('data-lib-base', chrome.runtime.getURL('engine/'));

    // Pass icon URL
    bridge.setAttribute('data-icon', chrome.runtime.getURL('icons/icon128.png'));

    // Pass config as JSON
    if (config) {
      const engineConfig = {
        baseUrl: config.baseUrl,
        basePath: config.basePath || '/',
        semesterCheck: config.semesterCheck,
        rootPath: config.rootPath,
        courses: config.courses,
        silentSkipTypes: config.silentSkipTypes,
        mergeThreshold: config.mergeThreshold,
        delayBetweenFetches: config.delayBetweenFetches,
        batchPause: config.batchPause,
        loginSelectors: config.loginSelectors,
        loginTextMatches: config.loginTextMatches,
      };
      bridge.setAttribute('data-config', JSON.stringify(engineConfig));
      console.log(`[MoodleSync Extension] Config set on bridge: ${config.courses.length} courses.`);
    } else {
      console.log('[MoodleSync Extension] No config found — engine will start without config.');
    }

    // Step 5: Inject the engine (via <script src="..."> — CSP-safe for extension URLs)
    try {
      await injectEngine();
      console.log('[MoodleSync Extension] Engine injected successfully.');
    } catch (err) {
      console.error('[MoodleSync Extension]', err.message);
    }

    // Step 6: Run dashboard auto-detection (non-blocking)
    detectDashboardCourses().catch(e => {
      console.warn('[MoodleSync Extension] Dashboard detection failed:', e);
    });

    // Step 7: Watch bridge for folder name updates (engine → extension storage)
    watchBridgeForFolderName(bridge);
  }

  /**
   * Watch the DOM bridge for data-folder-name attribute changes.
   * When the engine picks a folder via showDirectoryPicker(), it sets
   * data-folder-name on the bridge. We persist this to chrome.storage
   * so the settings page can display it.
   */
  function watchBridgeForFolderName(bridge) {
    if (!bridge) return;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-folder-name') {
          const folderName = bridge.getAttribute('data-folder-name');
          if (folderName) {
            chrome.storage.sync.set({ savedFolderName: folderName }).then(() => {
              console.log(`[MoodleSync Extension] Saved folder name: ${folderName}`);
            }).catch(() => {});
          }
        }
      }
    });
    observer.observe(bridge, { attributes: true, attributeFilter: ['data-folder-name'] });
  }

  // ── Run ──────────────────────────────────────────────────────────
  main();
})();
