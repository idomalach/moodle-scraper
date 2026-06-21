/**
 * Options Page Logic — Moodle Sync Extension v3
 *
 * Full rewrite: locked/edit cards, course toggles, dropdown search,
 * auto-fill, dirty-state save button, onboarding screen.
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── University Presets ────────────────────────────────────────────
  const UNIVERSITY_PRESETS = [
    { name: 'אוניברסיטת בן-גוריון (BGU)', nameEn: 'Ben-Gurion University', baseUrl: 'https://moodle.bgu.ac.il', basePath: '/moodle/', authType: 'standard' },
    { name: 'הטכניון (Technion)', nameEn: 'Technion', baseUrl: 'https://moodle.technion.ac.il', basePath: '/', authType: 'cas' },
    { name: 'אוניברסיטת תל-אביב (TAU)', nameEn: 'Tel Aviv University', baseUrl: 'https://moodle.tau.ac.il', basePath: '/', authType: 'saml' },
    { name: 'האוניברסיטה העברית (HUJI)', nameEn: 'Hebrew University', baseUrl: 'https://moodle.huji.ac.il', basePath: '/2025-26/', authType: 'saml' },
    { name: 'אוניברסיטת בר-אילן (BIU)', nameEn: 'Bar-Ilan University', baseUrl: 'https://lemida.biu.ac.il', basePath: '/', authType: 'portal' },
    { name: 'אוניברסיטת חיפה (Haifa)', nameEn: 'University of Haifa', baseUrl: 'https://mw26.haifa.ac.il', basePath: '/', authType: 'saml' },
    { name: 'אוניברסיטת אריאל (Ariel)', nameEn: 'Ariel University', baseUrl: 'https://moodlearn.ariel.ac.il', basePath: '/', authType: 'standard' },
    { name: 'אוניברסיטת רייכמן (Reichman)', nameEn: 'Reichman University', baseUrl: 'https://moodle.runi.ac.il', basePath: '/2023/', authType: 'portal' },
    { name: 'המכללה למנהל (COLMAN)', nameEn: 'College of Management', baseUrl: 'https://moodle.colman.ac.il', basePath: '/', authType: 'standard' },
    { name: 'אפקה — מכללה להנדסה (Afeka)', nameEn: 'Afeka College', baseUrl: 'https://moodle.afeka.ac.il', basePath: '/', authType: 'standard' },
    { name: 'בראודה — מכללה להנדסה (Braude)', nameEn: 'Braude College', baseUrl: 'https://moodle.braude.ac.il', basePath: '/', authType: 'standard' },
    { name: 'HIT — מכון טכנולוגי חולון', nameEn: 'HIT', baseUrl: 'https://moodle.hit.ac.il', basePath: '/', authType: 'standard' },
    { name: 'SCE — סמי שמעון', nameEn: 'SCE', baseUrl: 'https://moodle.sce.ac.il', basePath: '/', authType: 'standard' },
    { name: 'JCT — לב / ירושלים לטכנולוגיה', nameEn: 'JCT / Lev Academic Center', baseUrl: 'https://moodle.jct.ac.il', basePath: '/', authType: 'standard' },
    { name: 'שנקר — הנדסה ועיצוב (Shenkar)', nameEn: 'Shenkar', baseUrl: 'https://online.shenkar.ac.il', basePath: '/', authType: 'standard' },
    { name: 'אשקלון — מכללה אקדמית (AAC)', nameEn: 'Ashkelon Academic College', baseUrl: 'https://moodle.aac.ac.il', basePath: '/', authType: 'standard' },
    { name: 'בצלאל — אקדמיה לאמנות (Bezalel)', nameEn: 'Bezalel Academy', baseUrl: 'https://moodle.bezalel.ac.il', basePath: '/', authType: 'portal' },
    { name: 'כנרת — מכללה אקדמית (Kinneret)', nameEn: 'Kinneret College', baseUrl: 'https://moodle85.kinneret.ac.il', basePath: '/', authType: 'standard' },
    { name: 'MTA — מכללת תל-אביב-יפו', nameEn: 'MTA', baseUrl: 'https://moodle.mta.ac.il', basePath: '/', authType: 'standard' },
    { name: 'רופין — מרכז אקדמי (Ruppin)', nameEn: 'Ruppin Academic Center', baseUrl: 'https://moodle.ruppin.ac.il', basePath: '/', authType: 'standard' },
    { name: 'ספיר — מכללה אקדמית (Sapir)', nameEn: 'Sapir Academic College', baseUrl: 'https://moodle.sapir.ac.il', basePath: '/2025/', authType: 'standard' },
    { name: 'עמק יזרעאל (Yezreel Valley)', nameEn: 'Yezreel Valley College', baseUrl: 'https://moodle.yvc.ac.il', basePath: '/', authType: 'standard' },
    { name: 'גליל מערבי (Western Galilee)', nameEn: 'Western Galilee College', baseUrl: 'https://moodle.wgalil.ac.il', basePath: '/', authType: 'standard' },
    { name: 'צפת — מכללה אקדמית (Zefat)', nameEn: 'Zefat Academic College', baseUrl: 'https://moodle.zefat.ac.il', basePath: '/', authType: 'standard' },
    { name: 'גורדון — מכללה לחינוך (Gordon)', nameEn: 'Gordon College', baseUrl: 'https://moodle.gordon.ac.il', basePath: '/', authType: 'standard' },
    { name: 'סמינר הקיבוצים (SMKB)', nameEn: 'Kibbutzim College', baseUrl: 'https://moodle.smkb.ac.il', basePath: '/', authType: 'standard' },
    { name: 'לוינסקי-וינגייט (Levinsky-Wingate)', nameEn: 'Levinsky-Wingate', baseUrl: 'https://moodle.levinsky.ac.il', basePath: '/', authType: 'saml' },
    { name: 'אורנים — מכללה אקדמית (Oranim)', nameEn: 'Oranim College', baseUrl: 'https://mymoodle.oranim.ac.il', basePath: '/', authType: 'standard' },
    { name: 'Custom / Other', nameEn: 'Custom', baseUrl: '', basePath: '/', authType: 'standard' },
  ];

  // ── Default Config ────────────────────────────────────────────────
  const DEFAULT_CONFIG = {
    baseUrl: '',
    basePath: '/',
    universityName: '',
    semesterCheck: '',
    rootPath: '',
    courses: [],
    silentSkipTypes: ['label', 'page', 'zoom', 'lti', 'forum', 'choicegroup'],
    mergeThreshold: 2,
    delayBetweenFetches: 200,
    batchPause: 500,
  };

  // ── Semester auto-suggest mapping ─────────────────────────────────
  const SEMESTER_MAP = [
    { patterns: ['סמ 1', "סמ' 1", 'סמסטר א'], suggestion: 'סמסטר א׳' },
    { patterns: ['סמ 2', "סמ' 2", 'סמסטר ב'], suggestion: 'סמסטר ב׳' },
    { patterns: ['סמ 3', "סמ' 3", 'קיץ'],      suggestion: 'סמסטר קיץ' },
  ];

  // ── State ─────────────────────────────────────────────────────────
  let detectedCourses = [];   // active courses from chrome.storage
  let allDetectedCourses = []; // all courses (active + hidden) from chrome.storage
  let allDropdownCourses = []; // combined list for dropdown: active first, then rest
  let activePool = [];         // active courses → feed the active component's dropdown
  let hiddenPool = [];         // hidden/past courses → feed the inactive component's dropdown
  let savedSnapshot = '';      // JSON snapshot for dirty detection
  let activeDropdown = null;   // currently open course dropdown

  // ── DOM refs ──────────────────────────────────────────────────────
  const presetSelect   = $('#universityPreset');
  const courseListEl    = $('#courseList');
  const inactiveCourseListEl = $('#inactiveCourseList');

  // ── Populate University Dropdown ──────────────────────────────────
  UNIVERSITY_PRESETS.forEach((uni, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = uni.name;
    presetSelect.appendChild(opt);
  });

  presetSelect.addEventListener('change', () => {
    const idx = parseInt(presetSelect.value, 10);
    if (isNaN(idx)) return;
    const uni = UNIVERSITY_PRESETS[idx];
    if (uni.baseUrl) {
      $('#baseUrl').value = uni.baseUrl;
      $('#basePath').value = uni.basePath || '/';
      $('#universityName').value = uni.nameEn || uni.name;
    } else {
      $('#baseUrl').value = '';
      $('#basePath').value = '/';
      $('#universityName').value = '';
      $('#baseUrl').focus();
    }
    checkDirty();
  });

  // ── Locked / Edit toggle: University ──────────────────────────────
  let uniEditMode = false;

  $('#btnEditUni').addEventListener('click', () => {
    uniEditMode = !uniEditMode;
    applyUniEditState();
  });

  function applyUniEditState() {
    if (uniEditMode) {
      $('#uniLocked').style.display = 'none';
      $('#uniEditFields').classList.add('visible');
      $('#btnEditUni').textContent = 'Done';
    } else {
      const name = $('#universityName').value.trim();
      const preset = UNIVERSITY_PRESETS[parseInt(presetSelect.value, 10)];
      $('#uniLocked').textContent = name || (preset && preset.nameEn) || 'Not configured';
      $('#uniLocked').style.display = '';
      $('#uniEditFields').classList.remove('visible');
      $('#btnEditUni').textContent = 'Edit';
    }
  }

  // ── Locked / Edit toggle: Semester ────────────────────────────────
  let semEditMode = false;

  $('#btnEditSemester').addEventListener('click', () => {
    semEditMode = !semEditMode;
    applySemEditState();
  });

  function applySemEditState() {
    if (semEditMode) {
      $('#semLocked').style.display = 'none';
      $('#semEditFields').classList.add('visible');
      $('#btnEditSemester').textContent = 'Done';
    } else {
      const rootPath = $('#rootPath').value.trim();
      $('#semLocked').textContent = rootPath || 'Not configured';
      $('#semLocked').style.display = '';
      $('#semEditFields').classList.remove('visible');
      $('#btnEditSemester').textContent = 'Edit';
    }
  }

  // ── Semester auto-suggest ─────────────────────────────────────────
  $('#semesterCheck').addEventListener('input', () => {
    const val = $('#semesterCheck').value.trim();
    for (const entry of SEMESTER_MAP) {
      if (entry.patterns.some(p => val.includes(p))) {
        // Only auto-fill if rootPath is empty or matches a previous suggestion
        const current = $('#rootPath').value.trim();
        const isSuggested = SEMESTER_MAP.some(e => e.suggestion === current);
        if (!current || isSuggested) {
          $('#rootPath').value = entry.suggestion;
        }
        break;
      }
    }
    checkDirty();
  });

  // ── Folder Name Cleanup ───────────────────────────────────────────
  function cleanFolderName(moodleName) {
    let name = moodleName;
    // Remove semester identifiers
    name = name.replace(/סמ'?\s*[אבג123]|סמסטר\s*[אבג]׳?|סמסטר\s*קיץ/g, '');
    // Remove academic year patterns
    name = name.replace(/\d{4}-\d{2,4}/g, '');
    name = name.replace(/תשפ"[א-ת]/g, '');
    name = name.replace(/תשפ[א-ת]/g, '');
    // Remove leftover separators
    name = name.replace(/^[\s\-|()]+|[\s\-|()]+$/g, '');
    // Collapse spaces
    name = name.replace(/\s{2,}/g, ' ').trim();
    return name;
  }

  // ══════════════════════════════════════════════════════════════════
  //  COURSE LIST
  // ══════════════════════════════════════════════════════════════════

  // These functions drive BOTH the active (#courseList) and the inactive
  // (#inactiveCourseList) components. `listEl` selects which one; `pool` is the
  // set of courses offered in that component's Add-course dropdown
  // (activePool for active, hiddenPool for inactive).
  function renderCourseList(courses, listEl = courseListEl, pool = activePool) {
    listEl.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'course-header';
    header.innerHTML = '<span></span><span>Folder Name</span><span>Course Name</span><span>ID</span><span></span>';
    listEl.appendChild(header);

    if (!courses || courses.length === 0) {
      addCourseRow({ id: '', moodleName: '', folderName: '', disabled: false }, listEl, pool);
      return;
    }

    // Sort: enabled first, disabled last
    const enabled = courses.filter(c => !c.disabled);
    const disabled = courses.filter(c => c.disabled);
    [...enabled, ...disabled].forEach(c => addCourseRow(c, listEl, pool));
  }

  function addCourseRow(course, listEl = courseListEl, pool = activePool) {
    const row = document.createElement('div');
    row.className = 'course-row' + (course.disabled ? ' disabled' : '');

    const isDisabled = course.disabled ? '' : 'checked';

    row.innerHTML = `
      <button class="btn-remove" title="Remove course">&times;</button>
      <input type="text" class="course-folder-name" placeholder="Folder name" value="${escapeHtml(course.folderName || '')}" dir="rtl">
      <input type="text" class="course-moodle-name" placeholder="Course name" value="${escapeHtml(course.moodleName || '')}" dir="rtl" readonly>
      <input type="text" class="course-id" placeholder="ID" value="${course.id || ''}" dir="ltr">
      <label class="toggle-switch">
        <input type="checkbox" class="course-toggle" ${isDisabled}>
        <span class="toggle-slider"></span>
      </label>
    `;

    // Toggle handler
    const toggle = row.querySelector('.course-toggle');
    toggle.addEventListener('change', () => {
      row.classList.toggle('disabled', !toggle.checked);
      resortCourseRows(listEl);
      checkDirty();
    });

    // Remove handler
    row.querySelector('.btn-remove').addEventListener('click', () => {
      row.remove();
      if (listEl.querySelectorAll('.course-row').length === 0) {
        addCourseRow({ id: '', moodleName: '', folderName: '', disabled: false }, listEl, pool);
      }
      checkDirty();
    });

    // Course ID focus → dropdown
    const idInput = row.querySelector('.course-id');
    idInput.addEventListener('focus', (e) => openCourseDropdown(e.target, row, pool));
    idInput.addEventListener('input', () => {
      // Try auto-fill from all known courses (any pool — we're just filling the name)
      const val = parseInt(idInput.value, 10);
      const match = allDropdownCourses.find(c => c.id === val) || detectedCourses.find(c => c.id === val);
      if (match) {
        row.querySelector('.course-moodle-name').value = match.moodleName || match.folderName || '';
        if (!row.querySelector('.course-folder-name').value) {
          row.querySelector('.course-folder-name').value = cleanFolderName(match.moodleName || match.folderName || '');
        }
        // Remove any "not recognized" hint
        const hint = row.querySelector('.not-recognized');
        if (hint) hint.remove();
      }
      checkDirty();
    });

    // Folder name input → dirty
    row.querySelector('.course-folder-name').addEventListener('input', () => checkDirty());

    listEl.appendChild(row);
  }

  function resortCourseRows(listEl = courseListEl) {
    const rows = [...listEl.querySelectorAll('.course-row')];
    const enabled = rows.filter(r => r.querySelector('.course-toggle').checked);
    const disabled = rows.filter(r => !r.querySelector('.course-toggle').checked);
    // Reappend in order (header stays first)
    [...enabled, ...disabled].forEach(r => listEl.appendChild(r));
  }

  function collectCourses(listEl = courseListEl, inactive = false) {
    const rows = listEl.querySelectorAll('.course-row');
    const courses = [];
    rows.forEach((row) => {
      const idVal = row.querySelector('.course-id').value.trim();
      const id = parseInt(idVal, 10);
      const moodleName = row.querySelector('.course-moodle-name').value.trim();
      const folderName = row.querySelector('.course-folder-name').value.trim();
      const disabled = !row.querySelector('.course-toggle').checked;
      if (id && folderName) {
        const c = { id, moodleName, folderName, disabled };
        if (inactive) c.inactive = true; // remembers which component it belongs to
        courses.push(c);
      }
    });
    return courses;
  }

  // ── Course Dropdown ───────────────────────────────────────────────
  function openCourseDropdown(inputEl, row, pool = activePool) {
    closeCourseDropdown();
    if (!pool || pool.length === 0) return;

    const dd = document.createElement('div');
    dd.className = 'course-dropdown';
    activeDropdown = dd;

    const searchInput = document.createElement('input');
    searchInput.className = 'dd-search';
    searchInput.placeholder = 'Search courses...';
    dd.appendChild(searchInput);

    const listDiv = document.createElement('div');
    listDiv.className = 'dd-list';
    dd.appendChild(listDiv);

    // Exclude IDs already present in EITHER component, so a course can't be
    // added twice (and an active course already listed won't reappear).
    function existingIdSet() {
      const ids = new Set();
      [courseListEl, inactiveCourseListEl].forEach(le => {
        if (!le) return;
        le.querySelectorAll('.course-row').forEach(r => {
          const idVal = parseInt(r.querySelector('.course-id').value, 10);
          if (idVal) ids.add(idVal);
        });
      });
      return ids;
    }

    function renderItems(filter) {
      listDiv.innerHTML = '';
      const q = (filter || '').toLowerCase();
      const existingIds = existingIdSet();
      const filtered = pool.filter(c => {
        if (existingIds.has(c.id)) return false; // exclude duplicates
        const name = (c.moodleName || c.folderName || '').toLowerCase();
        return name.includes(q) || String(c.id).includes(q);
      });

      if (filtered.length === 0) {
        if (pool.length > 0 && pool.every(c => existingIds.has(c.id))) {
          listDiv.innerHTML = '<div class="dd-empty">All detected courses already added</div>';
        } else if (q) {
          listDiv.innerHTML = '<div class="dd-empty">No matches</div>';
        } else {
          listDiv.innerHTML = '<div class="dd-empty">Visit your Moodle dashboard to detect courses</div>';
        }
        return;
      }

      filtered.forEach(c => {
        const item = document.createElement('div');
        item.className = 'dd-item';
        item.innerHTML = `<span class="dd-name">${escapeHtml(c.moodleName || c.folderName || '')}</span><span class="dd-id">${c.id}</span>`;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault(); // prevent blur before click fires
          row.querySelector('.course-id').value = c.id;
          row.querySelector('.course-moodle-name').value = c.moodleName || c.folderName || '';
          row.querySelector('.course-folder-name').value = cleanFolderName(c.moodleName || c.folderName || '');
          closeCourseDropdown();
          checkDirty();
        });
        listDiv.appendChild(item);
      });
    }

    searchInput.addEventListener('input', () => renderItems(searchInput.value));
    renderItems('');

    // Position below the input
    const rect = inputEl.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.left = Math.max(8, rect.right - 320) + 'px';

    document.body.appendChild(dd);

    // Auto-focus search
    setTimeout(() => searchInput.focus(), 0);

    // Close on outside click
    function onDocClick(e) {
      if (!dd.contains(e.target) && e.target !== inputEl) {
        closeCourseDropdown();
        document.removeEventListener('mousedown', onDocClick);
      }
    }
    setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);

    // Close on Escape
    function onKey(e) {
      if (e.key === 'Escape') {
        closeCourseDropdown();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);
  }

  function closeCourseDropdown() {
    if (activeDropdown) {
      activeDropdown.remove();
      activeDropdown = null;
    }
  }

  // ── Course action buttons (active component) ──────────────────────
  $('#btnAddCourse').addEventListener('click', () => {
    addCourseRow({ id: '', moodleName: '', folderName: '', disabled: false }, courseListEl, activePool);
    const rows = courseListEl.querySelectorAll('.course-row');
    rows[rows.length - 1].querySelector('.course-id').focus();
    checkDirty();
  });

  $('#btnApplyDetected').addEventListener('click', async () => {
    if (detectedCourses.length === 0) {
      showToast('No auto-detected courses available', true);
      return;
    }
    const courses = detectedCourses.map(c => ({
      id: c.id,
      moodleName: c.moodleName || c.folderName || '',
      folderName: cleanFolderName(c.moodleName || c.folderName || ''),
      disabled: false,
    }));
    renderCourseList(courses, courseListEl, activePool);
    checkDirty();
    showToast(`Applied ${courses.length} detected courses`);
  });

  $('#btnRemoveAll').addEventListener('click', () => {
    renderCourseList([], courseListEl, activePool);
    checkDirty();
    showToast('Removed all courses');
  });

  // ── Course action buttons (inactive component) ────────────────────
  $('#btnAddInactiveCourse').addEventListener('click', () => {
    addCourseRow({ id: '', moodleName: '', folderName: '', disabled: false }, inactiveCourseListEl, hiddenPool);
    const rows = inactiveCourseListEl.querySelectorAll('.course-row');
    rows[rows.length - 1].querySelector('.course-id').focus();
    checkDirty();
  });

  $('#btnRemoveAllInactive').addEventListener('click', () => {
    renderCourseList([], inactiveCourseListEl, hiddenPool);
    checkDirty();
    showToast('Removed all inactive courses');
  });

  // ══════════════════════════════════════════════════════════════════
  //  LOAD / SAVE CONFIG
  // ══════════════════════════════════════════════════════════════════

  async function loadConfig() {
    try {
      const stored = await chrome.storage.sync.get('moodleSyncConfig');
      return stored.moodleSyncConfig || null;
    } catch (e) {
      return null;
    }
  }

  async function loadDetected() {
    try {
      const stored = await chrome.storage.sync.get('detectedCourses');
      if (stored.detectedCourses && stored.detectedCourses.courses) {
        detectedCourses = stored.detectedCourses.courses;
      }
      // allDetectedCourses uses chrome.storage.local (larger limit for many courses)
      const localStored = await chrome.storage.local.get('allDetectedCourses');
      if (localStored.allDetectedCourses && localStored.allDetectedCourses.length > 0) {
        allDetectedCourses = localStored.allDetectedCourses;
      }
      // Build combined dropdown list: active courses first, then rest (deduped)
      const activeIds = new Set(detectedCourses.map(c => c.id));
      const restCourses = allDetectedCourses.filter(c => !activeIds.has(c.id));
      allDropdownCourses = [...detectedCourses, ...restCourses];
      // If no allDetectedCourses available, fall back to just active
      if (allDropdownCourses.length === 0) {
        allDropdownCourses = detectedCourses;
      }
      // Pools for the two components' Add-course dropdowns.
      // activePool → active/in-progress courses (active component).
      // hiddenPool → the FULL enrolled list. On many Israeli Moodles (e.g. BGU)
      // every course is classified 'inprogress', so there is no separate
      // "hidden" set; "hidden from sight" just means courses not in this
      // semester's active list. The dropdown's cross-list dedup removes
      // anything already listed in either component, so the inactive dropdown
      // effectively shows "all my courses except those already added above".
      activePool = detectedCourses.slice();
      hiddenPool = allDropdownCourses.slice();
      return stored.detectedCourses || null;
    } catch (e) {}
    detectedCourses = [];
    allDetectedCourses = [];
    allDropdownCourses = [];
    activePool = [];
    hiddenPool = [];
    return null;
  }

  async function populateForm() {
    let config = await loadConfig();
    const detected = await loadDetected();

    // Determine if onboarding should show
    const hasConfig = config && config.baseUrl;
    const hasDetected = detected && detected.courses && detected.courses.length > 0;

    if (!hasConfig && !hasDetected) {
      // Show onboarding, hide everything else
      $('#onboarding').style.display = '';
      $('#universityCard').style.display = 'none';
      $('#semesterCard').style.display = 'none';
      $('#folderCard').style.display = 'none';
      $('#coursesCard').style.display = 'none';
      $('#inactiveCoursesCard').style.display = 'none';
      $('#advancedCard').style.display = 'none';
      return;
    }

    // Hide onboarding, show settings
    $('#onboarding').style.display = 'none';
    $('#universityCard').style.display = '';
    $('#semesterCard').style.display = '';
    $('#folderCard').style.display = '';
    $('#coursesCard').style.display = '';
    $('#inactiveCoursesCard').style.display = '';
    $('#advancedCard').style.display = '';

    // If no config but detected data, pre-fill from detected
    if (!config) config = { ...DEFAULT_CONFIG };
    if (!config.baseUrl && detected) {
      config.baseUrl = detected.baseUrl || '';
      config.basePath = detected.basePath || '/';
      config.semesterCheck = detected.semesterCheck || '';
      config.universityName = detected.hostname || '';
      if (detected.courses && detected.courses.length > 0) {
        config.courses = detected.courses.map(c => ({
          id: c.id,
          moodleName: c.moodleName || c.folderName || '',
          folderName: cleanFolderName(c.moodleName || c.folderName || ''),
          disabled: false,
        }));
      }
    }

    // University
    $('#baseUrl').value = config.baseUrl || '';
    $('#basePath').value = config.basePath || '/';
    $('#universityName').value = config.universityName || '';

    // Try to select matching preset
    let presetIdx = UNIVERSITY_PRESETS.findIndex(u => u.baseUrl === config.baseUrl);
    if (presetIdx < 0 && config.baseUrl) {
      try {
        const configHost = new URL(config.baseUrl).hostname;
        presetIdx = UNIVERSITY_PRESETS.findIndex(u => {
          try { return new URL(u.baseUrl).hostname === configHost; } catch { return false; }
        });
      } catch {}
    }
    if (presetIdx >= 0) {
      presetSelect.value = presetIdx;
    }

    // Set locked display — use English name from preset if available
    const matchedPreset = presetIdx >= 0 ? UNIVERSITY_PRESETS[presetIdx] : null;
    const uniDisplayName = config.universityName || (matchedPreset && matchedPreset.nameEn) || '';
    $('#uniLocked').textContent = uniDisplayName || 'Not configured';

    // If uni has data, start locked. If not, start in edit mode.
    uniEditMode = !uniDisplayName;
    applyUniEditState();

    // Semester
    $('#semesterCheck').value = config.semesterCheck || '';
    // Auto-fill rootPath from semesterCheck if rootPath is empty
    if (!config.rootPath && config.semesterCheck) {
      for (const entry of SEMESTER_MAP) {
        if (entry.patterns.some(p => config.semesterCheck.includes(p))) {
          config.rootPath = entry.suggestion;
          break;
        }
      }
    }
    $('#rootPath').value = config.rootPath || '';
    const semDisplay = config.rootPath || '';
    $('#semLocked').textContent = semDisplay || 'Not configured';

    semEditMode = !semDisplay;
    applySemEditState();

    // Courses — split by the `inactive` flag into the two components
    const allCourses = config.courses || [];
    renderCourseList(allCourses.filter(c => !c.inactive), courseListEl, activePool);
    renderCourseList(allCourses.filter(c => c.inactive), inactiveCourseListEl, hiddenPool);

    // Advanced
    $('#mergeThreshold').value = config.mergeThreshold ?? 2;
    $('#delayBetweenFetches').value = config.delayBetweenFetches ?? 200;
    $('#batchPause').value = config.batchPause ?? 500;
    $('#silentSkipTypes').value = (config.silentSkipTypes || DEFAULT_CONFIG.silentSkipTypes).join(', ');

    // Snapshot for dirty detection
    savedSnapshot = JSON.stringify(collectFormData());
  }

  // ── Collect form data ─────────────────────────────────────────────
  function collectFormData() {
    const skipTypesRaw = $('#silentSkipTypes').value;
    const silentSkipTypes = skipTypesRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    return {
      baseUrl: $('#baseUrl').value.trim().replace(/\/+$/, ''),
      basePath: $('#basePath').value.trim(),
      universityName: $('#universityName').value.trim(),
      semesterCheck: $('#semesterCheck').value.trim(),
      rootPath: $('#rootPath').value.trim(),
      courses: [...collectCourses(courseListEl, false), ...collectCourses(inactiveCourseListEl, true)],
      silentSkipTypes: silentSkipTypes.length > 0 ? silentSkipTypes : DEFAULT_CONFIG.silentSkipTypes,
      mergeThreshold: parseInt($('#mergeThreshold').value, 10) || 2,
      delayBetweenFetches: parseInt($('#delayBetweenFetches').value, 10) || 200,
      batchPause: parseInt($('#batchPause').value, 10) || 500,
    };
  }

  // ── Save ──────────────────────────────────────────────────────────
  $('#btnSave').addEventListener('click', async () => {
    const config = collectFormData();

    if (!config.baseUrl) {
      showToast('Select a university or enter a Moodle URL', true);
      return;
    }

    try {
      await chrome.storage.sync.set({ moodleSyncConfig: config });
      savedSnapshot = JSON.stringify(config);
      checkDirty();
      showToast('Saved');
    } catch (e) {
      showToast('Failed to save: ' + e.message, true);
    }
  });

  // ── Dirty State Detection ─────────────────────────────────────────
  function checkDirty() {
    const current = JSON.stringify(collectFormData());
    const isDirty = current !== savedSnapshot;
    const btn = $('#btnSave');
    if (isDirty) {
      btn.classList.remove('clean');
      btn.classList.add('dirty');
    } else {
      btn.classList.remove('dirty');
      btn.classList.add('clean');
    }
  }

  // Listen to all inputs for dirty checking
  document.addEventListener('input', () => checkDirty());
  document.addEventListener('change', () => checkDirty());

  // ── Toast ─────────────────────────────────────────────────────────
  function showToast(msg, isError = false) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.className = 'toast';
    }, 2500);
  }

  // ── Utility ───────────────────────────────────────────────────────
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Folder Picker ─────────────────────────────────────────────────
  async function loadFolderStatus() {
    try {
      const stored = await chrome.storage.sync.get('savedFolderName');
      const name = stored.savedFolderName;
      if (name) {
        $('#folderStatus').textContent = name;
        $('#folderStatus').classList.add('folder-selected');
        $('#folderHint').style.display = '';
      } else {
        $('#folderStatus').textContent = 'No folder selected yet — will be asked on first sync.';
      }
    } catch (e) {}
  }

  $('#btnPickFolder').addEventListener('click', async () => {
    if (typeof window.showDirectoryPicker !== 'function') {
      showToast('This browser blocks folder selection (common in Brave). Please use Chrome or Edge.', true);
      return;
    }
    try {
      const dirHandle = await showDirectoryPicker({ mode: 'readwrite' });
      const folderName = dirHandle.name;
      await chrome.storage.sync.set({ savedFolderName: folderName });
      $('#folderStatus').textContent = folderName;
      $('#folderStatus').classList.add('folder-selected');
      $('#folderHint').style.display = '';
      showToast('Folder set: ' + folderName);
    } catch (e) {
      if (e.name === 'AbortError') return;
      showToast('Failed to pick folder: ' + e.message, true);
    }
  });

  // ── Init ──────────────────────────────────────────────────────────
  populateForm();
  loadFolderStatus();
})();
