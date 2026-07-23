/*
  SERVICE WORKER — app shell caching
  ------------------------------------
  Caches the static files needed to load the app (HTML, CSS, JS, icons) so
  it opens even without a connection. Firestore's own SDK handles offline
  caching/sync for the actual recipe data separately (via IndexedDB) — this
  service worker deliberately doesn't touch those network calls, it only
  caches the static "shell" around them.
*/

const CACHE_NAME = "her-recipe-book-pwa-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/recipe-data.js",
  "./js/firebase-init.js",
  "./js/auth.js",
  "./js/recipe-crud.js",
  "./js/recipe-form.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle same-origin GET requests for the static app shell.
  // Firebase/Firestore calls go straight to the network, untouched.
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
