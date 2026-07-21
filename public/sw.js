// Minimal service worker — exists to satisfy PWA installability.
// All data lives in IndexedDB; no offline caching of app code (dev-friendly).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // pass-through
});
