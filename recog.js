/* 相遇图鉴 recognition front end: starts the worker, prepares the picture, turns model output into scores. */
(function (root) {
  'use strict';
  var C = root.DexCore;

  var CFG = {
    cache: 'encdex-big-v1',
    worker: 'recog-worker.js',
    head: 'recog-head-1.bin',
    model: 'recog-model-1.onnx',
    ort: 'ort.wasm.min.js',
    wasm: 'ort-wasm-simd-1.18.0.wasm',
    wasmBytes: 10595041,
    runTimeout: 30000      /* ms; a photo normally takes about a second */
  };

  /* check: how close this device's answer to the built-in test picture is to the expected one
   * (1 = the same, -1 = not measured). Anything clearly below 1 means the device computes wrongly. */
  var st = { state: 'idle', loaded: 0, total: 0, message: '', ms: 0, check: -1 };
  var head = null, worker = null, subs = [], waiting = {}, seq = 0, startP = null;
  var shownAt = 0;      /* when the page last came (back) into view */
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { shownAt = Date.now(); } });
  }

  function status() {
    return { state: st.state, loaded: st.loaded, total: st.total, message: st.message, ms: st.ms, check: st.check, tag: head ? head.meta.tag : '', bb: head ? head.meta.bb || '' : '' };
  }
  function emit() { var s = status(); subs.slice().forEach(function (fn) { try { fn(s); } catch (e) { /* listener errors must not stop the model */ } }); }
  function on(fn) { subs.push(fn); return function () { var i = subs.indexOf(fn); if (i >= 0) { subs.splice(i, 1); } }; }
  function fail(msg) {
    st.state = 'error'; st.message = msg || '识别模型没能启动';
    Object.keys(waiting).forEach(function (k) { waiting[k].no(new Error(st.message)); });
    waiting = {};
    if (worker) { try { worker.terminate(); } catch (e) { /* already gone */ } worker = null; }
    emit();
  }

  /* Load the model (once). Safe to call again after an error. */
  function start() {
    if (st.state === 'ready' || st.state === 'loading') { return startP; }
    st.state = 'loading'; st.loaded = 0; st.total = 0; st.message = ''; st.check = -1;
    emit();
    var t0 = Date.now();
    startP = new Promise(function (ok) {
      try {
        worker = new Worker(CFG.worker);
      } catch (e) { fail('这个浏览器不能启动识别模型'); ok(false); return; }
      worker.onerror = function (e) { fail((e && e.message) || '识别模型没能启动'); ok(false); };
      worker.onmessage = function (e) {
        var m = e.data || {};
        if (m.type === 'head') {
          try { head = C.parseHead(m.buf); } catch (err) { fail('识别数据文件不对，请重新上传'); ok(false); }
        } else if (m.type === 'progress') {
          st.loaded = m.loaded; st.total = m.total; emit();
        } else if (m.type === 'ready') {
          if (!head) { fail('识别数据文件不对，请重新上传'); ok(false); return; }
          selfTest().then(function (score) {
            st.check = score; st.state = 'ready'; st.ms = Date.now() - t0; st.loaded = st.total; emit(); ok(true);
          }, function (err) {
            if (st.state === 'loading') { fail('识别模型运行不了：' + String((err && err.message) || err)); }
            ok(false);
          });
        } else if (m.type === 'error') {
          fail(m.message); ok(false);
        } else if (m.type === 'result' || m.type === 'fail') {
          var w = waiting[m.id];
          if (!w) { return; }
          delete waiting[m.id];
          if (m.type === 'fail') { w.no(new Error(m.message)); } else { w.ok(m); }
        }
      };
      worker.postMessage({
        type: 'init', cache: CFG.cache, head: CFG.head, model: CFG.model, ort: CFG.ort,
        wasm: CFG.wasm, wasmBytes: CFG.wasmBytes
      });
    });
    return startP;
  }

  /* Forget the downloaded files and load them again. */
  function reset() {
    if (worker) { try { worker.terminate(); } catch (e) { /* already gone */ } worker = null; }
    st.state = 'idle'; head = null; waiting = {};
    var p = (typeof caches !== 'undefined') ? caches.delete(CFG.cache).catch(function () { return false; }) : Promise.resolve(false);
    return p.then(function () { return start(); });
  }

  var scratch = null;
  /* iPhones keep the memory of a forgotten canvas for a long time: shrink working canvases to nothing when done */
  function release(c) { if (c) { c.width = 0; c.height = 0; } }
  /* A centred square region of `src` (canvas / image / video frame already squared),
   * scaled to size x size and normalised: Float32Array in channel-first order. */
  function tensorOf(src, crop, size, mean, std, out, offset) {
    var sw = src.width, sh = src.height, side = Math.min(sw, sh) * crop;
    var sx = (sw - side) / 2, sy = (sh - side) / 2;
    if (!scratch) { scratch = document.createElement('canvas'); }
    /* halve in steps before the final resize, otherwise fine detail turns into noise */
    var cur = src, cx = sx, cy = sy, cs = side, tmp = null;
    while (cs / 2 >= size * 1.5) {
      var half = Math.round(cs / 2);
      var next = document.createElement('canvas');
      next.width = half; next.height = half;
      var tctx = next.getContext('2d');
      tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(cur, cx, cy, cs, cs, 0, 0, half, half);
      release(tmp);
      tmp = next; cur = next; cx = 0; cy = 0; cs = half;
    }
    scratch.width = size; scratch.height = size;
    var ctx = scratch.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, cx, cy, cs, cs, 0, 0, size, size);
    release(tmp);
    var px = ctx.getImageData(0, 0, size, size).data, n = size * size;
    for (var i = 0, p = 0; i < n; i++, p += 4) {
      out[offset + i] = (px[p] / 255 - mean[0]) / std[0];
      out[offset + n + i] = (px[p + 1] / 255 - mean[1]) / std[1];
      out[offset + 2 * n + i] = (px[p + 2] / 255 - mean[2]) / std[2];
    }
  }

  /* one or more prepared pictures to the worker; resolves to its answer {dim, feats, ms} */
  function send(data, size) {
    var id = ++seq;
    return new Promise(function (ok, no) {
      /* no answer at all means the worker is stuck or gone: say so instead of waiting for ever.
       * fail() rejects every waiting picture and stops the worker; start() makes a new one. */
      var timer = arm(CFG.runTimeout);
      function arm(ms) {
        return setTimeout(function () {
          if (!waiting[id]) { return; }
          /* a phone pauses the page while the app is in the background: only time spent in view counts */
          var seen = Date.now() - shownAt;
          if (document.hidden || seen < CFG.runTimeout) { timer = arm(document.hidden ? CFG.runTimeout : CFG.runTimeout - seen); return; }
          fail('识别没有回应，已经停下');
        }, ms);
      }
      waiting[id] = {
        ok: function (m) { clearTimeout(timer); ok(m); },
        no: function (e) { clearTimeout(timer); no(e); }
      };
      worker.postMessage({ type: 'run', id: id, size: size, data: data }, [data.buffer]);
    });
  }
  /* The built-in test picture through the model, compared with the answer stored in the head file.
   * It also serves as the warm-up, so the first real photo is not slow. */
  function selfTest() {
    var meta = head.meta;
    return send(C.selfTestInput(meta.size, meta.mean, meta.std), meta.size).then(function (m) {
      return C.selfTestScore(meta, m.feats);
    });
  }

  /* Recognise the subject of a square picture.
   * Resolves to {logits: Float32Array(C), feat: Float32Array(D), sig: fingerprint, ms}.
   * feat is the mean of the crops' unit feature vectors: headLogits(head, feat) gives logits again. */
  function classify(src) {
    if (st.state !== 'ready' || !head) { return Promise.reject(new Error('识别模型还没准备好')); }
    var meta = head.meta, size = meta.size, crops = meta.crops && meta.crops.length ? meta.crops : [1];
    var per = 3 * size * size, data = new Float32Array(per * crops.length);
    for (var k = 0; k < crops.length; k++) { tensorOf(src, crops[k], size, meta.mean, meta.std, data, k * per); }
    return send(data, size).then(function (m) {
      var n = crops.length, D = m.dim, mean = new Float32Array(D);
      if (D !== head.D) { throw new Error('识别模型和数据文件版本不一致'); }
      for (var i = 0; i < n; i++) {
        var f = C.l2norm(m.feats.subarray(i * D, (i + 1) * D));
        for (var d = 0; d < D; d++) { mean[d] += f[d] / n; }
      }
      /* the head is linear, so scoring the mean feature equals averaging the crops' scores */
      var logits = C.headLogits(head, mean);
      return { logits: logits, feat: mean, sig: C.signature(logits), ms: m.ms };
    });
  }
  /* fingerprint for a stored feature vector (used after the head file was replaced by a newer one) */
  function sigOf(feat) { return head ? C.signature(C.headLogits(head, feat)) : null; }
  function classCount() { return head ? head.C : 0; }

  /* Short list of likely species for a classify() result. exemplars: [{sp, form, sig}] from earlier photos. */
  function rank(res, exemplars, limit) {
    var meta = head.meta;
    var probs = C.softmax(res.logits, meta.T || 1);
    return C.candidates(probs, meta.classes, {
      limit: limit || 6, exemplars: exemplars && exemplars.length ? exemplars : null, sig: res.sig,
      simHigh: meta.simHigh, simLow: meta.simLow
    });
  }

  /* below this the device is not computing what the model should compute (a healthy one gives 1.00) */
  var CHECK_OK = 0.98;
  function checkFailed(m) { m = m || st; return m.state === 'ready' && m.check >= 0 && m.check < CHECK_OK; }

  root.DexRecog = { CFG: CFG, start: start, reset: reset, status: status, on: on, classify: classify, rank: rank, sigOf: sigOf, classCount: classCount, tensorOf: tensorOf, checkFailed: checkFailed };
})(typeof self !== 'undefined' ? self : this);
