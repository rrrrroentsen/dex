/* 相遇图鉴 (Encounter Dex) user interface. Built from src/ by dev/build.js: edit the pieces there, not this file. */
(function () {
'use strict';

/* ---- 10-base: helpers, state, storage -------------------------------------------------- */
var C = window.DexCore, R = window.DexRecog;
var doc = document;
var ENV = window.ENCDEX_ENV || {};

function $(sel, root) { return (root || doc).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

var ICON = {
  back: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  x: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  chev: '<svg class="ic chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  cam: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><circle cx="12" cy="12" r="3.2"/></svg>',
  album: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.5-4 3.5 3 3-2.5 4 3.5"/></svg>',
  phone: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.3-2h6.4l1.3 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.3"/></svg>',
  flip: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a7 7 0 0 1 12.5-2.5L19 8M19 4v4h-4M19 15a7 7 0 0 1-12.5 2.5L5 16M5 20v-4h4"/></svg>',
  filter: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  trash: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  edit: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l1-4L16.5 4.5l3 3L9 18z"/></svg>',
  down: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
  up: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5M7 9l5-5 5 5M5 20h14"/></svg>',
  shot: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/></svg>',
  redo: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h9.500a4.500 4.500 0 0 1 0 9H9M5 10l4-4M5 10l4 4"/></svg>',
  swap: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8.500h13l-3.500-3.500M19 15.500H6l3.500 3.500"/></svg>',
  exit: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.500 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3.500M14 8l4 4-4 4M18 12H9.500"/></svg>',
  book: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.500h11.500A2.500 2.500 0 0 1 19 7v12.500H7.500A2.500 2.500 0 0 1 5 17z"/><path d="M5 17a2.500 2.500 0 0 1 2.500-2.500H19"/><path d="M9 8.500h6"/></svg>',
  wait: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.500" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="17.500" cy="12" r="1.300" fill="currentColor"/></svg>'
};

/* ---------------------------------------------------------------- state */

var PREF_KEY = 'encdex:v1:prefs';
var DEF_PREFS = { theme: 'auto', cam: 'live', sprites: true, auto: true };
var S = {
  ready: false, dbOk: true,
  enc: [], st: null, byId: {},
  prefs: loadPrefs(),
  tab: 'home', page: null, scrollMemo: {},
  mine: { tab: 'have', sort: 'recent', shown: 60 },
  nat: { status: 'all', gen: 0, type: -1, kind: '', q: '', shown: 150 },
  ex: null,           /* confirmed photos as recognition examples: [{id, sp, form, f}] */
  model: { state: 'idle', loaded: 0, total: 0, message: '' },
  usage: null
};

function loadPrefs() {
  var p = {};
  try { p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch (e) { p = {}; }
  var out = {};
  out.theme = p.theme === 'light' || p.theme === 'dark' ? p.theme : 'auto';
  out.cam = p.cam === 'system' ? 'system' : 'live';
  out.sprites = p.sprites !== false;
  out.auto = p.auto !== false;
  return out;
}
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(S.prefs)); } catch (e) { /* private mode: keep in memory */ }
}
function applyTheme() {
  var t = S.prefs.theme;
  if (t === 'auto') { doc.documentElement.removeAttribute('data-theme'); }
  else { doc.documentElement.setAttribute('data-theme', t); }
}

/* --------------------------------------------------------------- storage */

var DB_NAME = 'encdex', DB_VER = 1, db = null;
function dbOpen() {
  return new Promise(function (ok, no) {
    var req;
    try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { no(e); return; }
    req.onupgradeneeded = function () {
      var d = req.result;
      if (!d.objectStoreNames.contains('enc')) { d.createObjectStore('enc', { keyPath: 'id' }); }
      ['photo', 'thumb', 'feat'].forEach(function (n) { if (!d.objectStoreNames.contains(n)) { d.createObjectStore(n); } });
    };
    req.onsuccess = function () { db = req.result; db.onversionchange = function () { db.close(); }; ok(db); };
    req.onerror = function () { no(req.error || new Error('indexedDB')); };
    req.onblocked = function () { no(new Error('indexedDB blocked')); };
  });
}
/* without IndexedDB (private browsing) records are kept in memory so the app can still be tried */
var MEM = { enc: {}, photo: {}, thumb: {}, feat: {} };
function memTx() {
  return { objectStore: function (n) {
    return {
      put: function (v, k) { MEM[n][k === undefined ? v.id : k] = v; },
      delete: function (k) { delete MEM[n][k]; },
      clear: function () { MEM[n] = {}; }
    };
  } };
}
function dbTx(stores, mode, fn) {
  if (!db) {
    try { return Promise.resolve(fn(memTx())); } catch (e) { return Promise.reject(e); }
  }
  return new Promise(function (ok, no) {
    var tx, out;
    try { tx = db.transaction(stores, mode); } catch (e) { no(e); return; }
    tx.oncomplete = function () { ok(out); };
    tx.onerror = function () { no(tx.error || new Error('transaction failed')); };
    tx.onabort = function () { no(tx.error || new Error('transaction aborted')); };
    try { out = fn(tx); } catch (e) { try { tx.abort(); } catch (e2) { /* already closed */ } no(e); }
  });
}
function reqP(r) { return new Promise(function (ok, no) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
function dbGet(store, key) {
  if (!db) { return Promise.resolve(MEM[store][key]); }
  return new Promise(function (ok, no) {
    var r;
    try { r = db.transaction(store, 'readonly').objectStore(store).get(key); } catch (e) { no(e); return; }
    r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); };
  });
}
function dbAll(store) {
  if (!db) { return Promise.resolve(Object.keys(MEM[store]).map(function (k) { return { key: k, value: MEM[store][k] }; })); }
  return new Promise(function (ok, no) {
    var out = [], r;
    try { r = db.transaction(store, 'readonly').objectStore(store).openCursor(); } catch (e) { no(e); return; }
    r.onsuccess = function () { var c = r.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else { ok(out); } };
    r.onerror = function () { no(r.error); };
  });
}

function setEncs(list) {
  S.enc = list;
  S.byId = {};
  list.forEach(function (e) { S.byId[e.id] = e; });
  S.st = C.stats(list, Date.now());
}

/* pictures live in IndexedDB as raw bytes; pages show them through object URLs */
var urlMemo = {}, urlOrder = [];
function blobUrl(store, id) {
  var key = store + ':' + id;
  if (urlMemo[key]) { return Promise.resolve(urlMemo[key]); }
  return dbGet(store, id).then(function (rec) {
    if (!rec || !rec.b) { return ''; }
    if (urlMemo[key]) { return urlMemo[key]; }
    var type = C.imageType(new Uint8Array(rec.b, 0, Math.min(16, rec.b.byteLength))) || 'image/jpeg';
    var u = URL.createObjectURL(new Blob([rec.b], { type: type }));
    urlMemo[key] = u; urlOrder.push(key);
    while (urlOrder.length > 420) { var old = urlOrder.shift(); if (urlMemo[old]) { URL.revokeObjectURL(urlMemo[old]); delete urlMemo[old]; } }
    return u;
  }).catch(function () { return ''; });
}
function dropUrls(id) {
  ['thumb:' + id, 'photo:' + id].forEach(function (k) { if (urlMemo[k]) { URL.revokeObjectURL(urlMemo[k]); delete urlMemo[k]; } });
}
/* fill <img data-th="id"> (small) and <img data-ph="id"> (full) */
function hydrate(root) {
  $$('img[data-th]:not([src]), img[data-ph]:not([src])', root || doc).forEach(function (img) {
    var id = img.getAttribute('data-th'), store = 'thumb';
    if (!id) { id = img.getAttribute('data-ph'); store = 'photo'; }
    blobUrl(store, id).then(function (u) {
      if (u) { img.src = u; }
      else if (store === 'photo') { blobUrl('thumb', id).then(function (u2) { if (u2) { img.src = u2; } }); }
    });
  });
}

/* ------------------------------------------------- reference pictures */

var SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
function spriteUrl(entry) { return SPRITE_BASE + entry + '.png'; }
/* reference picture of a species / form (a small pixel drawing), or a placeholder tile when pictures are off or fail to load */
function refImg(sp, formId) {
  var entry = formId || sp;
  if (!S.prefs.sprites) { return '<span class="ph">?</span>'; }
  return '<img alt="" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1" src="' + esc(spriteUrl(entry)) + '">';
}
doc.addEventListener('error', function (e) {
  var t = e.target;
  if (!t || t.tagName !== 'IMG' || !t.hasAttribute('data-fb')) { return; }
  var ph = doc.createElement('span');
  ph.className = 'ph'; ph.textContent = '?';
  if (t.parentNode) { t.parentNode.replaceChild(ph, t); }
}, true);

function typeChips(sp, formId) {
  return C.typesOf(sp, formId).map(function (t) { return '<i class="ty ty-' + t.key + '">' + esc(t.zh) + '</i>'; }).join('');
}

/* ------------------------------------------------------- the machine */

/* a key on one of the decks: a cap with a picture on it and a label printed underneath.
 * o: {big, id, cls, off (cannot be pressed), label (for screen readers, when it says more than the text)} */
function keyHtml(act, icon, text, o) {
  o = o || {};
  return '<button class="key' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + (act ? ' data-act="' + act + '"' : '') +
    (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.off ? ' disabled' : '') + '>' +
    '<span class="kc' + (o.big ? ' big' : '') + '">' + icon + '</span><span class="kl">' + esc(text) + '</span></button>';
}
/* the small window on the top deck: a lamp for the recogniser, and how many species are in so far */
function deckSync() {
  var lamp = $('#lamp'), n = $('#lcdN'), m = S.model;
  if (lamp) {
    lamp.className = 'lamp' + (!S.prefs.auto ? '' : R.checkFailed(m) || m.state === 'error' ? ' bad' : m.state === 'ready' ? ' ok' : m.state === 'loading' ? ' busy' : '');
  }
  if (n && S.st) { n.textContent = C.pad4(S.st.species); }
}

/* ------------------------------------------------------------ small ui */

var toastTimer = 0, toastFn = null;
function toast(msg, action, fn, ms) {
  var el = $('#toast');
  clearTimeout(toastTimer);
  toastFn = fn || null;
  el.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<button data-act="toast-act">' + esc(action) + '</button>' : '');
  el.hidden = false;
  toastTimer = setTimeout(function () { el.hidden = true; toastFn = null; }, ms || (action ? 6000 : 2600));
}

/* layers: anything that the back gesture should close (detail page, sheet, camera) */
var layers = [], skipPop = 0;
function pushLayer(kind, close) {
  layers.push({ kind: kind, close: close });
  try { history.pushState({ encdex: layers.length }, ''); } catch (e) { /* history not available: the close buttons still work */ }
}
function popLayer() {
  if (!layers.length) { return; }
  var l = layers.pop();
  skipPop++;
  try { history.back(); } catch (e) { skipPop--; }
  l.close();
  setTimeout(function () { if (skipPop > 0) { skipPop--; } }, 600);
}
window.addEventListener('popstate', function () {
  if (skipPop > 0) { skipPop--; return; }
  var l = layers.pop();
  if (l) { l.close(); }
});
function topLayer() { return layers.length ? layers[layers.length - 1].kind : ''; }

var sheetReturn = null;
function openSheet(title, html, cls) {
  var host = $('#sheetHost');
  if (!host.hidden) { host.innerHTML = ''; } else { sheetReturn = doc.activeElement; pushLayer('sheet', hideSheet); }
  host.innerHTML = '<div class="sheet ' + (cls || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<div class="sheet-h"><h2>' + esc(title) + '</h2><button class="sheet-x" data-act="sheet-close" aria-label="关闭">' + ICON.x + '</button></div>' +
    '<div class="sheet-b" id="sheetBody">' + html + '</div></div>';
  host.hidden = false;
  doc.body.classList.add('lock');
  hydrate(host);
  var x = $('.sheet-x', host);
  if (x) { try { x.focus({ preventScroll: true }); } catch (e) { x.focus(); } }
}
function hideSheet() {
  var host = $('#sheetHost');
  host.hidden = true; host.innerHTML = '';
  if ($('#cam').hidden) { doc.body.classList.remove('lock'); }
  if (sheetReturn && sheetReturn.focus && doc.body.contains(sheetReturn)) { try { sheetReturn.focus({ preventScroll: true }); } catch (e) { /* element gone */ } }
  sheetReturn = null;
}
function closeSheet() { if (topLayer() === 'sheet') { popLayer(); } }

/* ---------------------------------------------------------- date text */

function fmtDay(key, now) {
  var today = C.dayKey(now || Date.now());
  var diff = C.dayNum(today) - C.dayNum(key);
  if (diff === 0) { return '今天'; }
  if (diff === 1) { return '昨天'; }
  var p = key.split('-');
  return (p[0] === today.slice(0, 4) ? '' : p[0] + ' 年 ') + (+p[1]) + ' 月 ' + (+p[2]) + ' 日';
}
function fmtTime(ms) { var d = new Date(ms); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }
function fmtMonth(key) { var p = key.split('-'); return p[0] + ' 年 ' + (+p[1]) + ' 月'; }
function weekday(key) { var p = key.split('-'); return '周' + '日一二三四五六'.charAt(new Date(+p[0], +p[1] - 1, +p[2]).getDay()); }
function fmtBytes(n) {
  if (!(n > 0)) { return '0 MB'; }
  if (n < 1048576) { return Math.max(1, Math.round(n / 1024)) + ' KB'; }
  return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
}
function encMeta(e) {
  var bits = [];
  if (e.cat && C.CAT_ZH[e.cat]) { bits.push(C.CAT_ZH[e.cat]); }
  if (e.place) { bits.push(e.place); }
  return bits;
}

/* ---- 20-views: pages ------------------------------------------------------------------- */

function pctText(p) {
  var v = p * 100;
  if (v === 0) { return '0%'; }
  if (v >= 100) { return '100%'; }
  return (v < 10 ? v.toFixed(1) : v.toFixed(0)) + '%';
}
function forecastHtml(f) {
  if (f.status === 'done') { return '全部 <b>' + C.TOTAL + '</b> 种都收集到了，了不起！'; }
  if (f.status === 'empty') { return '拍下遇到的第一只，图鉴就开始点亮了。'; }
  if (f.status === 'early') {
    if (f.daysLeft > 0) { return '再记录 <b>' + f.daysLeft + '</b> 天，就能估算哪天集齐。'; }
    return '再收集 <b>' + f.need + '</b> 种，就能估算哪天集齐。';
  }
  if (f.status === 'stalled') { return '最近 ' + f.window + ' 天没有新发现，出门转转？'; }
  var pace = f.perWeek >= 10 ? Math.round(f.perWeek) : Math.round(f.perWeek * 10) / 10;
  var head = '照最近 ' + f.window + ' 天的速度（每周约 ' + pace + ' 种新的），';
  if (f.far) { return head + '还要一百年以上。多出门转转吧。'; }
  var p = f.date.split('-');
  var when = f.days <= 90 ? (+p[1]) + ' 月 ' + (+p[2]) + ' 日前后' : p[0] + ' 年 ' + (+p[1]) + ' 月';
  return head + '预计 <b>' + when + '</b> 集齐。';
}

function topHome() {
  var st = S.st, r = 46, len = 2 * Math.PI * r;
  var off = len * (1 - Math.min(1, st.pct));
  var today = C.dayKey(Date.now()), dp = today.split('-');
  return '<div class="top-row"><span class="kick">01</span><h1>总览</h1><span class="top-sub" id="topDate">' + (+dp[1]) + ' 月 ' + (+dp[2]) + ' 日 ' + weekday(today) + '</span></div>' +
    '<div class="hero">' +
      '<div class="ring" role="img" aria-label="完成度 ' + pctText(st.pct) + '"><svg viewBox="0 0 112 112"><circle class="trk" cx="56" cy="56" r="' + r + '"/>' +
      '<circle class="val" cx="56" cy="56" r="' + r + '" stroke-dasharray="' + len.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/></svg>' +
      '<div class="ring-c"><div class="ring-pct">' + pctText(st.pct) + '</div><div class="ring-l">完成度</div></div></div>' +
      '<div class="hero-t"><div class="hero-n" id="heroN">' + st.species + '<small>/ ' + C.TOTAL + '</small></div>' +
      '<div class="hero-l">已收集的种类' + (st.species ? '，还差 ' + (C.TOTAL - st.species) + ' 种' : '') + '</div></div>' +
    '</div>' +
    '<p class="hero-f" id="heroF">' + forecastHtml(st.forecast) + '</p>';
}

function modelCard() {
  var m = S.model;
  if (R.checkFailed(m)) {
    return '<section class="sec"><div class="card pad" id="modelWarn"><b>识别模型的自检没有通过</b><p class="hint" style="margin-top:4px">这台设备算出来的结果和应有的不一样（相似度 ' +
      m.check.toFixed(2) + '，应该是 1.00），给出的候选可能不准。照样可以拍照、手动搜名字。反馈问题时请带上这句话。</p></div></section>';
  }
  if (m.state === 'ready' || m.state === 'idle') { return ''; }
  if (m.state === 'error') {
    return '<section class="sec"><div class="card pad" id="modelErr"><b>识别模型没能启动</b><p class="hint" style="margin:4px 0 10px">' + esc(m.message || '') +
      '。可以先手动选是哪一只，照样能收进图鉴。</p><button class="btn btn-sm" data-act="model-retry">再试一次</button></div></section>';
  }
  var pct = m.total ? Math.round(m.loaded / m.total * 100) : 0;
  return '<section class="sec"><div class="card pad" id="modelCard"><b>正在准备识别模型</b>' +
    '<p class="hint" style="margin-top:4px">只需要下载一次（约 ' + fmtBytes(m.total || 37000000) + '），之后存在手机里，没网也能认。</p>' +
    '<div class="meter"><i style="width:' + pct + '%"></i></div></div></section>';
}

function viewHome() {
  var st = S.st, h = '<div class="wrap">';
  if (!S.dbOk) {
    h += '<section class="sec"><div class="card pad"><b>这里存不了数据</b><p class="hint" style="margin-top:4px">浏览器没有开放本机存储（可能是无痕模式）。可以随便试，但关掉页面后记录不会保留。</p></div></section>';
  }
  if (!S.enc.length) {
    h += '<section class="sec"><div class="card empty">' +
      '<svg class="empty-art" viewBox="0 0 84 84" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 26V16a6 6 0 0 1 6-6h10M58 10h10a6 6 0 0 1 6 6v10M74 58v10a6 6 0 0 1-6 6H58M26 74H16a6 6 0 0 1-6-6V58"/><path d="M42 26l4.200 11.800L58 42l-11.800 4.200L42 58l-4.200-11.800L26 42l11.800-4.200z" fill="currentColor" stroke="none"/></svg>' +
      '<h2>今天，会遇见谁？</h2><p>玩偶、手办、卡牌、包装上的图案……在生活里碰到的，都可以收进来。</p>' +
      '<ol class="steps"><li>对准它拍一张，尽量拍大、拍正。</li><li>手机自己认是哪一只，给出几个候选，你点对的那个。</li><li>它就点亮在图鉴里。看看多久能集齐 ' + C.TOTAL + ' 种。</li></ol>' +
      '<button class="btn btn-primary btn-block" data-act="cam-open">' + ICON.cam + '拍下第一只</button></div></section>';
    h += modelCard();
    return h + '</div>';
  }
  h += '<section class="sec"><div class="stats3">' +
    '<div class="stat"><div class="stat-n">' + st.encounters + '<small>次</small></div><div class="stat-l">相遇记录</div></div>' +
    '<div class="stat"><div class="stat-n">' + st.days + '<small>天</small></div><div class="stat-l">冒险天数</div></div>' +
    '<div class="stat"><div class="stat-n">' + st.streak + '<small>天</small></div><div class="stat-l">' + (st.streak && !st.activeToday ? '连续冒险 · 今天还没拍' : '连续冒险') + '</div></div>' +
    '</div></section>';
  h += modelCard();
  var recent = S.enc.slice(-12).reverse();
  h += '<section class="sec"><div class="sec-h"><h2>最近相遇</h2><button class="more" data-act="mine-tab" data-v="time">时间轴</button></div><div class="strip">' +
    recent.map(function (e) {
      return '<button class="shot" data-act="enc" data-id="' + e.id + '"><div class="shot-img"><img alt="" data-th="' + e.id + '"></div>' +
        '<div class="shot-zh">' + esc(C.label(e.sp, e.form)) + '</div><div class="shot-d">' + esc(fmtDay(e.d)) + '</div></button>';
    }).join('') + '</div></section>';
  h += '<section class="sec"><div class="sec-h"><h2>各世代进度</h2><span class="sec-n">已收集 / 总数</span></div><div class="card pad"><div class="bars">' + genBars() + '</div></div></section>';
  return h + '</div>';
}
function genBars() {
  return S.st.perGen.map(function (g) {
    var w = g.total ? g.have / g.total * 100 : 0;
    return '<div class="bar"><span class="bar-l">' + esc(C.genName(g.gen)) + '</span><span class="bar-t"><span class="bar-v" style="width:' + w.toFixed(1) + '%"></span></span>' +
      '<span class="bar-n"><b>' + g.have + '</b> / ' + g.total + '</span></div>';
  }).join('');
}

/* ------------------------------------------------------------- mine */

function topMine() {
  var st = S.st;
  return '<div class="top-row"><span class="kick">02</span><h1>我的图鉴</h1></div><p class="top-sub">已收集 ' + st.species + ' 种 · 相遇 ' + st.encounters + ' 次' +
    (st.forms ? ' · 特殊形态 ' + st.forms + ' 个' : '') + '</p>';
}
function viewMine() {
  var m = S.mine, h = '<div class="wrap"><div class="seg" role="group" aria-label="我的图鉴">' +
    [['have', '已收集'], ['time', '时间轴'], ['stat', '统计']].map(function (t) {
      return '<button data-act="mine-tab" data-v="' + t[0] + '" aria-pressed="' + (m.tab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  if (!S.enc.length) {
    return h + '<section class="sec"><div class="card empty"><h2>还没有相遇记录</h2><p>拍下在生活里遇到的宝可梦，它们会出现在这里。</p>' +
      '<div style="margin-top:16px"><button class="btn btn-primary btn-block" data-act="cam-open">' + ICON.cam + '开始第一次记录</button></div></div></section></div>';
  }
  if (m.tab === 'have') { h += mineHave(); }
  else if (m.tab === 'time') { h += mineTime(); }
  else { h += mineStat(); }
  return h + '</div>';
}
function mineHave() {
  var st = S.st, m = S.mine;
  var ids = Object.keys(st.have).map(Number);
  if (m.sort === 'no') { ids.sort(function (a, b) { return a - b; }); }
  else if (m.sort === 'count') { ids.sort(function (a, b) { return st.count[b] - st.count[a] || st.last[b].t - st.last[a].t; }); }
  else { ids.sort(function (a, b) { return st.last[b].t - st.last[a].t; }); }
  var h = '<section class="sec"><div class="chips" role="group" aria-label="排序">' +
    [['recent', '最近遇到'], ['no', '按编号'], ['count', '遇到最多']].map(function (s) {
      return '<button class="chip" data-act="mine-sort" data-v="' + s[0] + '" aria-pressed="' + (m.sort === s[0]) + '">' + s[1] + '</button>';
    }).join('') + '</div></section><section class="sec"><div class="grid" id="mineGrid">';
  ids.slice(0, m.shown).forEach(function (id) {
    var s = C.species(id), n = st.count[id];
    h += '<div class="pk photo have" data-sp="' + id + '"><span class="pk-img"><img alt="" data-th="' + st.last[id].id + '"></span>' +
      '<span class="pk-no">' + C.pad4(id) + '</span>' + (n > 1 ? '<span class="pk-ok">×' + n + '</span>' : '') +
      '<span class="pk-zh">' + esc(s.zh) + '</span>' +
      '<button class="pk-hit" data-act="sp" data-sp="' + id + '" aria-label="' + esc(s.zh) + '，遇到 ' + n + ' 次"></button></div>';
  });
  if (ids.length > m.shown) { h += '<div class="more-row" data-more="mine">继续往下滑，还有 ' + (ids.length - m.shown) + ' 种</div>'; }
  return h + '</div></section>';
}
function encRow(e, firstIds) {
  var bits = encMeta(e);
  return '<button class="card enc" data-act="enc" data-id="' + e.id + '"><span class="enc-img"><img alt="" data-th="' + e.id + '"></span>' +
    '<span class="enc-t"><span class="enc-zh"><span class="num">' + C.pad4(e.sp) + '</span>' + esc(C.label(e.sp, e.form)) +
    (firstIds && firstIds[e.id] ? ' <span class="tag tag-new">新发现</span>' : '') + '</span>' +
    '<span class="enc-m">' + esc(fmtTime(e.t)) + (bits.length ? ' · ' + esc(bits.join(' · ')) : '') + '</span>' +
    (e.note ? '<span class="enc-note">' + esc(e.note.replace(/\n/g, ' ')) + '</span>' : '') + '</span>' + ICON.chev + '</button>';
}
function mineTime() {
  var m = S.mine, list = S.enc.slice().reverse().slice(0, m.shown), h = '<section class="sec">', day = '';
  var firstIds = {};
  Object.keys(S.st.first).forEach(function (k) { firstIds[S.st.first[k].id] = 1; });
  var perDay = {};
  S.enc.forEach(function (e) { perDay[e.d] = (perDay[e.d] || 0) + 1; });
  list.forEach(function (e) {
    if (e.d !== day) {
      if (day) { h += '</div>'; }
      day = e.d;
      h += '<div class="tl-day"><b>' + esc(fmtDay(e.d)) + '</b><span>' + esc(weekday(e.d)) + ' · ' + perDay[e.d] + ' 次相遇</span></div><div class="tl">';
    }
    h += encRow(e, firstIds);
  });
  if (day) { h += '</div>'; }
  if (S.enc.length > m.shown) { h += '<div class="more-row" data-more="mine">继续往下滑，还有 ' + (S.enc.length - m.shown) + ' 条</div>'; }
  return h + '</section>';
}
function accuracy() {
  var n = 0, top1 = 0, topk = 0;
  S.enc.forEach(function (e) {
    if (e.by === 'ai') { n++; top1++; topk++; }
    else if (e.by === 'pick') { n++; topk++; }
    else if (e.by === 'miss') { n++; }
  });
  return { n: n, top1: top1, topk: topk };
}
function mineStat() {
  var st = S.st, h = '';
  h += '<section class="sec"><div class="stats3">' +
    '<div class="stat"><div class="stat-n">' + st.species + '<small>/ ' + C.TOTAL + '</small></div><div class="stat-l">已收录</div></div>' +
    '<div class="stat"><div class="stat-n">' + pctText(st.pct) + '</div><div class="stat-l">图鉴完成度</div></div>' +
    '<div class="stat"><div class="stat-n">' + st.encounters + '<small>次</small></div><div class="stat-l">相遇记录</div></div>' +
    '<div class="stat"><div class="stat-n">' + st.days + '<small>天</small></div><div class="stat-l">冒险天数</div></div>' +
    '<div class="stat"><div class="stat-n">' + st.streak + '<small>天</small></div><div class="stat-l">连续冒险</div></div>' +
    '<div class="stat"><div class="stat-n">' + st.bestStreak + '<small>天</small></div><div class="stat-l">最长连续</div></div>' +
    '</div></section>';
  h += '<section class="sec"><div class="sec-h"><h2>哪天能集齐</h2></div><div class="card pad"><p style="font-size:14.5px">' +
    forecastHtml(st.forecast).replace(/<b>/g, '<b style="color:var(--found)">') + '</p>' +
    '<p class="hint" style="margin-top:6px">按「新收集到的种类」的速度直线估算。越往后剩下的越难遇到，实际会更久。</p></div></section>';
  h += '<section class="sec"><div class="sec-h"><h2>各世代</h2><span class="sec-n">已收集 / 总数</span></div><div class="card pad"><div class="bars">' + genBars() + '</div></div></section>';
  h += '<section class="sec"><div class="sec-h"><h2>各属性</h2><span class="sec-n">双属性两边都算</span></div><div class="card pad"><div class="bars">' +
    st.perType.map(function (t) {
      var ty = C.TYPES[t.type], w = t.total ? t.have / t.total * 100 : 0;
      return '<div class="bar"><span class="bar-l"><i class="ty ty-' + ty.key + '">' + esc(ty.zh) + '</i></span><span class="bar-t"><span class="bar-v" style="width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="bar-n"><b>' + t.have + '</b> / ' + t.total + '</span></div>';
    }).join('') + '</div></div></section>';
  var cats = C.CATS.filter(function (c) { return st.cats[c.key]; });
  if (cats.length || st.cats.none) {
    h += '<section class="sec"><div class="sec-h"><h2>遇到的都是什么</h2></div><div class="card pad"><div class="chips">' +
      cats.map(function (c) { return '<span class="tag">' + esc(c.zh) + ' <b class="num">' + st.cats[c.key] + '</b></span>'; }).join('') +
      (st.cats.none ? '<span class="tag">没分类 <b class="num">' + st.cats.none + '</b></span>' : '') + '</div></div></section>';
  }
  h += '<section class="sec"><div class="sec-h"><h2>特殊形态</h2></div><div class="card pad"><p style="font-size:14.5px">遇到过 <b class="num">' + st.forms +
    '</b> 个（Mega、地区形态、超极巨化等一共 ' + st.formTotal + ' 个）。</p><p class="hint" style="margin-top:4px">特殊形态单独计数，不影响 ' + C.TOTAL + ' 种的完成度。</p></div></section>';
  var a = accuracy();
  if (a.n >= 3) {
    h += '<section class="sec"><div class="sec-h"><h2>识别成绩</h2></div><div class="card pad"><p style="font-size:14.5px">手机认过 <b class="num">' + a.n + '</b> 张：第一个就猜对 <b class="num">' +
      Math.round(a.top1 / a.n * 100) + '%</b>，对的在候选里 <b class="num">' + Math.round(a.topk / a.n * 100) + '%</b>。</p>' +
      '<p class="hint" style="margin-top:4px">你确认过的照片会留作参考，同样的东西再拍会认得更准。</p></div></section>';
  }
  return h;
}

/* ---------------------------------------------------------- national */

function topAll() {
  return '<div class="top-row"><span class="kick">03</span><h1>全国图鉴</h1><span class="top-sub num" id="natCount"></span></div>' +
    '<div class="search"><input id="natQ" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="搜编号、中文名、英文名、拼音" aria-label="搜索图鉴" value="' + esc(S.nat.q) + '" data-in="nat-q">' +
    ICON.search + '<button class="clr" data-act="nat-clear" aria-label="清空搜索"' + (S.nat.q ? '' : ' hidden') + '>' + ICON.x + '</button></div>';
}
function natFilterChips() {
  var n = S.nat, h = '';
  h += '<button class="chip" data-act="nat-filter">' + ICON.filter + '筛选</button>';
  if (n.gen) { h += '<button class="chip" aria-pressed="true" data-act="nat-set" data-k="gen" data-v="0" aria-label="去掉筛选：' + esc(C.genName(n.gen)) + '">' + esc(C.genName(n.gen)) + ICON.x.replace('class="ic"', 'class="ic x"') + '</button>'; }
  if (n.type >= 0) { h += '<button class="chip" aria-pressed="true" data-act="nat-set" data-k="type" data-v="-1" aria-label="去掉筛选：' + esc(C.TYPES[n.type].zh) + '">' + esc(C.TYPES[n.type].zh) + '属性' + ICON.x.replace('class="ic"', 'class="ic x"') + '</button>'; }
  if (n.kind) { h += '<button class="chip" aria-pressed="true" data-act="nat-set" data-k="kind" data-v="" aria-label="去掉筛选：' + esc(C.KIND_ZH[n.kind]) + '">' + esc(C.KIND_ZH[n.kind]) + ICON.x.replace('class="ic"', 'class="ic x"') + '</button>'; }
  return h;
}
function viewAll() {
  var n = S.nat;
  return '<div class="wrap"><div class="seg" role="group" aria-label="收集状态">' +
    [['all', '全部'], ['have', '已收集'], ['need', '未收集']].map(function (t) {
      return '<button data-act="nat-set" data-k="status" data-v="' + t[0] + '" aria-pressed="' + (n.status === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>' +
    '<section class="sec"><div class="chips scroll" id="natChips">' + natFilterChips() + '</div></section>' +
    '<section class="sec"><div class="grid" id="natGrid"></div></section></div>';
}
function natCard(it) {
  var sp = it.sp, f = it.form, n = !f && it.have ? S.st.count[sp] : 0;
  return '<button class="pk ' + (it.have ? 'have' : 'need') + '" data-act="sp" data-sp="' + sp + '"' + (f ? ' data-form="' + f + '"' : '') + '>' +
    '<span class="pk-no">' + C.pad4(sp) + '</span><span class="pk-img">' + refImg(sp, f) + '</span>' +
    (it.have ? '<span class="pk-ok" aria-label="已收集">' + (n > 1 ? '×' + n : ICON.check) + '</span>' : '') +
    '<span class="pk-zh">' + esc(C.label(sp, f)) + '</span><span class="pk-ty">' + typeChips(sp, f) + '</span></button>';
}
var natList = [];
function renderNatGrid(keep) {
  var grid = $('#natGrid');
  if (!grid) { return; }
  var n = S.nat;
  if (!keep) { n.shown = 150; }
  natList = C.listDex(n, S.st.have, S.st.haveForms);
  var h = natList.slice(0, n.shown).map(natCard).join('');
  if (!natList.length) {
    h = '<div class="more-row">没有符合条件的。' + (n.q ? '换个名字试试，或者清空搜索。' : '调整一下筛选条件。') + '</div>';
  } else if (natList.length > n.shown) {
    h += '<div class="more-row" data-more="nat">继续往下滑，还有 ' + (natList.length - n.shown) + ' 只</div>';
  }
  grid.innerHTML = h;
  var got = 0;
  natList.forEach(function (it) { if (it.have) { got++; } });
  var cnt = $('#natCount');
  if (cnt) { cnt.textContent = got + ' / ' + natList.length; }
  watchMore();
}
function natFilterSheet() {
  var n = S.nat;
  function chip(k, v, label, on) { return '<button class="chip" data-act="nat-set" data-k="' + k + '" data-v="' + v + '" data-sheet="1" aria-pressed="' + on + '">' + label + '</button>'; }
  var h = '<div class="field"><span class="lab">世代</span><div class="chips">' + chip('gen', 0, '全部', !n.gen) +
    C.GEN_LIST.map(function (g) { return chip('gen', g.gen, esc(C.genLabel(g.gen)), n.gen === g.gen); }).join('') + '</div></div>';
  h += '<div class="field"><span class="lab">属性</span><div class="chips">' + chip('type', -1, '全部', n.type < 0) +
    C.TYPES.map(function (t) { return chip('type', t.i, esc(t.zh), n.type === t.i); }).join('') + '</div></div>';
  h += '<div class="field"><span class="lab">形态</span><div class="chips">' + chip('kind', '', '基础种类', !n.kind) +
    C.KINDS.map(function (k) { return chip('kind', k.key, esc(k.zh), n.kind === k.key); }).join('') + '</div>' +
    '<p class="hint">选了形态以后，列表里显示的是这一类特殊形态。它们单独计数，不算进 ' + C.TOTAL + ' 种里。</p></div>';
  h += '<div class="row"><button class="btn" data-act="nat-reset">全部清空</button><button class="btn btn-ink" data-act="sheet-close">看结果</button></div>';
  return h;
}

/* ----------------------------------------------------------- species */

function topSpecies(sp) {
  var s = C.species(sp);
  return '<div class="top-row"><button class="top-btn" data-act="back" aria-label="返回">' + ICON.back + '</button><h1><span class="num" style="color:var(--on-navy-2);font-size:15px;margin-right:8px">' + C.no(sp) + '</span>' + esc(s.zh) + '</h1></div>';
}
function viewSpecies(sp) {
  var s = C.species(sp), st = S.st, have = !!st.have[sp];
  var encs = S.enc.filter(function (e) { return e.sp === sp; }).reverse();
  var h = '<div class="wrap">';
  h += '<section class="sec"><div class="card sp-head"><div class="sp-art ' + (have ? '' : 'need') + '">' + refImg(sp, 0) + '</div><div>' +
    '<div class="sp-no">' + C.no(sp) + '</div><div class="sp-zh">' + esc(s.zh) + '</div>' +
    '<div class="sp-alt">' + esc(s.en) + (s.ja ? ' · ' + esc(s.ja) : '') + '</div><div class="sp-ty">' + typeChips(sp, 0) + '</div></div></div></section>';
  h += '<section class="sec"><div class="row" style="align-items:center">' +
    (have ? '<span class="stamp">' + ICON.check + '已收录 · 遇到 ' + st.count[sp] + ' 次</span>' : '<span class="stamp no">还没遇到</span>') + '</div></section>';
  h += '<section class="sec"><button class="btn btn-primary btn-block" data-act="cam-open" data-sp="' + sp + '">' + ICON.cam + (have ? '又遇到了，再拍一张' : '遇到了，拍下来') + '</button></section>';
  h += '<section class="sec"><div class="card pad"><dl class="kv">' +
    '<dt>分类</dt><dd>' + esc(s.genus || '—') + '</dd>' +
    '<dt>世代</dt><dd>' + esc(C.genLabel(s.gen)) + '</dd>' +
    ((s.flags & 1) ? '<dt>稀有度</dt><dd>传说的宝可梦</dd>' : (s.flags & 2) ? '<dt>稀有度</dt><dd>幻之宝可梦</dd>' : '') +
    (have ? '<dt>第一次遇到</dt><dd>' + esc(fmtDay(st.first[sp].d)) + '</dd>' : '') +
    '</dl></div></section>';
  if (encs.length) {
    h += '<section class="sec"><div class="sec-h"><h2>我的相遇</h2><span class="sec-n">' + encs.length + ' 次</span></div><div class="photos">' +
      encs.map(function (e) {
        return '<div class="tile"><img alt="" data-th="' + e.id + '"><span class="photo-d">' + esc(fmtDay(e.d)) + '</span>' +
          '<button class="pk-hit" data-act="enc" data-id="' + e.id + '" aria-label="' + esc(fmtDay(e.d)) + ' 的相遇"></button></div>';
      }).join('') + '</div></section>';
  }
  if (s.forms.length) {
    h += '<section class="sec"><div class="sec-h"><h2>特殊形态</h2><span class="sec-n">单独计数</span></div><div class="forms">' +
      s.forms.map(function (fid) {
        var f = C.form(fid), got = !!st.haveForms[fid];
        return '<button class="form ' + (got ? 'have' : '') + '" data-act="cam-open" data-sp="' + sp + '" data-form="' + fid + '" aria-label="拍照记录 ' + esc(f.zh) + '">' +
          '<span class="form-img">' + refImg(sp, fid) + '</span><span class="form-t">' + esc(f.zh) + '<br><span class="form-k">' + esc(C.KIND_ZH[f.kind] || '') + (got ? ' · 已遇到' : '') + '</span></span>' + ICON.cam + '</button>';
      }).join('') + '</div></section>';
  }
  h += '<section class="sec"><p class="about">想知道它的详细资料，可以到 <a class="link" target="_blank" rel="noopener noreferrer" href="https://wiki.52poke.com/wiki/' + encodeURIComponent(s.zh) + '">神奇宝贝百科</a> 查看（会打开浏览器）。</p></section>';
  return h + '</div>';
}

/* ---------------------------------------------------------- settings */

function modelLine() {
  var m = S.model;
  if (R.checkFailed(m)) { return '已就绪，但自检没通过（' + m.check.toFixed(2) + '），候选可能不准'; }
  if (m.state === 'ready') { return '已就绪，照片不离开手机'; }
  if (m.state === 'loading') { return '下载中 ' + (m.total ? Math.round(m.loaded / m.total * 100) : 0) + '%（约 ' + fmtBytes(m.total || 37000000) + '，只下一次）'; }
  if (m.state === 'error') { return '没能启动：' + (m.message || '未知原因'); }
  return '还没开始';
}
function topPrefs() { return '<div class="top-row"><span class="kick">04</span><h1>设置</h1></div>'; }
function sw(act, on, label) { return '<button class="sw-hit" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '" data-act="' + act + '"><span class="sw" aria-checked="' + on + '"></span></button>'; }
function viewPrefs() {
  var p = S.prefs, h = '<div class="wrap">';
  h += '<section class="sec"><div class="sec-h"><h2>拍照和识别</h2></div><div class="card set">' +
    '<div class="set-row"><div class="set-t"><b>识别模型</b><span id="modelLine">' + esc(modelLine()) + '</span></div>' +
    '<button class="btn btn-sm" data-act="model-reset">重新下载</button></div>' +
    '<div class="set-row"><div class="set-t"><b>拍完自动识别</b><span>关掉以后每次都自己搜名字</span></div>' + sw('pref-auto', p.auto, '拍完自动识别') + '</div>' +
    '<div class="set-row"><div class="set-t"><b>用系统相机拍</b><span>不想每次被问相机权限，或者取景器黑屏时，打开这个</span></div>' + sw('pref-cam', p.cam === 'system', '用系统相机拍') + '</div>' +
    '</div></section>';
  h += '<section class="sec"><div class="sec-h"><h2>显示</h2></div><div class="card set">' +
    '<div class="set-row"><div class="set-t"><b>屏幕</b></div><div class="seg" role="group" aria-label="屏幕的颜色" style="min-width:204px">' +
    [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(function (t) { return '<button data-act="pref-theme" data-v="' + t[0] + '" aria-pressed="' + (p.theme === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
    '<div class="set-row"><div class="set-t"><b>显示参考图</b><span>图鉴里每只的小图，联网时从 PokeAPI 加载</span></div>' + sw('pref-sprites', p.sprites, '显示参考图') + '</div>' +
    '</div></section>';
  h += '<section class="sec"><div class="sec-h"><h2>数据</h2><span class="sec-n" id="usage">' + esc(S.usage || '') + '</span></div><div class="card set">' +
    '<button class="set-row" data-act="backup-export"><div class="set-t"><b>保存备份文件</b><span>所有记录和照片打包成一个 zip，存到「文件」或电脑上</span></div>' + ICON.down + '</button>' +
    '<button class="set-row" data-act="backup-import"><div class="set-t"><b>从备份文件恢复</b><span>换手机、或者从 Safari 搬到主屏幕 App 时用</span></div>' + ICON.up + '</button>' +
    '<button class="set-row" data-act="wipe"><div class="set-t"><b style="color:var(--danger)">清空全部记录</b><span>删除这台设备上的所有相遇和照片</span></div>' + ICON.trash + '</button>' +
    '</div><p class="hint" style="margin:8px 2px 0">记录和照片只存在这台设备的这个 App 里，没有上传到任何地方。隔一段时间存一份备份。</p></section>';
  h += '<section class="sec"><div class="sec-h"><h2>关于</h2></div><div class="about">' +
    '<p>相遇图鉴 <span class="num">v' + esc(C.VERSION) + '</span> · 图鉴数据 ' + esc(C.DATA_DATE) + '（' + C.TOTAL + ' 种，到第九世代；另有 ' + C.FORMS.length + ' 个特殊形态）。</p>' +
    '<p>这是爱好者自己做的非官方工具，和任天堂、Creatures、GAME FREAK、宝可梦公司没有关系。宝可梦及相关名称是它们的商标。</p>' +
    '<p>名称和属性数据来自 PokeAPI；参考图由 PokeAPI 的公开图库在联网时提供，没有打包在本工具里。识别在手机上完成：主干模型是 Facebook Research 公开的 SWSL ResNet-50（CC BY-NC 4.0，仅限非商业使用），用 ONNX Runtime Web（MIT）运行。数字字体 Chakra Petch（SIL OFL）。</p>' +
    '</div></section>';
  return h + '</div>';
}

/* ------------------------------------------------------------ render */

var moreObs = null;
function watchMore() {
  if (moreObs) { moreObs.disconnect(); }
  var el = $('[data-more]');
  if (!el || typeof IntersectionObserver === 'undefined') { return; }
  moreObs = new IntersectionObserver(function (ents) {
    ents.forEach(function (en) {
      if (!en.isIntersecting) { return; }
      var kind = en.target.getAttribute('data-more');
      if (kind === 'nat') { S.nat.shown += 150; renderNatGrid(true); }
      else if (kind === 'mine') { S.mine.shown += 60; renderView(true); }
    });
  }, { rootMargin: '600px 0px' });
  moreObs.observe(el);
}
function renderView(keepScroll) {
  var view = $('#view'), y = window.scrollY;
  if (S.page && S.page.kind === 'sp') { view.innerHTML = viewSpecies(S.page.sp); }
  else if (S.tab === 'home') { view.innerHTML = viewHome(); }
  else if (S.tab === 'mine') { view.innerHTML = viewMine(); }
  else if (S.tab === 'all') { view.innerHTML = viewAll(); renderNatGrid(keepScroll); }
  else { view.innerHTML = viewPrefs(); refreshUsage(); }
  hydrate(view);
  watchMore();
  if (keepScroll) { window.scrollTo(0, y); }
}
function render(keepScroll) {
  var top = $('#top');
  $$('.tab[data-tab]').forEach(function (t) {
    if (!S.page && t.getAttribute('data-tab') === S.tab) { t.setAttribute('aria-current', 'page'); } else { t.removeAttribute('aria-current'); }
  });
  top.className = !S.page && S.tab === 'home' ? 'top tall' : 'top';
  if (S.page && S.page.kind === 'sp') { top.innerHTML = topSpecies(S.page.sp); }
  else if (S.tab === 'home') { top.innerHTML = topHome(); }
  else if (S.tab === 'mine') { top.innerHTML = topMine(); }
  else if (S.tab === 'all') { top.innerHTML = topAll(); }
  else { top.innerHTML = topPrefs(); }
  renderView(keepScroll);
  deckSync();
  if (!keepScroll) { window.scrollTo(0, 0); }
}
function refreshUsage() {
  if (!navigator.storage || !navigator.storage.estimate) { return; }
  navigator.storage.estimate().then(function (e) {
    S.usage = '已用约 ' + fmtBytes(e.usage || 0);
    var el = $('#usage');
    if (el) { el.textContent = S.usage; }
  }).catch(function () { /* not available */ });
}

/* ---- 30-capture: camera, cropping, recognition, saving ---------------------------------- */

var cam = null;
var PHOTO_MAX = 1080, THUMB = 320;

function makeCanvas(w, h) { var c = doc.createElement('canvas'); c.width = w; c.height = h; return c; }
/* iPhones keep a canvas's memory long after it is forgotten, and there is a fixed amount for the whole
 * app: shrink a canvas to nothing as soon as it has done its job. */
function freeCanvas(c) { if (c) { try { c.width = 0; c.height = 0; } catch (e) { /* nothing to hand back */ } } }
function canvasBlob(c, q) {
  return new Promise(function (ok, no) {
    if (c.toBlob) { c.toBlob(function (b) { if (b) { ok(b); } else { no(new Error('toBlob')); } }, 'image/jpeg', q); return; }
    try {
      var bin = atob(c.toDataURL('image/jpeg', q).split(',')[1]), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) { u8[i] = bin.charCodeAt(i); }
      ok(new Blob([u8], { type: 'image/jpeg' }));
    } catch (e) { no(e); }
  });
}
function blobBuffer(b) {
  if (b.arrayBuffer) { return b.arrayBuffer(); }
  return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { no(fr.error); }; fr.readAsArrayBuffer(b); });
}

function camOpen(target) {
  var el = $('#cam');
  if (!el.hidden) { return; }
  if (topLayer() === 'sheet') { popLayer(); }
  cam = {
    phase: 'live', token: 0, stream: null, watch: 0, facing: 'environment', zoom: 1, target: target || null,
    canvas: null, preview: '', photoP: null, crop: null,
    res: null, cands: [], conf: 0, thinking: false, runId: 0, failed: '',
    pick: null, cat: '', place: '', note: '', q: '', t: 0, saving: false, saved: null
  };
  el.hidden = false;
  doc.body.classList.add('lock');
  pushLayer('cam', camHide);
  if (S.model.state === 'idle' || S.model.state === 'error') { startModel(); }
  if (S.prefs.cam === 'system') { camSet('system'); try { $('#fileCamera').click(); } catch (e) { /* the round button does the same */ } }
  else { camSet('live'); camStart(); }
  var x = $('#cam .cam-x');
  if (x) { try { x.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
}
/* forget the photo that was taken; its canvas is emptied once the JPEG made from it is ready */
function camDrop() {
  var c = cam.canvas, p = cam.photoP;
  cam.canvas = null; cam.photoP = null;
  if (!c) { return; }
  if (p) { p.then(function () { freeCanvas(c); }, function () { freeCanvas(c); }); } else { freeCanvas(c); }
}
function camHide() {
  if (!cam) { return; }
  camStop();
  if (cam.crop) { URL.revokeObjectURL(cam.crop.url); cam.crop = null; }
  camDrop();
  var el = $('#cam');
  freeCanvas($('#camCrop'));
  el.hidden = true; el.innerHTML = '';
  if ($('#sheetHost').hidden) { doc.body.classList.remove('lock'); }
  cam = null;
  render(true);
}
function camClose() { if (topLayer() === 'cam') { popLayer(); } }

function pillHtml() {
  var m = S.model;
  if (!S.prefs.auto) { return '<span class="pill" id="camPill"><i></i><span>自动识别已关闭</span></span>'; }
  if (R.checkFailed(m)) { return '<span class="pill bad" id="camPill"><i></i><span>识别可能不准（自检没过）</span></span>'; }
  if (m.state === 'ready') { return '<span class="pill ok" id="camPill"><i></i><span>识别已就绪</span></span>'; }
  if (m.state === 'error') { return '<span class="pill bad" id="camPill"><i></i><span>识别不可用，手动选</span></span>'; }
  var pct = m.total ? Math.round(m.loaded / m.total * 100) : 0;
  return '<span class="pill" id="camPill"><i></i><span>识别模型准备中 ' + pct + '%</span></span>';
}
/* The keys under the screen while scanning. The big one in the middle always does the next main
 * thing: take the picture, use the cropped picture, save, take another. */
function camKeys(phase) {
  var none = '<span></span>';
  if (phase === 'live') {
    return keyHtml('cam-album', ICON.album, '相册', { cls: 'cam-side' }) +
      keyHtml('cam-shoot', ICON.shot, '拍照', { big: true, cls: 'shutter', off: true }) +
      keyHtml('cam-system', ICON.phone, '系统相机', { cls: 'cam-side' });
  }
  if (phase === 'system') {
    return keyHtml('cam-album', ICON.album, '相册', { cls: 'cam-side' }) +
      keyHtml('cam-shoot', ICON.shot, '打开相机', { big: true, cls: 'shutter', label: '打开系统相机' }) +
      keyHtml('cam-live', ICON.cam, '取景器', { cls: 'cam-side' });
  }
  if (phase === 'crop') { return keyHtml('cam-retake', ICON.redo, '换一张') + keyHtml('cam-use', ICON.check, '用这张', { big: true }) + none; }
  if (phase === 'think') { return keyHtml('cam-retake', ICON.redo, '重拍') + keyHtml('', ICON.wait, '识别中', { big: true, off: true }) + none; }
  if (phase === 'pick') { return keyHtml('cam-retake', ICON.redo, '重拍') + keyHtml('cam-search', ICON.search, '搜名字', { big: true }) + none; }
  if (phase === 'detail') {
    return (cam.target ? none : keyHtml('cam-repick', ICON.swap, '换一只')) +
      keyHtml('cam-save', ICON.check, '收进图鉴', { big: true, id: 'camSave' }) +
      keyHtml('cam-retake', ICON.redo, '重拍');
  }
  if (phase === 'done') {
    return keyHtml('cam-close', ICON.exit, '完成') + keyHtml('cam-again', ICON.cam, '继续拍', { big: true }) + keyHtml('cam-view', ICON.book, '看看它');
  }
  return '';
}
function camSet(phase) {
  if (!cam) { return; }
  cam.phase = phase;
  var el = $('#cam'), h = '';
  var live = phase === 'live', sys = phase === 'system', crop = phase === 'crop', think = phase === 'think';
  /* top deck: close, the recogniser's lamp, switch between the two cameras */
  h += '<div class="cam-top"><button class="cam-x" data-act="cam-close" aria-label="关闭"><span class="kc">' + ICON.x + '</span></button>' + pillHtml() + '<span class="sp"></span>' +
    (live ? '<button class="cam-x" data-act="cam-flip" aria-label="切换前后摄像头"><span class="kc">' + ICON.flip + '</span></button>' : '') + '</div>';
  /* the screen */
  h += '<div class="cam-body" id="camBody">';
  if (live || sys || crop || think) {
    h += '<div class="cam-stage' + (think ? ' busy' : '') + '" id="camStage">' +
      (live ? '<video id="camVideo" playsinline webkit-playsinline muted autoplay></video>' : '') +
      (crop ? '<canvas id="camCrop" width="720" height="720" aria-label="拖动调整照片位置"></canvas>' : '') +
      (think ? '<img alt="刚拍的照片" src="' + cam.preview + '"><div class="sweep"></div>' : '') +
      '<div class="cam-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<div class="cam-msg" id="camMsg"' + (sys ? '' : ' hidden') + '>' + (sys ? '<p>按下面的大圆键，打开系统相机拍一张。</p>' : '') + '</div></div>';
    if (crop) {
      h += '<div class="crop-row"><span>放大</span><input type="range" id="camZoom" min="1" max="4" step="0.01" value="1" data-in="cam-crop-zoom" aria-label="放大照片"></div>' +
        '<p class="cam-tip">拖动照片，把它放在框的中间，尽量占满。</p>';
    } else if (think) {
      h += '<div class="res"><div class="term" role="status"><p>正在认是哪一只…</p></div></div>';
    } else {
      h += (live ? '<div class="zoom" role="group" aria-label="变焦"><button data-act="cam-zoom" data-v="1" aria-pressed="' + (cam.zoom === 1) + '">1×</button><button data-act="cam-zoom" data-v="2" aria-pressed="' + (cam.zoom === 2) + '">2×</button></div>' : '') +
        '<div class="res"><div class="term">' +
        (cam.target ? '<p class="cam-tip">这次记录的是 <b>' + esc(C.label(cam.target.sp, cam.target.form)) + '</b></p>' : '<p class="cam-tip">把它放进框里，拍大一点、正一点</p>') +
        (live ? '<p>按下面的大圆键拍照</p>' : '') + '</div></div>';
    }
  } else if (phase === 'pick') { h += pickHtml(); }
  else if (phase === 'detail') { h += detailHtml(); }
  else if (phase === 'done') { h += doneHtml(); }
  h += '</div>';
  /* bottom deck: what the three keys do depends on where the scan has got to */
  h += '<div class="cam-bar">' + camKeys(phase) + '</div>';
  freeCanvas($('#camCrop'));
  el.innerHTML = h;
  if (phase === 'crop') { cropBind(); cropDraw(); }
  var body = $('#camBody');
  if (body) { body.scrollTop = 0; }
}
function camPill() {
  var p = $('#camPill');
  if (p && cam) { var d = doc.createElement('div'); d.innerHTML = pillHtml(); p.parentNode.replaceChild(d.firstChild, p); }
}

/* ------------------------------------------------------- live camera */

function camMsg(html) {
  var m = $('#camMsg');
  if (!m) { return; }
  m.innerHTML = html || '';
  m.hidden = !html;
}
function camStop() {
  if (!cam) { return; }
  clearTimeout(cam.watch);
  cam.token++;
  if (cam.stream) { try { cam.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* already stopped */ } cam.stream = null; }
  var v = $('#camVideo');
  if (v) { try { v.pause(); v.srcObject = null; } catch (e) { /* element is going away */ } }
}
var CAM_ERR = {
  NotAllowedError: '没有拿到摄像头权限。可以到系统「设置」里允许相机，或者改用系统相机拍。',
  SecurityError: '没有拿到摄像头权限。可以到系统「设置」里允许相机，或者改用系统相机拍。',
  NotFoundError: '没找到可用的摄像头。',
  OverconstrainedError: '没找到可用的摄像头。',
  NotReadableError: '摄像头正被别的 App 占用，关掉它再试。',
  blank: '取景器没有画面。',
  ended: '摄像头被打断了（比如来了电话，或者别的 App 用了相机）。',
  nomedia: '这个浏览器不能在页面里直接打开摄像头。'
};
function camFail(kind) {
  if (!cam || cam.phase !== 'live') { return; }
  camStop();
  camMsg('<p>' + esc(CAM_ERR[kind] || '摄像头没能打开。') + '</p><div class="row"><button class="btn btn-sm" data-act="cam-retry">再试一次</button><button class="btn btn-sm btn-primary" data-act="cam-system">用系统相机拍</button></div>');
}
function camStart() {
  if (!cam || cam.phase !== 'live') { return; }
  camStop();
  camMsg('');
  var v = $('#camVideo'), sh = $('.shutter');
  if (sh) { sh.disabled = true; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camFail('nomedia'); return; }
  var token = cam.token;
  navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: cam.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } }).then(function (stream) {
    if (!cam || token !== cam.token || cam.phase !== 'live') { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* nothing to stop */ } return; }
    cam.stream = stream;
    /* the phone can take the camera away (a call, Control Centre, another app): say so instead of showing a frozen picture.
     * Stopping the camera ourselves does not fire this event. */
    stream.getVideoTracks().forEach(function (t) {
      t.addEventListener('ended', function () { if (cam && token === cam.token && cam.phase === 'live') { camFail('ended'); } });
    });
    v.srcObject = stream;
    v.style.transform = cam.zoom > 1 ? 'scale(' + cam.zoom + ')' : '';
    function live() {
      if (!cam || token !== cam.token) { return; }
      if (v.videoWidth > 0) { clearTimeout(cam.watch); if (sh) { sh.disabled = false; } }
    }
    v.addEventListener('loadeddata', live);
    v.addEventListener('playing', live);
    var p = v.play();
    if (p && p.catch) { p.catch(function () { /* autoplay refused: the watchdog below reports it */ }); }
    cam.watch = setTimeout(function () {
      if (cam && token === cam.token && cam.phase === 'live' && !(v.videoWidth > 0 && v.readyState >= 2)) { camFail('blank'); }
      else { live(); }
    }, 5000);
  }).catch(function (err) {
    if (!cam || token !== cam.token) { return; }
    camFail(err && err.name);
  });
}
function camShoot() {
  if (!cam) { return; }
  if (cam.phase === 'system') { $('#fileCamera').click(); return; }
  var v = $('#camVideo');
  if (cam.phase !== 'live' || !v || !(v.videoWidth > 0)) { return; }
  var side = Math.min(v.videoWidth, v.videoHeight) / cam.zoom;
  var sx = (v.videoWidth - side) / 2, sy = (v.videoHeight - side) / 2;
  var out = clamp(Math.round(side), 64, PHOTO_MAX);
  var c = makeCanvas(out, out);
  c.getContext('2d').drawImage(v, sx, sy, side, side, 0, 0, out, out);
  camStop();
  camTaken(c);
}

/* ------------------------------------------------- photo from a file */

function camFile(file) {
  if (!cam || !file) { return; }
  var url = URL.createObjectURL(file), img = new Image();
  img.onload = function () {
    if (!cam) { URL.revokeObjectURL(url); return; }
    if (!(img.naturalWidth > 8 && img.naturalHeight > 8)) { URL.revokeObjectURL(url); toast('这张图片太小了，换一张试试'); return; }
    camStop();
    cam.crop = { img: img, url: url, iw: img.naturalWidth, ih: img.naturalHeight, scale: 1, cx: img.naturalWidth / 2, cy: img.naturalHeight / 2 };
    cam.t = Date.now();
    camSet('crop');
  };
  img.onerror = function () { URL.revokeObjectURL(url); toast('这张图片打不开，换一张试试'); };
  img.src = url;
}
function cropRegion() {
  var k = cam.crop, side = Math.min(k.iw, k.ih) / k.scale;
  k.cx = clamp(k.cx, side / 2, k.iw - side / 2);
  k.cy = clamp(k.cy, side / 2, k.ih - side / 2);
  return { x: k.cx - side / 2, y: k.cy - side / 2, side: side };
}
function cropDraw() {
  var c = $('#camCrop');
  if (!c || !cam || !cam.crop) { return; }
  var r = cropRegion(), ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(cam.crop.img, r.x, r.y, r.side, r.side, 0, 0, c.width, c.height);
}
function cropBind() {
  var stage = $('#camStage'), drag = null;
  if (!stage) { return; }
  stage.addEventListener('pointerdown', function (e) {
    if (!cam || !cam.crop) { return; }
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || !cam || !cam.crop) { return; }
    var w = stage.getBoundingClientRect().width || 1, r = cropRegion();
    cam.crop.cx -= (e.clientX - drag.x) * r.side / w;
    cam.crop.cy -= (e.clientY - drag.y) * r.side / w;
    drag.x = e.clientX; drag.y = e.clientY;
    cropDraw();
  });
  function end(e) { if (drag && e.pointerId === drag.id) { drag = null; } }
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('keydown', function (e) {
    if (!cam || !cam.crop) { return; }
    var step = cropRegion().side * 0.05, hit = true;
    if (e.key === 'ArrowLeft') { cam.crop.cx -= step; } else if (e.key === 'ArrowRight') { cam.crop.cx += step; }
    else if (e.key === 'ArrowUp') { cam.crop.cy -= step; } else if (e.key === 'ArrowDown') { cam.crop.cy += step; } else { hit = false; }
    if (hit) { e.preventDefault(); cropDraw(); }
  });
  stage.setAttribute('tabindex', '0');
}
function cropUse() {
  if (!cam || !cam.crop) { return; }
  var r = cropRegion(), out = clamp(Math.round(r.side), 64, PHOTO_MAX);
  var c = makeCanvas(out, out), ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cam.crop.img, r.x, r.y, r.side, r.side, 0, 0, out, out);
  URL.revokeObjectURL(cam.crop.url);
  cam.crop = null;
  camTaken(c);
}

/* --------------------------------------------------- after the shot */

function camTaken(c) {
  cam.canvas = c;
  if (!cam.t) { cam.t = Date.now(); }
  /* the small copy shown on the screen while scanning and afterwards */
  var side = Math.min(480, c.width), p = makeCanvas(side, side), pc = p.getContext('2d');
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(c, 0, 0, c.width, c.height, 0, 0, side, side);
  cam.preview = p.toDataURL('image/jpeg', 0.82);
  freeCanvas(p);
  cam.photoP = canvasBlob(c, 0.86);
  cam.photoP.catch(function () { /* reported when saving */ });
  cam.res = null; cam.cands = []; cam.conf = 0; cam.failed = ''; cam.pick = null; cam.q = '';
  var canRun = S.prefs.auto && S.model.state === 'ready';
  if (cam.target) {
    cam.pick = { sp: cam.target.sp, form: cam.target.form || 0 };
    camSet('detail');
    if (canRun) { camRecog(); }
  } else if (canRun) {
    camSet('think');
    camRecog();
  } else {
    camSet('pick');
  }
}
/* Earlier confirmed photos, as fingerprints the recogniser can compare a new photo with.
 * A stored record holds the fingerprint (s, made with head `tag`) and the image features
 * (b, made with feature model `bb`); if the head was replaced since, the fingerprint is rebuilt. */
function exampleOf(id, v) {
  var e = S.byId[id], st = R.status();
  if (!e || !v) { return null; }
  var sig = null;
  try {
    if (v.s && v.tag === st.tag) { sig = C.sigUnpack(new Uint8Array(v.s), R.classCount()); }
    else if (v.b && v.bb === st.bb) { sig = R.sigOf(C.unpackFeat(new Uint8Array(v.b))); }
  } catch (err) { sig = null; }
  return sig ? { id: id, sp: e.sp, form: e.form, sig: sig } : null;
}
function ensureExamples() {
  if (S.ex) { return Promise.resolve(); }
  return dbAll('feat').then(function (rows) {
    var list = [];
    rows.forEach(function (r) { var x = exampleOf(r.key, r.value); if (x) { list.push(x); } });
    S.ex = list;
  }).catch(function () { S.ex = []; });
}
function camRecog() {
  if (!cam || !cam.canvas) { return; }
  var id = ++cam.runId, shot = cam.canvas;
  cam.thinking = true;
  ensureExamples().then(function () { return R.classify(shot); }).then(function (res) {
    if (!cam || cam.runId !== id) { return; }
    cam.thinking = false;
    cam.res = res;
    cam.cands = R.rank(res, S.ex, 6);
    cam.conf = C.confidence(cam.cands);
    if (cam.phase === 'think') {
      if (cam.conf === 2) { camPick(0); } else { camSet('pick'); }
    } else if (cam.phase === 'pick' && !cam.q) { camSet('pick'); }
  }).catch(function (err) {
    if (!cam || cam.runId !== id) { return; }
    cam.thinking = false;
    cam.failed = String((err && err.message) || err);
    if (cam.phase === 'think' || cam.phase === 'pick') { camSet('pick'); }
  });
}

function shotHead(title, sub, busy) {
  return '<div class="res"><div class="picked"><span class="cand-img"><img alt="刚拍的照片" src="' + cam.preview + '"></span>' +
    '<span class="picked-t"><b>' + (busy ? '<span style="display:inline-flex;align-items:center;gap:8px"><span class="spin"></span>' + esc(title) + '</span>' : esc(title)) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span></div></div>';
}
function candImg(sp, formId) { return refImg(sp, formId); }
function pickHtml() {
  var h = '', title, sub = '';
  if (cam.cands.length) {
    title = cam.conf >= 1 ? '是它吗？' : '不太确定，帮忙选一个';
    sub = cam.conf >= 1 ? '点一下对的那只' : '都不像的话，在下面搜名字';
  } else if (cam.thinking) { title = '正在认是哪一只…'; }
  else if (!S.prefs.auto) { title = '这是哪一只？'; sub = '搜名字或编号'; }
  else if (S.model.state === 'loading') { title = '这是哪一只？'; sub = '识别模型还在下载，这张先手动选'; }
  else if (cam.failed || S.model.state === 'error') { title = '这是哪一只？'; sub = '这次没认出来，手动选一下'; }
  else { title = '这是哪一只？'; sub = '搜名字或编号'; }
  h += shotHead(title, sub, cam.thinking && !cam.cands.length);
  h += '<div class="res" style="padding-top:0">';
  if (cam.cands.length) {
    h += '<div class="cands" id="camCands">' + cam.cands.map(function (c, i) {
      var pct = Math.round(c.p * 100);
      if (i === 0) {
        return '<button class="cand first" data-act="cam-pick" data-i="0"><span class="cand-img">' + candImg(c.sp, c.form) + '</span><span class="cand-t">' +
          '<span class="cand-no">' + C.no(c.sp) + '</span><span class="cand-zh">' + esc(C.label(c.sp, c.form)) + '</span>' +
          '<span class="cand-p">' + (c.seen ? '和你以前拍过的很像' : '把握 ' + (pct < 1 ? '不到 1' : pct) + '%') + '</span></span></button>';
      }
      return '<button class="cand" data-act="cam-pick" data-i="' + i + '"><span class="cand-p">' + (pct < 1 ? '<1' : pct) + '%</span><span class="cand-img">' + candImg(c.sp, c.form) + '</span>' +
        '<span class="cand-zh">' + esc(C.label(c.sp, c.form)) + '</span><span class="cand-no">' + C.no(c.sp) + '</span></button>';
    }).join('') + '</div>';
  }
  h += '<div class="field"><label for="camQ">' + (cam.cands.length ? '都不是？自己搜' : '搜名字或编号') + '</label><div class="search"><input id="camQ" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="中文名、英文名、拼音、编号" value="' + esc(cam.q) + '" data-in="cam-q">' + ICON.search + '</div></div>' +
    '<div class="res-list" id="camFound">' + foundHtml() + '</div></div>';
  return h;
}
function foundHtml() {
  if (!cam || !C.fold(cam.q)) { return ''; }
  var list = C.search(cam.q, { limit: 8 });
  if (!list.length) { return '<p class="hint">没找到叫这个名字的。试试编号，或者只打前两个字。</p>'; }
  return list.map(function (r) {
    return '<button class="res-item" data-act="cam-pick-sp" data-sp="' + r.sp + '" data-form="' + r.form + '"><span class="cand-img">' + candImg(r.sp, r.form) + '</span>' +
      '<span><b>' + esc(C.label(r.sp, r.form)) + '</b><small class="num">' + C.no(r.sp) + '</small></span></button>';
  }).join('');
}
function camPick(i) {
  var c = cam.cands[i];
  if (!c) { return; }
  cam.pick = { sp: c.sp, form: c.form || 0 };
  camSet('detail');
}
function camPickSp(sp, formId) {
  if (!C.species(sp)) { return; }
  var f = C.form(formId);
  cam.pick = { sp: sp, form: f && f.sp === sp ? f.id : 0 };
  camSet('detail');
}
/* how the species was identified, worked out when saving: the model's first answer, one of
 * its other candidates, not in its list at all, or no recognition involved */
function camHow() {
  if (cam.target || !cam.res) { return { by: 'manual', rank: -1 }; }
  var at = -1;
  cam.cands.forEach(function (c, i) { if (c.sp === cam.pick.sp && at < 0) { at = i; } });
  return { by: at === 0 ? 'ai' : at > 0 ? 'pick' : 'miss', rank: at };
}
function formShort(f, base) {
  if (f.zh.indexOf(base + '（') === 0) { return f.zh.slice(base.length + 1, -1); }
  return f.zh;
}
function recentPlaces() {
  var seen = {}, out = [];
  for (var i = S.enc.length - 1; i >= 0 && out.length < 6; i--) {
    var p = S.enc[i].place;
    if (p && !seen[p]) { seen[p] = 1; out.push(p); }
  }
  return out;
}
function detailHtml() {
  var sp = cam.pick.sp, s = C.species(sp), have = !!S.st.have[sp];
  var first = !cam.target && cam.cands.length && cam.cands[0].sp === sp ? cam.cands[0] : null;
  var how = first ? (first.seen ? '和以前拍过的很像 · ' : '手机认的，把握 ' + Math.max(1, Math.round(first.p * 100)) + '% · ') : '';
  var h = '<div class="res"><div class="picked sure"><span class="cand-img"><img alt="刚拍的照片" src="' + cam.preview + '"></span>' +
    '<span class="picked-t"><b>' + esc(C.label(sp, cam.pick.form)) + '</b><span><span class="num">' + C.no(sp) + '</span> · ' + how + (have ? '第 ' + (S.st.count[sp] + 1) + ' 次遇到' : '新发现') + '</span></span></div>';
  if (s.forms.length) {
    h += '<div class="field"><span class="lab">是哪种形态？</span><div class="chips"><button class="chip" data-act="cam-form" data-v="0" aria-pressed="' + (!cam.pick.form) + '">普通</button>' +
      s.forms.map(function (fid) { var f = C.form(fid); return '<button class="chip" data-act="cam-form" data-v="' + fid + '" aria-pressed="' + (cam.pick.form === fid) + '">' + esc(formShort(f, s.zh)) + '</button>'; }).join('') + '</div></div>';
  }
  h += '<div class="field"><span class="lab">它是什么？</span><div class="chips" id="camCats">' + C.CATS.map(function (c) {
    return '<button class="chip" data-act="cam-cat" data-v="' + c.key + '" aria-pressed="' + (cam.cat === c.key) + '">' + esc(c.zh) + '</button>';
  }).join('') + '</div></div>';
  var places = recentPlaces();
  h += '<div class="field"><label for="camPlace">在哪里遇见的</label><input class="inp" id="camPlace" maxlength="' + C.MAX_PLACE + '" autocomplete="off" enterkeyhint="done" placeholder="比如：便利店、朋友家、商场" value="' + esc(cam.place) + '" data-in="cam-place">' +
    (places.length ? '<div class="chips">' + places.map(function (p) { return '<button class="chip chip-t" data-act="cam-place" data-v="' + esc(p) + '">' + esc(p) + '</button>'; }).join('') + '</div>' : '') + '</div>';
  h += '<div class="field"><label for="camNote">冒险笔记</label><textarea class="inp" id="camNote" maxlength="' + C.MAX_NOTE + '" placeholder="记一句这次相遇的小故事（可以不写）" data-in="cam-note">' + esc(cam.note) + '</textarea>' +
    '<div class="count" id="camNoteN">' + cam.note.length + ' / ' + C.MAX_NOTE + '</div></div>';
  return h + '</div>';
}
function doneHtml() {
  var r = cam.saved.rec, n = S.st.count[r.sp] || 1;
  return '<div class="done"><div class="done-img"><img alt="" src="' + cam.preview + '"></div>' +
    '<div class="done-k">' + (cam.saved.isNew ? '新 发 现' : '又 见 面 了') + '</div><div class="done-zh">' + esc(C.label(r.sp, r.form)) + '</div>' +
    '<div class="done-s"><span class="num">' + C.no(r.sp) + '</span> · ' + (cam.saved.isNew ? '这是你的第 <b>' + S.st.species + '</b> 种，还差 <b>' + (C.TOTAL - S.st.species) + '</b> 种' : '第 <b>' + n + '</b> 次遇到它') + '</div>' +
    '<div class="term"><p>已写入图鉴 <span class="num">' + C.pad4(S.st.species) + '/' + C.TOTAL + '</span></p></div></div>';
}

function camRetake() {
  if (!cam) { return; }
  if (cam.crop) { URL.revokeObjectURL(cam.crop.url); cam.crop = null; }
  cam.runId++;
  camDrop();
  cam.preview = ''; cam.res = null; cam.cands = []; cam.thinking = false; cam.pick = null; cam.q = ''; cam.t = 0; cam.saved = null; cam.saving = false;
  cam.note = '';      /* the place and the kind of thing usually stay the same for the next shot; the note does not */
  if (S.prefs.cam === 'system') { camSet('system'); }
  else { camSet('live'); camStart(); }
}

function camSave() {
  if (!cam || cam.saving || !cam.pick || !cam.canvas) { return; }
  cam.saving = true;
  var btn = $('#camSave'), lab = btn ? $('.kl', btn) : null;
  if (btn) { btn.disabled = true; }
  if (lab) { lab.textContent = '保存中…'; }
  var now = Date.now(), id = C.newId(now), rec = null;
  var th = makeCanvas(THUMB, THUMB), tc = th.getContext('2d');
  tc.imageSmoothingQuality = 'high';
  tc.drawImage(cam.canvas, 0, 0, cam.canvas.width, cam.canvas.height, 0, 0, THUMB, THUMB);
  /* give a recognition that is still running a moment to finish, so this photo can serve as an example later */
  var waitRes = new Promise(function (ok) {
    var tries = 0;
    (function poll() { if (!cam || !cam.thinking || tries++ > 40) { ok(); } else { setTimeout(poll, 100); } })();
  });
  var session = cam;
  Promise.all([cam.photoP, canvasBlob(th, 0.8), waitRes]).then(function (r) {
    freeCanvas(th);
    return Promise.all([blobBuffer(r[0]), blobBuffer(r[1])]);
  }).then(function (bufs) {
    var how = camHow();
    rec = C.sanitizeEnc({
      id: id, sp: session.pick.sp, form: session.pick.form, t: session.t || now, d: C.dayKey(session.t || now),
      cat: session.cat, place: session.place, note: session.note, by: how.by, rank: how.rank, u: now
    }, now);
    var res = session.res, st = R.status();
    var mem = res ? { b: C.packFeat(res.feat).buffer, s: C.sigPack(res.sig).buffer, tag: st.tag, bb: st.bb } : null;
    return dbTx(['enc', 'photo', 'thumb', 'feat'], 'readwrite', function (tx) {
      tx.objectStore('enc').put(rec);
      tx.objectStore('photo').put({ b: bufs[0] }, rec.id);
      tx.objectStore('thumb').put({ b: bufs[1] }, rec.id);
      if (mem) { tx.objectStore('feat').put(mem, rec.id); }
    }).then(function () {
      if (mem && S.ex) { S.ex.push({ id: rec.id, sp: rec.sp, form: rec.form, sig: res.sig }); }
    });
  }).then(function () {
    var isNew = !S.st.have[rec.sp];
    var list = S.enc.concat([rec]);
    list.sort(function (a, b) { return a.t - b.t || (a.id < b.id ? -1 : 1); });
    setEncs(list);
    if (cam !== session) { return; }
    cam.saved = { rec: rec, isNew: isNew };
    cam.saving = false;
    camDrop();
    camSet('done');
  }).catch(function () {
    freeCanvas(th);
    if (cam === session) {
      cam.saving = false;
      if (btn && doc.body.contains(btn)) { btn.disabled = false; if (lab) { lab.textContent = '收进图鉴'; } }
    }
    toast('没能保存。手机的存储空间可能不够了。');
  });
}

/* ---- 40-sheets: one encounter, editing, backup, wipe ------------------------------------ */

var BY_ZH = { ai: '手机一眼认出', pick: '从候选里选的', miss: '手机没认出来，自己搜的', manual: '自己选的' };

function showEnc(id) {
  var e = S.byId[id];
  if (!e) { return; }
  var s = C.species(e.sp);
  var h = '<div class="big-photo"><img alt="' + esc(C.label(e.sp, e.form)) + ' 的照片" data-ph="' + e.id + '"></div>' +
    '<button class="card enc" data-act="sp" data-sp="' + e.sp + '" style="grid-template-columns:52px 1fr auto"><span class="enc-img" style="width:52px;height:52px;background:none">' + refImg(e.sp, e.form) + '</span>' +
    '<span class="enc-t"><span class="enc-zh">' + esc(C.label(e.sp, e.form)) + '</span><span class="enc-m"><span class="num">' + C.no(e.sp) + '</span> · ' + esc(s.en) + '</span></span>' + ICON.chev + '</button>' +
    '<div class="card pad"><dl class="kv"><dt>时间</dt><dd>' + esc(fmtDay(e.d)) + ' ' + esc(weekday(e.d)) + ' ' + esc(fmtTime(e.t)) + '</dd>' +
    (e.cat ? '<dt>它是</dt><dd>' + esc(C.CAT_ZH[e.cat]) + '</dd>' : '') +
    (e.place ? '<dt>地点</dt><dd>' + esc(e.place) + '</dd>' : '') +
    '<dt>怎么认的</dt><dd>' + esc(BY_ZH[e.by] || BY_ZH.manual) + '</dd></dl></div>' +
    (e.note ? '<div class="note-box">' + esc(e.note) + '</div>' : '') +
    '<div class="row"><button class="btn" data-act="enc-edit" data-id="' + e.id + '">' + ICON.edit + '修改</button><button class="btn btn-danger" data-act="enc-del" data-id="' + e.id + '">' + ICON.trash + '删除</button></div>';
  openSheet('相遇记录', h);
}

var ed = null;
function localInput(ms) {
  var d = new Date(ms);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function editEnc(id) {
  var e = S.byId[id];
  if (!e) { return; }
  ed = { id: id, sp: e.sp, form: e.form, cat: e.cat, place: e.place, note: e.note, when: localInput(e.t), q: '' };
  openSheet('修改记录', editHtml());
}
function editHtml() {
  var s = C.species(ed.sp);
  var h = '<div class="field"><span class="lab">是哪一只</span><div class="form have" style="min-height:60px"><span class="form-img">' + refImg(ed.sp, ed.form) + '</span><span class="form-t">' + esc(C.label(ed.sp, ed.form)) +
    '<br><span class="form-k num">' + C.no(ed.sp) + '</span></span></div>' +
    '<div class="search plain"><input id="edQ" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="认错了？搜名字或编号换一只" aria-label="搜索换一只" value="' + esc(ed.q) + '" data-in="ed-q">' + ICON.search + '</div>' +
    '<div class="forms" id="edFound">' + edFound() + '</div></div>';
  if (s.forms.length) {
    h += '<div class="field"><span class="lab">形态</span><div class="chips"><button class="chip" data-act="ed-form" data-v="0" aria-pressed="' + (!ed.form) + '">普通</button>' +
      s.forms.map(function (fid) { var f = C.form(fid); return '<button class="chip" data-act="ed-form" data-v="' + fid + '" aria-pressed="' + (ed.form === fid) + '">' + esc(formShort(f, s.zh)) + '</button>'; }).join('') + '</div></div>';
  }
  h += '<div class="field"><span class="lab">它是什么</span><div class="chips">' + C.CATS.map(function (c) {
    return '<button class="chip" data-act="ed-cat" data-v="' + c.key + '" aria-pressed="' + (ed.cat === c.key) + '">' + esc(c.zh) + '</button>';
  }).join('') + '</div></div>';
  h += '<div class="field"><label for="edPlace">地点</label><input class="inp" id="edPlace" maxlength="' + C.MAX_PLACE + '" autocomplete="off" enterkeyhint="done" value="' + esc(ed.place) + '" data-in="ed-place"></div>';
  h += '<div class="field"><label for="edNote">冒险笔记</label><textarea class="inp" id="edNote" maxlength="' + C.MAX_NOTE + '" data-in="ed-note">' + esc(ed.note) + '</textarea></div>';
  h += '<div class="field"><label for="edWhen">时间</label><input class="inp" id="edWhen" type="datetime-local" value="' + esc(ed.when) + '" data-in="ed-when"></div>';
  h += '<div class="row"><button class="btn" data-act="sheet-close">取消</button><button class="btn btn-ink" data-act="ed-save">保存</button></div>';
  return h;
}
function edFound() {
  if (!ed || !C.fold(ed.q)) { return ''; }
  var list = C.search(ed.q, { limit: 6 });
  if (!list.length) { return '<p class="hint">没找到叫这个名字的。</p>'; }
  return list.map(function (r) {
    return '<button class="form" data-act="ed-pick" data-sp="' + r.sp + '" data-form="' + r.form + '"><span class="form-img">' + refImg(r.sp, r.form) + '</span>' +
      '<span class="form-t">' + esc(C.label(r.sp, r.form)) + '<br><span class="form-k num">' + C.no(r.sp) + '</span></span></button>';
  }).join('');
}
function editSave() {
  var old = ed && S.byId[ed.id];
  if (!old) { closeSheet(); return; }
  var t = old.t;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(ed.when)) {
    var p = ed.when.split(/[-T:]/).map(Number);
    var nt = new Date(p[0], p[1] - 1, p[2], p[3], p[4]).getTime();
    if (isFinite(nt) && nt <= Date.now() + 60000 && localInput(nt) !== localInput(old.t)) { t = nt; }
  }
  var now = Date.now();
  var rec = C.sanitizeEnc({
    id: old.id, sp: ed.sp, form: ed.form, t: t, d: t === old.t ? old.d : C.dayKey(t), cat: ed.cat, place: ed.place, note: ed.note,
    by: ed.sp === old.sp ? old.by : 'manual', rank: ed.sp === old.sp ? old.rank : -1, u: now
  }, now);
  if (!rec) { toast('这个时间不对，改一下再保存'); return; }
  dbTx(['enc'], 'readwrite', function (tx) { tx.objectStore('enc').put(rec); }).then(function () {
    var list = S.enc.map(function (e) { return e.id === rec.id ? rec : e; });
    list.sort(function (a, b) { return a.t - b.t || (a.id < b.id ? -1 : 1); });
    setEncs(list);
    if (S.ex) { S.ex.forEach(function (x) { if (x.id === rec.id) { x.sp = rec.sp; x.form = rec.form; } }); }
    ed = null;
    closeSheet();
    render(true);
    toast('已保存');
  }).catch(function () { toast('没能保存，再试一次'); });
}
function delEnc(id) {
  var e = S.byId[id];
  if (!e) { return; }
  Promise.all([dbGet('photo', id), dbGet('thumb', id), dbGet('feat', id)]).then(function (keep) {
    return dbTx(['enc', 'photo', 'thumb', 'feat'], 'readwrite', function (tx) {
      ['enc', 'photo', 'thumb', 'feat'].forEach(function (n) { tx.objectStore(n).delete(id); });
    }).then(function () {
      setEncs(S.enc.filter(function (x) { return x.id !== id; }));
      var exKeep = null;
      if (S.ex) { S.ex = S.ex.filter(function (x) { if (x.id === id) { exKeep = x; return false; } return true; }); }
      dropUrls(id);
      closeSheet();
      render(true);
      toast('已删除这条记录', '撤销', function () {
        dbTx(['enc', 'photo', 'thumb', 'feat'], 'readwrite', function (tx) {
          tx.objectStore('enc').put(e);
          if (keep[0]) { tx.objectStore('photo').put(keep[0], id); }
          if (keep[1]) { tx.objectStore('thumb').put(keep[1], id); }
          if (keep[2]) { tx.objectStore('feat').put(keep[2], id); }
        }).then(function () {
          var list = S.enc.concat([e]);
          list.sort(function (a, b) { return a.t - b.t || (a.id < b.id ? -1 : 1); });
          setEncs(list);
          if (S.ex && exKeep) { S.ex.push(exKeep); }
          render(true);
        }).catch(function () { toast('没能恢复'); });
      });
    });
  }).catch(function () { toast('没能删除，再试一次'); });
}

/* ------------------------------------------------------------ backup */

var bk = null;
function exportBackup() {
  if (!S.enc.length) { toast('还没有记录，不用备份'); return; }
  openSheet('保存备份文件', '<p id="bkMsg">正在打包记录和照片…</p><div class="meter"><i id="bkBar"></i></div><p class="hint">照片多的话要等一会儿，别关掉这个页面。</p>');
  var list = S.enc.slice(), z = C.zipWriter(), parts = [], feats = {}, i = 0, missing = 0;
  bk = null;
  function add(name, buf) { parts.push(new Blob(z.add(name, new Uint8Array(buf)))); }
  function step() {
    if (topLayer() !== 'sheet' || !$('#bkBar')) { return Promise.reject(new Error('cancelled')); }
    if (i >= list.length) { return Promise.resolve(); }
    var e = list[i++];
    return Promise.all([dbGet('photo', e.id), dbGet('thumb', e.id), dbGet('feat', e.id)]).then(function (r) {
      if (r[0] && r[0].b) { add('photos/' + e.id + '.jpg', r[0].b); } else { missing++; }
      if (r[1] && r[1].b) { add('thumbs/' + e.id + '.jpg', r[1].b); }
      if (r[2] && (r[2].b || r[2].s)) {
        if (r[2].b) { add('feat/' + e.id + '.bin', r[2].b); }
        if (r[2].s) { add('sig/' + e.id + '.bin', r[2].s); }
        feats[e.id] = [String(r[2].tag || ''), String(r[2].bb || '')];
      }
      var bar = $('#bkBar');
      if (bar) { bar.style.width = Math.round(i / list.length * 100) + '%'; }
      return step();
    });
  }
  step().then(function () {
    var man = C.backupManifest(list, R.status().tag, Date.now());
    man.feat = feats;
    parts.push(new Blob(z.add('data.json', C.utf8(JSON.stringify(man)))));
    parts.push(new Blob(z.finish()));
    var blob = new Blob(parts, { type: 'application/zip' });
    var d = C.dayKey(Date.now()).replace(/-/g, '');
    bk = { blob: blob, name: 'encounter-dex-backup-' + d + '.zip' };
    var body = $('#sheetBody');
    if (!body) { return; }
    body.innerHTML = '<p><b>备份文件准备好了</b></p><p class="hint">' + list.length + ' 条记录，' + fmtBytes(blob.size) + (missing ? '（有 ' + missing + ' 条的照片没找到）' : '') +
      '。存到「文件」、网盘或者发到电脑上都行；它是一个普通的 zip，照片在里面的 photos 文件夹。</p>' +
      '<button class="btn btn-primary btn-block" data-act="backup-save">' + ICON.down + '保存到手机</button>';
  }).catch(function (err) {
    if (err && err.message === 'cancelled') { return; }
    var body = $('#sheetBody');
    if (body) { body.innerHTML = '<p><b>没能打包</b></p><p class="hint">可能是照片太多、内存不够。关掉别的 App 再试一次。</p>'; }
  });
}
function saveBackupFile() {
  if (!bk) { return; }
  var file = null;
  try { file = new File([bk.blob], bk.name, { type: 'application/zip' }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).then(function () { toast('已交给系统保存'); }).catch(function (err) {
      if (err && err.name === 'AbortError') { return; }
      downloadBlob(bk.blob, bk.name);
    });
    return;
  }
  downloadBlob(bk.blob, bk.name);
}
function downloadBlob(blob, name) {
  var url = URL.createObjectURL(blob), a = doc.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  doc.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) { a.parentNode.removeChild(a); } }, 4000);
  toast('备份文件已开始下载');
}

var imp = null;
function importPick(file) {
  if (!file) { return; }
  imp = null;
  openSheet('从备份文件恢复', '<p>正在读取备份文件…</p>');
  var read = function (a, b) { return blobBuffer(file.slice(a, b)).then(function (ab) { return new Uint8Array(ab); }); };
  C.zipOpen(read, file.size).then(function (zip) {
    return zip.get('data.json').then(function (u8) {
      if (!u8) { throw new Error('no data'); }
      var raw = C.fromUtf8(u8), man = C.readManifest(raw, Date.now()), feat = {};
      try {
        var o = JSON.parse(raw).feat;
        if (o && typeof o === 'object') {
          Object.keys(o).forEach(function (k) {
            var v = o[k];
            if (C.validId(k) && Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string') { feat[k] = [v[0].slice(0, 40), v[1].slice(0, 40)]; }
          });
        }
      } catch (e) { feat = {}; }
      imp = { zip: zip, enc: man.enc, feat: feat, exported: man.exported };
      var body = $('#sheetBody');
      if (!body) { return; }
      if (!man.enc.length) { body.innerHTML = '<p><b>这个备份里没有记录</b></p>'; return; }
      var when = /^\d{4}-\d{2}-\d{2}/.test(man.exported) ? man.exported.slice(0, 10) : '';
      body.innerHTML = '<p><b>备份里有 ' + man.enc.length + ' 条记录</b>' + (when ? '（' + esc(when) + ' 保存的）' : '') + '</p>' +
        (S.enc.length ? '<p class="hint">这台设备上现在有 ' + S.enc.length + ' 条记录。「合并进来」只添加这里没有的；「换成备份里的」会先删掉现在这些。</p>' +
          '<div class="row"><button class="btn btn-primary" data-act="import-go" data-v="merge">合并进来</button><button class="btn btn-danger" data-act="import-go" data-v="replace">换成备份里的</button></div>'
          : '<button class="btn btn-primary btn-block" data-act="import-go" data-v="merge">恢复这些记录</button>');
    });
  }).catch(function () {
    var body = $('#sheetBody');
    if (body) { body.innerHTML = '<p><b>这个文件读不出来</b></p><p class="hint">请选用「保存备份文件」得到的 zip。如果它被重新压缩或者改过，可能就读不了了。</p>'; }
  });
}
function importGo(mode) {
  if (!imp) { return; }
  var job = imp, body = $('#sheetBody');
  imp = null;
  body.innerHTML = '<p id="bkMsg">正在恢复…</p><div class="meter"><i id="bkBar"></i></div><p class="hint">别关掉这个页面。</p>';
  var start = Promise.resolve();
  if (mode === 'replace') {
    start = dbTx(['enc', 'photo', 'thumb', 'feat'], 'readwrite', function (tx) { ['enc', 'photo', 'thumb', 'feat'].forEach(function (n) { tx.objectStore(n).clear(); }); })
      .then(function () { Object.keys(S.byId).forEach(dropUrls); setEncs([]); S.ex = null; });
  }
  var added = 0, noPhoto = 0;
  start.then(function () {
    var m = C.mergeLists(S.enc, job.enc), local = {};
    S.enc.forEach(function (e) { local[e.id] = e; });
    var todo = job.enc.filter(function (e) { return !local[e.id] || local[e.id].u < e.u; });
    var i = 0;
    function step() {
      if (i >= todo.length) { return Promise.resolve(); }
      var e = todo[i++], fresh = !local[e.id];
      var get = fresh ? Promise.all([
        job.zip.get('photos/' + e.id + '.jpg').catch(function () { return null; }),
        job.zip.get('thumbs/' + e.id + '.jpg').catch(function () { return null; }),
        job.zip.get('feat/' + e.id + '.bin').catch(function () { return null; }),
        job.zip.get('sig/' + e.id + '.bin').catch(function () { return null; })
      ]) : Promise.resolve([null, null, null, null]);
      return get.then(function (r) {
        var photo = r[0] && C.imageType(r[0]) && r[0].length < 12000000 ? r[0] : null;
        var thumb = r[1] && C.imageType(r[1]) && r[1].length < 2000000 ? r[1] : null;
        var tags = Object.prototype.hasOwnProperty.call(job.feat, e.id) ? job.feat[e.id] : null;
        var feat = tags && r[2] && r[2].length > 8 && r[2].length < 20000 ? r[2] : null;
        var sig = tags && r[3] && C.sigUnpack(r[3]) ? r[3] : null;
        function own(u8) { return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); }
        if (fresh && !photo) { noPhoto++; }
        return dbTx(['enc', 'photo', 'thumb', 'feat'], 'readwrite', function (tx) {
          tx.objectStore('enc').put(e);
          if (photo) { tx.objectStore('photo').put({ b: photo.buffer.slice(photo.byteOffset, photo.byteOffset + photo.byteLength) }, e.id); }
          if (thumb || photo) { var t = thumb || photo; tx.objectStore('thumb').put({ b: t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) }, e.id); }
          if (feat || sig) { tx.objectStore('feat').put({ b: feat ? own(feat) : null, s: sig ? own(sig) : null, tag: tags[0], bb: tags[1] }, e.id); }
        });
      }).then(function () {
        if (fresh) { added++; }
        var bar = $('#bkBar');
        if (bar) { bar.style.width = Math.round(i / todo.length * 100) + '%'; }
        return step();
      });
    }
    return step().then(function () {
      setEncs(m.list); S.ex = null;
      render(true);
      var b2 = $('#sheetBody');
      if (b2) {
        b2.innerHTML = '<p><b>恢复好了</b></p><p class="hint">新增 ' + added + ' 条' + (m.updated ? '，更新 ' + m.updated + ' 条' : '') + (m.same ? '，' + m.same + ' 条本来就有' : '') +
          (noPhoto ? '。有 ' + noPhoto + ' 条的照片在备份里没找到' : '') + '。现在一共 ' + S.enc.length + ' 条记录。</p><button class="btn btn-ink btn-block" data-act="sheet-close">好</button>';
      }
    });
  }).catch(function () {
    dbAll('enc').then(function (rows) { setEncs(C.sanitizeList(rows.map(function (r) { return r.value; }), Date.now())); S.ex = null; render(true); }).catch(function () { /* keep what is on screen */ });
    var b3 = $('#sheetBody');
    if (b3) { b3.innerHTML = '<p><b>恢复到一半出了问题</b></p><p class="hint">已经恢复的部分保留着。存储空间可能不够了；腾出空间以后再恢复一次，不会重复。</p>'; }
  });
}

function wipeAsk() {
  if (!S.enc.length) { toast('现在没有任何记录'); return; }
  openSheet('清空全部记录', '<p>要删除这台设备上的 <b>' + S.enc.length + '</b> 条相遇记录和照片吗？</p><p class="hint">删了就找不回来了。想留一份的话，先保存备份文件。</p>' +
    '<div class="row"><button class="btn" data-act="backup-export">先去备份</button><button class="btn btn-danger" data-act="wipe-yes">全部删除</button></div>');
}
function wipeYes() {
  dbTx(['enc', 'photo', 'thumb', 'feat'], 'readwrite', function (tx) { ['enc', 'photo', 'thumb', 'feat'].forEach(function (n) { tx.objectStore(n).clear(); }); }).then(function () {
    Object.keys(S.byId).forEach(dropUrls);
    setEncs([]); S.ex = [];
    closeSheet();
    render();
    toast('已清空');
  }).catch(function () { toast('没能清空，再试一次'); });
}

/* ---- 50-boot: actions and start-up ------------------------------------------------------ */

function openSpecies(sp) {
  if (!C.species(sp)) { return; }
  if (topLayer() === 'sheet') { popLayer(); }
  if (S.page) { S.page = { kind: 'sp', sp: sp }; render(); return; }
  S.scrollMemo.y = window.scrollY;
  S.page = { kind: 'sp', sp: sp };
  pushLayer('page', function () {
    S.page = null;
    render(true);
    window.scrollTo(0, S.scrollMemo.y || 0);
  });
  render();
}
function setTab(tab) {
  while (layers.length) { popLayer(); }
  S.tab = tab;
  S.mine.shown = 60;
  render();
  var v = $('#view');
  if (v) { try { v.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
}
function startModel() {
  if (!S.prefs.auto) { return; }
  R.start();      /* after a failure too: the files already on the phone are used again, nothing is downloaded twice */
}

var natTimer = 0;
var ACT = {
  'tab': function (el) { setTab(el.getAttribute('data-tab')); },
  'back': function () { if (topLayer() === 'page') { popLayer(); } },
  'sp': function (el) { openSpecies(+el.getAttribute('data-sp')); },
  'enc': function (el) { showEnc(el.getAttribute('data-id')); },
  'enc-edit': function (el) { editEnc(el.getAttribute('data-id')); },
  'enc-del': function (el) { delEnc(el.getAttribute('data-id')); },
  'ed-pick': function (el) {
    var sp = +el.getAttribute('data-sp'), f = C.form(+el.getAttribute('data-form'));
    if (!C.species(sp)) { return; }
    ed.sp = sp; ed.form = f && f.sp === sp ? f.id : 0; ed.q = '';
    $('#sheetBody').innerHTML = editHtml();
  },
  'ed-form': function (el) { ed.form = +el.getAttribute('data-v') || 0; $('#sheetBody').innerHTML = editHtml(); },
  'ed-cat': function (el) { var v = el.getAttribute('data-v'); ed.cat = ed.cat === v ? '' : v; $('#sheetBody').innerHTML = editHtml(); },
  'ed-save': function () { editSave(); },
  'mine-tab': function (el) { S.mine.tab = el.getAttribute('data-v'); S.mine.shown = 60; if (S.tab !== 'mine' || S.page) { setTab('mine'); } else { render(); } },
  'mine-sort': function (el) { S.mine.sort = el.getAttribute('data-v'); S.mine.shown = 60; renderView(true); },
  'nat-set': function (el) {
    var k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
    if (k === 'status') { S.nat.status = v; }
    else if (k === 'gen') { S.nat.gen = +v || 0; }
    else if (k === 'type') { S.nat.type = +v; }
    else if (k === 'kind') { S.nat.kind = v || ''; }
    if (el.hasAttribute('data-sheet')) { $('#sheetBody').innerHTML = natFilterSheet(); }
    $$('.seg [data-k="status"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === S.nat.status)); });
    var chips = $('#natChips');
    if (chips) { chips.innerHTML = natFilterChips(); }
    renderNatGrid();
  },
  'nat-filter': function () { openSheet('筛选图鉴', natFilterSheet()); },
  'nat-reset': function () {
    S.nat.gen = 0; S.nat.type = -1; S.nat.kind = '';
    $('#sheetBody').innerHTML = natFilterSheet();
    var chips = $('#natChips');
    if (chips) { chips.innerHTML = natFilterChips(); }
    renderNatGrid();
  },
  'nat-clear': function () { S.nat.q = ''; var i = $('#natQ'); if (i) { i.value = ''; i.focus(); } var c = $('.search .clr'); if (c) { c.hidden = true; } renderNatGrid(); },
  'sheet-close': function () { closeSheet(); },
  'toast-act': function () { var fn = toastFn; $('#toast').hidden = true; toastFn = null; if (fn) { fn(); } },
  'cam-open': function (el) {
    var sp = +el.getAttribute('data-sp'), f = +el.getAttribute('data-form');
    camOpen(C.species(sp) ? { sp: sp, form: C.form(f) && C.form(f).sp === sp ? f : 0 } : null);
  },
  'cam-close': function () { camClose(); },
  'cam-flip': function () { if (cam) { cam.facing = cam.facing === 'environment' ? 'user' : 'environment'; camStart(); } },
  'cam-zoom': function (el) {
    if (!cam) { return; }
    cam.zoom = +el.getAttribute('data-v') === 2 ? 2 : 1;
    $$('.zoom button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-v') === cam.zoom)); });
    var v = $('#camVideo');
    if (v) { v.style.transform = cam.zoom > 1 ? 'scale(' + cam.zoom + ')' : ''; }
  },
  'cam-shoot': function () { camShoot(); },
  'cam-album': function () { $('#fileAlbum').click(); },
  'cam-system': function () { if (cam) { camStop(); camSet('system'); $('#fileCamera').click(); } },
  'cam-live': function () { if (cam) { camSet('live'); camStart(); } },
  'cam-retry': function () { camStart(); },
  'cam-retake': function () { camRetake(); },
  'cam-use': function () { cropUse(); },
  'cam-pick': function (el) { if (cam) { camPick(+el.getAttribute('data-i')); } },
  'cam-pick-sp': function (el) { if (cam) { camPickSp(+el.getAttribute('data-sp'), +el.getAttribute('data-form')); } },
  'cam-repick': function () { if (cam) { cam.pick = null; camSet('pick'); } },
  'cam-search': function () { var q = $('#camQ'); if (q) { q.focus(); try { q.scrollIntoView({ block: 'center' }); } catch (e) { /* older browsers scroll on focus anyway */ } } },
  'cam-form': function (el) { if (cam && cam.pick) { cam.pick.form = +el.getAttribute('data-v') || 0; keepFields(); camSet('detail'); } },
  'cam-cat': function (el) {
    if (!cam) { return; }
    var v = el.getAttribute('data-v');
    cam.cat = cam.cat === v ? '' : v;
    $$('#camCats .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === cam.cat)); });
  },
  'cam-place': function (el) { if (cam) { cam.place = el.getAttribute('data-v'); var i = $('#camPlace'); if (i) { i.value = cam.place; } } },
  'cam-save': function () { keepFields(); camSave(); },
  'cam-again': function () { camRetake(); },
  'cam-view': function () { if (cam && cam.saved) { var sp = cam.saved.rec.sp; camClose(); openSpecies(sp); } },
  'pref-auto': function () { S.prefs.auto = !S.prefs.auto; savePrefs(); if (S.prefs.auto) { startModel(); } renderView(true); deckSync(); },
  'pref-cam': function () { S.prefs.cam = S.prefs.cam === 'system' ? 'live' : 'system'; savePrefs(); renderView(true); },
  'pref-sprites': function () { S.prefs.sprites = !S.prefs.sprites; savePrefs(); renderView(true); },
  'pref-theme': function (el) { S.prefs.theme = el.getAttribute('data-v'); savePrefs(); applyTheme(); renderView(true); },
  'model-retry': function () {
    if (!S.prefs.auto) { S.prefs.auto = true; savePrefs(); }
    R.start();
    renderView(true);
  },
  /* throw the saved model files away and fetch them again; without a network that would only lose them */
  'model-reset': function () {
    if (navigator.onLine === false) { toast('现在没有网络，连上网以后再重新下载'); return; }
    if (!S.prefs.auto) { S.prefs.auto = true; savePrefs(); }
    R.reset();
    renderView(true);
  },
  'backup-export': function () { exportBackup(); },
  'backup-save': function () { saveBackupFile(); },
  'backup-import': function () { $('#fileBackup').click(); },
  'import-go': function (el) { importGo(el.getAttribute('data-v') === 'replace' ? 'replace' : 'merge'); },
  'wipe': function () { wipeAsk(); },
  'wipe-yes': function () { wipeYes(); }
};
function keepFields() {
  if (!cam) { return; }
  var p = $('#camPlace'), n = $('#camNote');
  if (p) { cam.place = p.value; }
  if (n) { cam.note = n.value; }
}

doc.addEventListener('click', function (e) {
  var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!el || el.disabled) {
    if (e.target && e.target.id === 'sheetHost') { closeSheet(); }
    return;
  }
  var fn = ACT[el.getAttribute('data-act')];
  if (fn) { fn(el, e); }
});
doc.addEventListener('input', function (e) {
  var el = e.target, k = el && el.getAttribute ? el.getAttribute('data-in') : '';
  if (!k) { return; }
  if (k === 'nat-q') {
    S.nat.q = el.value;
    var c = $('.search .clr');
    if (c) { c.hidden = !el.value; }
    clearTimeout(natTimer);
    natTimer = setTimeout(function () { renderNatGrid(); }, 140);
  } else if (k === 'cam-q' && cam) {
    cam.q = el.value;
    var f = $('#camFound');
    if (f) { f.innerHTML = foundHtml(); }
  } else if (k === 'cam-place' && cam) { cam.place = el.value; }
  else if (k === 'cam-note' && cam) {
    cam.note = el.value;
    var n = $('#camNoteN');
    if (n) { n.textContent = el.value.length + ' / ' + C.MAX_NOTE; }
  } else if (k === 'cam-crop-zoom' && cam && cam.crop) { cam.crop.scale = clamp(+el.value || 1, 1, 4); cropDraw(); }
  else if (k === 'ed-q' && ed) { ed.q = el.value; var ef = $('#edFound'); if (ef) { ef.innerHTML = edFound(); } }
  else if (k === 'ed-place' && ed) { ed.place = el.value; }
  else if (k === 'ed-note' && ed) { ed.note = el.value; }
  else if (k === 'ed-when' && ed) { ed.when = el.value; }
});
var DONE_ON_ENTER = ['nat-q', 'cam-q', 'ed-q', 'cam-place', 'ed-place'];
doc.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (topLayer() === 'sheet' || topLayer() === 'cam' || topLayer() === 'page') { popLayer(); }
  } else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target && e.target.getAttribute && DONE_ON_ENTER.indexOf(e.target.getAttribute('data-in')) >= 0) {
    /* the return key puts the keyboard away, so that the keys of the machine can be reached again;
       not while Chinese is being typed, when the return key belongs to the keyboard */
    e.target.blur();
  }
});
/* A tap beside the field that is being typed in puts the keyboard away. Phones do not always do this by
 * themselves, and the keys of the machine sit behind the keyboard. A drag (scrolling the form) is not a tap. */
var tapAt = null;
function typingIn(el) { return !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search)$/.test(el.type))); }
doc.addEventListener('touchstart', function (e) {
  tapAt = e.touches && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
}, { passive: true });
doc.addEventListener('touchend', function (e) {
  var a = doc.activeElement, from = tapAt, c = e.changedTouches && e.changedTouches[0], t = e.target;
  tapAt = null;
  if (!from || !c || (e.touches && e.touches.length) || !typingIn(a)) { return; }
  if (Math.abs(c.clientX - from.x) > 10 || Math.abs(c.clientY - from.y) > 10 || Date.now() - from.t > 700) { return; }
  if (t === a || (t && t.closest && t.closest('input, textarea, label, .search'))) { return; }
  a.blur();
}, { passive: true });
['fileAlbum', 'fileCamera'].forEach(function (id) {
  $('#' + id).addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (f) { camFile(f); }
  });
});
$('#fileBackup').addEventListener('change', function () {
  var f = this.files && this.files[0];
  this.value = '';
  if (f) { importPick(f); }
});

/* recognition model status -> small parts of the screen */
R.on(function (m) {
  var before = S.model.state;
  S.model = m;
  deckSync();
  if (cam) {
    camPill();
    if (m.state === 'ready' && cam.phase === 'pick' && S.prefs.auto && !cam.res && !cam.thinking && cam.canvas) { camRecog(); camSet('pick'); }
  }
  if (m.state === before) {
    var bar = $('#modelCard .meter i');
    if (bar && m.total) { bar.style.width = Math.round(m.loaded / m.total * 100) + '%'; }
    var line = $('#modelLine');
    if (line) { line.textContent = modelLine(); }
  } else if (!cam && $('#sheetHost').hidden && !S.page && (S.tab === 'home' || S.tab === 'prefs')) {
    renderView(true);
  }
});

function refreshDay() {
  setEncs(S.enc);
  if (!cam && $('#sheetHost').hidden) { render(true); }
}
function armMidnight() {
  var now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 30);
  setTimeout(function () { refreshDay(); armMidnight(); }, Math.min(next - now, 2000000000));
}
var lastDay = C.dayKey(Date.now());
doc.addEventListener('visibilitychange', function () {
  if (doc.hidden) {
    if (cam && cam.phase === 'live') { camStop(); }
    return;
  }
  if (cam && cam.phase === 'live') { camStart(); }
  var d = C.dayKey(Date.now());
  if (d !== lastDay) { lastDay = d; refreshDay(); }
});

function boot() {
  /* the app restores scroll positions itself when a page is closed */
  try { history.scrollRestoration = 'manual'; } catch (e) { /* older browsers */ }
  applyTheme();
  setEncs([]);
  render();
  dbOpen().then(function () {
    return dbAll('enc').then(function (rows) {
      setEncs(C.sanitizeList(rows.map(function (r) { return r.value; }), Date.now()));
    });
  }).catch(function () { S.dbOk = false; db = null; }).then(function () {
    S.ready = true;
    doc.documentElement.setAttribute('data-ready', '1');
    render();
    armMidnight();
    if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () { /* optional */ }); }
    setTimeout(startModel, ENV.modelDelay === undefined ? 900 : ENV.modelDelay);
  });
  if ('serviceWorker' in navigator && !ENV.noSW && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
  }
}
window.__encdex = { S: S, cam: function () { return cam; } };
boot();

})();
