/* 相遇图鉴 service worker: keeps the app usable offline.
 * - the files the app needs to start are saved when the worker is installed, so the app opens
 *   without a network from the second launch on (the first launch is the one that installs this)
 * - files of this app: network first, the saved copy when offline or slow; newer copies replace the saved ones
 * - the big recognition files (.onnx, .wasm, head) are left alone: the recognition worker keeps its own copy
 * - small reference pictures from the PokeAPI picture library: saved copy first
 * Only caches whose names start with "encdex-" are ever touched: other apps share this origin. */
var SHELL = 'encdex-shell-v1';
var SPRITES = 'encdex-sprites-v1';
var SCOPE = new URL(self.registration.scope).pathname;

var START = ['./', 'styles.css', 'dex.js', 'core.js', 'recog.js', 'app.js', 'recog-worker.js', 'ort.wasm.min.js',
  'manifest.webmanifest', 'num-600.woff2', 'num-700.woff2', 'favicon-32.png', 'icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (cache) {
    /* each file on its own: one that cannot be fetched must not stop the others */
    return Promise.all(START.map(function (f) {
      var url = new URL(f, self.registration.scope).href;
      return fetch(url, { cache: 'no-cache' }).then(function (resp) {
        if (resp && resp.ok && resp.type === 'basic') { return cache.put(url, resp); }
        return undefined;
      }).catch(function () { return undefined; });
    }));
  }).catch(function () { return undefined; }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k.indexOf('encdex-') === 0 && k !== SHELL && k !== SPRITES && k.indexOf('encdex-big-') !== 0;
    }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return caches.open(SHELL).then(function (cache) {
    var timer;
    var net = fetch(req).then(function (resp) {
      if (resp && resp.ok && resp.type === 'basic') { cache.put(req, resp.clone()).catch(function () {}); }
      return resp;
    });
    var slow = new Promise(function (ok) { timer = setTimeout(ok, 3500); }).then(function () { return cache.match(req, { ignoreSearch: true }); });
    return Promise.race([
      net.then(function (r) { clearTimeout(timer); return r; }),
      slow.then(function (hit) { return hit || net; })
    ]).catch(function () {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) { return hit; }
        if (req.mode === 'navigate') { return cache.match(SCOPE + 'index.html').then(function (h) { return h || cache.match(SCOPE); }); }
        return undefined;
      }).then(function (hit) { return hit || Response.error(); });
    });
  });
}
function cacheFirst(req) {
  return caches.open(SPRITES).then(function (cache) {
    return cache.match(req.url).then(function (hit) {
      if (hit) { return hit; }
      return fetch(req).then(function (resp) {
        if (resp && resp.ok && resp.type === 'cors') { cache.put(req.url, resp.clone()).catch(function () {}); }
        return resp;
      });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(SCOPE) !== 0) { return; }
    if (/\.(onnx|wasm)$/.test(url.pathname) || /\/recog-head-[^/]*\.bin$/.test(url.pathname)) { return; }
    e.respondWith(networkFirst(req));
  } else if (url.hostname === 'raw.githubusercontent.com' && url.pathname.indexOf('/PokeAPI/sprites/') === 0 && url.pathname.indexOf('official-artwork') < 0) {
    e.respondWith(cacheFirst(req));
  }
});
