/* ===== Shim: one promise-based API for Chrome (callback MV3) and Firefox (native promise MV3) ===== */
const Ext = (() => {
  const hasBrowser = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id;
  const api = hasBrowser ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (!api) throw new Error('Ext: no WebExtension API found');
  const wrap = (obj, method) => (...a) => hasBrowser ? obj[method](...a) : new Promise((res, rej) => { try { obj[method](...a, r => chrome.runtime.lastError ? rej(new Error(chrome.runtime.lastError.message)) : res(r)); } catch (e) { rej(e); } });
  const storage = {
    get: k => wrap(api.storage.local, 'get')(k),
    set: o => wrap(api.storage.local, 'set')(o),
    remove: k => wrap(api.storage.local, 'remove')(k)
  };
  const runtime = {
    sendMessage: msg => wrap(api.runtime, 'sendMessage')(msg),
    onMessage: api.runtime.onMessage,
    getURL: p => api.runtime.getURL(p),
    id: api.runtime.id
  };
  const alarms = api.alarms ? { create: (name, info) => api.alarms.create(name, info), onAlarm: api.alarms.onAlarm, clear: name => wrap(api.alarms, 'clear')(name) } : null;
  const notifications = api.notifications ? { create: (id, opts) => wrap(api.notifications, 'create')(id, opts), onClicked: api.notifications.onClicked } : null;
  const tabs = api.tabs ? { create: opts => wrap(api.tabs, 'create')(opts), query: q => wrap(api.tabs, 'query')(q), sendMessage: (id, msg) => wrap(api.tabs, 'sendMessage')(id, msg) } : null;
  const action = api.action || api.browserAction || null;
  return { isFirefox: hasBrowser, storage, runtime, alarms, notifications, tabs, action, raw: api };
})();
