#!/usr/bin/env bash
# Build the Moodle Scraper distributable and refresh the landing-page download.
#
# The zip wraps everything in a single top-level "moodle-scraper/" folder so it
# extracts to ONE clean folder on every OS and tool — including WinRAR / 7-Zip
# "Extract Here", which otherwise spills the loose files into the current folder.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

VERSION="3.0.1"
ZIP="moodle-scraper-v${VERSION}.zip"

rm -f moodle-scraper-v*.zip

# Stage the extension under a folder literally named "moodle-scraper", then zip
# that folder so it becomes the archive's single top-level entry.
TMP="$(mktemp -d)"
cp -R bgu-moodle-sync-extension "$TMP/moodle-scraper"
( cd "$TMP" && zip -rX "$ROOT/$ZIP" moodle-scraper -x "*.DS_Store" -x "*/.DS_Store" >/dev/null )
rm -rf "$TMP"

cp "$ZIP" landing/assets/moodle-scraper.zip

echo "Built $ZIP ($(du -h "$ZIP" | cut -f1)) — top-level folder: moodle-scraper/ ; refreshed landing/assets/moodle-scraper.zip"
