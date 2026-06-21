/**
 * Popup logic — Moodle Sync Extension v3
 *
 * Shows status, config summary, sync buttons, and actions.
 * Matches the v3 design language.
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const manifest = chrome.runtime.getManifest();
  $('#version').textContent = `v${manifest.version}`;

  let pollInterval = null;

  // Hebrew label for a sync mode (matches the button names).
  const modeLabel = (m) => m === 'seed' ? 'הורדה ראשונית' : m === 'incremental' ? 'סנכרון' : m;

  async function refreshStatus() {
    let config = null;
    try {
      const stored = await chrome.storage.sync.get(['moodleSyncConfig', 'detectedCourses', 'savedFolderName']);
      config = stored.moodleSyncConfig || null;

      // Detected courses banner
      if (stored.detectedCourses && stored.detectedCourses.courses && stored.detectedCourses.courses.length > 0) {
        const detected = stored.detectedCourses.courses;
        const configuredIds = new Set((config?.courses || []).map(c => c.id));
        const detectedIds = new Set(detected.map(c => c.id));
        const newCourses = detected.filter(c => !configuredIds.has(c.id));
        const sameSet = configuredIds.size === detectedIds.size && [...configuredIds].every(id => detectedIds.has(id));
        if (!sameSet) {
          $('#detectedBanner').style.display = '';
          const label = newCourses.length === detected.length
            ? `זוהו ${detected.length} קורסים נוספים`
            : (newCourses.length === 1 ? 'זוהה קורס נוסף אחד' : `זוהו ${newCourses.length} קורסים נוספים`);
          $('#detectedText').textContent = label;
        } else {
          $('#detectedBanner').style.display = 'none';
        }
      }

      // Folder name
      const folderName = stored.savedFolderName;
      $('#folderName').textContent = folderName || 'לא נבחר';
    } catch (e) {}

    // Config summary
    if (config && config.courses && config.courses.length > 0) {
      $('#configSummary').style.display = '';
      $('#noConfigMsg').style.display = 'none';
      $('#configUniversity').textContent = config.universityName || extractDomain(config.baseUrl);
      $('#configSemester').textContent = config.rootPath || config.semesterCheck || '—';

      // Populate course list — show disabled courses with strikethrough
      const courseListEl = $('#courseList');
      courseListEl.innerHTML = '';
      const active = config.courses.filter(c => !c.disabled);
      const disabled = config.courses.filter(c => c.disabled);
      for (const course of [...active, ...disabled]) {
        const li = document.createElement('li');
        li.textContent = course.folderName || course.moodleName || `ID ${course.id}`;
        if (course.disabled) li.className = 'course-disabled';
        courseListEl.appendChild(li);
      }
    } else {
      $('#configSummary').style.display = 'none';
      $('#noConfigMsg').style.display = '';
      $('#syncButtons').style.display = 'none';
      return;
    }

    // Query active tab
    let tabs;
    try {
      tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (e) {
      setStatus('error', 'אין גישה ללשוניות');
      return;
    }

    if (!tabs || tabs.length === 0) {
      setStatus('inactive', 'אין לשונית פעילה');
      return;
    }

    const tab = tabs[0];

    if (!tab.url || !isMoodleUrl(tab.url, config)) {
      setStatus('inactive', 'יש להיכנס למודל על מנת להשתמש בתוסף');
      $('#syncButtons').style.display = 'none';
      return;
    }

    // Ask content script for engine status
    try {
      const status = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (status.notInjected) {
        setStatus('inactive', 'המנוע לא נטען — רעננו את הדף');
        $('#syncButtons').style.display = 'none';
      } else if (status.running) {
        setStatus('active', `מסנכרן (${modeLabel(status.mode)})...`);
        $('#syncButtons').style.display = '';
        enableSyncButtons(false);
        startPolling(tab.id);
      } else if (status.ready) {
        setStatus('active', 'מוכן');
        $('#syncButtons').style.display = '';
        enableSyncButtons(true);
      } else if (status.needsConfig) {
        setStatus('inactive', 'אין הגדרות — פתחו הגדרות');
        $('#syncButtons').style.display = 'none';
      } else {
        setStatus('inactive', 'המנוע נטען...');
        $('#syncButtons').style.display = 'none';
      }
    } catch (e) {
      if (tab.url && isMoodleUrl(tab.url, config)) {
        setStatus('inactive', 'רעננו את דף המודל להפעלה');
      } else {
        setStatus('inactive', 'יש להיכנס למודל על מנת להשתמש בתוסף');
      }
      $('#syncButtons').style.display = 'none';
    }
  }

  function setStatus(state, text) {
    $('#statusDot').className = 'status-dot ' + state;
    $('#statusText').textContent = text;
  }

  function enableSyncButtons(enabled) {
    $('#btnSeed').disabled = !enabled;
    $('#btnIncremental').disabled = !enabled;
  }

  function startPolling(tabId) {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      try {
        const status = await chrome.tabs.sendMessage(tabId, { action: 'getStatus' });
        if (status.running) {
          setStatus('active', `מסנכרן (${modeLabel(status.mode)})...`);
        } else {
          clearInterval(pollInterval);
          pollInterval = null;
          refreshStatus();
        }
      } catch (e) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }, 1000);
  }

  function isMoodleUrl(url, config) {
    try {
      const u = new URL(url);
      if (config && config.baseUrl) {
        const base = new URL(config.baseUrl);
        if (u.hostname === base.hostname) return true;
      }
      if (/\.(ac|co)\.il$/.test(u.hostname)) {
        if (/moodle/i.test(u.hostname)) return true;
        const knownNonStandard = ['lemida.biu.ac.il', 'moodlearn.ariel.ac.il', 'online.shenkar.ac.il', 'mymoodle.oranim.ac.il'];
        if (knownNonStandard.includes(u.hostname)) return true;
        if (/^mw\d+\.haifa\.ac\.il$/.test(u.hostname)) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function extractDomain(url) {
    try { return new URL(url).hostname; } catch { return url || '—'; }
  }

  // Sync commands
  async function sendSyncCommand(mode) {
    enableSyncButtons(false);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const resp = await chrome.tabs.sendMessage(tabs[0].id, { action: 'startSync', mode });
        if (resp && resp.success) {
          setStatus('active', `מתחיל ${modeLabel(mode)}...`);
          startPolling(tabs[0].id);
        } else {
          setStatus('error', resp?.error || 'הפעלת הסנכרון נכשלה');
          enableSyncButtons(true);
        }
      }
    } catch (e) {
      setStatus('error', 'לא ניתן להתחבר לדף');
      enableSyncButtons(true);
    }
  }

  $('#btnSeed').addEventListener('click', () => sendSyncCommand('seed'));
  $('#btnIncremental').addEventListener('click', () => sendSyncCommand('incremental'));
  $('#btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Change folder
  $('#btnChangeFolder').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (typeof window.showDirectoryPicker !== 'function') {
      setStatus('error', 'הדפדפן חוסם בחירת תיקייה (נפוץ ב‑Brave). השתמשו ב‑Chrome או Edge.');
      return;
    }
    try {
      const dirHandle = await showDirectoryPicker({ mode: 'readwrite' });
      const folderName = dirHandle.name;
      await chrome.storage.sync.set({ savedFolderName: folderName });
      $('#folderName').textContent = folderName;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[MoodleSync Popup] Failed to pick folder:', err);
    }
  });

  // Import detected courses on banner click
  $('#detectedBanner').addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.sync.get(['moodleSyncConfig', 'detectedCourses']);
      const detected = stored.detectedCourses;
      if (!detected || !detected.courses || detected.courses.length === 0) return;

      const existing = stored.moodleSyncConfig || {};
      const newConfig = {
        baseUrl: detected.baseUrl || existing.baseUrl || '',
        basePath: detected.basePath || existing.basePath || '/',
        universityName: existing.universityName || detected.universityName || detected.hostname || '',
        semesterCheck: detected.semesterCheck || existing.semesterCheck || '',
        rootPath: existing.rootPath || '',
        courses: detected.courses.map(c => ({
          id: c.id,
          moodleName: c.moodleName || c.folderName || '',
          folderName: c.folderName || c.moodleName || '',
          disabled: false,
        })),
        silentSkipTypes: existing.silentSkipTypes || ['label', 'page', 'zoom', 'lti', 'forum', 'choicegroup'],
        mergeThreshold: existing.mergeThreshold || 2,
        delayBetweenFetches: existing.delayBetweenFetches || 200,
        batchPause: existing.batchPause || 500,
        loginSelectors: existing.loginSelectors,
        loginTextMatches: existing.loginTextMatches,
      };

      await chrome.storage.sync.set({ moodleSyncConfig: newConfig });
      $('#detectedBanner').style.display = 'none';

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && isMoodleUrl(tabs[0].url, newConfig)) {
        chrome.tabs.reload(tabs[0].id);
      }

      setTimeout(refreshStatus, 500);
    } catch (e) {
      console.error('[MoodleSync Popup] Failed to import detected courses:', e);
    }
  });

  refreshStatus();
})();
