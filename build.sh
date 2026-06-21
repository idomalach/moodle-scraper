#!/usr/bin/env bash
# Build the Moodle Scraper distributable — a SINGLE zip used for BOTH the
# Chrome Web Store upload and the website's manual-install download.
#
# manifest.json sits at the ROOT of the archive: the Chrome Web Store requires
# this and rejects a wrapper folder ("Manifest file is missing or unreadable").
# Because the file is named moodle-scraper.zip, the default extractors on
# Windows ("Extract All") and macOS (Archive Utility) still produce a single
# clean "moodle-scraper/" folder — exactly what chrome://extensions
# "Load unpacked" needs. (Only WinRAR/7-Zip "Extract Here" spills loose files;
# that is a deliberate power-user action on the secondary manual-install path.)
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

VERSION="3.0.3"
ZIP="moodle-scraper-v${VERSION}.zip"

# Clean previous builds (incl. the retired separate store zip).
rm -f moodle-scraper-v*.zip moodle-scraper-store-v*.zip

# Zip the CONTENTS of the extension folder so manifest.json lands at the archive root.
( cd bgu-moodle-sync-extension && zip -rX "$ROOT/$ZIP" . -x "*.DS_Store" -x "*/.DS_Store" >/dev/null )

cp "$ZIP" landing/assets/moodle-scraper.zip

echo "Built $ZIP ($(du -h "$ZIP" | cut -f1)) — manifest.json at root (store-ready); refreshed landing/assets/moodle-scraper.zip"
