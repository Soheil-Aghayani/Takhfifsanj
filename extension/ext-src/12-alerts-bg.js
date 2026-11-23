/* ===== Alerts (background): runs via chrome.alarms — independent of any open tab (fixes the Tampermonkey limitation). ===== */
const AlertsBG = (() => {
  const ALARM = 'ghafel-price-check';
  async function currentPriceFor(p) {
    if (!/digikala\.com$/.test(p.host) || !p.pid) return null;
    const d = await Sources.dk.product(p.pid, p.variantId);
    return d && d.chosen ? { price: d.chosen.price, src: 'digikala-api:variant' } : null;
  }
  function notify(p, price) {
    const id = 'ghafel:' + p.key;
    Ext.notifications.create(id, { type: 'basic', iconUrl: Ext.runtime.getURL('icons/icon128.png'), title: 'GHAFEL PRO — هشدار قیمت', message: `${(p.title || p.key).slice(0, 80)}\nقیمت فعلی ${price.toLocaleString('fa-IR')} تومان (هدف ${Number(p.target).toLocaleString('fa-IR')})`, priority: 2 }).catch(e => Log.error('alerts-bg', e.message));
    notifyUrls[id] = p.url;
  }
  const notifyUrls = {};
  if (Ext.notifications && Ext.notifications.onClicked) Ext.notifications.onClicked.addListener(id => { if (notifyUrls[id]) Ext.tabs.create({ url: notifyUrls[id] }); });
  function evaluate(p, price) {
    if (!p.watch || !(p.target > 0) || !(price > 0) || price > p.target) return false;
    const day = 24 * 3600e3;
    if (!p.notifiedAt || price < (p.notifiedPrice || Infinity) || Date.now() - p.notifiedAt > day) { p.notifiedAt = Date.now(); p.notifiedPrice = price; notify(p, price); return true; }
    return false;
  }
  async function checkAll(force = false) {
    const db = await StoreBG.get(); const a = db.settings.alerts || { enabled: true, intervalMin: 60 };
    if (!a.enabled && !force) return { checked: 0, fired: 0 };
    let checked = 0, fired = 0;
    for (const p of Object.values(db.products).filter(x => x.watch)) {
      try { const r = await currentPriceFor(p); if (r) { checked++; recordLocal(p, r.price, r.src, Date.now(), p.variantId); if (evaluate(p, r.price)) fired++; } else if (p.lastPrice && evaluate(p, p.lastPrice)) fired++; }
      catch (e) { Log.warn('alerts-bg', `${p.key}: ${e.message}`); }
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    }
    await StoreBG.set(db); Log.info('alerts-bg', `بررسی ${checked} محصول، ${fired} هشدار`); return { checked, fired };
  }
  function recordLocal(p, price, src, ts = Date.now(), variantId = '') {
    const last = p.local[p.local.length - 1]; p.lastPrice = price; p.lastTs = ts; p.lastSource = src;
    if (last && last.p === price && String(last.variantId || '') === String(variantId || '') && ts - last.t < 6 * 3600e3) return; p.local.push({ t: ts, p: price, src, variantId: String(variantId || '') }); if (p.local.length > 1500) p.local.splice(0, p.local.length - 1500);
  }
  function start() {
    Ext.alarms.create(ALARM, { periodInMinutes: 60, delayInMinutes: 1 });
    Ext.alarms.onAlarm.addListener(al => { if (al.name === ALARM) checkAll(false).catch(e => Log.error('alerts-bg', e.message)); });
  }
  return { start, checkAll, ALARM };
})();
