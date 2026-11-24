/* ===== Store (content-script build): same public API as the userscript version, backed by chrome.storage.local ===== */
const Store = (() => {
  const KEY = 'ghafel:db';
  const DEFAULT = () => ({ v: 2, settings: { theme: 'dark', productPageOnly: true, sources: { torob: true, emalls: true, basalam: true, snappshop: true }, alerts: { enabled: true, intervalMin: 60 }, snappCity: 'tehran', pos: null, open: false, tab: 'compare', table: false, wide: false, size: null, snap: true }, products: {}, collections: {} });
  function merge(base, src) { for (const k of Object.keys(src || {})) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], src[k]); else base[k] = src[k]; } return base; }
  let db = DEFAULT();
  let ready = Ext.storage.get(KEY).then(r => { try { db = r && r[KEY] ? merge(DEFAULT(), r[KEY]) : DEFAULT(); if (!db.settings.sources || typeof db.settings.sources !== 'object') db.settings.sources = { ...DEFAULT().settings.sources }; if (!db.settings.snappCity) db.settings.snappCity = 'tehran'; if (Number(db.v) < 2) { Object.assign(db.settings.sources, { emalls: true, basalam: true, snappshop: true }); db.v = 2; Ext.storage.set({ [KEY]: db }).catch(e => Log.error('store', 'migration save failed: ' + e.message)); } db.collections ||= {}; for (const product of Object.values(db.products || {})) if (product && typeof product === 'object' && !('collectionId' in product)) product.collectionId = ''; } catch (e) { Log.error('store', 'corrupt db: ' + e.message); db = DEFAULT(); } }).catch(e => { Log.error('store', 'load failed: ' + e.message); });
  const get = () => db;
  function save() { Ext.storage.set({ [KEY]: db }).catch(e => Log.error('store', 'save failed: ' + e.message)); }
  function touchProduct(key, init) { const p = db.products[key] ||= { key, host: '', pid: '', title: '', url: '', variantTitle: '', local: [], watch: false, target: null, collectionId: '', lastPrice: null, lastTs: 0, notifiedAt: 0, lastSource: '' }; if (init) Object.assign(p, init); return p; }
  const MAX_LOCAL = 1500, MIN_GAP = 6 * 3600e3;
  function recordLocal(p, price, source, ts = Date.now(), variantId = '') {
    if (!(price > 0)) return false; const last = p.local[p.local.length - 1];
    p.lastPrice = price; p.lastTs = ts; p.lastSource = source;
    if (last && last.p === price && String(last.variantId || '') === String(variantId || '') && ts - last.t < MIN_GAP) return false;
    p.local.push({ t: ts, p: price, src: source, variantId: String(variantId || '') }); if (p.local.length > MAX_LOCAL) p.local.splice(0, p.local.length - MAX_LOCAL);
    return true;
  }
  function reset() { db = DEFAULT(); save(); }
  return { ready, load: () => db, get, save, touchProduct, recordLocal, reset, DEFAULT, KEY };
})();
