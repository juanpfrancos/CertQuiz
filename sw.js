/* CertQuiz service worker.
 * - Precache of the app shell + banks listed in PRECACHE.
 * - Cache-first for the shell and banks; network-first (cache fallback) for dumps/index.json.
 * - files.zip is NEVER cached: requests go straight to the network.
 *
 * IMPORTANT: when you add a bank to /dumps, add it to PRECACHE and bump CACHE_NAME.
 */
const CACHE_NAME = 'CertQuiz-v2';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/components.css',
  './fonts/dm-sans.woff2',
  './fonts/space-grotesk.woff2',
  './fonts/jetbrains-mono.woff2',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/app.js',
  './js/core/EventBus.js',
  './js/banks/BankValidator.js',
  './js/banks/BankRepository.js',
  './js/banks/QuestionBank.js',
  './js/engine/Evaluator.js',
  './js/engine/TestBuilder.js',
  './js/engine/ExamSession.js',
  './js/storage/StorageAdapter.js',
  './js/storage/HistoryManager.js',
  './js/ui/Render.js',
  './js/ui/dom.js',
  './js/ui/components.js',
  './js/ui/Charts.js',
  './js/ui/HomeView.js',
  './js/ui/QuizView.js',
  './js/ui/ResultsView.js',
  './js/ui/HistoryView.js',
  './js/ui/SettingsView.js',
  './dumps/index.json',
  './dumps/dp700.json',
];

const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(scoped(p), { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, { store = false } = {}) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (store && res.ok) (await caches.open(CACHE_NAME)).put(request, res.clone());
  return res;
}

async function navigation(request) {
  const cached = await caches.match(request, { ignoreSearch: true }) || await caches.match(scoped('./index.html'));
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return new Response('<h1>Sin conexión</h1>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Source download: always network, never cached (no respondWith).
  if (url.pathname.endsWith('/files.zip')) return;

  if (url.pathname.endsWith('/dumps/index.json')) {
    event.respondWith(networkFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
  } else {
    // New banks discovered via index.json are cached on first use.
    event.respondWith(cacheFirst(request, { store: url.pathname.includes('/dumps/') }));
  }
});
