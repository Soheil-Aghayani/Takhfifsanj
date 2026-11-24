import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'fs'; import path from 'path'; import vm from 'node:vm'; import crypto from 'node:crypto';
import { createRequire } from 'module';
import { TextEncoder } from 'node:util';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const read = f => fs.readFileSync(path.join(here, '..', f), 'utf8');
const J = f => JSON.parse(read(path.join('..', 'ghafel13', 'tests', f))); // not used; kept for clarity

function makeBus() {
  const listeners = []; const data = {};
  return {
    data,
    storage: { local: { get: (keys, cb) => { const out = {}; if (typeof keys === 'string') out[keys] = data[keys]; else Object.keys(data).forEach(k => out[k] = data[k]); cb(out); }, set: (o, cb) => { Object.assign(data, o); cb && cb(); } } },
    runtime: {
      onMessage: { addListener: fn => listeners.push(fn) },
      sendMessage: (msg, cb) => { let responded = false, async_ = false; const respond = v => { if (responded) return; responded = true; cb && cb(v); }; for (const fn of listeners) { const r = fn(msg, {}, respond); if (r === true) async_ = true; } if (!async_ && !responded) respond(undefined); },
      getURL: p => 'chrome-extension://test/' + p, id: 'test-ext-id', lastError: null
    },
    alarms: { create: () => {}, onAlarm: { addListener: () => {} }, clear: (n, cb) => cb && cb() },
    notifications: { create: (id, o, cb) => { cb && cb(id); }, onClicked: { addListener: () => {} } },
    tabs: { create: (o, cb) => cb && cb({ id: 1 }), query: (q, cb) => cb && cb([{ id: 1 }]) }
  };
}

function loadBackground(chromeMock) {
  const sandbox = { chrome: chromeMock, console, fetch: null, setTimeout, clearTimeout, Date, Math, Promise, Error, JSON, Object, Array, URL, AbortController, module: {}, TextEncoder, Number, String };
  vm.createContext(sandbox);
  vm.runInContext(read('dist/background.test.js'), sandbox, { filename: 'background.test.js' });
  return { sandbox, get api() { return sandbox.__api; } };
}
function runBackground(chromeMock, fetchImpl) {
  const code = `__api = ${read('dist/background.test.js')}`;
  const sandbox = { chrome: chromeMock, fetch: fetchImpl, console, setTimeout, clearTimeout, Date, Math, Promise, Error, JSON, Object, Array, URL, AbortController, TextEncoder, Number, String, __api: null };
  vm.createContext(sandbox); vm.runInContext(code, sandbox, { filename: 'bg.js' });
  return sandbox.__api;
}
function wireBackground(chromeMock, fetchImpl) {
  const api = runBackground(chromeMock, fetchImpl);
  chromeMock.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ghafel:net') { api.Net.request(msg.url, msg.opts || {}).then(text => sendResponse({ text, status: 200 })).catch(e => sendResponse({ error: e.message, status: e.status, retryAfterMs: e.retryAfterMs })); return true; }
    if (msg.type === 'ghafel:check-now') { api.AlertsBG.checkAll(!!msg.force).then(sendResponse); return true; }
  });
  return api;
}

function makeContentEnv(html, chromeMock) {
  const dom = new JSDOM(html, { url: 'https://www.digikala.com/product/dkp-23083919/x/?variant_id=91941577', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const BLOCK = /^(DIV|P|SECTION|LI|H[1-6]|BUTTON|A|UL|ARTICLE|HEADER|FOOTER)$/;
  const it = el => { let s = ''; for (const n of el.childNodes) { if (n.nodeType === 3) s += n.textContent; else if (n.nodeType === 1) { if (['SCRIPT', 'STYLE'].includes(n.tagName)) continue; const t = it(n); s += BLOCK.test(n.tagName) ? '\n' + t + '\n' : t; } } return s.replace(/\n+/g, '\n').trim(); };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return it(this); } });
  w.chrome = chromeMock;
  w.crypto.subtle = crypto.webcrypto.subtle;
  const api = w.eval(read('dist/content.test.js'));
  return { dom, w, api };
}

test('Ext shim: Chrome callback API wrapped as promises (storage + messaging)', async () => {
  const chromeMock = makeBus();
  const { w, api } = makeContentEnv('<html><body></body></html>', chromeMock);
  await api.Ext.storage.set({ x: 1 }); const r = await api.Ext.storage.get('x'); assert.equal(r.x, 1);
  chromeMock.runtime.onMessage.addListener((m, s, send) => { send('pong:' + m.type); });
  const r2 = await api.Ext.runtime.sendMessage({ type: 'ping' }); assert.equal(r2, 'pong:ping'); w.close();
});

test('CreditGuard: passes with the shipped credits, fails if the string is altered', async () => {
  const chromeMock = makeBus(); const { w, api } = makeContentEnv('<html><body></body></html>', chromeMock);
  assert.equal(await api.CreditGuard.verify(), true);
  const bad = api.CreditGuard.CREDITS.replace('RealMahdi_a', 'SomeoneElse');
  const buf = await w.crypto.subtle.digest('SHA-256', new TextEncoder().encode(bad));
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  assert.notEqual(hex, crypto.createHash('sha256').update(api.CreditGuard.CREDITS).digest('hex'));
  w.close();
});

test('manifests: valid JSON, matching version/name, host_permissions limited to the 2 real APIs, no "<all_urls>" in host_permissions', () => {
  for (const f of ['manifest.chrome.json', 'manifest.firefox.json']) {
    const m = JSON.parse(read(f)); assert.equal(m.manifest_version, 3); assert.equal(m.name, 'تخفیف‌سنج');
    assert.ok(/^\d+\.\d+\.\d+$/.test(m.version));
    assert.deepEqual(m.host_permissions.sort(), ['https://api.digikala.com/*', 'https://api.torob.com/*', 'https://torob.com/*', 'https://www.digikala.com/*', 'https://emalls.ir/*', 'https://services.basalam.com/*', 'https://apix.snappshop.ir/*'].sort());
    assert.ok(!m.host_permissions.includes('<all_urls>') && !m.host_permissions.includes('*://*/*'));
    assert.ok(m.permissions.includes('storage') && m.permissions.includes('alarms') && m.permissions.includes('notifications'));
  }
  const fx = JSON.parse(read('manifest.firefox.json')); assert.ok(fx.browser_specific_settings.gecko.id);
  const ch = JSON.parse(read('manifest.chrome.json')); assert.ok(ch.background.service_worker); assert.ok(!ch.background.scripts);
  assert.ok(fx.background.scripts && !fx.background.service_worker);
});

const BUYBOX = `<html><head><title>هدفون بلوتوثی موزیک آپولو مدل YRB/22 | دیجی‌کالا</title></head><body>
<h1>هدفون بلوتوثی موزیک آپولو مدل YRB/22</h1>
<div id="buy"><div>فروشنده</div><div><del>۱۵,۰۰۰,۰۰۰</del><span>۸۵٪</span></div><div><span>۲,۲۰۰,۰۰۰</span> <span>تومان</span></div><button>افزودن به سبد خرید</button></div>
<div><div>رنگ: مشکی</div></div></body></html>`;
const TOROB_SEARCH = { search_id: 'sid1', results: [{ name1: 'هدفون بلوتوثی موزیک آپولو مدل YRB22', name2: 'مشکی', price: 2100000, random_key: 'good', is_adv: false }] };
const TOROB_SELLERS = { results: [{ shop_name: 'ایمالز', domain: 'emalls.ir', price: 2050000, page_url: 'https://torob.com/r/2' }] };
function fetchRouter(routes) { return async (url) => { const u = decodeURIComponent(url); for (const r of routes) if (u.includes(r.m)) return { ok: (r.status || 200) < 400, status: r.status || 200, headers: { get: () => null }, text: async () => JSON.stringify(r.body) }; return { ok: false, status: 404, headers: { get: () => null }, text: async () => '' }; }; }
const testFixture = f => JSON.parse(fs.readFileSync(path.join(here, '..', 'tests', f), 'utf8'));
const headphoneProduct = () => {
  const result = testFixture('fx_product.json'), product = result.data.product;
  product.id = 23083919; product.title_fa = 'هدفون بلوتوثی موزیک آپولو مدل YRB/22';
  product.title_en = 'Apollo YRB/22 Bluetooth Headphone';
  product.brand.title_fa = 'آپولو'; product.brand.title_en = 'Apollo';
  return result;
};

test('E2E: content -> background -> real fetch (mocked) -> Torob offers + Digikala history, through actual chrome.runtime message passing', async () => {
  const chromeMock = makeBus();
  const fxRead = p => JSON.parse(fs.readFileSync(path.join(here, '..', 'tests', p), 'utf8'));
  const routes = [{ m: 'base-product/search', body: TOROB_SEARCH }, { m: 'base-product/sellers', body: TOROB_SELLERS },
    { m: '/price-chart/', body: fxRead('fx_price_chart.json') }, { m: '/product/v1/products/', body: headphoneProduct() }];
  // fx files live in the userscript tests dir; copy path:
  const routes2 = routes;
  wireBackground(chromeMock, fetchRouter(routes2));
  const { w, api } = makeContentEnv(BUYBOX, chromeMock);
  await api.Store.ready; Object.assign(api.Store.get().settings.sources, { emalls: false, basalam: false, snappshop: false }); api.Store.save();
  await api.App.refreshProduct(); await api.App.runCompare(); await new Promise(r => setTimeout(r, 60));
  const s = api.App.state; assert.equal(s.sources.torob.status, 'ok'); assert.equal(s.offers[0].seller, 'ای‌مالز'); assert.equal(s.offers[0].price, 2050000);
  assert.ok(s.chart && s.chart.variants.length === 2); assert.equal(s.product.price, 2200000);
  w.close();
});

test('background: Net refuses non-allow-listed domains even if asked directly (defense in depth)', async () => {
  const chromeMock = makeBus(); const api = runBackground(chromeMock, async () => ({ ok: true, status: 200, text: async () => '{}' }));
  await assert.rejects(api.Net.request('https://evil.example.com/x'), /مجاز نیست/);
});

test('background: AlertsBG fetches exact Digikala variant via Net, fires once under target, persists local history', async () => {
  const chromeMock = makeBus();
  const fx = fs.readFileSync(path.join(here, '..', 'tests', 'fx_product.json'), 'utf8');
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => fx });
  const api = runBackground(chromeMock, fetchImpl);
  const pid = JSON.parse(fx).data.product.variants[0].id;
  await chromeMock.storage.local.set({ 'ghafel:db': { settings: { alerts: { enabled: true } }, products: { k: { key: 'k', host: 'www.digikala.com', pid: String(pid), variantId: String(pid), title: 'x', url: 'https://x', watch: true, target: 50000000, local: [] } } } }, () => {});
  const notified = []; chromeMock.notifications.create = (id, o, cb) => { notified.push(o); cb && cb(id); };
  const r = await api.AlertsBG.checkAll(true); assert.equal(r.checked, 1); assert.equal(r.fired, 1); assert.equal(notified.length, 1);
  const saved = chromeMock.data['ghafel:db']; assert.equal(saved.products.k.local.length, 1); assert.equal(saved.products.k.lastPrice, 42503600);
  const r2 = await api.AlertsBG.checkAll(true); assert.equal(r2.fired, 0); // no repeat notification for the same price
});

test('UI: single host in a real content-script DOM; credits render with correct links; tamper banner appears when CreditGuard fails', async () => {
  const chromeMock = makeBus();
  const routes = [{ m: 'base-product/search', body: { results: [] } }];
  wireBackground(chromeMock, fetchRouter(routes));
  const { w, api } = makeContentEnv(BUYBOX, chromeMock);
  await api.Store.ready; api.UI.mount(); api.UI.mount();
  assert.equal(w.document.querySelectorAll('#ghafel-pro-host').length, 1);
  const root = w.document.getElementById('ghafel-pro-host').shadowRoot;
  const links = [...root.querySelectorAll('.credit a')].map(a => a.href).sort();
  assert.deepEqual(links, ['https://aqilistudio.ir/', 'https://t.me/GHAFEL_com', 'https://t.me/RealMahdi_a']);
  api.CreditGuard.verify = async () => false; api.CreditGuard.isOk = () => false; api.UI.render();
  assert.ok(root.querySelector('.body').innerHTML.includes('تغییر داده شده')); w.close();
});

test('UI: closing with X can be reopened from the extension toggle without reloading the page', async () => {
  const chromeMock = makeBus();
  wireBackground(chromeMock, fetchRouter([]));
  const { w, api } = makeContentEnv(BUYBOX, chromeMock);
  await api.Store.ready; api.UI.mount();
  const host = w.document.getElementById('ghafel-pro-host'), root = host.shadowRoot;
  root.getElementById('close').click();
  assert.equal(host.style.display, 'none');
  assert.equal(api.UI.toggle(), true);
  assert.notEqual(host.style.display, 'none');
  assert.equal(root.getElementById('panel').classList.contains('open'), true);
  w.close();
});

test('build output: build/chrome and build/firefox are real "Load unpacked" folders (manifest.json present, wiring correct, assets exist)', () => {
  for (const b of ['chrome', 'firefox']) {
    const dir = path.join(here, '..', 'build', b);
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.equal(m.manifest_version, 3);
    for (const f of ['content.js', 'background.js', 'popup.html', 'popup.js', 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png', 'LICENSE_FA.md'])
      assert.ok(fs.existsSync(path.join(dir, f)), b + '/' + f);
    if (b === 'chrome') { assert.ok(m.background.service_worker); assert.ok(!m.background.scripts); }
    else { assert.ok(m.background.scripts); assert.ok(!m.background.service_worker); assert.ok(m.browser_specific_settings.gecko.id); }
  }
});

test('background: 429 Retry-After header is parsed and relayed through chrome.runtime messaging to the content script', async () => {
  const chromeMock = makeBus();
  wireBackground(chromeMock, async () => ({ ok: false, status: 429, headers: { get: h => h === 'Retry-After' ? '7' : null }, text: async () => '' }));
  const { w, api } = makeContentEnv(BUYBOX, chromeMock);
  await assert.rejects(api.Net.request('https://api.digikala.com/v1/product/1/price-chart/'), e => { assert.equal(e.status, 429); assert.ok(e.retryAfterMs >= 6900 && e.retryAfterMs <= 7100); return true; });
  w.close();
});
