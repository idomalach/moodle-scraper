# Libraries — Installed

Both libraries are now installed (real, not placeholders):

- `xlsx.full.min.js` — SheetJS v0.20.3 (~882KB)
- `jszip.min.js` — JSZip v3.10.1 (~98KB)

These are loaded by the engine via `ensureSheetJS()` and `ensureJSZip()`.
The engine tries the extension-bundled copy first, then falls back to CDN.

To update: run `npm install xlsx jszip` and copy from `node_modules/*/dist/`.
