/* Service worker: мгновенная загрузка и работа офлайн.
   При изменении списка файлов увеличь VERSION. */
const VERSION = "v2";
const CACHE = `love-${VERSION}`;

const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png",
  ...[1, 2, 3, 4, 5].map(i => `./chi/${i}.webp`),
  ...[1, 2, 3, 4].map(i => `./gusto/${i}.webp`),
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("love-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  // HTML: сначала сеть (чтобы изменения появлялись сразу), офлайн — из кэша
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => { putInCache(request, res.clone()); return res; })
        .catch(() => caches.match(request).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Картинки, шрифты и прочее: из кэша мгновенно, обновление в фоне
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(res => { if (res.ok || res.type === "opaque") putInCache(request, res.clone()); return res; })
        .catch(() => cached);
      if (cached) { event.waitUntil(network); return cached; }
      return network;
    })
  );
});

function putInCache(request, response) {
  return caches.open(CACHE).then(cache => cache.put(request, response)).catch(() => {});
}
