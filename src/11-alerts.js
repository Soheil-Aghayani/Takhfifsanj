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
