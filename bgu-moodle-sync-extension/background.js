/**
 * Moodle Sync — Background Service Worker (MV3)
 *
 * Single job: perform CROSS-ORIGIN fetches that the in-page engine can't.
 * The engine (page main world) is CORS-blocked from fetching other origins —
 * notably the BGU bgu4u syllabus portal. The background worker, granted
 * host_permissions, fetches such URLs with the user's existing session
 * (credentials included) and returns the bytes base64-encoded.
 *
 * Flow: engine → window.postMessage → content.js → chrome.runtime.sendMessage
 *       → here → fetch → base64 → back up the chain.
 */

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000; // avoid call-stack limits on large files
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'xfetch' || !msg.url) return; // not ours

  (async () => {
    try {
      const resp = await fetch(msg.url, { credentials: 'include', redirect: 'follow' });
      const contentType = resp.headers.get('content-type') || '';
      const buf = await resp.arrayBuffer();
      sendResponse({
        ok: resp.ok,
        status: resp.status,
        contentType,
        dataB64: arrayBufferToBase64(buf),
      });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();

  return true; // keep the message channel open for the async sendResponse
});
