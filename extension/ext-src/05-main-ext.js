/* ===== Main (content-script build): single instance, top frame only, SPA-aware, awaits Store before first mount ===== */
const Main = (() => {
  async function init() {
    if (window.top !== window.self) return;
    if (window.__GHAFEL_PRO_EXT__) return; window.__GHAFEL_PRO_EXT__ = true;
    await Store.ready; await CreditGuard.verify();
    document.addEventListener('keydown', e => { if (e.altKey && e.shiftKey && e.code === 'KeyG') { e.preventDefault(); UI.toggle(); } });
    Ext.runtime.onMessage.addListener((msg) => { if (msg && msg.type === 'ghafel:toggle-panel') UI.toggle(); });
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
    Log.info('main', 'GHAFEL PRO (Extension) آماده شد' + (CreditGuard.isOk() ? '' : ' — هشدار: اعتبار سازنده تغییر کرده است'));
  };
  return { init };
})();
