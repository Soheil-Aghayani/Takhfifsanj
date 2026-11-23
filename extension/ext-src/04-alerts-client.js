/* ===== Alerts (content-script build): the real periodic check now lives in the background (chrome.alarms, works
   even with no tab open — unlike the Tampermonkey build). This is just the "check now" button's messenger. ===== */
const Alerts = (() => {
  async function checkAll(force = false) {
    try { const r = await Ext.runtime.sendMessage({ type: 'ghafel:check-now', force }); return r || { checked: 0, fired: 0 }; }
    catch (e) { Log.error('alerts', e.message); return { checked: 0, fired: 0 }; }
  }
  return { checkAll, start() {} };
})();
