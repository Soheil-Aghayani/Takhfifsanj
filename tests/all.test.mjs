import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = fs.readFileSync(path.join(here, '../dist/ghafel13.test.js'), 'utf8');
const old = fs.readFileSync(path.join(here, 'old_engine_exports.js'), 'utf8');
const J = f => JSON.parse(fs.readFileSync(path.join(here, f), 'utf8'));

function makeEnv(html = '<html><body></body></html>', url = 'https://www.digikala.com/product/dkp-23083919/x/?variant_id=91941577', gm = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  // jsdom has no innerText: block-aware polyfill
  const BLOCK = /^(DIV|P|SECTION|LI|H[1-6]|BUTTON|A|UL|ARTICLE|HEADER|FOOTER)$/;
  const it = el => { let s = ''; for (const n of el.childNodes) { if (n.nodeType === 3) s += n.textContent; else if (n.nodeType === 1) { if (['SCRIPT', 'STYLE'].includes(n.tagName)) continue; const t = it(n); s += BLOCK.test(n.tagName) ? '\n' + t + '\n' : t; } } return s.replace(/\n+/g, '\n').trim(); };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return it(this); } });
  const store = {}; w.GM_getValue = (k, d) => (k in store ? store[k] : d); w.GM_setValue = (k, v) => { store[k] = v; };
  w.__store = store; Object.assign(w, gm);
  w.eval(old);
  const api = w.eval(bundle);
  return { dom, w, api, old: w.__old };
}

test('Jalali -> Gregorian matches jdatetime for 1395..1415 (every day)', () => {
  const { api } = makeEnv(); const fx = J('fx_jalali.json'); let n = 0;
  for (const [j, g] of Object.entries(fx)) { const t = api.U.jalaliToTime(j); assert.equal(api.U.isoDay(t), g, j); n++; }
  assert.ok(n > 7000);
});

test('differential: normalize / price parsers / title cleaner identical to 8.7', () => {
  const { api, old } = makeEnv();
  const samples = ['هدفون بلوتوثی موزیک آپولو مدل YRB/22', 'گوشی موبایل سامسونگ Galaxy A07 ظرفیت 64 گیگابایت | دیجی‌کالا', 'خرید شیر ۱ لیتری با قیمت روز', '۲٬۲۰۰٬۰۰۰ تومان', '15,000,000 ریال و 2,200,000 تومان', 'قیمت ۱۲۳۴۵ ت', 'كتاب يك', 'مدل TWSDX C22 اپولو - ۲۵۰ گرم - ترب'];
  for (const s of samples) {
    assert.equal(api.U.normalize(s), old.norm(s)); assert.deepEqual(api.U.pricesWithCurrency(s), old.cur(s)); assert.deepEqual(api.U.numbersIn(s), old.nums(s));
    assert.equal(api.Extract.cleanTitle(s), old.clean(s));
  }
  for (const d of ['digikala.com', 'ترب', 'www.emalls.ir', 'foo.com', 'Technolife', 'باسلام']) assert.equal(api.Extract.matchKnownSite(d), old.known(d));
});

test('differential: baseline match rule identical to 8.7 on a grid of pairs', () => {
  const { api, old } = makeEnv();
  const names = ['هدفون بلوتوثی موزیک آپولو مدل YRB/22', 'هدفون بلوتوث موزیک آپولو مدل TWSDX C22', 'گوشی سامسونگ Galaxy A07 64GB', 'Samsung Galaxy A07 64 GB گوشی موبایل', 'شیر کم چرب ۱ لیتری', 'شیر پرچرب ۲ لیتری', 'ماگ سرامیکی', 'هدفون آپولو YRB22 مشکی'];
  for (const a of names) for (const b of names) assert.equal(api.Match.baseline(a, b), old.base(a, b), a + ' | ' + b);
});

test('match: screenshot false-positive (YRB/22 vs TWSDX C22) is rejected; same model accepted', () => {
  const { api } = makeEnv(); const src = 'هدفون بلوتوثی موزیک آپولو مدل YRB/22';
  const bad = api.Match.evaluate(src, 'هدفون بلوتوث موزیک آپولو مدل TWSDX C22');
  assert.equal(bad.ok, false); assert.ok(bad.flags.includes('model-mismatch'));
  const good = api.Match.evaluate(src, 'هدفون بلوتوثی آپولو مدل YRB22 مشکی');
  assert.equal(good.ok, true); assert.notEqual(good.level, 'low'); assert.ok(good.score >= 0.65);
});

test('match: a known competing cable brand cannot pass on the same numeric model', () => {
  const { api } = makeEnv();
  const src = 'کابل USB-C روموس مدل 3241 طول 1.2 متر';
  const bad = api.Match.evaluate(src, 'کابل USB-C Baseus مدل 3241 طول 1.2 متر', { strict: true, brandAliases: ['روموس', 'Romoss'] });
  const good = api.Match.evaluate(src, 'کابل USB-C ROMOSS مدل 3241 طول 1.2 متر', { strict: true, brandAliases: ['روموس', 'Romoss'] });
  assert.equal(bad.ok, false); assert.ok(bad.flags.includes('brand-mismatch'));
  assert.equal(good.ok, true);
});

test('match: same generic model cannot bridge unrelated audio types or unknown brands', () => {
  const { api } = makeEnv();
  const source = 'اسپیکر بلوتوثی هیسکا مدل B60';
  const aliases = ['هیسکا', 'Hiska'];
  const wrongType = api.Match.evaluate(source, 'هدست مخصوص بازی بلوتوثی اونیکوما مدل B60', { strict: true, brandAliases: aliases });
  const wrongBrand = api.Match.evaluate(source, 'اسپیکر بلوتوثی اونیکوما مدل B60', { strict: true, brandAliases: aliases });
  const right = api.Match.evaluate(source, 'اسپیکر بلوتوثی هیسکا مدل B60', { strict: true, brandAliases: aliases });
  const weakContext = api.Match.evaluate('محصول بلوتوثی مدل B60', 'کالای بلوتوثی مدل B60', { strict: true });
  assert.equal(wrongType.ok, false); assert.ok(wrongType.flags.includes('category-mismatch'));
  assert.equal(wrongBrand.ok, false); assert.ok(wrongBrand.flags.includes('brand-mismatch'));
  assert.equal(weakContext.ok, false); assert.ok(weakContext.flags.includes('low-context'));
  assert.equal(right.ok, true);
});

test('match: spec mismatch (capacity) rejected, model w/o code flagged', () => {
  const { api } = makeEnv();
  assert.equal(api.Match.evaluate('گوشی سامسونگ Galaxy A07 ظرفیت 64 گیگابایت', 'گوشی سامسونگ Galaxy A07 ظرفیت 128 گیگابایت').ok, false);
  assert.equal(api.Match.evaluate('گوشی سامسونگ Galaxy A07 ظرفیت 64 گیگابایت', 'گوشی موبایل سامسونگ Galaxy A07 ظرفیت 64 گیگابایت').ok, true);
  const nc = api.Match.evaluate('شیر کم چرب میهن یک لیتری', 'شیر کم چرب میهن یک لیتری'); assert.ok(nc.flags.includes('no-model-code')); assert.ok(nc.score <= 0.85);
});

test('Digikala price-chart parser on the REAL API fixture: rial->toman, Jalali dates, gaps kept', () => {
  const { api } = makeEnv(); const c = api.Sources.dk.parseChart(J('fx_price_chart.json'));
  assert.equal(c.variants.length, 2); const v = c.variants[0];
  assert.equal(v.points[0].price, 34500000); assert.equal(v.points[0].rrp, 34500000);
  assert.equal(api.U.isoDay(v.points[0].t), '2026-09-29'); assert.equal(v.points[0].day, '1405/07/07');
  assert.equal(v.points[0].source, 'digikala:price-chart'); assert.equal(c.range.days, 4);
  assert.equal(c.variants[1].points.every(p => p.marketable === false), true);
  assert.equal(api.Sources.dk.parseChart({ data: {} }), null);
  const pick = api.Sources.dk.pickVariant(c, 'مشکی'); assert.equal(pick.variant.title, 'مشکی'); assert.equal(pick.exact, true);
});

test('Digikala product parser on the REAL API fixture: exact variant, rrp only when discounted', () => {
  const { api } = makeEnv(); const fx = J('fx_product.json');
  const id = String(fx.data.product.variants[0].id);
  const d = api.Sources.dk.parseProduct(fx, id);
  assert.equal(d.exact, true); assert.equal(d.chosen.price, 42503600); assert.equal(d.chosen.rrp, null); assert.ok(d.lowest30dOfficial > 0);
  assert.equal(api.Sources.dk.parseProduct(fx, '1').exact, false);
});

const BUYBOX = `<html><head><title>هدفون بلوتوثی موزیک آپولو مدل YRB/22 | دیجی‌کالا</title></head><body>
<h1>هدفون بلوتوثی موزیک آپولو مدل YRB/22</h1>
<div id="buy"><div>فروشنده</div><div><del>۱۵,۰۰۰,۰۰۰</del><span>۸۵٪</span></div><div><span>۲,۲۰۰,۰۰۰</span> <span>تومان</span></div><button>افزودن به سبد خرید</button></div>
<div><div>رنگ: مشکی</div></div></body></html>`;

test('extract (8.7 port) on Digikala-like buy box: price from buy bar, struck price = claimed old', () => {
  const { api, w } = makeEnv(BUYBOX);
  const p = api.Extract.product(w.document);
  assert.equal(p.price, 2200000); assert.equal(p.priceSource, 'نوار خرید'); assert.equal(p.oldPrice, 15000000);
  assert.equal(p.id, '23083919'); assert.equal(p.variantId, '91941577'); assert.equal(p.color, 'مشکی');
  assert.ok(p.title.includes('YRB/22')); assert.equal(api.Extract.looksLikeProductPage(), true);
});

test('extract: JSON-LD unit reconciliation (rial vs toman) like 8.7', () => {
  const { api } = makeEnv();
  const R = (a, b) => JSON.stringify(api.Extract.reconcileJsonLd(a, b));
  assert.equal(R({ raw: 22000000, cur: 'IRR' }, 2200000), JSON.stringify({ price: 2200000, note: '' }));
  assert.equal(R({ raw: 22000000, cur: '' }, 2200000), JSON.stringify({ price: 2200000, note: ' (واحد JSON-LD اصلاح شد)' }));
  assert.equal(api.Extract.reconcileJsonLd({ raw: 9999999, cur: 'IRR' }, 2200000), null);
});

// ---- analysis: SYNTHETIC series, used only in tests ----
const mk = (api, prices, opt = {}) => prices.map((p, i) => api.Model.point({ t: Date.UTC(2026, 8, 1, 12) + i * 86400000, price: p, rrp: opt.rrp?.[i] ?? null, seller: opt.seller || 'A', marketable: p != null, source: 'test' })).filter(x => x.price != null);
const flat = (n, v) => Array(n).fill(v);
const inspectAtEnd = (api, pts, ctx = {}) => api.Analysis.inspect(pts, { now: pts.length ? pts[pts.length - 1].t : Date.now(), ...ctx });

test('inspector: insufficient data is never turned into a verdict', () => {
  const { api } = makeEnv();
  assert.equal(inspectAtEnd(api, mk(api, flat(8, 100)), { currentPrice: 70 }).verdict, 'insufficient');
  assert.equal(api.Analysis.inspect([]).verdict, 'insufficient');
  const r = inspectAtEnd(api, mk(api, flat(25, 100)), { currentPrice: 100 }); assert.equal(r.verdict, 'insufficient'); assert.equal(r.detail, 'no-drop');
});
test('inspector: genuine drop is confirmed', () => {
  const { api } = makeEnv(); const r = inspectAtEnd(api, mk(api, [...flat(28, 1000), ...flat(2, 800)]), { currentPrice: 800, claimedOld: 1000 });
  assert.equal(r.verdict, 'confirmed'); assert.ok(Math.abs(r.numbers.realDropPct - 20) < 0.01);
});
test('inspector: price raised before campaign -> rise-signal (with explanation, not accusation)', () => {
  const { api } = makeEnv(); const s = [...flat(20, 1000), ...flat(6, 1500), ...flat(4, 900)];
  const r = inspectAtEnd(api, mk(api, s), { currentPrice: 900, claimedOld: 1500 });
  assert.equal(r.verdict, 'rise-signal'); assert.ok(r.signals.some(x => x.code === 'pre-rise')); assert.ok(r.reasons[0].includes('اثبات تخلف نیست'));
});
test('inspector: inflated claimed discount vs real baseline -> rise-signal', () => {
  const { api } = makeEnv(); const r = inspectAtEnd(api, mk(api, flat(30, 1000)), { currentPrice: 950, claimedOld: 2000 });
  assert.equal(r.verdict, 'rise-signal'); assert.ok(r.signals.some(x => x.code === 'claim-gap'));
});
test('inspector: stale history cannot certify a current discount', () => {
  const { api } = makeEnv(); const pts = mk(api, [...flat(28, 1000), ...flat(2, 800)]);
  const r = api.Analysis.inspect(pts, { currentPrice: 800, now: pts.at(-1).t + 8 * 86400000 });
  assert.equal(r.verdict, 'insufficient'); assert.equal(r.detail, 'stale'); assert.equal(r.confidence, 'low');
});
test('inspector: ambiguous multi-variant history cannot be compared without user confirmation', () => {
  const { api } = makeEnv(); const pts = mk(api, [...flat(28, 1000), ...flat(2, 800)]);
  const r = inspectAtEnd(api, pts, { currentPrice: 800, variantCount: 3, variantVerified: false });
  assert.equal(r.verdict, 'insufficient'); assert.equal(r.detail, 'variant-ambiguous');
  const confirmed = inspectAtEnd(api, pts, { currentPrice: 800, variantCount: 3, variantVerified: true });
  assert.equal(confirmed.verdict, 'confirmed');
});
test('inspector: a reference price below current price is not treated as an advertised discount', () => {
  const { api } = makeEnv(); const r = inspectAtEnd(api, mk(api, flat(30, 1000)), { currentPrice: 950, claimedOld: 900 });
  assert.equal(r.numbers.claimedOld, null); assert.equal(r.numbers.claimedPct, null);
});
test('stats: gaps are not interpolated; non-marketable excluded; heldLow ignores one-day dip', () => {
  const { api } = makeEnv(); const pts = mk(api, [100, 100, 50, 100, 100]); pts.splice(1, 1);
  const st = api.Analysis.stats(pts); assert.equal(st.count, 4); assert.equal(st.missingDays, 1); assert.equal(st.min, 50); assert.equal(st.heldLow, 100);
});
test('advisor: only trusted offers count; suspicious ones are ignored', () => {
  const { api } = makeEnv(); const O = (price, level) => api.Model.offer({ sourceId: 'torob', seller: 'S' + price, price, matchLevel: level, matchConfidence: .9 });
  const a = api.Analysis.advise({ current: 1000, offers: [O(500, 'low'), O(900, 'high')], hostKey: 'digikala.com' });
  assert.ok(a.points[0].text.includes('S900')); assert.ok(!a.points.some(p => p.text.includes('S500')));
  assert.equal(api.Analysis.advise({ current: null }).headline, 'قیمت فعلی پیدا نشد');
});

test('store: local history dedup, cap, never mixed with store history', () => {
  const { api } = makeEnv(); api.Store.load(); const p = api.Store.touchProduct('k'); const t0 = Date.now();
  assert.equal(api.Store.recordLocal(p, 100, 'x', t0), true); assert.equal(api.Store.recordLocal(p, 100, 'x', t0 + 1000), false);
  assert.equal(api.Store.recordLocal(p, 90, 'x', t0 + 2000), true); assert.equal(p.local.length, 2); assert.equal(api.Store.recordLocal(p, 0, 'x'), false);
  api.Store.save(); assert.ok(JSON.parse(globalThis.__x = JSON.stringify(1)) === 1);
});

test('export/import CSV roundtrip; store rows are never imported as local', () => {
  const { api } = makeEnv(); api.Store.load(); api.Store.touchProduct('k', { title: 'T' });
  const csv = 'product_key,title,date_iso,price_toman,kind,source\nk,T,2026-09-01,100,store,digikala:price-chart\nk,T,2026-09-02T10:00:00.000Z,90,local,manual';
  const rows = api.Exporter.parseCsv(csv); assert.equal(rows.length, 1); assert.equal(api.Exporter.importLocal('k', rows), 1); assert.equal(api.Exporter.importLocal('k', rows), 0);
  assert.throws(() => api.Exporter.parseCsv('a,b\n1,2'));
});

// ---- network layer ----
test('Net: refuses non-allow-listed domains', async () => {
  const { api } = makeEnv({}.x, undefined, { GM_xmlhttpRequest: () => { throw new Error('must not be called'); } });
  await assert.rejects(api.Net.request('https://evil.example.com/x'), /دامنهٔ مجاز نیست/);
});

// ---- integration with MOCKED network (shapes taken from the 8.7 code and the real Digikala fixtures) ----
function mockGM(routes) {
  return (o) => { const hit = routes.find(r => o.url.includes(r.m)); setTimeout(() => hit ? o.onload({ status: hit.status || 200, responseText: JSON.stringify(hit.body) }) : o.onload({ status: 404, responseText: '' }), 0); };
}
const TOROB_SEARCH = { search_id: 'sid1', results: [
  { name1: 'هدفون بلوتوث موزیک آپولو مدل TWSDX C22', name2: '', price: 2590000, random_key: 'bad', is_adv: false },
  { name1: 'هدفون بلوتوثی موزیک آپولو مدل YRB22', name2: 'مشکی', price: 2100000, random_key: 'good', is_adv: false }] };
const TOROB_SELLERS = { results: [
  { shop_name: 'دیجی‌کالا', domain: 'digikala.com', price: 2200000, page_url: 'https://torob.com/r/1' },
  { shop_name: 'ایمالز', domain: 'emalls.ir', price: 2050000, page_url: 'https://torob.com/r/2' },
  { shop_name: 'ایمالز', domain: 'emalls.ir', price: 2150000, page_url: 'https://torob.com/r/3' },
  { shop_name: 'shop.example.ir', price: 1990000, page_url: 'https://torob.com/r/4' }] };
const headphoneProduct = () => {
  const result = J('fx_product.json'), product = result.data.product;
  product.id = 23083919; product.title_fa = 'هدفون بلوتوثی موزیک آپولو مدل YRB/22';
  product.title_en = 'Apollo YRB/22 Bluetooth Headphone';
  product.brand.title_fa = 'آپولو'; product.brand.title_en = 'Apollo';
  return result;
};
const torobOnly = api => { for (const id of ['emalls', 'basalam', 'snappshop']) api.Store.get().settings.sources[id] = false; api.Store.save(); };

test('SnappShop search rejects a different product sharing generic model B60', async () => {
  const wrong = { title: 'هدست مخصوص بازی بلوتوثی اونیکوما مدل B60', href: '/product/snp-wrong-b60', price: { discounted_price: 5475000 } };
  const right = { title: 'اسپیکر بلوتوثی هیسکا مدل B60', href: '/product/snp-right-b60', price: { discounted_price: 6090000 } };
  const routes = [
    { m: '/guest/v2/token', body: { data: { token: 'test-token' } } },
    { m: '/search/v1', body: { data: { structure: [{ items: [wrong, right] }] } } }
  ];
  const { api } = makeEnv('<html><body></body></html>', undefined, { GM_xmlhttpRequest: mockGM(routes) });
  const prod = api.Model.product({ title: 'اسپیکر بلوتوثی هیسکا مدل B60' });
  prod.brand = 'هیسکا'; prod.brandEn = 'Hiska'; prod.brandAliases = ['هیسکا', 'Hiska'];
  const result = await api.Sources.snappshop.fetch(prod);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].matchTitle, right.title);
  assert.ok(result.rejected >= 1);
});

test('torob: keeps the user-provided product redirect and still excludes the named Basalam page', async () => {
  const productRedirect = 'https://api.torob.com/v4/product-page/redirect/?uid=4688671&prk=2db1d0a1-c8f0-455b-82fc-9d64497dfed4';
  const sellers = { results: [
    { uid: '4688671', shop_name: 'فروشگاه نمونه', domain: 'shop.example.ir', price: 140000, page_url: 'https://torob.com/r/opaque', redirect_url: productRedirect },
    { uid: 'blocked-id', shop_name: 'باسلام', domain: 'basalam.com', price: 140000, page_url: 'https://basalam.com/pakhshshop/product/25406964?utm_source=Torob' },
    { uid: 'safe-id', shop_name: 'دیجی‌کالا', domain: 'digikala.com', price: 2200000, page_url: 'https://torob.com/r/safe' }
  ] };
  const { api } = makeEnv('<html><body></body></html>', undefined, { GM_xmlhttpRequest: mockGM([{ m: 'base-product/sellers', body: sellers }]) });
  const prod = api.Model.product({ id: '23248296', title: 'کابل USB-C روموس مدل 3241' });
  const offers = await api.Sources.torob.sellers(prod, { random_key: 'base', name1: 'کابل USB-C روموس مدل 3241' }, { score: 0.9, level: 'high', flags: [] }, '');
  assert.equal(offers.length, 2); assert.ok(offers.some(o => o.price === 140000)); assert.ok(offers.some(o => o.sellerKey === 'digikala.com'));
});

test('E2E (mock net): Torob picks the right base product, dedups sellers, DOES NOT use the wrong model', async () => {
  const routes = [{ m: 'base-product/search', body: TOROB_SEARCH }, { m: 'base-product/sellers', body: TOROB_SELLERS }, { m: '/price-chart/', body: J('fx_price_chart.json') }, { m: '/product/v1/products/', body: headphoneProduct() }];
  const { api, w } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: mockGM(routes) });
  api.Store.load(); torobOnly(api); await api.App.refreshProduct(); await api.App.runCompare();
  const s = api.App.state; assert.equal(s.sources.torob.status, 'ok'); assert.equal(s.offers.length, 3);
  assert.ok(!s.offers.some(o => o.price === 2590000)); const em = s.offers.find(o => o.sellerKey === 'emalls.ir'); assert.equal(em.price, 2050000); assert.ok(em.flags.includes('dedup:2'));
  assert.equal(em.shippingCost, null); assert.ok(em.ts > 0 && em.dataSource.startsWith('torob:'));
  assert.equal(s.sources.emalls.status, 'off'); assert.equal(s.sources.basalam.status, 'off'); assert.equal(s.sources.snappshop.status, 'off');
});

test('E2E (mock net): Torob failure is isolated; history still loads; price source reported', async () => {
  const routes = [{ m: 'base-product/search', status: 500, body: {} }, { m: '/price-chart/', body: J('fx_price_chart.json') }, { m: '/product/v1/products/', body: headphoneProduct() }];
  const { api } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: mockGM(routes) });
  api.Store.load(); torobOnly(api); await api.App.refreshProduct(); await api.App.runCompare(); await new Promise(r => setTimeout(r, 50));
  const s = api.App.state; assert.equal(s.sources.torob.status, 'error'); assert.match(s.sources.torob.error, /HTTP 500/);
  assert.ok(s.chart && s.chart.variants.length === 2); assert.equal(s.product.price, 2200000);
  assert.ok(api.Log.all().some(e => e.level === 'error' && e.scope === 'torob'));
});

test('UI: exactly ONE panel host, mount is idempotent, every tab renders, legacy panels are reported', async () => {
  const routes = [{ m: 'base-product/search', body: TOROB_SEARCH }, { m: 'base-product/sellers', body: TOROB_SELLERS }, { m: '/price-chart/', body: J('fx_price_chart.json') }, { m: '/product/v1/products/', body: headphoneProduct() }];
  const { api, w } = makeEnv(BUYBOX + '<div id="ghpro12-host"></div>', undefined, { GM_xmlhttpRequest: mockGM(routes) });
  api.Store.load(); torobOnly(api); api.UI.mount(); api.UI.mount(); api.UI.mount();
  assert.equal(w.document.querySelectorAll('#ghafel-pro-host').length, 1);
  await api.App.refreshProduct(); await api.App.runCompare(); await new Promise(r => setTimeout(r, 50));
  const root = w.document.getElementById('ghafel-pro-host').shadowRoot;
  const cr = root.querySelectorAll('.credit a'); assert.equal(cr.length, 3); assert.deepEqual([...cr].map(a => a.href), ['https://aqilistudio.ir/', 'https://t.me/RealMahdi_a', 'https://t.me/GHAFEL_com']); assert.ok([...cr].every(a => a.rel.includes('noopener'))); assert.ok(root.querySelector('.foot').textContent.includes('GHAFEL_com') && root.querySelector('.foot').textContent.includes('RealMahdi_a')); assert.ok(root.querySelector('#pill').textContent.includes('تخفیف‌سنج'));
  assert.ok(root.querySelector('#price').textContent.includes('نوار خرید'));
  for (const t of ['compare', 'history', 'inspect', 'watch', 'settings', 'log']) { api.App.state.tab = t; api.UI.render(); assert.ok(root.querySelector('#body').innerHTML.length > 20, t); }
  api.App.state.tab = 'log'; api.UI.render(); assert.ok(root.querySelector('.banner').textContent.includes('ghpro12-host'));
  api.App.state.tab = 'compare'; api.UI.render(); assert.ok(root.querySelectorAll('.offer').length === 3);
  assert.ok(![...root.querySelectorAll('.offer')].some(e => e.textContent.includes('TWSDX')) && !root.innerHTML.includes('2,590,000') && !root.innerHTML.includes('۲٬۵۹۰٬۰۰۰'));
  assert.ok(root.innerHTML.includes('نتایج ردشده'));
});

test('alerts: fires once per drop under target, not above, not repeatedly', () => {
  const { api } = makeEnv(); api.Store.load(); const p = api.Store.touchProduct('a', { watch: true, target: 1000, title: 'x', url: 'https://x' });
  assert.equal(api.Alerts.evaluate(p, 1200), false); assert.equal(api.Alerts.evaluate(p, 950), true); assert.equal(api.Alerts.evaluate(p, 950), false); assert.equal(api.Alerts.evaluate(p, 900), true);
});

test('Net: GM failure on Digikala falls back to page fetch; HTTP errors do not fall back; Torob has no fallback', async () => {
  let gmCalls = 0, fetchCalls = 0;
  const { api } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: o => { gmCalls++; setTimeout(() => o.onerror({ error: '' }), 0); }, fetch: async () => { fetchCalls++; return { ok: true, status: 200, text: async () => JSON.stringify(J('fx_price_chart.json')) }; } });
  const c = await api.Sources.dk.chart('23083919'); assert.equal(c.variants.length, 2); assert.equal(gmCalls, 1); assert.equal(fetchCalls, 1);
  await assert.rejects(api.Net.request('https://api.torob.com/x'), /خطای شبکه/); assert.equal(fetchCalls, 1);
});
test('local history: weak price source or empty title is not recorded', async () => {
  const { api, w } = makeEnv('<html><body><div><span>8,350,264</span></div></body></html>', 'https://www.digikala.com/product/dkp-1/x/', { GM_xmlhttpRequest: o => setTimeout(() => o.onerror({}), 0), fetch: async () => { throw new Error('x'); } });
  api.Store.load(); await api.App.refreshProduct(); assert.equal(Object.values(api.Store.get().products).every(p => p.local.length === 0), true);
});

test('UI: pill is draggable (drag moves + saves, tap opens); wide toggle; show-all for long lists; chrome never shrinks', async () => {
  const many = { results: Array.from({ length: 9 }, (_, i) => ({ shop_name: 'shop' + i + '.ir', price: 2000000 + i * 1000, page_url: 'https://torob.com/r/' + i })) };
  const routes = [{ m: 'base-product/search', body: TOROB_SEARCH }, { m: 'base-product/sellers', body: many }, { m: '/price-chart/', body: J('fx_price_chart.json') }, { m: '/product/v1/products/', body: headphoneProduct() }];
  const { api, w } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: mockGM(routes) });
  api.Store.load(); torobOnly(api); api.UI.mount(); await api.App.refreshProduct(); await api.App.runCompare(); await new Promise(r => setTimeout(r, 50));
  const host = w.document.getElementById('ghafel-pro-host'), root = host.shadowRoot, pill = root.querySelector('#pill');
  host.getBoundingClientRect = () => { const l = parseFloat(host.style.left) || 0, t = parseFloat(host.style.top) || 0; return { left: l, top: t, width: 150, height: 40, right: l + 150, bottom: t + 40 }; };
  await new Promise(r => setTimeout(r, 40)); host.style.left = '0px'; host.style.top = '0px';
  const ev = (t, x, y) => pill.dispatchEvent(new w.MouseEvent(t, { clientX: x, clientY: y, bubbles: true }));
  ev('pointerdown', 10, 10); ev('pointermove', 200, 150); ev('pointerup', 200, 150);
  assert.equal(host.style.left, '190px'); assert.ok(!root.querySelector('#panel').classList.contains('open')); assert.equal(api.Store.get().settings.pos.left !== undefined, true);
  ev('pointerdown', 5, 5); ev('pointerup', 5, 5); pill.click(); assert.ok(root.querySelector('#panel').classList.contains('open'));
  api.App.state.tab = 'compare'; api.UI.render(); assert.equal(root.querySelectorAll('.offer').length, 5);
  root.querySelector('[data-act="toggleAll"]').click(); assert.equal(root.querySelectorAll('.offer').length, 9);
  const adv = root.innerHTML.indexOf('مشاور خرید'), first = root.innerHTML.indexOf('class="card offer'); assert.ok(adv > 0 && adv < first);
  root.querySelector('#wide').click(); assert.ok(root.querySelector('#panel').classList.contains('wide'));
  const css = root.querySelector('style').textContent; assert.match(css, /\.tabs\{[^}]*flex-direction:row/); assert.match(css, /\.tab\.on \.tab-icon\{opacity:1;transform:none\}/); assert.match(css, /\.tab\.on \.tab-label\{position:static/); assert.match(css, /\.foot\{flex:0 0 auto/); assert.match(css, /\.body\{min-height:0/);
});

// ---- v14 ----
const routeBy = (fn) => (o) => { const r = fn(decodeURIComponent(o.url)); setTimeout(() => r ? o.onload({ status: r.status || 200, responseText: JSON.stringify(r.body) }) : o.onload({ status: 404, responseText: '' }), 0); };
const CAND = (name2, price, key) => ({ name1: 'هدفون بلوتوثی موزیک آپولو مدل YRB22', name2, price, random_key: key, is_adv: false });

test('torob: stops after the first matching query and reports what was tried', async () => {
  const urls = [];
  const gm = routeBy(u => { urls.push(u); if (u.includes('base-product/search')) { const query = new URL(u).searchParams.get('query') || ''; return { body: { search_id: 's', results: /آپولو|apollo/i.test(query) ? [CAND('مشکی', 2100000, 'k1')] : [] } }; } if (u.includes('/sellers/')) return { body: TOROB_SELLERS }; return null; });
  const { api, w } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: gm });
  api.Store.load(); torobOnly(api); await api.App.refreshProduct(); await api.App.runCompare();
  const t = api.App.state.sources.torob; assert.equal(t.status, 'ok'); assert.equal(t.tried.length, 1); assert.match(t.tried[0], /آپولو|apollo/i); assert.match(t.query, /yrb22/); assert.equal(api.App.state.offers.length, 3); w.close();
});

test('torob: candidate switch replaces only Torob offers; manual query overrides the ladder', async () => {
  const searches = [];
  const gm = routeBy(u => { if (u.includes('base-product/search')) { searches.push(u); return { body: { search_id: 's', results: [CAND('مشکی', 2100000, 'k1'), CAND('سفید', 2300000, 'k2')] } }; }
    if (u.includes('prk=k1')) return { body: { results: [{ shop_name: 'A', price: 2000000, page_url: 'https://torob.com/r/a' }] } };
    if (u.includes('prk=k2')) return { body: { results: [{ shop_name: 'B', price: 2250000, page_url: 'https://torob.com/r/b' }] } }; return null; });
  const { api, w } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: gm });
  api.Store.load(); torobOnly(api); await api.App.refreshProduct(); await api.App.runCompare();
  let st = api.App.state; assert.equal(st.sources.torob.candidates.length, 2); assert.equal(st.sources.torob.chosenKey, 'k1'); assert.equal(st.offers[0].seller, 'A');
  await api.App.pickCandidate('k2'); assert.equal(st.offers.length, 1); assert.equal(st.offers[0].seller, 'B'); assert.equal(st.sources.torob.chosenKey, 'k2');
  searches.length = 0; await api.App.runCompare({ query: 'yrb22 apolo' }); assert.equal(searches.length, 1); assert.match(searches[0], /query=yrb22 apolo/); assert.deepEqual([...st.sources.torob.tried], ['yrb22 apolo']); w.close();
});

test('UI v14: tab memory, table view, edge snap, shortcut, manual search and viewport-scaled panel', async () => {
  const gm = routeBy(u => u.includes('base-product/search') ? { body: { search_id: 's', results: [CAND('مشکی', 2100000, 'k1')] } } : u.includes('/sellers/') ? { body: TOROB_SELLERS } : null);
  const { api, w } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: gm });
  api.Store.load(); torobOnly(api); api.Store.get().settings.tab = 'watch'; api.UI.mount();
  const host = w.document.getElementById('ghafel-pro-host'), root = host.shadowRoot;
  host.getBoundingClientRect = () => { const l = parseFloat(host.style.left) || 0, t = parseFloat(host.style.top) || 0; return { left: l, top: t, width: 150, height: 40, right: l + 150, bottom: t + 40 }; };
  assert.equal(api.App.state.tab, 'watch'); assert.ok(root.querySelector('.tab.on').textContent.includes('واچ‌لیست'));
  root.querySelector('[data-tab="compare"]').click(); assert.equal(api.Store.get().settings.tab, 'compare'); assert.ok(root.querySelector('#q'));
  await api.App.refreshProduct(); await api.App.runCompare(); await new Promise(r => setTimeout(r, 30));
  root.querySelector('[data-act="toggleTable"]').click(); assert.equal(api.Store.get().settings.table, true); assert.equal(root.querySelectorAll('table.tb tr').length, 3); assert.equal(root.querySelectorAll('.offer').length, 0);
  const ev = (el, t, x, y) => el.dispatchEvent(new w.MouseEvent(t, { clientX: x, clientY: y, bubbles: true }));
  await new Promise(r => setTimeout(r, 40)); host.style.left = '0px'; host.style.top = '0px';
  const pill = root.querySelector('#pill'); ev(pill, 'pointerdown', 10, 10); ev(pill, 'pointermove', 20, 300); ev(pill, 'pointerup', 20, 300);
  assert.equal(host.style.left, '8px'); assert.equal(host.style.top, '290px');
  host.style.left = '0px'; host.style.top = '0px'; ev(pill, 'pointerdown', 10, 10); ev(pill, 'pointermove', 1000, 300); ev(pill, 'pointerup', 1000, 300); assert.equal(host.style.left, '866px');
  const css = root.querySelector('style').textContent;
  assert.ok(css.includes('height:84vh')); assert.equal(root.querySelector('#rs'), null);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyG', bubbles: true }));
  api.Main.init(); w.document.dispatchEvent(new w.KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyG', bubbles: true }));
  assert.ok(root.querySelector('#panel').classList.contains('open'));
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyG', bubbles: true })); assert.ok(!root.querySelector('#panel').classList.contains('open')); w.close();
});

// ---- regressions from real-world field log ----
test('match: different brand, same category, no model code is REJECTED even with >50% token overlap (real 429/mismatch log)', () => {
  const { api } = makeEnv();
  const r = api.Match.evaluate('مغز تخمه آفتابگردان خام ممتاز هوشمند کالا - 520 گرم', 'مغز تخمه آفتابگردان خام ممتاز زعفرینو');
  assert.equal(r.ok, false); assert.ok(r.flags.includes('no-model-code')); assert.ok(r.flags.includes('low-coverage'));
});
test('match: identical no-code product text still accepted (regression guard)', () => {
  const { api } = makeEnv(); const r = api.Match.evaluate('شیر کم چرب میهن یک لیتری', 'شیر کم چرب میهن یک لیتری');
  assert.equal(r.ok, true); assert.ok(r.score >= 0.75);
});

test('App: overlapping refreshProduct() calls do not fire duplicate Digikala product requests (fixes the 429 storm)', async () => {
  let calls = 0;
  const routes = (url) => { if (url.includes('/product/v1/products/')) { calls++; return { body: J('fx_product.json'), delay: 40 }; } if (url.includes('base-product/search')) return { body: { results: [] } }; return null; };
  const gm = (o) => { const r = routes(o.url); setTimeout(() => r ? o.onload({ status: 200, responseText: JSON.stringify(r.body) }) : o.onload({ status: 404, responseText: '' }), r?.delay || 0); };
  const { api } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: gm });
  api.Store.load();
  await Promise.all([api.App.refreshProduct(), api.App.refreshProduct(), api.App.refreshProduct()]);
  await new Promise(r => setTimeout(r, 80));
  assert.equal(calls, 1);
});

test('App: a 429 on price-chart sets a cooldown; automatic retry is skipped until it expires; Retry-After header is honored', async () => {
  let chartCalls = 0;
  const gm = (o) => {
    if (o.url.includes('/price-chart/')) { chartCalls++; setTimeout(() => o.onload({ status: 429, responseText: '', responseHeaders: 'Retry-After: 5\\r\\n' }), 0); return; }
    if (o.url.includes('/product/v1/products/')) return setTimeout(() => o.onload({ status: 200, responseText: JSON.stringify(J('fx_product.json')) }), 0);
    setTimeout(() => o.onload({ status: 404, responseText: '' }), 0);
  };
  const { api } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: gm });
  api.Store.load(); await api.App.refreshProduct(); await new Promise(r => setTimeout(r, 30));
  assert.equal(chartCalls, 1); assert.ok(api.App.state.historyCooldownUntil - Date.now() > 4000);
  await api.App.refreshProduct(); await new Promise(r => setTimeout(r, 20)); assert.equal(chartCalls, 1); // still in cooldown, no retry
  await api.App.loadHistory(); assert.equal(chartCalls, 1); // manual retry also respects cooldown
  api.App.state.historyCooldownUntil = Date.now() - 1; await api.App.loadHistory(); await new Promise(r => setTimeout(r, 20)); assert.equal(chartCalls, 2); // cooldown expired: retries
});

test('UI: history tab disables "دریافت دوباره" and shows a countdown while in cooldown', async () => {
  const { api, w } = makeEnv(BUYBOX, undefined, { GM_xmlhttpRequest: o => setTimeout(() => o.onload({ status: 404, responseText: '' }), 0) }); api.Store.load(); api.UI.mount();
  await api.App.refreshProduct(); api.App.state.tab = 'history'; api.App.state.historyCooldownUntil = Date.now() + 12000; api.UI.render();
  const root = w.document.getElementById('ghafel-pro-host').shadowRoot;
  const btn = root.querySelector('[data-act="reloadHistory"]'); assert.ok(btn.hasAttribute('disabled')); assert.match(btn.textContent, /منتظر بمانید/);
});

test('torob: long product headings search by model/core title and still reject a different model', () => {
  const { api } = makeEnv();
  const title = 'پرزگیر برقی لباس میجیا مدل MQXJQ01KL، دارای 1 عدد رول، سر متحرک، ابعاد 6×6×14 سانتی‌متر، وزن 210 گرم، 90 دقیقه فعالیت با یک بار شارژ';
  const prod = { title, altTitles: [] };
  assert.equal(api.Extract.coreTitle(title), 'پرزگیر برقی لباس میجیا مدل MQXJQ01KL');
  const queries = api.Sources.torob.queries(prod);
  assert.equal(queries[0], 'پرزگیر برقی لباس میجیا mqxjq01kl');
  assert.equal(queries[1], 'mqxjq01kl');
  assert.ok(!queries.includes(title));
  const good = api.Sources.torob.evalCand(prod, { name1: 'پرزگیر برقی لباس میجیا مدل MQXJQ01KL', name2: '' });
  const bad = api.Sources.torob.evalCand(prod, { name1: 'پرزگیر برقی لباس میجیا مدل MQXJQ00KL', name2: '' });
  assert.equal(good.ok, true); assert.equal(bad.ok, false); assert.ok(bad.flags.includes('model-mismatch'));
});

test('torob: prefers English brand plus model and skips the noisy standalone numeric query', () => {
  const { api } = makeEnv();
  const prod = {
    title: 'کابل USB-C روموس مدل 3241 طول 1.2 متر',
    altTitles: ['کابل USB-C روموس مدل 3241 طول 1.2 متر'],
    brand: 'روموس', brandEn: 'Romoss', brandAliases: ['روموس', 'Romoss']
  };
  const queries = api.Sources.torob.queries(prod);
  assert.equal(queries[0], 'Romoss 3241');
  assert.ok(queries[1].includes('روموس'));
  assert.ok(!queries.includes('3241'));
  assert.ok(api.Sources.torob.queries({ title: prod.title }).includes('3241'));
});

test('history: exact variant title wins over an earlier partial color match', () => {
  const { api } = makeEnv();
  const chart = { variants: [{ id: '0', title: 'سفید', points: [] }, { id: '1', title: 'سفید صدفی', points: [] }] };
  const picked = api.Sources.dk.pickVariant(chart, ['سفید صدفی', 'سفید']);
  assert.equal(picked.variant.title, 'سفید صدفی'); assert.equal(picked.exact, true);
});

test('safety: seller URLs allow only HTTP(S)', () => {
  const { api } = makeEnv();
  assert.equal(api.Model.offer({}).sellerUrl, '');
  assert.equal(api.Model.offer({ sellerUrl: 'javascript:alert(1)' }).sellerUrl, '');
  assert.equal(api.Model.offer({ sellerUrl: 'https://shop.example/item' }).sellerUrl, 'https://shop.example/item');
});

test('safety: CSV export neutralizes spreadsheet formula prefixes', () => {
  const { api } = makeEnv(); api.Store.load();
  api.Store.touchProduct('example:1', { title: '=1+1', local: [] });
  const csv = api.Exporter.csvFor('example:1', [{ t: Date.UTC(2026, 10, 1), price: 10, source: 'fixture' }]);
  assert.ok(csv.includes(",'=1+1,"));
});
