const CACHE_VERSION = 'v5';
const SHELL_CACHE = 'glint-shell-v5';
const CDN_CACHE = 'glint-cdn-v5';

const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/styles/tailwind.css',
  '/styles/layers.css',
  '/styles/theme.css',
  '/styles/layout.css',
  '/styles/components.css',
  '/db/schema.js',
  '/db/connection.js',
  '/db/projects.js',
  '/db/demos.js',
  '/db/assets.js',
  '/db/settings.js',
  '/db/search.js',
  '/store/app-state.js',
  '/utils/id.js',
  '/utils/icons.js',
  '/utils/i18n.js',
  '/utils/base64.js',
  '/utils/storage-estimate.js',
  '/utils/date.js',
  '/utils/zip.js',
  '/utils/file-resolver.js',
  '/components/app.js',
  '/components/sidebar.js',
  '/components/header.js',
  '/components/home-view.js',
  '/components/project-view.js',
  '/components/demo-view.js',
  '/components/demo-editor.js',
  '/components/preview-panel.js',
  '/components/search-overlay.js',
  '/components/import-export.js',
  '/components/storage-indicator.js',
  '/components/theme-toggle.js',
  '/components/tag-input.js',
  '/components/modal.js',
  '/components/toast.js',
];

// Only cdn.jsdelivr.net remains (for fflate, loaded on demand for import/export)
const CDN_ORIGINS = ['https://cdn.jsdelivr.net'];

// Install: precache all shell files
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then(function (cache) {
        return Promise.allSettled(
          SHELL_FILES.map(function (url) {
            return cache.add(url).catch(function (err) {
              console.warn('[SW] Failed to cache:', url, err);
            });
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

// Activate: delete stale glint- caches, claim clients
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key.startsWith('glint-') && key !== SHELL_CACHE && key !== CDN_CACHE) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// Fetch: route by strategy
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  var url = new URL(request.url);

  // CDN resources: stale-while-revalidate
  var isCDN = CDN_ORIGINS.some(function (origin) {
    return url.origin === origin || request.url.startsWith(origin);
  });

  if (isCDN) {
    event.respondWith(
      caches.open(CDN_CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
          var fetchPromise = fetch(request)
            .then(function (response) {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(function () {
              return cached;
            });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Navigation requests: cache-first with /index.html fallback (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(SHELL_CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
          if (cached) return cached;
          return fetch(request)
            .then(function (response) {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(function () {
              return cache.match('/index.html');
            });
        });
      })
    );
    return;
  }

  // Same-origin requests: cache-first from SHELL_CACHE, on miss fetch+cache+respond
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(function (cache) {
        return cache.match(request).then(function (cached) {
          if (cached) return cached;
          return fetch(request).then(function (response) {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // All others: pass through
});
