/* ===== Background entry: relays content-script network requests, runs alarm-based price checks. ===== */
Ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'ghafel:net') {
    Net.request(msg.url, msg.opts || {}).then(text => sendResponse({ text, status: 200 })).catch(e => sendResponse({ error: e.message, status: e.status, retryAfterMs: e.retryAfterMs }));
    return true; // keep the message channel open for the async response (Chrome requirement)
  }
  if (msg.type === 'ghafel:check-now') { AlertsBG.checkAll(!!msg.force).then(sendResponse); return true; }
});
AlertsBG.start();
Log.info('background', 'GHAFEL PRO background آماده شد');
