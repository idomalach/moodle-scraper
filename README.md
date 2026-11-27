# Moodle Scraper

A Chrome extension that downloads all your Moodle course materials into organized folders on your own computer, in one click. It has presets for 28 Israeli universities and colleges (41 Moodle sites).

**[Chrome Web Store](https://chromewebstore.google.com/detail/cfmajooboiejfmgadecalaijpppnocbn)** · **[Website and install guide](https://moodle-scraper-il.pages.dev)**

## The problem

Students collect course files by hand, one by one, from pages that are organized differently in every course. It takes time, files get missed, and updates are easy to overlook.

## What it does

* Downloads lectures, exercises, assignments, exams and syllabi from your courses
* Organizes them into a folder per course, with clear names
* Merges numbered sections (for example "הרצאה 1" and "הרצאה 2") into one folder
* Splits assignments into exercises, your submissions and lecturer solutions, and removes duplicates by content
* Groups exam files by year, semester and exam round
* Fetches linked content too: Google Slides, Docs and Sheets, files inside folders, and ZIP archives
* Creates Excel status reports, including what could not be downloaded and why
* On later runs, downloads only new and updated files

Everything runs locally in the browser. There is no server and no tracking. See the [privacy policy](bgu-moodle-sync-extension/PRIVACY.md).

## My part

A solo project. I defined the product, built it with AI coding tools (Claude Code), tested it on real courses and published it to the Chrome Web Store, together with its website.

## Tools

JavaScript, Chrome Extension (Manifest V3), File System Access API, IndexedDB, JSZip, SheetJS, Cloudflare Pages, Claude Code

## Install from source

1. Open `chrome://extensions` and turn on **Developer mode**
2. Click **Load unpacked** and select the `bgu-moodle-sync-extension/` folder
3. Open your university's Moodle and log in
4. In the extension popup, open **הגדרות**, pick a download folder and confirm the detected courses
5. Click **הורדה ראשונית** for the first download, and **סנכרון** for later updates

## Repository layout

| Path | Purpose |
|---|---|
| `bgu-moodle-sync-extension/` | The extension |
| `bgu-moodle-sync-extension/engine/moodle_sync.js` | The download and organizing engine |
| `moodle_sync_spec.md` | Engine specification: rules, edge cases and safety rules |
| `moodle_israel_research.md` | Research on how Israeli Moodle sites differ |
| `landing/` | The website |
| `build.sh` | Builds the zip file for the store |

## Limitations

* Colab notebooks and Google Sites pages cannot be downloaded. They are listed in the Excel log
* RAR files are saved as they are
* Video links (YouTube, Zoom) are skipped

## License

Proprietary, all rights reserved. See [LICENSE](LICENSE).
