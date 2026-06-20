#!/usr/bin/env bash
# Build the Moodle Scraper distributable and refresh the landing-page download.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="3.0.1"
ZIP="moodle-scraper-v${VERSION}.zip"

rm -f moodle-scraper-v*.zip
( cd bgu-moodle-sync-extension && zip -rX "../$ZIP" . -x "*.DS_Store" -x "*/.DS_Store" >/dev/null )
cp "$ZIP" landing/assets/moodle-scraper.zip

echo "Built $ZIP ($(du -h "$ZIP" | cut -f1)) and refreshed landing/assets/moodle-scraper.zip"
