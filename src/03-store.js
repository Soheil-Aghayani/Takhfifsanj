/* ===== Store: persistent data (GM storage with localStorage fallback), single JSON document ===== */
const Store = (() => {
  const KEY = 'ghafel13:db';
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
  return { load, get, save, touchProduct, recordLocal, reset, DEFAULT, KEY };
})();
