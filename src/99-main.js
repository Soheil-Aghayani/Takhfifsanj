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
    Log.info('main', 'تخفیف‌سنج 15.2.44 آماده شد');
  }
  return { init };
})();
