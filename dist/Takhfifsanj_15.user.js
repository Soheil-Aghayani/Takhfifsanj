// ==UserScript==
// @name         تخفیف‌سنج
// @namespace    ghafel-com-pro
// @version      15.2.48
// @description  مقایسهٔ قیمت فروشندگان، تاریخچهٔ قیمت دیجی‌کالا، بازرس تخفیف، واچ‌لیست و هشدار قیمت
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
// @connect      emalls.ir
// @connect      services.basalam.com
// @connect      apix.snappshop.ir
// @noframes
// @run-at       document-idle
// ==/UserScript==
/* تخفیف‌سنج 15.2.48 — Original Creator: GHAFEL_com (https://t.me/GHAFEL_com) · Upgrade & Development: RealMahdi_a (https://t.me/RealMahdi_a) · Website: https://aqilistudio.ir/
   Built from readable modules in /src. The 8.7 engine logic is preserved in src/06-extract.js (extraction),
   src/07-match.js (baseline rule) and src/08-sources.js (Torob flow). */
(function () {
'use strict';

// ---- 00-network.js ----
/* Shared allow-list for every network path in the userscript and extension builds. */
const NETWORK_ALLOWED_HOSTS = Object.freeze([
  'api.torob.com', 'torob.com', 'api.digikala.com', 'www.digikala.com', 'digikala.com',
  'emalls.ir', 'services.basalam.com', 'apix.snappshop.ir'
]);


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
  const HISTORY_COOLDOWN_KEY = 'ghafel13:history-cooldown';
  const DEFAULT = () => ({
    v: 2,
    settings: {
      theme: 'dark', productPageOnly: true,
      sources: { torob: true, emalls: true, basalam: true, snappshop: true },
      alerts: { enabled: true, intervalMin: 60 },
      snappCity: 'tehran', pos: null, open: false, tab: 'compare', table: false, wide: false, size: null, snap: true
    },
    products: {}, // key -> product record, see Store.touchProduct
    collections: {} // id -> {id, name, icon} for watchlist organization
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
    if (!db.settings || typeof db.settings !== 'object') db.settings = base.settings;
    if (!db.settings.sources || typeof db.settings.sources !== 'object') db.settings.sources = { ...base.settings.sources };
    if (!db.settings.snappCity) db.settings.snappCity = 'tehran';
    if (Number(db.v) < 2) {
      Object.assign(db.settings.sources, { emalls: true, basalam: true, snappshop: true });
      db.v = 2;
      rawSet(JSON.stringify(db));
    }
    if (!db.products || typeof db.products !== 'object' || Array.isArray(db.products)) db.products = {};
    if (!db.collections || typeof db.collections !== 'object' || Array.isArray(db.collections)) db.collections = {};
    for (const product of Object.values(db.products)) if (product && typeof product === 'object' && !('collectionId' in product)) product.collectionId = '';
    return db;
  }
  const get = () => db || load();
  const save = () => rawSet(JSON.stringify(get()));
  async function getHistoryCooldown() {
    try {
      const value = hasGM() ? await GM_getValue(HISTORY_COOLDOWN_KEY, 0) : localStorage.getItem(HISTORY_COOLDOWN_KEY);
      const until = Number(value); return Number.isFinite(until) ? until : 0;
    } catch { return 0; }
  }
  async function setHistoryCooldown(until) {
    const value = Math.max(0, Number(until) || 0);
    try { if (hasGM()) { await GM_setValue(HISTORY_COOLDOWN_KEY, value); return; } localStorage.setItem(HISTORY_COOLDOWN_KEY, String(value)); }
    catch (e) { Log.warn('store', 'history cooldown save failed: ' + e.message); }
  }

  function touchProduct(key, init) {
    const d = get();
    const p = d.products[key] ||= { key, host: '', pid: '', title: '', url: '', variantTitle: '', local: [], watch: false, target: null, collectionId: '', lastPrice: null, lastTs: 0, notifiedAt: 0, lastSource: '' };
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
  return { load, get, save, touchProduct, recordLocal, getHistoryCooldown, setHistoryCooldown, reset, DEFAULT, KEY };
})();


// ---- 04-net.js ----
/* ===== Net: the ONLY place that does network I/O (via GM_xmlhttpRequest), with an allow-list ===== */
const Net = (() => {
  const ALLOWED = NETWORK_ALLOWED_HOSTS;
  const allowed = url => { try { const h = new URL(url).hostname; return ALLOWED.includes(h); } catch { return false; } };

  function gmRequest(url, { accept = 'application/json', referer, headers = {}, timeout = 15000, anonymous = true, method = 'GET', body } = {}) {
    return new Promise((resolve, reject) => {
      if (!allowed(url)) return reject(new Error('دامنهٔ مجاز نیست: ' + (() => { try { return new URL(url).hostname; } catch { return url; } })()));
      const gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : (typeof GM !== 'undefined' && GM.xmlHttpRequest);
      if (!gm) return reject(new Error('GM_xmlhttpRequest در دسترس نیست (مجوز @grant را بررسی کنید)'));
      const t0 = Date.now();
      gm({
        method: String(method || 'GET').toUpperCase(), url, timeout, anonymous,
        ...(body == null ? {} : { data: body }),
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
  async function pageFetch(url, { accept = 'application/json', timeout = 15000, method = 'GET', body, headers = {}, referer } = {}) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null; const tm = ctl && setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { method: String(method || 'GET').toUpperCase(), ...(body == null ? {} : { body }), credentials: 'include', headers: { Accept: accept, ...headers }, ...(referer ? { referrer: referer, referrerPolicy: 'unsafe-url' } : {}), signal: ctl && ctl.signal });
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
    try { return JSON.parse(txt); } catch {
      const raw = String(txt || '').replace(/^\uFEFF/, '').trimStart();
      const host = new URL(url).hostname;
      const reason = !raw ? 'پاسخ خالی بود' : /^</.test(raw) ? 'پاسخ HTML به‌جای JSON بود؛ احتمالاً صفحهٔ ضدربات یا خطای سرویس' : 'پاسخ ساختار JSON نداشت';
      throw new Error(`${host}: ${reason}`);
    }
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
  const infoList = value => [...new Set((Array.isArray(value) ? value : [value])
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean))];
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
      shippingInfo: infoList(o.shippingInfo),
      warrantyInfo: infoList(o.warrantyInfo),
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
  const NAME_JUNK = [/^\s*خرید\s+و\s+قیمت\s+/, /^\s*قیمت\s*و\s*خرید\s+/, /^\s*خرید\s+/, /\s*(با|در)\s*قیمت\s*(روز|مناسب|ارزان|عمده)?.*$/, /\s*خرید\s*(آنلاین|اینترنتی|قسطی|اقساطی).*$/, /\s*(ارسال\s*رایگان|تخفیف|گارانتی|اصل|اورجینال).*$/];
  const isTorobHost = () => location.hostname.toLowerCase().replace(/^www\./, '') === 'torob.com';
  const isTorobProductPath = () => /^\/p\/[^/]+(?:\/|$)/i.test(location.pathname);
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

  function pageHeading(root) {
    const headings = [...root.querySelectorAll('h1')];
    const visible = headings.filter(el => {
      if (!el.textContent?.trim() || el.closest('[hidden], [aria-hidden="true"]')) return false;
      try {
        const style = getComputedStyle(el), rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
      } catch { return false; }
    });
    // Torob may put a zero-sized "popular products" heading before the real
    // product H1. Prefer the most descriptive rendered heading on its product page.
    const choices = isTorobHost() ? visible.sort((a, b) => {
      const aText = cleanTitle(a.textContent), bText = cleanTitle(b.textContent);
      return U.tokens(bText).length - U.tokens(aText).length || bText.length - aText.length;
    }) : visible;
    return (choices[0] || headings[0])?.textContent?.trim() || '';
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
  const NON_PRICE_CONTEXT = /ارزان|گران|صرفه.?جویی|تخفیف|پیشنهاد|قسط|اقساط|ماه|سود|بخرید|اعتبار|ارسال|تحویل|روز کاری/i;
  const priceRelevantLines = text => String(text || '').split(/\r?\n/).filter(line => !NON_PRICE_CONTEXT.test(line)).join('\n');
  const cartButtons = () => [...document.querySelectorAll('button, a, div, span')].filter(e => {
    if (e.children.length > 4) return false;
    const text = (e.innerText || '').trim();
    return text.length > 0 && text.length < 30 && /افزودن به سبد/.test(text);
  });
  function digikalaBuyBoxPrice() {
    if (location.hostname.toLowerCase().replace(/^www\./, '') !== 'digikala.com') return null;
    for (const button of cartButtons()) {
      let parent = button;
      for (let i = 0; i < 6 && parent; i++, parent = parent.parentElement) {
        if ((parent.innerText || '').length > 500) break;
        const marker = parent.querySelector('[data-testid="price-final"], [data-testid="price-current"]');
        if (!marker) continue;
        const text = marker.innerText || marker.textContent || '';
        const candidates = U.pricesWithCurrency(text + ' تومان');
        const price = candidates[0] || Number(U.digits(text).replace(/\D/g, ''));
        if (price >= 10000) return price;
      }
    }
    return null;
  }
  function buyBarPrice() {
    for (const b of cartButtons()) {
      let p = b.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        const txt = p.innerText || ''; if (txt.length > 500) break;
        // The buy box can include non-price notices (for example, "buy this
        // product 237,000 toman cheaper"). Never let those smaller amounts
        // win merely because this heuristic takes the minimum candidate.
        const relevant = priceRelevantLines(txt), struck = struckNumbers(p);
        const cand = U.numbersIn(relevant).filter(v => v >= 10000 && !struck.has(v));
        if (cand.length) return Math.min(...cand);
      }
    }
    return null;
  }
  // The struck-through "old price" inside the buy box (claimed pre-discount price)
  function claimedOldPrice(current) {
    for (const b of cartButtons()) {
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
        if (t.length < 400) { const a = U.pricesWithCurrency(priceRelevantLines(t)); if (a.length) return Math.min(...a); }
        p = p.parentElement;
      }
    }
    return null;
  }

  function torobCheapestPrice(root) {
    if (!isTorobHost() || !isTorobProductPath()) return null;
    for (const link of root.querySelectorAll('a[href*="/v4/product-page/redirect/"]')) {
      try {
        const url = new URL(link.href, location.href);
        if (url.searchParams.get('buy_box_reason') !== 'cheapest') continue;
        const amounts = [...new Set(U.pricesWithCurrency(link.innerText || link.textContent || ''))];
        if (amounts.length === 1) return amounts[0];
      } catch {}
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
    // Torob listing/category pages contain many product cards and their JSON-LD.
    // They are not a single product page; never pick one card as the page product.
    if (isTorobHost() && !isTorobProductPath()) {
      return { title: '', price: null, priceSource: '', oldPrice: null, nameCandidates: [], color: '',
        host: 'torob.com', url: location.href, id: '', variantId: '' };
    }
    const ld = jsonLd(root) || {};
    const meta = sel => root.querySelector(sel)?.getAttribute('content') || '';
    const h1 = pageHeading(root);
    const cands = [h1, ld.name, meta('meta[property="og:title"]'), root.title, titleFromUrl()].map(cleanTitle).filter(c => c && !isStoreName(c) && !/^فروشگاه\s*اینترنتی/.test(c));
    let name = cands[0] || '';
    if (U.tokens(name).length < 3) { const alt = cands.find(c => U.tokens(c).length >= 3); if (alt) name = alt; }
    const nn = U.normalize(name);
    for (const c of cands) { const cn = U.normalize(c); if (nn && cn.length > nn.length && cn.includes(nn) && c.length <= 120) { name = c; break; } }

    let price = null, src = '';
    const torobPrice = torobCheapestPrice(root);
    const buyBoxPrice = digikalaBuyBoxPrice();
    const visible = buyBoxPrice || buyBarPrice(), rec = reconcileJsonLd(ld, visible);
    if (torobPrice) { price = torobPrice; src = 'ترب: ارزان‌ترین فروشنده'; }
    else if (buyBoxPrice) { price = buyBoxPrice; src = 'data-testid'; }
    else if (rec) { price = rec.price; src = 'JSON-LD' + rec.note; }
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
    if (isTorobHost()) return isTorobProductPath();
    if (document.querySelector('meta[property="og:type"][content*="product"]')) return true;
    if (jsonLd(document)) return true;
    return !!([...document.querySelectorAll('button')].some(b => /افزودن به سبد/.test(b.textContent || '')) && document.querySelector('h1'));
  }
  return { KNOWN, isStoreName, matchKnownSite, cleanTitle, coreTitle, jsonLd, reconcileJsonLd, product, looksLikeProductPage, digikalaIds, selectedColor, buyBarPrice, claimedOldPrice };
})();


// ---- 07-match.js ----
/* ===== Match: product matching with confidence. `baseline` is the exact 8.7 rule; `evaluate` adds model/spec/brand/category checks. ===== */
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
    const re = /[A-Za-z]+[A-Za-z0-9]*?[\s\/\-_.]?\d+[A-Za-z0-9]*|(?<![\d.])\d+[\s]?[A-Za-z]+[A-Za-z0-9]*/g; let m;
    while ((m = re.exec(t))) { const c = m[0].toLowerCase().replace(/[^a-z0-9]/g, ''); if (c.length >= 3 && /[a-z]/.test(c) && /\d/.test(c) && !/^spf\d+(?:\.\d+)?$/.test(c)) out.add(c); }
    const numericModel = /(?:مدل|model)\s*[:#-]?\s*(\d{3,6})(?![A-Za-z0-9])/gi;
    while ((m = numericModel.exec(t))) out.add(m[1]);
    return [...out];
  }
  function modelCodeMatch(src, cand) {
    const codes = modelCodes(src), candidateCodes = new Set(modelCodes(cand));
    const compatible = (source, candidate) => source === candidate
      || (/^\d{3,6}$/.test(source) && candidate.endsWith(source))
      || (/^\d{3,6}$/.test(candidate) && source.endsWith(candidate));
    const found = codes.filter(code => [...candidateCodes].some(candidate => compatible(code, candidate)));
    return { codes, found, missing: codes.filter(code => !found.includes(code)) };
  }
  const UNITS = [['channel', /channel|ch|کاناله/], ['gb', /گیگابایت|گیگ|gb/], ['tb', /ترابایت|tb/], ['ml', /میلی ?لیتر|ml/], ['l', /لیتر/], ['kg', /کیلوگرم|کیلو|kg/], ['g', /گرم|gr|(?<![a-z])g(?![a-z])/], ['mah', /mah|میلی ?آمپر/], ['w', /وات|(?<![a-z])w(?![a-z])/], ['inch', /اینچ|inch/], ['cm', /سانتی ?متر|cm/], ['mm', /میلی ?متر|mm/]];
  const BRAND_FAMILIES = [
    ['romoss', ['romoss', 'روموس', 'رومس']], ['baseus', ['baseus', 'باسئوس', 'بیسوس']],
    ['sadoer', ['sadoer', 'سادور', 'سادوئر']],
    ['hiska', ['hiska', 'هیسکا']], ['onikuma', ['onikuma', 'اونیکوما', 'آنیکوما']],
    ['mcdodo', ['mcdodo', 'مک دودو', 'مک‌دودو']], ['anker', ['anker', 'انکر']],
    ['xiaomi', ['xiaomi', 'شیائومی', 'شیاومی']], ['samsung', ['samsung', 'سامسونگ']],
    ['apple', ['apple', 'اپل']], ['huawei', ['huawei', 'هواوی']],
    ['ugreen', ['ugreen', 'یوگرین']], ['ldnio', ['ldnio', 'الدینیو']],
    ['prime', ['prime', 'پرایم']], ['defacto', ['defacto', 'دفکتو', 'دفاکتو']],
    ['hoco', ['hoco', 'هوکو']], ['borofone', ['borofone', 'بروفون']]
  ];
  const PRODUCT_TYPES = [
    ['sun-care', ['ضد آفتاب', 'ضدآفتاب', 'sunscreen', 'sunblock']],
    ['headphones', ['هدفون', 'هدست', 'هندزفری', 'ایرفون', 'headphone', 'headphones', 'headset', 'earphone', 'earphones', 'earbud', 'earbuds']],
    ['speakers', ['اسپیکر', 'بلندگو', 'speaker', 'speakers', 'soundbar', 'ساندبار']],
    ['cables', ['کابل', 'cable', 'کابل شارژ', 'کابل تایپ سی', 'usb cable', 'charging cable']],
    ['chargers', ['شارژر', 'charger', 'آداپتور', 'adapter', 'power adapter']],
    ['power-banks', ['پاوربانک', 'پاور بانک', 'power bank', 'powerbank']]
  ];
  const hasPhrase = (raw, phrase) => {
    const text = ' ' + U.normalize(raw) + ' ', normalized = U.normalize(phrase);
    return !!normalized && text.includes(' ' + normalized + ' ');
  };
  function brandFamilies(raw) {
    const text = ' ' + U.normalize(raw) + ' ';
    return BRAND_FAMILIES.filter(([, aliases]) => aliases.some(alias => text.includes(' ' + U.normalize(alias) + ' '))).map(([id]) => id);
  }
  function productTypes(raw) { return PRODUCT_TYPES.filter(([, aliases]) => aliases.some(alias => hasPhrase(raw, alias))).map(([id]) => id); }
  function productTypeMismatch(source, candidate, strict) {
    const expected = productTypes(source), found = productTypes(candidate);
    if (expected.length && found.length && !expected.some(id => found.includes(id)))
      return { ok: false, score: 0, level: 'low', reasons: ['نوع کالای نتیجه با محصول صفحه متفاوت است'], flags: ['category-mismatch'] };
    if (strict && expected.length && !found.length)
      return { ok: false, score: 0, level: 'low', reasons: ['نوع کالای نتیجه برای تأیید تطبیق مشخص نیست'], flags: ['category-unverified'] };
    return null;
  }
  function brandMismatch(brandAliases, candidate, strict) {
    const aliases = [...new Set((Array.isArray(brandAliases) ? brandAliases : [brandAliases]).filter(Boolean).map(U.normalize).filter(x => x.length >= 2))];
    const expected = [...new Set(aliases.flatMap(brandFamilies))];
    const found = brandFamilies(candidate);
    const familyMatch = found.some(id => expected.includes(id));
    const aliasMatch = aliases.some(alias => hasPhrase(candidate, alias));
    if (found.some(id => expected.length && !expected.includes(id)) || (strict && aliases.length && !familyMatch && !aliasMatch))
      return { ok: false, score: 0, level: 'low', reasons: ['برند نتیجه با برند محصول تطبیق ندارد'], flags: ['brand-mismatch'] };
    return null;
  }
  function specs(raw) {
    const t = U.normalize(raw).replace(/(\d+)\s+(\d+)(?=\s*(?:channel\b|ch\b|کاناله))/gi, '$1.$2').replace(/(\d)\s+(?=[a-zآ-ی])/g, '$1'), out = {};
    for (const [u, re] of UNITS) {
      const rx = new RegExp('(\\d+(?:\\.\\d+)?)(?:' + re.source + ')', 'g'); let m;
      while ((m = rx.exec(t))) (out[u] ||= new Set()).add(Number(m[1]));
    }
    const spf = /\bspf\s*(\d+(?:\.\d+)?)/gi; let match;
    while ((match = spf.exec(t))) (out.spf ||= new Set()).add(Number(match[1]));
    return out;
  }
  function evaluate(src, cand, { strict = false, brandAliases = [] } = {}) {
    const reasons = [], flags = [];
    const base = baseline(src, cand);
    const st = U.tokens(src), ct = U.tokens(cand), cn = U.normalize(cand), set = new Set(cn.split(' ')), cc = cn.replace(/\s+/g, '');
    const sourceSet = new Set(st), sourceCompact = U.normalize(src).replace(/\s+/g, '');
    const cov = st.length ? st.filter(t => set.has(t) || (t.length >= 4 && cc.includes(t))).length / st.length : 0;
    const precision = ct.length ? ct.filter(t => sourceSet.has(t) || (t.length >= 4 && sourceCompact.includes(t))).length / ct.length : 0;
    const titleFit = cov + precision ? 2 * cov * precision / (cov + precision) : 0;
    const { codes, found, missing } = modelCodeMatch(src, cand);
    const a = specs(src), b = specs(cand);
    const typeConflict = productTypeMismatch(src, cand, strict);
    if (typeConflict) return typeConflict;
    const brandConflict = brandMismatch(brandAliases, cand, strict);
    if (brandConflict) return brandConflict;
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
    if (strict && codes.some(code => /^\d{3}$|^[a-z]\d{2}$/i.test(code)) && cov < 0.8)
      return { ok: false, score: +(cov * 0.4).toFixed(2), level: 'low', reasons: ['کد مدل کوتاه و مشترک است؛ شباهت بقیهٔ عنوان برای تأیید کافی نیست (' + Math.round(cov * 100) + '٪)'], flags: ['low-context'] };
    let model = codes.length ? found.length / codes.length : null;
    if (codes.length && found.length < codes.length) { flags.push('partial-model'); reasons.push('بخشی از کد مدل/ظرفیت تأیید نشد'); }
    // Without a model/capacity code (common for groceries, clothing, cosmetics), word-overlap alone is a weak
    // signal — "same category, different brand" can still clear the 50% baseline. Real data (different brands of
    // sunflower seeds scoring 0.56) showed this matters, so no-code matches need a much higher bar to be accepted.
    if (!codes.length) {
      flags.push('no-model-code');
      if (cov < 0.9 || precision < 0.85) return { ok: false, score: titleFit * 0.4, level: 'low', reasons: ['بدون کد مدل/ظرفیت، شباهت دوطرفهٔ عنوان برای نمایش قیمت کافی نیست'], flags: ['no-model-code', 'low-coverage'] };
      reasons.push('کد مدل لاتین برای تأیید وجود ندارد؛ فقط بر اساس پوشش کلمات نام (' + Math.round(cov * 100) + '٪) پذیرفته شد');
    }
    // A title-only match is useful but cannot carry the same evidence as an explicit model code.
    let score = codes.length ? 0.45 * titleFit + 0.55 * model : Math.min(0.72, titleFit * 0.72);
    if (codes.length && cov < 0.75) { flags.push('low-coverage'); reasons.push('پوشش کلمات نام ' + Math.round(cov * 100) + '٪'); }
    const level = score >= 0.9 ? 'high' : score >= 0.65 ? 'medium' : 'low';
    if (level === 'low') flags.push('suspicious');
    return { ok: true, score: +score.toFixed(2), level, reasons, flags };
  }
  return { baseline, modelCodes, modelCodeMatch, specs, brandFamilies, productTypes, evaluate };
})();


// ---- 08-sources.js ----
/* ===== Sources: independent modules. A failing source never disables the others. ===== */
const Sources = (() => {
  const TOROB_REF = 'https://torob.com/';
  const DK_REF = 'https://www.digikala.com/';
  const SEARCH_QUERY_NOISE = new Set(['مخصوص', 'مدل', 'قیمت', 'خرید', 'ارزان', 'ارزانترین', 'اورجینال', 'اصل', 'مناسب', 'و', 'با', 'از', 'برای', 'در', 'به']);
  const TOROB_FREE_SEARCH_PRODUCT_LIMIT = 10;
  const TOROB_FREE_SEARCH_BATCH_SIZE = 4;
  const TOROB_PRODUCT_RECORD_LIMIT = 6;
  // Torob appends VAR-* catalog identifiers to some titles. These identify
  // Torob records, not shopper-facing models or variants, so ignore them in
  // matching, deduplication, and the visible candidate title.
  const candidateTitle = r => [r?.name1, r?.name2].filter(Boolean).join(' ')
    .replace(/\bVAR[\s._-]*\d+\b/gi, ' ').replace(/\s+/g, ' ').trim();
  // Origin is a forbidden header for GM requests; cookies are sent (anonymous:false) so Digikala's CDN accepts the call; page fetch is the fallback.
  const DK_OPTS = { referer: DK_REF, headers: { 'x-web-client': 'desktop', 'x-web-client-id': 'web' }, anonymous: false, pageFetchFallback: true };
  // Torob can attach an unrelated marketplace page to an otherwise relevant base product.
  // Exclude the exact unwanted Basalam page; keep Torob redirect links usable as product references.
  const EXCLUDED_TOROB_SELLER_PAGES = new Set(['basalam.com/pakhshshop/product/25406964']);
  function isExcludedTorobSellerPage(raw, depth = 0) {
    if (depth > 4) return false;
    try {
      const u = new URL(raw, 'https://api.torob.com/'), host = u.hostname.toLowerCase().replace(/^www\./, '');
      const path = u.pathname.replace(/\/+$/, '').toLowerCase();
      if (EXCLUDED_TOROB_SELLER_PAGES.has(host + path)) return true;
      for (const key of ['to', 'url', 'redirect_url']) {
        const nested = u.searchParams.get(key);
        if (nested && nested !== raw && isExcludedTorobSellerPage(nested, depth + 1)) return true;
      }
      if (host === 'relay.basalam.com' && path === '/r') return false;
      return false;
    } catch { return false; }
  }

  // ---------- Torob: seller prices (engine 8.7 flow, unchanged endpoints) ----------
  const torob = {
    id: 'torob', label: 'ترب', icon: 'torob', kind: 'offers', implemented: true, hosts: ['api.torob.com'],
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
      const searchTokens = text => U.tokens(text).filter(token => !/^\d+ch$/i.test(token));
      const prefix = searchTokens(core).filter(x => !codes.includes(x) && !SEARCH_QUERY_NOISE.has(x)).slice(0, 5).join(' ');
      const focused = [prefix, codes.join(' ')].filter(Boolean).join(' ');
      const shortEnglish = en ? Extract.coreTitle(en) : '';
      const aliases = Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases];
      const searchableBrand = [prod.brandEn, ...aliases, prod.brand].find(x => /[a-z]/i.test(String(x || '')));
      const brandCodeQuery = searchableBrand && codeQuery ? `${String(searchableBrand).trim()} ${codeQuery}` : '';
      const candidates = codes.length
        ? [brandCodeQuery, focused, ...(brandCodeQuery ? [] : [codeQuery]), core, shortEnglish]
        : [core, searchTokens(core).slice(0, 5).join(' '), shortEnglish];
      return [...new Set(candidates.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 4);
    },
    candidateTitle,
    candidateProfile(r) {
      const title = torob.candidateTitle(r);
      const normalized = U.normalize(title), codes = Match.modelCodes(title);
      const tokens = [...new Set(normalized.split(' ').filter(token => token && !U.STOP.has(token)))];
      const codeParts = new Set(tokens.filter(token => {
        const part = token.replace(/[^a-z0-9]/g, '');
        return part && codes.some(code => code.includes(part));
      }));
      const colors = [
        ['black', ['مشکی', 'black']], ['white', ['سفید', 'white']],
        ['gray', ['طوسی', 'خاکستری', 'نقره ای', 'gray', 'grey', 'silver']],
        ['red', ['قرمز', 'red']], ['blue', ['آبی', 'blue']],
        ['navy', ['سرمه ای', 'navy']], ['green', ['سبز', 'green']],
        ['olive', ['زیتونی', 'ارتشی', 'olive', 'army green']],
        ['salmon', ['کالباسی', 'مرجانی', 'salmon', 'coral']],
        ['pink', ['صورتی', 'pink']], ['purple', ['بنفش', 'purple']],
        ['gold', ['طلایی', 'gold']], ['brown', ['قهوه ای', 'brown']],
        ['beige', ['کرم', 'بژ', 'beige']]
      ];
      const suffixes = ['pro', 'plus', 'lite', 'max', 'ultra', 'mini', 'neo', 'air', 'se', 'fe', 'پرو', 'پلاس', 'لایت', 'مکس', 'اولترا', 'مینی', 'نیو', 'ایر'];
      const hasPhrase = phrase => (' ' + normalized + ' ').includes(' ' + U.normalize(phrase) + ' ');
      const packageInfo = (() => {
        const text = U.normalize(U.digits(title));
        const packageWords = '(?:^|\\s)(?:بسته|پک|ست|مجموعه|pack|set|bundle)(?=\\s|$)';
        const number = '(\\d+|یک|یکی|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)';
        const countPatterns = [
          new RegExp(packageWords + '\\s*(?:از\\s*)?' + number + '\\s*(?:عدد(?:ی)?|تایی|pcs?|pieces?)', 'i'),
          new RegExp('(?<![a-z0-9])' + number + '\\s*(?:عدد(?:ی)?|تایی|pcs?|pieces?)(?=\\s|$)', 'i'),
          new RegExp('(?:pack|set)\\s*(?:of\\s*)?' + number + '(?=\\s|$)', 'i')
        ];
        for (const pattern of countPatterns) {
          const match = text.match(pattern);
          if (match) {
            const wordCounts = { یک: 1, یکی: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10 };
            return 'count:' + (wordCounts[match[1]] || Number(match[1]));
          }
        }
        return new RegExp(packageWords, 'i').test(text) ? 'package:unspecified' : '';
      })();
      return {
        title, codes,
        packageInfo,
        tokens: new Set([...tokens.filter(token => !codeParts.has(token)), ...codes]),
        plainTokens: new Set(tokens.filter(token => !codeParts.has(token))),
        colors: new Set(colors.filter(([, aliases]) => aliases.some(hasPhrase)).map(([id]) => id)),
        suffixes: new Set(suffixes.filter(hasPhrase)),
        brands: new Set(Match.brandFamilies(title)),
        types: new Set(Match.productTypes(title)),
        specs: Match.specs(title)
      };
    },
    candidateIdentity(r) {
      // Torob may return the same base product under different random_keys and
      // title word order across the search ladder. Compare normalized token sets
      // so punctuation, duplicate words, and filler such as «مدل» do not create
      // duplicate choices; meaningful color/model/spec tokens remain distinct.
      return [...torob.candidateProfile(r).tokens].sort().join(' ');
    },
    searchIdentity(r) {
      // Search results must retain package counts and other one-digit variants;
      // the strict-comparison identity intentionally ignores some of those.
      const tokens = U.normalize(torob.candidateTitle(r)).split(' ').filter(token => token && !U.STOP.has(token) && !SEARCH_QUERY_NOISE.has(token));
      return [...new Set(tokens)].sort().join(' ');
    },
    sameCandidateProduct(a, b) {
      const x = torob.candidateProfile(a), y = torob.candidateProfile(b);
      const overlaps = (left, right) => [...left].filter(value => right.has(value));
      // A stated bundle/count is part of the product identity. Do not merge a
      // single item with a multi-pack, or an unknown pack with an explicit one.
      if ((x.packageInfo || y.packageInfo) && x.packageInfo !== y.packageInfo) return false;
      if (torob.candidateIdentity(a) === torob.candidateIdentity(b)) return true;
      const compatibleCodes = (left, right) => left === right || (Math.min(left.length, right.length) >= 4 && (left.endsWith(right) || right.endsWith(left)));
      const codeOverlap = x.codes.some(aCode => y.codes.some(bCode => compatibleCodes(aCode, bCode)));
      const exactCodeOverlap = x.codes.some(aCode => y.codes.includes(aCode));
      const brandOverlap = overlaps(x.brands, y.brands).length > 0;
      if (x.codes.length && y.codes.length && !codeOverlap) return false;
      if (x.brands.size && y.brands.size && !brandOverlap) return false;
      if (x.types.size && y.types.size && !overlaps(x.types, y.types).length) return false;
      if ((x.colors.size || y.colors.size) && !overlaps(x.colors, y.colors).length) return false;
      if ((x.suffixes.size || y.suffixes.size) && !overlaps(x.suffixes, y.suffixes).length) return false;
      for (const unit of new Set([...Object.keys(x.specs), ...Object.keys(y.specs)])) {
        const aValues = x.specs[unit], bValues = y.specs[unit];
        if (aValues && bValues && ![...aValues].some(value => bValues.has(value))) return false;
      }

      const shared = overlaps(x.plainTokens, y.plainTokens).length;
      const smaller = Math.min(x.plainTokens.size, y.plainTokens.size);
      const union = new Set([...x.plainTokens, ...y.plainTokens]).size;
      const containment = smaller ? shared / smaller : 0;
      const jaccard = union ? shared / union : 0;
      const sameType = overlaps(x.types, y.types).length > 0;
      const sharedIdentityTerms = overlaps(x.plainTokens, y.plainTokens).filter(token =>
        !Match.brandFamilies(token).length && !SEARCH_QUERY_NOISE.has(token) && !['کد', 'code', 'original', 'genuine'].includes(token));
      // A compatible model code plus matching product type is stronger than
      // small title wording changes between Torob's search queries.
      if (codeOverlap && sameType && shared >= 2) return true;
      // Some categories (for example stationery) are not in the type taxonomy.
      // An exact model code, matching known brand, and one shared product word
      // can merge alternate catalog titles without masking known spec conflicts.
      if (exactCodeOverlap && x.brands.size && y.brands.size && brandOverlap && sharedIdentityTerms.length >= 1) return true;
      // Without that anchor, require near two-way title similarity so unrelated
      // products and vague short titles are not collapsed together.
      return shared >= 3 && containment >= 0.9 && jaccard >= 0.78;
    },
    async search(q) {
      const e = encodeURIComponent(q);
      const r = await Net.json(`https://api.torob.com/v4/base-product/search/?page=0&sort=popularity&size=24&query=${e}&q=${e}&source=next_desktop`, { referer: TOROB_REF, timeout: 15000, anonymous: true });
      return { results: Array.isArray(r.results) ? r.results : [], searchId: r.search_id || r.searchId || '' };
    },
    // Evaluate against every known title of the product (page title + Digikala official titles) and keep the best verdict.
    evalCand(prod, r) {
      const ct = torob.candidateTitle(r);
      // Check model/spec contradictions before token coverage: long page headings may have low overlap.
      const titles = torob.titles(prod);
      const aliases = Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases];
      const brandAliases = [...new Set([...aliases, prod.brand, prod.brandEn, ...titles.flatMap(Match.brandFamilies)].filter(Boolean))];
      const primaryTitle = prod.title || titles[0] || '';
      const primary = Match.evaluate(primaryTitle, ct, { strict: true, brandAliases });
      const hardConflicts = ['model-mismatch', 'spec-mismatch', 'brand-mismatch', 'category-mismatch', 'category-unverified', 'low-context'];
      if (primary.flags.some(flag => hardConflicts.includes(flag))) return primary;
      const alternatives = titles.filter(title => title !== primaryTitle).map(title => Match.evaluate(title, ct, { brandAliases }));
      return [primary, ...alternatives].filter(ev => ev.ok).sort((a, b) => b.score - a.score)[0] || primary;
    },
    async sellers(prod, base, ev, searchId, { freeSearch = false } = {}) {
      const baseTitle = torob.candidateTitle(base);
      const params = new URLSearchParams({ source: 'next_mobile', discover_method: 'direct', prk: base.random_key, list_type: 'products_info' });
      if (searchId) params.set('search_id', searchId);
      const res = await Net.json('https://api.torob.com/v4/base-product/sellers/?' + params, { referer: TOROB_REF, timeout: 15000, anonymous: true });
      const list = res?.results || res?.products_info?.result || [], ts = Date.now();
      const excludedOffer = s => [s.page_url, s.redirect_url, s.product_url, s.url].filter(Boolean).some(isExcludedTorobSellerPage);
      const eligible = list.filter(s => !excludedOffer(s) && s.availability !== false && s.is_price_unreliable !== true), excluded = list.length - eligible.length;
      const mapped = eligible.map(s => {
        const shop = String(s.shop_name || s.domain || s.shop_text || '').replace(/^www\./, '');
        const key = Extract.matchKnownSite(s.domain || shop) || Extract.matchKnownSite(shop);
        const more = s.more_info || {}, badges = Array.isArray(s.badges) ? s.badges.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean) : [];
        const shippingInfo = [...new Set([
          ...(Array.isArray(more.shipping_types) ? more.shipping_types.filter(value => typeof value === 'string') : []),
          ...(more.free_shipping === true ? ['ارسال رایگان'] : []),
          ...(more.same_day_delivery === true ? ['تحویل در همان روز'] : []),
          ...(more.payment_on_delivery === true ? ['پرداخت در محل'] : []),
          ...badges.filter(value => /ارسال|تحویل|پیک|پست|تیپاکس/.test(value))
        ].map(value => value.trim()).filter(Boolean))];
        const warrantyInfo = [...new Set([
          ...[s.warranty, s.warranty_info, s.guarantee_info?.title, s.guarantee_info?.text].filter(value => typeof value === 'string'),
          ...(s.guarantee_info?.status === 'enabled' ? ['وضعیت گارانتی: فعال'] : []),
          ...badges.filter(value => /گارانتی|ضمانت/.test(value))
        ].map(value => value.trim()).filter(Boolean))];
        return Model.offer({ sourceId: 'torob', productId: prod.id, seller: key ? (Extract.KNOWN[key][0] || key) : shop, sellerKey: key || '', sellerUrl: String(s.page_url || s.redirect_url || s.product_url || s.url || ''), price: Number(s.price ?? s.price_value),
          ts, dataSource: 'torob:base-product/sellers', matchConfidence: freeSearch ? null : ev.score, matchLevel: freeSearch ? '' : ev.level, matchTitle: baseTitle, flags: freeSearch ? [] : ev.flags, shippingInfo, warrantyInfo });
      });
      if (excluded) Log.info('torob', `${excluded} صفحهٔ فروش نامرتبط حذف شد`);
      const raw = mapped.filter(o => o.seller && o.price > 0);
      const byS = new Map(), dup = {};
      for (const o of raw) { const k = o.sellerKey || o.seller; dup[k] = (dup[k] || 0) + 1; const cur = byS.get(k); if (!cur || o.price < cur.price) byS.set(k, o); }
      const offers = [...byS.values()].map(o => { const k = o.sellerKey || o.seller; if (dup[k] > 1) o.flags = [...o.flags, 'dedup:' + dup[k]]; return o; });
      Log.info('torob', `${raw.length} فروشنده → ${offers.length} پس از حذف تکراری`);
      return offers;
    },
    async fetch(prod, { query, pickKey, freeSearch = false } = {}) {
      const tried = [], nearMiss = new Map(), rejected = new Set(), byKey = new Map();
      const qs = torob.queries(prod, query);
      const responses = await Promise.all(qs.map(async (q, index) => {
        try { return { q, index, res: await torob.search(q) }; }
        catch (error) { return { q, index, error }; }
      }));
      const rank = { high: 0, medium: 1, low: 2 };
      const compareCandidates = (a, b) => rank[a.ev.level] - rank[b.ev.level] || b.ev.score - a.ev.score || a.queryIndex - b.queryIndex || Number(a.r.price) - Number(b.r.price);
      let firstError = null, successfulSearches = 0;
      for (const item of responses) {
        tried.push(item.q);
        if (item.error) { firstError ||= item.error; Log.warn('torob', 'جست‌وجوی مرحلهٔ ' + (item.index + 1) + ' ناموفق: ' + item.error.message); continue; }
        successfulSearches++;
        const res = item.res;
        Log.info('torob', `«${item.q}» → ${res.results.length} نتیجه`);
        const valid = res.results.filter(r => r && r.name1 && !r.is_adv && Number(r.price) > 0 && r.random_key);
        for (const r of valid) {
          const title = torob.candidateTitle(r);
          const candidate = { r, ev: freeSearch ? freeSearchMatch(query, title) : torob.evalCand(prod, r), searchId: res.searchId, q: item.q, queryIndex: item.index };
          if (!candidate.ev.ok || candidate.ev.level === 'low') {
            rejected.add(r.random_key);
            if (!freeSearch && candidate.ev.flags.some(flag => ['model-mismatch', 'spec-mismatch', 'brand-mismatch', 'category-mismatch', 'category-unverified', 'low-context', 'low-coverage'].includes(flag)) && nearMiss.size < 8 && !nearMiss.has(r.random_key)) nearMiss.set(r.random_key, { title, reason: candidate.ev.reasons[0] });
            continue;
          }
          const current = byKey.get(r.random_key);
          if (!current || compareCandidates(candidate, current) < 0) byKey.set(r.random_key, candidate);
        }
      }
      if (!successfulSearches && firstError) throw firstError;
      const ok = [], searchIdentities = new Set(), productGroups = [];
      for (const candidate of [...byKey.values()].sort(compareCandidates)) {
        if (freeSearch) {
          const identity = torob.searchIdentity(candidate.r) || String(candidate.r.random_key || '');
          if (searchIdentities.has(identity)) continue;
          searchIdentities.add(identity);
          ok.push(candidate);
        } else {
          const group = productGroups.find(current => torob.sameCandidateProduct(current[0].r, candidate.r));
          if (group) group.push(candidate);
          else { productGroups.push([candidate]); ok.push(candidate); }
        }
      }
      const misses = [...nearMiss.values()].slice(0, 3);
      if (!ok.length) return { status: 'no-match', offers: [], note: freeSearch ? `در ترب نتیجه‌ای برای «${query}» پیدا نشد` : 'محصول مطابقی در ترب با اطمینان کافی پیدا نشد (' + tried.length + ' جست‌وجو)', nearMiss: freeSearch ? [] : misses, rejected: rejected.size, tried, candidates: [], query: tried[0] || '' };
      if (freeSearch) {
        // A free-text search can describe several products. Fetch seller lists for
        // a small set of distinct, relevant Torob results instead of comparing
        // only the first result with the product open in the browser.
        const selected = ok.slice(0, TOROB_FREE_SEARCH_PRODUCT_LIMIT), groups = [];
        let successfulSellerLookups = 0, failedSellerLookups = 0, firstSellerError = null;
        for (let i = 0; i < selected.length; i += TOROB_FREE_SEARCH_BATCH_SIZE) {
          const batch = selected.slice(i, i + TOROB_FREE_SEARCH_BATCH_SIZE);
          const results = await Promise.allSettled(batch.map(candidate => torob.sellers(prod, candidate.r, candidate.ev, candidate.searchId, { freeSearch: true })));
          for (const result of results) {
            if (result.status === 'fulfilled') { successfulSellerLookups++; groups.push(result.value); }
            else {
              failedSellerLookups++;
              const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason || 'خطای نامشخص'));
              firstSellerError ||= error;
              Log.warn('torob', 'دریافت فهرست فروشندگان یک نتیجه ناموفق بود: ' + error.message);
            }
          }
        }
        if (!successfulSellerLookups && firstSellerError) throw firstSellerError;
        const unique = new Map();
        for (const offer of groups.flat()) {
          const key = `${offer.sellerKey || offer.seller}|${offer.price}|${offer.sellerUrl}|${U.normalize(offer.matchTitle)}`;
          if (!unique.has(key)) unique.set(key, offer);
        }
        const offers = [...unique.values()];
        const note = `${U.toFa(selected.length)} محصول مرتبط با «${query}» در ترب بررسی شد${failedSellerLookups ? `؛ دریافت قیمت ${U.toFa(failedSellerLookups)} مورد ناموفق بود` : ''}`;
        return { status: offers.length ? 'ok' : 'empty', offers, note, nearMiss: [], rejected: rejected.size, tried, candidates: [], chosenKey: '', query };
      }
      const pick = (pickKey && ok.find(x => x.r.random_key === pickKey)) || ok[0], base = pick.r;
      const selectedGroup = productGroups.find(group => group.some(candidate => candidate.r.random_key === pick.r.random_key)) || [pick];
      const baseTitle = torob.candidateTitle(base);
      Log.info('torob', `محصول انتخاب‌شده: ${baseTitle} [${pick.ev.level} ${pick.ev.score}]`);
      const records = selectedGroup.slice(0, TOROB_PRODUCT_RECORD_LIMIT);
      if (selectedGroup.length > 1) Log.info('torob', `${U.toFa(selectedGroup.length)} رکورد هم‌محصول؛ بررسی ${U.toFa(records.length)} رکورد فروش`);
      if (selectedGroup.length > records.length) Log.warn('torob', `برای جلوگیری از درخواست زیاد، ${U.toFa(selectedGroup.length - records.length)} رکورد هم‌محصول بررسی نشد`);
      const sellerResults = await Promise.allSettled(records.map(candidate => torob.sellers(prod, candidate.r, candidate.ev, candidate.searchId)));
      const sellerErrors = sellerResults.filter(result => result.status === 'rejected');
      const successfulSellerResults = sellerResults.filter(result => result.status === 'fulfilled').map(result => result.value);
      if (!successfulSellerResults.length && sellerErrors.length) throw sellerErrors[0].reason;
      if (sellerErrors.length) Log.warn('torob', `دریافت فهرست فروش ${U.toFa(sellerErrors.length)} رکورد هم‌محصول ناموفق بود`);
      const bySeller = new Map(), sellerCopies = new Map();
      for (const offer of successfulSellerResults.flat()) {
        const key = offer.sellerKey || offer.seller;
        const prior = bySeller.get(key);
        const duplicateFlag = offer.flags.find(flag => /^dedup:\d+$/.test(flag));
        sellerCopies.set(key, (sellerCopies.get(key) || 0) + (duplicateFlag ? Number(duplicateFlag.slice(6)) : 1));
        if (!prior || offer.price < prior.price) bySeller.set(key, offer);
      }
      const offers = [...bySeller.values()].map(offer => {
        const key = offer.sellerKey || offer.seller, count = sellerCopies.get(key) || 1;
        if (count <= 1) return offer;
        return { ...offer, flags: [...offer.flags.filter(flag => !/^dedup:\d+$/.test(flag)), 'dedup:' + count] };
      });
      const candidates = ok.slice(0, 6).map(x => ({ key: x.r.random_key, title: torob.candidateTitle(x.r), price: Number(x.r.price), level: x.ev.level }));
      return { status: offers.length ? 'ok' : 'empty', offers, note: baseTitle, nearMiss: misses, rejected: rejected.size, tried, candidates, chosenKey: base.random_key, query: pick.q };
    }
  };

  // Search the same product at each marketplace, but only accept explicit model/brand matches.
  // These public search endpoints are not contractual APIs and can change without notice.
  const EMALLS_REF = 'https://emalls.ir/';
  const BASALAM_API = 'https://services.basalam.com/web/v1/search/product/search';
  const SNAPP_API = 'https://apix.snappshop.ir/';
  const SNAPP_CITIES = {
    tehran: { label: 'تهران', lat: 35.6892, lng: 51.3890 },
    mashhad: { label: 'مشهد', lat: 36.2972, lng: 59.6067 },
    isfahan: { label: 'اصفهان', lat: 32.6546, lng: 51.6680 },
    shiraz: { label: 'شیراز', lat: 29.5918, lng: 52.5837 },
    tabriz: { label: 'تبریز', lat: 38.0800, lng: 46.2919 },
    karaj: { label: 'کرج', lat: 35.8400, lng: 50.9391 },
    qom: { label: 'قم', lat: 34.6416, lng: 50.8746 },
    ahvaz: { label: 'اهواز', lat: 31.3183, lng: 48.6706 },
    kermanshah: { label: 'کرمانشاه', lat: 34.3142, lng: 47.0650 },
    urmia: { label: 'ارومیه', lat: 37.5527, lng: 45.0759 },
    rasht: { label: 'رشت', lat: 37.2808, lng: 49.5832 },
    yazd: { label: 'یزد', lat: 31.8974, lng: 54.3569 },
    kerman: { label: 'کرمان', lat: 30.2839, lng: 57.0834 },
    sari: { label: 'ساری', lat: 36.5633, lng: 53.0601 },
    arak: { label: 'اراک', lat: 34.0917, lng: 49.6892 },
    zahedan: { label: 'زاهدان', lat: 29.4963, lng: 60.8629 },
    bandarAbbas: { label: 'بندرعباس', lat: 27.1865, lng: 56.2808 },
    sanandaj: { label: 'سنندج', lat: 35.3114, lng: 46.9960 },
    zanjan: { label: 'زنجان', lat: 36.6736, lng: 48.4787 }
  };
  const searchTerms = (prod, override) => {
    if (override) return [String(override).trim()].filter(Boolean);
    const codes = [...new Set(torob.titles(prod).flatMap(Match.modelCodes))];
    // A model-only query such as "B60" pollutes marketplace results. Prefer the focused
    // brand/type + model query, then the complete product title as a second pass.
    return torob.queries(prod).filter(q => U.tokens(q).some(token => !codes.includes(token))).slice(0, 2);
  };
  const parsePrice = value => {
    const price = Number(U.digits(String(value ?? '')).replace(/\D/g, ''));
    return Number.isFinite(price) && price > 0 ? price : 0;
  };
  function safeMarketplaceUrl(raw, allowedHosts = []) {
    try {
      const url = new URL(String(raw || ''));
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      return url.protocol === 'https:' && allowedHosts.includes(host) ? url.href : '';
    } catch { return ''; }
  }
  function strictMatch(prod, title) {
    const titles = [...new Set([prod.title, ...(prod.altTitles || [])].filter(Boolean))];
    const aliases = [...new Set([
      ...(Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases]),
      prod.brand, prod.brandEn, ...titles.flatMap(Match.brandFamilies)
    ].filter(Boolean))];
    const matches = titles.map(source => Match.evaluate(source, title, { strict: true, brandAliases: aliases }));
    return matches.sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score)[0] || Match.evaluate(prod.title || '', title, { strict: true, brandAliases: aliases });
  }
  function freeSearchMatch(query, title) {
    const queryTokens = U.tokens(query), titleTokens = U.tokens(title);
    if (!queryTokens.length || !titleTokens.length) return { ok: false, score: 0, level: 'low', flags: [], reasons: [] };
    const queryCodes = Match.modelCodes(query), titleCodes = Match.modelCodes(title);
    const codeCompatible = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.endsWith(b) || b.endsWith(a)));
    if (queryCodes.length && !queryCodes.every(a => titleCodes.some(b => codeCompatible(a, b)))) {
      return { ok: false, score: 0, level: 'low', flags: ['model-mismatch'], reasons: ['کد مدل با عبارت جست‌وجو متفاوت است'] };
    }
    const queryBrands = Match.brandFamilies(query), titleBrands = Match.brandFamilies(title);
    if (queryBrands.length && titleBrands.length && !queryBrands.some(brand => titleBrands.includes(brand))) {
      return { ok: false, score: 0, level: 'low', flags: ['brand-mismatch'], reasons: ['برند با عبارت جست‌وجو متفاوت است'] };
    }
    const queryTypes = Match.productTypes(query), titleTypes = Match.productTypes(title);
    if (queryTypes.length && titleTypes.length && !queryTypes.some(type => titleTypes.includes(type))) {
      return { ok: false, score: 0, level: 'low', flags: ['category-mismatch'], reasons: ['نوع کالا با عبارت جست‌وجو متفاوت است'] };
    }
    const querySpecs = Match.specs(query), titleSpecs = Match.specs(title);
    for (const unit of Object.keys(querySpecs)) if (titleSpecs[unit] && ![...querySpecs[unit]].some(value => titleSpecs[unit].has(value))) {
      return { ok: false, score: 0, level: 'low', flags: ['spec-mismatch'], reasons: ['مشخصه با عبارت جست‌وجو متفاوت است'] };
    }
    const hasToken = queryToken => titleTokens.some(titleToken => titleToken === queryToken ||
      (Math.min(queryToken.length, titleToken.length) >= 4 && (queryToken.startsWith(titleToken) || titleToken.startsWith(queryToken))));
    const matched = queryTokens.filter(hasToken).length;
    const required = queryTokens.length <= 2 ? queryTokens.length : Math.max(2, Math.ceil(queryTokens.length * 0.7));
    const score = matched / queryTokens.length;
    return { ok: matched >= required, score, level: matched >= required ? 'high' : 'low', flags: [], reasons: [] };
  }
  function marketMatchReason(prod, title) {
    const ev = strictMatch(prod, title);
    return ev.reasons[0] || (ev.ok ? 'اطمینان تطبیق برای نمایش کافی نبود' : 'تطبیق دقیق مدل یا برند تأیید نشد');
  }
  function mapMarketOffer(prod, row, { sourceId, title, price, seller, sellerUrl, allowedHosts, priceFactor = 1, dataSource, exclude, freeSearch = false, query = '', dedupeSellerKey = '' } = {}) {
    const name = String(title || '').trim(), url = safeMarketplaceUrl(sellerUrl, allowedHosts);
    if (!name || !url || (exclude && exclude(row, url))) return null;
    const amount = parsePrice(price) * priceFactor, ev = freeSearch ? freeSearchMatch(query, name) : strictMatch(prod, name);
    if (!(amount > 0) || !ev.ok || (!freeSearch && ev.score < 0.65)) return null;
    const storeName = String(seller || '').trim();
    const sellerKey = dedupeSellerKey || Extract.matchKnownSite(url) || Extract.matchKnownSite(storeName);
    return Model.offer({ sourceId, productId: prod.id, seller: storeName || sourceId, sellerKey: sellerKey || '', sellerUrl: url, price: amount,
      ts: Date.now(), dataSource, matchConfidence: freeSearch ? null : ev.score, matchLevel: freeSearch ? '' : ev.level, matchTitle: name, flags: freeSearch ? [] : ev.flags });
  }
  function marketResult(offers, tried, rejected, nearMiss = [], note = '', error = '') {
    const unique = new Map();
    for (const offer of offers) {
      const key = `${offer.sellerKey || offer.seller}|${offer.price}|${offer.sellerUrl}`;
      if (!unique.has(key)) unique.set(key, offer);
    }
    const list = [...unique.values()];
    return { status: list.length ? 'ok' : (error ? 'error' : 'no-match'), offers: list, note: note || (list.length ? `${list.length} نتیجهٔ همسان` : 'نتیجهٔ همسان با برند و کد مدل پیدا نشد'), error, tried, rejected, nearMiss: nearMiss.slice(0, 3) };
  }
  function emallsText(element) {
    return String(element?.innerText || element?.textContent || '')
      .replace(/[\u200c\u200e\u200f]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function emallsPrices(text) {
    const normalized = U.digits(String(text || ''));
    return [...normalized.matchAll(/(?:\d{1,3}(?:[,\u066c\u060c. ]\d{3})+|\d{5,})/g)]
      .map(match => ({ value: parsePrice(match[0]), index: match.index, text: match[0] }))
      .filter(match => match.value > 0);
  }
  function parseEmallsSearchPage(html) {
    if (typeof DOMParser !== 'function') throw new Error('DOMParser برای خواندن نتایج ایمالز در دسترس نیست');
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const root = doc.getElementById('mainlist');
    if (!root) throw new Error('ساختار صفحهٔ جست‌وجوی عمومی ایمالز شناخته نشد');
    const rows = [], seen = new Set();
    const cards = root.querySelectorAll('.item.product-block');
    for (const card of cards) {
      const name = emallsText(card.querySelector('.prd-name, h2')) || emallsText(card.querySelector('img[alt]'));
      const priceText = emallsText(card.querySelector('.prd-price, .price-box'));
      const prices = emallsPrices(priceText);
      const shop = card.querySelector('.btn-buyshop');
      const seller = emallsText(shop).replace(/^خرید\s*از\s*/u, '').trim();
      if (!name || prices.length !== 1 || !seller) continue;

      // Emalls stores its signed click-through URL reversed in a data attribute on the offer card.
      // Read the URL it supplied verbatim; never manufacture its nonce/signature.
      const encodedLink = shop.getAttribute('data-esrever') || card.querySelector('[data-esrever]')?.getAttribute('data-esrever');
      const buyLink = reverseEmallsLink(encodedLink);
      if (!buyLink) continue;
      const identity = U.normalize(name) + '|' + U.normalize(seller) + '|' + prices[0].value;
      if (seen.has(identity)) continue;
      seen.add(identity);
      rows.push({ title: name, price: prices[0].value, buyTitle: seller, buyLink });
    }
    return { rows, productCount: cards.length };
  }
  function reverseEmallsLink(value) {
    try {
      const url = new URL(String(value || '').split('').reverse().join(''));
      return url.protocol === 'https:' && url.hostname === 'click.emalls.ir' ? url.href : '';
    } catch { return ''; }
  }
  function excludedBasalamProduct(row, url) {
    const id = String(row?.id || '');
    return id === '25406964' || isExcludedTorobSellerPage(url);
  }
  const emalls = {
    id: 'emalls', label: 'ایمالز', icon: 'emalls', kind: 'offers', implemented: true, hosts: ['emalls.ir'],
    note: 'جست‌وجوی زندهٔ ایمالز؛ تطبیق برند و مدل پیش از نمایش قیمت',
    async search(q) {
      if (typeof DOMParser === 'function') {
        const url = 'https://emalls.ir/' + encodeURIComponent('لیست-قیمت~skey~') + encodeURIComponent(q);
        const html = await Net.request(url, { accept: 'text/html,application/xhtml+xml', referer: EMALLS_REF, timeout: 18000, anonymous: true });
        return parseEmallsSearchPage(html);
      }
      // The background service worker has no DOMParser; keep its legacy JSON path available there.
      const body = new URLSearchParams({ findstr: q, entekhab: 'listitemv2', pagenum: '1' });
      const result = await Net.json('https://emalls.ir/swservice/site_search', { method: 'POST', body: body.toString(), referer: EMALLS_REF, timeout: 18000, anonymous: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } });
      const legacyRows = Array.isArray(result?.lstsearchresualt) ? result.lstsearchresualt : [];
      return { rows: legacyRows.map(row => ({ ...row, buyLink: reverseEmallsLink(row?.buyLink), dataSource: 'emalls:site_search/listitemv2' })), productCount: legacyRows.length };
    },
    async fetch(prod, { query, freeSearch = false } = {}) {
      const tried = [], offers = [], nearMiss = [], failures = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        let result;
        try { result = await emalls.search(q); }
        catch (e) {
          failures.push(e.message);
          Log.warn('emalls', `عبارت «${q}» ناموفق بود: ${e.message}`);
          continue;
        }
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        Log.info('emalls', U.toFa(result?.productCount || rows.length) + ' کارت قیمت در صفحهٔ عمومی؛ ' + U.toFa(rows.length) + ' پیشنهاد دارای فروشگاه و قیمت');
        for (const row of rows) {
          const name = row?.title || '', link = row?.buyLink;
          const seller = String(row?.buyTitle || '').trim();
          const offer = mapMarketOffer(prod, row, { sourceId: 'emalls', title: name, price: row?.price, seller, sellerUrl: link, allowedHosts: ['emalls.ir', 'click.emalls.ir'], dataSource: row?.dataSource || 'emalls:public-search-page', dedupeSellerKey: Extract.matchKnownSite(seller) || 'emalls:' + U.normalize(seller), exclude: item => item?.agahi || item?.used === true, freeSearch, query });
          if (offer) offers.push(offer); else { rejected++; if (!freeSearch && name && nearMiss.length < 3) nearMiss.push({ title: name, reason: marketMatchReason(prod, name) }); }
        }
      }
      const error = tried.length && failures.length === tried.length ? failures.join('؛ ') : '';
      const note = failures.length
        ? (error ? `تمام جست‌وجوهای ایمالز ناموفق بود: ${error}` : `یک یا چند عبارت ایمالز پاسخ نداد؛ ${offers.length ? `${offers.length} نتیجه از پاسخ‌های موفق` : 'در پاسخ‌های موفق نتیجهٔ همسانی پیدا نشد'}`)
        : '';
      return marketResult(offers, tried, rejected, freeSearch ? [] : nearMiss, note, error);
    }
  };
  const basalam = {
    id: 'basalam', label: 'باسلام', icon: 'basalam', kind: 'offers', implemented: true, hosts: ['services.basalam.com'],
    note: 'جست‌وجوی زندهٔ باسلام؛ مبلغ ریالی به تومان تبدیل می‌شود',
    async search(q) {
      const url = new URL(BASALAM_API); url.search = new URLSearchParams({ q, sort: 'rank', from: '0', size: '30' }).toString();
      return Net.json(url.href, { referer: 'https://basalam.com/', timeout: 18000, anonymous: true });
    },
    async fetch(prod, { query, freeSearch = false } = {}) {
      const tried = [], offers = [], nearMiss = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await basalam.search(q), rows = Array.isArray(result?.products) ? result.products : [];
        for (const row of rows) {
          const slug = String(row?.vendor?.identifier || '').trim(), id = String(row?.id || '').trim();
          const url = slug && id ? `https://basalam.com/${encodeURIComponent(slug)}/product/${encodeURIComponent(id)}` : '';
          const offer = mapMarketOffer(prod, row, { sourceId: 'basalam', title: row?.name, price: row?.price, priceFactor: 0.1,
            seller: row?.vendor?.name, sellerUrl: url, allowedHosts: ['basalam.com'], dataSource: 'basalam:guest-product-search', exclude: excludedBasalamProduct, freeSearch, query });
          if (offer && row?.IsSaleable !== false && row?.status?.title !== 'ناموجود') offers.push(offer);
          else { rejected++; if (!freeSearch && row?.name && nearMiss.length < 3) nearMiss.push({ title: row.name, reason: marketMatchReason(prod, row.name) }); }
        }
      }
      return marketResult(offers, tried, rejected, freeSearch ? [] : nearMiss, freeSearch && !offers.length ? `در باسلام نتیجه‌ای برای «${query}» پیدا نشد` : '');
    }
  };
  const snappshop = {
    id: 'snappshop', label: 'اسنپ‌شاپ', icon: 'snappshop', kind: 'offers', implemented: true, hosts: ['apix.snappshop.ir'], cities: SNAPP_CITIES,
    note: 'جست‌وجوی زندهٔ قیمت در اسنپ‌شاپ',
    async fetch(prod, { query, cityId, freeSearch = false } = {}) {
      const savedCity = typeof Store !== 'undefined' ? Store.get()?.settings?.snappCity : '';
      const city = SNAPP_CITIES[cityId || savedCity] || SNAPP_CITIES.tehran;
      const coordinates = `lat=${encodeURIComponent(city.lat)}&lng=${encodeURIComponent(city.lng)}`;
      const tokenData = await Net.json(`${SNAPP_API}guest/v2/token?${coordinates}`, { timeout: 15000, anonymous: true });
      const token = tokenData?.data?.token || tokenData?.token;
      if (!token) throw new Error('توکن مهمان اسنپ‌شاپ در پاسخ پیدا نشد');
      const tried = [], offers = [], nearMiss = []; let rejected = 0, loggedOffers = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await Net.json(`${SNAPP_API}search/v1?${coordinates}`, { method: 'POST', timeout: 18000, anonymous: true,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ render: 4, query: q }) });
        const rows = (result?.data?.structure || []).flatMap(section => Array.isArray(section?.items) ? section.items : []);
        for (const row of rows) {
          const url = row?.href ? new URL(row.href, 'https://snappshop.ir/').href : '';
          const rawPrice = row?.price?.discounted_price || row?.price?.price;
          const offer = mapMarketOffer(prod, row, { sourceId: 'snappshop', title: row?.title, price: rawPrice,
            seller: 'اسنپ‌شاپ', sellerUrl: url, allowedHosts: ['snappshop.ir'], dataSource: 'snappshop:search/v1',
            exclude: item => item?.is_ads || item?.is_fake, freeSearch, query });
          if (offer) {
            offers.push(offer);
            if (loggedOffers < 5) {
              loggedOffers++;
              const score = offer.matchConfidence == null ? '' : ' · تطبیق ' + U.toFa(Math.round(offer.matchConfidence * 100)) + '٪';
              Log.info('snappshop', 'پیشنهاد پذیرفته شد: «' + offer.matchTitle + '»' + score);
            }
          }
          else { rejected++; if (!freeSearch && row?.title && nearMiss.length < 3) nearMiss.push({ title: row.title, reason: marketMatchReason(prod, row.title) }); }
        }
      }
      if (rejected && nearMiss.length) Log.info('snappshop', U.toFa(rejected) + ' نتیجه رد شد؛ نمونه: «' + nearMiss[0].title + '» · ' + nearMiss[0].reason);
      return marketResult(offers, tried, rejected, freeSearch ? [] : nearMiss,
        freeSearch ? `قیمت‌های اسنپ‌شاپ · ${city.label}` : offers.length ? `قیمت اسنپ‌شاپ · ${city.label}` : `برای این شهر (${city.label}) نتیجهٔ همسان با برند و کد مدل پیدا نشد`);
    }
  };

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
      return { title: p.title_fa || '', titleEn: p.title_en || '', brand: p.brand?.title_fa || '', brandEn: p.brand?.title_en || '', variants: all, chosen, exact: !!chosen, lowest30dOfficial: toT(p.properties?.min_price_in_last_month) };
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

  const registry = { torob, emalls, basalam, snappshop };
  return { registry, torob, emalls, basalam, snappshop, dk };
})();


// ---- 09-analysis.js ----
/* ===== Analysis: discount inspector and buying advisor based on real price history. ===== */
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
    }
    let histGood = null;
    if (st && st.count >= 10) {
      if (current <= st.min * 1.03) { histGood = true; points.push({ k: 'good', text: `قیمت نزدیک کمترین قیمت ثبت‌شده (${U.fmt(st.min)}) در ${U.toFa(st.span)} روز اخیر است.` }); }
      else if (current >= st.median * 1.1) { histGood = false; points.push({ k: 'warn', text: `قیمت ${U.fmtPct((current / st.median - 1) * 100)} بالاتر از میانهٔ ${U.toFa(st.span)} روز اخیر (${U.fmt(st.median)}) است.` }); }
      else points.push({ k: 'ok', text: `قیمت در محدودهٔ معمول ${U.toFa(st.span)} روز اخیر است (کمینه ${U.fmt(st.min)}، میانه ${U.fmt(st.median)}).` });
    }
    if (insp && insp.verdict === 'rise-signal') { points.push({ k: 'warn', text: 'نشانهٔ افزایش قیمت پیش از تخفیف دیده می‌شود؛ تخفیف ادعایی را با احتیاط ببینید.' }); }
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
    chart: null, chartError: '', chartLoading: false, chartFromCache: false, chartFetchedAt: 0, chartStale: false, historyNotice: '', variantIdx: 0, variantExact: false, variantManual: false,
    range: 90, tab: 'compare', running: false, sort: 'price', banner: '', freeSearch: false, searchQuery: '',
    dkFetching: false, dkTs: 0, dkPromise: null, dkProductId: '', historyCooldownUntil: 0, historyCooldownNote: ''
  };
  const subs = new Set(); const emit = () => subs.forEach(f => { try { f(state); } catch (e) { Log.error('ui', e.message); } });
  const on = f => subs.add(f);

  function applyDigikalaMatchMetadata(product, data) {
    if (!product || !data) return;
    product.altTitles = [data.title, data.titleEn].filter(Boolean);
    product.brand = data.brand; product.brandEn = data.brandEn;
    product.brandAliases = [...new Set([data.brand, data.brandEn].filter(Boolean))];
  }

  const settings = () => Store.get().settings;
  const keyFor = p => `${p.host}:${p.id || U.compact(location.pathname).slice(0, 60)}`;

  async function refreshProduct() {
    const x = Extract.product(document);
    const prev = state.product;
    const p = Model.product({ ...x, key: '', priceTs: Date.now() });
    p.key = keyFor(p);
    // keep a manual price if extraction failed
    if (!p.price && prev && prev.key === p.key && prev.priceSource === 'دستی') { p.price = prev.price; p.priceSource = 'دستی'; }
    if (state.key && state.key !== p.key) { state.offers = []; state.sources = {}; state.chart = null; state.chartError = ''; state.chartFromCache = false; state.chartFetchedAt = 0; state.chartStale = false; state.historyNotice = ''; state.dk = null; state.dkTs = 0; state.dkPromise = null; state.dkProductId = ''; state.dkFetching = false; state.variantIdx = 0; state.variantExact = false; state.variantManual = false; }
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
      state.dkProductId = String(p.id);
      const pending = loadDigikala(p, x.color);
      state.dkPromise = pending;
      const clearPending = () => {
        if (state.dkPromise === pending) { state.dkPromise = null; state.dkFetching = false; }
      };
      pending.then(clearPending, clearPending);
    }
    return p;
  }

  async function loadDigikala(p, color) {
    try {
      const d = await Sources.dk.product(p.id, p.variantId);
      if (state.product?.key !== p.key || state.dkProductId !== String(p.id)) return;
      state.dk = d;
      if (d) {
        applyDigikalaMatchMetadata(p, d);
        if (state.product !== p) applyDigikalaMatchMetadata(state.product, d);
      }
      if (d && d.chosen) {
        p.seller = d.chosen.seller; p.warranty = d.chosen.warranty; p.variantTitle = d.chosen.title;
        if (!p.oldPrice && d.chosen.rrp) p.oldPrice = d.chosen.rrp;
        if (!p.price) { p.price = d.chosen.price; p.priceSource = 'API دیجی‌کالا (واریانت دقیق)'; }
        else if (Math.abs(p.price - d.chosen.price) / d.chosen.price > 0.02) { Log.warn('price', `اختلاف قیمت صفحه (${p.price}) و API (${d.chosen.price})`); p.priceNote = 'قیمت صفحه با API دیجی‌کالا اختلاف دارد'; }
      } else if (d && !p.price && d.variants.length) { p.price = d.variants[0].price; p.priceSource = 'API دیجی‌کالا (ارزان‌ترین واریانت؛ واریانت دقیق نامشخص)'; }
      emit();
    } catch (e) { Log.warn('dk-product', e.message); }
    if (!state.chart) loadHistory(color); // loadHistory checks the persisted cache and shared cooldown before making a request
  }

  const HISTORY_CACHE_TTL = 6 * 60 * 60 * 1000;
  function historyCacheFor(p) {
    const cached = Store.get().products[p.key]?.officialHistory;
    return cached && String(cached.productId) === String(p.id) && Number.isFinite(cached.fetchedAt) && Array.isArray(cached.chart?.variants) ? cached : null;
  }
  function selectHistoryVariant(p, color) {
    const preferred = [state.dk?.chosen?.title, p.variantTitle, color, Extract.selectedColor()].filter(Boolean);
    const pick = Sources.dk.pickVariant(state.chart, preferred);
    state.variantIdx = pick ? Math.max(0, state.chart.variants.indexOf(pick.variant)) : 0;
    state.variantExact = !!(pick && pick.exact); state.variantManual = false;
  }
  async function loadHistory(color, { refresh = false } = {}) {
    const p = state.product; if (!p || !p.id || state.chartLoading) return;
    const cached = historyCacheFor(p), age = cached ? Date.now() - cached.fetchedAt : Infinity;
    if (cached && !state.chart) {
      state.chart = cached.chart; state.chartFromCache = true; state.chartFetchedAt = cached.fetchedAt;
      state.chartStale = age > HISTORY_CACHE_TTL; selectHistoryVariant(p, color);
    }
    if (!refresh && cached && age <= HISTORY_CACHE_TTL) {
      state.chartError = ''; state.historyNotice = ''; state.chartLoading = false; emit(); return;
    }
    if (Date.now() < state.historyCooldownUntil) {
      state.chartLoading = false; state.historyNotice = 'rate-limit'; state.chartError = '';
      if (cached) { state.chart = cached.chart; state.chartFromCache = true; state.chartFetchedAt = cached.fetchedAt; state.chartStale = true; selectHistoryVariant(p, color); }
      emit(); return;
    }
    state.chartLoading = true; state.chartError = ''; state.historyNotice = ''; emit();
    try {
      const sharedCooldown = Number(await Store.getHistoryCooldown?.()) || 0;
      if (sharedCooldown > Date.now()) {
        state.historyCooldownUntil = Math.max(state.historyCooldownUntil, sharedCooldown);
        state.chartLoading = false; state.historyNotice = 'rate-limit'; state.chartError = '';
        if (cached) { state.chart = cached.chart; state.chartFromCache = true; state.chartFetchedAt = cached.fetchedAt; state.chartStale = true; selectHistoryVariant(p, color); }
        emit(); return;
      }
      state.chart = await Sources.dk.chart(p.id);
      state.historyCooldownUntil = 0; state.historyCooldownNote = ''; state.chartFromCache = false;
      state.chartFetchedAt = Date.now(); state.chartStale = false; state.historyNotice = '';
      selectHistoryVariant(p, color);
      Store.touchProduct(p.key).officialHistory = { productId: String(p.id), fetchedAt: state.chartFetchedAt, chart: state.chart };
      Store.save();
      Log.info('history', `بازهٔ داده: ${state.chart.range ? state.chart.range.days + ' روز' : '—'}, واریانت‌ها: ${state.chart.variants.length}`);
    } catch (e) {
      const retryMs = e.retryAfterMs > 0 ? e.retryAfterMs : (e.status === 429 ? 90000 : 20000);
      state.historyCooldownUntil = Date.now() + retryMs; state.historyCooldownNote = e.status === 429 ? 'rate-limit' : 'error';
      state.historyNotice = e.status === 429 ? 'rate-limit' : 'error';
      if (e.status === 429 && retryMs >= 30000) await Store.setHistoryCooldown?.(state.historyCooldownUntil);
      if (cached) {
        state.chart = cached.chart; state.chartFromCache = true; state.chartFetchedAt = cached.fetchedAt; state.chartStale = true;
        selectHistoryVariant(p, color); state.chartError = '';
      } else { state.chart = null; state.chartFromCache = false; state.chartFetchedAt = 0; state.chartStale = false; state.chartError = e.status === 429 ? '' : e.message; }
      const message = e.status === 429
        ? `HTTP 429؛ تلاش بعدی پس از ${Math.ceil(retryMs / 1000)} ثانیه`
        : e.message;
      if (e.status === 429) Log.warn('history', message); else Log.error('history', message);
    }
    state.chartLoading = false; emit();
  }

  async function runCompare(opts = {}) {
    if (state.running) return;
    const pageProduct = state.product || await refreshProduct();
    const searchQuery = String(opts.query || '').trim();
    const freeSearch = opts.freeSearch === true && !!searchQuery;
    state.freeSearch = freeSearch; state.searchQuery = freeSearch ? searchQuery : '';
    if (!pageProduct.title && !freeSearch) { state.offers = []; state.sources = {}; state.banner = 'نام محصول در این صفحه پیدا نشد.'; emit(); return; }
    const p = freeSearch
      ? Model.product({ id: `manual-search:${U.compact(searchQuery)}`, key: `manual-search:${U.compact(searchQuery)}`, host: 'manual-search', title: searchQuery })
      : pageProduct;
    state.banner = ''; state.running = true; state.offers = []; state.sources = {};
    emit();
    if (!freeSearch && p.host.endsWith('digikala.com')) {
      const pending = state.dkProductId === String(p.id) ? state.dkPromise : null;
      if (pending) await pending;
      if (state.product?.key !== p.key) { state.running = false; emit(); return; }
      if (state.product?.key === p.key && state.dkProductId === String(p.id) && state.dk) {
        applyDigikalaMatchMetadata(p, state.dk);
        if (state.product !== p) applyDigikalaMatchMetadata(state.product, state.dk);
      }
    }
    const reg = Sources.registry, cfg = settings().sources;
    for (const id of Object.keys(reg)) state.sources[id] = { status: reg[id].implemented ? (cfg[id] ? 'loading' : 'off') : 'unavailable', count: 0, note: reg[id].implemented ? '' : reg[id].note };
    emit();
    await Promise.all(Object.keys(reg).filter(id => reg[id].implemented && cfg[id]).map(async id => {
      try {
        const r = await reg[id].fetch(p, { ...opts, query: freeSearch ? searchQuery : opts.query, freeSearch });
        state.sources[id] = { status: r.status, count: r.offers.length, note: r.note || '', error: r.error || '', nearMiss: r.nearMiss || [], candidates: r.candidates || [], chosenKey: r.chosenKey || '', query: r.query || '', tried: r.tried || [], ts: Date.now() };
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
  const jsonAll = extra => JSON.stringify({ app: 'تخفیف‌سنج 15.2.37', exportedAt: new Date().toISOString(), db: Store.get(), ...extra }, null, 2);
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
  toman: "<path fill=\"currentColor\" d=\"M1.14878 6.91843C1.44428 6.91843 1.70285 6.87142 1.92447 6.77739C2.15282 6.68337 2.34422 6.55577 2.49869 6.39458C2.65316 6.2334 2.77069 6.04535 2.85128 5.83044C2.93187 5.62224 2.97888 5.40062 2.99231 5.16556H1.98492C1.6424 5.16556 1.36033 5.12862 1.1387 5.05474C0.917077 4.98087 0.742461 4.87341 0.614858 4.73238C0.487254 4.59134 0.396588 4.42344 0.34286 4.22868C0.295849 4.0272 0.272343 3.80221 0.272343 3.55372C0.272343 3.29852 0.309281 3.05674 0.383156 2.8284C0.457032 2.60005 0.564488 2.39857 0.705523 2.22396C0.846559 2.04934 1.02117 1.91167 1.22937 1.81093C1.44428 1.70347 1.68941 1.64974 1.96477 1.64974C2.1864 1.64974 2.39795 1.68668 2.59943 1.76056C2.80091 1.83443 2.97888 1.95196 3.13335 2.11315C3.28782 2.26761 3.40871 2.47245 3.49601 2.72766C3.59004 2.97615 3.63705 3.27837 3.63705 3.63431V4.47045H4.60415C4.68474 4.47045 4.73847 4.50068 4.76533 4.56112C4.79891 4.61485 4.8157 4.6988 4.8157 4.81297C4.8157 4.93386 4.79891 5.02452 4.76533 5.08497C4.73847 5.13869 4.68474 5.16556 4.60415 5.16556H3.6169C3.60347 5.49464 3.53631 5.80693 3.41542 6.10244C3.30125 6.39794 3.14007 6.65651 2.93187 6.87813C2.72368 7.09976 2.47518 7.27438 2.1864 7.40198C1.89761 7.5363 1.57188 7.60346 1.20922 7.60346H0.141381L0.0809373 6.91843H1.14878ZM0.896929 3.51343C0.896929 3.68133 0.913719 3.82572 0.947299 3.94661C0.987594 4.0675 1.0514 4.16823 1.1387 4.24883C1.23273 4.3227 1.35697 4.37979 1.51144 4.42008C1.66591 4.45366 1.86067 4.47045 2.09573 4.47045H3.00239V3.71491C3.00239 3.21792 2.90501 2.86198 2.71024 2.64707C2.51548 2.43215 2.24684 2.3247 1.90433 2.3247C1.58196 2.3247 1.33347 2.43215 1.15885 2.64707C0.984237 2.86198 0.896929 3.15076 0.896929 3.51343ZM6.26895 4.47045C6.35626 4.47045 6.41335 4.50068 6.44021 4.56112C6.47379 4.61485 6.49058 4.6988 6.49058 4.81297C6.49058 4.93386 6.47379 5.02452 6.44021 5.08497C6.41335 5.13869 6.35626 5.16556 6.26895 5.16556H4.60675C4.51944 5.16556 4.46235 5.13869 4.43549 5.08497C4.40191 5.03124 4.38512 4.94729 4.38512 4.83312C4.38512 4.71223 4.40191 4.62156 4.43549 4.56112C4.46235 4.50068 4.51944 4.47045 4.60675 4.47045H6.26895ZM7.93155 4.47045C8.01886 4.47045 8.07594 4.50068 8.10281 4.56112C8.13639 4.61485 8.15318 4.6988 8.15318 4.81297C8.15318 4.93386 8.13639 5.02452 8.10281 5.08497C8.07594 5.13869 8.01886 5.16556 7.93155 5.16556H6.26935C6.18204 5.16556 6.12495 5.13869 6.09809 5.08497C6.06451 5.03124 6.04772 4.94729 6.04772 4.83312C6.04772 4.71223 6.06451 4.62156 6.09809 4.56112C6.12495 4.50068 6.18204 4.47045 6.26935 4.47045H7.93155ZM9.59415 4.47045C9.68146 4.47045 9.73854 4.50068 9.76541 4.56112C9.79899 4.61485 9.81578 4.6988 9.81578 4.81297C9.81578 4.93386 9.79899 5.02452 9.76541 5.08497C9.73854 5.13869 9.68146 5.16556 9.59415 5.16556H7.93194C7.84464 5.16556 7.78755 5.13869 7.76069 5.08497C7.72711 5.03124 7.71032 4.94729 7.71032 4.83312C7.71032 4.71223 7.72711 4.62156 7.76069 4.56112C7.78755 4.50068 7.84464 4.47045 7.93194 4.47045H9.59415ZM11.2567 4.47045C11.3441 4.47045 11.4011 4.50068 11.428 4.56112C11.4616 4.61485 11.4784 4.6988 11.4784 4.81297C11.4784 4.93386 11.4616 5.02452 11.428 5.08497C11.4011 5.13869 11.3441 5.16556 11.2567 5.16556H9.59454C9.50723 5.16556 9.45015 5.13869 9.42328 5.08497C9.3897 5.03124 9.37291 4.94729 9.37291 4.83312C9.37291 4.71223 9.3897 4.62156 9.42328 4.56112C9.45015 4.50068 9.50723 4.47045 9.59454 4.47045H11.2567ZM12.1638 4.47045C12.4257 4.47045 12.6339 4.39994 12.7884 4.2589C12.9496 4.11787 13.0302 3.9231 13.0302 3.67461V2.2844H13.685V3.67461C13.685 4.15144 13.5506 4.52082 13.282 4.78275C13.0201 5.03795 12.6608 5.16556 12.2041 5.16556H11.2571C11.1698 5.16556 11.1127 5.13869 11.0859 5.08497C11.0523 5.03124 11.0355 4.94729 11.0355 4.83312C11.0355 4.71223 11.0523 4.62156 11.0859 4.56112C11.1127 4.50068 11.1698 4.47045 11.2571 4.47045H12.1638ZM13.7857 0.994934H12.9798V0.279683H13.7857V0.994934ZM12.5063 0.994934H11.7004V0.279683H12.5063V0.994934ZM5.64177 12.9641C5.64177 13.3267 5.58468 13.6659 5.47051 13.9815C5.35634 14.3039 5.1918 14.5826 4.97689 14.8177C4.76198 15.0595 4.50005 15.2509 4.19112 15.3919C3.8889 15.5329 3.54638 15.6035 3.16357 15.6035H2.56921C1.81702 15.6035 1.23273 15.3718 0.816337 14.9084C0.399946 14.445 0.191751 13.8103 0.191751 13.0044V11.2414H0.836485V12.9842C0.836485 13.273 0.870065 13.5349 0.937225 13.77C1.0111 14.0051 1.12191 14.2065 1.26967 14.3744C1.42413 14.549 1.61554 14.6834 1.84388 14.7774C2.07223 14.8714 2.34758 14.9184 2.66995 14.9184H3.1132C3.42885 14.9184 3.70421 14.8647 3.93927 14.7572C4.17433 14.6565 4.36909 14.5188 4.52356 14.3442C4.68474 14.1696 4.80227 13.9648 4.87615 13.7297C4.95674 13.4946 4.99703 13.2495 4.99703 12.9943V10.2844H5.64177V12.9641ZM3.21394 10.0628H2.36773V9.32738H3.21394V10.0628ZM8.24526 13.1656C8.07064 13.1656 7.90274 13.1421 7.74156 13.095C7.58038 13.0413 7.43598 12.954 7.30838 12.8331C7.18749 12.7122 7.09011 12.5544 7.01624 12.3596C6.94236 12.1582 6.90542 11.9097 6.90542 11.6142V6.9197H7.56023V11.4933C7.56023 11.7754 7.62067 12.0104 7.74156 12.1985C7.86916 12.3798 8.074 12.4705 8.35607 12.4705H8.52733C8.67508 12.4705 8.74896 12.5846 8.74896 12.813C8.74896 13.048 8.67508 13.1656 8.52733 13.1656H8.24526ZM8.69324 12.4705C8.95516 12.4705 9.15328 12.4067 9.2876 12.279C9.42192 12.1514 9.48908 11.9802 9.48908 11.7653V11.3825C9.48908 10.7982 9.63683 10.3415 9.93233 10.0124C10.2346 9.68332 10.6509 9.51878 11.1815 9.51878C11.4569 9.51878 11.6986 9.56243 11.9068 9.64974C12.115 9.73705 12.2863 9.8613 12.4206 10.0225C12.5616 10.1837 12.6657 10.3751 12.7329 10.5967C12.8001 10.8183 12.8336 11.0635 12.8336 11.3321C12.8336 11.9097 12.6825 12.3596 12.3803 12.682C12.0781 13.0044 11.6651 13.1656 11.1412 13.1656C10.8726 13.1656 10.614 13.1152 10.3655 13.0144C10.117 12.907 9.92226 12.7189 9.78123 12.4503C9.72078 12.6048 9.64691 12.729 9.5596 12.823C9.47229 12.9171 9.38162 12.9909 9.2876 13.0447C9.19358 13.0917 9.09284 13.1253 8.98538 13.1454C8.88464 13.1588 8.78726 13.1656 8.69324 13.1656H8.53205C8.44475 13.1656 8.38766 13.1387 8.3608 13.085C8.32722 13.0312 8.31043 12.9473 8.31043 12.8331C8.31043 12.7122 8.32722 12.6216 8.3608 12.5611C8.38766 12.5007 8.44475 12.4705 8.53205 12.4705H8.69324ZM12.1889 11.3925C12.1889 11.0433 12.1117 10.7612 11.9572 10.5463C11.8027 10.3247 11.5375 10.2139 11.1614 10.2139C10.4629 10.2139 10.1137 10.6202 10.1137 11.4328C10.1137 11.7754 10.2077 12.0339 10.3957 12.2085C10.5905 12.3831 10.839 12.4705 11.1412 12.4705C11.4837 12.4705 11.7423 12.3764 11.9169 12.1884C12.0982 12.0003 12.1889 11.7351 12.1889 11.3925Z\"/>",
  clipboardCopy: "<g fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5'><path d='M16 4C18.175 4.014 19.353 4.11 20.121 4.879C21 5.758 21 7.172 21 10V16C21 18.829 21 20.243 20.121 21.121C19.243 22 17.828 22 15 22H9C6.172 22 4.757 22 3.879 21.121C3 20.243 3 18.829 3 16V10C3 7.172 3 5.758 3.879 4.879C4.647 4.11 5.825 4.014 8 4'/><path d='M9.5 6H14.5C15.328 6 16 5.328 16 4.5V3.5C16 2.672 15.328 2 14.5 2H9.5C8.672 2 8 2.672 8 3.5V4.5C8 5.328 8.672 6 9.5 6Z'/><path stroke-linejoin='round' d='M15 14H9M11.5 11.5L9 14L11.5 16.5'/></g>",
  check: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M5 12.5L10 17.5L20 7.5\"/></g>",
  tag: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M2.85574 7.39057L2.57231 8.61875C2.08083 10.7485 1.83509 11.8134 2.12264 12.816C2.41018 13.8186 3.18295 14.5914 4.72848 16.1369L6.55812 17.9665C9.24711 20.6555 10.5916 22 12.2623 22C13.933 22 15.2775 20.6555 17.9665 17.9665C20.6555 15.2775 22 13.933 22 12.2623C22 10.5916 20.6555 9.24711 17.9665 6.55812L16.1369 4.72848C14.5914 3.18295 13.8186 2.41018 12.816 2.12264C11.8134 1.83509 10.7485 2.08083 8.61875 2.57231L7.39057 2.85574C5.59881 3.26922 4.70292 3.47597 4.08944 4.08944C3.47597 4.70292 3.26922 5.59881 2.85574 7.39057Z\"/><circle cx=\"8.607\" cy=\"8.879\" r=\"2\"/><path d=\"M11.5413 18.4998L18.5203 11.5205\"/></g>",
  pen: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M13.5 6.5L17.5 10.5\"/><path d=\"M4.5 19.5L8.4 18.7L19.6 7.5C20.4 6.7 20.4 5.3 19.6 4.5C18.8 3.7 17.4 3.7 16.6 4.5L5.3 15.7L4.5 19.5Z\"/><path d=\"M4 22H20\"/></g>",
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
  target: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z\"/><path d=\"M2 12L5 12\"/><path d=\"M19 12L22 12\"/><path d=\"M12 22L12 19\"/><path d=\"M12 5L12 2\"/><path stroke-linejoin=\"round\" d=\"M10 12H12H14\"/><path stroke-linejoin=\"round\" d=\"M12 14L12 12L12 10\"/></g>",
  global: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 10.6868 2.25866 9.38642 2.76121 8.17316C3.26375 6.95991 4.00035 5.85752 4.92893 4.92893C5.85752 4.00035 6.95991 3.26375 8.17317 2.7612C9.38642 2.25866 10.6868 2 12 2C13.3132 2 14.6136 2.25866 15.8268 2.76121C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12L22 12Z\"/><path d=\"M16 12C16 13.3132 15.8965 14.6136 15.6955 15.8268C15.4945 17.0401 15.1999 18.1425 14.8284 19.0711C14.457 19.9997 14.016 20.7362 13.5307 21.2388C13.0454 21.7413 12.5253 22 12 22C11.4747 22 10.9546 21.7413 10.4693 21.2388C9.98396 20.7362 9.54301 19.9997 9.17157 19.0711C8.80014 18.1425 8.5055 17.0401 8.30448 15.8268C8.10346 14.6136 8 13.3132 8 12C8 10.6868 8.10346 9.38642 8.30448 8.17316C8.5055 6.95991 8.80014 5.85752 9.17157 4.92893C9.54301 4.00035 9.98396 3.26375 10.4693 2.7612C10.9546 2.25866 11.4747 2 12 2C12.5253 2 13.0454 2.25866 13.5307 2.76121C14.016 3.26375 14.457 4.00035 14.8284 4.92893C15.1999 5.85752 15.4945 6.95991 15.6955 8.17317C15.8965 9.38642 16 10.6868 16 12L16 12Z\"/><path d=\"M2 12H22\"/></g>",
  chat: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M22 12C22 17.5228 17.5228 22 12 22C10.4003 22 8.88837 21.6244 7.54753 20.9565C7.19121 20.7791 6.78393 20.72 6.39939 20.8229L4.17335 21.4185C3.20701 21.677 2.32295 20.793 2.58151 19.8267L3.17712 17.6006C3.28001 17.2161 3.22094 16.8088 3.04346 16.4525C2.37562 15.1116 2 13.5997 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z\"/>",
  letter: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"3\"/><path d=\"m3 7 9 6 9-6\"/></g>",
  layers: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M16.2127 10.8085L19.0212 9.68508C21.0071 8.89073 22 8.49355 22 8C22 7.50645 21.0071 7.10927 19.0212 6.31492L16.2127 5.19153C14.2268 4.39718 13.2339 4 12 4C10.7661 4 9.77318 4.39718 7.7873 5.19153L4.97883 6.31492C2.99294 7.10927 2 7.50645 2 8C2 8.49355 2.99294 8.89073 4.97883 9.68508L7.7873 10.8085C9.77318 11.6028 10.7661 12 12 12C13.2339 12 14.2268 11.6028 16.2127 10.8085Z\"/><path d=\"M22 12C22 12 21.0071 12.8907 19.0212 13.6851L16.2127 14.8085C14.2268 15.6028 13.2339 16 12 16C10.7661 16 9.77318 15.6028 7.7873 14.8085L4.97883 13.6851C2.99294 12.8907 2 12 2 12\"/><path d=\"M22 16C22 16 21.0071 16.8907 19.0212 17.6851L16.2127 18.8085C14.2268 19.6028 13.2339 20 12 20C10.7661 20 9.77318 19.6028 7.7873 18.8085L4.97883 17.6851C2.99294 16.8907 2 16 2 16\"/></g>",
  link: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M10.0464 14C8.54044 12.4882 8.67609 9.90087 10.3494 8.22108L15.197 3.35462C16.8703 1.67483 19.4476 1.53865 20.9536 3.05046C22.4596 4.56228 22.3239 7.14956 20.6506 8.82935L18.2268 11.2626\"/><path d=\"M13.9536 10C15.4596 11.5118 15.3239 14.0991 13.6506 15.7789L11.2268 18.2121L8.80299 20.6454C7.12969 22.3252 4.55237 22.4613 3.0464 20.9495C1.54043 19.4377 1.67609 16.8504 3.34939 15.1706L5.77323 12.7373\"/></g>",
  shield: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M21 11.9914C21 11.4234 21 10.8996 21 10.4167C21 7.21907 21 5.62028 20.6225 5.08241C20.245 4.54454 18.7417 4.02996 15.7351 3.00079L15.1623 2.80472C13.595 2.26824 12.8114 2 12 2C11.1886 2 10.405 2.26824 8.83772 2.80472L8.26491 3.00079C5.25832 4.02996 3.75503 4.54454 3.37752 5.08241C3 5.62028 3 7.21907 3 10.4167C3 10.8996 3 11.4234 3 11.9914C3 17.6294 7.23896 20.3655 9.89856 21.5273C10.62 21.8424 10.9807 22 12 22C13.0193 22 13.38 21.8424 14.1014 21.5273C16.761 20.3655 21 17.6294 21 11.9914Z\"/><path stroke-linejoin=\"round\" d=\"M9.5 12.4L10.9286 14L14.5 10\"/></g>",
  close: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M19.0068 5L5.00684 19\"/><path d=\"M19 19L5 5\"/></g>",
  minus: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M20 12L4 12\"/>",
  expand: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path stroke-linejoin=\"round\" d=\"M12 12L17 7M17 10.75V7H13.25\"/><path stroke-linejoin=\"round\" d=\"M12 12L7 17M7 13.25V17H10.75\"/><path d=\"M12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22Z\"/></g>",
  sun: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><circle cx=\"12\" cy=\"12\" r=\"6\"/><path d=\"M12 2V3\"/><path d=\"M12 21V22\"/><path d=\"M22 12L21 12\"/><path d=\"M3 12L2 12\"/><path d=\"M19.0703 4.9292L18.6775 5.32204\"/><path d=\"M5.32227 18.6782L4.92943 19.0711\"/><path d=\"M19.0703 19.0708L18.6775 18.678\"/><path d=\"M5.32227 5.32178L4.92943 4.92894\"/></g>",
  pin: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\" d=\"M2 22L6.65323 17.342M19.0716 8.03562L15.9894 4.9502C13.8823 2.84101 12.8288 1.78641 11.6973 2.03606C10.5657 2.28571 10.0527 3.68593 9.02665 6.48636L8.3322 8.38177C8.05866 9.12835 7.92189 9.50164 7.67582 9.79038C7.56541 9.91994 7.43978 10.0357 7.30167 10.1351C6.99386 10.3567 6.61092 10.4623 5.84504 10.6735C4.11881 11.1494 3.2557 11.3873 2.93045 11.9521C2.78985 12.1962 2.71668 12.4734 2.71846 12.7552C2.72258 13.4071 3.35561 14.0408 4.62169 15.3081L8.73837 19.429C10.0125 20.7044 10.6496 21.3421 11.3052 21.3431C11.5816 21.3435 11.8532 21.2717 12.0933 21.1347C12.6629 20.8096 12.9021 19.9401 13.3806 18.2012C13.5909 17.4366 13.6961 17.0543 13.9169 16.7466C14.0136 16.6119 14.1257 16.489 14.251 16.3805C14.5372 16.1326 14.9081 15.9933 15.6498 15.7146L17.5669 14.9943C20.3364 13.9537 21.7211 13.4335 21.9652 12.3049C22.2092 11.1764 21.1633 10.1295 19.0716 8.03562Z\"/>",
  shop: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M21 22H3\"/><path d=\"M19 22V15\"/><path d=\"M5 22V15\"/><path stroke-linejoin=\"round\" d=\"M7.47214 2H16.5278C17.7306 2 18.332 2 18.8153 2.2987C19.2986 2.5974 19.5676 3.13531 20.1055 4.21114L21.5091 7.75929C21.8334 8.57905 22.1171 9.54525 21.5712 10.2375C21.205 10.7019 20.6373 11 19.9999 11C18.8953 11 17.9999 10.1046 17.9999 9C17.9999 10.1046 17.1045 11 15.9999 11C14.8953 11 13.9999 10.1046 13.9999 9C13.9999 10.1046 13.1045 11 11.9999 11C10.8953 11 9.99991 10.1046 9.99991 9C9.99991 10.1046 9.10448 11 7.99991 11C6.89534 11 5.99991 10.1046 5.99991 9C5.99991 10.1046 5.10448 11 3.99991 11C3.36257 11 2.79489 10.7019 2.42867 10.2375C1.88279 9.54525 2.16652 8.57905 2.49081 7.75929L3.89443 4.21114C4.43234 3.13531 4.7013 2.5974 5.18461 2.2987C5.66791 2 6.26932 2 7.47214 2Z\"/></g>",
  bag: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M3.74132 20.5545C4.94094 22 7.17365 22 11.6391 22H12.3602C16.8257 22 19.0584 22 20.258 20.5545C21.4576 19.1091 21.0461 16.9146 20.2232 12.5257C19.638 9.40452 19.3454 7.84393 18.2345 6.92196C17.1236 6 15.5358 6 12.3602 6H11.6391C8.4635 6 6.87571 6 5.76481 6.92196C4.65392 7.84393 4.3613 9.40452 3.77608 12.5257C2.95316 16.9146 2.5417 19.1091 3.74132 20.5545Z\"/><path d=\"M15 11L16 17M9 6V5C9 3.34315 10.3431 2 12 2C13.6569 2 15 3.34315 15 5V6M9 11L8 17\"/></g>",
  cart: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-width=\"1.5\"><path d=\"M9.6851 21H14.3158C16.5656 21 17.6906 21 18.5044 20.3646C19.3181 19.7292 19.591 18.6379 20.1366 16.4552C20.9946 13.0234 21.4236 11.3075 20.5227 10.1538C19.6219 9 17.8532 9 14.3158 9H9.6851C6.14769 9 4.37899 9 3.47816 10.1538C2.57733 11.3075 3.0063 13.0234 3.86425 16.4552C4.40992 18.6379 4.68275 19.7292 5.49654 20.3646C6.31032 21 7.43525 21 9.6851 21Z\"/><path d=\"M10 5H14C14.5523 5 15 4.55228 15 4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4C9 4.55228 9.44772 5 10 5Z\"/><path stroke-linejoin=\"round\" d=\"M4.5 18L7.5 14.4L12 9M7.5 14.4L4.5 10M7.5 14.4L12 21L16.516 14.3766L19.5 18M16.516 14.3766L12.5 9.5M16.516 14.3766L19.5 10\"/><path d=\"M19.4601 9.39865L18.7892 6.89465C18.5152 5.89005 18.3783 5.38775 18.0974 5.00946C17.8176 4.63273 17.4374 4.34234 17.0003 4.17152C16.5615 4 16.0408 4 14.9996 4M4.53897 9.39861L5.20996 6.89465C5.48389 5.89005 5.62085 5.38775 5.90178 5.00946C6.18156 4.63273 6.56172 4.34234 6.99879 4.17152C7.43765 4 7.95829 4 8.99957 4\"/></g>",
};

// Marketplace marks cached locally; Emalls SVG is from https://emalls.ir/src/icon.svg.
const ProviderLogoData = Object.freeze({
  torob: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAGMklEQVR42rWXbWyVZxnHf9d9P+ecnva0pbxsDAvnrJSutoU5XgbKlLgF48xAY1CXzMhEYzRzm9P4Rc3iNLovZM5Es2VbYoguUYyabJGpS0aGmUYZCy+FgZTSUnBgrXQ9fTnnPM99XX7oaQWkY2Pl/vK83///fb38//cD13h8/Yfr7vnao++/fabn0TuZzDZsiAZP/mdFCVaKyLIEXahGSpCJlHDa4KhF7mD+xIHD9/9g3YZMyj3mRFaWJ5K/m7FOBLsqAmfyXe0ifutA//lPmKO9VjwioCYACCAiRMD4WHz08ftWPXAykt86JBcSRVUXXA78igR6WlZcl1MeVmxbnZPsmBoTZgxbggAOMECrxznO41SeP7Q0/dn56nNjIzHOObyX8s8P3Nqcra/zY6XR0a0de4euSOBf+eV3auAJ8ZI/q4FiSChjJIAHMuKoFaEeRy2CM3AKQ/PdgKh+pDQOURoWd0HDdVGLGYfGRyqZbG22+Gz3+u/f0/XKT2Yk8MaSFV8Ycvr0kAU5FwIBA4SsCGlxjGqwUQt9g2pnDeJakexcc4uXufTCTIWFGiSJUtC23pObB0lMGiRtBplanx0fS26ZMQKHCp2f65PwzDkLVEzxCFlx1IijpOFwTNhRJ/qnSrnh+OY39o1PffdQc/PczdJw67KipPyIzi+sr1mVm5dQmZguYUSgXApY1v166q5cCP7ijW1rgrlXypBKbLJm6pwjUXvTG99esKDuqdX79sVXKtoHH1xbWH539Of574mai+cTVCGKhJqmiJHRyo7Pt//l3v8jsKu1NVOJ/b6s852jGgDIOU+iekwDWzadPtr9Tlr2V8fXtVpIPRrHekc5jUmD9GVi+d0dHxpuKsdaWzhz+CsXEXgu3/ZQzqceGw4JADXiUKxPXWXD5t7eU1crRC+8sLZww474iw2vB0n3JWuiBr9RI4hF1+R7u18VgN0LOnLDtcmxtPhFZVP8ZE/Hwdiwuf/oX9+tGp5r7Hxkzpz0w4MSGDelyUUUNflNS3/3FgcwUqub6l20qGw6mXdxBOPJ2QAHePnNw9/7J8lBqca7qAGQTb2FW/IOQNFPTsmUF2Fcw1jWu+2z5QefhiCm21PVjCcYDd6nPfFHHYCYrJlafY04DHtpY++RU7NpSo0SPT+i4d/pahjUjGB2m9u1uHWpwcKkGgIPCG73bLtiU/+BYTH21ogDIJ4UtxZXcn6jc5IxDAFiM9Lo69fCmgWO+eq5GgSzbGTGMi8QquYSYxhu+JoQEBm8yN4RcU4YsukbkyREyFyb7YllL7nGGcnuxEwdk4adFodA4ZrAIzdeuCnwQuK6UvKawJCX/2lzUFs72+A7+ZRXs5XlqsekRHDIWdfW01MGjky1R8UMsDt3tbbOahpWF46tTjlpn2r3lAgg+xyAQ/6QqhIom1Lro0Ko+C2zSUDN7s+KE61GeUIVsD9OErCwczSEiq+SiM1AeGT/9SvqZgP89JLOD9QIdxdVpy2+ZOFgob/7bw7grlPHexV25pzHgJIpWeeX9tWUfvpuwU81d8xVcT8TEZ9U96UZcXjcjwTUTb2YToXvjmuYSIkgVcOoc9HW3y9pv+uqV76ofZ55/1yNc22j1dU3Os9wSF4r9M/9BdW2B+BjPT0nNOi3cs4jVU0QIBG992rAz7SsuI10ak/WufXnNSBARoSKaUgF+7LwcnIRAYCPD/zj8WKIn2300bRe6wWacKJlVePgTTfVvxXw4JLlqwbyXU9X1PaISMcUeCRCThzlYF9dcvrw3hk3peW6aJsfC/VNPtocmxHg6GD+5g9XxL5ZCeWbiyGlJ/NdR4D9ItLj1SaCc3PVtA1sbRFbXe88I6qMVlsuLUKdOIqq32kd6H7yEn+4vGjk8gd/HHl/37zAoSZcZ855NzE9oSOqpmkqVQJUMCbU0At+ghqdJzYrB+yBfN+hpy5jUDOPlwrv/Uwrqe2NzjePaKBkevn/q0uGA+qcJwLKanuC6jfyA92vzuCQbz1OtKxqrNXKlxLY5sW1TxaSkZhNr37KxFIiRCIUNRCJ7PHKEzf0H/zlFSz6bRpJR0f6XMl/MFG5PWDvS8wWBrPpGopESh7pF2FvxtyL1/cf2P925v0vfaHEIxHajwAAAAAASUVORK5CYII=",
  emalls: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzMiIHZpZXdCb3g9IjAgMCAzMCAzMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4NCjxwYXRoIG9wYWNpdHk9IjAuOTg4IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTguMjUwODkgMC4yNTU0OTNIMjYuMzAxNkMyNy44NTUzIDAuMjU1NDkzIDI5LjExMTkgMS41MTIxMSAyOS4xMTE5IDMuMDY1ODVWNS45MjU3NEMyOS4xMTE5IDcuNDc5NDggMjcuODU1MyA4LjczNjEgMjYuMzAxNiA4LjczNjFIMy4yMzY4MkMxLjc2MzU0IDguNzM2MSAwLjczNTk2NSA3LjI4MTQgMS4yMjQ5OSA1Ljg4ODZDMS44NzQ5NyA0LjAxOTE1IDMuMTI1MzkgMi41MDI1NCA0Ljk3MDA4IDEuMzM4NzhDNS45OTc2NSAwLjc0NDUyMSA3LjA4NzEzIDAuMzg1NDg4IDguMjUwODkgMC4yNTU0OTNaIiBmaWxsPSIjRkQ1NjRBIi8+DQo8cGF0aCBvcGFjaXR5PSIwLjk5NiIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zLjU3MTM1IDExLjk1NUgxOC44MTE3QzIwLjM2NTQgMTEuOTU1IDIxLjYyMiAxMy4yMTE2IDIxLjYyMiAxNC43NjU0VjE3LjU2MzRDMjEuNjIyIDE5LjExNzEgMjAuMzY1NCAyMC4zNzM3IDE4LjgxMTcgMjAuMzczN0gzLjU3MTM1QzIuMDE3NiAyMC4zNzM3IDAuNzYwOTg2IDE5LjExNzEgMC43NjA5ODYgMTcuNTYzNFYxNC43NjU0QzAuNzYwOTg2IDEzLjIxMTYgMi4wMTc2IDExLjk1NSAzLjU3MTM1IDExLjk1NVoiIGZpbGw9IiNGRDU2NEEiLz4NCjxwYXRoIG9wYWNpdHk9IjAuOTg2IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTYuMDIzIDIzLjU5MjZIMjYuMzAyMkMyNy44NTU5IDIzLjU5MjYgMjkuMTEyNSAyNC44NDkyIDI5LjExMjUgMjYuNDAyOVYyOS4yNjI4QzI5LjExMjUgMzAuODE2NSAyNy44NTU5IDMyLjA3MzIgMjYuMzAyMiAzMi4wNzMyQzIwLjc2MTkgMzIuMDc5MyAxNS4yMTU1IDMyLjA2NyA5LjY3NTIzIDMyLjAzNkM1LjYwMjA2IDMyLjA5MTcgMi43ODU1MSAzMC4yNDA5IDEuMjI1NTcgMjYuNDk1OEMxLjIxOTM4IDI2LjQ4OTYgMS4yMTkzOSAyNi40NzcyIDEuMjEzMiAyNi40NzFDMC42ODA4MzcgMjUuMDc4MiAxLjcyNjk4IDIzLjU4NjQgMy4yMTI2MyAyMy41ODY0SDYuMDIzVjIzLjU5MjZaIiBmaWxsPSIjRkQ1NjRBIi8+DQo8L3N2Zz4=",
  basalam: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADvElEQVR42sWXT2wbRRjFfzu768Q2jruOHXCLkAW0RCQFGhUXOBGLqBfEXympRDlUgBAS5MApRYQCPTQXKhSBKLRwQCBapVI4pEWVwBWIRgVUrEKqtolAQUDNXxmTNnHteJdDJk5MdtdrE+CdRjvfznvzzcw3bxQ8IpsywsDdQDewCUgAYdmdB6aBDHAcGIunc3kv4yoeiDcAO4E+wO9R7xxwEBiKp3OTDQnIpowAsBvoBzQawzwwDAzG07lZzwKyKWM9MAp0sDo4A9wfT+emagrIpowu4BgQZXXxG7A1ns59ufyjsJn5CnKlOYCi+7zRCIEIR+x6osAxybFSgFzz0b+Tq21XE3vva6JvnUS0RGryr3lmP22HJ/H39DmJGJVcKzKw227Nm7sfQLQYqGsTBO7Z4T75kEHznfeBEFzxyLNOYR2Sa0mAPGr9trs02FJpa9dtdD/TgSAoC9tKja1DhAyn0H7JWcnAgNNRm586XWmbM7mqPv36jVUCy79ewMz9AoBVKmIVLjkJ0GRtQcgKt80psjD+AcXMJ1iFWeaOvF35Hnr8BVpf/5jogRMogZBUaDKz7zmYLzH7/n6sUtEtYX3ZlBFWsinjIeAd99wqKHoTVrFQ+dT6Whp9wy0A/LHrYQqfHlkK1321yBexXcja7g7LqiIHKJ3PLC1F523V4d7IAbqFvFjqRmnis0rb17ml0eK0SchbrW4UzywJ0NbfjNLkb2SYhFh2pdaFcvY7zN9/WlhzTUdv72pkmLBoKHGqhhpby/z3U/94GTRpJiJefwg9totg71MgqrXrHQ0JyAvpZDwjcO+jK8gXBCRBqTuh00LaKM+4+O5LWMXLmBfzlC9MUzqf4fIXaYqff4hoMeoVkPFWiP49bBfAmPRwqwKxJkb0zXHaRs6i39BVyzeOCeleD60GuaL7CO/ch5ZoR0SuxN/T6xZ+MJ7O5Rd3zR5pIN2PTKKdpuRdtptNveoajKHDNG2Wld0sM/fRiJtZHVo8hsTTuclsyhgGnnb6Q7/xVlpfPgqqSvnHbymcOEo5O43iD+Lr3IIv2YOi6ZX4mTeep3T2lNNww4t2fbkHGAS2OjlhYcRAVRdmu+5agr1P2g9tmswceJFLI6+6OeRBW1csDeO4rSNWFIIPPkGwrx8RabPP6zcT/PnKAMWvxt2c8R3L7Xn9tlzT8d10O3r7ZtRoHMwy5Z9/oHTuFMWJk2BZddny//1hYls7ZWAS2OvldNR4mu0Fknbk9TxOB6RvrOdxegjY0/Dj9L96nv8FWAEu9vkyA6MAAAAASUVORK5CYII=",
  snappshop: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABe0lEQVR42mPcwrDuP8MAAiaGAQajDhh1AAtFrmdnYnB7683AzI0w5vG8hwyXks/RJwQErYVRLGdgYGB4vesl/aJA1E0Mhf//33+GN3tf088BIq6oDvh47gPD7ze/6OMANlE2Bj4DfhSxN7tf0S8XiLiIMTAyMaLFPz0dgBb8f778Yfhw7B2dHMDIwCCK5oB3B98w/Pv1jz4O4NHiZeCQ4UQNfjLin2wHoPue3ARItgPQ4//r7S8MX65/po8DmNiZGITtReD8X29/QYre/3SqCxiZGBlOehyDlHx//jN8vvSR4e+3v/SrjP5+/8vw/sjbgasNJYKkGJQr1BjYRNkZ3u59xXC9/CrD77e/6OMAUQ8xBqPVZvASkCtZgYFHk5fhmM0hstMASYlQLlURo/gVtBJm4NXlo0+LiJEVu3ImVib6OODp0kcYYp+vfGL4dOEjfRzwfOVThis5Fxl+PP7O8O/nP4ZXW18wnPY5zvD/L/l9G8bRntGoA0a8AwD4cHddERDDRQAAAABJRU5ErkJggg=="
});


// ---- 13-ui.js ----
/* ===== UI: ONE Shadow-DOM panel. Reads only from App.state. ===== */
const UI = (() => {
  const HOST_ID = 'ghafel-pro-host';
  const ICONS = SolarIcons;
  const CSS = `
:host{all:initial;direction:rtl;font-family:Vazirmatn,"Noto Sans Arabic",Tahoma,system-ui,"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.55;position:fixed;z-index:2147483646}
*{box-sizing:border-box;font-family:inherit}
.dark{--bg:#0e1014;--panel:#15181e;--card:#1d222a;--ink:#f3f4f6;--mut:#a7abb4;--acc:#d4aa45;--acc2:#f0c65a;--on-acc:#15171b;--warn:#edbd58;--bad:#ed7777;--good:#78c99a;--good-soft:rgba(120,201,154,.1);--warn-soft:rgba(237,189,88,.11);--line:#343943;--shadow:0 16px 46px rgba(0,0,0,.52);--chart-official:#9a8ef0;--chart-label:#a7abb4;--chart-local:#f0c65a;--chart-min:#78c99a;--scroll-thumb:rgba(167,171,180,.48);--scroll-hover:rgba(240,198,90,.78)}
.light{--bg:#fbf8ef;--panel:#fff;--card:#f7efd8;--ink:#201c10;--mut:#8a7a4e;--acc:#b8860b;--acc2:#8a6d00;--on-acc:#fff;--warn:#b45309;--warn-soft:rgba(180,83,9,.1);--bad:#dc2626;--good:#16804a;--good-soft:rgba(22,128,74,.1);--line:#e8dcb5;--shadow:0 12px 40px rgba(120,96,20,.22);--chart-official:#8b5cf6;--chart-label:#a9a6d6;--chart-local:#fbbf24;--chart-min:#34d399;--scroll-thumb:rgba(138,122,78,.42);--scroll-hover:rgba(184,134,11,.72)}
.wrap{color:var(--ink)}
#pill{all:unset;cursor:pointer;display:inline-flex;gap:7px;align-items:center;padding:9px 16px;border-radius:999px;background:linear-gradient(135deg,#1a1a1a,#000);border:1px solid #d4af37;color:#f1c94e;font-weight:700;box-shadow:var(--shadow);user-select:none;font-family:inherit;font-size:13px}
.icon{display:inline-block;width:16px;height:16px;flex:0 0 auto;vertical-align:middle}.icon-sm{width:14px;height:14px}
.brand-logo{object-fit:contain;border-radius:4px;background:#fff}
#pill:hover{filter:brightness(1.1)}
#panel{position:relative;display:none;width:min(420px,calc(100vw - 20px));height:84vh;max-height:84vh;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}
#panel.open{display:flex}
#panel.wide{width:min(560px,calc(100vw - 20px))}
header,.hero{flex-shrink:0}
.tb{width:100%;border-collapse:collapse;font-size:12px}.tb td{padding:5px 3px;border-bottom:1px solid var(--line);vertical-align:middle}.tb th{padding:4px 3px;color:var(--mut);font-size:10px;font-weight:600;text-align:right;border-bottom:1px solid var(--line)}.tb tr.best td{background:rgba(52,211,153,.08)}.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:4px}.dot.high{background:var(--acc2)}.dot.medium{background:var(--warn)}.dot.low{background:var(--bad)}
input[type=text]{min-width:0}#q{flex:1}
.tabs{position:relative;z-index:2;background:var(--panel)}
.body{min-height:0;overscroll-behavior:contain;position:relative}
#panel.compact .meta{display:none}#panel.compact .price{font-size:16px;margin:0}#panel.compact .name{-webkit-line-clamp:1;font-size:12px}#panel.compact .hero{padding:6px 14px}
#pill{touch-action:none}header{touch-action:none}
header{cursor:move;padding:12px 14px 10px;background:linear-gradient(135deg,rgba(212,175,55,.18),rgba(0,0,0,.25));border-bottom:1px solid var(--line);position:relative}
.brand{font-weight:800;font-size:15px;letter-spacing:.2px}.brand b{color:var(--acc2)}
.x{all:unset;cursor:pointer;position:absolute;left:10px;top:10px;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;color:var(--mut)}.x .icon{width:15px;height:15px}.x:hover{background:var(--card);color:var(--ink)}
.x2{left:40px}.x3{left:70px}
.hero{padding:10px 14px;border-bottom:1px solid var(--line)}
.hero-main{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;direction:rtl}
.name{font-weight:700;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hero-main .name{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.hero-main .price{flex:0 0 auto;max-width:44%;margin:0;text-align:left;white-space:nowrap}
.price{font-size:24px;font-weight:800;color:var(--acc2);margin:2px 0}.price small{font-size:12px;color:var(--mut);font-weight:400}
.meta{font-size:11px;color:var(--mut)}.meta s{opacity:.8}
.workspace{display:flex;flex:1 1 auto;min-height:0;flex-direction:column;overflow:hidden}
.tabs{position:relative;z-index:2;display:flex;flex:0 0 60px;flex-direction:row;width:100%;min-height:60px;align-items:center;gap:8px;padding:8px 10px;overflow:hidden;border-bottom:1px solid var(--line);background:var(--panel);isolation:isolate}
.tab-main{direction:rtl;display:grid;flex:1 1 0;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:4px;min-width:0;height:44px}
.tab-indicator{position:absolute;z-index:1;left:0;top:10px;width:0;height:40px;border-radius:999px;background:linear-gradient(145deg,var(--acc2),var(--acc));box-shadow:0 4px 12px color-mix(in srgb,var(--acc) 20%,transparent);pointer-events:none;transform:translateZ(0);transform-origin:0 0;will-change:transform}
.tab{all:unset;box-sizing:border-box;position:relative;z-index:2;cursor:pointer;display:inline-flex;flex:1 1 0;align-items:center;justify-content:center;width:auto;min-width:0;height:44px;padding:4px 5px;overflow:hidden;border-radius:12px;color:var(--mut);font-size:11px;font-family:inherit;transition:color .18s ease,flex-grow .28s cubic-bezier(.22,1,.36,1)}
.tab:focus-visible{outline:2px solid var(--acc2);outline-offset:1px}
.tab-icon{position:absolute;left:50%;top:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;width:22px;height:22px;line-height:0;transform:translate(-50%,-50%);transition:opacity .18s ease,transform .28s cubic-bezier(.22,1,.36,1),visibility 0s linear 0s;}
.tab-icon .icon{display:block;width:18px;height:18px}
.tab-label{position:absolute;top:50%;left:50%;width:calc(100% - 6px);overflow:hidden;text-align:center;white-space:normal;overflow-wrap:anywhere;line-height:1.2;opacity:0;transform:translate(-50%,-50%) scale(.96);pointer-events:none;transition:opacity .16s ease,transform .24s cubic-bezier(.22,1,.36,1)}
.tab.on{flex:1 1 0;min-width:0;padding-inline:5px;background:transparent;color:var(--on-acc);font-weight:800}
.tab.on .tab-icon{visibility:hidden;opacity:0;transform:translate(-50%,-50%) scale(.72);transition-delay:0s,0s,.18s}
.tab.on .tab-label{position:static;top:auto;left:auto;width:100%;max-width:100%;flex:0 1 auto;overflow:visible;text-overflow:clip;opacity:1;transform:none}
.tab-indicator{transition:none}
.diagnostics-option{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0}
.diagnostics-option-copy{display:flex;align-items:center;gap:10px;min-width:0}
.diagnostics-option-copy>.icon{flex:0 0 20px;width:20px;height:20px;color:var(--acc2)}
.diagnostics-option-copy b,.diagnostics-option-copy small{display:block}
.diagnostics-option-copy b{font-size:11.5px}
.diagnostics-option-copy small{margin-top:3px;color:var(--mut);font-size:10px;line-height:1.5}
.diagnostics-option .btn{flex:0 0 auto}
.body{direction:rtl;min-width:0;padding:12px 14px;overflow-y:auto;flex:1 1 auto;scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) var(--panel);scrollbar-gutter:stable;overscroll-behavior:contain}
.body-content{position:relative;z-index:1;min-height:100%;transform-origin:center;will-change:opacity,transform}
.tab-morph-overlay{position:absolute;z-index:4;pointer-events:none;transform-origin:0 0;border:1px solid color-mix(in srgb,var(--acc2) 70%,var(--line));background:var(--acc2);box-shadow:0 8px 28px color-mix(in srgb,var(--acc) 24%,transparent);will-change:transform,border-radius,background-color,opacity}
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
.btn.icon-only{width:40px;height:40px;padding:0;flex:0 0 40px}
.btns{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
.compare-actions{display:flex;align-items:center;gap:8px;margin:4px 0 10px}
.compare-actions .primary-action{display:flex;align-items:center;justify-content:center;gap:7px;flex:1;min-height:40px}
.manual-search{display:flex;align-items:center;gap:6px;margin-bottom:9px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.manual-search input[type=text]{flex:1;min-width:0;height:36px;padding:5px 9px;border:0;background:transparent;box-shadow:none}
.manual-search .btn{width:38px;height:38px;padding:0;flex:0 0 38px}
.source-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.source-chip{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);color:var(--mut);font-size:10.5px;line-height:1.4;cursor:pointer;transition:color .16s ease,border-color .16s ease,background-color .16s ease,opacity .16s ease}
.source-chip .icon{width:14px;height:14px}
.source-chip-icon{display:grid;place-items:center;flex:0 0 16px;width:16px;height:16px;color:var(--acc2)}
.source-chip.good{color:var(--good)}.source-chip.warn{color:var(--warn)}.source-chip.bad{color:var(--bad)}
.source-chip:hover,.source-chip:focus-visible{border-color:var(--acc2);color:var(--ink)}
.source-chip:focus-visible,.source-filter-reset:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
.source-chip.filter-selected{border-color:var(--acc2);background:var(--warn-soft);color:var(--ink);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc2) 24%,transparent)}
.source-chip.filter-excluded{opacity:.48}
.source-filter-reset{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--line);border-radius:999px;color:var(--mut);font-size:10px;cursor:pointer}
.source-filter-reset:hover{border-color:var(--acc2);color:var(--ink)}.source-filter-reset .icon{width:13px;height:13px}
.empty-state{display:grid;grid-template-columns:36px minmax(0,1fr);align-items:start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-block-end:10px}
.body-content > .card + .card,.body-content > .card + .empty-state,.body-content > .empty-state + .card,.body-content > .empty-state + .empty-state{margin-block-start:12px}
.empty-state-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;color:var(--warn);background:var(--warn-soft)}
.empty-state-copy{min-width:0}
.empty-state-copy b{display:block;margin:0 0 3px;color:var(--ink);font-size:12px}
.empty-state-copy p{margin:0;color:var(--mut);font-size:11px;line-height:1.55}
.empty-state-action{grid-column:2;justify-self:start;margin-top:2px}
.history-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 10px}
.history-ranges{display:flex;align-items:center;gap:4px}
.history-ranges .btn{padding:6px 9px}
.history-status{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-bottom:10px}
.history-status-icon{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:11px;color:var(--warn);background:var(--warn-soft)}
.history-status-copy{flex:1;min-width:0}
.history-status-copy b{display:block;color:var(--ink);font-size:12px}
.history-status-copy p{margin:3px 0 0;color:var(--mut);font-size:11px;line-height:1.5}
.history-countdown{flex:0 0 auto;text-align:center;color:var(--warn);font-size:16px;font-variant-numeric:tabular-nums}
.history-countdown small{display:block;color:var(--mut);font-size:9px;font-weight:500}
.history-cache-label{margin-top:4px}
.rejected-results{margin:12px 0;padding:10px 12px}
.rejected-results summary{display:flex;align-items:center;gap:8px;list-style:none;cursor:pointer;color:var(--mut);font-size:11px}
.rejected-results summary::-webkit-details-marker{display:none}
.rejected-results summary>.icon{width:16px;height:16px;color:var(--acc2)}
.rejected-results summary b{flex:1;color:var(--ink);font-size:11.5px}
.rejected-results summary small{font-size:10px}
.rejected-results summary:after{content:"";width:7px;height:7px;border-left:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .18s ease}
.rejected-results[open] summary:after{transform:rotate(135deg)}
.rejected-provider{padding-top:9px;margin-top:9px;border-top:1px solid var(--line)}
.rejected-provider-title{display:flex;align-items:center;gap:6px;color:var(--ink);font-size:10.5px;font-weight:700}
.rejected-provider-title>.icon,.rejected-provider-title .brand-logo{width:15px;height:15px}
.rejected-provider ul{margin-top:4px;color:var(--mut);font-size:10.5px}
.watch-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0;padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(135deg,var(--warn-soft),var(--card))}
.watch-layout{display:grid;gap:12px}
.watch-layout>*{margin:0!important}
.watch-head-copy{display:flex;align-items:center;gap:9px;min-width:0}
.watch-head-icon{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border-radius:10px;background:var(--warn-soft);color:var(--acc2)}
.watch-head-copy b{display:block;color:var(--ink);font-size:12px}
.watch-head-copy small{display:block;margin-top:1px;color:var(--mut);font-size:10px}
.watch-count{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;padding:0 7px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--mut);font-size:10px;font-variant-numeric:tabular-nums}
.watch-current{padding:10px 11px;margin-bottom:10px}
.watch-current-top,.watch-item-top,.watch-item-bottom{display:flex;align-items:center;justify-content:space-between;gap:9px}
.watch-current-top .switch-row{flex:0 0 auto;min-height:38px;padding:0;border:0}
.watch-current-name{margin:7px 0 5px;font-size:11.5px;font-weight:700;line-height:1.5}
.watch-current-price{display:flex;align-items:baseline;gap:6px;color:var(--mut);font-size:10px}
.watch-current-price b{color:var(--acc2);font-size:15px;font-variant-numeric:tabular-nums}
.watch-target-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}
.watch-target-row label{color:var(--mut);font-size:10.5px}
.watch-target-controls{display:flex;align-items:center;gap:6px}
.watch-target-controls input{width:122px!important;height:34px;text-align:center;direction:ltr;font-variant-numeric:tabular-nums}
.watch-target-controls button{flex:0 0 38px;width:38px;height:34px;padding:0;color:var(--on-acc)}
.watch-list-title{display:flex;align-items:center;justify-content:space-between;margin:12px 2px 7px;font-size:12px;font-weight:700}
.watch-list-title small{color:var(--mut);font-size:10px;font-weight:500}
.watch-list{display:grid;gap:12px;margin-top:0}
.watch-item{margin:0;padding:10px 11px;border-radius:12px}
.watch-item.current{border-color:color-mix(in srgb,var(--acc2) 72%,var(--line))}
.watch-item-copy{min-width:0;flex:1}
.watch-item-copy b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.5}
.watch-item-copy span{display:block;margin-top:2px;color:var(--mut);font-size:10px}
.watch-item-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.watch-item-actions .btn.icon-only{width:34px;height:34px;flex-basis:34px}
.watch-item-bottom{margin-top:9px;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:7px 12px}
.watch-item-price{color:var(--acc2);font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.money{display:inline-flex;align-items:center;gap:3px;direction:rtl;vertical-align:middle;white-space:nowrap}
.money .currency-symbol{display:block;flex:0 0 var(--money-icon-size,16px);width:var(--money-icon-size,16px);height:var(--money-icon-size,16px);color:currentColor}
.offer-info{display:inline-block;min-width:0}
.offer-info>summary{display:inline-flex;align-items:center;gap:4px;list-style:none;cursor:pointer}
.offer-info>summary::-webkit-details-marker{display:none}
.offer-info>summary .icon{width:13px;height:13px}
.offer-info-body{display:block;margin:5px 0 2px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--mut);font-size:10px;line-height:1.55;overflow-wrap:anywhere}
.offer-info-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:4px}
.offer-info[open]{flex:1 1 100%}
.match-score{font-variant-numeric:tabular-nums;direction:rtl}
.watch-item-target{display:inline-flex;align-items:center;gap:4px;color:var(--mut);font-size:10px;white-space:nowrap}
.watch-item-target b{color:var(--ink);font-size:11px;font-variant-numeric:tabular-nums}
.watch-item-state{display:inline-flex;align-items:center;gap:4px;margin-right:auto;padding:3px 7px;border:1px solid var(--line);border-radius:999px;font-size:9.5px;white-space:nowrap}
.watch-item-state.good{color:var(--good)}
.watch-item-state.warn{color:var(--warn)}
.watch-empty{margin-top:8px}
.collection-manager{padding:11px 12px;margin:0 0 12px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.collection-manager-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.collection-manager-title{display:flex;align-items:center;gap:8px;min-width:0}
.collection-manager-title>.icon{width:18px;height:18px;color:var(--acc2)}
.collection-manager-title b{display:block;font-size:12px;font-weight:800}
.collection-pills{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;padding:0;overflow:visible}
.collection-pill{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;flex:0 1 auto;max-width:100%;min-height:36px;padding:6px 10px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--mut);font-size:10.5px;cursor:pointer;transition:color .16s ease,border-color .16s ease,background .16s ease}
.collection-pill:hover,.collection-pill[aria-pressed="true"]{color:var(--ink);border-color:var(--acc2);background:var(--warn-soft)}
.collection-pill[aria-pressed="true"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc2) 30%,transparent)}
.collection-pill .icon{width:14px;height:14px;color:var(--acc2)}
.collection-create-form{display:grid;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.collection-create-form[hidden]{display:none!important}
.collection-name-row{display:flex;align-items:center;gap:7px}
.collection-name-row input{flex:1;min-width:0;height:38px}
.collection-icon-label{color:var(--mut);font-size:10.5px}
.collection-icon-picker{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.collection-icon-choice{all:unset;box-sizing:border-box;display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--mut);cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease,transform .16s ease}
.collection-icon-choice .icon{display:block;width:18px;height:18px}
.collection-icon-choice:hover{color:var(--ink);transform:translateY(-1px)}
.collection-icon-choice[aria-pressed="true"]{color:var(--acc2);border-color:var(--acc2);background:var(--warn-soft);box-shadow:0 0 0 2px var(--warn-soft)}
.collection-create-submit{justify-self:start}
.collection-selection-actions{display:flex;align-items:center;gap:6px;margin-top:8px}
.collection-selection-actions .btn{padding:5px 8px;font-size:10px}
.collection-inline-form{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}
.collection-inline-form label{grid-column:1/-1;color:var(--mut);font-size:10px}
.collection-inline-form input{width:100%;min-width:0;height:36px}
.collection-confirm{display:flex;align-items:center;gap:7px;margin-top:8px;padding:8px 9px;border:1px solid color-mix(in srgb,var(--bad) 55%,var(--line));border-radius:10px;color:var(--ink);font-size:10.5px}
.collection-empty{padding:12px;border:1px dashed var(--line);border-radius:11px;color:var(--mut);font-size:10.5px;text-align:center}
.watch-item-collection{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);color:var(--mut);font-size:9.5px}
.watch-item-collection select{width:min(180px,62%);height:30px;padding:4px 7px;font-size:10px}
.settings-section{margin-bottom:13px}
.settings-heading{display:flex;align-items:center;gap:7px;margin:2px 3px 6px;font-size:12px;font-weight:800;color:var(--ink)}
.settings-card{padding:4px 10px}
.setting-input-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:42px;padding:6px 2px;border-top:1px solid var(--line)}
.setting-input-row label{display:flex;align-items:center;gap:7px;color:var(--ink);font-size:11.5px}
.setting-input-row input{width:84px;height:34px}
.setting-note{margin:0 2px 5px}
.switch-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:6px 2px;border-bottom:1px solid var(--line);cursor:pointer}
.switch-row:last-child{border-bottom:0}
.switch-copy{display:flex;align-items:center;gap:8px;min-width:0;color:var(--ink);font-size:11.5px}
.switch-copy>.icon{width:16px;height:16px;color:var(--mut)}
.switch-input{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:0!important;opacity:0!important;overflow:hidden!important}
.switch-track{position:relative;display:block;flex:0 0 40px;width:40px;height:23px;border:1px solid var(--line);border-radius:999px;background:var(--panel);transition:background-color .18s ease,border-color .18s ease}
.switch-track:after{content:"";position:absolute;right:3px;top:3px;width:15px;height:15px;border-radius:50%;background:var(--mut);transition:transform .2s cubic-bezier(.2,.8,.2,1),background-color .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.switch-input:checked+.switch-track{border-color:var(--acc2);background:var(--acc2)}
.switch-input:checked+.switch-track:after{transform:translateX(-16px);background:var(--on-acc)}
.switch-input:focus-visible+.switch-track{outline:2px solid var(--acc2);outline-offset:2px}
.switch-input:disabled+.switch-track{opacity:.45;cursor:not-allowed}
.dark .watch-current{border-color:rgba(240,198,90,.55)}
.setting-hint{display:flex;align-items:center;gap:6px;margin-top:7px;color:var(--mut);font-size:11px}.setting-hint kbd{padding:1px 6px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--ink);font:inherit;direction:ltr}
.chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:10.5px;border:1px solid var(--line);color:var(--mut)}
.chip.good{color:var(--acc2);border-color:var(--acc2)}.chip.warn{color:var(--warn);border-color:var(--warn)}.chip.bad{color:var(--bad);border-color:var(--bad)}
.muted{color:var(--mut);font-size:11.5px}.good{color:var(--acc2)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.offer{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}.offer.best{border-color:var(--acc2);box-shadow:0 0 0 1px var(--acc2) inset}
.offer-top-row,.offer-bottom-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;direction:rtl}
.offer-top-row{align-items:flex-start}.offer-seller-group,.offer-source-score{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
.offer-seller-group{flex:1 1 auto}.offer-seller-group>b{font-size:12px}.offer-diff{font-size:10.5px;white-space:nowrap}
.offer-link{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;border:1px solid var(--line);border-radius:9px;color:var(--acc2);text-decoration:none}
.offer-link .icon{width:16px;height:16px}.offer-price{flex:0 0 auto;text-align:left;font-size:15px;font-weight:800;white-space:nowrap}
.offer-source{display:inline-flex;align-items:center;gap:5px;color:var(--mut);font-size:10px}.offer-source .brand-logo{width:15px;height:15px}
.offer-source-score .match-score{font-size:10px}
.free-search-product-title{padding-block-end:5px;border-bottom:1px solid var(--line);font-size:11px;line-height:1.55;font-weight:700;overflow-wrap:anywhere;color:var(--ink)}
.offer a{color:var(--acc);text-decoration:none;font-size:11px}
.pv{font-weight:800;font-size:15px;white-space:nowrap}
select,input[type=number],input[type=text]{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-family:inherit;font-size:12px}
.select-shell{position:relative;display:inline-flex;min-width:0;align-items:center}
.select-shell:after{content:"";position:absolute;left:11px;top:calc(50% - 3px);width:7px;height:7px;border-left:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);pointer-events:none;color:var(--mut)}
.select-shell select{appearance:none;padding:5px 12px 5px 30px;min-width:116px}
.setting-city-select{flex:0 1 178px}.setting-city-select select{width:100%;min-width:0;height:36px}
.diagnostics-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.diagnostics-copy-group{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.diagnostics-copy-status{min-height:1em;color:var(--good);font-size:10.5px;line-height:1.4}
.diagnostics-copy-status:empty{display:none}.diagnostics-copy-status.bad{color:var(--bad)}
.about-copy p{margin:4px 0 8px;color:var(--mut);font-size:11px;line-height:1.6}
.about-data-layout{display:grid;gap:11px;padding:6px 2px}
.about-data-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.saved-data-section{border-top:1px solid var(--line);padding-top:10px}
.saved-data-heading{display:flex;align-items:center;gap:6px;margin:0 2px 8px;font-size:11.5px;font-weight:800}
.saved-data-heading .icon{width:16px;height:16px;color:var(--acc2)}
.saved-data-actions .btns{margin:0}
.about-repo,.contact-links{display:flex;align-items:center;gap:8px}
.about-repo a,.contact-links a{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--acc2);text-decoration:none}
.about-repo a{display:inline-flex;width:auto;gap:6px;padding:0 10px;font-size:10.5px}
.contact-links a .icon,.about-repo a .icon{width:18px;height:18px}
.switch-copy .brand-logo,.source-chip-icon .brand-logo,.rejected-provider-title .brand-logo{display:block;object-fit:contain;background:#fff;border-radius:4px;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
input[type=number]{width:130px}
label.ck{display:flex;gap:6px;align-items:center;margin:5px 0;font-size:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:7px 9px}.m span{display:block;color:var(--mut);font-size:10.5px}.m b{font-size:13px}
.banner{background:rgba(251,191,36,.12);border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:7px 10px;margin-bottom:9px;font-size:11.5px}
.verdict{border-radius:12px;padding:10px 12px;margin-bottom:9px;font-weight:700;border:1px solid}
.v-confirmed{background:rgba(52,211,153,.1);border-color:var(--acc2);color:var(--acc2)}.v-rise-signal{background:rgba(251,191,36,.1);border-color:var(--warn);color:var(--warn)}.v-insufficient{background:rgba(169,166,214,.08);border-color:var(--line);color:var(--mut)}
ul{margin:4px 0 0;padding:0 16px}li{margin:3px 0}
.log{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;color:var(--mut)}.log .e{color:var(--bad)}.log .w{color:var(--warn)}
svg text{font-family:inherit}
:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
.dark #pill{background:linear-gradient(145deg,#20242c,#0c0e12);border-color:#d4aa45;color:#f0c65a}
.dark header{background:linear-gradient(135deg,rgba(240,198,90,.13),rgba(18,20,25,.12))}
.dark .tab-indicator{background:var(--acc2)}
.dark .tab.on{color:var(--on-acc)}
.dark .btn:not(.sec):not(.bad){background:var(--acc2);color:var(--on-acc)}
.dark .btn.bad{color:#231516}
.dark .good,.dark .chip.good{color:var(--good)}
.dark .chip.good{border-color:var(--good)}
.dark .tb tr.best td{background:var(--good-soft)}
.dark .v-confirmed{background:var(--good-soft);border-color:var(--good);color:var(--good)}
.dark .v-rise-signal{background:var(--warn-soft);border-color:var(--warn);color:var(--warn)}
.dark .v-insufficient{background:rgba(167,171,180,.08);border-color:var(--line);color:var(--mut)}
@media(max-width:380px){.tabs{gap:4px;padding-inline:6px}.tab-main{gap:2px}.tab{font-size:9.5px;padding-inline:1px}.tab.on{padding-inline:1px}.body{padding:10px}.history-toolbar{align-items:flex-start;flex-direction:column}.watch-target-controls input{width:108px!important}.collection-icon-choice{width:34px;height:34px}}
@media(prefers-reduced-motion:reduce){.tab,.tab-icon,.tab-label,.switch-track,.switch-track:after,.collection-pill,.collection-icon-choice{transition:none}}
`;
  let host, root, S;
  const $ = s => root.querySelector(s);
  const ICON_VIEWBOXES = { toman: '0 0 14 16' };
  const icon = (name, size = 16, extraClass = '') => {
    const classes = `icon${extraClass ? ' ' + extraClass : ''}`;
    if (ProviderLogoData[name]) return `<img class="${classes} brand-logo" width="${size}" height="${size}" src="${ProviderLogoData[name]}" alt="" aria-hidden="true">`;
    return `<svg class="${classes}" width="${size}" height="${size}" viewBox="${ICON_VIEWBOXES[name] || '0 0 24 24'}" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  };
  const money = (value, size = 16) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '—';
    const formatted = U.fmt(amount);
    return `<span class="money" role="img" aria-label="${formatted} تومان" style="--money-icon-size:${size}px"><bdi aria-hidden="true">${formatted}</bdi>${icon('toman', size, 'currency-symbol')}</span>`;
  };
  const priceInputDigits = value => U.digits(value).replace(/\D/g, '');
  const formatPriceInputValue = value => {
    const digits = priceInputDigits(value);
    return digits ? U.toFa(digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')) : '';
  };
  function formatPriceTargetInput(input) {
    const raw = input.value, caret = input.selectionStart ?? raw.length;
    const digitsBeforeCaret = priceInputDigits(raw.slice(0, caret)).length;
    input.value = formatPriceInputValue(raw);
    let position = 0, seen = 0;
    while (position < input.value.length && seen < digitsBeforeCaret) {
      if (/\d/.test(U.digits(input.value[position]))) seen++;
      position++;
    }
    input.setSelectionRange(position, position);
  }
  const offerInfoTag = (label, iconName, values) => {
    const items = [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))];
    return items.length ? `<details class="offer-info"><summary class="chip" title="نمایش جزئیات ${label}">${icon(iconName, 13)}${label}</summary><span class="offer-info-body">${items.map(U.esc).join('<br>')}</span></details>` : '';
  };
  const matchPercent = offer => offer?.matchConfidence == null || !Number.isFinite(Number(offer.matchConfidence))
    ? ''
    : `${U.toFa(Math.round(Math.max(0, Math.min(1, Number(offer.matchConfidence))) * 100))}٪`;
  const textWithCurrency = value => U.esc(value).replace(/([\d۰-۹٠-٩][\d۰-۹٠-٩٬,،]*)\s*تومان/g, (_match, raw) => money(Number(U.digits(raw).replace(/\D/g, '')), 14));
  const iconText = (name, text) => `${icon(name)}<span>${text}</span>`;

  const LV = { high: ['تطبیق قوی', 'good'], medium: ['تطبیق احتمالی', 'warn'], low: ['مشکوک', 'bad'] };
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
    return `<svg role="img" aria-label="نمودار تغییر قیمت در بازهٔ انتخابی" viewBox="0 0 ${W} ${H}" width="100%" style="direction:ltr"><title>نمودار تغییر قیمت در بازهٔ انتخابی</title><path d="${d}" fill="none" stroke="var(--chart-official)" stroke-width="2.2" stroke-linejoin="round"/>${dots}
      ${minP ? `<circle cx="${x(minP.t).toFixed(1)}" cy="${y(minP.price).toFixed(1)}" r="4" fill="var(--chart-min)"/>` : ''}
      <text x="${pl}" y="${H - 6}" font-size="9.5" fill="var(--chart-label)">${U.faDate(from)}</text><text x="${W - pr}" y="${H - 6}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.faDate(end)}</text>
      <text x="${W - pr - 12}" y="${pt + 2}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.fmt(mx)}</text><svg x="${W - pr - 8}" y="${pt - 7}" width="8" height="10" viewBox="0 0 14 16" style="color:var(--chart-label)" aria-hidden="true">${ICONS.toman}</svg><text x="${W - pr - 12}" y="${H - pb - 3}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.fmt(mn)}</text><svg x="${W - pr - 8}" y="${H - pb - 12}" width="8" height="10" viewBox="0 0 14 16" style="color:var(--chart-label)" aria-hidden="true">${ICONS.toman}</svg></svg>`;
  }

  // ----- tabs -----
  function switchRow(label, attributes, checked, iconName = '', disabled = false) {
    return `<label class="switch-row"><span class="switch-copy">${iconName ? icon(iconName) : ''}<span>${U.esc(label)}</span></span><input class="switch-input" type="checkbox" role="switch" aria-checked="${checked}" ${attributes} ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="switch-track" aria-hidden="true"></span></label>`;
  }

  function tabCompare() {
    const p = S.product || {}, srcs = S.sources; let h = '';
    const filterIdentity = S.freeSearch ? `search:${S.searchQuery}` : `product:${S.key}`;
    if (sourceFilterIdentity !== filterIdentity) { sourceFilterIdentity = filterIdentity; sourceFilter = null; }
    h += `<div class="compare-actions"><button class="btn primary-action" data-act="compare" ${S.running ? 'disabled' : ''}>${icon('search')}<span>${S.running ? 'در حال جست‌وجو…' : 'مقایسهٔ قیمت‌ها'}</span></button><button class="btn sec icon-btn icon-only" data-act="reread" title="بازخوانی محصول" aria-label="بازخوانی محصول">${icon('refresh')}</button><button class="btn sec icon-btn icon-only" data-act="manual" title="ثبت قیمت دستی" aria-label="ثبت قیمت دستی">${icon('wallet')}</button></div>`;
    h += `<div class="manual-search"><input type="text" id="q" aria-label="جست‌وجوی آزاد در منابع فعال" placeholder="نام هر محصولی را برای دیدن قیمت فروشگاه‌ها جست‌وجو کنید" value="${U.esc(S.manualQuery || '')}"><button class="btn sec icon-btn" data-act="manualSearch" title="جست‌وجوی آزاد در منابع فعال" aria-label="جست‌وجوی آزاد در منابع فعال">${icon('search')}</button></div>`;
    const chips = Object.keys(Sources.registry).map(id => {
      const r = Sources.registry[id], st = srcs[id] || { status: Store.get().settings.sources[id] && r.implemented ? 'idle' : (r.implemented ? 'off' : 'unavailable') };
      const [lbl, cl] = STATUS[st.status] || ['آماده', ''];
      const included = !sourceFilter || sourceFilter.has(id), filterClass = sourceFilter ? (included ? 'filter-selected' : 'filter-excluded') : '';
      const title = [st.error || st.note || r.note, 'برای فیلتر نتیجه‌ها کلیک کنید'].filter(Boolean).join(' · ');
      return `<button type="button" class="source-chip ${cl} source-${U.esc(id)} ${filterClass}" data-source-filter="${U.esc(id)}" aria-pressed="${included}" title="${U.esc(title)}"><span class="source-chip-icon">${icon(r.icon || 'global')}</span><b>${U.esc(r.label)}</b><span>${lbl}${st.count ? ' · ' + U.toFa(st.count) : ''}</span></button>`;
    }).join('');
    h += `<div class="source-row" role="group" aria-label="وضعیت و فیلتر فروشگاه‌ها">${chips}${sourceFilter ? `<button type="button" class="source-filter-reset" data-act="resetSourceFilter" title="نمایش همهٔ فروشگاه‌ها">${iconText('refresh', 'همه')}</button>` : ''}</div>`;
    const showTorob = !sourceFilter || sourceFilter.has('torob'), tr = srcs.torob;
    if (showTorob && !S.freeSearch && tr && tr.candidates && tr.candidates.length > 1) h += `<div class="card"><div class="muted" style="margin-bottom:4px">محصول تطبیق‌یافته در ترب — اگر رنگ/مدل دیگری مدنظر است تغییر دهید</div><select data-sel="cand" style="width:100%">${tr.candidates.map(c => `<option value="${U.esc(c.key)}" ${c.key === tr.chosenKey ? 'selected' : ''}>${U.esc(c.title)}</option>`).join('')}</select></div>`;
    if (showTorob && tr && tr.tried && tr.tried.length > 1) h += `<div class="muted" style="margin-bottom:6px">جست‌وجوی چندمرحله‌ای: ${U.toFa(tr.tried.length)} عبارت امتحان شد؛ عبارت موفق: «${U.esc(tr.query)}»</div>`;
    const sourceErrors = Object.entries(srcs).filter(([id, st]) => (!sourceFilter || sourceFilter.has(id)) && st.error);
    const offers = S.offers.filter(offer => !sourceFilter || sourceFilter.has(offer.sourceId));
    offers.sort((a, b) => S.sort === 'name' ? a.seller.localeCompare(b.seller, 'fa') : S.sort === 'desc' ? b.price - a.price : a.price - b.price);
    if (offers.length) {
      h += `<div class="row" style="margin-bottom:8px"><span class="select-shell"><select data-sel="sort" aria-label="مرتب‌سازی فروشندگان"><option value="price" ${S.sort === 'price' ? 'selected' : ''}>ارزان‌ترین</option><option value="desc" ${S.sort === 'desc' ? 'selected' : ''}>گران‌ترین</option><option value="name" ${S.sort === 'name' ? 'selected' : ''}>نام فروشنده</option></select></span><button class="btn sec icon-btn" data-act="toggleTable" title="${S.table ? 'نمای کارتی' : 'نمای جدول'}" aria-label="${S.table ? 'نمای کارتی' : 'نمای جدول'}">${icon(S.table ? 'layers' : 'compare')}</button></div>`;
      if (S.freeSearch) h += `<div class="card"><b>${icon('search', 15)} نتایج جست‌وجوی «${U.esc(S.searchQuery)}»</b><div class="muted" style="margin-top:5px">عنوان هر کالا در کارت خودش آمده؛ قیمت‌ها بین کالاهای متفاوت با هم مقایسه نشده‌اند.</div></div>`;
      else if (!sourceFilter) {
        const a = App.advice();
        h += `<div class="card"><b class="${a.tone === 'good' ? 'good' : a.tone === 'warn' ? 'warn' : ''}">مشاور خرید: ${U.esc(a.headline)}</b><ul>${a.points.map(x => `<li class="${x.k === 'good' ? 'good' : x.k === 'warn' ? 'warn' : ''}">${textWithCurrency(x.text)}</li>`).join('')}</ul><div class="muted" style="margin-top:6px">${a.caveats.map(U.esc).join('<br>')}</div></div>`;
      }
      else h += `<div class="muted" style="margin:0 2px 8px">نمایش فقط برای فروشگاه‌های انتخاب‌شده</div>`;
      const comparablePrices = S.freeSearch ? [] : [...new Set(offers.filter(o => o.matchLevel !== 'low' && o.price > 0).map(o => o.price))];
      const comparableMedian = comparablePrices.length >= 3 ? U.median(comparablePrices) : null;
      const bestPrice = S.freeSearch ? null : Math.min(...offers.filter(o => o.matchLevel !== 'low').map(o => o.price));
      const shown = S.showAll ? offers : offers.slice(0, 5);
      if (S.table) {
        if (S.freeSearch) h += '<table class="tb"><thead><tr><th>کالا</th><th>فروشنده</th><th>قیمت</th><th></th></tr></thead><tbody>' + shown.map(o => `<tr><td>${U.esc(o.matchTitle || S.searchQuery)}</td><td>${U.esc(o.seller)}</td><td><b>${money(o.price, 12)}</b></td><td>${o.sellerUrl ? `<a style="color:var(--acc)" href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده" aria-label="بازکردن صفحهٔ فروشنده">${icon('link', 14, 'icon-sm')}</a>` : ''}</td></tr>`).join('') + '</tbody></table>';
        else h += '<table class="tb">' + shown.map(o => { const diff = p.price ? (o.price - p.price) / p.price * 100 : null, pct = matchPercent(o), lv = LV[o.matchLevel] || ['', '']; return `<tr class="${o.price === bestPrice && o.matchLevel !== 'low' ? 'best' : ''}"><td>${pct ? `<span class="chip ${lv[1]} match-score" title="${pct}" aria-label="${pct}">${pct}</span> ` : ''}${U.esc(o.seller)}</td><td><b>${money(o.price, 12)}</b></td><td class="${diff != null && diff < -0.5 ? 'good' : diff > 0.5 ? 'bad' : 'muted'}">${diff == null ? '' : (diff < 0 ? '−' : diff > 0 ? '+' : '') + U.fmtPct(Math.abs(diff))}</td><td>${o.sellerUrl ? `<a style="color:var(--acc)" href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده" aria-label="بازکردن صفحهٔ فروشنده">${icon('link', 14, 'icon-sm')}</a>` : ''}</td></tr>`; }).join('') + '</table>';
      }
      else for (const o of shown) {
        const diff = !S.freeSearch && p.price ? (o.price - p.price) / p.price * 100 : null, lv = LV[o.matchLevel] || ['', ''];
        const dd = diff == null ? '' : Math.abs(diff) < 0.5 ? '<span class="muted">هم‌قیمت با این صفحه</span>' : diff < 0 ? `<span class="good">${U.fmtPct(-diff)} ارزان‌تر · صرفه‌جویی ${money(p.price - o.price, 12)}</span>` : `<span class="bad">${U.fmtPct(diff)} گران‌تر</span>`;
        const pct = matchPercent(o), source = Sources.registry[o.sourceId], checked = new Date(o.ts).toLocaleTimeString('fa-IR');
        const infoTags = [offerInfoTag('روش ارسال', 'bag', o.shippingInfo), offerInfoTag('گارانتی', 'shield', o.warrantyInfo)].filter(Boolean).join('');
        const lowPrice = !S.freeSearch && comparableMedian && o.matchLevel !== 'low' && o.price <= comparableMedian * .65;
        const priceSignal = lowPrice ? `<span class="chip warn" title="${U.toFa(Math.round((1 - o.price / comparableMedian) * 100))}٪ پایین‌تر از میانهٔ قیمت‌های همسان؛ شرایط فروش و موجودی را بررسی کنید.">قیمت غیرمعمول</span>` : '';
        const offerLink = o.sellerUrl ? `<a class="offer-link" href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده" aria-label="بازکردن صفحهٔ فروشنده">${icon('link')}</a>` : '';
        const productTitle = S.freeSearch ? `<div class="free-search-product-title">${U.esc(o.matchTitle || S.searchQuery)}</div>` : '';
        const bestBadge = !S.freeSearch && o.price === bestPrice && o.matchLevel !== 'low' ? '<span class="chip good">ارزان‌ترین</span>' : '';
        h += `<article class="card offer ${bestBadge ? 'best' : ''}">${productTitle}<div class="offer-top-row"><div class="offer-seller-group"><b>${U.esc(o.seller)}</b>${bestBadge}<span class="offer-diff">${dd}</span>${priceSignal}${infoTags}</div>${offerLink}</div><div class="offer-bottom-row"><div class="offer-source-score"><span class="offer-source">${icon(source?.icon || 'global', 15)}<span>${U.esc(source?.label || o.sourceId)} · ${checked}</span></span>${pct ? `<span class="chip ${lv[1]} match-score" title="${pct}" aria-label="${pct}">${pct}</span>` : ''}</div><strong class="offer-price">${money(o.price, 14)}</strong></div></article>`;
      }
      if (offers.length > 5) h += `<div class="btns"><button class="btn sec" data-act="toggleAll">${S.showAll ? 'نمایش کمتر' : 'نمایش همهٔ ' + U.toFa(offers.length) + ' مورد'}</button></div>`;
    } else if (!S.running && sourceErrors.length) {
      const [sourceId, sourceError] = sourceErrors[0], sourceName = Sources.registry[sourceId]?.label || sourceId;
      h += `<div class="empty-state" role="status"><span class="empty-state-icon">${icon('shield', 18)}</span><div class="empty-state-copy"><b>پاسخ قیمت‌ها دریافت نشد</b><p>${U.esc(sourceName)} خطا داد: ${U.esc(sourceError.error)}. پس از رفع محدودیت سرویس، دوباره تلاش کنید.</p></div><button class="btn sec icon-btn empty-state-action" data-act="${S.freeSearch ? 'manualSearch' : 'compare'}">${iconText('refresh', 'تلاش دوباره')}</button></div>`;
    } else if (S.offers.length && sourceFilter) {
      const selectedNames = Object.keys(Sources.registry).filter(id => sourceFilter.has(id)).map(id => Sources.registry[id].label).join('، ');
      h += `<div class="empty-state" role="status"><span class="empty-state-icon">${icon('search', 18)}</span><div class="empty-state-copy"><b>نتیجه‌ای از فروشگاه‌های انتخاب‌شده نیست</b><p>برای «${U.esc(selectedNames)}» قیمت قابل‌نمایشی پیدا نشد. همهٔ فروشگاه‌ها را ببینید یا منبع دیگری را انتخاب کنید.</p></div><button type="button" class="btn sec icon-btn empty-state-action" data-act="resetSourceFilter">${iconText('refresh', 'نمایش همه')}</button></div>`;
    } else if (!S.running && Object.keys(srcs).length) {
      const selectedNames = sourceFilter ? Object.keys(Sources.registry).filter(id => sourceFilter.has(id)).map(id => Sources.registry[id].label).join('، ') : '';
      const title = S.freeSearch ? 'نتیجه‌ای برای عبارت جست‌وجو پیدا نشد' : sourceFilter ? 'در فروشگاه‌های انتخاب‌شده نتیجه‌ای پیدا نشد' : 'فروشندهٔ مطابق پیدا نشد';
      const detail = S.freeSearch
        ? `در منابع فعال کالای مرتبطی با «${U.esc(S.searchQuery)}» و قیمت قابل‌نمایش پیدا نشد. عبارت کوتاه‌تر یا دقیق‌تری امتحان کنید.`
        : sourceFilter
          ? `در ${U.esc(selectedNames)} قیمت قابل‌اتکایی پیدا نشد. همهٔ فروشگاه‌ها را ببینید یا منبع دیگری را انتخاب کنید.`
          : 'برای این محصول نتیجهٔ قابل‌اتکایی در منابع فعال پیدا نشد. مدل یا عبارت جست‌وجو را بررسی کنید؛ قیمت حدسی نمایش داده نمی‌شود.';
      const action = sourceFilter
        ? `<button class="btn sec icon-btn empty-state-action" data-act="resetSourceFilter">${iconText('refresh', 'نمایش همه')}</button>`
        : S.freeSearch ? '' : `<button class="btn sec icon-btn empty-state-action" data-act="manual">${iconText('wallet', 'ثبت قیمت دستی')}</button>`;
      h += `<div class="empty-state" role="status"><span class="empty-state-icon">${icon('search', 18)}</span><div class="empty-state-copy"><b>${title}</b><p>${detail}</p></div>${action}</div>`;
    }
    const rejectedGroups = S.freeSearch ? [] : Object.entries(srcs).filter(([id, st]) => (!sourceFilter || sourceFilter.has(id)) && st.nearMiss?.length);
    if (rejectedGroups.length) {
      const rejectedCount = rejectedGroups.reduce((sum, [, st]) => sum + st.nearMiss.length, 0);
      h += `<details class="card rejected-results"><summary><b>نتایج دیگر محصولات</b><small>${U.toFa(rejectedCount)} مورد</small></summary>${rejectedGroups.map(([id, st]) => { const source = Sources.registry[id]; return `<div class="rejected-provider"><div class="rejected-provider-title">${icon(source?.icon || 'global', 15)}<span>${U.esc(source?.label || id)}</span></div><ul>${st.nearMiss.map(item => `<li>${U.esc(item.title)} — ${U.esc(item.reason)}</li>`).join('')}</ul></div>`; }).join('')}</details>`;
    }
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
    const rateLimited = S.historyNotice === 'rate-limit';
    h += `<div class="history-toolbar"><button class="btn sec icon-btn" data-act="reloadHistory" title="دریافت دوبارهٔ تاریخچه" ${S.chartLoading || cooldown > 0 ? 'disabled' : ''}>${icon('refresh')}<span>${S.chartLoading ? 'در حال دریافت…' : cooldown > 0 ? 'منتظر بمانید' : 'تلاش دوباره'}</span></button><div class="history-ranges" aria-label="بازهٔ تاریخچه">${[7, 30, 90].map(d => `<button class="btn ${S.range === d ? '' : 'sec'}" data-range="${d}" aria-pressed="${S.range === d}">${U.toFa(d)} روز</button>`).join('')}</div></div>`;
    if (S.chartLoading) h += `<div class="history-status" role="status"><span class="history-status-icon">${icon('refresh', 18)}</span><div class="history-status-copy"><b>در حال دریافت تاریخچه</b><p>درخواست به دیجی‌کالا فرستاده شد.</p></div></div>`;
    else if (rateLimited) h += `<div class="history-status" role="status"><span class="history-status-icon">${icon('clock', 18)}</span><div class="history-status-copy"><b>دریافت تاریخچه موقتاً محدود شده</b><p>${S.chart ? 'نمودار ذخیره‌شده نمایش داده می‌شود.' : loc.length ? 'قیمت‌های محلی حفظ شده‌اند.' : 'فعلاً دادهٔ ذخیره‌شده‌ای برای نمایش نیست.'}</p></div><strong class="history-countdown" data-history-countdown>${cooldown ? U.toFa(cooldown) : icon('check', 16)}<small>${cooldown ? 'ثانیه' : 'آماده'}</small></strong></div>`;
    else if (S.historyNotice === 'error' && S.chartError) h += `<div class="history-status" role="status"><span class="history-status-icon">${icon('shield', 18)}</span><div class="history-status-copy"><b>${S.chart ? 'تازه‌سازی ناموفق بود' : 'تاریخچه دریافت نشد'}</b><p>${S.chart ? 'دادهٔ ذخیره‌شده حفظ شده است.' : 'برای تلاش مجدد از دکمهٔ بالای صفحه استفاده کنید.'}</p></div></div>`;
    if (cooldown > 0 && !S.chartLoading) scheduleCountdownTick();
    if (S.chart) {
      const c = S.chart, v = App.selectedVariant();
      if (c.variants.length > 1) h += `<div style="margin-bottom:6px"><select data-sel="variant">${c.variants.map((x, i) => `<option value="${i}" ${i === S.variantIdx ? 'selected' : ''}>${U.esc(x.title || 'واریانت ' + (i + 1))}</option>`).join('')}</select> <span class="chip ${S.variantManual ? 'warn' : S.variantExact ? 'good' : 'warn'}">${S.variantManual ? 'انتخاب دستی؛ با رنگ صفحه تطبیق دهید' : S.variantExact ? 'مطابق رنگ صفحه' : 'رنگ دقیق مشخص نشد'}</span></div>`;
      const updated = S.chartFetchedAt ? new Date(S.chartFetchedAt).toLocaleString('fa-IR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const cacheLabel = S.chartFromCache && updated ? `<div class="muted history-cache-label">${S.chartStale ? 'ذخیره‌شده · ' : 'آخرین دریافت · '}${updated}</div>` : '';
      h += `<div class="card history-chart-card">${chart(officialValid, loc, S.range)}<div class="muted">خط بنفش: تاریخچهٔ رسمی · نقطه‌های طلایی: قیمت‌های محلی · نقطهٔ سبز: کمینه</div>${cacheLabel}</div>`;
    if (stats) h += `<div class="grid2"><div class="m"><span>کمترین قیمت در بازهٔ انتخابی</span><b>${money(stats.min, 12)}</b></div><div class="m"><span>بیشترین قیمت</span><b>${money(stats.max, 12)}</b></div><div class="m"><span>میانه</span><b>${money(stats.median, 12)}</b></div><div class="m"><span>بازهٔ دارای داده</span><b>${U.toFa(stats.span)} روز · ${U.toFa(stats.count)} روز</b></div></div><div class="muted" style="margin-top:6px">نقطه‌های رسمی: ${U.toFa(officialValid.length)} · ثبت‌های محلی: ${U.toFa(loc.length)} · دادهٔ رسمی ممکن است فقط حدود یک ماه را پوشش دهد؛ سابقهٔ محلی از این پس به‌مرور کامل‌تر می‌شود. روزهای خالی درون‌یابی نمی‌شوند.</div>`;
      else h += '<div class="card muted">این واریانت نقطهٔ قابل‌فروش ندارد.</div>';
    } else {
      if (loc.length) h += `<div class="card">${chart([], loc, S.range)}<div class="muted">این‌ها قیمت‌هایی هستند که افزونه برای همین محصول/واریانت ثبت کرده است.</div></div>`;
      if (!loc.length && !S.chartError && !S.historyNotice && !S.chartLoading) h += '<div class="empty-state" role="status"><span class="empty-state-icon">' + icon('history', 18) + '</span><div class="empty-state-copy"><b>تاریخچه‌ای برای نمایش نیست</b><p>برای این محصول هنوز دادهٔ رسمی یا ثبت محلی وجود ندارد.</p></div></div>';
      else if (!loc.length && S.historyNotice === 'error' && !S.chartLoading) h += '<div class="empty-state" role="status"><span class="empty-state-icon">' + icon('history', 18) + '</span><div class="empty-state-copy"><b>نمودار فعلاً خالی است</b><p>دادهٔ رسمی در دسترس نیست و هنوز قیمت محلی برای این محصول ثبت نشده. بعداً دوباره تلاش کنید یا محصول را در واچ‌لیست بگذارید.</p></div></div>';
    }
    if (S.dk && S.dk.lowest30dOfficial) h += `<div class="card"><span class="muted">کمترین قیمت اعلامی دیجی‌کالا در ۳۰ روز اخیر</span><div class="pv">${money(S.dk.lowest30dOfficial, 14)}</div></div>`;
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
    if (n && n.baseline) h += `<div class="grid2"><div class="m"><span>قیمت پایه · میانهٔ داده‌های پیش از ۱۴ روز اخیر</span><b>${money(n.baseline, 12)}</b></div><div class="m"><span>${S.product?.price > 0 ? 'قیمت فعلی صفحه' : 'آخرین قیمت ثبت‌شده'}</span><b>${money(n.current, 12)}</b></div><div class="m"><span>تغییر نسبت به پایه</span><b>${U.fmtPct(n.realDropPct)}</b></div><div class="m"><span>تخفیف ادعایی</span><b>${n.claimedPct == null ? '—' : U.fmtPct(n.claimedPct)}</b></div><div class="m"><span>کمترین قیمت دوره</span><b>${money(n.min, 12)}</b></div><div class="m"><span>بیشترین قیمت دوره</span><b>${money(n.max, 12)}</b></div></div><div class="muted" style="margin-top:6px">آخرین نقطه: ${U.faDate(n.latest)} · ${U.toFa(n.ageDays)} روز پیش · ${U.toFa(n.baselinePoints || 0)} نقطه برای پایه</div>`;
    if (r.signals.length) h += `<div class="card"><b class="warn">نشانه‌ها</b><ul>${r.signals.map(s => `<li>${textWithCurrency(s.text)}</li>`).join('')}</ul></div>`;
    h += `<details class="card muted"><summary class="card-title">${icon('shield')}روش و محدودیت‌ها</summary><ul><li>قیمت پایه، میانهٔ قیمت‌های قابل‌فروشِ ثبت‌شده تا ۱۴ روز پیش از آخرین داده است؛ حداقل ۱۰ نقطه در ۲۱ روز و ۵ نقطه برای پایه لازم است.</li><li>بازرس جهش بیش از ۸٪ پیش از دورهٔ اخیر و اختلاف مرجع/تخفیف ادعایی را علامت می‌زند. این‌ها نشانه‌اند، نه اثبات تخلف.</li><li>قیمت فروشنده، موجودی یا گارانتی ممکن است عوض شده باشد؛ دادهٔ قدیمی یا واریانت نامطمئن نتیجهٔ قطعی نمی‌دهد.</li></ul></details>`;
    if (r.reasons.length) h += `<div class="card muted"><ul>${r.reasons.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul></div>`;
    return h;
  }

  function tabWatch() {
    const db = Store.get(), cur = S.key && db.products[S.key];
    const collections = db.collections || (db.collections = {});
    const collectionList = Object.values(collections);
    const tracked = Object.values(db.products).filter(p => p.watch).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    const iconChoices = [['gift', 'هدیه'], ['heart', 'علاقه'], ['tag', 'مناسبت'], ['layers', 'دسته'], ['wallet', 'خرید'], ['pin', 'برنامه'], ['file', 'فهرست'], ['shop', 'فروشگاه'], ['bag', 'کیف خرید'], ['cart', 'سبد خرید'], ['global', 'عمومی'], ['bell', 'هشدار']];
    if (watchCollectionFilter !== 'all' && watchCollectionFilter !== 'none' && !collections[watchCollectionFilter]) watchCollectionFilter = 'all';
    const collectionSelect = p => collectionList.length ? `<label class="watch-item-collection" aria-label="مجموعهٔ ${U.esc((p.title || 'محصول').slice(0, 36))}"><span>${icon('layers', 14)}</span><select data-sel="collection" data-key="${U.esc(p.key)}" aria-label="انتقال ${U.esc((p.title || 'محصول').slice(0, 36))} به مجموعه"><option value="">بدون مجموعه</option>${collectionList.map(c => `<option value="${U.esc(c.id)}" ${p.collectionId === c.id ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}</select></label>` : '';
    const itemCard = p => {
      const first = p.local?.[0], change = first && p.lastPrice ? (p.lastPrice - first.p) / first.p * 100 : null;
      const hit = p.target > 0 && p.lastPrice <= p.target, current = p.key === S.key;
      const priceLabel = p.lastTs ? new Date(p.lastTs).toLocaleDateString('fa-IR') : 'هنوز قیمتی ثبت نشده';
      const state = hit ? 'به قیمت هدف رسیده' : p.target ? 'در انتظار قیمت هدف' : 'قیمت هدف تنظیم نشده';
      const currentPrice = current ? Number(S.product?.price || p.lastPrice || 0) : Number(p.lastPrice || 0);
      const targetEditor = current ? `<div class="watch-target-row"><label for="tgt">قیمت هشدار</label><div class="watch-target-controls"><input type="text" id="tgt" class="watch-target-input" inputmode="numeric" autocomplete="off" spellcheck="false" dir="ltr" aria-label="قیمت هدف به تومان" value="${formatPriceInputValue(p.target)}" placeholder="تومان"><button type="button" class="btn icon-btn" data-act="setTarget" aria-label="ثبت قیمت هدف" title="ثبت قیمت هدف">${icon('check')}</button></div></div>` : '';
      return `<article class="card watch-item ${current ? 'current' : ''}">
        <div class="watch-item-top"><div class="watch-item-copy"><b title="${U.esc(p.title || p.key)}">${U.esc((p.title || p.key).slice(0, 90))}</b><span>${U.esc(p.lastSource || 'قیمت ثبت‌شده')} · ${priceLabel}</span></div><div class="watch-item-actions"><a class="btn sec icon-btn icon-only" href="${U.esc(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="بازکردن محصول" title="بازکردن محصول">${icon('global')}</a><button class="btn sec icon-btn icon-only" data-rm="${U.esc(p.key)}" aria-label="حذف از واچ‌لیست" title="حذف از واچ‌لیست">${icon('trash')}</button></div></div>
        <div class="watch-item-bottom"><strong class="watch-item-price">${currentPrice ? money(currentPrice, 14) : '—'}</strong><span class="watch-item-target">${icon('target', 13)}هدف <b>${p.target ? money(p.target, 12) : 'تنظیم‌نشده'}</b></span><span class="watch-item-state ${hit ? 'good' : 'warn'}" title="${U.esc(state)}">${icon(hit ? 'check' : 'clock', 13)}${hit ? 'به هدف رسید' : p.target ? 'در انتظار هدف' : 'بدون هدف'}${change == null ? '' : ' · ' + U.fmtPct(change)}</span></div>
        ${targetEditor}${collectionSelect(p)}</article>`;
    };
    let h = `<div class="watch-head"><div class="watch-head-copy"><span class="watch-head-icon">${icon('heart', 18)}</span><div><b>واچ‌لیست</b><small>${U.toFa(tracked.length)} محصول زیرنظر</small></div></div><button class="btn sec icon-btn" data-act="checkNow" title="بررسی قیمت‌های واچ‌لیست">${iconText('refresh', 'بررسی قیمت‌ها')}</button></div>`;
    if (cur && !cur.watch) {
      const currentTitle = Extract.coreTitle(S.product?.title) || S.product?.title || cur.title || 'محصول فعلی';
      const currentPrice = Number(S.product?.price || cur.lastPrice || 0);
      h += `<section class="card watch-current"><div class="watch-current-top"><b class="card-title">${icon('tag')}<span>افزودن محصول این صفحه</span></b>${switchRow('پیگیری قیمت', 'data-ck="watch"', false, 'bell')}</div><div class="watch-current-name">${U.esc(currentTitle)}</div><div class="watch-current-price"><span>قیمت فعلی</span><b>${currentPrice ? money(currentPrice, 14) : '—'}</b></div><div class="watch-target-row"><label for="tgt">هشدار در قیمت هدف</label><div class="watch-target-controls"><input type="text" id="tgt" class="watch-target-input" inputmode="numeric" autocomplete="off" spellcheck="false" dir="ltr" aria-label="قیمت هدف به تومان" value="${formatPriceInputValue(cur.target)}" placeholder="تومان"><button type="button" class="btn icon-btn" data-act="setTarget" aria-label="ثبت قیمت هدف" title="ثبت قیمت هدف">${icon('check')}</button></div></div></section>`;
    }
    const collectionCounts = new Map();
    for (const product of tracked) {
      const id = collections[product.collectionId] ? product.collectionId : 'none';
      collectionCounts.set(id, (collectionCounts.get(id) || 0) + 1);
    }
    const filters = [
      { id: 'all', name: 'همه', icon: 'layers', count: tracked.length },
      ...collectionList.map(c => ({ id: c.id, name: c.name, icon: c.icon || 'layers', count: collectionCounts.get(c.id) || 0 })),
      ...(collectionCounts.has('none') ? [{ id: 'none', name: 'بدون مجموعه', icon: 'tag', count: collectionCounts.get('none') }] : [])
    ];
    const selectedCollection = collections[watchCollectionFilter];
    const selectionActions = selectedCollection && collectionEditId === selectedCollection.id
      ? `<div class="collection-inline-form"><label for="collectionEditName">نام مجموعه</label><input type="text" id="collectionEditName" maxlength="32" value="${U.esc(selectedCollection.name)}" aria-label="نام مجموعه" aria-describedby="collectionEditNameError"><small id="collectionEditNameError" class="collection-form-error" hidden>نام مجموعه را وارد کنید.</small><button class="btn icon-btn" data-act="saveCollection" data-collection-id="${U.esc(selectedCollection.id)}" aria-label="ذخیرهٔ نام مجموعه" title="ذخیره">${icon('check')}</button><button class="btn sec icon-btn" data-act="cancelCollectionEdit" aria-label="لغو ویرایش" title="لغو">${icon('close')}</button></div>`
      : selectedCollection && collectionDeleteId === selectedCollection.id
        ? `<div class="collection-confirm" role="status"><span>محصول‌ها حفظ می‌شوند.</span><button class="btn bad icon-btn" data-act="confirmDeleteCollection" data-collection-id="${U.esc(selectedCollection.id)}" aria-label="حذف مجموعه" title="حذف">${iconText('trash', 'حذف')}</button><button class="btn sec icon-btn" data-act="cancelCollectionDelete" aria-label="انصراف از حذف" title="انصراف">${icon('close')}</button></div>`
        : selectedCollection
          ? `<div class="collection-selection-actions"><button class="btn sec" data-act="editCollection" data-collection-id="${U.esc(selectedCollection.id)}">${iconText('pen', 'ویرایش')}</button><button class="btn sec icon-btn" data-act="requestDeleteCollection" data-collection-id="${U.esc(selectedCollection.id)}" aria-label="حذف مجموعه" title="حذف">${icon('trash')}</button></div>`
          : '';
    const collectionPills = collectionList.length || tracked.length
      ? `<div class="collection-pills" aria-label="فیلتر مجموعه‌ها">${filters.map(f => `<button type="button" class="collection-pill" data-act="toggleCollection" data-collection-id="${U.esc(f.id)}" aria-pressed="${watchCollectionFilter === f.id}">${icon(f.icon, 14)}<span>${U.esc(f.name)}</span><small>${U.toFa(f.count)}</small></button>`).join('')}</div>`
      : '<p class="muted collection-help">برای دسته‌بندی محصولات، مجموعه بسازید.</p>';
    h += `<section class="collection-manager"><div class="collection-manager-head"><div class="collection-manager-title">${icon('layers')}<b>مجموعه‌ها</b></div><button type="button" class="btn sec icon-btn" data-act="toggleCollectionForm" aria-expanded="${collectionFormOpen}" aria-controls="collectionCreateForm" aria-label="${collectionFormOpen ? 'بستن فرم ساخت مجموعه' : 'ساخت مجموعهٔ جدید'}" title="${collectionFormOpen ? 'بستن فرم' : 'ساخت مجموعه'}">${icon(collectionFormOpen ? 'close' : 'tag')}<span>${collectionFormOpen ? 'بستن' : 'مجموعهٔ جدید'}</span></button></div>${collectionPills}${selectionActions}<div class="collection-create-form" id="collectionCreateForm" ${collectionFormOpen ? '' : 'hidden'}><label for="collectionName" class="collection-icon-label">نام مجموعه</label><div class="collection-name-row"><input type="text" id="collectionName" maxlength="32" aria-describedby="collectionNameError" aria-label="نام مجموعهٔ جدید" placeholder="مثلاً تولد یا هدیه"><button type="button" class="btn collection-create-submit" data-act="createCollection">${iconText('check', 'ساخت')}</button><button type="button" class="btn sec icon-btn" data-act="toggleCollectionForm" aria-label="لغو ساخت مجموعه" title="لغو">${icon('close')}</button></div><small id="collectionNameError" class="collection-form-error" hidden>نام مجموعه را وارد کنید.</small><span class="collection-icon-label">آیکون</span><div class="collection-icon-picker" role="group" aria-label="انتخاب آیکون مجموعه">${iconChoices.map(([name, label], i) => `<button type="button" class="collection-icon-choice" data-collection-icon="${name}" aria-label="${label}" title="${label}" aria-pressed="${i === 0}">${icon(name, 18)}</button>`).join('')}</div></div></section>`;
    const visible = tracked.filter(p => watchCollectionFilter === 'all' || (watchCollectionFilter === 'none' ? !collections[p.collectionId] : p.collectionId === watchCollectionFilter));
    if (visible.length) h += `<div class="watch-list-title"><span>${U.esc(filters.find(f => f.id === watchCollectionFilter)?.name || 'محصولات زیرنظر')}</span><small>${U.toFa(visible.length)} کالا</small></div><div class="watch-list">${visible.map(itemCard).join('')}</div>`;
    else if (tracked.length) h += `<div class="collection-empty">در این مجموعه هنوز محصولی نیست.</div>`;
    else if (!cur?.watch && !S.product) h += `<div class="empty-state watch-empty" role="status"><span class="empty-state-icon">${icon('heart', 18)}</span><div class="empty-state-copy"><b>هنوز محصولی زیر نظر نیست</b><p>برای افزودن کالا، صفحهٔ محصول را باز کنید.</p></div></div>`;
    return `<div class="watch-layout">${h}</div>`;
  }

  function settingsSection(title, iconName, content) {
    return `<section class="settings-section"><h3 class="settings-heading">${icon(iconName)}<span>${U.esc(title)}</span></h3><div class="card settings-card">${content}</div></section>`;
  }

  function tabSettings() {
    const st = Store.get().settings, alerts = st.alerts || { enabled: true, intervalMin: 60 }; let h = '';
    h += settingsSection('نمایش و رفتار', 'settings',
      switchRow('تم روشن', 'data-set="theme"', st.theme === 'light', 'sun') +
      switchRow('چسبیدن پنل به لبه‌ها', 'data-set="snap"', !!st.snap, 'pin') +
      switchRow('نمایش فقط در صفحهٔ محصول', 'data-set="productPageOnly"', !!st.productPageOnly, 'search'));
    const sources = Object.values(Sources.registry).map(r => switchRow(r.label, `data-src="${r.id}"`, !!st.sources[r.id], r.icon || 'global', !r.implemented)).join('');
    const city = Sources.snappshop.cities[st.snappCity] ? st.snappCity : 'tehran';
    const citySelector = `<div class="setting-input-row"><label for="snappCity">${icon('cart')}<span>شهر قیمت‌گذاری اسنپ‌شاپ</span></label><span class="select-shell setting-city-select"><select id="snappCity" data-sel="snappCity" aria-label="شهر قیمت‌گذاری اسنپ‌شاپ">${Object.entries(Sources.snappshop.cities).map(([id, value]) => `<option value="${id}" ${id === city ? 'selected' : ''}>${U.esc(value.label)}</option>`).join('')}</select></span></div>`;
    h += settingsSection('منابع قیمت', 'global', sources + citySelector + `<div class="setting-hint" title="مجوزهای شبکه فقط: ${U.esc(Net.ALLOWED.join('، '))}"><kbd>Alt+Shift+G</kbd><span>باز/بستن پنل</span></div>`);
    const alertSettings = switchRow('فعال‌کردن هشدار قیمت', 'data-set="alertsEnabled"', !!alerts.enabled, 'bell') +
      `<div class="setting-input-row"><label for="ival">${icon('clock')}<span>فاصلهٔ بررسی (دقیقه)</span></label><input type="text" inputmode="numeric" id="ival" aria-label="فاصلهٔ بررسی هشدار به دقیقه، حداقل ۱۵" value="${U.toFa(alerts.intervalMin || 60)}"></div><div class="muted setting-note">حداقل ۱۵ دقیقه</div>`;
    h += settingsSection('هشدار قیمت', 'bell', alertSettings);
    const diagnostics = `<div class="diagnostics-option"><div class="diagnostics-option-copy">${icon('bug')}<div><b>گزارش و عیب‌یابی</b><small>نسخهٔ افزونه، رویدادها و خطاهای اخیر</small></div></div><button type="button" class="btn sec icon-btn diagnostics-open" data-tab="log" aria-controls="body" title="بازکردن گزارش و عیب‌یابی">${iconText('bug', 'بازکردن')}</button></div>`;
    h += settingsSection('عیب‌یابی', 'bug', diagnostics);
    const dataActions = `<div class="btns"><button class="btn sec icon-btn" data-act="expCsv">${iconText('download', 'خروجی CSV')}</button><button class="btn sec icon-btn" data-act="expJson">${iconText('download', 'خروجی JSON')}</button><button class="btn sec icon-btn" data-act="impCsv">${iconText('upload', 'ورود CSV')}</button><button class="btn bad icon-btn" data-act="clearProd" title="پاک‌کردن تاریخچهٔ محلی این محصول">${iconText('trash', 'حذف محصول')}</button><button class="btn bad icon-btn" data-act="clearAll" title="پاک‌کردن همهٔ داده‌ها و تنظیمات">${iconText('trash', 'حذف همه')}</button></div><input type="file" id="file" accept=".csv" style="display:none">`;
    const aboutData = `<div class="about-data-layout"><div><div class="about-copy"><b>تخفیف‌سنج</b><p>ابزاری برای مقایسهٔ قیمت، بررسی سابقه و پیگیری کاهش قیمت محصولات در فروشگاه‌های پشتیبانی‌شده.</p></div><div class="about-data-actions"><div class="about-repo"><a href="https://github.com/Soheil-Aghayani/Takhfifsanj" target="_blank" rel="noopener noreferrer" aria-label="مخزن تخفیف‌سنج در گیت‌هاب" title="مخزن تخفیف‌سنج در گیت‌هاب">${icon('global')}<span>مخزن پروژه</span></a></div><div class="contact-links" aria-label="راه‌های تماس"><a href="mailto:soheyl.aghayani@gmail.com" aria-label="ارسال ایمیل" title="ایمیل">${icon('letter')}</a><a href="https://t.me/env_soh" target="_blank" rel="noopener noreferrer" aria-label="تماس در تلگرام" title="تلگرام">${icon('chat')}</a></div></div></div><section class="saved-data-section" aria-labelledby="savedDataHeading"><h4 class="saved-data-heading" id="savedDataHeading">${icon('file')}<span>داده‌های ذخیره‌شده</span></h4><div class="saved-data-actions">${dataActions}</div></section></div>`;
    h += settingsSection('درباره، تماس و داده‌ها', 'tag', aboutData);
    return h;
  }
  function diagnosticsVersion() {
    try {
      const runtime = typeof browser !== 'undefined' && browser.runtime?.getManifest
        ? browser.runtime
        : typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime : null;
      const value = runtime?.getManifest().version;
      if (value) return U.toFa(value);
    } catch {}
    try { if (typeof GM_info !== 'undefined' && GM_info.script?.version) return U.toFa(GM_info.script.version); } catch {}
    return '—';
  }
  function diagnosticsSummary() {
    const product = S.product || {};
    return `نسخه ${diagnosticsVersion()} · محصول: ${S.key} · منبع قیمت: ${product.priceSource || '—'}${product.priceNote ? ' · ' + product.priceNote : ''}`;
  }
  function diagnosticsLogRows() {
    return Log.all().slice(-60).reverse().map(entry => ({
      className: entry.level === 'error' ? 'e' : entry.level === 'warn' ? 'w' : '',
      text: `${new Date(entry.t).toLocaleTimeString('en-GB')} [${entry.scope}] ${entry.msg}`
    }));
  }
  async function copyDiagnostics() {
    const status = $('#diagnosticsCopyStatus');
    const button = $('[data-act="copyDiagnostics"]');
    if (!status || !button) return;
    const rows = diagnosticsLogRows();
    const report = [diagnosticsSummary(), ...(rows.length ? rows.map(row => row.text) : ['بدون رویداد'])].join('\n');
    button.disabled = true;
    status.classList.remove('bad');
    status.textContent = '';
    try {
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(report);
          copied = true;
        }
      } catch {}
      if (!copied && typeof document.execCommand === 'function') {
        const field = document.createElement('textarea');
        field.value = report;
        field.setAttribute('readonly', '');
        Object.assign(field.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0' });
        (document.body || document.documentElement).appendChild(field);
        field.focus(); field.select(); field.setSelectionRange(0, report.length);
        copied = document.execCommand('copy');
        field.remove();
      }
      if (!copied) throw new Error('Clipboard is unavailable');
      status.textContent = 'گزارش عیب‌یابی کپی شد';
    } catch {
      status.classList.add('bad');
      status.textContent = 'کپی انجام نشد؛ دوباره تلاش کنید';
    } finally {
      button.disabled = false;
    }
  }
  function tabLog() {
    const legacy = ['ghpro12-host', 'ghafel-pc-btn', 'ghafel-pc-panel'].filter(id => document.getElementById(id));
    let h = legacy.length ? `<div class="banner">نسخه‌های قدیمی هم‌زمان فعال‌اند (${legacy.join('، ')}). در Tampermonkey آن‌ها را غیرفعال کنید تا فقط یک پنل بماند.</div>` : '';
    h += `<div class="diagnostics-actions"><button type="button" class="btn sec icon-btn diagnostics-back" data-tab="settings">${iconText('settings', 'بازگشت به تنظیمات')}</button><div class="diagnostics-copy-group"><button type="button" class="btn sec icon-btn" data-act="copyDiagnostics" title="کپی گزارش عیب‌یابی">${iconText('clipboardCopy', 'کپی گزارش')}</button><span class="diagnostics-copy-status" id="diagnosticsCopyStatus" role="status" aria-live="polite"></span></div></div>`;
    h += `<div class="card muted">${U.esc(diagnosticsSummary())}</div>`;
    const rows = diagnosticsLogRows();
    h += `<div class="card log">${rows.map(row => `<div class="${row.className}">${U.esc(row.text)}</div>`).join('') || 'بدون رویداد'}</div>`;
    return h;
  }

  const TABS = [['compare', 'compare', 'مقایسه', 'مقایسهٔ قیمت'], ['history', 'history', 'تاریخچه', 'تاریخچهٔ قیمت'], ['inspect', 'search', 'بازرس', 'بازرس تخفیف'], ['watch', 'heart', 'واچ‌لیست', 'واچ‌لیست قیمت'], ['settings', 'settings', 'تنظیمات', 'تنظیمات افزونه']];
  let lastIndicatorTarget = null;
  let sourceFilter = null, sourceFilterIdentity = '';
  const tabScrollPositions = Object.create(null);
  let watchCollectionFilter = 'all';
  let collectionFormOpen = false;
  let collectionEditId = '', collectionDeleteId = '';
  let tabMorphSequence = 0, tabMorphActive = false, tabMorphAnimations = [];
  let queuedAppRender = false, appRenderFrame = 0;
  const requestFrame = callback => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : setTimeout(callback, 16);
  const cancelFrame = frame => typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(frame) : clearTimeout(frame);
  function queueAppRender() {
    queuedAppRender = true;
    if (tabMorphActive || appRenderFrame) return;
    appRenderFrame = requestFrame(() => {
      appRenderFrame = 0;
      if (tabMorphActive || !queuedAppRender) return;
      queuedAppRender = false;
      render();
    });
  }
  function cancelTabMorph() {
    tabMorphSequence += 1;
    tabMorphAnimations.forEach(animation => { try { animation.cancel(); } catch {} });
    tabMorphAnimations = []; tabMorphActive = false;
    $('#panel')?.querySelectorAll('.tab-morph-overlay').forEach(node => node.remove());
  }
  function positionTabIndicator(fromRect = null) {
    const nav = $('#tabs'), indicator = nav?.querySelector('.tab-indicator'), active = nav?.querySelector('.tab.on');
    if (!nav || !indicator) return null;
    if (!active) { indicator.style.opacity = '0'; lastIndicatorTarget = null; return null; }
    indicator.style.opacity = '1';
    const navRect = nav.getBoundingClientRect(), activeRect = active.getBoundingClientRect();
    const labelWidth = active.querySelector('.tab-label')?.scrollWidth || 0;
    const width = Math.min(activeRect.width, Math.max(48, Math.ceil(labelWidth + 12))), height = 40;
    const target = {
      left: activeRect.left - navRect.left + (activeRect.width - width) / 2,
      top: (navRect.height - height) / 2,
      width,
      height
    };
    const changed = !lastIndicatorTarget || Object.keys(target).some(key => Math.abs(target[key] - lastIndicatorTarget[key]) > 0.5);
    indicator.style.left = target.left + 'px';
    indicator.style.top = target.top + 'px';
    indicator.style.width = target.width + 'px';
    indicator.style.height = target.height + 'px';
    if (fromRect) indicator.getAnimations?.().forEach(animation => animation.cancel());
    indicator.style.transform = 'none';
    const destinationRect = indicator.getBoundingClientRect();
    if (fromRect) {
      lastIndicatorTarget = target;
      if ((typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || !indicator.animate) return destinationRect;
      const dx = fromRect.left - destinationRect.left, dy = fromRect.top - destinationRect.top;
      const sx = fromRect.width / Math.max(destinationRect.width, 1), sy = fromRect.height / Math.max(destinationRect.height, 1);
      const start = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
      const settle = `translate3d(${dx * 0.08}px, ${dy * 0.08}px, 0) scale(${1 + (sx - 1) * 0.08}, ${1 + (sy - 1) * 0.08})`;
      const duration = 500;
      const animation = indicator.animate([
        { transform: start, borderRadius: '999px' },
        { offset: 0.72, transform: settle, borderRadius: '999px' },
        { transform: 'translate3d(0,0,0) scale(1,1)', borderRadius: '999px' }
      ], { duration, easing: 'cubic-bezier(.22,1,.36,1)' });
      animation.onfinish = () => { indicator.style.transform = 'none'; };
      return destinationRect;
    }
    if (changed) {
      indicator.getAnimations?.().forEach(animation => animation.cancel());
    }
    lastIndicatorTarget = target;
    return destinationRect;
  }
  function renderTabs(fromRect = null) {
    const nav = $('#tabs'); if (!nav) return;
    if (!TABS.some(([key]) => key === S.tab) && S.tab !== 'log') S.tab = 'compare';
    const existingMain = nav.querySelector('.tab-main');
    const canonicalTabs = nav.children.length === 2
      && nav.children[0].classList.contains('tab-indicator')
      && nav.children[1] === existingMain
      && existingMain?.children.length === TABS.length
      && TABS.every(([key], index) => existingMain.children[index]?.id === 'tab-' + key);
    if (!canonicalTabs) {
      nav.replaceChildren();
      lastIndicatorTarget = null;
      const indicator = document.createElement('span'); indicator.className = 'tab-indicator'; indicator.setAttribute('aria-hidden', 'true');
      const main = document.createElement('div'); main.className = 'tab-main'; main.setAttribute('role', 'tablist'); main.setAttribute('aria-label', 'بخش‌های اصلی');
      nav.append(indicator, main);
      const appendTab = (parent, [key, ico, labelText, title]) => {
        const button = document.createElement('button'); button.type = 'button'; button.id = 'tab-' + key; button.className = 'tab'; button.dataset.tab = key;
        button.setAttribute('role', 'tab'); button.setAttribute('aria-label', title); button.setAttribute('aria-controls', 'body'); button.setAttribute('title', title);
        const iconNode = document.createElement('span'); iconNode.className = 'tab-icon'; iconNode.setAttribute('aria-hidden', 'true'); iconNode.innerHTML = icon(ico);
        const labelNode = document.createElement('span'); labelNode.className = 'tab-label'; labelNode.setAttribute('aria-hidden', 'true'); labelNode.textContent = labelText;
        button.append(iconNode, labelNode);
        parent.appendChild(button);
      };
      TABS.forEach(item => appendTab(main, item));
      if (nav.dataset.indicatorListener !== 'true') {
        nav.addEventListener('scroll', () => positionTabIndicator(), { passive: true });
        nav.dataset.indicatorListener = 'true';
      }
    }
    nav.classList.remove('diagnostics-on');
    nav.querySelectorAll('.diagnostics-dock,#tab-log').forEach(node => node.remove());
    for (const [key] of TABS) {
      const button = nav.querySelector('#tab-' + key), active = key === S.tab || (key === 'settings' && S.tab === 'log');
      button.classList.toggle('on', active); button.setAttribute('aria-selected', String(active));
    }
    return positionTabIndicator(fromRect);
  }
  let countdownTimer = null;
  function scheduleCountdownTick() {
    if (countdownTimer) return;
    countdownTimer = setTimeout(() => {
      countdownTimer = null;
      if (S.tab !== 'history') return;
      const value = Math.max(0, Math.ceil((S.historyCooldownUntil - Date.now()) / 1000));
      const counter = root?.querySelector('[data-history-countdown]');
      const retry = root?.querySelector('[data-act="reloadHistory"]');
      const statusText = root?.querySelector('.history-status-copy p');
      if (!counter || !retry) return;
      if (value) {
        counter.innerHTML = `${U.toFa(value)}<small>ثانیه</small>`;
        retry.disabled = true;
        scheduleCountdownTick();
      } else {
        counter.innerHTML = `${icon('check', 16)}<small>آماده</small>`;
        retry.disabled = !!S.chartLoading;
        if (statusText) statusText.textContent = 'اکنون می‌توانید دوباره تلاش کنید.';
      }
    }, 1000);
  }
  function animateTabContent(bodyNode, originRect = null) {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const entering = bodyNode.querySelector('.body-content');
    if (!entering || typeof entering.animate !== 'function') return false;
    const panel = $('#panel'), panelRect = panel?.getBoundingClientRect(), bodyRect = bodyNode.getBoundingClientRect();
    if (!panel || !panelRect || !bodyRect.width || !bodyRect.height || typeof panelRect.left !== 'number') return false;
    const source = originRect || { left: bodyRect.left + bodyRect.width / 2 - 28, top: bodyRect.top + 6, width: 56, height: 38 };
    const overlay = document.createElement('div'); overlay.className = 'tab-morph-overlay'; overlay.setAttribute('aria-hidden', 'true');
    const end = { left: bodyRect.left - panelRect.left, top: bodyRect.top - panelRect.top, width: bodyRect.width, height: bodyRect.height };
    const dx = source.left - bodyRect.left, dy = source.top - bodyRect.top;
    const sx = Math.max(.01, source.width / bodyRect.width), sy = Math.max(.01, source.height / bodyRect.height);
    const startTransform = `translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`;
    const color = getComputedStyle(bodyNode), accent = color.getPropertyValue('--acc2').trim() || '#f0c65a', panelColor = color.getPropertyValue('--panel').trim() || '#15181e';
    Object.assign(overlay.style, { left: end.left + 'px', top: end.top + 'px', width: end.width + 'px', height: end.height + 'px', borderRadius: '18px' });
    panel.appendChild(overlay);
    const cleanup = () => { if (overlay.isConnected) overlay.remove(); };
    let enteringAnimation, morphAnimation;
    try {
      enteringAnimation = entering.animate([
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 420, delay: 80, easing: 'cubic-bezier(.2,.8,.2,1)' });
      morphAnimation = overlay.animate([
        { transform: startTransform, borderRadius: '18px', backgroundColor: accent, opacity: .96 },
        { offset: .72, transform: 'translate3d(0,0,0) scale(1.015,1.015)', borderRadius: '12px', backgroundColor: panelColor, opacity: .92 },
        { transform: 'translate3d(0,0,0) scale(1,1)', borderRadius: '0px', backgroundColor: panelColor, opacity: 0 }
      ], { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
    } catch {
      try { enteringAnimation?.cancel(); morphAnimation?.cancel(); } catch {}
      cleanup();
      return false;
    }
    const sequence = ++tabMorphSequence;
    tabMorphActive = true; tabMorphAnimations = [enteringAnimation, morphAnimation];
    const release = () => {
      if (sequence !== tabMorphSequence) return;
      cleanup(); tabMorphAnimations = []; tabMorphActive = false;
      if (queuedAppRender) queueAppRender();
    };
    const fallback = setTimeout(release, 540);
    Promise.allSettled([enteringAnimation.finished, morphAnimation.finished]).then(() => { clearTimeout(fallback); release(); });
    return true;
  }

  function render(transition = {}) {
    if (!root) return;
    if (appRenderFrame) { cancelFrame(appRenderFrame); appRenderFrame = 0; }
    queuedAppRender = false;
    if (tabMorphActive) cancelTabMorph();
    const st = Store.get().settings, p = S.product || {}, freeSearchView = S.freeSearch && S.tab === 'compare';
    const pn = $('#panel'); if (!pn) return;
    pn.classList.toggle('wide', !!st.wide);
    const wideLabel = st.wide ? 'باریک‌کردن پنل' : 'عریض‌کردن پنل'; $('#wide').title = wideLabel; $('#wide').setAttribute('aria-label', wideLabel);
    pn.style.width = pn.style.height = pn.style.maxHeight = '';
    $('.wrap').className = 'wrap ' + (st.theme === 'light' ? 'light' : 'dark');
    $('#name').textContent = freeSearchView ? S.searchQuery : Extract.coreTitle(p.title) || p.title || 'نام محصول شناسایی نشد';
    $('#name').setAttribute('title', freeSearchView ? S.searchQuery : p.title || '');
    $('#price').hidden = freeSearchView;
    $('#price').innerHTML = freeSearchView ? '' : p.price ? money(p.price, 20) : '<span class="warn" style="font-size:16px">قیمت شناسایی نشد — «ثبت دستی قیمت»</span>';
    $('#meta').hidden = freeSearchView;
    $('#meta').innerHTML = freeSearchView ? '' : [p.seller ? 'فروشنده: ' + U.esc(p.seller) : '', p.warranty ? 'گارانتی: ' + U.esc(p.warranty) : ''].filter(Boolean).join(' · ');
    const indicatorTargetRect = renderTabs(transition.indicatorRect || null);
    const morphOriginRect = transition.originRect || indicatorTargetRect;
    const body = { compare: tabCompare, history: tabHistory, inspect: tabInspector, watch: tabWatch, settings: tabSettings, log: tabLog }[S.tab]();
    const bodyNode = $('#body');
    bodyNode.setAttribute('aria-labelledby', `tab-${S.tab === 'log' ? 'settings' : S.tab}`);
    const keep = bodyNode.scrollTop;
    const tamper = (typeof CreditGuard !== 'undefined' && CreditGuard.isOk() === false)
      ? '<div class="banner" style="background:rgba(248,113,113,.15);border-color:var(--bad);color:var(--bad)"><b>این نسخه تغییر داده شده است.</b></div>' : '';
    bodyNode.innerHTML = `<div class="body-content">${tamper + (S.banner ? `<div class="banner">${U.esc(S.banner)}</div>` : '') + body}</div>`;
    bodyNode.scrollTop = transition.toTab ? (tabScrollPositions[transition.toTab] || 0) : keep;
    if (transition.toTab && transition.fromTab !== transition.toTab) {
      animateTabContent(bodyNode, morphOriginRect);
    }
    const th = $('[data-set="theme"]'); if (th) { th.checked = st.theme === 'light'; th.setAttribute('aria-checked', String(th.checked)); }
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
    $('#wide').onclick = () => { const st = Store.get().settings; st.wide = !st.wide; Store.save(); render(); requestAnimationFrame(applyPos); };
    $('#body').addEventListener('scroll', () => { const t = $('#body').scrollTop, pn = $('#panel'); if (t > 60) pn.classList.add('compact'); else if (t < 8) pn.classList.remove('compact'); });
    $('#min').onclick = () => setOpen(false); $('#close').onclick = () => { Store.get().settings.open = false; Store.save(); host.style.display = 'none'; };
    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-tab],[data-act],[data-range],[data-rm],[data-collection-icon],[data-source-filter]'); if (!t) return;
      if (t.dataset.collectionIcon) {
        e.preventDefault();
        root.querySelectorAll('[data-collection-icon]').forEach(button => { const selected = button === t; button.setAttribute('aria-pressed', String(selected)); });
        return;
      }
      if (t.dataset.sourceFilter) {
        if (!sourceFilter) sourceFilter = new Set([t.dataset.sourceFilter]);
        else if (sourceFilter.has(t.dataset.sourceFilter)) {
          sourceFilter.delete(t.dataset.sourceFilter);
          if (!sourceFilter.size) sourceFilter = null;
        } else sourceFilter.add(t.dataset.sourceFilter);
        S.showAll = false;
        return render();
      }
      const db = Store.get();
      if (t.dataset.tab) {
        if (t.dataset.tab === S.tab) return;
        const fromTab = S.tab, bodyNode = $('#body'), oldScrollTop = bodyNode.scrollTop;
        tabScrollPositions[fromTab] = oldScrollTop;
        const indicator = $('#tabs').querySelector('.tab-indicator');
        const indicatorRect = indicator?.getBoundingClientRect();
        const originRect = t.getBoundingClientRect();
        S.tab = t.dataset.tab; db.settings.tab = S.tab; Store.save();
        const transition = { indicatorRect, originRect, fromTab, toTab: t.dataset.tab };
        const result = render(transition);
        if (S.tab === 'history' && !S.chart && !S.chartLoading) setTimeout(() => App.loadHistory(), 80);
        return result;
      }
      if (t.dataset.range) { S.range = +t.dataset.range; return render(); }
      if (t.dataset.rm) { const p = db.products[t.dataset.rm]; if (p) p.watch = false; Store.save(); return render(); }
      const a = t.dataset.act;
      if (a === 'copyDiagnostics') return copyDiagnostics();
      else if (a === 'resetSourceFilter') { sourceFilter = null; S.showAll = false; return render(); }
      else if (a === 'compare') App.runCompare();
      else if (a === 'toggleTable') { S.table = !S.table; db.settings.table = S.table; Store.save(); render(); }
      else if (a === 'manualSearch') { S.manualQuery = ($('#q').value || '').trim(); App.runCompare(S.manualQuery ? { query: S.manualQuery, freeSearch: true } : {}); }
      else if (a === 'toggleAll') { S.showAll = !S.showAll; render(); }
      else if (a === 'reread') App.refreshProduct();
      else if (a === 'manual') { const v = Number(U.digits(prompt('قیمت فعلی محصول (تومان):', '') || '').replace(/\D/g, '')); if (v > 0) App.setManualPrice(v); }
      else if (a === 'reloadHistory') App.loadHistory(undefined, { refresh: true });
      else if (a === 'setTarget') {
        const digits = priceInputDigits($('#tgt')?.value || ''), v = digits ? Number(digits) : 0;
        if (!Number.isSafeInteger(v)) { S.banner = 'عدد قیمت هدف معتبر نیست.'; return render(); }
        const p = Store.touchProduct(S.key);
        p.target = v > 0 ? v : null;
        if (v > 0) p.watch = true;
        Store.save();
        S.banner = v > 0 ? `هشدار قیمت ${formatPriceInputValue(digits)} تومان ثبت شد.` : 'قیمت هدف پاک شد.';
        return render();
      }
      else if (a === 'toggleCollectionForm') {
        collectionFormOpen = !collectionFormOpen;
        render();
        if (collectionFormOpen) requestFrame(() => $('#collectionName')?.focus());
        return;
      }
      else if (a === 'toggleCollection') { watchCollectionFilter = t.dataset.collectionId || 'none'; collectionEditId = collectionDeleteId = ''; return render(); }
      else if (a === 'createCollection') {
        const input = $('#collectionName'), name = input?.value.trim().slice(0, 32);
        if (!name) { input?.setAttribute('aria-invalid', 'true'); $('#collectionNameError').hidden = false; input?.focus(); return; }
        const id = 'collection-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
        const iconName = root.querySelector('[data-collection-icon][aria-pressed="true"]')?.dataset.collectionIcon || 'gift';
        (db.collections ||= {})[id] = { id, name, icon: iconName };
        collectionFormOpen = false; collectionEditId = collectionDeleteId = ''; watchCollectionFilter = id;
        Store.save(); return render();
      }
      else if (a === 'editCollection') {
        collectionEditId = t.dataset.collectionId; collectionDeleteId = ''; render(); requestFrame(() => $('#collectionEditName')?.focus()); return;
      }
      else if (a === 'saveCollection') {
        const collection = db.collections?.[t.dataset.collectionId], input = $('#collectionEditName'), name = input?.value.trim().slice(0, 32);
        if (!collection) return;
        if (!name) { input?.setAttribute('aria-invalid', 'true'); $('#collectionEditNameError').hidden = false; input?.focus(); return; }
        collection.name = name; collectionEditId = ''; Store.save(); return render();
      }
      else if (a === 'cancelCollectionEdit') { collectionEditId = ''; return render(); }
      else if (a === 'requestDeleteCollection') { collectionDeleteId = t.dataset.collectionId; collectionEditId = ''; return render(); }
      else if (a === 'cancelCollectionDelete') { collectionDeleteId = ''; return render(); }
      else if (a === 'confirmDeleteCollection') {
        const id = t.dataset.collectionId, collection = db.collections?.[id]; if (!collection) return;
        delete db.collections[id];
        for (const product of Object.values(db.products)) if (product.collectionId === id) product.collectionId = '';
        if (watchCollectionFilter === id) watchCollectionFilter = 'all';
        collectionDeleteId = collectionEditId = '';
        Store.save(); return render();
      }
      else if (a === 'checkNow') { const r = await Alerts.checkAll(true); S.banner = `بررسی انجام شد: ${U.toFa(r.checked)} محصول، ${U.toFa(r.fired)} هشدار`; render(); }
      else if (a === 'expCsv') Exporter.download(`ghafel-${S.key.replace(/[^\w.-]+/g, '_')}.csv`, Exporter.csvFor(S.key, Analysis.valid(App.historyPoints())));
      else if (a === 'expJson') Exporter.download('ghafel-pro13-export.json', Exporter.jsonAll({ chart: S.chart }), 'application/json');
      else if (a === 'impCsv') $('#file').click();
      else if (a === 'clearProd') { if (confirm('تاریخچهٔ محلی این محصول پاک شود؟')) { Store.touchProduct(S.key).local = []; Store.save(); render(); } }
      else if (a === 'clearAll') { if (confirm('همهٔ داده‌ها و تنظیمات افزونه پاک شود؟')) { Store.reset(); render(); } }
    });
    root.addEventListener('input', e => {
      if (e.target.id === 'q') S.manualQuery = e.target.value;
      else if (e.target.id === 'tgt') formatPriceTargetInput(e.target);
      else if (e.target.id === 'ival') e.target.value = U.toFa(U.digits(e.target.value).replace(/\D/g, '').slice(0, 3));
      else if (e.target.id === 'collectionName' || e.target.id === 'collectionEditName') {
        e.target.removeAttribute('aria-invalid');
        const errorId = e.target.id === 'collectionName' ? 'collectionNameError' : 'collectionEditNameError';
        const error = $('#' + errorId); if (error) error.hidden = true;
      }
    });
    root.addEventListener('keydown', e => {
      if (e.target.id === 'q' && e.key === 'Enter') { e.preventDefault(); S.manualQuery = e.target.value.trim(); App.runCompare(S.manualQuery ? { query: S.manualQuery, freeSearch: true } : {}); }
      else if (e.target.id === 'tgt' && e.key === 'Enter') { e.preventDefault(); root.querySelector('[data-act="setTarget"]')?.click(); }
      else if ((e.target.id === 'collectionName' || e.target.id === 'collectionEditName') && e.key === 'Enter') {
        e.preventDefault(); root.querySelector(`[data-act="${e.target.id === 'collectionName' ? 'createCollection' : 'saveCollection'}"]`)?.click();
      }
    });
    root.addEventListener('change', e => {
      const t = e.target, st = Store.get().settings;
      if (t.dataset.sel === 'cand') { App.pickCandidate(t.value); return; }
      else if (t.id === 'tgt') return;
      else if (t.dataset.sel === 'collection') { const product = Store.get().products[t.dataset.key]; if (product) product.collectionId = t.value || ''; Store.save(); return render(); }
      else if (t.dataset.sel === 'snappCity') {
        st.snappCity = Sources.snappshop.cities[t.value] ? t.value : 'tehran'; Store.save();
        S.offers = S.offers.filter(offer => offer.sourceId !== 'snappshop');
        S.sources.snappshop = { status: st.sources.snappshop ? 'idle' : 'off', count: 0, note: 'برای به‌روزرسانی قیمت، دوباره مقایسه کنید' };
        S.banner = 'شهر اسنپ‌شاپ تغییر کرد؛ برای دریافت قیمت شهر جدید دوباره مقایسه را اجرا کنید.';
      }
      else if (t.dataset.sel === 'sort') S.sort = t.value; else if (t.dataset.sel === 'variant') { S.variantIdx = +t.value; S.variantManual = true; }
      else if (t.dataset.ck === 'watch') { Store.touchProduct(S.key).watch = t.checked; Store.save(); }
      else if (t.dataset.set === 'theme') { st.theme = t.checked ? 'light' : 'dark'; Store.save(); }
      else if (t.dataset.set === 'snap') { st.snap = t.checked; Store.save(); }
      else if (t.dataset.set === 'productPageOnly') { st.productPageOnly = t.checked; Store.save(); }
      else if (t.dataset.set === 'alertsEnabled') { st.alerts.enabled = t.checked; Store.save(); }
      else if (t.dataset.src) { st.sources[t.dataset.src] = t.checked; Store.save(); }
      else if (t.id === 'ival') { st.alerts.intervalMin = Math.max(15, Number(U.digits(t.value)) || 60); t.value = U.toFa(st.alerts.intervalMin); Store.save(); }
      else if (t.id === 'file' && t.files[0]) { t.files[0].text().then(tx => { try { const n = Exporter.importLocal(S.key, Exporter.parseCsv(tx)); S.banner = `${U.toFa(n)} نقطه وارد شد (به‌عنوان دادهٔ محلی)`; } catch (er) { S.banner = 'ورود CSV ناموفق: ' + er.message; } render(); }); return; }
      render();
    });
  }

  function mount() {
    if (document.getElementById(HOST_ID)) return;           // the single-panel guarantee
    S = App.state; S.tab = Store.get().settings.tab || 'compare'; S.table = !!Store.get().settings.table; host = document.createElement('div'); host.id = HOST_ID; document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="wrap dark"><button type="button" id="pill" aria-label="بازکردن پنل تخفیف‌سنج" aria-expanded="false" title="تخفیف‌سنج — بکشید تا جابه‌جا شود (Alt+Shift+G)">${icon('tag')}<span>تخفیف‌سنج</span></button>
      <section id="panel"><header><div class="brand">تخفیف‌سنج</div><button type="button" class="x x3" id="wide" title="عریض‌کردن پنل" aria-label="عریض‌کردن پنل">${icon('expand')}</button><button type="button" class="x x2" id="min" title="جمع‌کردن پنل" aria-label="جمع‌کردن پنل">${icon('minus')}</button><button type="button" class="x" id="close" title="بستن پنل" aria-label="بستن پنل">${icon('close')}</button></header>
      <div class="hero"><div class="hero-main"><div class="name" id="name"></div><div class="price" id="price"></div></div><div class="meta" id="meta"></div></div>
      <div class="workspace"><nav class="tabs" id="tabs" role="group" aria-label="بخش‌های اصلی"></nav><div class="body" id="body" role="tabpanel"></div></div>
      </section></div>`;
    bind(); App.on(queueAppRender); render(); requestAnimationFrame(applyPos);
    addEventListener('resize', () => { applyPos(); positionTabIndicator(); });
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
    let lastHref = '', refreshTimer = null;
    const cancelRefresh = () => { if (refreshTimer !== null) { clearTimeout(refreshTimer); refreshTimer = null; } };
    const scheduleRefresh = href => {
      cancelRefresh();
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        const should = !Store.get().settings.productPageOnly || Extract.looksLikeProductPage();
        if (location.href === href && should && document.getElementById(UI.HOST_ID)) App.refreshProduct();
      }, 1200);
    };
    const check = () => {
      const should = !Store.get().settings.productPageOnly || Extract.looksLikeProductPage();
      const mounted = !!document.getElementById(UI.HOST_ID);
      const justMounted = should && !mounted;
      if (justMounted) UI.mount();
      if (!should && mounted) { UI.unmount(); cancelRefresh(); }
      const href = location.href, changed = href !== lastHref;
      if (changed) lastHref = href;
      if (should && (changed || justMounted)) {
        // setOpen(true) refreshes immediately when the panel mounts already open.
        if (justMounted && Store.get().settings.open) cancelRefresh();
        else scheduleRefresh(href);
      } else if (!should && changed) cancelRefresh();
    };
    const run = () => { try { check(); } catch (e) { Log.error('main', e.message); } };
    setTimeout(run, 600); setInterval(run, 1500);
    Log.info('main', 'تخفیف‌سنج 15.2.48 آماده شد');
  }
  return { init };
})();


Main.init();
})();
