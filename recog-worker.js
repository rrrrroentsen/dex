/* 相遇图鉴 recognition worker: keeps the on-device model off the main thread.
 * Messages in:  {type:'init', head, model, ort, wasm, wasmBytes, cache}
 *               {type:'run', id, size, data: Float32Array (n * 3 * size * size)}
 * Messages out: {type:'head', buf} {type:'progress', loaded, total} {type:'ready', ms} {type:'error', message}
 *               {type:'result', id, dim, feats: Float32Array (n * dim), ms} {type:'fail', id, message} */
'use strict';

var session = null;
var inputName = '';
var outputName = '';

function post(m, transfer) { self.postMessage(m, transfer || []); }

/* Fetch a large file once and keep it in Cache Storage; later starts (and offline use) read the copy. */
function getBig(url, cacheName, expected, onChunk) {
  var cacheP = (typeof caches !== 'undefined' && cacheName) ? caches.open(cacheName).catch(function () { return null; }) : Promise.resolve(null);
  return cacheP.then(function (cache) {
    var hit = cache ? cache.match(url).catch(function () { return null; }) : Promise.resolve(null);
    return hit.then(function (resp) {
      if (resp) {
        return resp.arrayBuffer().then(function (buf) {
          if (!expected || buf.byteLength === expected) { onChunk(buf.byteLength); return buf; }
          return cache.delete(url).then(function () { return download(); });
        });
      }
      return download();
    });
    function download() {
      return fetch(url, { cache: 'no-cache' }).then(function (resp) {
        if (!resp.ok) { throw new Error('下载失败（' + resp.status + '）：' + url); }
        if (!resp.body || !resp.body.getReader) {
          return resp.arrayBuffer().then(function (buf) { onChunk(buf.byteLength); return buf; });
        }
        var reader = resp.body.getReader(), chunks = [], got = 0;
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              var out = new Uint8Array(got), o = 0;
              chunks.forEach(function (c) { out.set(c, o); o += c.length; });
              return out.buffer;
            }
            chunks.push(r.value); got += r.value.length; onChunk(r.value.length);
            return pump();
          });
        }
        return pump();
      }).then(function (buf) {
        if (expected && buf.byteLength !== expected) { throw new Error('文件不完整：' + url); }
        if (!cache) { return buf; }
        var copy = new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream', 'content-length': String(buf.byteLength) } });
        return cache.put(url, copy).then(function () { return buf; }, function () { return buf; });
      });
    }
  });
}

/* The model needs WebAssembly with SIMD (iPhone: iOS 16.4 or later). Same probe module ONNX Runtime uses. */
function simdOk() {
  try {
    return typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0,
      65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 186, 1, 26, 11]));
  } catch (e) { return false; }
}

/* ONNX Runtime fetches its wasm file by address. Answer that one request with the copy this worker
 * already holds (downloaded with progress, kept in Cache Storage), so it also works with no network.
 * Returns a function that puts the real fetch back. */
function serveFile(url, buf) {
  var real = self.fetch;
  self.fetch = function (input) {
    var u = typeof input === 'string' ? input : String((input && input.url) || input), abs = u;
    try { abs = new URL(u, self.location.href).href; } catch (e) { /* not an address: let the real fetch complain */ }
    if (abs === url) { return Promise.resolve(new Response(buf, { status: 200, headers: { 'content-type': 'application/wasm' } })); }
    return real.apply(self, arguments);
  };
  return function () { self.fetch = real; };
}

/* the file name ONNX Runtime 1.18 asks for when it runs single-threaded with SIMD */
var ORT_WASM = 'ort-wasm-simd.wasm';

function init(m) {
  var t0 = Date.now(), loaded = 0, total = 0, last = 0, restore = null;
  function onChunk(n) {
    loaded += n;
    var now = Date.now();
    if (total && (now - last > 120 || loaded >= total)) { last = now; post({ type: 'progress', loaded: Math.min(loaded, total), total: total }); }
  }
  if (!simdOk()) { throw new Error('这台设备不能在手机上识别（iPhone 需要 iOS 16.4 或更新，并且没有打开「锁定模式」）'); }
  importScripts(m.ort);
  /* One thread, on purpose: the single-thread build uses ordinary memory that grows as needed.
   * The multi-thread build asks for 4 GB of shared memory up front, which iPhones refuse ("Out of memory"). */
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  var wasmUrl = new URL(m.wasm, self.location.href).href, paths = {};
  paths[ORT_WASM] = wasmUrl;
  ort.env.wasm.wasmPaths = paths;
  /* the small head file comes first: it says how big the model is and which classes it knows */
  return getBig(m.head, m.cache, 0, function () {}).then(function (headBuf) {
    var dv = new DataView(headBuf), modelBytes = 0;
    try {
      var jl = dv.getUint32(4, true);
      var meta = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(headBuf, 8, jl)));
      modelBytes = meta.modelBytes || 0;
    } catch (e) { throw new Error('识别数据文件不对'); }
    total = headBuf.byteLength + (m.wasmBytes || 0) + modelBytes; loaded = headBuf.byteLength;
    post({ type: 'head', buf: headBuf }, [headBuf]);
    post({ type: 'progress', loaded: loaded, total: total });
    return getBig(m.wasm, m.cache, m.wasmBytes, onChunk).then(function (wasm) {
      restore = serveFile(wasmUrl, wasm);
      return getBig(m.model, m.cache, modelBytes, onChunk);
    });
  }).then(function (model) {
    return ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  }).then(function (s) {
    if (restore) { restore(); restore = null; }
    session = s; inputName = s.inputNames[0]; outputName = s.outputNames[0];
    /* the page now sends one fixed test picture: that checks the arithmetic and warms the model up */
    post({ type: 'ready', ms: Date.now() - t0 });
  });
}

function feed(data, size) {
  var o = {};
  o[inputName] = new ort.Tensor('float32', data, [1, 3, size, size]);
  return o;
}

function run(m) {
  if (!session) { return Promise.reject(new Error('model not ready')); }
  var size = m.size, per = 3 * size * size, n = Math.floor(m.data.length / per), t0 = Date.now(), out = null, i = 0;
  function next() {
    if (i >= n) {
      post({ type: 'result', id: m.id, dim: out.length / n, feats: out, ms: Date.now() - t0 }, [out.buffer]);
      return null;
    }
    return session.run(feed(m.data.subarray(i * per, (i + 1) * per), size)).then(function (r) {
      var f = r[outputName].data;
      if (!out) { out = new Float32Array(f.length * n); }
      out.set(f, i * f.length);
      i++;
      return next();
    });
  }
  return next();
}

self.onmessage = function (e) {
  var m = e.data || {};
  if (m.type === 'init') {
    Promise.resolve().then(function () { return init(m); }).catch(function (err) {
      post({ type: 'error', message: String((err && err.message) || err) });
    });
  } else if (m.type === 'run') {
    Promise.resolve().then(function () { return run(m); }).catch(function (err) {
      post({ type: 'fail', id: m.id, message: String((err && err.message) || err) });
    });
  }
};
