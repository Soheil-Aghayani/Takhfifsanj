document.getElementById('toggle').onclick = async () => {
  const api = (typeof browser !== 'undefined') ? browser : chrome;
  const [tab] = await (api.tabs.query ? api.tabs.query({ active: true, currentWindow: true }) : new Promise(r => chrome.tabs.query({ active: true, currentWindow: true }, r)));
  if (tab && tab.id) { try { await api.tabs.sendMessage(tab.id, { type: 'ghafel:toggle-panel' }); } catch (e) { /* no content script on this page (e.g. chrome:// or about:) */ } }
  window.close();
};
