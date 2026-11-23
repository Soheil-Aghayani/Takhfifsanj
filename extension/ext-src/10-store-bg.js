/* ===== Store (background): minimal — the background does a fresh read-modify-write each alarm tick, no in-memory cache needed ===== */
const StoreBG = (() => {
  const KEY = 'ghafel:db';
  const DEFAULT = () => ({ v: 1, settings: { alerts: { enabled: true, intervalMin: 60 } }, products: {} });
  async function get() { try { const r = await Ext.storage.get(KEY); return (r && r[KEY]) || DEFAULT(); } catch (e) { Log.error('store-bg', e.message); return DEFAULT(); } }
  async function set(db) { try { await Ext.storage.set({ [KEY]: db }); } catch (e) { Log.error('store-bg', e.message); } }
  return { get, set };
})();
