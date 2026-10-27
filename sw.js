/* Service Worker — Unit 5 English PWA
 * 每次更新 app 內容時，請把 VERSION 加 1，使用者端就會收到更新。
 */
const VERSION = 'v7';
const PRECACHE = `u5-precache-${VERSION}`;
const RUNTIME = `u5-runtime-${VERSION}`;

// 同源的 app shell（相對路徑，部署在子目錄如 GitHub Pages 也能運作）
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

// 跨網域的第三方資源（安裝時就預先快取，離線才能正常顯示樣式與圖示）
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await cache.addAll(APP_SHELL);
    // CDN 失敗不應該讓整個安裝失敗，逐一嘗試
    await Promise.all(CDN_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) await cache.put(url, res);
      } catch (_) { /* 之後執行期會再快取 */ }
    }));
    // 不自動 skipWaiting：由頁面的「更新」按鈕決定，避免使用者做題到一半被重整
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PRECACHE, RUNTIME]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 頁面導覽：network-first（有網路就拿最新版），失敗退回快取
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(PRECACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // 其餘資源（含 CDN、字型檔）：stale-while-revalidate
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const network = fetch(req).then(async (res) => {
        // 只快取成功回應；CDN 的 opaque 回應 (status 0) 也允許
        if (res && (res.ok || res.type === 'opaque')) {
          const cache = await caches.open(RUNTIME);
          cache.put(req, res.clone());
        }
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
  }
});
