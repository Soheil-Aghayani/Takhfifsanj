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
    Log.info('main', 'تخفیف‌سنج 15.2.23 آماده شد');
  }
  return { init };
})();
