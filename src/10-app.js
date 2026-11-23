/* ===== App: single shared state. Every UI tab and alert reads from here (no module keeps private copies). ===== */
const App = (() => {
  const state = {
    product: null,            // Model.product
    key: '',
    offers: [],               // Model.offer[] from all sources
    sources: {},              // id -> {status, count, note, error, ts, nearMiss}
    dk: null,                 // parsed Digikala product record
    chart: null, chartError: '', chartLoading: false, variantIdx: 0, variantExact: false, variantManual: false,
    range: 90, tab: 'compare', running: false, sort: 'price', trustedOnly: false, banner: '',
    dkFetching: false, dkTs: 0, historyCooldownUntil: 0, historyCooldownNote: ''
  };
  const subs = new Set(); const emit = () => subs.forEach(f => { try { f(state); } catch (e) { Log.error('ui', e.message); } });
  const on = f => subs.add(f);

  const settings = () => Store.get().settings;
  const keyFor = p => `${p.host}:${p.id || U.compact(location.pathname).slice(0, 60)}`;

  async function refreshProduct() {
    const x = Extract.product(document);
    const prev = state.product;
    const p = Model.product({ ...x, key: '', priceTs: Date.now() });
    p.key = keyFor(p);
    // keep a manual price if extraction failed
    if (!p.price && prev && prev.key === p.key && prev.priceSource === 'دستی') { p.price = prev.price; p.priceSource = 'دستی'; }
    if (state.key && state.key !== p.key) { state.offers = []; state.sources = {}; state.chart = null; state.chartError = ''; state.dk = null; state.dkTs = 0; state.dkFetching = false; state.historyCooldownUntil = 0; state.historyCooldownNote = ''; state.variantIdx = 0; state.variantExact = false; state.variantManual = false; }
    state.product = p; state.key = p.key;
    const rec = Store.touchProduct(p.key, { host: p.host, pid: p.id, title: p.title || '', url: p.url, variantTitle: x.color || '', variantId: p.variantId });
    // Only trustworthy readings enter local history (page still loading / weak heuristics would pollute it).
    const TRUSTED = /JSON-LD|نوار خرید|متای صفحه|data-testid|دستی/;
    if (p.price && p.title && TRUSTED.test(p.priceSource || '')) { if (Store.recordLocal(rec, p.price, 'page:' + p.priceSource, Date.now(), p.variantId)) Log.info('store', 'نقطهٔ محلی ثبت شد'); }
    else if (p.price) Log.info('store', 'قیمت برای تاریخچهٔ محلی ثبت نشد (منبع ضعیف یا نام خالی)');
    Store.save(); emit();
    // Guard against overlapping refreshProduct() calls racing to fetch the SAME in-flight Digikala product:
    // state.dk only becomes truthy once the fetch RESOLVES, so a second call arriving while the first is still
    // in flight must NOT see "!state.dk" as a green light — that was the bug behind the 429 storm.
    if (p.id && p.host.endsWith('digikala.com') && !state.dkFetching && (!state.dk || Date.now() - state.dkTs > 120000)) {
      state.dkFetching = true; state.dkTs = Date.now();
      loadDigikala(p, x.color).finally(() => { state.dkFetching = false; });
    }
    return p;
  }

  async function loadDigikala(p, color) {
    try {
      state.dk = await Sources.dk.product(p.id, p.variantId);
      const d = state.dk;
      if (d) p.altTitles = [d.title, d.titleEn].filter(Boolean);
      if (d && d.chosen) {
        p.seller = d.chosen.seller; p.warranty = d.chosen.warranty; p.variantTitle = d.chosen.title;
        if (!p.oldPrice && d.chosen.rrp) p.oldPrice = d.chosen.rrp;
        if (!p.price) { p.price = d.chosen.price; p.priceSource = 'API دیجی‌کالا (واریانت دقیق)'; }
        else if (Math.abs(p.price - d.chosen.price) / d.chosen.price > 0.02) { Log.warn('price', `اختلاف قیمت صفحه (${p.price}) و API (${d.chosen.price})`); p.priceNote = 'قیمت صفحه با API دیجی‌کالا اختلاف دارد'; }
      } else if (d && !p.price && d.variants.length) { p.price = d.variants[0].price; p.priceSource = 'API دیجی‌کالا (ارزان‌ترین واریانت؛ واریانت دقیق نامشخص)'; }
      emit();
    } catch (e) { Log.warn('dk-product', e.message); }
    if (!state.chart && Date.now() >= state.historyCooldownUntil) loadHistory(color); // cooldown also guards the automatic retry after loadDigikala
  }

  async function loadHistory(color, { force = false } = {}) {
    const p = state.product; if (!p || !p.id || state.chartLoading) return;
    if (!force && Date.now() < state.historyCooldownUntil) return; // never hammer a rate-limited endpoint, even on manual retry
    state.chartLoading = true; state.chartError = ''; emit();
    try {
      state.chart = await Sources.dk.chart(p.id);
      state.historyCooldownUntil = 0; state.historyCooldownNote = '';
      const preferred = [state.dk?.chosen?.title, p.variantTitle, color, Extract.selectedColor()].filter(Boolean);
      const pick = Sources.dk.pickVariant(state.chart, preferred);
      state.variantIdx = pick ? Math.max(0, state.chart.variants.indexOf(pick.variant)) : 0; state.variantExact = !!(pick && pick.exact);
      state.variantManual = false;
      Log.info('history', `بازهٔ داده: ${state.chart.range ? state.chart.range.days + ' روز' : '—'}, واریانت‌ها: ${state.chart.variants.length}`);
    } catch (e) {
      state.chart = null;
      const retryMs = e.retryAfterMs > 0 ? e.retryAfterMs : (e.status === 429 ? 90000 : 20000);
      state.historyCooldownUntil = Date.now() + retryMs; state.historyCooldownNote = e.status === 429 ? 'rate-limit' : 'error';
      state.chartError = e.status === 429 ? 'HTTP 429' : e.message;
      const message = e.status === 429
        ? `HTTP 429؛ تلاش بعدی پس از ${Math.ceil(retryMs / 1000)} ثانیه`
        : e.message;
      if (e.status === 429) Log.warn('history', message); else Log.error('history', message);
    }
    state.chartLoading = false; emit();
  }

  async function runCompare(opts = {}) {
    if (state.running) return;
    const p = state.product || await refreshProduct();
    if (!p.title) { state.banner = 'نام محصول در این صفحه پیدا نشد.'; emit(); return; }
    state.banner = ''; state.running = true; state.offers = []; state.sources = {};
    const reg = Sources.registry, cfg = settings().sources;
    for (const id of Object.keys(reg)) state.sources[id] = { status: reg[id].implemented ? (cfg[id] ? 'loading' : 'off') : 'unavailable', count: 0, note: reg[id].implemented ? '' : reg[id].note };
    emit();
    await Promise.all(Object.keys(reg).filter(id => reg[id].implemented && cfg[id]).map(async id => {
      try {
        const r = await reg[id].fetch(p, opts);
        state.sources[id] = { status: r.status, count: r.offers.length, note: r.note || '', nearMiss: r.nearMiss || [], candidates: r.candidates || [], chosenKey: r.chosenKey || '', query: r.query || '', tried: r.tried || [], ts: Date.now() };
        state.offers.push(...r.offers);
      } catch (e) { state.sources[id] = { status: 'error', count: 0, error: e.message, ts: Date.now() }; Log.error(id, e.message); }
      emit();
    }));
    state.running = false; emit();
  }

  // Switch the matched Torob product (e.g. another colour/model variant) without re-running other sources.
  async function pickCandidate(key) {
    const p = state.product, st = state.sources.torob; if (!p || !st || state.running) return;
    state.running = true; emit();
    try {
      const r = await Sources.torob.fetch(p, { query: st.query, pickKey: key });
      state.offers = state.offers.filter(o => o.sourceId !== 'torob').concat(r.offers);
      state.sources.torob = { ...st, status: r.status, count: r.offers.length, note: r.note, candidates: r.candidates, chosenKey: r.chosenKey || key, ts: Date.now(), error: '' };
    } catch (e) { state.sources.torob = { ...st, status: 'error', error: e.message }; Log.error('torob', e.message); }
    state.running = false; emit();
  }
  function setManualPrice(n) {
    const p = state.product; if (!p || !(n > 0)) return;
    p.price = n; p.priceSource = 'دستی'; p.priceTs = Date.now();
    const rec = Store.touchProduct(p.key); Store.recordLocal(rec, n, 'manual', Date.now(), p.variantId); Store.save(); emit();
  }

  const selectedVariant = () => state.chart && state.chart.variants[state.variantIdx] || null;
  function historyPoints() { const v = selectedVariant(); return v ? v.points : []; }
  function localHistoryPoints() {
    const p = state.product || {}, rec = p.key && Store.get().products[p.key];
    const points = rec && Array.isArray(rec.local) ? rec.local : [];
    const chartVariants = state.chart && state.chart.variants || [], selected = selectedVariant();
    const selectedTitle = U.compact(selected && selected.title || '');
    const currentTitle = U.compact(state.dk?.chosen?.title || p.variantTitle || Extract.selectedColor() || '');
    if (selectedTitle && currentTitle && !selectedTitle.includes(currentTitle) && !currentTitle.includes(selectedTitle)) return [];
    // Older local records have no variant id. Use them only when the chart is unambiguous.
    return points.filter(x => x.variantId
      ? String(x.variantId) === String(p.variantId || '')
      : !p.id || chartVariants.length === 1);
  }
  function combinedHistoryPoints() {
    const byDay = new Map();
    for (const x of localHistoryPoints()) {
      const point = { t: x.t, day: U.isoDay(x.t), price: x.p, rrp: null, seller: '', warranty: '', marketable: x.p > 0, source: x.src || 'local', kind: 'local' };
      byDay.set(point.day, point);
    }
    // Official points take precedence on a day with both sources.
    for (const point of Analysis.valid(historyPoints())) byDay.set(U.isoDay(point.t), point);
    return [...byDay.values()].sort((a, b) => a.t - b.t);
  }
  function inspector() {
    const pts = combinedHistoryPoints(); const p = state.product || {};
    const variantCount = state.chart?.variants.length || 0;
    return Analysis.inspect(pts, {
      currentPrice: p.price, claimedOld: p.oldPrice,
      variantCount,
      variantVerified: variantCount <= 1 || state.variantExact || state.variantManual
    });
  }
  function advice() {
    const p = state.product || {}; const pts = combinedHistoryPoints();
    const hostKey = Extract.matchKnownSite(p.host || '') || '';
    return Analysis.advise({ current: p.price, offers: state.offers, hostKey, st: Analysis.stats(pts), insp: pts.length ? inspector() : null });
  }
  return { state, on, emit, pickCandidate, settings, refreshProduct, loadHistory, runCompare, setManualPrice, selectedVariant, historyPoints, localHistoryPoints, combinedHistoryPoints, inspector, advice };
})();
