// ==UserScript==
// @name         تخفیف‌سنج
// @namespace    ghafel-com-pro
// @version      15.2.2
// @description  نسخهٔ بلک‌فرایدی — مقایسهٔ قیمت فروشندگان، تاریخچهٔ رسمی قیمت دیجی‌کالا، بازرس تخفیف واقعی، واچ‌لیست و هشدار — یک پنل واحد
// @author       GHAFEL_com (Original Creator)
// @contributor  RealMahdi_a (Upgrade & Development)
// @homepageURL  https://aqilistudio.ir/
// @supportURL   https://t.me/RealMahdi_a
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @connect      api.torob.com
// @connect      torob.com
// @connect      api.digikala.com
// @connect      www.digikala.com
// @noframes
// @run-at       document-idle
// ==/UserScript==
/* تخفیف‌سنج 15.2.2 — Original Creator: GHAFEL_com (https://t.me/GHAFEL_com) · Upgrade & Development: RealMahdi_a (https://t.me/RealMahdi_a) · Website: https://aqilistudio.ir/
   Built from readable modules in /src. The 8.7 engine logic is preserved in src/06-extract.js (extraction),
   src/07-match.js (baseline rule) and src/08-sources.js (Torob flow). */
(function () {
'use strict';

// ---- 01-util.js ----
/* ===== U: utilities (digits, normalisation, price parsing, Jalali dates) ===== */
const U = (() => {
  const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  const STOP = new Set(['با','و','در','از','برای','خرید','قیمت','مدل','اصل','جدید','تومان','ریال','the','and','for','new']);

  const digits = s => String(s ?? '').replace(/[۰-۹]/g, c => FA.indexOf(c)).replace(/[٠-٩]/g, c => AR.indexOf(c));
  // Same normalisation as the verified 8.7 engine.
  const normalize = s => digits(s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u0652\u0640\u200c\u200e\u200f]/g, ' ').replace(/[^a-zA-Z0-9آ-ی]+/g, ' ').toLowerCase().trim();
  const compact = s => normalize(s).replace(/\s+/g, '');
  const tokens = s => normalize(s).split(' ').filter(t => t.length > 1 && !STOP.has(t));

  const toFa = s => String(s).replace(/\d/g, d => FA[d]);
  const fmt = n => (n == null || !isFinite(n)) ? '—' : Math.round(n).toLocaleString('fa-IR');
  const fmtPct = n => (n == null || !isFinite(n)) ? '—' : toFa((Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n)).toString()) + '٪';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const DAY = 86400000;

  // Numbers followed by a currency word (toman / rial). Rial is converted to toman.
  function pricesWithCurrency(text) {
    const t = digits(text).replace(/[\u200c\u200e\u200f\u00a0]/g, '').replace(/[٬،]/g, ',');
    const re = /(\d{1,3}(?:,\d{3})+|\d{5,})\s*(تومان|تومن|ریال|ت)(?![آ-ی])/g, out = []; let m;
    while ((m = re.exec(t))) {
      const v = Number(m[1].replace(/\D/g, ''));
      if (v >= 1000) out.push(m[2] === 'ریال' ? Math.round(v / 10) : v);
    }
    return out;
  }
  // Bare numbers formatted like prices.
  function numbersIn(text) {
    const t = digits(text).replace(/[\u200c\u200e\u200f\u00a0]/g, '').replace(/[٬،]/g, ',');
    const re = /(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d{5,})(?![\d,])/g, out = []; let m;
    while ((m = re.exec(t))) out.push(Number(m[1].replace(/\D/g, '')));
    return out;
  }

  // ---- Jalali -> Gregorian (jalaali-js algorithm; verified against jdatetime in tests) ----
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    const bl = BREAKS.length, gy = jy + 621; let leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('bad jalali year ' + jy);
    for (i = 1; i < bl; i++) { jm = BREAKS[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ++;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    return { gy, march: 20 + leapJ - leapG };
  }
  const g2d = (gy, gm, gd) => { const d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  function d2g(jdn) {
    let j = 4 * jdn + 139361631; j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
    return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd };
  }
  // "1405/07/07" -> UTC ms (12:00 UTC of that Gregorian day) or null
  function jalaliToTime(str) {
    const m = digits(str).match(/^\s*(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\s*$/); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3]; if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    try { const g = d2g(j2d(jy, jm, jd)); return Date.UTC(g.gy, g.gm - 1, g.gd, 12); } catch { return null; }
  }
  const isoDay = t => new Date(t).toISOString().slice(0, 10);
  const faDate = t => { try { return new Date(t).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }); } catch { return isoDay(t); } };

  return { DAY, STOP, digits, normalize, compact, tokens, toFa, fmt, fmtPct, esc, sleep, median, pricesWithCurrency, numbersIn, jalaliToTime, isoDay, faDate };
})();


// ---- 02-log.js ----
/* ===== Log: ring buffer so every error is visible in the Diagnostics tab ===== */
const Log = (() => {
  const buf = []; const MAX = 200; const subs = new Set();
  function add(level, scope, msg, extra) {
    const e = { t: Date.now(), level, scope, msg: String(msg), extra };
    buf.push(e); if (buf.length > MAX) buf.shift();
    try {
      const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      write('[GHAFEL13]', scope, msg, extra ?? '');
    } catch {}
    subs.forEach(f => { try { f(e); } catch {} });
  }
  return { info: (s, m, x) => add('info', s, m, x), warn: (s, m, x) => add('warn', s, m, x), error: (s, m, x) => add('error', s, m, x), all: () => buf.slice(), on: f => subs.add(f) };
})();


// ---- 03-store.js ----
/* ===== Store: persistent data (GM storage with localStorage fallback), single JSON document ===== */
const Store = (() => {
  const KEY = 'ghafel13:db';
  const DEFAULT = () => ({
    v: 1,
    settings: {
      theme: 'dark', productPageOnly: true,
      sources: { torob: true, emalls: false, basalam: false },
      alerts: { enabled: true, intervalMin: 60 },
      pos: null, open: false, tab: 'compare', table: false, wide: false, size: null, snap: true
    },
    products: {} // key -> product record, see Store.touchProduct
  });
  const hasGM = () => typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  let db = null;

  function rawGet() {
    try { if (hasGM()) return GM_getValue(KEY, null); } catch (e) { Log.warn('store', 'GM_getValue failed: ' + e.message); }
    try { return localStorage.getItem(KEY); } catch { return null; }
  }
  function rawSet(s) {
    try { if (hasGM()) { GM_setValue(KEY, s); return; } } catch (e) { Log.warn('store', 'GM_setValue failed: ' + e.message); }
    try { localStorage.setItem(KEY, s); } catch (e) { Log.error('store', 'save failed: ' + e.message); }
  }
  function merge(base, src) {
    for (const k of Object.keys(src || {})) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], src[k]);
      else base[k] = src[k];
    }
    return base;
  }
  function load() {
    const base = DEFAULT();
    try { const s = rawGet(); if (s) db = merge(base, typeof s === 'string' ? JSON.parse(s) : s); else db = base; }
    catch (e) { Log.error('store', 'corrupt db, starting fresh: ' + e.message); db = base; }
    return db;
  }
  const get = () => db || load();
  const save = () => rawSet(JSON.stringify(get()));

  function touchProduct(key, init) {
    const d = get();
    const p = d.products[key] ||= { key, host: '', pid: '', title: '', url: '', variantTitle: '', local: [], watch: false, target: null, lastPrice: null, lastTs: 0, notifiedAt: 0, lastSource: '' };
    if (init) Object.assign(p, init);
    return p;
  }
  // Local (extension-recorded) history. Never mixed with store-provided history.
  const MAX_LOCAL = 1500, MIN_GAP = 6 * 3600e3;
  function recordLocal(p, price, source, ts = Date.now(), variantId = '') {
    if (!(price > 0)) return false;
    const last = p.local[p.local.length - 1];
    p.lastPrice = price; p.lastTs = ts; p.lastSource = source;
    if (last && last.p === price && String(last.variantId || '') === String(variantId || '') && ts - last.t < MIN_GAP) return false;
    p.local.push({ t: ts, p: price, src: source, variantId: String(variantId || '') });
    if (p.local.length > MAX_LOCAL) p.local.splice(0, p.local.length - MAX_LOCAL);
    return true;
  }
  function reset() { db = DEFAULT(); save(); }
  return { load, get, save, touchProduct, recordLocal, reset, DEFAULT, KEY };
})();


// ---- 04-net.js ----
/* ===== Net: the ONLY place that does network I/O (via GM_xmlhttpRequest), with an allow-list ===== */
const Net = (() => {
  const ALLOWED = ['api.torob.com', 'torob.com', 'api.digikala.com', 'www.digikala.com', 'digikala.com'];
  const allowed = url => { try { const h = new URL(url).hostname; return ALLOWED.includes(h); } catch { return false; } };

  function gmRequest(url, { accept = 'application/json', referer, headers = {}, timeout = 15000, anonymous = true } = {}) {
    return new Promise((resolve, reject) => {
      if (!allowed(url)) return reject(new Error('دامنهٔ مجاز نیست: ' + (() => { try { return new URL(url).hostname; } catch { return url; } })()));
      const gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : (typeof GM !== 'undefined' && GM.xmlHttpRequest);
      if (!gm) return reject(new Error('GM_xmlhttpRequest در دسترس نیست (مجوز @grant را بررسی کنید)'));
      const t0 = Date.now();
      gm({
        method: 'GET', url, timeout, anonymous,
        headers: { Accept: accept, 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8', ...(referer ? { Referer: referer } : {}), ...headers },
        onload: r => {
          const ms = Date.now() - t0, u = new URL(url);
          Log.info('net', `${r.status} ${u.hostname}${u.pathname} (${ms}ms)`);
          if (r.status === 200) resolve(r.responseText || '');
          else {
            const e = new Error('HTTP ' + r.status); e.status = r.status;
            const m = /retry-after:\s*(\d+)/i.exec(r.responseHeaders || ''); if (m) e.retryAfterMs = Math.min(600000, Math.max(1000, +m[1] * 1000));
            reject(e);
          }
        },
        onerror: e => { const d = e ? JSON.stringify({ error: e.error, status: e.status, finalUrl: e.finalUrl }) : ''; Log.warn('net', 'onerror ' + new URL(url).hostname + ' ' + d); reject(new Error('خطای شبکه' + (e && e.error ? ` (${e.error})` : ' (GM_xmlhttpRequest بدون جزئیات؛ مجوز @connect یا کوکی/VPN را بررسی کنید)'))); },
        ontimeout: () => reject(new Error('timeout'))
      });
    });
  }
  // Page-context fetch: only useful when the page itself is on the target's site (CORS allows www.digikala.com -> api.digikala.com).
  async function pageFetch(url, { accept = 'application/json', timeout = 15000 } = {}) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null; const tm = ctl && setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { credentials: 'include', headers: { Accept: accept }, signal: ctl && ctl.signal });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return await r.text();
    } finally { if (tm) clearTimeout(tm); }
  }
  async function request(url, opts = {}) {
    try { return await gmRequest(url, opts); }
    catch (e) {
      if (!opts.pageFetchFallback || e.status) throw e;
      Log.warn('net', 'GM ناموفق بود، تلاش با fetch صفحه: ' + e.message);
      try { const t = await pageFetch(url, opts); Log.info('net', 'fetch صفحه موفق بود'); return t; }
      catch (e2) { throw new Error(e.message + ' | fetch صفحه: ' + e2.message); }
    }
  }
  async function json(url, opts) {
    const txt = await request(url, opts);
    try { return JSON.parse(txt); } catch { throw new Error('پاسخ JSON معتبر نیست'); }
  }
  return { request, json, allowed, ALLOWED };
})();


// ---- 05-model.js ----
/* ===== Model: the standard data records shared by every module ===== */
const Model = (() => {
  const now = () => Date.now();
  const safeHttpUrl = value => {
    try {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const url = new URL(raw, 'https://torob.com/');
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  // A product as seen on the current page.
  function product(o) {
    return {
      id: o.id || '',                 // Product ID (store-specific, e.g. Digikala dkp number)
      key: o.key || '',               // host:id
      host: o.host || '',
      title: o.title || '',           // Product title
      url: o.url || '',               // Source URL
      price: o.price ?? null,         // Current price (toman)
      currency: 'IRT',                // Currency: always toman internally
      priceSource: o.priceSource || '',
      priceTs: o.priceTs || now(),
      oldPrice: o.oldPrice ?? null,   // struck-through / pre-discount price shown by the store
      variantId: o.variantId || '', variantTitle: o.variantTitle || o.color || '',
      seller: o.seller || '', warranty: o.warranty || '',
      nameCandidates: o.nameCandidates || []
    };
  }
  // One seller price from any source.
  function offer(o) {
    return {
      sourceId: o.sourceId,               // data source module
      productId: o.productId || '',
      seller: o.seller || '',             // Seller name
      sellerKey: o.sellerKey || '',       // known-store host key when recognised
      sellerUrl: safeHttpUrl(o.sellerUrl), // External seller links must be ordinary HTTP(S) URLs.
      price: o.price,                     // Seller price (toman)
      currency: 'IRT',
      shippingCost: o.shippingCost ?? null, // null = unknown (never guessed)
      ts: o.ts || now(),                  // Timestamp
      dataSource: o.dataSource || o.sourceId, // Data source (endpoint family)
      matchConfidence: o.matchConfidence ?? null, // Match confidence 0..1
      matchLevel: o.matchLevel || '',     // high | medium | low
      matchTitle: o.matchTitle || '',
      flags: o.flags || []
    };
  }
  // One historical price point supplied by a store.
  function point(o) {
    return { t: o.t, day: o.day || '', price: o.price, rrp: o.rrp ?? null, seller: o.seller || '', warranty: o.warranty || '',
      marketable: o.marketable !== false, source: o.source, kind: o.kind || 'selling_price', currency: 'IRT' };
  }
  return { product, offer, point };
})();


// ---- 06-extract.js ----
/* ===== Extract: product name + current price. Faithful port of the verified 8.7 engine (deobfuscated). ===== */
const Extract = (() => {
  const KNOWN = {
    'digikala.com': ['دیجی‌کالا', 'دیجیکالا', 'دیجی کالا'], 'torob.com': ['ترب'], 'emalls.ir': ['ای‌مالز', 'ایمالز', 'امالز'],
    'technolife.com': ['تکنولایف', 'تکنو لایف'], 'basalam.com': ['باسلام'], 'banimode.com': ['بانی‌مد', 'بانی مد'],
    'okala.com': ['اکالا'], 'mobile140.com': ['موبایل ۱۴۰', 'موبایل140'], 'digistyle.com': ['دیجی‌استایل', 'دیجی استایل']
  };
  const BRAND_KEYS = Object.keys(KNOWN).flatMap(k => [U.compact(k.split('.')[0]), ...KNOWN[k].map(U.compact)]).filter(k => k.length >= 4);
  const isStoreName = s => { const c = U.compact(s); return !!c && BRAND_KEYS.some(b => c === b || c.includes(b)); };
  const matchKnownSite = d => {
    const c = U.compact(d); if (!c) return null;
    for (const k of Object.keys(KNOWN)) {
      for (const a of [U.compact(k.split('.')[0]), ...KNOWN[k].map(U.compact)]) {
        if (!a) continue; if (c === a) return k; if (a.length >= 5 && c.includes(a)) return k;
      }
    }
    return null;
  };
  const hasUnit = s => { const t = U.digits(s); return /\d/.test(t) && /گرم|کیلو|میلی|لیتر|عدد|بسته|سانتی|متر|سی.?سی|\b(ml|kg|g|l|gr|cm|mm)\b/i.test(t); };
  const NAME_JUNK = [/^\s*قیمت\s*و\s*خرید\s+/, /^\s*خرید\s+/, /\s*(با|در)\s*قیمت\s*(روز|مناسب|ارزان|عمده)?.*$/, /\s*خرید\s*(آنلاین|اینترنتی|قسطی|اقساطی).*$/, /\s*(ارسال\s*رایگان|تخفیف|گارانتی|اصل|اورجینال).*$/];
  function cleanTitle(raw) {
    const parts = String(raw || '').split(/\s*[|—–]\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean);
    let t = parts.filter((p, i) => i === 0 || (!isStoreName(p) && hasUnit(p))).join(' - ').replace(/\d[\d٬,،\s]*\s*(تومان|تومن|ت)\b.*$/u, '').replace(/\s+/g, ' ').trim();
    for (const r of NAME_JUNK) t = t.replace(r, '').trim();
    return t.slice(0, 120);
  }
  // Product headings often append dimensions, weight, package contents and marketing copy.
  // Keep the first descriptive clause for search/display, but preserve model codes even if
  // the seller placed them after a comma.
  function coreTitle(raw) {
    const full = cleanTitle(raw);
    if (!full) return '';
    const first = full.split(/[,،؛;|—–]/)[0].trim();
    let core = first.length >= 3 ? first : full;
    try {
      for (const code of Match.modelCodes(full)) {
        if (!U.compact(core).includes(U.compact(code))) core += ' ' + code;
      }
    } catch {}
    return core.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function titleFromUrl() {
    try {
      const last = decodeURIComponent(location.pathname).split('/').filter(Boolean).pop() || '';
      const t = last.replace(/^\d+[-_]?/, '').replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
      return /[آ-ی]/.test(t) && t.split(' ').length >= 3 ? t : '';
    } catch { return ''; }
  }

  // ---- strike-through detection ----
  const STRIKE_CLASS = /line-through|strikethrough|(^|[\s_:-])(old|del|strike|discount)(?=$|[\s_:-])/i;
  const isStruck = el => {
    if (STRIKE_CLASS.test(el.className && el.className.toString ? el.className.toString() : '')) return true;
    try { if ((getComputedStyle(el).textDecorationLine || '').includes('line-through')) return true; } catch {}
    return !!el.closest('del, s, strike');
  };
  const struckNumbers = root => { const s = new Set(); root.querySelectorAll('*').forEach(e => { if (isStruck(e)) U.numbersIn(e.textContent).forEach(v => s.add(v)); }); return s; };
  const visibleOnPage = n => { const t = U.digits(document.body.innerText || '').replace(/(\d)[,٬،](?=\d)/g, '$1'); return new RegExp('(?<!\\d)' + n + '(?!\\d)').test(t); };

  // ---- JSON-LD ----
  function jsonLd(root) {
    let found = null;
    root.querySelectorAll('script[type="application/ld+json"]').forEach(sc => {
      if (found) return; let data; try { data = JSON.parse(sc.textContent); } catch { return; }
      (function walk(o) {
        if (!o || typeof o !== 'object' || found) return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        const ty = o['@type'];
        if (ty === 'Product' || (Array.isArray(ty) && ty.includes('Product'))) {
          let raw = 0, cur = '';
          for (const of of [].concat(o.offers || [])) {
            const x = of && of.offers ? [].concat(of.offers)[0] : of;
            const v = Number(String(x?.price ?? x?.lowPrice ?? '').replace(/[^\d.]/g, ''));
            if (v > 0) { raw = v; cur = String(x.priceCurrency || '').toUpperCase(); break; }
          }
          found = { name: o.name || '', raw: raw || null, cur }; return;
        }
        Object.values(o).forEach(walk);
      })(data);
    });
    return found;
  }
  function reconcileJsonLd(ld, visible) {
    if (!ld || !ld.raw) return null;
    const asToman = ld.cur === 'IRR' ? Math.round(ld.raw / 10) : Math.round(ld.raw), asRaw = Math.round(ld.raw), asDiv = Math.round(ld.raw / 10);
    if (!visible) {
      if (!visibleOnPage(asToman)) {
        if (visibleOnPage(asRaw)) return { price: asRaw, note: ' (واحد JSON-LD اصلاح شد)' };
        if (visibleOnPage(asDiv)) return { price: asDiv, note: ' (واحد JSON-LD اصلاح شد)' };
      }
      return { price: asToman, note: '' };
    }
    const near = v => Math.abs(v - visible) / visible < 0.02;
    if (near(asToman)) return { price: asToman, note: '' };
    if (near(asRaw)) return { price: asRaw, note: ' (واحد JSON-LD اصلاح شد)' };
    if (near(asDiv)) return { price: asDiv, note: ' (واحد JSON-LD اصلاح شد)' };
    return null;
  }

  // ---- DOM price heuristics (same order & thresholds as 8.7) ----
  const SELLER_BLOCK = "[data-testid*='seller'], [class*='seller'], [class*='related'], [class*='similar']";
  function buyBarPrice() {
    const btns = [...document.querySelectorAll('button, a, div, span')].filter(e => {
      if (e.children.length > 4) return false; const t = (e.innerText || '').trim(); return t.length > 0 && t.length < 30 && /افزودن به سبد/.test(t);
    });
    for (const b of btns) {
      let p = b.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        const txt = p.innerText || ''; if (txt.length > 500) break;
        const struck = struckNumbers(p), cand = U.numbersIn(txt).filter(v => v >= 10000 && !struck.has(v));
        if (cand.length) return Math.min(...cand);
      }
    }
    return null;
  }
  // The struck-through "old price" inside the buy box (claimed pre-discount price)
  function claimedOldPrice(current) {
    const btns = [...document.querySelectorAll('button, a, div, span')].filter(e => e.children.length <= 4 && /افزودن به سبد/.test((e.innerText || '').trim()) && (e.innerText || '').trim().length < 30);
    for (const b of btns) {
      let p = b.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        const txt = p.innerText || ''; if (txt.length > 500) break;
        const s = [...struckNumbers(p)].filter(v => v >= 10000 && (!current || v > current));
        if (s.length) return Math.max(...s);
      }
    }
    return null;
  }
  function testIdPrice() {
    for (const el of document.querySelectorAll('[data-testid="price-final"], [data-testid="price-current"], [data-testid="price"]')) {
      if (el.closest("[data-testid*='seller'], [class*='seller']")) continue;
      const a = U.pricesWithCurrency((el.innerText || el.textContent || '') + ' تومان'); if (a.length) return Math.min(...a);
      const n = Number(U.digits(el.textContent).replace(/\D/g, '')); if (n >= 10000) return n;
    }
    return null;
  }
  function classPrice() {
    const els = [...document.querySelectorAll("[class*='price'], [data-testid*='price'], [id*='price']")].filter(e => {
      if (e.closest(SELLER_BLOCK) || isStruck(e)) return false;
      return /^\d{1,3}(?:[,٬،]\d{3})+$|^\d{5,}$/.test(U.digits(e.textContent).replace(/\s|تومان|ت$/g, '').trim());
    });
    const arr = els.map(e => ({ top: e.getBoundingClientRect().top + window.scrollY, value: Number(U.digits(e.textContent).replace(/\D/g, '')) })).filter(x => x.value >= 10000);
    arr.sort((a, b) => a.top - b.top); return arr.length ? arr[0].value : null;
  }
  function unstruckPrice() {
    const els = [...document.querySelectorAll('p, span, div, strong, b')].filter(e => {
      if (e.children.length !== 0) return false; const t = U.digits(e.textContent).trim();
      if (!/^\d{1,3}(?:[,٬]\d{3})+$/.test(t) || isStruck(e) || e.closest(SELLER_BLOCK)) return false;
      const n = Number(t.replace(/\D/g, '')); return n >= 100000 && n <= 100000000;
    });
    const arr = els.map(e => ({ value: Number(U.digits(e.textContent).replace(/\D/g, '')), score: /font-semibold|font-bold|text-h4|text-xl|text-primary/.test(e.className.toString()) ? 2 : 0 }));
    arr.sort((a, b) => b.score - a.score); return arr.length ? arr[0].value : null;
  }
  function nearBuyButton() {
    const els = [...document.querySelectorAll('button, a, div')].filter(e => { const t = (e.innerText || '').trim(); return t.length > 0 && t.length < 40 && /افزودن به سبد|خرید/.test(t); });
    for (const b of els) {
      let p = b;
      for (let i = 0; i < 8 && p; i++) {
        const t = p.innerText || '';
        if (t.length < 400) { const a = U.pricesWithCurrency(t.split('\n').filter(l => !/ارزان|گران|تخفیف|پیشنهاد|قسط|ماه|سود|بخرید|اعتبار/.test(l)).join('\n')); if (a.length) return Math.min(...a); }
        p = p.parentElement;
      }
    }
    return null;
  }

  function selectedColor() {
    const m = U.digits(document.body.innerText || '').match(/رنگ\s*[:：]\s*([^\n\r]{1,30})/); return m ? m[1].trim() : '';
  }
  function digikalaIds() {
    const m = location.pathname.match(/dkp-(\d+)/i); const v = new URLSearchParams(location.search).get('variant_id');
    return m ? { pid: m[1], variantId: v || '' } : null;
  }

  // Main entry: returns Model.product-compatible plain data.
  function product(root = document) {
    const ld = jsonLd(root) || {};
    const meta = sel => root.querySelector(sel)?.getAttribute('content') || '';
    const h1 = root.querySelector('h1')?.textContent?.trim() || '';
    const cands = [h1, ld.name, meta('meta[property="og:title"]'), root.title, titleFromUrl()].map(cleanTitle).filter(c => c && !isStoreName(c) && !/^فروشگاه\s*اینترنتی/.test(c));
    let name = cands[0] || '';
    if (U.tokens(name).length < 3) { const alt = cands.find(c => U.tokens(c).length >= 3); if (alt) name = alt; }
    const nn = U.normalize(name);
    for (const c of cands) { const cn = U.normalize(c); if (nn && cn.length > nn.length && cn.includes(nn) && c.length <= 120) { name = c; break; } }

    let price = null, src = '';
    const visible = buyBarPrice(), rec = reconcileJsonLd(ld, visible);
    if (rec) { price = rec.price; src = 'JSON-LD' + rec.note; }
    if (!price && visible) { price = visible; src = 'نوار خرید'; }
    if (!price) { const v = Number(meta('meta[property="product:price:amount"]').replace(/[^\d]/g, '')); if (v > 0) { price = v; src = 'متای صفحه'; } }
    if (!price) { const v = testIdPrice(); if (v) { price = v; src = 'data-testid'; } }
    if (!price) { const v = classPrice(); if (v) { price = v; src = 'کلاس قیمت'; } }
    if (!price) { const v = unstruckPrice(); if (v) { price = v; src = 'قیمت بدون خط‌خوردگی'; } }
    if (!price) { const v = nearBuyButton(); if (v) { price = v; src = 'نزدیک دکمهٔ خرید'; } }
    const dk = digikalaIds();
    const out = { title: name, price, priceSource: src, oldPrice: price ? claimedOldPrice(price) : null, nameCandidates: cands, color: selectedColor(),
      host: location.hostname.replace(/^www\./, ''), url: location.href, id: dk ? dk.pid : '', variantId: dk ? dk.variantId : '' };
    Log.info('extract', `name="${name}" price=${price || '—'} src=${src || '—'} old=${out.oldPrice || '—'}`);
    return out;
  }
  function looksLikeProductPage() {
    if (/dkp-\d+/i.test(location.pathname)) return true;
    if (document.querySelector('meta[property="og:type"][content*="product"]')) return true;
    if (jsonLd(document)) return true;
    return !!([...document.querySelectorAll('button')].some(b => /افزودن به سبد/.test(b.textContent || '')) && document.querySelector('h1'));
  }
  return { KNOWN, isStoreName, matchKnownSite, cleanTitle, coreTitle, jsonLd, reconcileJsonLd, product, looksLikeProductPage, digikalaIds, selectedColor, buyBarPrice, claimedOldPrice };
})();


// ---- 07-match.js ----
/* ===== Match: product matching with confidence. `baseline` is the exact 8.7 rule; `evaluate` adds model/spec checks. ===== */
const Match = (() => {
  // 8.7 rule (kept byte-for-byte in behaviour, verified by differential test).
  function baseline(src, cand) {
    const st = U.tokens(src); if (!st.length) return false;
    const cn = U.normalize(cand), set = new Set(cn.split(' ')), cc = cn.replace(/\s+/g, '');
    const hit = st.filter(t => set.has(t) || (t.length >= 4 && cc.includes(t))).length;
    if (hit / st.length < 0.5) return false;
    return st.filter(t => /\d/.test(t) && /[a-z]/.test(t)).every(t => cc.includes(t));
  }
  // Model codes: Latin letters + digits ("YRB/22" -> yrb22, "A07" -> a07, "64GB" -> 64gb).
  function modelCodes(raw) {
    const t = U.digits(raw).replace(/[ـ]/g, '');
    const out = new Set();
    const re = /[A-Za-z]+[A-Za-z0-9]*?[\s\/\-_.]?\d+[A-Za-z0-9]*|\d+[\s]?[A-Za-z]+[A-Za-z0-9]*/g; let m;
    while ((m = re.exec(t))) { const c = m[0].toLowerCase().replace(/[^a-z0-9]/g, ''); if (c.length >= 3 && /[a-z]/.test(c) && /\d/.test(c)) out.add(c); }
    return [...out];
  }
  function modelCodeMatch(src, cand) {
    const codes = modelCodes(src), candidateCodes = new Set(modelCodes(cand));
    const found = codes.filter(code => candidateCodes.has(code));
    return { codes, found, missing: codes.filter(code => !candidateCodes.has(code)) };
  }
  const UNITS = [['gb', /گیگابایت|گیگ|gb/], ['tb', /ترابایت|tb/], ['ml', /میلی ?لیتر|ml/], ['l', /لیتر/], ['kg', /کیلوگرم|کیلو|kg/], ['g', /گرم|gr|(?<![a-z])g(?![a-z])/], ['mah', /mah|میلی ?آمپر/], ['w', /وات|(?<![a-z])w(?![a-z])/], ['inch', /اینچ|inch/], ['cm', /سانتی ?متر|cm/], ['mm', /میلی ?متر|mm/]];
  function specs(raw) {
    const t = U.normalize(raw).replace(/(\d)\s+(?=[a-zآ-ی])/g, '$1'), out = {};
    for (const [u, re] of UNITS) {
      const rx = new RegExp('(\\d+)(?:' + re.source + ')', 'g'); let m;
      while ((m = rx.exec(t))) (out[u] ||= new Set()).add(Number(m[1]));
    }
    return out;
  }
  function evaluate(src, cand, { strict = false } = {}) {
    const reasons = [], flags = [];
    const base = baseline(src, cand);
    const st = U.tokens(src), cn = U.normalize(cand), set = new Set(cn.split(' ')), cc = cn.replace(/\s+/g, '');
    const cov = st.length ? st.filter(t => set.has(t) || (t.length >= 4 && cc.includes(t))).length / st.length : 0;
    const { codes, found, missing } = modelCodeMatch(src, cand);
    const a = specs(src), b = specs(cand);
    const mismatch = () => {
      if (codes.length && (strict ? missing.length > 0 : found.length === 0))
        return { ok: false, score: 0, level: 'low', reasons: ['کد مدل مبدا (' + (strict ? missing : codes).join('، ') + ') در نتیجه نیست'], flags: ['model-mismatch'] };
      for (const u of Object.keys(a)) if (b[u] && ![...a[u]].some(v => b[u].has(v)))
        return { ok: false, score: 0, level: 'low', reasons: ['مشخصه ' + u + ' متفاوت است'], flags: ['spec-mismatch'] };
      return null;
    };
    const conflict = mismatch();
    if (strict && conflict) return conflict;
    if (!base) return { ok: false, score: cov * 0.4, level: 'low', reasons: ['عدم تطبیق پایه (نام/توکن‌ها)'], flags: ['base-mismatch'] };
    if (conflict) return conflict;
    let model = codes.length ? found.length / codes.length : null;
    if (codes.length && found.length < codes.length) { flags.push('partial-model'); reasons.push('بخشی از کد مدل/ظرفیت تأیید نشد'); }
    // Without a model/capacity code (common for groceries, clothing, cosmetics), word-overlap alone is a weak
    // signal — "same category, different brand" can still clear the 50% baseline. Real data (different brands of
    // sunflower seeds scoring 0.56) showed this matters, so no-code matches need a much higher bar to be accepted.
    if (!codes.length) {
      flags.push('no-model-code');
      if (cov < 0.75) return { ok: false, score: cov * 0.4, level: 'low', reasons: ['بدون کد مدل/ظرفیت، پوشش کلمات نام کافی نیست (' + Math.round(cov * 100) + '٪ < ۷۵٪) — احتمال برند یا محصول متفاوت'], flags: ['no-model-code', 'low-coverage'] };
      reasons.push('کد مدل لاتین برای تأیید وجود ندارد؛ فقط بر اساس پوشش کلمات نام (' + Math.round(cov * 100) + '٪) پذیرفته شد');
    }
    let score = codes.length ? 0.35 * cov + 0.65 * model : Math.min(0.85, cov);
    if (codes.length && cov < 0.75) { flags.push('low-coverage'); reasons.push('پوشش کلمات نام ' + Math.round(cov * 100) + '٪'); }
    const level = score >= 0.85 ? 'high' : score >= 0.65 ? 'medium' : 'low';
    if (level === 'low') flags.push('suspicious');
    return { ok: true, score: +score.toFixed(2), level, reasons, flags };
  }
  return { baseline, modelCodes, modelCodeMatch, specs, evaluate };
})();


// ---- 08-sources.js ----
/* ===== Sources: independent modules. A failing source never disables the others. ===== */
const Sources = (() => {
  const TOROB_REF = 'https://torob.com/';
  const DK_REF = 'https://www.digikala.com/';
  // Origin is a forbidden header for GM requests; cookies are sent (anonymous:false) so Digikala's CDN accepts the call; page fetch is the fallback.
  const DK_OPTS = { referer: DK_REF, headers: { 'x-web-client': 'desktop', 'x-web-client-id': 'web' }, anonymous: false, pageFetchFallback: true };

  // ---------- Torob: seller prices (engine 8.7 flow, unchanged endpoints) ----------
  const torob = {
    id: 'torob', label: 'ترب', kind: 'offers', implemented: true, hosts: ['api.torob.com'],
    note: 'جست‌وجوی چندمرحله‌ای ← انتخاب محصول مطابق (قابل‌تغییر دستی) ← فهرست فروشندگان',
    titles: prod => [...new Set([Extract.coreTitle(prod.title), prod.title, ...(prod.altTitles || [])].filter(Boolean))],
    // Search high-signal terms first. Long page headings commonly append dimensions,
    // package contents and marketing copy, which makes exact marketplace search worse.
    queries(prod, override) {
      if (override) return [override.trim()];
      const t = torob.titles(prod), codes = [...new Set(t.flatMap(Match.modelCodes))];
      const en = (prod.altTitles || []).find(x => /^[\x00-\x7F\s]+$/.test(x));
      const core = Extract.coreTitle(prod.title) || prod.title || '';
      const codeQuery = codes.slice().sort((a, b) => b.length - a.length)[0] || '';
      const prefix = U.tokens(core).filter(x => !codes.includes(x)).slice(0, 4).join(' ');
      const focused = [prefix, codes.join(' ')].filter(Boolean).join(' ');
      const shortEnglish = en ? Extract.coreTitle(en) : '';
      const candidates = codes.length
        ? [focused, codeQuery, core, shortEnglish]
        : [core, U.tokens(core).slice(0, 5).join(' '), shortEnglish];
      return [...new Set(candidates.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 4);
    },
    async search(q) {
      const e = encodeURIComponent(q);
      const r = await Net.json(`https://api.torob.com/v4/base-product/search/?page=0&sort=popularity&size=24&query=${e}&q=${e}&source=next_desktop`, { referer: TOROB_REF, timeout: 15000 });
      return { results: Array.isArray(r.results) ? r.results : [], searchId: r.search_id || r.searchId || '' };
    },
    // Evaluate against every known title of the product (page title + Digikala official titles) and keep the best verdict.
    evalCand(prod, r) {
      const ct = r.name1 + ' ' + (r.name2 || ''); let best = null;
      // Check model/spec contradictions before token coverage: long page headings may have low overlap.
      const strict = Match.evaluate(prod.title || '', ct, { strict: true });
      if (strict.flags.includes('model-mismatch') || strict.flags.includes('spec-mismatch')) return strict;
      for (const t of torob.titles(prod)) { const ev = Match.evaluate(t, ct); if (!best || (ev.ok && !best.ok) || (ev.ok === best.ok && ev.score > best.score)) best = ev; }
      return best || Match.evaluate(prod.title || '', ct);
    },
    async sellers(prod, base, ev, searchId) {
      const baseTitle = base.name1 + ' ' + (base.name2 || '');
      const params = new URLSearchParams({ source: 'next_mobile', discover_method: 'direct', prk: base.random_key, list_type: 'products_info' });
      if (searchId) params.set('search_id', searchId);
      const res = await Net.json('https://api.torob.com/v4/base-product/sellers/?' + params, { referer: TOROB_REF, timeout: 15000 });
      const list = res?.results || res?.products_info?.result || [], ts = Date.now();
      const raw = list.map(s => {
        const shop = String(s.shop_name || s.domain || s.shop_text || '').replace(/^www\./, '');
        const key = Extract.matchKnownSite(s.domain || shop) || Extract.matchKnownSite(shop);
        return Model.offer({ sourceId: 'torob', productId: prod.id, seller: key ? (Extract.KNOWN[key][0] || key) : shop, sellerKey: key || '', sellerUrl: String(s.page_url || ''), price: Number(s.price ?? s.price_value),
          ts, dataSource: 'torob:base-product/sellers', matchConfidence: ev.score, matchLevel: ev.level, matchTitle: baseTitle, flags: ev.flags });
      }).filter(o => o.seller && o.price > 0);
      const byS = new Map(), dup = {};
      for (const o of raw) { const k = o.sellerKey || o.seller; dup[k] = (dup[k] || 0) + 1; const cur = byS.get(k); if (!cur || o.price < cur.price) byS.set(k, o); }
      const offers = [...byS.values()].map(o => { const k = o.sellerKey || o.seller; if (dup[k] > 1) o.flags = [...o.flags, 'dedup:' + dup[k]]; return o; });
      Log.info('torob', `${raw.length} فروشنده → ${offers.length} پس از حذف تکراری`);
      return offers;
    },
    async fetch(prod, { query, pickKey } = {}) {
      const tried = []; let found = null; const nearMiss = []; let rejected = 0;
      const qs = torob.queries(prod, query);
      for (let i = 0; i < qs.length && !found; i++) {
        let res; try { res = await torob.search(qs[i]); } catch (e) { if (i === 0) throw e; Log.warn('torob', 'جست‌وجوی مرحلهٔ ' + (i + 1) + ' ناموفق: ' + e.message); break; }
        tried.push(qs[i]); Log.info('torob', `«${qs[i]}» → ${res.results.length} نتیجه`);
        const valid = res.results.filter(r => r && r.name1 && !r.is_adv && Number(r.price) > 0 && r.random_key);
        const evaluated = valid.map(r => ({ r, ev: torob.evalCand(prod, r) })), ok = evaluated.filter(x => x.ev.ok);
        rejected += evaluated.length - ok.length;
        for (const x of evaluated.filter(x => !x.ev.ok && x.ev.flags.includes('model-mismatch')).slice(0, 3)) nearMiss.push({ title: x.r.name1 + ' ' + (x.r.name2 || ''), reason: x.ev.reasons[0] });
        if (ok.length) { const rank = { high: 0, medium: 1, low: 2 }; ok.sort((a, b) => rank[a.ev.level] - rank[b.ev.level] || b.ev.score - a.ev.score || Number(a.r.price) - Number(b.r.price)); found = { ok, searchId: res.searchId, q: qs[i] }; }
      }
      if (!found) return { status: 'no-match', offers: [], note: 'محصول مطابقی در ترب با اطمینان کافی پیدا نشد (' + tried.length + ' جست‌وجو)', nearMiss: nearMiss.slice(0, 3), rejected, tried, candidates: [], query: tried[0] || '' };
      const pick = (pickKey && found.ok.find(x => x.r.random_key === pickKey)) || found.ok[0], base = pick.r;
      const baseTitle = base.name1 + ' ' + (base.name2 || '');
      Log.info('torob', `محصول انتخاب‌شده: ${baseTitle} [${pick.ev.level} ${pick.ev.score}]`);
      const offers = await torob.sellers(prod, base, pick.ev, found.searchId);
      const candidates = found.ok.slice(0, 6).map(x => ({ key: x.r.random_key, title: x.r.name1 + ' ' + (x.r.name2 || ''), price: Number(x.r.price), level: x.ev.level }));
      return { status: offers.length ? 'ok' : 'empty', offers, note: baseTitle, nearMiss: nearMiss.slice(0, 3), rejected, tried, candidates, chosenKey: base.random_key, query: found.q };
    }
  };

  // Placeholders: modules are specified but intentionally NOT active: no endpoint has been verified, and guessing prices is forbidden.
  const unverified = (id, label, hosts) => ({ id, label, kind: 'offers', implemented: false, hosts, note: 'پیاده‌سازی نشده: اندپوینت رسمی/قابل‌اتکا هنوز تأیید نشده؛ هیچ قیمت حدسی نمایش داده نمی‌شود', async fetch() { return { status: 'unavailable', offers: [], note: this.note }; } });
  const emalls = unverified('emalls', 'ایمالز', ['emalls.ir']);
  const basalam = unverified('basalam', 'باسلام', ['basalam.com']);

  // ---------- Digikala official data ----------
  const dk = {
    // Live product record: exact variant price / pre-discount price / seller / warranty / Digikala's own 30-day low
    parseProduct(json, variantId) {
      const p = json?.data?.product; if (!p) return null;
      const vs = Array.isArray(p.variants) ? p.variants : [];
      const toT = r => (r == null ? null : Math.round(Number(r) / 10));
      const mk = v => { const pr = v.price || {}; return { variantId: String(v.id), title: (v.themes || []).map(t => t.value && t.value.title).filter(Boolean).join(' / '), price: toT(pr.selling_price), rrp: pr.discount_percent ? toT(pr.rrp_price) : null, discountPct: pr.discount_percent || 0, seller: v.seller?.title || '', warranty: v.warranty?.title_fa || '' }; };
      const all = vs.map(mk).filter(x => x.price > 0).sort((a, b) => a.price - b.price);
      const chosen = (variantId && all.find(x => x.variantId === String(variantId))) || null;
      return { title: p.title_fa || '', titleEn: p.title_en || '', brand: p.brand?.title_fa || '', variants: all, chosen, exact: !!chosen, lowest30dOfficial: toT(p.properties?.min_price_in_last_month) };
    },
    async product(pid, variantId) {
      const json = await Net.json(`https://api.digikala.com/product/v1/products/${pid}/`, DK_OPTS);
      return dk.parseProduct(json, variantId);
    },
    // Price chart: rial -> toman, Jalali day -> UTC time. Missing days stay missing (no interpolation).
    parseChart(json) {
      const d = json?.data; if (!d || !Array.isArray(d.price_chart)) return null;
      const variants = d.price_chart.map((c, i) => {
        const pts = (c.history || []).map(h => {
          const t = U.jalaliToTime(h.day); if (t == null) return null;
          const sp = Number(h.selling_price);
          return Model.point({ t, day: h.day, price: sp > 0 ? Math.round(sp / 10) : null, rrp: Number(h.rrp_price) > 0 ? Math.round(Number(h.rrp_price) / 10) : null,
            seller: h.seller || '', warranty: h.product_warranty || '', marketable: !!h.is_marketable && sp > 0, source: 'digikala:price-chart' });
        }).filter(Boolean).sort((a, b) => a.t - b.t);
        return { id: String(c.id ?? i), title: c.title || '', points: pts };
      });
      const all = variants.flatMap(v => v.points), ts = all.map(p => p.t);
      return { today: d.today || '', selectionTitle: d.chart_selection_title || '', variants, range: ts.length ? { from: Math.min(...ts), to: Math.max(...ts), days: Math.round((Math.max(...ts) - Math.min(...ts)) / U.DAY) + 1 } : null };
    },
    async chart(pid) {
      const json = await Net.json(`https://api.digikala.com/v1/product/${pid}/price-chart/`, DK_OPTS);
      const c = dk.parseChart(json); if (!c) throw new Error('ساختار پاسخ نمودار قیمت شناخته نشد');
      return c;
    },
    // pick the chart variant that matches the colour selected on the page
    pickVariant(chart, color) {
      if (!chart || !chart.variants.length) return null;
      const colors = (Array.isArray(color) ? color : [color]).map(U.compact).filter(Boolean);
      for (const c of colors) {
        const m = chart.variants.find(v => U.compact(v.title) === c);
        if (m) return { variant: m, exact: true };
      }
      for (const c of colors) {
        const m = chart.variants.find(v => {
          const title = U.compact(v.title);
          return title.length >= 2 && (c.includes(title) || title.includes(c));
        });
        if (m) return { variant: m, exact: false };
      }
      const live = chart.variants.filter(v => v.points.some(p => p.marketable));
      const best = (live.length ? live : chart.variants).slice().sort((a, b) => b.points.length - a.points.length)[0];
      return { variant: best, exact: chart.variants.length === 1 };
    }
  };

  const registry = { torob, emalls, basalam };
  return { registry, torob, emalls, basalam, dk };
})();


// ---- 09-analysis.js ----
/* ===== Analysis: history statistics, Black-Friday discount inspector, buying advisor. Uses ONLY real data. ===== */
const Analysis = (() => {
  const valid = pts => (Array.isArray(pts) ? pts : [])
    .filter(p => p && p.marketable && Number.isFinite(p.t) && Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => a.t - b.t);
  const lastN = (pts, days, end) => pts.filter(p => p.t > end - days * U.DAY);
  function stats(pts) {
    const s = valid(pts); if (!s.length) return null;
    const prices = s.map(p => p.price), first = s[0], last = s[s.length - 1];
    const span = Math.round((last.t - first.t) / U.DAY) + 1;
    const minP = s.reduce((a, b) => (b.price < a.price ? b : a)), maxP = s.reduce((a, b) => (b.price > a.price ? b : a));
    // Lowest price that held on two consecutive recorded days (ignores 1-day dips).
    let held = null; for (let i = 1; i < s.length; i++) { const m = Math.max(s[i - 1].price, s[i].price); if (held == null || m < held) held = m; }
    const sellers = new Set(s.map(p => p.seller).filter(Boolean));
    return { count: s.length, span, from: first.t, to: last.t, min: minP.price, minT: minP.t, max: maxP.price, maxT: maxP.t, median: U.median(prices), first: first.price, last: last.price, heldLow: held, sellers: sellers.size, missingDays: Math.max(0, span - s.length) };
  }
  const confidenceOf = st => !st ? 'none' : (st.span >= 60 && st.count >= 45) ? 'high' : (st.span >= 21 && st.count >= 15) ? 'medium' : 'low';

  // Campaign price inspector. It reports changes in recorded prices, not proof of a seller's intent.
  // Verdicts: 'confirmed' | 'rise-signal' | 'insufficient'.
  function inspect(pts, ctx = {}) {
    const s = valid(pts), st = stats(s), res = { verdict: 'insufficient', confidence: confidenceOf(st), reasons: [], signals: [], numbers: {}, stats: st };
    if (!st) { res.reasons.push('هیچ نقطهٔ تاریخی معتبر (قابل‌فروش) وجود ندارد.'); return res; }
    const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
    const ageMs = Math.max(0, now - st.to);
    const ageDays = Math.floor(ageMs / U.DAY);
    res.numbers = { latest: st.to, ageDays, current: Number.isFinite(ctx.currentPrice) && ctx.currentPrice > 0 ? ctx.currentPrice : st.last };

    // Do not compare today's page price with an old chart: that can make a routine
    // price change look like a current campaign discount.
    const variantCount = Number(ctx.variantCount) || 0;
    if (variantCount > 1 && !ctx.variantVerified) {
      res.detail = 'variant-ambiguous'; res.confidence = 'low';
      res.reasons.push('رنگ/واریانت تاریخچه با اطمینان به محصول صفحه وصل نشده است. در تب تاریخچه واریانت درست را انتخاب و دوباره بررسی کنید.');
      return res;
    }
    const maxAgeDays = Number.isFinite(ctx.maxAgeDays) ? ctx.maxAgeDays : 7;
    if (ageMs > maxAgeDays * U.DAY) {
      res.detail = 'stale'; res.confidence = 'low';
      res.reasons.push(`آخرین قیمت قابل‌فروش حدود ${U.toFa(Math.ceil(ageMs / U.DAY))} روز پیش ثبت شده؛ برای مقایسه با قیمت فعلی، تاریخچهٔ تازه‌تری لازم است.`);
      return res;
    }
    if (st.count < 10 || st.span < 21) { res.reasons.push(`داده برای نتیجه‌گیری کافی نیست: ${U.toFa(st.count)} نقطه در بازهٔ ${U.toFa(st.span)} روز (حداقل ۱۰ نقطه و ۲۱ روز لازم است).`); return res; }
    const end = st.to, cut = end - 14 * U.DAY;
    const prior = s.filter(p => p.t <= cut), recent = s.filter(p => p.t > cut);
    if (prior.length < 5) { res.reasons.push('برای ساخت «قیمت پایه»، دادهٔ کافی قبل از ۱۴ روز اخیر وجود ندارد.'); return res; }
    const baseline = U.median(prior.map(p => p.price));
    const current = Number.isFinite(ctx.currentPrice) && ctx.currentPrice > 0 ? ctx.currentPrice : st.last;
    const lastPt = s[s.length - 1];
    const oldCandidate = Number.isFinite(ctx.claimedOld) && ctx.claimedOld > 0
      ? ctx.claimedOld
      : (lastPt.rrp && lastPt.rrp > lastPt.price ? lastPt.rrp : null);
    const claimedOld = oldCandidate > current ? oldCandidate : null;
    const realDrop = (baseline - current) / baseline;
    const claimedPct = claimedOld ? (claimedOld - current) / claimedOld : null;
    res.numbers = {
      baseline, current, claimedOld,
      realDropPct: realDrop * 100,
      claimedPct: claimedPct == null ? null : claimedPct * 100,
      min: st.min, max: st.max, latest: st.to, ageDays, baselinePoints: prior.length
    };

    const peak = recent.filter(p => p.t < end - 2 * U.DAY).reduce((a, b) => (!a || b.price > a.price ? b : a), null);
    if (peak && peak.price >= baseline * 1.08 && current <= peak.price * 0.95)
      res.signals.push({ code: 'pre-rise', text: `قیمت در ${U.faDate(peak.t)} به ${U.fmt(peak.price)} تومان رسیده (${U.fmtPct((peak.price / baseline - 1) * 100)} بالاتر از قیمت پایه) و سپس پایین آمده.` });
    if (claimedOld && claimedOld >= baseline * 1.08)
      res.signals.push({ code: 'inflated-reference', text: `«قیمت قبل از تخفیف» (${U.fmt(claimedOld)}) از قیمت پایهٔ واقعی (${U.fmt(baseline)}) ${U.fmtPct((claimedOld / baseline - 1) * 100)} بالاتر است.` });
    if (claimedPct != null && claimedPct - realDrop > 0.10)
      res.signals.push({ code: 'claim-gap', text: `تخفیف ادعایی ${U.fmtPct(claimedPct * 100)} است اما نسبت به قیمت پایه فقط ${U.fmtPct(Math.max(0, realDrop) * 100)} کاهش دیده می‌شود.` });

    if (res.signals.length) { res.verdict = 'rise-signal'; res.reasons.push('نشانه‌هایی از افزایش قیمت یا مرجع قیمتی بالاتر پیش از تخفیف دیده می‌شود؛ این به‌تنهایی اثبات تخلف نیست (ممکن است تغییر فروشنده، موجودی یا گارانتی باشد).'); }
    else if (realDrop >= 0.05) { res.verdict = 'confirmed'; res.reasons.push(`قیمت فعلی ${U.fmtPct(realDrop * 100)} پایین‌تر از میانهٔ ${U.toFa(prior.length)} نقطهٔ تاریخیِ پیش از ۱۴ روز اخیر است؛ این فقط کاهش ثبت‌شده را نشان می‌دهد و به‌تنهایی اثبات تخلف یا اعتبار یک کمپین نیست.`); }
    else { res.verdict = 'insufficient'; res.detail = 'no-drop'; res.reasons.push('داده کافی است اما کاهش معناداری (≥۵٪) نسبت به قیمت پایه دیده نمی‌شود؛ تخفیف تأییدشده‌ای وجود ندارد.'); }
    if (st.sellers > 1) res.reasons.push(`برندهٔ «خرید» در این بازه ${U.toFa(st.sellers)} فروشندهٔ مختلف بوده؛ قیمت روزانه ممکن است بین فروشنده‌ها جابه‌جا شده باشد.`);
    if (st.span < 90) res.reasons.push(`بازهٔ واقعی داده ${U.toFa(st.span)} روز است (کمتر از ۹۰ روز).`);
    if (st.missingDays > 0) res.reasons.push(`${U.toFa(st.missingDays)} روز در بازه داده‌ای ثبت نشده است (درون‌یابی نشده).`);
    return res;
  }

  // Buying advisor. Only data that exists; unknown stays unknown.
  function advise({ current, offers = [], hostKey = '', st = null, insp = null }) {
    const points = [], caveats = []; let tone = 'neutral', headline = 'اطلاعات کافی برای توصیهٔ قطعی نیست';
    if (!(current > 0)) return { tone, headline: 'قیمت فعلی پیدا نشد', points, caveats: ['ابتدا قیمت را دستی ثبت کنید.'] };
    const trusted = offers.filter(o => o.matchLevel !== 'low' && o.sellerKey !== hostKey);
    const best = trusted.slice().sort((a, b) => a.price - b.price)[0];
    let cheaper = false;
    if (best) {
      const diff = (current - best.price) / current;
      if (diff >= 0.02) { cheaper = true; points.push({ k: 'good', text: `${best.seller} حدود ${U.fmtPct(diff * 100)} (${U.fmt(current - best.price)} تومان) ارزان‌تر است.` }); }
      else points.push({ k: 'ok', text: 'قیمت این صفحه با ارزان‌ترین فروشندهٔ تطبیق‌یافته برابر یا کمتر است.' });
      if (best.matchLevel === 'medium') caveats.push('اطمینان تطبیق محصول در ترب «متوسط» است؛ مدل را قبل از خرید تأیید کنید.');
    } else caveats.push('فروشندهٔ دیگری با تطبیق قابل‌اتکا پیدا نشد.');
    let histGood = null;
    if (st && st.count >= 10) {
      if (current <= st.min * 1.03) { histGood = true; points.push({ k: 'good', text: `قیمت نزدیک کمترین قیمت ثبت‌شده (${U.fmt(st.min)}) در ${U.toFa(st.span)} روز اخیر است.` }); }
      else if (current >= st.median * 1.1) { histGood = false; points.push({ k: 'warn', text: `قیمت ${U.fmtPct((current / st.median - 1) * 100)} بالاتر از میانهٔ ${U.toFa(st.span)} روز اخیر (${U.fmt(st.median)}) است.` }); }
      else points.push({ k: 'ok', text: `قیمت در محدودهٔ معمول ${U.toFa(st.span)} روز اخیر است (کمینه ${U.fmt(st.min)}، میانه ${U.fmt(st.median)}).` });
    } else caveats.push('سابقهٔ قیمت کافی برای قضاوت دربارهٔ زمان خرید وجود ندارد.');
    if (insp && insp.verdict === 'rise-signal') { points.push({ k: 'warn', text: 'نشانهٔ افزایش قیمت پیش از تخفیف دیده می‌شود؛ تخفیف ادعایی را با احتیاط ببینید.' }); }
    caveats.push('هزینهٔ ارسال و گارانتی در مقایسه لحاظ نشده (داده‌ی قابل‌اتکا موجود نیست).');
    if (cheaper) { tone = 'warn'; headline = 'فروشندهٔ ارزان‌تری وجود دارد'; }
    else if (histGood === true) { tone = 'good'; headline = 'از نظر قیمت، زمان نسبتاً مناسبی است'; }
    else if (histGood === false) { tone = 'warn'; headline = 'قیمت فعلی از حد معمول بالاتر است'; }
    else if (best) { tone = 'good'; headline = 'قیمت این صفحه رقابتی است'; }
    return { tone, headline, points, caveats };
  }
  return { valid, stats, inspect, advise, confidenceOf };
})();


// ---- 10-app.js ----
/* ===== App: single shared state. Every UI tab and alert reads from here (no module keeps private copies). ===== */
const App = (() => {
  const state = {
    product: null,            // Model.product
    key: '',
    offers: [],               // Model.offer[] from all sources
    sources: {},              // id -> {status, count, note, error, ts, nearMiss}
    dk: null,                 // parsed Digikala product record
    chart: null, chartError: '', chartLoading: false, variantIdx: 0, variantExact: false, variantManual: false,
    range: 90, tab: 'compare', running: false, sort: 'price', trustedOnly: false, banner: '',
    dkFetching: false, dkTs: 0, historyCooldownUntil: 0, historyCooldownNote: ''
  };
  const subs = new Set(); const emit = () => subs.forEach(f => { try { f(state); } catch (e) { Log.error('ui', e.message); } });
  const on = f => subs.add(f);

  const settings = () => Store.get().settings;
  const keyFor = p => `${p.host}:${p.id || U.compact(location.pathname).slice(0, 60)}`;

  async function refreshProduct() {
    const x = Extract.product(document);
    const prev = state.product;
    const p = Model.product({ ...x, key: '', priceTs: Date.now() });
    p.key = keyFor(p);
    // keep a manual price if extraction failed
    if (!p.price && prev && prev.key === p.key && prev.priceSource === 'دستی') { p.price = prev.price; p.priceSource = 'دستی'; }
    if (state.key && state.key !== p.key) { state.offers = []; state.sources = {}; state.chart = null; state.chartError = ''; state.dk = null; state.dkTs = 0; state.dkFetching = false; state.historyCooldownUntil = 0; state.historyCooldownNote = ''; state.variantIdx = 0; state.variantExact = false; state.variantManual = false; }
    state.product = p; state.key = p.key;
    const rec = Store.touchProduct(p.key, { host: p.host, pid: p.id, title: p.title || '', url: p.url, variantTitle: x.color || '', variantId: p.variantId });
    // Only trustworthy readings enter local history (page still loading / weak heuristics would pollute it).
    const TRUSTED = /JSON-LD|نوار خرید|متای صفحه|data-testid|دستی/;
    if (p.price && p.title && TRUSTED.test(p.priceSource || '')) { if (Store.recordLocal(rec, p.price, 'page:' + p.priceSource, Date.now(), p.variantId)) Log.info('store', 'نقطهٔ محلی ثبت شد'); }
    else if (p.price) Log.info('store', 'قیمت برای تاریخچهٔ محلی ثبت نشد (منبع ضعیف یا نام خالی)');
    Store.save(); emit();
    // Guard against overlapping refreshProduct() calls racing to fetch the SAME in-flight Digikala product:
    // state.dk only becomes truthy once the fetch RESOLVES, so a second call arriving while the first is still
    // in flight must NOT see "!state.dk" as a green light — that was the bug behind the 429 storm.
    if (p.id && p.host.endsWith('digikala.com') && !state.dkFetching && (!state.dk || Date.now() - state.dkTs > 120000)) {
      state.dkFetching = true; state.dkTs = Date.now();
      loadDigikala(p, x.color).finally(() => { state.dkFetching = false; });
    }
    return p;
  }

  async function loadDigikala(p, color) {
    try {
      state.dk = await Sources.dk.product(p.id, p.variantId);
      const d = state.dk;
      if (d) p.altTitles = [d.title, d.titleEn].filter(Boolean);
      if (d && d.chosen) {
        p.seller = d.chosen.seller; p.warranty = d.chosen.warranty; p.variantTitle = d.chosen.title;
        if (!p.oldPrice && d.chosen.rrp) p.oldPrice = d.chosen.rrp;
        if (!p.price) { p.price = d.chosen.price; p.priceSource = 'API دیجی‌کالا (واریانت دقیق)'; }
        else if (Math.abs(p.price - d.chosen.price) / d.chosen.price > 0.02) { Log.warn('price', `اختلاف قیمت صفحه (${p.price}) و API (${d.chosen.price})`); p.priceNote = 'قیمت صفحه با API دیجی‌کالا اختلاف دارد'; }
      } else if (d && !p.price && d.variants.length) { p.price = d.variants[0].price; p.priceSource = 'API دیجی‌کالا (ارزان‌ترین واریانت؛ واریانت دقیق نامشخص)'; }
      emit();
    } catch (e) { Log.warn('dk-product', e.message); }
    if (!state.chart && Date.now() >= state.historyCooldownUntil) loadHistory(color); // cooldown also guards the automatic retry after loadDigikala
  }

  async function loadHistory(color, { force = false } = {}) {
    const p = state.product; if (!p || !p.id || state.chartLoading) return;
    if (!force && Date.now() < state.historyCooldownUntil) return; // never hammer a rate-limited endpoint, even on manual retry
    state.chartLoading = true; state.chartError = ''; emit();
    try {
      state.chart = await Sources.dk.chart(p.id);
      state.historyCooldownUntil = 0; state.historyCooldownNote = '';
      const preferred = [state.dk?.chosen?.title, p.variantTitle, color, Extract.selectedColor()].filter(Boolean);
      const pick = Sources.dk.pickVariant(state.chart, preferred);
      state.variantIdx = pick ? Math.max(0, state.chart.variants.indexOf(pick.variant)) : 0; state.variantExact = !!(pick && pick.exact);
      state.variantManual = false;
      Log.info('history', `بازهٔ داده: ${state.chart.range ? state.chart.range.days + ' روز' : '—'}, واریانت‌ها: ${state.chart.variants.length}`);
    } catch (e) {
      state.chart = null;
      const retryMs = e.retryAfterMs > 0 ? e.retryAfterMs : (e.status === 429 ? 90000 : 20000);
      state.historyCooldownUntil = Date.now() + retryMs; state.historyCooldownNote = e.status === 429 ? 'rate-limit' : 'error';
      state.chartError = e.status === 429 ? `محدودیت نرخ دیجی‌کالا (HTTP 429)؛ تا ${Math.ceil(retryMs / 1000)} ثانیهٔ دیگر دوباره تلاش نمی‌شود` : e.message;
      const message = e.message + (e.retryAfterMs ? ` (Retry-After: ${Math.round(e.retryAfterMs / 1000)}s)` : '');
      if (e.status === 429) Log.warn('history', message); else Log.error('history', message);
    }
    state.chartLoading = false; emit();
  }

  async function runCompare(opts = {}) {
    if (state.running) return;
    const p = state.product || await refreshProduct();
    if (!p.title) { state.banner = 'نام محصول در این صفحه پیدا نشد.'; emit(); return; }
    state.banner = ''; state.running = true; state.offers = []; state.sources = {};
    const reg = Sources.registry, cfg = settings().sources;
    for (const id of Object.keys(reg)) state.sources[id] = { status: reg[id].implemented ? (cfg[id] ? 'loading' : 'off') : 'unavailable', count: 0, note: reg[id].implemented ? '' : reg[id].note };
    emit();
    await Promise.all(Object.keys(reg).filter(id => reg[id].implemented && cfg[id]).map(async id => {
      try {
        const r = await reg[id].fetch(p, opts);
        state.sources[id] = { status: r.status, count: r.offers.length, note: r.note || '', nearMiss: r.nearMiss || [], candidates: r.candidates || [], chosenKey: r.chosenKey || '', query: r.query || '', tried: r.tried || [], ts: Date.now() };
        state.offers.push(...r.offers);
      } catch (e) { state.sources[id] = { status: 'error', count: 0, error: e.message, ts: Date.now() }; Log.error(id, e.message); }
      emit();
    }));
    state.running = false; emit();
  }

  // Switch the matched Torob product (e.g. another colour/model variant) without re-running other sources.
  async function pickCandidate(key) {
    const p = state.product, st = state.sources.torob; if (!p || !st || state.running) return;
    state.running = true; emit();
    try {
      const r = await Sources.torob.fetch(p, { query: st.query, pickKey: key });
      state.offers = state.offers.filter(o => o.sourceId !== 'torob').concat(r.offers);
      state.sources.torob = { ...st, status: r.status, count: r.offers.length, note: r.note, candidates: r.candidates, chosenKey: r.chosenKey || key, ts: Date.now(), error: '' };
    } catch (e) { state.sources.torob = { ...st, status: 'error', error: e.message }; Log.error('torob', e.message); }
    state.running = false; emit();
  }
  function setManualPrice(n) {
    const p = state.product; if (!p || !(n > 0)) return;
    p.price = n; p.priceSource = 'دستی'; p.priceTs = Date.now();
    const rec = Store.touchProduct(p.key); Store.recordLocal(rec, n, 'manual', Date.now(), p.variantId); Store.save(); emit();
  }

  const selectedVariant = () => state.chart && state.chart.variants[state.variantIdx] || null;
  function historyPoints() { const v = selectedVariant(); return v ? v.points : []; }
  function localHistoryPoints() {
    const p = state.product || {}, rec = p.key && Store.get().products[p.key];
    const points = rec && Array.isArray(rec.local) ? rec.local : [];
    const chartVariants = state.chart && state.chart.variants || [], selected = selectedVariant();
    const selectedTitle = U.compact(selected && selected.title || '');
    const currentTitle = U.compact(state.dk?.chosen?.title || p.variantTitle || Extract.selectedColor() || '');
    if (selectedTitle && currentTitle && !selectedTitle.includes(currentTitle) && !currentTitle.includes(selectedTitle)) return [];
    // Older local records have no variant id. Use them only when the chart is unambiguous.
    return points.filter(x => x.variantId
      ? String(x.variantId) === String(p.variantId || '')
      : !p.id || chartVariants.length === 1);
  }
  function combinedHistoryPoints() {
    const byDay = new Map();
    for (const x of localHistoryPoints()) {
      const point = { t: x.t, day: U.isoDay(x.t), price: x.p, rrp: null, seller: '', warranty: '', marketable: x.p > 0, source: x.src || 'local', kind: 'local' };
      byDay.set(point.day, point);
    }
    // Official points take precedence on a day with both sources.
    for (const point of Analysis.valid(historyPoints())) byDay.set(U.isoDay(point.t), point);
    return [...byDay.values()].sort((a, b) => a.t - b.t);
  }
  function inspector() {
    const pts = combinedHistoryPoints(); const p = state.product || {};
    const variantCount = state.chart?.variants.length || 0;
    return Analysis.inspect(pts, {
      currentPrice: p.price, claimedOld: p.oldPrice,
      variantCount,
      variantVerified: variantCount <= 1 || state.variantExact || state.variantManual
    });
  }
  function advice() {
    const p = state.product || {}; const pts = combinedHistoryPoints();
    const hostKey = Extract.matchKnownSite(p.host || '') || '';
    return Analysis.advise({ current: p.price, offers: state.offers, hostKey, st: Analysis.stats(pts), insp: pts.length ? inspector() : null });
  }
  return { state, on, emit, pickCandidate, settings, refreshProduct, loadHistory, runCompare, setManualPrice, selectedVariant, historyPoints, localHistoryPoints, combinedHistoryPoints, inspector, advice };
})();


// ---- 11-alerts.js ----
/* ===== Alerts: price-target checks. Runs only while at least one tab with this script is open (userscript limit). ===== */
const Alerts = (() => {
  const TICK = 5 * 60e3;
  async function currentPriceFor(p) {
    if (/digikala\.com$/.test(p.host) && p.pid) {
      const d = await Sources.dk.product(p.pid, p.variantId);
      if (d && d.chosen) return { price: d.chosen.price, src: 'digikala-api:variant' };
      return null; // exact variant unknown: do not guess
    }
    return null; // other hosts: last price seen while visiting the page
  }
  function notify(p, price) {
    const text = `${p.title || p.key}\nقیمت فعلی ${U.fmt(price)} تومان (هدف ${U.fmt(p.target)})`;
    try { if (typeof GM_notification === 'function') { GM_notification({ title: 'GHAFEL PRO — هشدار قیمت', text, timeout: 15000, onclick: () => window.open(p.url, '_blank') }); return true; } } catch (e) { Log.warn('alerts', e.message); }
    App.state.banner = 'هشدار قیمت: ' + text.replace('\n', ' — '); App.emit(); return false;
  }
  function evaluate(p, price) {
    if (!p.watch || !(p.target > 0) || !(price > 0) || price > p.target) return false;
    const day = 24 * 3600e3;
    if (!p.notifiedAt || price < (p.notifiedPrice || Infinity) || Date.now() - p.notifiedAt > day) { p.notifiedAt = Date.now(); p.notifiedPrice = price; notify(p, price); return true; }
    return false;
  }
  async function checkAll(force = false) {
    const db = Store.get(), a = db.settings.alerts; if (!a.enabled && !force) return { checked: 0, fired: 0 };
    const due = Date.now() - (a.lastRun || 0) >= Math.max(15, a.intervalMin) * 60e3; if (!due && !force) return { checked: 0, fired: 0 };
    a.lastRun = Date.now(); Store.save();
    let checked = 0, fired = 0;
    for (const p of Object.values(db.products).filter(x => x.watch)) {
      try { const r = await currentPriceFor(p); if (r) { checked++; Store.recordLocal(p, r.price, r.src, Date.now(), p.variantId); if (evaluate(p, r.price)) fired++; } else if (p.lastPrice) { if (evaluate(p, p.lastPrice)) fired++; } }
      catch (e) { Log.warn('alerts', `${p.key}: ${e.message}`); }
      await U.sleep(1200 + Math.random() * 800);
    }
    Store.save(); Log.info('alerts', `بررسی ${checked} محصول، ${fired} هشدار`); return { checked, fired };
  }
  let timer = null;
  const start = () => { if (timer) return; timer = setInterval(() => checkAll(false).catch(e => Log.warn('alerts', e.message)), TICK); setTimeout(() => checkAll(false).catch(() => {}), 8000); };
  return { start, checkAll, evaluate };
})();


// ---- 12-export.js ----
/* ===== Export / import (CSV + JSON) ===== */
const Exporter = (() => {
  const q = v => {
    let s = String(v ?? '');
    // Keep spreadsheet programs from evaluating page-supplied text as a formula.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function csvFor(key, chartPoints) {
    const p = Store.get().products[key]; const rows = [['product_key', 'title', 'date_iso', 'price_toman', 'kind', 'source']];
    for (const x of (chartPoints || [])) rows.push([key, p?.title || '', U.isoDay(x.t), x.price ?? '', 'store', x.source]);
    for (const x of (p?.local || [])) rows.push([key, p?.title || '', new Date(x.t).toISOString(), x.p, 'local', x.src || 'local']);
    return rows.map(r => r.map(q).join(',')).join('\n');
  }
  const jsonAll = extra => JSON.stringify({ app: 'تخفیف‌سنج 15.2.2', exportedAt: new Date().toISOString(), db: Store.get(), ...extra }, null, 2);
  function parseCsv(text) {
    const out = []; const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean); if (!lines.length) return out;
    const head = lines[0].toLowerCase().split(',').map(s => s.trim().replace(/"/g, ''));
    const ci = n => head.indexOf(n), di = ci('date_iso') >= 0 ? ci('date_iso') : ci('date'), pi = ci('price_toman'), si = ci('source'), ki = ci('kind');
    if (di < 0 || pi < 0) throw new Error('ستون‌های date/date_iso و price_toman لازم است');
    for (const ln of lines.slice(1)) {
      const c = ln.split(','); const t = Date.parse(c[di]); const price = Number(U.digits(c[pi]).replace(/\D/g, ''));
      if (!isFinite(t) || !(price > 0)) continue; if (ki >= 0 && c[ki] === 'store') continue; // store data is re-fetched, never imported as local
      out.push({ t, p: price, src: 'imported:' + (c[si] || 'csv') });
    }
    return out;
  }
  function importLocal(key, rows) {
    const p = Store.touchProduct(key); const have = new Set(p.local.map(x => x.t + ':' + x.p)); let n = 0;
    for (const r of rows) if (!have.has(r.t + ':' + r.p)) { p.local.push(r); n++; }
    p.local.sort((a, b) => a.t - b.t); Store.save(); return n;
  }
  function download(name, text, mime) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: (mime || 'text/csv') + ';charset=utf-8' }));
    a.download = name; document.documentElement.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  return { csvFor, jsonAll, parseCsv, importLocal, download };
})();


// ---- 12-icons.js ----
/* Solar Icon Set by 480 Design, licensed CC BY 4.0: https://github.com/480-Design/Solar-Icon-Set */
const SolarIcons = {
  tag: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M2.85574 7.39057L2.57231 8.61875C2.08083 10.7485 1.83509 11.8134 2.12264 12.816C2.41018 13.8186 3.18295 14.5914 4.72848 16.1369L6.55812 17.9665C9.24711 20.6555 10.5916 22 12.2623 22C13.933 22 15.2775 20.6555 17.9665 17.9665C20.6555 15.2775 22 13.933 22 12.2623C22 10.5916 20.6555 9.24711 17.9665 6.55812L16.1369 4.72848C14.5914 3.18295 13.8186 2.41018 12.816 2.12264C11.8134 1.83509 10.7485 2.08083 8.61875 2.57231L7.39057 2.85574C5.59881 3.26922 4.70292 3.47597 4.08944 4.08944C3.47597 4.70292 3.26922 5.59881 2.85574 7.39057Z\"/><circle cx=\"8.607\" cy=\"8.879\" r=\"2\"/><path d=\"M11.5413 18.4998L18.5203 11.5205\"/></g>",
  compare: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z\"/><path d=\"M7 18V9\"/><path d=\"M12 18V6\"/><path d=\"M17 18V13\"/></g>",
  history: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M12 8V12L14.5 14.5\"/><path d=\"M4.33776 6.87058L5.60414 5.6042C9.10115 2.10719 14.7996 2.13582 18.3319 5.66816C21.8642 9.2005 21.8929 14.8989 18.3959 18.3959C14.8988 21.8929 9.20044 21.8643 5.6681 18.332C3.57589 16.2397 2.71285 13.3876 3.08355 10.6831M4.32497 4.32503L4.33776 6.87058L6.88331 6.88337\"/></g>",
  search: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><circle cx=\"11.5\" cy=\"11.5\" r=\"9.5\"/><path d=\"M18.2168 18.2178L21.9994 22.0004\"/></g>",
  heart: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M8.96173 18.9108C6.01943 16.5913 2 14 2 9.13704C2 4.2741 7.50016 0.825403 12 5.50057C16.4998 0.825403 22 4.2741 22 9.13704C22 14 17.9806 16.5913 15.0383 18.9108C14 19.7293 13 20.4999 12 20.4999C11 20.4999 10 19.7293 8.96173 18.9108Z\"/>",
  settings: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M3 11.5937V12.4063C3 14.8092 3 16.0106 3.55692 17C4.11384 17.9894 5.1282 18.5901 7.15692 19.7915L7.84308 20.1979C9.8718 21.3993 10.8862 22 12 22C13.1138 22 14.1282 21.3993 16.1569 20.1979L16.8431 19.7915C18.8718 18.5901 19.8862 17.9894 20.4431 17C21 16.0106 21 14.8092 21 12.4063V11.5937C21 9.19084 21 7.98943 20.4431 7C19.8862 6.01057 18.8718 5.40987 16.8431 4.20846L16.1569 3.80211C14.1282 2.6007 13.1138 2 12 2C10.8862 2 9.8718 2.6007 7.84308 3.80211L7.15692 4.20846C5.1282 5.40987 4.11384 6.01057 3.55692 7C3 7.98943 3 9.19084 3 11.5937Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></g>",
  bug: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M19 11.9375V15C19 18.866 15.866 22 12 22C8.13401 22 5 18.866 5 15V11.9375C5 9.76288 6.76288 8 8.9375 8H15.0625C17.2371 8 19 9.76288 19 11.9375Z\"/><path d=\"M16.5 8.27065V7.5C16.5 5.01472 14.4853 3 12 3C9.51472 3 7.5 5.01472 7.5 7.5V8.27065\"/><path d=\"M19 14H22\"/><path d=\"M5 14H2\"/><path d=\"M14.29 3.62571L16.9996 2\"/><path d=\"M9.70996 3.62569L7.00047 2\"/><path d=\"M17.7998 18.9202L20.4997 20.0002\"/><path d=\"M17.7803 9.08786L20.5004 7.99981\"/><path d=\"M6.2002 18.9203L3.50036 20.0002\"/><path d=\"M12 22V15\"/><path d=\"M6.2207 9.08781L3.50067 7.9998\"/></g>",
  refresh: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M3.67981 13L3.67981 11.3333C3.67981 6.73096 7.4402 3 12.0789 3C15.1178 3 17.7799 4.60136 19.2545 7M2 11.3333L3.67981 13L5.35962 11.3333\"/><path d=\"M20.3139 11V12.6667C20.3139 17.269 16.5391 21 11.8827 21C8.83213 21 6.15995 19.3986 4.67969 17M22.0001 12.6667L20.3139 11L18.6277 12.6667\"/></g>",
  wallet: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"round\" d=\"M6 10H10\"/><path d=\"M18.2308 11H20.8333C20.9167 11 20.9583 11 20.9935 11.0021C21.5328 11.035 21.9623 11.4338 21.9977 11.9346C22 11.9673 22 12.006 22 12.0833V15.9167C22 15.994 22 16.0327 21.9977 16.0654C21.9623 16.5662 21.5328 16.965 20.9935 16.9979C20.9583 17 20.9167 17 20.8333 17H18.2308C16.4465 17 15 15.6569 15 14C15 12.3431 16.4465 11 18.2308 11Z\"/><path d=\"M20.965 11C20.8873 9.1277 20.6366 7.97975 19.8284 7.17157C18.6569 6 16.7712 6 13 6H10C6.22876 6 4.34315 6 3.17157 7.17157C2 8.34315 2 10.2288 2 14C2 17.7712 2 19.6569 3.17157 20.8284C4.34315 22 6.22876 22 10 22H13C16.7712 22 18.6569 22 19.8284 20.8284C20.6366 20.0203 20.8873 18.8723 20.965 17\"/><path d=\"M5.81348 6.12127L5.99984 6L9.73532 3.52313C10.7873 2.82562 12.2124 2.82562 13.2644 3.52313L16.9998 6L17.1818 6.12077\"/><path stroke-linejoin=\"round\" d=\"M17.9912 14H18.0002\"/></g>",
  download: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15\"/><path d=\"M12 3V16M8 11.625L12 16L16 11.625\"/></g>",
  file: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"round\" d=\"M7 14L6 15L7 16M11.5 16L12.5 17L11.5 18M10 14L8.5 18\"/><path d=\"M13 2.2627V5.0003C13 7.35732 13 8.53583 13.7322 9.26806C14.4645 10.0003 15.643 10.0003 18 10.0003H21.58\"/><path stroke-linejoin=\"round\" d=\"M3.17139 3.17157C4.34296 2 6.23851 2 10.0296 2C11.5546 2 12.3173 2.00011 13.0093 2.26562C13.7012 2.53114 14.2651 3.03857 15.3929 4.05365L19.3516 7.61621C20.6558 8.78998 21.3078 9.3774 21.6538 10.1543C21.9998 10.9312 22 11.8079 22 13.5625V14C22 17.7712 22 19.6566 20.8284 20.8281C19.6569 21.9997 17.7712 22 14 22L9.9969 21.9997C6.22761 21.9997 4.34284 21.9997 3.17157 20.8284C2 19.6569 2 17.7712 2 14V9.9982C2 6.22817 2 4.34296 3.17139 3.17157Z\"/></g>",
  upload: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15\"/><path d=\"M12 16V3M8 7.375L12 3L16 7.375\"/></g>",
  trash: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M20.5001 6H3.5\"/><path d=\"M18.8332 8.5L18.3732 15.3991C18.1962 18.054 18.1077 19.3815 17.2427 20.1907C16.3777 21 15.0473 21 12.3865 21H11.6132C8.95235 21 7.62195 21 6.75694 20.1907C5.89194 19.3815 5.80344 18.054 5.62644 15.3991L5.1665 8.5\"/><path d=\"M9.5 11L10 16\"/><path d=\"M14.5 11L14 16\"/><path d=\"M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571L8.57143 4.2857C8.65431 4.03708 8.69575 3.91275 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697L15.5258 4.57733C15.5433 4.63004 15.5522 4.65656 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6\"/></g>",
  bell: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M18.7491 9.70957V9.00496C18.7491 5.13623 15.7274 2 12 2C8.27256 2 5.25087 5.13623 5.25087 9.00496V9.70957C5.25087 10.5552 5.00972 11.3818 4.5578 12.0854L3.45036 13.8095C2.43882 15.3843 3.21105 17.5249 4.97036 18.0229C9.57274 19.3257 14.4273 19.3257 19.0296 18.0229C20.789 17.5249 21.5612 15.3843 20.5496 13.8095L19.4422 12.0854C18.9903 11.3818 18.7491 10.5552 18.7491 9.70957Z\"/><path d=\"M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19\"/></g>",
  clock: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path stroke-linejoin=\"round\" d=\"M12 8V12L14.5 14.5\"/></g>",
  global: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 10.6868 2.25866 9.38642 2.76121 8.17316C3.26375 6.95991 4.00035 5.85752 4.92893 4.92893C5.85752 4.00035 6.95991 3.26375 8.17317 2.7612C9.38642 2.25866 10.6868 2 12 2C13.3132 2 14.6136 2.25866 15.8268 2.76121C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12L22 12Z\"/><path d=\"M16 12C16 13.3132 15.8965 14.6136 15.6955 15.8268C15.4945 17.0401 15.1999 18.1425 14.8284 19.0711C14.457 19.9997 14.016 20.7362 13.5307 21.2388C13.0454 21.7413 12.5253 22 12 22C11.4747 22 10.9546 21.7413 10.4693 21.2388C9.98396 20.7362 9.54301 19.9997 9.17157 19.0711C8.80014 18.1425 8.5055 17.0401 8.30448 15.8268C8.10346 14.6136 8 13.3132 8 12C8 10.6868 8.10346 9.38642 8.30448 8.17316C8.5055 6.95991 8.80014 5.85752 9.17157 4.92893C9.54301 4.00035 9.98396 3.26375 10.4693 2.7612C10.9546 2.25866 11.4747 2 12 2C12.5253 2 13.0454 2.25866 13.5307 2.76121C14.016 3.26375 14.457 4.00035 14.8284 4.92893C15.1999 5.85752 15.4945 6.95991 15.6955 8.17317C15.8965 9.38642 16 10.6868 16 12L16 12Z\"/><path d=\"M2 12H22\"/></g>",
  chat: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M22 12C22 17.5228 17.5228 22 12 22C10.4003 22 8.88837 21.6244 7.54753 20.9565C7.19121 20.7791 6.78393 20.72 6.39939 20.8229L4.17335 21.4185C3.20701 21.677 2.32295 20.793 2.58151 19.8267L3.17712 17.6006C3.28001 17.2161 3.22094 16.8088 3.04346 16.4525C2.37562 15.1116 2 13.5997 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z\"/>",
  layers: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M16.2127 10.8085L19.0212 9.68508C21.0071 8.89073 22 8.49355 22 8C22 7.50645 21.0071 7.10927 19.0212 6.31492L16.2127 5.19153C14.2268 4.39718 13.2339 4 12 4C10.7661 4 9.77318 4.39718 7.7873 5.19153L4.97883 6.31492C2.99294 7.10927 2 7.50645 2 8C2 8.49355 2.99294 8.89073 4.97883 9.68508L7.7873 10.8085C9.77318 11.6028 10.7661 12 12 12C13.2339 12 14.2268 11.6028 16.2127 10.8085Z\"/><path d=\"M22 12C22 12 21.0071 12.8907 19.0212 13.6851L16.2127 14.8085C14.2268 15.6028 13.2339 16 12 16C10.7661 16 9.77318 15.6028 7.7873 14.8085L4.97883 13.6851C2.99294 12.8907 2 12 2 12\"/><path d=\"M22 16C22 16 21.0071 16.8907 19.0212 17.6851L16.2127 18.8085C14.2268 19.6028 13.2339 20 12 20C10.7661 20 9.77318 19.6028 7.7873 18.8085L4.97883 17.6851C2.99294 16.8907 2 16 2 16\"/></g>",
  link: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M10.0464 14C8.54044 12.4882 8.67609 9.90087 10.3494 8.22108L15.197 3.35462C16.8703 1.67483 19.4476 1.53865 20.9536 3.05046C22.4596 4.56228 22.3239 7.14956 20.6506 8.82935L18.2268 11.2626\"/><path d=\"M13.9536 10C15.4596 11.5118 15.3239 14.0991 13.6506 15.7789L11.2268 18.2121L8.80299 20.6454C7.12969 22.3252 4.55237 22.4613 3.0464 20.9495C1.54043 19.4377 1.67609 16.8504 3.34939 15.1706L5.77323 12.7373\"/></g>",
  shield: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M21 11.9914C21 11.4234 21 10.8996 21 10.4167C21 7.21907 21 5.62028 20.6225 5.08241C20.245 4.54454 18.7417 4.02996 15.7351 3.00079L15.1623 2.80472C13.595 2.26824 12.8114 2 12 2C11.1886 2 10.405 2.26824 8.83772 2.80472L8.26491 3.00079C5.25832 4.02996 3.75503 4.54454 3.37752 5.08241C3 5.62028 3 7.21907 3 10.4167C3 10.8996 3 11.4234 3 11.9914C3 17.6294 7.23896 20.3655 9.89856 21.5273C10.62 21.8424 10.9807 22 12 22C13.0193 22 13.38 21.8424 14.1014 21.5273C16.761 20.3655 21 17.6294 21 11.9914Z\"/><path stroke-linejoin=\"round\" d=\"M9.5 12.4L10.9286 14L14.5 10\"/></g>",
  close: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M19.0068 5L5.00684 19\"/><path d=\"M19 19L5 5\"/></g>",
  minus: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M20 12L4 12\"/>",
  expand: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"round\" d=\"M12 12L17 7M17 10.75V7H13.25\"/><path stroke-linejoin=\"round\" d=\"M12 12L7 17M7 13.25V17H10.75\"/><path d=\"M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z\"/></g>",
  sun: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"6\"/><path d=\"M12 2V3\"/><path d=\"M12 21V22\"/><path d=\"M22 12L21 12\"/><path d=\"M3 12L2 12\"/><path d=\"M19.0703 4.9292L18.6775 5.32204\"/><path d=\"M5.32227 18.6782L4.92943 19.0711\"/><path d=\"M19.0703 19.0708L18.6775 18.678\"/><path d=\"M5.32227 5.32178L4.92943 4.92894\"/></g>",
  pin: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M2 22L6.65323 17.342M19.0716 8.03562L15.9894 4.9502C13.8823 2.84101 12.8288 1.78641 11.6973 2.03606C10.5657 2.28571 10.0527 3.68593 9.02665 6.48636L8.3322 8.38177C8.05866 9.12835 7.92189 9.50164 7.67582 9.79038C7.56541 9.91994 7.43978 10.0357 7.30167 10.1351C6.99386 10.3567 6.61092 10.4623 5.84504 10.6735C4.11881 11.1494 3.2557 11.3873 2.93045 11.9521C2.78985 12.1962 2.71668 12.4734 2.71846 12.7552C2.72258 13.4071 3.35561 14.0408 4.62169 15.3081L8.73837 19.429C10.0125 20.7044 10.6496 21.3421 11.3052 21.3431C11.5816 21.3435 11.8532 21.2717 12.0933 21.1347C12.6629 20.8096 12.9021 19.9401 13.3806 18.2012C13.5909 17.4366 13.6961 17.0543 13.9169 16.7466C14.0136 16.6119 14.1257 16.489 14.251 16.3805C14.5372 16.1326 14.9081 15.9933 15.6498 15.7146L17.5669 14.9943C20.3364 13.9537 21.7211 13.4335 21.9652 12.3049C22.2092 11.1764 21.1633 10.1295 19.0716 8.03562Z\"/>",
};


// ---- 13-ui.js ----
/* ===== UI: ONE Shadow-DOM panel. Reads only from App.state. ===== */
const UI = (() => {
  const HOST_ID = 'ghafel-pro-host';
  const ICONS = SolarIcons;
  const CSS = `
:host{all:initial;direction:rtl;font-family:Vazirmatn,"Noto Sans Arabic",Tahoma,system-ui,"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.55;position:fixed;z-index:2147483646}
*{box-sizing:border-box;font-family:inherit}
.dark{--bg:#0e1014;--panel:#15181e;--card:#1d222a;--ink:#f3f4f6;--mut:#a7abb4;--acc:#d4aa45;--acc2:#f0c65a;--on-acc:#15171b;--warn:#edbd58;--bad:#ed7777;--good:#78c99a;--good-soft:rgba(120,201,154,.1);--warn-soft:rgba(237,189,88,.11);--line:#343943;--shadow:0 16px 46px rgba(0,0,0,.52);--chart-official:#9a8ef0;--chart-label:#a7abb4;--chart-local:#f0c65a;--chart-min:#78c99a;--scroll-thumb:rgba(167,171,180,.48);--scroll-hover:rgba(240,198,90,.78)}
.light{--bg:#fbf8ef;--panel:#fff;--card:#f7efd8;--ink:#201c10;--mut:#8a7a4e;--acc:#b8860b;--acc2:#8a6d00;--warn:#b45309;--bad:#dc2626;--line:#e8dcb5;--shadow:0 12px 40px rgba(120,96,20,.22);--chart-official:#8b5cf6;--chart-label:#a9a6d6;--chart-local:#fbbf24;--chart-min:#34d399;--scroll-thumb:rgba(138,122,78,.42);--scroll-hover:rgba(184,134,11,.72)}
.wrap{color:var(--ink)}
#pill{all:unset;cursor:pointer;display:inline-flex;gap:7px;align-items:center;padding:9px 16px;border-radius:999px;background:linear-gradient(135deg,#1a1a1a,#000);border:1px solid #d4af37;color:#f1c94e;font-weight:700;box-shadow:var(--shadow);user-select:none;font-family:inherit;font-size:13px}
.icon{display:inline-block;width:16px;height:16px;flex:0 0 auto;vertical-align:middle}.icon-sm{width:14px;height:14px}
#pill:hover{filter:brightness(1.1)}
#panel{position:relative;display:none;width:min(420px,calc(100vw - 20px));max-height:min(84vh,680px);flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}
#panel.open{display:flex}
#panel.wide{width:min(560px,calc(100vw - 20px))}
header,.hero,.tabs,.foot{flex-shrink:0}
.tb{width:100%;border-collapse:collapse;font-size:12px}.tb td{padding:5px 3px;border-bottom:1px solid var(--line);vertical-align:middle}.tb tr.best td{background:rgba(52,211,153,.08)}.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:4px}.dot.high{background:var(--acc2)}.dot.medium{background:var(--warn)}.dot.low{background:var(--bad)}
input[type=text]{min-width:0}#q{flex:1}
#rs{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;touch-action:none;background:linear-gradient(135deg,transparent 50%,var(--mut) 50%);opacity:.55;border-bottom-right-radius:18px;z-index:5}#rs:hover{opacity:1}
.tabs{position:relative;z-index:2;background:var(--panel)}
.body{min-height:0;overscroll-behavior:contain}
#panel.compact .meta{display:none}#panel.compact .price{font-size:16px;margin:0}#panel.compact .name{-webkit-line-clamp:1;font-size:12px}#panel.compact .hero{padding:6px 14px}
#pill{touch-action:none}header{touch-action:none}
header{cursor:move;padding:12px 14px 10px;background:linear-gradient(135deg,rgba(212,175,55,.18),rgba(0,0,0,.25));border-bottom:1px solid var(--line);position:relative}
.bf-badge{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;background:linear-gradient(135deg,#d4af37,#f1c94e);color:#111;font-size:10px;font-weight:800;vertical-align:middle}
.brand{font-weight:800;font-size:15px;letter-spacing:.2px}.brand b{color:var(--acc2)}
.credit{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:3px}
.credit.primary-links .cr{flex:0 1 auto;min-width:0;min-height:30px;justify-content:center;padding:4px 9px;white-space:nowrap;font-size:10.5px}
.credit.secondary-link{margin-top:2px}
.credit.secondary-link .cr{min-height:25px;padding:2px 8px}
.cr{all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:3px 10px;border-radius:10px;font-size:11px;border:1px solid var(--line);color:var(--ink);background:var(--card);font-family:inherit;text-decoration:none}
.cr small{color:var(--mut);font-size:10px}.cr:hover{border-color:var(--acc)}
.cr.site{background:linear-gradient(135deg,#d4af37,#f1c94e);border-color:transparent;color:#1a1400;font-weight:800;box-shadow:0 2px 10px rgba(212,175,55,.3)}
.dark .cr.site{background:linear-gradient(135deg,#f0c65a,#d4aa45);color:#17191d}
.cr.telegram{font-weight:700}
.cr.orig{font-size:10.5px;padding:3px 9px;opacity:.85}
.x{all:unset;cursor:pointer;position:absolute;left:10px;top:10px;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;color:var(--mut)}.x .icon{width:15px;height:15px}.x:hover{background:var(--card);color:var(--ink)}
.x2{left:40px}.x3{left:70px}
.hero{padding:10px 14px;border-bottom:1px solid var(--line)}
.name{font-weight:700;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.price{font-size:24px;font-weight:800;color:var(--acc2);margin:2px 0}.price small{font-size:12px;color:var(--mut);font-weight:400}
.meta{font-size:11px;color:var(--mut)}.meta s{opacity:.8}
.tabs{display:flex;gap:3px;padding:6px 8px;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}
.tab{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;padding:5px 9px;border-radius:9px;color:var(--mut);font-size:11.5px;font-family:inherit}
.tab.on{background:var(--acc);color:#fff;font-weight:700}
.body{padding:12px 14px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) var(--panel);scrollbar-gutter:stable;overscroll-behavior:contain}
.body::-webkit-scrollbar{width:7px}
.body::-webkit-scrollbar-track{background:var(--panel);border-radius:999px}
.body::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:2px solid var(--panel);border-radius:999px;min-height:32px}
.body::-webkit-scrollbar-thumb:hover{background:var(--scroll-hover);border-width:1px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:9px}
.card-title{display:flex;align-items:center;gap:7px}
details.card summary{cursor:pointer;list-style:none}details.card summary::-webkit-details-marker{display:none}details.card[open] summary{margin-bottom:5px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.btn{all:unset;cursor:pointer;padding:7px 12px;border-radius:10px;background:linear-gradient(135deg,var(--acc2),var(--acc));color:#fff;font-weight:700;font-size:12px;text-align:center;font-family:inherit;box-shadow:0 2px 6px rgba(0,0,0,.12);transition:filter .14s ease,transform .14s ease,box-shadow .14s ease}
.btn:hover:not([disabled]){filter:brightness(1.07);transform:translateY(-1px);box-shadow:0 4px 10px rgba(0,0,0,.18)}.btn:active:not([disabled]){transform:translateY(0);box-shadow:none}
.btn.sec{background:var(--card);color:var(--ink);border:1px solid var(--line)}.btn.bad{background:var(--bad);color:#fff}.btn[disabled]{opacity:.5;cursor:default}
.btn.icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}.btn.icon-btn .icon{width:15px;height:15px}
.btns{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
.setting-hint{display:flex;align-items:center;gap:6px;margin-top:7px;color:var(--mut);font-size:11px}.setting-hint kbd{padding:1px 6px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--ink);font:inherit;direction:ltr}
.chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:10.5px;border:1px solid var(--line);color:var(--mut)}
.chip.good{color:var(--acc2);border-color:var(--acc2)}.chip.warn{color:var(--warn);border-color:var(--warn)}.chip.bad{color:var(--bad);border-color:var(--bad)}
.muted{color:var(--mut);font-size:11.5px}.good{color:var(--acc2)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.offer{display:flex;justify-content:space-between;gap:8px;align-items:center}.offer.best{border-color:var(--acc2);box-shadow:0 0 0 1px var(--acc2) inset}
.offer a{color:var(--acc);text-decoration:none;font-size:11px}
.pv{font-weight:800;font-size:15px;white-space:nowrap}
select,input[type=number],input[type=text]{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-family:inherit;font-size:12px}
input[type=number]{width:130px}
label.ck{display:flex;gap:6px;align-items:center;margin:5px 0;font-size:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:7px 9px}.m span{display:block;color:var(--mut);font-size:10.5px}.m b{font-size:13px}
.banner{background:rgba(251,191,36,.12);border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:7px 10px;margin-bottom:9px;font-size:11.5px}
.verdict{border-radius:12px;padding:10px 12px;margin-bottom:9px;font-weight:700;border:1px solid}
.v-confirmed{background:rgba(52,211,153,.1);border-color:var(--acc2);color:var(--acc2)}.v-rise-signal{background:rgba(251,191,36,.1);border-color:var(--warn);color:var(--warn)}.v-insufficient{background:rgba(169,166,214,.08);border-color:var(--line);color:var(--mut)}
ul{margin:4px 0 0;padding:0 16px}li{margin:3px 0}
.log{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;color:var(--mut)}.log .e{color:var(--bad)}.log .w{color:var(--warn)}
svg text{font-family:inherit}
.foot{padding:5px 12px;border-top:1px solid var(--line);font-size:9.5px;color:var(--mut);text-align:center}.foot-note{display:flex;justify-content:center;padding-top:4px;opacity:.75}.foot-note .icon{width:14px;height:14px}
:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
.dark #pill{background:linear-gradient(145deg,#20242c,#0c0e12);border-color:#d4aa45;color:#f0c65a}
.dark header{background:linear-gradient(135deg,rgba(240,198,90,.13),rgba(18,20,25,.12))}
.dark .bf-badge{background:linear-gradient(135deg,#f0c65a,#d4aa45);color:#17191d;letter-spacing:.35px}
.dark .cr.site{box-shadow:0 2px 10px rgba(212,170,69,.22)}
.dark .tab.on,.dark .btn:not(.sec):not(.bad){background:var(--acc2);color:var(--on-acc)}
.dark .btn.bad{color:#231516}
.dark .good,.dark .chip.good{color:var(--good)}
.dark .chip.good{border-color:var(--good)}
.dark .tb tr.best td{background:var(--good-soft)}
.dark .v-confirmed{background:var(--good-soft);border-color:var(--good);color:var(--good)}
.dark .v-rise-signal{background:var(--warn-soft);border-color:var(--warn);color:var(--warn)}
.dark .v-insufficient{background:rgba(167,171,180,.08);border-color:var(--line);color:var(--mut)}
`;
  let host, root, S;
  const $ = s => root.querySelector(s);
  const icon = (name, size = 16, extraClass = '') => `<svg class="icon${extraClass ? ' ' + extraClass : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  const iconText = (name, text) => `${icon(name)}<span>${text}</span>`;

  const LV = { high: ['اطمینان بالا', 'good'], medium: ['اطمینان متوسط', 'warn'], low: ['مشکوک', 'bad'] };
  const STATUS = { ok: ['فعال', 'good'], loading: ['در حال دریافت…', ''], empty: ['بدون نتیجه', 'warn'], 'no-match': ['تطبیقی پیدا نشد', 'warn'], error: ['خطا', 'bad'], unavailable: ['در دسترس نیست', ''], off: ['خاموش', ''] };

  function chart(storePts, localPts, rangeDays) {
    const W = 340, H = 150, pl = 8, pr = 8, pt = 10, pb = 22;
    const all = [...storePts, ...localPts.map(x => ({ t: x.t, price: x.p }))].filter(p => p.price > 0);
    if (all.length < 2) return '<div class="muted" style="padding:14px 0;text-align:center">نقطهٔ کافی برای رسم نمودار وجود ندارد.</div>';
    const end = Math.max(...all.map(p => p.t)), from = end - rangeDays * U.DAY;
    const sp = storePts.filter(p => p.t >= from && p.price > 0), lp = localPts.filter(p => p.t >= from);
    const vals = [...sp.map(p => p.price), ...lp.map(p => p.p)]; if (vals.length < 2) return '<div class="muted" style="padding:14px 0;text-align:center">در این بازه داده‌ای نیست.</div>';
    const mn = Math.min(...vals), mx = Math.max(...vals), pad = (mx - mn) * 0.08 || mx * 0.05;
    const x = t => pl + (t - from) / (end - from || 1) * (W - pl - pr), y = v => pt + (1 - (v - (mn - pad)) / ((mx + pad) - (mn - pad))) * (H - pt - pb);
    // break the line at gaps larger than 2 days (no interpolation across missing data)
    let d = '', prev = null; for (const p of sp) { d += (prev && p.t - prev.t <= 2.5 * U.DAY ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.price).toFixed(1) + ' '; prev = p; }
    const dots = lp.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.p).toFixed(1)}" r="2.8" fill="var(--chart-local)"/>`).join('');
    const minP = sp.length ? sp.reduce((a, b) => b.price < a.price ? b : a) : null;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="direction:ltr"><path d="${d}" fill="none" stroke="var(--chart-official)" stroke-width="2.2" stroke-linejoin="round"/>${dots}
      ${minP ? `<circle cx="${x(minP.t).toFixed(1)}" cy="${y(minP.price).toFixed(1)}" r="4" fill="var(--chart-min)"/>` : ''}
      <text x="${pl}" y="${H - 6}" font-size="9.5" fill="var(--chart-label)">${U.faDate(from)}</text><text x="${W - pr}" y="${H - 6}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.faDate(end)}</text>
      <text x="${W - pr}" y="${pt + 2}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.fmt(mx)}</text><text x="${W - pr}" y="${H - pb - 3}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.fmt(mn)}</text></svg>`;
  }

  // ----- tabs -----
  function tabCompare() {
    const p = S.product || {}, srcs = S.sources; let h = '';
    h += `<div class="btns"><button class="btn icon-btn" data-act="compare" ${S.running ? 'disabled' : ''}>${iconText('search', S.running ? 'در حال جست‌وجو…' : 'مقایسه قیمت')}</button><button class="btn sec icon-btn" data-act="reread">${iconText('refresh', 'بازخوانی')}</button><button class="btn sec icon-btn" data-act="manual">${iconText('wallet', 'قیمت دستی')}</button></div>`;
    h += `<div class="row" style="margin-bottom:8px;gap:6px"><input type="text" id="q" aria-label="جست‌وجوی دستی در ترب" placeholder="جست‌وجوی دستی در ترب" value="${U.esc(S.manualQuery || '')}"><button class="btn sec icon-btn" data-act="manualSearch">${iconText('search', 'جست‌وجو')}</button></div>`;
    const chips = Object.keys(Sources.registry).map(id => { const r = Sources.registry[id], st = srcs[id] || { status: Store.get().settings.sources[id] && r.implemented ? 'idle' : (r.implemented ? 'off' : 'unavailable') }; const [lbl, cl] = STATUS[st.status] || ['آماده', '']; return `<span class="chip ${cl}" title="${U.esc(st.error || st.note || r.note)}">${U.esc(r.label)}: ${lbl}${st.count ? ' · ' + U.toFa(st.count) : ''}</span>`; }).join(' ');
    h += `<div style="margin-bottom:9px">${chips}</div>`;
    const tr = srcs.torob; if (tr && tr.candidates && tr.candidates.length > 1) h += `<div class="card"><div class="muted" style="margin-bottom:4px">محصول تطبیق‌یافته در ترب — اگر رنگ/مدل دیگری مدنظر است تغییر دهید</div><select data-sel="cand" style="width:100%">${tr.candidates.map(c => `<option value="${U.esc(c.key)}" ${c.key === tr.chosenKey ? 'selected' : ''}>${U.esc(c.title.slice(0, 60))} · ${U.fmt(c.price)}</option>`).join('')}</select></div>`;
    if (tr && tr.tried && tr.tried.length > 1) h += `<div class="muted" style="margin-bottom:6px">جست‌وجوی چندمرحله‌ای: ${U.toFa(tr.tried.length)} عبارت امتحان شد؛ عبارت موفق: «${U.esc(tr.query)}»</div>`;
    for (const id of Object.keys(srcs)) { const st = srcs[id]; if (st.error) h += `<div class="banner">خطای ${U.esc(Sources.registry[id].label)}: ${U.esc(st.error)} — سایر منابع و موتور اصلی فعال می‌مانند.</div>`; }
    let offers = S.offers.slice();
    if (S.trustedOnly) offers = offers.filter(o => o.matchLevel !== 'low');
    offers.sort((a, b) => S.sort === 'name' ? a.seller.localeCompare(b.seller, 'fa') : S.sort === 'desc' ? b.price - a.price : a.price - b.price);
    if (S.offers.length) {
      h += `<div class="row" style="margin-bottom:6px"><select data-sel="sort"><option value="price" ${S.sort === 'price' ? 'selected' : ''}>ارزان‌ترین</option><option value="desc" ${S.sort === 'desc' ? 'selected' : ''}>گران‌ترین</option><option value="name" ${S.sort === 'name' ? 'selected' : ''}>نام فروشنده</option></select><label class="ck"><input type="checkbox" data-ck="trusted" ${S.trustedOnly ? 'checked' : ''}>فقط تطبیق قابل‌اتکا</label><button class="btn sec" data-act="toggleTable">${S.table ? 'نمای کارتی' : 'نمای جدول'}</button></div>`;
      const a = App.advice();
      h += `<div class="card"><b class="${a.tone === 'good' ? 'good' : a.tone === 'warn' ? 'warn' : ''}">مشاور خرید: ${U.esc(a.headline)}</b><ul>${a.points.map(x => `<li class="${x.k === 'good' ? 'good' : x.k === 'warn' ? 'warn' : ''}">${U.esc(x.text)}</li>`).join('')}</ul><div class="muted" style="margin-top:6px">${a.caveats.map(U.esc).join('<br>')}</div></div>`;
      const bestPrice = Math.min(...S.offers.filter(o => o.matchLevel !== 'low').map(o => o.price));
      const shown = S.showAll ? offers : offers.slice(0, 5);
      if (S.table) {
        h += '<table class="tb">' + shown.map(o => { const diff = p.price ? (o.price - p.price) / p.price * 100 : null; return `<tr class="${o.price === bestPrice && o.matchLevel !== 'low' ? 'best' : ''}"><td><span class="dot ${o.matchLevel}" title="${(LV[o.matchLevel] || [''])[0]}"></span>${U.esc(o.seller)}</td><td><b>${U.fmt(o.price)}</b></td><td class="${diff != null && diff < -0.5 ? 'good' : diff > 0.5 ? 'bad' : 'muted'}">${diff == null ? '' : (diff < 0 ? '−' : diff > 0 ? '+' : '') + U.fmtPct(Math.abs(diff))}</td><td>${o.sellerUrl ? `<a style="color:var(--acc)" href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده" aria-label="بازکردن صفحهٔ فروشنده">${icon('link', 14, 'icon-sm')}</a>` : ''}</td></tr>`; }).join('') + '</table>';
      }
      else for (const o of shown) {
        const diff = p.price ? (o.price - p.price) / p.price * 100 : null, lv = LV[o.matchLevel] || ['', ''];
        const dd = diff == null ? '' : Math.abs(diff) < 0.5 ? '<span class="muted">هم‌قیمت با این صفحه</span>' : diff < 0 ? `<span class="good">${U.fmtPct(-diff)} ارزان‌تر · صرفه‌جویی ${U.fmt(p.price - o.price)}</span>` : `<span class="bad">${U.fmtPct(diff)} گران‌تر</span>`;
        h += `<div class="card offer ${o.price === bestPrice && o.matchLevel !== 'low' ? 'best' : ''}"><div><b>${U.esc(o.seller)}</b> ${o.price === bestPrice && o.matchLevel !== 'low' ? '<span class="chip good">ارزان‌ترین</span>' : ''}<br>${dd}<br><span class="chip ${lv[1]}" title="${U.esc((o.flags || []).join(' | '))}">${lv[0]} · ${U.toFa(Math.round((o.matchConfidence || 0) * 100))}٪</span> <span class="chip">ارسال: نامشخص</span> ${o.flags.some(f => f.startsWith('dedup')) ? '<span class="chip">تکراری‌ها حذف شد</span>' : ''}<div class="muted">${U.esc(o.sourceId)} · ${new Date(o.ts).toLocaleTimeString('fa-IR')}</div></div><div style="text-align:left"><div class="pv">${U.fmt(o.price)} <small class="muted">تومان</small></div>${o.sellerUrl ? `<a href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده">${icon('link', 14, 'icon-sm')} فروشگاه</a>` : ''}</div></div>`;
      }
      if (offers.length > 5) h += `<div class="btns"><button class="btn sec" data-act="toggleAll">${S.showAll ? 'نمایش کمتر' : 'نمایش همهٔ ' + U.toFa(offers.length) + ' مورد'}</button></div>`;
    } else if (!S.running && Object.keys(srcs).length) h += '<div class="card muted">هیچ فروشندهٔ دیگری با تطبیق قابل‌اتکا یافت نشد. هیچ قیمت حدسی نمایش داده نمی‌شود.</div>';
    for (const id of Object.keys(srcs)) { const nm = srcs[id].nearMiss; if (nm && nm.length) h += `<div class="card muted"><b>نتایج ردشده (مدل متفاوت):</b><ul>${nm.map(n => `<li>${U.esc(n.title)} — ${U.esc(n.reason)}</li>`).join('')}</ul></div>`; }
    if (!S.offers.length && !Object.keys(srcs).length) h += '<div class="card muted">برای دریافت قیمت فروشندگان «شروع مقایسه» را بزنید.</div>';
    return h;
  }

  function tabHistory() {
    let h = '';
    if (!S.product || !S.product.id) return '<div class="card muted">تاریخچهٔ رسمی فقط برای صفحات دیجی‌کالا (dkp) در دسترس است. نقاط ثبت‌شدهٔ محلی در واچ‌لیست/خروجی قابل‌مشاهده‌اند.</div>' + localOnly();
    const cooldown = Math.max(0, Math.ceil((S.historyCooldownUntil - Date.now()) / 1000));
    const loc = App.localHistoryPoints();
    const officialValid = Analysis.valid(App.historyPoints());
    const combined = App.combinedHistoryPoints();
    const rangeEnd = combined.length ? Math.max(...combined.map(p => p.t)) : Date.now();
    const stats = Analysis.stats(combined.filter(p => p.t >= rangeEnd - S.range * U.DAY));
    h += `<div class="btns"><button class="btn sec" data-act="reloadHistory" ${S.chartLoading || cooldown > 0 ? 'disabled' : ''}>${S.chartLoading ? 'در حال دریافت…' : cooldown > 0 ? `منتظر بمانید (${U.toFa(cooldown)} ثانیه)` : 'دریافت دوباره'}</button>${[7, 30, 90].map(d => `<button class="btn ${S.range === d ? '' : 'sec'}" data-range="${d}">${U.toFa(d)} روز</button>`).join('')}</div>`;
    if (S.chartError) h += `<div class="banner">${U.esc(S.chartError)}${cooldown > 0 ? ' — برای جلوگیری از محدودیت بیشتر، تا پایان شمارش معکوس دوباره تلاش نمی‌شود، حتی با کلیک دستی.' : ''}</div>`;
    if (cooldown > 0 && !S.chartLoading) scheduleCountdownTick();
    if (S.chart) {
      const c = S.chart, v = App.selectedVariant();
      if (c.variants.length > 1) h += `<div style="margin-bottom:6px"><select data-sel="variant">${c.variants.map((x, i) => `<option value="${i}" ${i === S.variantIdx ? 'selected' : ''}>${U.esc(x.title || 'واریانت ' + (i + 1))}</option>`).join('')}</select> <span class="chip ${S.variantManual ? 'warn' : S.variantExact ? 'good' : 'warn'}">${S.variantManual ? 'انتخاب دستی؛ با رنگ صفحه تطبیق دهید' : S.variantExact ? 'مطابق رنگ صفحه' : 'رنگ دقیق مشخص نشد'}</span></div>`;
      h += `<div class="card">${chart(officialValid, loc, S.range)}<div class="muted">خط بنفش: تاریخچهٔ رسمی · نقطه‌های طلایی: ثبت محلی همین محصول و رنگ · نقطهٔ سبز: کمینه</div></div>`;
      if (stats) h += `<div class="grid2"><div class="m"><span>کمترین قیمت در بازهٔ انتخابی</span><b>${U.fmt(stats.min)}</b></div><div class="m"><span>بیشترین قیمت</span><b>${U.fmt(stats.max)}</b></div><div class="m"><span>میانه</span><b>${U.fmt(stats.median)}</b></div><div class="m"><span>بازهٔ دارای داده</span><b>${U.toFa(stats.span)} روز · ${U.toFa(stats.count)} روز</b></div></div><div class="muted" style="margin-top:6px">نقطه‌های رسمی: ${U.toFa(officialValid.length)} · ثبت‌های محلی: ${U.toFa(loc.length)} · دادهٔ رسمی ممکن است فقط حدود یک ماه را پوشش دهد؛ سابقهٔ محلی از این پس به‌مرور کامل‌تر می‌شود. روزهای خالی درون‌یابی نمی‌شوند.</div>`;
      else h += '<div class="card muted">این واریانت نقطهٔ قابل‌فروش ندارد.</div>';
    } else {
      if (loc.length) h += `<div class="card">${chart([], loc, S.range)}<div class="muted">این‌ها قیمت‌هایی هستند که افزونه برای همین محصول/واریانت ثبت کرده است.</div></div>`;
      if (!S.chartError && !S.chartLoading) h += '<div class="card muted">تاریخچهٔ رسمی هنوز دریافت نشده.</div>';
    }
    if (S.dk && S.dk.lowest30dOfficial) h += `<div class="card"><span class="muted">کمترین قیمت اعلامی دیجی‌کالا در ۳۰ روز اخیر</span><div class="pv">${U.fmt(S.dk.lowest30dOfficial)} تومان</div></div>`;
    return h;
  }
  const localOnly = () => { const p = Store.get().products[S.key], local = App.localHistoryPoints(); if (!p || !local.length) return ''; return `<div class="card"><b>نقاط ثبت‌شدهٔ محلی</b>${chart([], local, 365)}</div>`; };

  function tabInspector() {
    const points = App.combinedHistoryPoints();
    if (!points.length) return '<div class="card muted">هنوز نقطهٔ تاریخیِ قابل‌فروش برای بررسی نداریم. تب «تاریخچه» را باز کنید؛ اگر دریافت رسمی خطا داد، ثبت‌های محلی بعد از بازدیدهای بعدی به‌مرور جمع می‌شوند.</div>';
    const r = App.inspector(), T = {
      confirmed: 'کاهش قیمت نسبت به سابقه دیده شد',
      'rise-signal': 'نشانهٔ افزایش قیمت یا مرجع بالاتر دیده شد',
      insufficient: r.detail === 'no-drop' ? 'کاهش معناداری نسبت به سابقه دیده نشد' : 'برای نتیجه‌گیری داده کافی نیست'
    };
    const cf = { high: 'بالا', medium: 'متوسط', low: 'پایین', none: 'ندارد' }[r.confidence];
    let h = `<div class="verdict v-${r.verdict}">${T[r.verdict]}<div class="muted" style="font-weight:400">میزان اطمینان تحلیل: ${cf}</div></div>`;
    if (S.chart && S.chart.variants.length > 1) h += `<div class="card"><label class="muted">واریانت تاریخچه را با رنگ همین صفحه تطبیق دهید</label><div style="margin-top:5px"><select data-sel="variant">${S.chart.variants.map((x, i) => `<option value="${i}" ${i === S.variantIdx ? 'selected' : ''}>${U.esc(x.title || 'واریانت ' + (i + 1))}</option>`).join('')}</select> <span class="chip ${S.variantManual ? 'warn' : S.variantExact ? 'good' : 'warn'}">${S.variantManual ? 'انتخاب دستی' : S.variantExact ? 'تطبیق خودکار' : 'تطبیق نامطمئن'}</span></div></div>`;
    const n = r.numbers;
    if (n && n.baseline) h += `<div class="grid2"><div class="m"><span>قیمت پایه · میانهٔ داده‌های پیش از ۱۴ روز اخیر</span><b>${U.fmt(n.baseline)}</b></div><div class="m"><span>${S.product?.price > 0 ? 'قیمت فعلی صفحه' : 'آخرین قیمت ثبت‌شده'}</span><b>${U.fmt(n.current)}</b></div><div class="m"><span>تغییر نسبت به پایه</span><b>${U.fmtPct(n.realDropPct)}</b></div><div class="m"><span>تخفیف ادعایی</span><b>${n.claimedPct == null ? '—' : U.fmtPct(n.claimedPct)}</b></div><div class="m"><span>کمترین قیمت دوره</span><b>${U.fmt(n.min)}</b></div><div class="m"><span>بیشترین قیمت دوره</span><b>${U.fmt(n.max)}</b></div></div><div class="muted" style="margin-top:6px">آخرین نقطه: ${U.faDate(n.latest)} · ${U.toFa(n.ageDays)} روز پیش · ${U.toFa(n.baselinePoints || 0)} نقطه برای پایه</div>`;
    if (r.signals.length) h += `<div class="card"><b class="warn">نشانه‌ها</b><ul>${r.signals.map(s => `<li>${U.esc(s.text)}</li>`).join('')}</ul></div>`;
    h += `<details class="card muted"><summary class="card-title">${icon('shield')}روش و محدودیت‌ها</summary><ul><li>قیمت پایه، میانهٔ قیمت‌های قابل‌فروشِ ثبت‌شده تا ۱۴ روز پیش از آخرین داده است؛ حداقل ۱۰ نقطه در ۲۱ روز و ۵ نقطه برای پایه لازم است.</li><li>بازرس جهش بیش از ۸٪ پیش از دورهٔ اخیر و اختلاف مرجع/تخفیف ادعایی را علامت می‌زند. این‌ها نشانه‌اند، نه اثبات تخلف.</li><li>قیمت فروشنده، موجودی یا گارانتی ممکن است عوض شده باشد؛ دادهٔ قدیمی یا واریانت نامطمئن نتیجهٔ قطعی نمی‌دهد.</li></ul></details>`;
    if (r.reasons.length) h += `<div class="card muted"><ul>${r.reasons.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul></div>`;
    return h;
  }

  function tabWatch() {
    const db = Store.get(), cur = S.key && db.products[S.key]; let h = '';
    if (cur) h += `<div class="card"><label class="ck" title="پیگیری این محصول در واچ‌لیست"><input type="checkbox" data-ck="watch" ${cur.watch ? 'checked' : ''}>${icon('heart')}<span>پیگیری این محصول</span></label><div class="row" style="margin-top:6px"><span class="muted">قیمت هدف (تومان)</span><span><input type="number" id="tgt" aria-label="قیمت هدف به تومان" min="0" value="${cur.target || ''}"> <button class="btn icon-btn" data-act="setTarget">${iconText('check', 'ثبت')}</button></span></div></div>`;
    const list = Object.values(db.products).filter(p => p.watch);
    h += list.length ? list.map(p => { const first = p.local[0], ch = first && p.lastPrice ? (p.lastPrice - first.p) / first.p * 100 : null; const hit = p.target > 0 && p.lastPrice <= p.target;
      return `<div class="card"><div class="row"><b style="font-size:12px">${U.esc((p.title || p.key).slice(0, 60))}</b><button class="btn sec icon-btn" data-rm="${U.esc(p.key)}" aria-label="حذف از واچ‌لیست">${iconText('trash', 'حذف')}</button></div><div class="row"><span class="pv">${U.fmt(p.lastPrice)}</span><span class="${hit ? 'good' : 'muted'}">${p.target ? 'هدف ' + U.fmt(p.target) + (hit ? ' ' + icon('check', 13, 'icon-sm') + 'رسیده' : '') : 'بدون هدف'}</span></div><div class="muted">${p.lastTs ? new Date(p.lastTs).toLocaleString('fa-IR') : '—'} · ${U.esc(p.lastSource || '')}${ch != null ? ' · تغییر ' + U.fmtPct(ch) : ''} · <a style="color:var(--acc)" href="${U.esc(p.url)}" target="_blank" rel="noopener">بازکردن</a></div></div>`; }).join('') : '<div class="card muted">واچ‌لیست خالی است.</div>';
    h += `<div class="btns"><button class="btn sec icon-btn" data-act="checkNow">${iconText('refresh', 'بررسی اکنون')}</button></div><div class="muted" title="هشدار فقط وقتی بررسی می‌شود که حداقل یک تب با این افزونه باز باشد. برای دیجی‌کالا، قیمت زندهٔ واریانت مشخص بررسی می‌شود؛ برای سایت‌های دیگر، آخرین قیمت ثبت‌شده ملاک است.">${icon('bell', 14, 'icon-sm')} هشدارها</div>`;
    return h;
  }

  function tabSettings() {
    const st = Store.get().settings; let h = '';
    h += `<div class="card"><label class="ck" title="تغییر بین تم روشن و تیره"><input type="checkbox" data-set="theme">${icon('sun')}<span>تم روشن</span></label><label class="ck" title="چسبیدن پنل به لبه‌های صفحه هنگام جابه‌جایی"><input type="checkbox" data-set="snap" ${st.snap ? 'checked' : ''}>${icon('pin')}<span>چسبیدن به لبه‌ها</span></label><label class="ck" title="پنل فقط در صفحهٔ محصول نمایش داده شود"><input type="checkbox" data-set="productPageOnly" ${st.productPageOnly ? 'checked' : ''}>${icon('search')}<span>فقط صفحهٔ محصول</span></label></div>`;
    h += `<div class="card"><b class="card-title">${iconText('tag', 'منابع قیمت')}</b>${Object.values(Sources.registry).map(r => `<label class="ck" title="${U.esc(r.note)}"><input type="checkbox" data-src="${r.id}" ${st.sources[r.id] ? 'checked' : ''} ${r.implemented ? '' : 'disabled'}>${U.esc(r.label)} ${r.implemented ? '' : '<span class="chip">پیاده‌سازی نشده</span>'}</label>`).join('')}<div class="setting-hint" title="مجوزهای شبکه فقط: ${U.esc(Net.ALLOWED.join('، '))}"><kbd>Alt+Shift+G</kbd><span>باز/بستن پنل</span></div></div>`;
    h += `<div class="card"><b class="card-title">${iconText('bell', 'هشدار قیمت')}</b><label class="ck"><input type="checkbox" data-set="alertsEnabled" ${st.alerts.enabled ? 'checked' : ''}>${icon('bell')}<span>فعال</span></label><div class="row"><span class="muted">${iconText('clock', 'بررسی هر (دقیقه)')}</span><input type="number" id="ival" aria-label="فاصلهٔ بررسی هشدار به دقیقه، حداقل ۱۵" min="15" value="${st.alerts.intervalMin}" style="width:80px"></div><div class="muted" style="margin-top:4px">حداقل ۱۵ دقیقه</div></div>`;
    h += `<div class="card"><b class="card-title">${iconText('file', 'داده‌ها')}</b><div class="btns"><button class="btn sec icon-btn" data-act="expCsv">${iconText('download', 'خروجی CSV')}</button><button class="btn sec icon-btn" data-act="expJson">${iconText('download', 'خروجی JSON')}</button><button class="btn sec icon-btn" data-act="impCsv">${iconText('upload', 'ورود CSV')}</button><button class="btn bad icon-btn" data-act="clearProd" title="پاک‌کردن تاریخچهٔ محلی این محصول">${iconText('trash', 'حذف محصول')}</button><button class="btn bad icon-btn" data-act="clearAll" title="پاک‌کردن همهٔ داده‌ها و تنظیمات">${iconText('trash', 'حذف همه')}</button></div><input type="file" id="file" accept=".csv" style="display:none"></div>`;
    return h;
  }

  function tabLog() {
    const legacy = ['ghpro12-host', 'ghafel-pc-btn', 'ghafel-pc-panel'].filter(id => document.getElementById(id));
    let h = legacy.length ? `<div class="banner">نسخه‌های قدیمی هم‌زمان فعال‌اند (${legacy.join('، ')}). در Tampermonkey آن‌ها را غیرفعال کنید تا فقط یک پنل بماند.</div>` : '';
    h += `<div class="card muted">نسخه ۱۵.۲.۲ (Black Friday) · محصول: ${U.esc(S.key)} · منبع قیمت: ${U.esc((S.product || {}).priceSource || '—')}${(S.product || {}).priceNote ? ' · ' + U.esc(S.product.priceNote) : ''}</div>`;
    h += `<div class="card log">${Log.all().slice(-60).reverse().map(e => `<div class="${e.level === 'error' ? 'e' : e.level === 'warn' ? 'w' : ''}">${new Date(e.t).toLocaleTimeString('en-GB')} [${U.esc(e.scope)}] ${U.esc(e.msg)}</div>`).join('') || 'بدون رویداد'}</div>`;
    return h;
  }

  const TABS = [['compare', 'compare', 'مقایسه', 'مقایسهٔ قیمت'], ['history', 'history', 'تاریخچه', 'تاریخچهٔ قیمت'], ['inspect', 'search', 'بازرس', 'بازرس تخفیف'], ['watch', 'heart', 'واچ‌لیست', 'واچ‌لیست قیمت'], ['settings', 'settings', 'تنظیمات', 'تنظیمات افزونه'], ['log', 'bug', 'عیب‌یابی', 'گزارش و عیب‌یابی']];
  let countdownTimer = null;
  function scheduleCountdownTick() { if (countdownTimer) return; countdownTimer = setTimeout(() => { countdownTimer = null; if (S.tab === 'history') render(); }, 1000); }
  function render() {
    if (!root) return; const st = Store.get().settings, p = S.product || {};
    const pn = $('#panel'); if (!pn) return;
    pn.classList.toggle('wide', !!st.wide);
    const wideLabel = st.wide ? 'باریک‌کردن پنل' : 'عریض‌کردن پنل'; $('#wide').title = wideLabel; $('#wide').setAttribute('aria-label', wideLabel);
    if (st.size) { pn.style.width = st.size.w + 'px'; pn.style.height = st.size.h + 'px'; pn.style.maxHeight = 'none'; } else { pn.style.width = pn.style.height = pn.style.maxHeight = ''; }
    $('.wrap').className = 'wrap ' + (st.theme === 'light' ? 'light' : 'dark');
    $('#name').textContent = Extract.coreTitle(p.title) || p.title || 'نام محصول شناسایی نشد';
    $('#name').setAttribute('title', p.title || '');
    $('#price').innerHTML = p.price ? `${U.fmt(p.price)} <small>تومان · ${U.esc(p.priceSource || '')}</small>` : '<span class="warn" style="font-size:16px">قیمت شناسایی نشد — «ثبت دستی قیمت»</span>';
    const dk = S.dk && S.dk.chosen;
    $('#meta').innerHTML = [p.oldPrice ? `قبل از تخفیف: <s>${U.fmt(p.oldPrice)}</s>` : '', p.seller ? 'فروشنده: ' + U.esc(p.seller) : '', p.warranty ? 'گارانتی: ' + U.esc(p.warranty) : '', dk && S.dk.lowest30dOfficial ? 'کمینهٔ ۳۰روزهٔ اعلامی دیجی‌کالا: ' + U.fmt(S.dk.lowest30dOfficial) : ''].filter(Boolean).join(' · ');
    $('#tabs').innerHTML = TABS.map(([k, ico, l, title]) => `<button type="button" id="tab-${k}" role="tab" aria-selected="${S.tab === k}" aria-label="${U.esc(title)}" title="${U.esc(title)}" class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ico)}<span>${l}</span></button>`).join('');
    const body = { compare: tabCompare, history: tabHistory, inspect: tabInspector, watch: tabWatch, settings: tabSettings, log: tabLog }[S.tab]();
    $('#body').setAttribute('aria-labelledby', `tab-${S.tab}`);
    const keep = $('#body').scrollTop;
    const tamper = (typeof CreditGuard !== 'undefined' && CreditGuard.isOk() === false)
      ? '<div class="banner" style="background:rgba(248,113,113,.15);border-color:var(--bad);color:var(--bad)"><b>این نسخه تغییر داده شده و اعتبار سازندگان حذف/تغییر کرده است.</b> نسخهٔ اصلی: <a style="color:inherit" href="https://t.me/RealMahdi_a" target="_blank" rel="noopener noreferrer">t.me/RealMahdi_a</a></div>' : '';
    $('#body').innerHTML = tamper + (S.banner ? `<div class="banner">${U.esc(S.banner)}</div>` : '') + body;
    $('#body').scrollTop = keep;
    const th = $('[data-set="theme"]'); if (th) th.checked = st.theme === 'light';
  }

  function applyPos() {
    const pos = Store.get().settings.pos || { right: 16, bottom: 16 };
    const vw = innerWidth, vh = innerHeight; const r = host.getBoundingClientRect();
    let { left, top } = pos.left != null ? pos : { left: vw - (r.width || 150) - pos.right, top: vh - (r.height || 40) - pos.bottom };
    left = Math.min(Math.max(4, left), Math.max(4, vw - (r.width || 150) - 4)); top = Math.min(Math.max(4, top), Math.max(4, vh - (r.height || 40) - 4));
    host.style.left = left + 'px'; host.style.top = top + 'px'; host.style.right = 'auto'; host.style.bottom = 'auto';
  }
  function setOpen(o) {
    const st = Store.get().settings; st.open = o; Store.save();
    $('#panel').classList.toggle('open', o); $('#pill').style.display = o ? 'none' : 'inline-flex';
    $('#pill').setAttribute('aria-expanded', String(o));
    if (o) { App.refreshProduct(); } requestAnimationFrame(applyPos);
  }

  function snapToEdges() {
    if (!Store.get().settings.snap) return; const r = host.getBoundingClientRect(), M = 8, T = 24, vw = innerWidth, vh = innerHeight;
    let l = r.left, t = r.top;
    if (l < T) l = M; else if (vw - r.right < T) l = vw - r.width - M;
    if (t < T) t = M; else if (vh - r.bottom < T) t = vh - r.height - M;
    host.style.left = Math.max(0, l) + 'px'; host.style.top = Math.max(0, t) + 'px';
  }
  function bind() {
    const hdr = $('header'), pill = $('#pill');
    function makeDraggable(el, { ignore, onTap }) {
      let drag = null, suppressClick = false;
      el.addEventListener('pointerdown', e => { if (ignore && e.target.closest(ignore)) return; suppressClick = false; const r = host.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false }; try { el.setPointerCapture(e.pointerId); } catch {} });
      el.addEventListener('pointermove', e => {
        if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return; drag.moved = true;
        const r = host.getBoundingClientRect(), w = r.width || 150, h = r.height || 40;
        host.style.left = Math.min(Math.max(0, e.clientX - drag.dx), Math.max(0, innerWidth - w)) + 'px'; host.style.top = Math.min(Math.max(0, e.clientY - drag.dy), Math.max(0, innerHeight - h)) + 'px'; host.style.right = host.style.bottom = 'auto';
      });
      el.addEventListener('pointerup', () => {
        if (!drag) return; const d = drag; drag = null;
        if (d.moved) { suppressClick = true; snapToEdges(); const r = host.getBoundingClientRect(); Store.get().settings.pos = { left: r.left, top: r.top }; Store.save(); }
      });
      el.addEventListener('pointercancel', () => { drag = null; suppressClick = false; });
      if (onTap) el.addEventListener('click', e => {
        if (suppressClick && e.detail > 0) { suppressClick = false; e.preventDefault(); return; }
        suppressClick = false; onTap();
      });
    }
    makeDraggable(hdr, { ignore: '.x' }); makeDraggable(pill, { onTap: () => setOpen(true) });
    $('#wide').onclick = () => { const st = Store.get().settings; st.wide = !st.wide; st.size = null; Store.save(); render(); requestAnimationFrame(applyPos); };
    const rs = $('#rs'); let rz = null;
    rs.addEventListener('pointerdown', e => { e.stopPropagation(); const r = $('#panel').getBoundingClientRect(); rz = { l: r.left, t: r.top }; try { rs.setPointerCapture(e.pointerId); } catch {} });
    rs.addEventListener('pointermove', e => { if (!rz) return; const w = Math.min(Math.max(320, e.clientX - rz.l), innerWidth - rz.l - 4), h = Math.min(Math.max(300, e.clientY - rz.t), innerHeight - rz.t - 4); const st = Store.get().settings; st.size = { w: Math.round(w), h: Math.round(h) }; const pn = $('#panel'); pn.style.width = st.size.w + 'px'; pn.style.height = st.size.h + 'px'; pn.style.maxHeight = 'none'; });
    rs.addEventListener('pointerup', () => { if (rz) { rz = null; Store.save(); } });
    rs.addEventListener('dblclick', () => { Store.get().settings.size = null; Store.save(); render(); });
    $('#body').addEventListener('scroll', () => { const t = $('#body').scrollTop, pn = $('#panel'); if (t > 60) pn.classList.add('compact'); else if (t < 8) pn.classList.remove('compact'); });
    $('#min').onclick = () => setOpen(false); $('#close').onclick = () => { Store.get().settings.open = false; Store.save(); host.style.display = 'none'; };
    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-tab],[data-act],[data-range],[data-rm]'); if (!t) return; const db = Store.get();
      if (t.dataset.tab) { S.tab = t.dataset.tab; db.settings.tab = S.tab; Store.save(); if (S.tab === 'history' && !S.chart && !S.chartLoading) App.loadHistory(); return render(); }
      if (t.dataset.range) { S.range = +t.dataset.range; return render(); }
      if (t.dataset.rm) { const p = db.products[t.dataset.rm]; if (p) p.watch = false; Store.save(); return render(); }
      const a = t.dataset.act;
      if (a === 'compare') App.runCompare();
      else if (a === 'toggleTable') { S.table = !S.table; db.settings.table = S.table; Store.save(); render(); }
      else if (a === 'manualSearch') { S.manualQuery = ($('#q').value || '').trim(); App.runCompare(S.manualQuery ? { query: S.manualQuery } : {}); }
      else if (a === 'toggleAll') { S.showAll = !S.showAll; render(); }
      else if (a === 'reread') App.refreshProduct();
      else if (a === 'manual') { const v = Number(U.digits(prompt('قیمت فعلی محصول (تومان):', '') || '').replace(/\D/g, '')); if (v > 0) App.setManualPrice(v); }
      else if (a === 'reloadHistory') App.loadHistory();
      else if (a === 'setTarget') { const v = Number(U.digits($('#tgt').value).replace(/\D/g, '')); const p = Store.touchProduct(S.key); p.target = v > 0 ? v : null; if (v > 0) p.watch = true; Store.save(); render(); }
      else if (a === 'checkNow') { const r = await Alerts.checkAll(true); S.banner = `بررسی انجام شد: ${U.toFa(r.checked)} محصول، ${U.toFa(r.fired)} هشدار`; render(); }
      else if (a === 'expCsv') Exporter.download(`ghafel-${S.key.replace(/[^\w.-]+/g, '_')}.csv`, Exporter.csvFor(S.key, Analysis.valid(App.historyPoints())));
      else if (a === 'expJson') Exporter.download('ghafel-pro13-export.json', Exporter.jsonAll({ chart: S.chart }), 'application/json');
      else if (a === 'impCsv') $('#file').click();
      else if (a === 'clearProd') { if (confirm('تاریخچهٔ محلی این محصول پاک شود؟')) { Store.touchProduct(S.key).local = []; Store.save(); render(); } }
      else if (a === 'clearAll') { if (confirm('همهٔ داده‌ها و تنظیمات افزونه پاک شود؟')) { Store.reset(); render(); } }
    });
    root.addEventListener('input', e => { if (e.target.id === 'q') S.manualQuery = e.target.value; });
    root.addEventListener('keydown', e => { if (e.target.id === 'q' && e.key === 'Enter') { e.preventDefault(); S.manualQuery = e.target.value.trim(); App.runCompare(S.manualQuery ? { query: S.manualQuery } : {}); } });
    root.addEventListener('change', e => {
      const t = e.target, st = Store.get().settings;
      if (t.dataset.sel === 'cand') { App.pickCandidate(t.value); return; }
      else if (t.dataset.sel === 'sort') S.sort = t.value; else if (t.dataset.sel === 'variant') { S.variantIdx = +t.value; S.variantManual = true; }
      else if (t.dataset.ck === 'trusted') S.trustedOnly = t.checked;
      else if (t.dataset.ck === 'watch') { Store.touchProduct(S.key).watch = t.checked; Store.save(); }
      else if (t.dataset.set === 'theme') { st.theme = t.checked ? 'light' : 'dark'; Store.save(); }
      else if (t.dataset.set === 'snap') { st.snap = t.checked; Store.save(); }
      else if (t.dataset.set === 'productPageOnly') { st.productPageOnly = t.checked; Store.save(); }
      else if (t.dataset.set === 'alertsEnabled') { st.alerts.enabled = t.checked; Store.save(); }
      else if (t.dataset.src) { st.sources[t.dataset.src] = t.checked; Store.save(); }
      else if (t.id === 'ival') { st.alerts.intervalMin = Math.max(15, Number(U.digits(t.value)) || 60); Store.save(); }
      else if (t.id === 'file' && t.files[0]) { t.files[0].text().then(tx => { try { const n = Exporter.importLocal(S.key, Exporter.parseCsv(tx)); S.banner = `${U.toFa(n)} نقطه وارد شد (به‌عنوان دادهٔ محلی)`; } catch (er) { S.banner = 'ورود CSV ناموفق: ' + er.message; } render(); }); return; }
      render();
    });
  }

  function mount() {
    if (document.getElementById(HOST_ID)) return;           // the single-panel guarantee
    S = App.state; S.tab = Store.get().settings.tab || 'compare'; S.table = !!Store.get().settings.table; host = document.createElement('div'); host.id = HOST_ID; document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="wrap dark"><button type="button" id="pill" aria-label="بازکردن پنل تخفیف‌سنج" aria-expanded="false" title="تخفیف‌سنج — بکشید تا جابه‌جا شود (Alt+Shift+G)">${icon('tag')}<span>تخفیف‌سنج</span></button>
      <section id="panel"><header><div class="brand"><span class="bf-badge">Black Friday</span>تخفیف‌سنج</div><button type="button" class="x x3" id="wide" title="عریض‌کردن پنل" aria-label="عریض‌کردن پنل">${icon('expand')}</button><button type="button" class="x x2" id="min" title="جمع‌کردن پنل" aria-label="جمع‌کردن پنل">${icon('minus')}</button><button type="button" class="x" id="close" title="بستن پنل" aria-label="بستن پنل">${icon('close')}</button></header>
      <div class="hero"><div class="name" id="name"></div><div class="price" id="price"></div><div class="meta" id="meta"></div></div>
      <nav class="tabs" id="tabs" role="tablist" aria-label="بخش‌های تخفیف‌سنج"></nav><div class="body" id="body" role="tabpanel"></div><div id="rs" title="تغییر اندازه (دابل‌کلیک: بازنشانی)" aria-label="تغییر اندازهٔ پنل"></div><div class="foot"><div class="credit primary-links"><a class="cr site" href="https://aqilistudio.ir/" target="_blank" rel="noopener noreferrer" title="آخرین نسخه و آموزش">${icon('global', 14, 'icon-sm')}<span>نسخه و آموزش</span></a><a class="cr telegram" href="https://t.me/RealMahdi_a" target="_blank" rel="noopener noreferrer" title="تلگرام توسعه‌دهنده">${icon('chat', 14, 'icon-sm')}<span>@RealMahdi_a</span></a><a class="cr orig" href="https://t.me/GHAFEL_com" target="_blank" rel="noopener noreferrer" title="موتور پایه">${icon('layers', 14, 'icon-sm')}<span>GHAFEL_com</span></a></div><div class="foot-note" title="هیچ داده‌ای بدون منبع و زمان نمایش داده نمی‌شود" role="img" aria-label="اطلاعات با منبع و زمان نمایش داده می‌شوند">${icon('shield')}</div></div></section></div>`;
    bind(); App.on(render); render(); requestAnimationFrame(applyPos);
    addEventListener('resize', applyPos);
    if (Store.get().settings.open) setOpen(true);
  }
  const toggle = () => {
    if (!host) return false;
    if (host.style.display === 'none') { host.style.display = ''; setOpen(true); return true; }
    setOpen(!$('#panel').classList.contains('open')); return true;
  };
  const unmount = () => { const h = document.getElementById(HOST_ID); if (h) h.remove(); host = root = null; };
  return { mount, unmount, render, setOpen, toggle, HOST_ID };
})();


// ---- 99-main.js ----
/* ===== Main: bootstrap (single instance, top frame only, SPA-aware) ===== */
const Main = (() => {
  function init() {
    if (window.top !== window.self) return;
    if (window.__GHAFEL_PRO13__) return; window.__GHAFEL_PRO13__ = true;
    Store.load();
    document.addEventListener('keydown', e => { if (e.altKey && e.shiftKey && e.code === 'KeyG') { e.preventDefault(); UI.toggle(); } });
    const isDk = /(^|\.)digikala\.com$/.test(location.hostname);
    if (isDk) Alerts.start();
    let lastHref = '';
    const check = () => {
      const should = !Store.get().settings.productPageOnly || Extract.looksLikeProductPage();
      const mounted = !!document.getElementById(UI.HOST_ID);
      if (should && !mounted) { UI.mount(); App.refreshProduct(); }
      if (!should && mounted) UI.unmount();
      if (location.href !== lastHref) { lastHref = location.href; if (should) { setTimeout(() => App.refreshProduct(), 1500); setTimeout(() => App.refreshProduct(), 5000); } }
    };
    const run = () => { try { check(); } catch (e) { Log.error('main', e.message); } };
    setTimeout(run, 600); setInterval(run, 1500);
    Log.info('main', 'تخفیف‌سنج 15.2.2 آماده شد');
  }
  return { init };
})();


Main.init();
})();
