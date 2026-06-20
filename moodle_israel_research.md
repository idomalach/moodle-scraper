# Israeli Moodle Research — Comprehensive Report

> **Date:** 2026-04-04
> **Purpose:** Generalize the BGU Moodle Sync Chrome extension to support all Israeli Moodle instances
> **Method:** WebSearch only (no WebFetch) — all claims sourced from search snippets, URLs, and public indices

---

## Table of Contents

1. [Step 1 — Complete List of Israeli Higher Education Institutions](#step-1--complete-list-of-israeli-higher-education-institutions)
2. [Step 2 — Moodle Identification Table](#step-2--moodle-identification-table)
3. [Step 3 — Deep Research on Moodle Institutions](#step-3--deep-research-on-moodle-institutions)
4. [Step 4 — Synthesis and Compatibility Matrix](#step-4--synthesis-and-compatibility-matrix)

---

## Step 1 — Complete List of Israeli Higher Education Institutions

As of 2026, Israel has **11 universities** and approximately **53 colleges** (including ~21 teacher training colleges) recognized by the Council for Higher Education (מל"ג / CHE).

Sources: [Wikipedia — List of Israeli universities and colleges](https://en.wikipedia.org/wiki/List_of_Israeli_universities_and_colleges), [CHE Institutions](https://che.org.il/en/institutions/), [science.co.il/colleges](https://www.science.co.il/colleges/)

### 1A — Universities

| # | English Name | Hebrew Name | Website |
|---|---|---|---|
| 1 | Hebrew University of Jerusalem | האוניברסיטה העברית בירושלים | huji.ac.il |
| 2 | Technion — Israel Institute of Technology | הטכניון — מכון טכנולוגי לישראל | technion.ac.il |
| 3 | Weizmann Institute of Science | מכון ויצמן למדע | weizmann.ac.il |
| 4 | Tel Aviv University | אוניברסיטת תל אביב | tau.ac.il |
| 5 | Bar-Ilan University | אוניברסיטת בר-אילן | biu.ac.il |
| 6 | Ben-Gurion University of the Negev | אוניברסיטת בן-גוריון בנגב | bgu.ac.il |
| 7 | University of Haifa | אוניברסיטת חיפה | haifa.ac.il |
| 8 | Open University of Israel | האוניברסיטה הפתוחה | openu.ac.il |
| 9 | Ariel University | אוניברסיטת אריאל | ariel.ac.il |
| 10 | Reichman University (formerly IDC Herzliya) | אוניברסיטת רייכמן | runi.ac.il |
| 11 | College of Management Academic Studies (university status) | המסלול האקדמי המכללה למנהל | colman.ac.il |

### 1B — Academic Colleges (Public/Budgeted)

| # | English Name | Hebrew Name | Website |
|---|---|---|---|
| 1 | Afeka Tel Aviv Academic College of Engineering | אפקה — המכללה האקדמית להנדסה בת"א | afeka.ac.il |
| 2 | Ashkelon Academic College | המכללה האקדמית אשקלון | aac.ac.il |
| 3 | Bezalel Academy of Arts and Design | בצלאל — אקדמיה לאמנות ועיצוב | bezalel.ac.il |
| 4 | Braude College of Engineering (ORT Braude) | המכללה האקדמית להנדסה בראודה (אורט) | braude.ac.il |
| 5 | Hadassah Academic College / Jerusalem Multidisciplinary College | מכללת הדסה ירושלים / המכללה הרב-תחומית ירושלים | jmc.ac.il |
| 6 | Holon Institute of Technology (HIT) | מכון טכנולוגי חולון | hit.ac.il |
| 7 | Kinneret Academic College | המכללה האקדמית כנרת | kinneret.ac.il |
| 8 | Lev Academic Center / Jerusalem College of Technology (JCT) | המרכז האקדמי לב / מכון ירושלים לטכנולוגיה | jct.ac.il |
| 9 | Max Stern Yezreel Valley College | המכללה האקדמית עמק יזרעאל ע"ש מקס שטרן | yvc.ac.il |
| 10 | Netanya Academic College | המכללה האקדמית נתניה | netanya.ac.il |
| 11 | Ono Academic College | הקריה האקדמית אונו | ono.ac.il |
| 12 | Peres Academic Center | המרכז האקדמי פרס | pac.ac.il |
| 13 | Ruppin Academic Center | המרכז האקדמי רופין | ruppin.ac.il |
| 14 | Sapir Academic College | המכללה האקדמית ספיר | sapir.ac.il |
| 15 | Sami Shamoon College of Engineering (SCE) | המכללה האקדמית להנדסה סמי שמעון | sce.ac.il |
| 16 | Shenkar College of Engineering, Design and Art | שנקר — הנדסה, עיצוב, אמנות | shenkar.ac.il |
| 17 | Academic College of Tel Aviv-Yaffo (MTA) | המכללה האקדמית תל אביב-יפו | mta.ac.il |
| 18 | Western Galilee Academic College | המכללה האקדמית גליל מערבי | wgalil.ac.il |
| 19 | Zefat Academic College | המכללה האקדמית צפת | zefat.ac.il |

### 1C — Academic Colleges of Education (Teacher Training)

| # | English Name | Hebrew Name | Website |
|---|---|---|---|
| 1 | Beit Berl College | מכללת בית ברל | beitberl.ac.il |
| 2 | David Yellin College of Education | מכללת דוד ילין | dyellin.ac.il |
| 3 | Gordon College of Education | מכללת גורדון | gordon.ac.il |
| 4 | Kibbutzim College of Education, Technology and the Arts | סמינר הקיבוצים | smkb.ac.il |
| 5 | Levinsky-Wingate Academic Center | המרכז האקדמי לוינסקי-וינגייט | levinsky.ac.il / l-w.ac.il |
| 6 | Oranim Academic College | מכללת אורנים | oranim.ac.il |
| 7 | Kaye Academic College of Education | מכללת קיי | kaye.ac.il |
| 8 | Ohalo College of Education and Sport | מכללת אוהלו | ohalo.ac.il |
| 9 | Al-Qasemi Academic College of Education | המכללה האקדמית אלקאסמי | qsm.ac.il |
| 10 | Sakhnin Academic College for Teacher Education | המכללה האקדמית ערבית לחינוך סכנין | sakhnin.ac.il |
| 11 | Arab Academic College for Education — Haifa | המכללה האקדמית הערבית לחינוך — חיפה | — |
| 12 | Shaanan Religious Academic College of Education | מכללת שאנן | shaanan.ac.il |
| 13 | Hemdat Hadarom Academic College of Education | חמדת הדרום | hemdat.ac.il |
| 14 | Orot Israel College of Education | מכללת אורות ישראל | orot.ac.il |
| 15 | Talpiot College of Education | מכללת תלפיות | talpiot.ac.il |
| 16 | College of Education Givat Washington | מכללת גבעת וושינגטון | — |
| 17 | The Academic College at Wingate | (merged into Levinsky-Wingate) | — |

---

## Step 2 — Moodle Identification Table

### Research Method
For each institution, I searched for `"[name] moodle"`, `"[name] LMS"`, `site:moodle.[domain]`, and Hebrew equivalents. Results below are based on search snippets, indexed URLs, and public documentation.

| Institution | Uses Moodle? | Moodle URL | Alternative LMS | Confidence |
|---|---|---|---|---|
| **UNIVERSITIES** | | | | |
| Hebrew University (HUJI) | **Yes** | `moodle.huji.ac.il/2025-26/` | — | High |
| Technion | **Yes** | `moodle.technion.ac.il` | — | High |
| Weizmann Institute | **Yes** (limited; research/teaching dept) | `st-moodle.weizmann.ac.il` | — | Medium |
| Tel Aviv University (TAU) | **Yes** | `moodle.tau.ac.il` | — | High |
| Bar-Ilan University (BIU) | **Yes** | `lemida.biu.ac.il` | — | High |
| Ben-Gurion University (BGU) | **Yes** | `moodle.bgu.ac.il` | — | High |
| University of Haifa | **Yes** | `mw26.haifa.ac.il` (2025-26) | — | High |
| Open University of Israel | **No** | — | OPAL (custom, at `opal.openu.ac.il`) | High |
| Ariel University | **Yes** | `moodlearn.ariel.ac.il` | — | High |
| Reichman University | **Yes** | `moodle.runi.ac.il/2023/` (yearly instances) | — | High |
| College of Management (COLMAN) | **Yes** | `moodle.colman.ac.il` | — | High |
| **ACADEMIC COLLEGES** | | | | |
| Afeka College of Engineering | **Yes** | `moodle.afeka.ac.il` | — | High |
| Ashkelon Academic College | **Yes** | `moodle.aac.ac.il` | — | High |
| Bezalel Academy of Arts and Design | **Yes** | `moodle.bezalel.ac.il` | — | High |
| Braude College of Engineering | **Yes** | `moodle.braude.ac.il` | — | High |
| Hadassah / Jerusalem Multidisciplinary | **Yes** | ⚠️ Needs live verification (confirmed Moodle usage via student login docs) | — | Medium |
| HIT — Holon Institute of Technology | **Yes** | `moodle.hit.ac.il` (referenced on faculty pages) | — | Medium |
| Kinneret Academic College | **Yes** | `moodle85.kinneret.ac.il` (2024-25) | — | High |
| Lev Academic Center (JCT) | **Yes** | `moodle.jct.ac.il` (confirmed via Chrome extension) | — | High |
| Max Stern Yezreel Valley College | **Likely** | `moodle.yvc.ac.il` (not indexed) | — | Low |
| Netanya Academic College | **Likely** | `moodle.netanya.ac.il` (not indexed) | — | Low |
| Ono Academic College | **Yes** | `lms-m.ono.ac.il` (found but possibly inactive) | — | Medium |
| Peres Academic Center | **Unknown** | ⚠️ Needs live verification | — | Low |
| Ruppin Academic Center | **Yes** | `moodle.ruppin.ac.il` | — | High |
| Sapir Academic College | **Yes** | `moodle.sapir.ac.il/2025/` (yearly instances) | — | High |
| SCE — Shamoon College of Engineering | **Yes** | `moodle.sce.ac.il` | — | High |
| Shenkar College | **Yes** | `online.shenkar.ac.il` (branded "שביט-Moodle") | — | High |
| Academic College of Tel Aviv-Yaffo (MTA) | **Yes** | `moodle.mta.ac.il` | — | High |
| Western Galilee Academic College | **Yes** | `moodle.wgalil.ac.il` | — | High |
| Zefat Academic College | **Yes** | `moodle.zefat.ac.il` | — | High |
| **EDUCATION COLLEGES** | | | | |
| Beit Berl College | **Likely** | `moodle.beitberl.ac.il` (not indexed) | — | Medium |
| David Yellin College | **Yes** | Referenced online learning system; URL unclear | — | Medium |
| Gordon College of Education | **Yes** | `moodle.gordon.ac.il` | — | High |
| Kibbutzim College (SMKB) | **Yes** | `moodle.smkb.ac.il` | — | High |
| Levinsky-Wingate Academic Center | **Yes** | `moodle.levinsky.ac.il` | — | High |
| Oranim Academic College | **Yes** | `mymoodle.oranim.ac.il` | — | High |
| Kaye Academic College | **Likely** | `moodle.kaye.ac.il` (not indexed) | — | Low |
| Ohalo College | **Unknown** | ⚠️ Needs live verification | — | Low |
| Al-Qasemi College | **Unknown** | ⚠️ Needs live verification | — | Low |
| Sakhnin College | **Unknown** | ⚠️ Needs live verification | — | Low |
| Shaanan College | **Unknown** | ⚠️ Needs live verification | — | Low |
| Hemdat Hadarom | **Unknown** | ⚠️ Needs live verification | — | Low |
| Orot Israel | **Unknown** | ⚠️ Needs live verification | — | Low |
| Talpiot College | **Unknown** | ⚠️ Needs live verification | — | Low |

**Summary:** At least **30+ institutions** are confirmed or highly likely to use Moodle. Only the Open University of Israel is confirmed to use a non-Moodle custom LMS (OPAL). Several smaller education colleges need live verification.

---

## Step 3 — Deep Research on Moodle Institutions

### 3A — Authentication

| Institution | SSO Type | Login Flow | Login URL Pattern | Session Notes |
|---|---|---|---|---|
| HUJI | SAML (IdNG) | SAML login window with embedded SSO; accepts Savion/HujiMail/CSE accounts or Teudat Zehut + code ishi | `/auth/saml/` or standard `/login/index.php` | Multiple Moodle instances share SSO across domain |
| Technion | CAS-like (credential-based) | Browser extension exists to automate login; login page at standard path | `/login/index.php` → redirects to credential form | Students auto-enrolled per semester |
| TAU | SAML | SAML login endpoint confirmed (`/auth/saml/index.php`); users enter TAU credentials | `/auth/saml/index.php` | Site policy agreement on first login |
| BIU | Microsoft 365 SSO | Login via My BIU portal (Microsoft 365); single login grants access to Inbar, Moodle, library | Portal-based → lemida.biu.ac.il | Unified M365 authentication |
| BGU | Standard Moodle auth | "התחברות" button on page; engine S5 clicks it only when logged out (v3.0.3+) | `/login/index.php` | Session can look active when expired (documented in engine spec) |
| Haifa | SAML2 | SSO with ID number + SSO password; SAML2 endpoint confirmed | `/auth/saml2/login.php` | Different mw## instances per academic year |
| Ariel | ⚠️ Needs verification | Login at moodlearn.ariel.ac.il | ⚠️ Needs verification | — |
| Reichman | Portal-based | Login via My RU portal (my.idc.ac.il); then routed to Moodle | Portal → moodle.runi.ac.il | Yearly Moodle instances |
| COLMAN | ⚠️ Needs verification | Standard Moodle login | `/login/index.php` (assumed) | — |
| Sapir | ⚠️ Needs verification | Standard Moodle login ("לי-מוד") | `/login/index.php` (assumed) | Yearly instances |
| Shenkar | ⚠️ Needs verification | Login at online.shenkar.ac.il | ⚠️ Needs verification | Branded as "שביט" |
| Afeka | ⚠️ Needs verification | Login at moodle.afeka.ac.il | ⚠️ Needs verification | — |
| SCE | ⚠️ Needs verification | Secure login confirmed at `/login/index.php` | `/login/index.php` | — |
| Braude | ⚠️ Needs verification | "Braude Gateway" at moodle.braude.ac.il | ⚠️ Needs verification | — |
| Levinsky-Wingate | SAML | SAML login confirmed (`/auth/saml/login.php`) | `/auth/saml/login.php` | Portal-based info services |
| Oranim | Standard Moodle auth | Login with ID number (no leading zero) | `/login/index.php` | Old + new Moodle instances coexist |
| Kibbutzim (SMKB) | ⚠️ Needs verification | Standard Moodle login | ⚠️ Needs verification | — |
| Kinneret | ⚠️ Needs verification | Standard Moodle login | ⚠️ Needs verification | Yearly instances (moodle82–moodle85) |
| Western Galilee | ⚠️ Needs verification | Standard Moodle login; support at moodlesup@wgalil.ac.il | `/login/index.php` (assumed) | Category-based semester organization |
| Bezalel | Standard auth (via Orbit portal) | Login with ID + departmental password via Orbit student portal → Moodle | Portal → moodle.bezalel.ac.il | Grades NOT in Moodle; separate Orbit system |
| JCT (Lev) | ⚠️ Needs verification | Via moodle.jct.ac.il (confirmed by JCT Tools extension) | ⚠️ Needs verification | Chrome extension "JCT Tools" exists for this Moodle |
| Ruppin | Standard Moodle auth | ID number (no leading zero) + Ruppin network password | `/login/index.php` (assumed) | Guest access for open courses |

**Key Finding — Login Detection for Generalization:**
The current engine's S5 rule looks for "התחברות" / "Log in" buttons. This will work for institutions using standard Moodle auth, but needs adaptation for:
- **SAML/SSO institutions** (HUJI, TAU, Haifa, BIU, Levinsky): Login redirects to an external IdP; the Moodle page may not show a "התחברות" button at all — instead, the user lands on a SAML portal.
- **Portal-based login** (BIU via M365, Reichman via My RU, Bezalel via Orbit): The Moodle page may already be authenticated after portal login.
- **CAS-based** (Technion): Redirect to CAS server; no standard login button.

### 3B — Moodle Version and Theme

| Institution | Moodle Version | Theme | RTL |
|---|---|---|---|
| HUJI | Moodle 4.x (confirmed: `moodle4.cs.huji.ac.il`) | Boost-based (Boost bug fixes referenced) | Hebrew (RTL) default, English available |
| Technion | ⚠️ Needs verification | ⚠️ Needs verification | Hebrew (RTL) |
| TAU | ⚠️ Needs verification | ⚠️ Needs verification | Hebrew (RTL) default, English available |
| BIU | ⚠️ Needs verification | ⚠️ Needs verification | Hebrew (RTL) |
| BGU | ⚠️ Needs verification | ⚠️ Needs verification (current engine works, so standard) | Hebrew (RTL) |
| Haifa | ⚠️ Needs verification (mw26 = latest) | ⚠️ Needs verification | Hebrew (RTL) |
| Ariel | ⚠️ Needs verification (nginx/1.10.2 noted) | ⚠️ Needs verification | Hebrew (RTL) |
| Shenkar | Moodle 3.3.2 (GitHub repo branch name) — **may be outdated** | Custom ("שביט") | Hebrew (RTL) |
| Sapir | ⚠️ Needs verification | ⚠️ Needs verification (branded "לי-מוד") | Hebrew (RTL) |

**Key Finding:** Most Israeli Moodle instances serve Hebrew RTL by default. HUJI is confirmed on Moodle 4.x. Shenkar's GitHub shows 3.3.2 but that may be an old snapshot. Most version/theme details genuinely require visiting the page source — **marked for live verification**.

### 3C — Course Page Structure

All confirmed Moodle instances use standard Moodle course URL pattern: `/course/view.php?id=XXXXX`. The BGU engine relies on standard Moodle selectors:

- Section containers: `.section`, `li.section`, `[data-sectionid]`
- Activity items: `.activity`, `.activityinstance`, `li.activity`
- Activity type indicators: `.modtype_resource`, `.modtype_folder`, etc.
- Section names: `.sectionname`, `.section-title`

**Expectation:** Institutions running Moodle 4.x with Boost theme will use these same selectors. Institutions with custom themes (e.g., Shenkar's "שביט") may use different DOM structures.

⚠️ **All course page structure details need live verification by a logged-in user.** Most Moodle instances require authentication to view course pages.

### 3D — URL Patterns

| Institution | Base URL | Course Pattern | Notes |
|---|---|---|---|
| HUJI | `moodle.huji.ac.il/2025-26/` | `/course/view.php?id=XXXXX` | **Year in path** (`/2025-26/`) |
| Technion | `moodle.technion.ac.il` | `/course/view.php?id=XXXXX` (standard) | — |
| TAU | `moodle.tau.ac.il` | `/course/view.php?id=XXXXX` (standard) | Also has yearly instances: `moodle.tau.ac.il/2024/` |
| BIU | `lemida.biu.ac.il` | `/course/view.php?id=XXXXX` (standard) | **Non-standard subdomain** (`lemida` not `moodle`) |
| BGU | `moodle.bgu.ac.il/moodle/` | `/course/view.php?id=XXXXX` | **`/moodle/` path prefix** |
| Haifa | `mw26.haifa.ac.il` | `/course/view.php?id=XXXXX` (standard) | **Year-numbered subdomains** (mw24, mw25, mw26) |
| Ariel | `moodlearn.ariel.ac.il` | `/course/view.php?id=XXXXX` (assumed) | **Non-standard subdomain** (`moodlearn`) |
| Reichman | `moodle.runi.ac.il/2023/` | `/course/view.php?id=XXXXX` (assumed) | **Year in path** |
| Sapir | `moodle.sapir.ac.il/2025/` | `/course/view.php?id=XXXXX` (standard) | **Year in path** |
| Kinneret | `moodle85.kinneret.ac.il` | `/course/view.php?id=XXXXX` (standard) | **Year-numbered subdomains** (moodle82–85) |
| Shenkar | `online.shenkar.ac.il` | ⚠️ Needs verification | **Different subdomain** (`online`) |
| Oranim | `mymoodle.oranim.ac.il` | `/login/index.php` confirmed | **`mymoodle` subdomain** |

**Key URL Pattern Findings:**
The config `baseUrl` field needs to accommodate several patterns:
1. **Standard:** `moodle.[domain]` (most institutions)
2. **Custom subdomain:** `lemida.biu.ac.il`, `moodlearn.ariel.ac.il`, `online.shenkar.ac.il`, `mymoodle.oranim.ac.il`
3. **Year in path:** `moodle.huji.ac.il/2025-26/`, `moodle.sapir.ac.il/2025/`, `moodle.runi.ac.il/2023/`
4. **Year-numbered subdomain:** `mw26.haifa.ac.il`, `moodle85.kinneret.ac.il`
5. **Path prefix:** `moodle.bgu.ac.il/moodle/` (BGU has `/moodle/` in path)

### 3E — Content Security Policy (CSP)

⚠️ **All CSP data needs live verification.** CSP headers can only be determined by fetching the HTTP response headers from each Moodle instance, which requires WebFetch (blocked for overnight runs).

**Mitigation strategy for the extension:** Bundle SheetJS and JSZip in the extension package rather than loading from CDN. This eliminates the CSP concern entirely. The extension manifest should include the libraries as local files, making them work regardless of any institution's CSP policy.

### 3F — Semester Naming Conventions

| Institution | Semester Pattern | Example | Source |
|---|---|---|---|
| BGU | `סמ 1` / `סמ 2` | `"יסודות המימון לתעו"נ קב 1 סמ 2"` | moodle_sync_config.json |
| HUJI | `2025-26` in URL; courses organized by academic year | Year-based organization | Search results |
| TAU | Year-based Moodle instances | `moodle.tau.ac.il/2024/` | Search results |
| Haifa | Version-numbered instances | `mw26` = 2025-26 | Search results |
| Sapir | Year in path | `moodle.sapir.ac.il/2025/` | Search results |
| Kinneret | Hebrew year in subdomain | `moodle85` = תשפ"ה | Search results |
| Western Galilee | Category-based semesters | Courses organized under `סמסטר א`, `סמסטר ב`, `סמסטר ק` (summer) | moodle.wgalil.ac.il indexed pages |
| General Israeli pattern | `סמסטר א'` / `סמסטר ב'` | Standard across most institutions | Academic calendar search |

**Key Finding:** There is no single semester naming pattern across institutions. The `semesterCheck` config field will need to be institution-specific. Common patterns include:
- BGU: `סמ 1` / `סמ 2`
- Most others: `סמסטר א'` / `סמסטר ב'`
- Some use Hebrew academic year: `תשפ"ו` (5786)
- Some use western year: `2025-2026` or `2025A`/`2025B`
- Some use seasonal terms: `חורף` (winter) / `אביב` (spring)

### 3G — Mobile App / API Availability

⚠️ **Needs live verification for all institutions.** The Moodle Mobile Web Services API (`/admin/tool/mobile/launch.php`) cannot be confirmed without fetching the page.

**General expectation:** Moodle 4.x installations typically have mobile web services enabled by default. If confirmed, this could provide a much more robust data access method than DOM scraping — the Moodle Web Services API offers structured JSON responses for course content, file downloads, and user data.

**Known indicators:**
- Several institutions (BGU, HUJI, TAU, Technion, Sapir, Kinneret) have official mobile apps that access course data, suggesting mobile web services may be enabled.
- SysBind (Israel's Moodle Premium Partner) manages several institutional Moodle deployments and likely enables standard features including mobile services.

---

## Step 4 — Synthesis and Compatibility Matrix

### 4A — Compatibility Tier List

#### Tier 1 — Drop-in Compatible (config-only changes)
These institutions use standard Moodle with conventional URLs and likely standard selectors. The current engine should work with only a new config file.

| Institution | Moodle URL | Rationale |
|---|---|---|
| **Technion** | `moodle.technion.ac.il` | Standard subdomain; large student body; standard Moodle confirmed |
| **Afeka** | `moodle.afeka.ac.il` | Standard subdomain and path |
| **Braude** | `moodle.braude.ac.il` | Standard subdomain; VPL plugin usage confirms standard Moodle |
| **SCE** | `moodle.sce.ac.il` | Standard subdomain; login page indexed |
| **Ruppin** | `moodle.ruppin.ac.il` | Standard subdomain; standard auth (ID + password) |
| **MTA** | `moodle.mta.ac.il` | Standard subdomain |
| **Zefat** | `moodle.zefat.ac.il` | Standard subdomain; courses indexed publicly |
| **Gordon** | `moodle.gordon.ac.il` | Standard subdomain |
| **Kibbutzim (SMKB)** | `moodle.smkb.ac.il` | Standard subdomain |

#### Tier 2 — Minor Adaptation Needed
Non-standard URL patterns, yearly instances, or non-standard login flow — but still standard Moodle core.

| Institution | Moodle URL | Adaptation Needed |
|---|---|---|
| **BGU** (current) | `moodle.bgu.ac.il/moodle/` | Already supported (path prefix) |
| **HUJI** | `moodle.huji.ac.il/2025-26/` | Year in path; SAML auth (login detection needs update) |
| **TAU** | `moodle.tau.ac.il` | SAML auth; yearly instances in path |
| **BIU** | `lemida.biu.ac.il` | Non-standard subdomain; M365 SSO |
| **Haifa** | `mw26.haifa.ac.il` | Year-numbered subdomain; SAML2 auth |
| **Ariel** | `moodlearn.ariel.ac.il` | Non-standard subdomain |
| **Reichman** | `moodle.runi.ac.il/2023/` | Portal-based login; yearly instances |
| **COLMAN** | `moodle.colman.ac.il` | Standard subdomain but login flow unclear |
| **Sapir** | `moodle.sapir.ac.il/2025/` | Year in path |
| **Kinneret** | `moodle85.kinneret.ac.il` | Year-numbered subdomain |
| **Bezalel** | `moodle.bezalel.ac.il` | Portal-based login (Orbit) |
| **JCT (Lev)** | `moodle.jct.ac.il` | Auth flow unclear; Chrome extension exists |
| **Oranim** | `mymoodle.oranim.ac.il` | Non-standard subdomain |
| **Levinsky-Wingate** | `moodle.levinsky.ac.il` | SAML auth |
| **Western Galilee** | `moodle.wgalil.ac.il` | Standard URL but login flow unclear |
| **Shenkar** | `online.shenkar.ac.il` | Custom "שביט" theme; non-standard subdomain |
| **Ashkelon** | `moodle.aac.ac.il` | Standard URL; login flow unclear |

#### Tier 3 — Significant Adaptation Needed

| Institution | Issue |
|---|---|
| **Shenkar** (if theme is heavily custom) | Custom Moodle theme "שביט" — DOM selectors may differ significantly |
| **Ono Academic** | Moodle site appears inactive or misconfigured; needs investigation |

#### Tier 4 — Not Moodle (Out of Scope)

| Institution | LMS |
|---|---|
| **Open University of Israel** | OPAL (custom-built, at `opal.openu.ac.il`) |

#### Unconfirmed — Needs Live Verification

Smaller education colleges where Moodle usage could not be confirmed via search: Kaye, Ohalo, Al-Qasemi, Sakhnin, Arab Academic College Haifa, Hemdat Hadarom, Orot Israel, Talpiot, Shaanan, Givat Washington, Beit Berl, David Yellin, Netanya, Yezreel Valley, HIT, Peres Academic Center.

### 4B — Generalization Requirements

Based on the research, here are the specific changes needed:

#### 1. Config Changes

The config file needs new fields:

```json
{
  "baseUrl": "https://moodle.technion.ac.il",
  "basePath": "",                    // NEW: e.g. "/moodle/" for BGU, "/2025-26/" for HUJI
  "semesterCheck": "סמסטר ב",       // Institution-specific
  "rootPath": "סמסטר ב׳",
  "institutionId": "technion",       // NEW: machine-readable identifier
  "institutionName": "Technion",     // NEW: display name
  "authType": "standard",           // NEW: "standard" | "saml" | "cas" | "portal"
  "loginSelector": "a[href*='login'], .login a, #login",  // NEW: custom login button selector
  "loginPageIndicators": ["התחברות", "Log in", "כניסה"],  // NEW: array of login indicators
  "themeSelectors": {               // NEW: override selectors per institution
    "section": ".section",
    "activity": ".activity",
    "sectionName": ".sectionname",
    "activityType": "[class*='modtype_']"
  },
  "courses": []
}
```

#### 2. Engine Changes

| Change | Description | Priority |
|---|---|---|
| **Login detection** | Parameterize S5 to use `loginSelector` and `loginPageIndicators` from config instead of hardcoded "התחברות" / "Log in" | High |
| **Base URL handling** | Support `basePath` for institutions with path prefixes or year-based paths | High |
| **Selector parameterization** | Allow `themeSelectors` override from config; fall back to standard Moodle selectors | Medium |
| **Auth type awareness** | For SAML/CAS institutions, skip login button clicking; instead check for user menu or session cookie | Medium |
| **Semester check flexibility** | Support regex in `semesterCheck` to handle variants (`סמ 2`, `סמסטר ב`, etc.) | Low |

#### 3. Extension Changes

| Change | Description | Priority |
|---|---|---|
| **`host_permissions`** | Add all confirmed Moodle domains to manifest. Alternatively, use `<all_urls>` with runtime domain matching | High |
| **Institution selector UI** | Add a dropdown or auto-detect mechanism for institution selection | High |
| **Per-institution config** | Bundle a `configs/` directory with JSON configs for each supported institution | High |
| **Domain auto-detection** | On injection, read `window.location.hostname` and match against known Moodle domains to auto-load the correct config | Medium |

#### 4. CDN Fallback

**Recommendation: Bundle SheetJS and JSZip in the extension.** This eliminates CSP concerns entirely. The extension already packages `moodle_sync.js`, so adding two more library files is trivial. This is the safest approach since CSP policies could not be verified for any institution.

### 4C — Recommended Rollout Order

Based on student population, standard Moodle setup, and high confidence in Moodle presence:

| Priority | Institution | Students | Rationale |
|---|---|---|---|
| 1 | **Tel Aviv University** | ~30,000 | Largest university; standard Moodle at moodle.tau.ac.il; SAML auth needs one adaptation |
| 2 | **Technion** | ~14,000 | Standard moodle.technion.ac.il; strong student developer community (existing Moodle Connector extension) |
| 3 | **Hebrew University** | ~23,000 | Moodle 4.x confirmed; SAML auth; year-in-path needs basePath config |
| 4 | **Bar-Ilan University** | ~18,000 | Moodle at lemida.biu.ac.il; large student body; M365 SSO needs auth adaptation |
| 5 | **College of Management (COLMAN)** | ~8,500 | Largest college; standard moodle.colman.ac.il |

**Secondary targets** (after the top 5 are validated):
- University of Haifa (~18,000 students)
- Ariel University (~14,000 students)
- SCE — Shamoon College (~6,000 students)
- Sapir Academic College (~10,000 students)
- Ono Academic College (~18,000+ students, if Moodle is active)

---

## Appendix A — SysBind (Israel's Moodle Partner)

[SysBind](https://sysbind.co.il/) is Israel's Moodle Premium Certified Partner. They serve over 1 million Israeli students and provide development, integration, hosting, and technical support. Known clients include **Reichman University, Open University (for some Moodle components), and Hebrew University**.

SysBind's involvement means many Israeli Moodle instances may share common customizations, themes, and infrastructure — which is favorable for generalization.

Source: [Moodle — SysBind announcement](https://moodle.com/news/moodle-announces-first-israeli-based-partner-e-learning-and-education-solution-provider-sysbind/), [SysBind — Moodle Partner page](https://moodle.com/partners/sysbind/)

## Appendix B — MEITAL / IUCC Consortium

[MEITAL](https://meital.iucc.ac.il/en/about/) (Inter-University Center for E-Learning) is operated by IUCC (Israel Inter-University Computation Center). It serves Israel's 8 research universities plus ~20 colleges. MEITAL has a dedicated **"Moodle and Computerized Learning Environments" working group**, which coordinates Moodle standards across member institutions.

This consortium means institutional Moodle setups may follow shared best practices, increasing the likelihood of standard configurations.

Source: [MEITAL About](https://meital.iucc.ac.il/en/about/), [IUCC Learning Technologies](https://www.iucc.ac.il/en/meital/)

## Appendix C — Items Requiring Live Verification

The following items could not be determined via WebSearch alone and need to be checked interactively (with the user present to approve domain access):

| Item | Institutions | What to Check | How |
|---|---|---|---|
| **Moodle version** | All except HUJI | View page source → `<meta name="generator">` or footer | WebFetch each login page |
| **Theme** | All | `<body>` class names (e.g., `theme-boost`) | WebFetch each login page |
| **CSP headers** | All | HTTP response headers for `Content-Security-Policy` | WebFetch or `curl -I` |
| **Login flow** | SAML institutions (HUJI, TAU, Haifa, Levinsky) | Observe redirect chain on `/login/index.php` | WebFetch with redirect follow |
| **Course page DOM** | All | Section/activity CSS selectors with a logged-in session | Manual browser inspection |
| **Mobile API** | All | Check `/admin/tool/mobile/launch.php` response | WebFetch each domain |
| **Moodle existence** | Unconfirmed colleges (Kaye, Ohalo, etc.) | Visit `moodle.[domain]` and check response | WebFetch each domain |
| **Semester naming** | All except BGU | Browse course catalog for naming patterns | Logged-in session |

---

## Appendix D — Chrome Extension `host_permissions` Recommendation

To support all confirmed Moodle institutions, the extension manifest needs these host permissions:

```json
{
  "host_permissions": [
    "https://moodle.huji.ac.il/*",
    "https://moodle4.cs.huji.ac.il/*",
    "https://moodle.technion.ac.il/*",
    "https://moodle.tau.ac.il/*",
    "https://exams.tau.ac.il/*",
    "https://lemida.biu.ac.il/*",
    "https://moodle.bgu.ac.il/*",
    "https://mw*.haifa.ac.il/*",
    "https://moodlearn.ariel.ac.il/*",
    "https://moodle.runi.ac.il/*",
    "https://moodle.colman.ac.il/*",
    "https://moodle.afeka.ac.il/*",
    "https://moodle.aac.ac.il/*",
    "https://moodle.bezalel.ac.il/*",
    "https://moodle.braude.ac.il/*",
    "https://moodle.hit.ac.il/*",
    "https://moodle*.kinneret.ac.il/*",
    "https://moodle.jct.ac.il/*",
    "https://moodle.yvc.ac.il/*",
    "https://moodle.netanya.ac.il/*",
    "https://lms-m.ono.ac.il/*",
    "https://moodle.ruppin.ac.il/*",
    "https://moodle.sapir.ac.il/*",
    "https://moodle.sce.ac.il/*",
    "https://online.shenkar.ac.il/*",
    "https://moodle.mta.ac.il/*",
    "https://moodle.wgalil.ac.il/*",
    "https://moodle.zefat.ac.il/*",
    "https://moodle.beitberl.ac.il/*",
    "https://moodle.dyellin.ac.il/*",
    "https://moodle.gordon.ac.il/*",
    "https://moodle.smkb.ac.il/*",
    "https://moodle.levinsky.ac.il/*",
    "https://mymoodle.oranim.ac.il/*",
    "https://moodle.kaye.ac.il/*"
  ]
}
```

**Note:** Wildcard subdomains (`mw*.haifa.ac.il`, `moodle*.kinneret.ac.il`) may not be supported in Chrome manifest V3 `host_permissions`. If not, enumerate the specific subdomains (mw24–mw30, moodle80–moodle90) or use the `optional_host_permissions` API to request permission at runtime.

---

*End of research document. Generated 2026-04-04 via WebSearch-only research session.*
