/* 相遇图鉴 (Encounter Dex) core: data model, search, statistics, recognition scoring, backup files.
 * No DOM access here, so the same file runs in the page, in a worker and under Node for tests. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(require('./dex.js')); }
  else { root.DexCore = factory(root.DEX_DATA); }
})(typeof self !== 'undefined' ? self : this, function (DATA) {
  'use strict';

  var VERSION = '1.1.0';
  var APP_ID = 'encounter-dex';
  var TOTAL = DATA.sp.length;

  /* ------------------------------------------------------------------ dex */

  var TYPES = DATA.types.map(function (t, i) { return { i: i, key: t[0], zh: t[1] }; });
  var KINDS = DATA.kinds.map(function (k) { return { key: k[0], zh: k[1] }; });
  var KIND_ZH = {};
  KINDS.forEach(function (k) { KIND_ZH[k.key] = k.zh; });
  var REGIONS = ['', '关都', '城都', '丰缘', '神奥', '合众', '卡洛斯', '阿罗拉', '伽勒尔', '帕底亚'];
  var CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

  var SPECIES = DATA.sp.map(function (r, i) {
    return { id: i + 1, zh: r[0], en: r[1], ja: r[2], gen: r[3], t1: r[4], t2: r[5], flags: r[6], genus: r[7], py: r[8], forms: [] };
  });
  var FORMS = DATA.forms.map(function (r) {
    return { id: r[0], sp: r[1], kind: r[2], zh: r[3], en: r[4], t1: r[5], t2: r[6] };
  });
  var FORM_BY_ID = {};
  FORMS.forEach(function (f) { FORM_BY_ID[f.id] = f; if (SPECIES[f.sp - 1]) { SPECIES[f.sp - 1].forms.push(f.id); } });
  var GENS = [];
  SPECIES.forEach(function (s) { GENS[s.gen] = (GENS[s.gen] || 0) + 1; });
  var GEN_LIST = [];
  for (var g = 1; g < GENS.length; g++) { if (GENS[g]) { GEN_LIST.push({ gen: g, total: GENS[g] }); } }

  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function species(id) { return isInt(id) && id >= 1 && id <= TOTAL ? SPECIES[id - 1] : null; }
  function form(id) { return Object.prototype.hasOwnProperty.call(FORM_BY_ID, id) ? FORM_BY_ID[id] : null; }
  function pad4(n) { var s = String(n); while (s.length < 4) { s = '0' + s; } return s; }
  function no(id) { return 'No.' + pad4(id); }
  function genName(g) { return '第' + (CN_NUM[g] || g) + '世代'; }
  function genLabel(g) { return REGIONS[g] ? genName(g) + ' · ' + REGIONS[g] : genName(g); }
  /* display name of a species, or of one of its forms */
  function label(sp, formId) {
    var f = formId ? form(formId) : null;
    if (f && f.sp === sp) { return f.zh; }
    var s = species(sp);
    return s ? s.zh : '?';
  }
  function typesOf(sp, formId) {
    var f = formId ? form(formId) : null;
    var o = f && f.sp === sp ? f : species(sp);
    if (!o) { return []; }
    var out = [];
    if (o.t1 >= 0 && TYPES[o.t1]) { out.push(TYPES[o.t1]); }
    if (o.t2 >= 0 && TYPES[o.t2]) { out.push(TYPES[o.t2]); }
    return out;
  }

  /* ----------------------------------------------------------- text utils */

  function toHalfWidth(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xFF01 && c <= 0xFF5E) { out += String.fromCharCode(c - 0xFEE0); }
      else if (c === 0x3000) { out += ' '; }
      else { out += s.charAt(i); }
    }
    return out;
  }
  /* key used for matching: lower case, half width, no spaces or punctuation */
  function fold(s) {
    s = toHalfWidth(String(s == null ? '' : s)).toLowerCase();
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i), c = s.charCodeAt(i);
      if (c <= 0x20) { continue; }
      if (" '`.-_:,;!?()[]{}#/\\\"·・：，。！？（）".indexOf(ch) >= 0) { continue; }
      if (c === 0x2019 || c === 0x2018 || c === 0x2640 || c === 0x2642 || c === 0xE9) {
        if (c === 0xE9) { out += 'e'; }
        continue;
      }
      out += ch;
    }
    return out;
  }
  /* Trim, drop control characters, cap the length without cutting a character in half. */
  function cleanText(s, max) {
    if (typeof s !== 'string') { return ''; }
    var out = '', n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), ch = s.charAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { ch = s.substr(i, 2); i++; } else { continue; }
      } else if (c >= 0xDC00 && c <= 0xDFFF) { continue; }
      else if (c === 0x0A || c === 0x09) { ch = c === 0x0A ? '\n' : ' '; }
      else if (c < 0x20 || c === 0x7F || c === 0x2028 || c === 0x2029 || c === 0xFEFF) { continue; }
      if (n >= max) { break; }
      out += ch; n++;
    }
    return out.replace(/^\s+|\s+$/g, '');
  }

  var SEARCH = SPECIES.map(function (s) {
    var py = s.py.split(' ');
    return { zh: fold(s.zh), en: fold(s.en), ja: fold(s.ja), py: py[0] || '', ini: py[1] || '' };
  });
  var SEARCH_F = FORMS.map(function (f) { return { zh: fold(f.zh), en: fold(f.en) }; });

  /* Find species (and forms) by number, Chinese / English / Japanese name or pinyin.
   * Returns [{sp, form, score}] best first. */
  function search(q, opts) {
    opts = opts || {};
    var limit = opts.limit || 20;
    var raw = toHalfWidth(String(q == null ? '' : q)).toLowerCase().replace(/^\s+|\s+$/g, '');
    raw = raw.replace(/^(no\.?|#|n°)\s*/, '');
    var k = fold(raw);
    if (!k) { return []; }
    var out = [], i, sc;
    if (/^\d+$/.test(k)) {
      var n = parseInt(k, 10);
      for (i = 0; i < TOTAL; i++) {
        var idStr = String(i + 1);
        sc = 0;
        if (i + 1 === n) { sc = 100; }
        else if (idStr.indexOf(String(n)) === 0 && n > 0) { sc = 60 - (idStr.length - String(n).length); }
        else if (pad4(i + 1).indexOf(k) === 0) { sc = 50; }
        if (sc) { out.push({ sp: i + 1, form: 0, score: sc }); }
      }
    } else {
      var ascii = /^[a-z0-9]+$/.test(k);
      for (i = 0; i < TOTAL; i++) {
        var e = SEARCH[i];
        sc = 0;
        if (e.zh === k) { sc = 100; }
        else if (e.zh.indexOf(k) === 0) { sc = 90; }
        else if (e.zh.indexOf(k) > 0) { sc = 75; }
        if (ascii) {
          if (e.en === k) { sc = Math.max(sc, 98); }
          else if (e.en.indexOf(k) === 0) { sc = Math.max(sc, 85); }
          else if (k.length >= 3 && e.en.indexOf(k) > 0) { sc = Math.max(sc, 55); }
          if (e.py === k) { sc = Math.max(sc, 88); }
          else if (e.ini === k && k.length >= 2) { sc = Math.max(sc, 84); }
          else if (k.length >= 2 && e.py.indexOf(k) === 0) { sc = Math.max(sc, 70); }
          else if (k.length >= 2 && e.ini.indexOf(k) === 0) { sc = Math.max(sc, 62); }
        } else if (e.ja && (e.ja === k || e.ja.indexOf(k) >= 0)) { sc = Math.max(sc, e.ja === k ? 96 : 72); }
        if (sc) { out.push({ sp: i + 1, form: 0, score: sc }); }
      }
      if (opts.forms !== false) {
        for (i = 0; i < FORMS.length; i++) {
          var fe = SEARCH_F[i];
          sc = 0;
          if (fe.zh === k) { sc = 97; }
          else if (fe.zh.indexOf(k) >= 0) { sc = 58; }
          else if (ascii && k.length >= 3 && fe.en.indexOf(k) >= 0) { sc = 52; }
          if (sc) { out.push({ sp: FORMS[i].sp, form: FORMS[i].id, score: sc }); }
        }
      }
    }
    out.sort(function (a, b) { return b.score - a.score || a.sp - b.sp || a.form - b.form; });
    return out.slice(0, limit);
  }

  /* Entries of the national list after filtering.
   * f: {status: 'all'|'have'|'need', gen: 0|n, type: -1|i, kind: ''|'mega'|..., q: ''}
   * have: object keyed by species id; haveForms: object keyed by form id. */
  function listDex(f, have, haveForms) {
    f = f || {};
    have = have || {}; haveForms = haveForms || {};
    var out = [], i;
    var qset = null;
    if (f.q && fold(f.q)) {
      qset = {};
      search(f.q, { limit: 5000, forms: !!f.kind }).forEach(function (r) { qset[r.form ? 'f' + r.form : 's' + r.sp] = 1; if (!f.kind) { qset['s' + r.sp] = 1; } });
    }
    var type = isInt(f.type) ? f.type : -1;
    if (f.kind) {
      for (i = 0; i < FORMS.length; i++) {
        var fm = FORMS[i], s = SPECIES[fm.sp - 1];
        if (fm.kind !== f.kind) { continue; }
        if (f.gen && s.gen !== f.gen) { continue; }
        if (type >= 0 && fm.t1 !== type && fm.t2 !== type) { continue; }
        var got = !!haveForms[fm.id];
        if (f.status === 'have' && !got) { continue; }
        if (f.status === 'need' && got) { continue; }
        if (qset && !qset['f' + fm.id] && !qset['s' + fm.sp]) { continue; }
        out.push({ sp: fm.sp, form: fm.id, have: got });
      }
      return out;
    }
    for (i = 0; i < TOTAL; i++) {
      var sp = SPECIES[i];
      if (f.gen && sp.gen !== f.gen) { continue; }
      if (type >= 0 && sp.t1 !== type && sp.t2 !== type) { continue; }
      var h = !!have[sp.id];
      if (f.status === 'have' && !h) { continue; }
      if (f.status === 'need' && h) { continue; }
      if (qset && !qset['s' + sp.id]) { continue; }
      out.push({ sp: sp.id, form: 0, have: h });
    }
    return out;
  }

  /* ---------------------------------------------------------------- dates */

  var DAY = 86400000;
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function isDayKey(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) { return false; }
    var p = s.split('-'), y = +p[0], m = +p[1], d = +p[2];
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2200) { return false; }
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  /* day number counted in UTC so daylight-saving changes never add or lose a day */
  function dayNum(key) { var p = key.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY); }
  function dayFromNum(n) { var d = new Date(n * DAY); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }

  /* -------------------------------------------------------------- records */

  var CATS = [
    { key: 'plush', zh: '玩偶' }, { key: 'figure', zh: '手办' }, { key: 'card', zh: '卡牌' }, { key: 'charm', zh: '挂件' },
    { key: 'food', zh: '食物' }, { key: 'wear', zh: '服饰' }, { key: 'goods', zh: '日用品' }, { key: 'other', zh: '其他' }
  ];
  var CAT_ZH = {};
  CATS.forEach(function (c) { CAT_ZH[c.key] = c.zh; });
  var MAX_PLACE = 40, MAX_NOTE = 200;
  var T_MIN = Date.UTC(2000, 0, 1);

  function newId(now, rnd) {
    var r = '';
    for (var i = 0; i < 6; i++) { r += Math.floor((rnd || Math.random)() * 36).toString(36); }
    return 'e' + Math.floor(now).toString(36) + r;
  }
  function validId(id) { return typeof id === 'string' && /^e[a-z0-9]{8,24}$/.test(id); }

  /* Returns a clean encounter record, or null when the input cannot be used. */
  function sanitizeEnc(o, now) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) { return null; }
    now = now || Date.now();
    if (!validId(o.id)) { return null; }
    if (!species(o.sp)) { return null; }
    var t = o.t;
    if (typeof t !== 'number' || !isFinite(t) || t < T_MIN || t > now + 2 * DAY) { return null; }
    var f = 0;
    if (o.form) { var fm = form(o.form); if (fm && fm.sp === o.sp) { f = fm.id; } }
    var out = {
      id: o.id, sp: o.sp, form: f, t: Math.floor(t),
      d: isDayKey(o.d) && Math.abs(dayNum(o.d) - dayNum(dayKey(t))) <= 1 ? o.d : dayKey(t),
      cat: Object.prototype.hasOwnProperty.call(CAT_ZH, o.cat) ? o.cat : '',
      place: cleanText(o.place, MAX_PLACE).replace(/\n/g, ' '),
      note: cleanText(o.note, MAX_NOTE),
      by: o.by === 'ai' || o.by === 'pick' || o.by === 'miss' || o.by === 'manual' ? o.by : 'manual',
      rank: isInt(o.rank) && o.rank >= -1 && o.rank < 100 ? o.rank : -1,
      u: typeof o.u === 'number' && isFinite(o.u) && o.u >= T_MIN && o.u <= now + 2 * DAY ? Math.floor(o.u) : Math.floor(t)
    };
    return out;
  }
  function sanitizeList(arr, now) {
    var out = [], seen = {};
    if (!Array.isArray(arr)) { return out; }
    for (var i = 0; i < arr.length; i++) {
      var e = sanitizeEnc(arr[i], now);
      if (e && !Object.prototype.hasOwnProperty.call(seen, e.id)) { seen[e.id] = 1; out.push(e); }
    }
    out.sort(function (a, b) { return a.t - b.t || (a.id < b.id ? -1 : 1); });
    return out;
  }

  /* Merge incoming records into the local ones. Same id: the one edited later wins. */
  function mergeLists(local, incoming) {
    var by = {}, out = [], added = 0, updated = 0, same = 0;
    local.forEach(function (e) { by[e.id] = e; });
    incoming.forEach(function (e) {
      var cur = Object.prototype.hasOwnProperty.call(by, e.id) ? by[e.id] : null;
      if (!cur) { by[e.id] = e; added++; }
      else if (e.u > cur.u) { by[e.id] = e; updated++; }
      else { same++; }
    });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    out.sort(function (a, b) { return a.t - b.t || (a.id < b.id ? -1 : 1); });
    return { list: out, added: added, updated: updated, same: same };
  }

  /* ---------------------------------------------------------------- stats */

  /* encs: clean records. Returns everything the pages show. */
  function stats(encs, now) {
    now = now || Date.now();
    var have = {}, haveForms = {}, count = {}, first = {}, last = {}, days = {}, cats = {}, i;
    for (i = 0; i < encs.length; i++) {
      var e = encs[i];
      count[e.sp] = (count[e.sp] || 0) + 1;
      if (!first[e.sp] || e.t < first[e.sp].t) { first[e.sp] = e; }
      if (!last[e.sp] || e.t >= last[e.sp].t) { last[e.sp] = e; }
      have[e.sp] = 1;
      if (e.form) { haveForms[e.form] = 1; }
      days[e.d] = 1;
      cats[e.cat || 'none'] = (cats[e.cat || 'none'] || 0) + 1;
    }
    var ids = Object.keys(have).map(Number);
    var perGen = GEN_LIST.map(function (g) { return { gen: g.gen, total: g.total, have: 0 }; });
    var genIx = {};
    perGen.forEach(function (g, k) { genIx[g.gen] = k; });
    var perType = TYPES.map(function (t) { return { type: t.i, total: 0, have: 0 }; });
    SPECIES.forEach(function (s) {
      if (s.t1 >= 0) { perType[s.t1].total++; }
      if (s.t2 >= 0) { perType[s.t2].total++; }
    });
    ids.forEach(function (id) {
      var s = SPECIES[id - 1];
      perGen[genIx[s.gen]].have++;
      if (s.t1 >= 0) { perType[s.t1].have++; }
      if (s.t2 >= 0) { perType[s.t2].have++; }
    });
    var dayList = Object.keys(days).sort();
    var today = dayNum(dayKey(now));
    var nums = dayList.map(dayNum);
    var streak = 0, best = 0, run = 0, prev = null;
    nums.forEach(function (n) {
      run = prev !== null && n === prev + 1 ? run + 1 : 1;
      if (run > best) { best = run; }
      prev = n;
    });
    if (nums.length) {
      var lastDay = nums[nums.length - 1];
      if (lastDay === today || lastDay === today - 1) {
        streak = 1;
        for (i = nums.length - 2; i >= 0 && nums[i] === nums[i + 1] - 1; i--) { streak++; }
      }
    }
    var firstTimes = ids.map(function (id) { return first[id].t; }).sort(function (a, b) { return a - b; });
    var formTotal = FORMS.length;
    return {
      total: TOTAL, have: have, haveForms: haveForms, species: ids.length, forms: Object.keys(haveForms).length, formTotal: formTotal,
      encounters: encs.length, pct: TOTAL ? ids.length / TOTAL : 0, days: dayList.length, streak: streak, bestStreak: best,
      activeToday: nums.length > 0 && nums[nums.length - 1] === today,
      count: count, first: first, last: last, perGen: perGen, perType: perType, cats: cats,
      firstTimes: firstTimes, forecast: forecast(firstTimes, TOTAL, now)
    };
  }

  /* When will the collection be complete at the current pace?
   * firstTimes: time each species was first recorded, ascending. */
  function forecast(firstTimes, total, now) {
    var c = firstTimes.length;
    if (c >= total) { return { status: 'done', date: c ? dayKey(firstTimes[c - 1]) : '' }; }
    if (!c) { return { status: 'empty' }; }
    var today = dayNum(dayKey(now));
    var span = Math.max(1, today - dayNum(dayKey(firstTimes[0])) + 1);
    if (span < 7 || c < 3) { return { status: 'early', daysLeft: Math.max(0, 7 - span), need: Math.max(0, 3 - c) }; }
    var win = Math.min(span, 30);
    var from = today - win + 1, recent = 0;
    for (var i = c - 1; i >= 0; i--) {
      if (dayNum(dayKey(firstTimes[i])) >= from) { recent++; } else { break; }
    }
    if (!recent) { return { status: 'stalled', window: win, overallPerWeek: c / span * 7 }; }
    var perDay = recent / win;
    var days = Math.ceil((total - c) / perDay);
    var far = days > 36500;
    return {
      status: 'ok', window: win, recent: recent, perWeek: perDay * 7, days: days, far: far,
      date: far ? '' : dayFromNum(today + days), years: days / 365.25, basis: span >= 30 ? 'recent' : 'all'
    };
  }

  /* --------------------------------------------------- recognition scoring */

  var HEAD_MAGIC = 0x31484445; /* "EDH1" little endian */

  /* head file: "EDH1", u32 jsonLen, json (padded to a multiple of 4), bias f32[C], scale f32[C], weights i8[C*D].
   * json: {tag, bb, C, D, size, mean, std, classes, T, crops, simHigh, simLow, modelBytes, selftest: {feat}}
   * tag names this head, bb names the feature model (.onnx) it belongs to. */
  function parseHead(buf) {
    if (!buf || buf.byteLength < 16) { throw new Error('bad head file'); }
    var dv = new DataView(buf);
    if (dv.getUint32(0, true) !== HEAD_MAGIC) { throw new Error('bad head file'); }
    var jl = dv.getUint32(4, true);
    if (jl % 4 !== 0 || jl < 2 || 8 + jl > buf.byteLength) { throw new Error('bad head file'); }
    var meta;
    try { meta = JSON.parse(fromUtf8(new Uint8Array(buf, 8, jl))); } catch (e) { throw new Error('bad head file'); }
    var C = meta.C, D = meta.D, off = 8 + jl;
    if (!isInt(C) || !isInt(D) || C < 1 || D < 1 || C > 20000 || D > 8192 || buf.byteLength !== off + 8 * C + C * D) { throw new Error('bad head size'); }
    if (!Array.isArray(meta.classes) || meta.classes.length !== C) { throw new Error('bad head classes'); }
    return {
      meta: meta, C: C, D: D,
      bias: new Float32Array(buf, off, C), scale: new Float32Array(buf, off + 4 * C, C), W: new Int8Array(buf, off + 8 * C, C * D)
    };
  }
  /* A fixed test picture made from a formula (no camera, no canvas). The same numbers are fed to the
   * model when the head file is made, and what came out is stored in it (meta.selftest.feat: one value
   * 0..255 per feature). Running it again on the phone shows whether the phone computes what it should. */
  function selfTestInput(size, mean, std) {
    var n = size * size, out = new Float32Array(3 * n);
    for (var c = 0; c < 3; c++) {
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var v = (((x * 5 + c * 40) ^ (y * 3)) & 255) / 255;
          out[c * n + y * size + x] = (v - mean[c]) / std[c];
        }
      }
    }
    return out;
  }
  /* how close the phone's answer is to the stored one: 1 = the same; -1 = this head file stores no answer */
  function selfTestScore(meta, feat) {
    var want = meta && meta.selftest && meta.selftest.feat;
    if (!Array.isArray(want) || !feat || want.length !== feat.length) { return -1; }
    var ab = 0, aa = 0, bb = 0;
    for (var i = 0; i < want.length; i++) { ab += want[i] * feat[i]; aa += want[i] * want[i]; bb += feat[i] * feat[i]; }
    if (!(aa > 0) || !(bb > 0) || !isFinite(ab)) { return 0; }
    return ab / Math.sqrt(aa * bb);
  }
  function l2norm(f) {
    var s = 0, i;
    for (i = 0; i < f.length; i++) { s += f[i] * f[i]; }
    s = Math.sqrt(s) || 1;
    var out = new Float32Array(f.length);
    for (i = 0; i < f.length; i++) { out[i] = f[i] / s; }
    return out;
  }
  /* class scores for one L2-normalised feature vector */
  function headLogits(head, feat) {
    var C = head.C, D = head.D, W = head.W, out = new Float32Array(C);
    for (var c = 0, o = 0; c < C; c++, o += D) {
      var s = 0;
      for (var d = 0; d < D; d++) { s += W[o + d] * feat[d]; }
      out[c] = s * head.scale[c] + head.bias[c];
    }
    return out;
  }
  function softmax(logits, T) {
    var m = -Infinity, i, n = logits.length, out = new Float32Array(n), s = 0;
    T = T || 1;
    for (i = 0; i < n; i++) { if (logits[i] > m) { m = logits[i]; } }
    for (i = 0; i < n; i++) { out[i] = Math.exp((logits[i] - m) / T); s += out[i]; }
    for (i = 0; i < n; i++) { out[i] /= s; }
    return out;
  }
  /* Store a feature vector (no negative values) in 1 byte per value: [max as float32][u8 * D].
   * Its length is kept, so the class scores can be worked out again from the stored copy. */
  function packFeat(f) {
    var m = 0, i;
    for (i = 0; i < f.length; i++) { if (f[i] > m) { m = f[i]; } }
    var out = new Uint8Array(4 + f.length);
    new DataView(out.buffer).setFloat32(0, m, true);
    if (m > 0) { for (i = 0; i < f.length; i++) { var v = Math.round(f[i] / m * 255); out[4 + i] = v < 0 ? 0 : v > 255 ? 255 : v; } }
    return out;
  }
  function unpackFeat(u8) {
    var m = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getFloat32(0, true);
    var out = new Float32Array(u8.length - 4);
    if (!isFinite(m) || m < 0) { m = 0; }
    for (var i = 0; i < out.length; i++) { out[i] = u8[4 + i] / 255 * m; }
    return out;
  }
  function cosine(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) { s += a[i] * b[i]; }
    return s;
  }
  /* A short fingerprint of "what this photo looks like to the model": its strongest classes and
   * how far each stands above the rest, as a unit vector {i: class indexes, v: weights}.
   * Two photos of the same thing give similar fingerprints even in front of different backgrounds. */
  var SIG_K = 20;
  function signature(logits, k) {
    k = Math.min(k || SIG_K, logits.length - 1);
    var order = [], i;
    for (i = 0; i < logits.length; i++) { order.push(i); }
    order.sort(function (a, b) { return logits[b] - logits[a] || a - b; });
    var base = logits[order[k]], ids = new Uint16Array(k), vals = new Float32Array(k), s = 0;
    for (i = 0; i < k; i++) { ids[i] = order[i]; vals[i] = logits[order[i]] - base; s += vals[i] * vals[i]; }
    s = Math.sqrt(s) || 1;
    for (i = 0; i < k; i++) { vals[i] /= s; }
    return { i: ids, v: vals };
  }
  function sigCos(a, b) {
    var m = {}, s = 0, k;
    for (k = 0; k < a.i.length; k++) { m[a.i[k]] = a.v[k]; }
    for (k = 0; k < b.i.length; k++) { var x = m[b.i[k]]; if (x) { s += x * b.v[k]; } }
    return s;
  }
  /* 6 bytes per entry: class index (uint16), weight (float32) */
  function sigPack(sig) {
    var n = sig.i.length, out = new Uint8Array(n * 6), dv = new DataView(out.buffer);
    for (var k = 0; k < n; k++) { dv.setUint16(k * 6, sig.i[k], true); dv.setFloat32(k * 6 + 2, sig.v[k], true); }
    return out;
  }
  function sigUnpack(u8, classCount) {
    if (!u8 || u8.length % 6 !== 0 || u8.length < 6 || u8.length > 6 * 64) { return null; }
    var n = u8.length / 6, dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), ids = new Uint16Array(n), vals = new Float32Array(n), s = 0;
    for (var k = 0; k < n; k++) {
      ids[k] = dv.getUint16(k * 6, true); vals[k] = dv.getFloat32(k * 6 + 2, true);
      if (!isFinite(vals[k]) || vals[k] < 0 || (classCount && ids[k] >= classCount)) { return null; }
      s += vals[k] * vals[k];
    }
    s = Math.sqrt(s);
    if (!(s > 0)) { return null; }
    for (k = 0; k < n; k++) { vals[k] /= s; }
    return { i: ids, v: vals };
  }

  /* Turn class probabilities into a short list of species the user can pick from.
   * classes: array of entry ids in head order (1..TOTAL = species, larger = forms).
   * exemplars (optional): [{sp, form, sig}] fingerprints of photos the user confirmed earlier;
   * when the new photo's fingerprint (opts.sig) is close to one of them, its species moves up. */
  function candidates(probs, classes, opts) {
    opts = opts || {};
    var k = opts.limit || 6, bySp = {}, i;
    for (i = 0; i < probs.length; i++) {
      var cid = classes[i], p = probs[i];
      var sp = cid <= TOTAL ? cid : (form(cid) ? form(cid).sp : 0);
      if (!sp) { continue; }
      var o = bySp[sp] || (bySp[sp] = { sp: sp, form: 0, p: 0, best: -1, seen: 0 });
      o.p += p;
      if (p > o.best) { o.best = p; o.form = cid <= TOTAL ? 0 : cid; }
    }
    if (opts.exemplars && opts.sig) {
      var hi = opts.simHigh || 0.75, lo = opts.simLow || 0.45, best = {};
      for (i = 0; i < opts.exemplars.length; i++) {
        var ex = opts.exemplars[i], sim = sigCos(opts.sig, ex.sig);
        if (sim >= lo && (!best[ex.sp] || sim > best[ex.sp].sim)) { best[ex.sp] = { sim: sim, form: ex.form || 0 }; }
      }
      Object.keys(best).forEach(function (key) {
        var b = best[key], spId = +key;
        var t = Math.min(1, (b.sim - lo) / (hi - lo));
        var o2 = bySp[spId] || (bySp[spId] = { sp: spId, form: b.form, p: 0, best: 0, seen: 0 });
        /* blend towards certainty as the match gets closer */
        o2.p = o2.p + (1 - o2.p) * t * 0.9;
        o2.seen = b.sim;
        if (t >= 1 && b.form) { o2.form = b.form; }
      });
      var sum = 0;
      Object.keys(bySp).forEach(function (key) { sum += bySp[key].p; });
      if (sum > 1) { Object.keys(bySp).forEach(function (key) { bySp[key].p /= sum; }); }
    }
    var list = Object.keys(bySp).map(function (key) { return bySp[key]; });
    list.sort(function (a, b) { return b.p - a.p || a.sp - b.sp; });
    return list.slice(0, k).map(function (o) { return { sp: o.sp, form: o.form, p: o.p, seen: o.seen }; });
  }
  /* how sure the top answer is: 2 sure, 1 likely, 0 unsure */
  function confidence(list) {
    if (!list.length) { return 0; }
    var p1 = list[0].p, p2 = list.length > 1 ? list[1].p : 0;
    if (p1 >= 0.7 && p1 >= p2 * 3) { return 2; }
    if (p1 >= 0.35 && p1 >= p2 * 1.5) { return 1; }
    return 0;
  }

  /* --------------------------------------------------------------- backup */

  var CRC_TABLE = null;
  function crc32(u8, crc) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; }
        CRC_TABLE[n] = c >>> 0;
      }
    }
    crc = (crc === undefined ? 0 : crc) ^ 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) { crc = CRC_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8); }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(s); }
    return new Uint8Array(Buffer.from(s, 'utf8'));
  }
  function fromUtf8(u8) {
    if (typeof TextDecoder !== 'undefined') { return new TextDecoder('utf-8').decode(u8); }
    return Buffer.from(u8).toString('utf8');
  }
  function dosTime(ms) {
    var d = new Date(ms);
    var y = Math.max(1980, d.getFullYear());
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  /* Write an uncompressed .zip piece by piece (photos are already compressed).
   * var z = zipWriter(); pieces = z.add(name, data) for each file; pieces = z.finish().
   * Concatenate all pieces in order (new Blob(pieces)). */
  function zipWriter(now) {
    var central = [], offset = 0, count = 0, dt = dosTime(now || Date.now());
    return {
      add: function (fileName, data) {
        if (count >= 65000) { throw new Error('too many files'); }
        var name = utf8(fileName), crc = crc32(data);
        if (data.length > 0xFFFFFFF0 || offset > 0xFFFFFFF0) { throw new Error('file too large'); }
        var h = new Uint8Array(30 + name.length), dv = new DataView(h.buffer);
        dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
        dv.setUint16(10, dt.time, true); dv.setUint16(12, dt.date, true); dv.setUint32(14, crc, true);
        dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
        h.set(name, 30);
        var c = new Uint8Array(46 + name.length), cv = new DataView(c.buffer);
        cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
        cv.setUint16(12, dt.time, true); cv.setUint16(14, dt.date, true); cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        c.set(name, 46);
        central.push(c);
        offset += h.length + data.length; count++;
        return [h, data];
      },
      finish: function () {
        var cdSize = 0, out = [];
        central.forEach(function (c) { out.push(c); cdSize += c.length; });
        var e = new Uint8Array(22), ev = new DataView(e.buffer);
        ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, count, true); ev.setUint16(10, count, true);
        ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
        out.push(e);
        return out;
      }
    };
  }
  /* files: [{name, data: Uint8Array}] -> array of Uint8Array pieces */
  function zipBuild(files, now) {
    var z = zipWriter(now), parts = [];
    files.forEach(function (f) { z.add(f.name, f.data).forEach(function (p) { parts.push(p); }); });
    z.finish().forEach(function (p) { parts.push(p); });
    return parts;
  }

  /* Read the table of contents of a .zip.  read(start, end) -> Promise<Uint8Array>.
   * Resolves to {names: [...], get(name) -> Promise<Uint8Array|null>}. */
  function zipOpen(read, size) {
    var tailLen = Math.min(size, 66000);
    return read(size - tailLen, size).then(function (tail) {
      var dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength), p = -1;
      for (var i = tail.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { p = i; break; } }
      if (p < 0) { throw new Error('not a zip file'); }
      var count = dv.getUint16(p + 10, true), cdSize = dv.getUint32(p + 12, true), cdOff = dv.getUint32(p + 16, true);
      if (cdOff + cdSize > size) { throw new Error('damaged zip file'); }
      return read(cdOff, cdOff + cdSize).then(function (cd) {
        var cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength), o = 0, entries = {}, names = [];
        for (var n = 0; n < count; n++) {
          if (o + 46 > cd.length || cv.getUint32(o, true) !== 0x02014b50) { throw new Error('damaged zip file'); }
          var method = cv.getUint16(o + 10, true), crc = cv.getUint32(o + 16, true), csize = cv.getUint32(o + 20, true), usize = cv.getUint32(o + 24, true);
          var nl = cv.getUint16(o + 28, true), xl = cv.getUint16(o + 30, true), cl = cv.getUint16(o + 32, true), lo = cv.getUint32(o + 42, true);
          var name = fromUtf8(cd.subarray(o + 46, o + 46 + nl));
          if (!Object.prototype.hasOwnProperty.call(entries, name)) { names.push(name); }
          entries[name] = { method: method, crc: crc, csize: csize, usize: usize, off: lo };
          o += 46 + nl + xl + cl;
        }
        function get(name) {
          if (!Object.prototype.hasOwnProperty.call(entries, name)) { return Promise.resolve(null); }
          var en = entries[name];
          if (en.off + 30 > size) { return Promise.reject(new Error('damaged zip file')); }
          return read(en.off, en.off + 30).then(function (lh) {
            var lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
            if (lv.getUint32(0, true) !== 0x04034b50) { throw new Error('damaged zip file'); }
            var start = en.off + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
            if (start + en.csize > size) { throw new Error('damaged zip file'); }
            return read(start, start + en.csize);
          }).then(function (raw) {
            if (en.method === 0) { return raw; }
            if (en.method === 8 && typeof DecompressionStream !== 'undefined' && typeof Response !== 'undefined') {
              var ds = new DecompressionStream('deflate-raw');
              var w = ds.writable.getWriter();
              w.write(raw); w.close();
              return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
            }
            throw new Error('compressed zip is not supported here');
          }).then(function (data) {
            if (data.length !== en.usize || crc32(data) !== en.crc) { throw new Error('damaged entry: ' + name); }
            return data;
          });
        }
        return { names: names, get: get };
      });
    });
  }

  function imageType(u8) {
    if (u8.length > 3 && u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) { return 'image/jpeg'; }
    if (u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) { return 'image/png'; }
    if (u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) { return 'image/webp'; }
    return '';
  }

  /* data.json inside a backup */
  function backupManifest(encs, modelTag, now) {
    return { app: APP_ID, v: 1, version: VERSION, exported: new Date(now || Date.now()).toISOString(), model: modelTag || '', enc: encs };
  }
  function readManifest(text, now) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('data.json is not valid'); }
    if (!o || typeof o !== 'object' || o.app !== APP_ID || !Array.isArray(o.enc)) { throw new Error('not a backup of this app'); }
    return { enc: sanitizeList(o.enc, now), model: typeof o.model === 'string' ? o.model.slice(0, 40) : '', exported: typeof o.exported === 'string' ? o.exported.slice(0, 40) : '', dropped: o.enc.length };
  }

  return {
    VERSION: VERSION, APP_ID: APP_ID, TOTAL: TOTAL, DATA_DATE: DATA.date,
    TYPES: TYPES, KINDS: KINDS, KIND_ZH: KIND_ZH, GEN_LIST: GEN_LIST, SPECIES: SPECIES, FORMS: FORMS, CATS: CATS, CAT_ZH: CAT_ZH,
    MAX_PLACE: MAX_PLACE, MAX_NOTE: MAX_NOTE,
    species: species, form: form, no: no, pad4: pad4, genName: genName, genLabel: genLabel, label: label, typesOf: typesOf,
    fold: fold, cleanText: cleanText, search: search, listDex: listDex,
    dayKey: dayKey, isDayKey: isDayKey, dayNum: dayNum, dayFromNum: dayFromNum,
    newId: newId, validId: validId, sanitizeEnc: sanitizeEnc, sanitizeList: sanitizeList, mergeLists: mergeLists,
    stats: stats, forecast: forecast,
    parseHead: parseHead, selfTestInput: selfTestInput, selfTestScore: selfTestScore, l2norm: l2norm, headLogits: headLogits, softmax: softmax, packFeat: packFeat, unpackFeat: unpackFeat,
    cosine: cosine, signature: signature, sigCos: sigCos, sigPack: sigPack, sigUnpack: sigUnpack, candidates: candidates, confidence: confidence,
    crc32: crc32, utf8: utf8, fromUtf8: fromUtf8, zipWriter: zipWriter, zipBuild: zipBuild, zipOpen: zipOpen, imageType: imageType,
    backupManifest: backupManifest, readManifest: readManifest
  };
});
