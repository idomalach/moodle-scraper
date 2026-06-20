# Privacy Policy — Moodle Scraper

_Last updated: 2026-06-20_

Moodle Scraper is a browser extension that downloads your own university Moodle
course materials into a folder on your own computer. It is built to keep your
data on your device.

## What the extension accesses

- **Your Moodle pages.** When you start a sync, the extension reads the course
  pages and files of the courses you configured, using your existing logged-in
  Moodle session in the browser. It does this the same way your browser already
  does when you click a file in Moodle.
- **A local folder you choose.** Using the browser's File System Access API, the
  extension writes downloaded files into a folder you pick. It can only access
  the folder you explicitly grant.
- **Your settings.** Your configuration (university, semester, course list,
  folder name) is stored in the browser's extension storage so it persists
  between sessions. Detected course names are cached locally to power the setup
  screen.

## What the extension does NOT do

- It does **not** send your files, course data, credentials, or settings to any
  server. There is no backend. Nothing is uploaded anywhere.
- It does **not** collect analytics, telemetry, or tracking data.
- It does **not** read or store your Moodle username or password. It relies only
  on the session already active in your browser; it never asks for or handles
  your credentials.
- It does **not** share any data with third parties.

## Data storage

All data — downloaded files, settings, and cached course lists — stays on your
own computer (in your chosen folder and in the browser's local extension
storage). You can remove it at any time by deleting the files and removing the
extension.

## Permissions, explained

- `storage` — save your settings and detected-course cache locally.
- `activeTab` / `scripting` — inject the sync engine into the Moodle page you're
  on when you trigger a sync.
- `notifications` — show a desktop notification when a sync finishes.
- host permissions for `*.ac.il` Moodle domains — read your course pages and
  files during a sync.

## Contact

For questions about this policy, contact the developer at idomalach98@gmail.com.
