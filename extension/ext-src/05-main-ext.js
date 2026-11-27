/* ===== Main (content-script build): single instance, top frame only, SPA-aware, awaits Store before first mount ===== */
const Main = (() => {
  async function init() {
    if (window.top !== window.self) return;
    if (window.__GHAFEL_PRO_EXT__) return; window.__GHAFEL_PRO_EXT__ = true;
    await Store.ready; await CreditGuard.verify();
    document.addEventListener('keydown', e => { if (e.altKey && e.shiftKey && e.code === 'KeyG') { e.preventDefault(); UI.toggle(); } });
    Ext.runtime.onMessage.addListener((msg) => { if (msg && msg.type === 'ghafel:toggle-panel') UI.toggle(); });
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
    Log.info('main', 'GHAFEL PRO (Extension) آماده شد' + (CreditGuard.isOk() ? '' : ' — هشدار: اعتبار سازنده تغییر کرده است'));
  };
  return { init };
})();
