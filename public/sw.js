// Minimal service worker: enables PWA installability without caching
// anything. This app talks to a live local server and the Gemini API, so
// there's no meaningful "offline" mode to build here — the fetch handler
// exists only because installability requires one.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
