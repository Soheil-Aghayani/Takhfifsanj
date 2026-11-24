/* ===== Sources: independent modules. A failing source never disables the others. ===== */
const Sources = (() => {
  const TOROB_REF = 'https://torob.com/';
  const DK_REF = 'https://www.digikala.com/';
  // Origin is a forbidden header for GM requests; cookies are sent (anonymous:false) so Digikala's CDN accepts the call; page fetch is the fallback.
  const DK_OPTS = { referer: DK_REF, headers: { 'x-web-client': 'desktop', 'x-web-client-id': 'web' }, anonymous: false, pageFetchFallback: true };
  // Torob can attach an unrelated marketplace page to an otherwise relevant base product.
  // Exclude the exact unwanted Basalam page; keep Torob redirect links usable as product references.
  const EXCLUDED_TOROB_SELLER_PAGES = new Set(['basalam.com/pakhshshop/product/25406964']);
  function isExcludedTorobSellerPage(raw, depth = 0) {
    if (depth > 4) return false;
    try {
      const u = new URL(raw, 'https://api.torob.com/'), host = u.hostname.toLowerCase().replace(/^www\./, '');
      const path = u.pathname.replace(/\/+$/, '').toLowerCase();
      if (EXCLUDED_TOROB_SELLER_PAGES.has(host + path)) return true;
      for (const key of ['to', 'url', 'redirect_url']) {
        const nested = u.searchParams.get(key);
        if (nested && nested !== raw && isExcludedTorobSellerPage(nested, depth + 1)) return true;
      }
      if (host === 'relay.basalam.com' && path === '/r') return false;
      return false;
    } catch { return false; }
  }

  // ---------- Torob: seller prices (engine 8.7 flow, unchanged endpoints) ----------
  const torob = {
    id: 'torob', label: 'ترب', icon: 'torob', kind: 'offers', implemented: true, hosts: ['api.torob.com'],
    note: 'جست‌وجوی چندمرحله‌ای ← انتخاب محصول مطابق (قابل‌تغییر دستی) ← فهرست فروشندگان',
    titles: prod => [...new Set([Extract.coreTitle(prod.title), prod.title, ...(prod.altTitles || [])].filter(Boolean))],
    // Search high-signal terms first. Long page headings commonly append dimensions,
    // package contents and marketing copy, which makes exact marketplace search worse.
    queries(prod, override) {
      if (override) return [override.trim()];
      const t = torob.titles(prod), codes = [...new Set(t.flatMap(Match.modelCodes))];
      const en = (prod.altTitles || []).find(x => /^[\x00-\x7F\s]+$/.test(x));
      const core = Extract.coreTitle(prod.title) || prod.title || '';
      const codeQuery = codes.slice().sort((a, b) => b.length - a.length)[0] || '';
      const prefix = U.tokens(core).filter(x => !codes.includes(x)).slice(0, 4).join(' ');
      const focused = [prefix, codes.join(' ')].filter(Boolean).join(' ');
      const shortEnglish = en ? Extract.coreTitle(en) : '';
      const aliases = Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases];
      const searchableBrand = [prod.brandEn, ...aliases, prod.brand].find(x => /[a-z]/i.test(String(x || '')));
      const brandCodeQuery = searchableBrand && codeQuery ? `${String(searchableBrand).trim()} ${codeQuery}` : '';
      const candidates = codes.length
        ? [brandCodeQuery, focused, ...(brandCodeQuery ? [] : [codeQuery]), core, shortEnglish]
        : [core, U.tokens(core).slice(0, 5).join(' '), shortEnglish];
      return [...new Set(candidates.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 4);
    },
    async search(q) {
      const e = encodeURIComponent(q);
      const r = await Net.json(`https://api.torob.com/v4/base-product/search/?page=0&sort=popularity&size=24&query=${e}&q=${e}&source=next_desktop`, { referer: TOROB_REF, timeout: 15000 });
      return { results: Array.isArray(r.results) ? r.results : [], searchId: r.search_id || r.searchId || '' };
    },
    // Evaluate against every known title of the product (page title + Digikala official titles) and keep the best verdict.
    evalCand(prod, r) {
      const ct = r.name1 + ' ' + (r.name2 || ''); let best = null;
      // Check model/spec contradictions before token coverage: long page headings may have low overlap.
      const brandAliases = [...new Set([...(prod.brandAliases || []), prod.brand, prod.brandEn, ...torob.titles(prod).flatMap(Match.brandFamilies)].filter(Boolean))];
      const strict = Match.evaluate(prod.title || '', ct, { strict: true, brandAliases });
      if (strict.flags.some(flag => ['model-mismatch', 'spec-mismatch', 'brand-mismatch', 'category-mismatch', 'low-context'].includes(flag))) return strict;
      for (const t of torob.titles(prod)) { const ev = Match.evaluate(t, ct); if (!best || (ev.ok && !best.ok) || (ev.ok === best.ok && ev.score > best.score)) best = ev; }
      return best || Match.evaluate(prod.title || '', ct);
    },
    async sellers(prod, base, ev, searchId) {
      const baseTitle = base.name1 + ' ' + (base.name2 || '');
      const params = new URLSearchParams({ source: 'next_mobile', discover_method: 'direct', prk: base.random_key, list_type: 'products_info' });
      if (searchId) params.set('search_id', searchId);
      const res = await Net.json('https://api.torob.com/v4/base-product/sellers/?' + params, { referer: TOROB_REF, timeout: 15000 });
      const list = res?.results || res?.products_info?.result || [], ts = Date.now();
      const excludedOffer = s => [s.page_url, s.redirect_url, s.product_url, s.url].filter(Boolean).some(isExcludedTorobSellerPage);
      const eligible = list.filter(s => !excludedOffer(s)), excluded = list.length - eligible.length;
      const mapped = eligible.map(s => {
        const shop = String(s.shop_name || s.domain || s.shop_text || '').replace(/^www\./, '');
        const key = Extract.matchKnownSite(s.domain || shop) || Extract.matchKnownSite(shop);
        return Model.offer({ sourceId: 'torob', productId: prod.id, seller: key ? (Extract.KNOWN[key][0] || key) : shop, sellerKey: key || '', sellerUrl: String(s.page_url || s.redirect_url || s.product_url || s.url || ''), price: Number(s.price ?? s.price_value),
          ts, dataSource: 'torob:base-product/sellers', matchConfidence: ev.score, matchLevel: ev.level, matchTitle: baseTitle, flags: ev.flags });
      });
      if (excluded) Log.info('torob', `${excluded} صفحهٔ فروش نامرتبط حذف شد`);
      const raw = mapped.filter(o => o.seller && o.price > 0);
      const byS = new Map(), dup = {};
      for (const o of raw) { const k = o.sellerKey || o.seller; dup[k] = (dup[k] || 0) + 1; const cur = byS.get(k); if (!cur || o.price < cur.price) byS.set(k, o); }
      const offers = [...byS.values()].map(o => { const k = o.sellerKey || o.seller; if (dup[k] > 1) o.flags = [...o.flags, 'dedup:' + dup[k]]; return o; });
      Log.info('torob', `${raw.length} فروشنده → ${offers.length} پس از حذف تکراری`);
      return offers;
    },
    async fetch(prod, { query, pickKey } = {}) {
      const tried = []; let found = null; const nearMiss = []; let rejected = 0;
      const qs = torob.queries(prod, query);
      for (let i = 0; i < qs.length && !found; i++) {
        let res; try { res = await torob.search(qs[i]); } catch (e) { if (i === 0) throw e; Log.warn('torob', 'جست‌وجوی مرحلهٔ ' + (i + 1) + ' ناموفق: ' + e.message); break; }
        tried.push(qs[i]); Log.info('torob', `«${qs[i]}» → ${res.results.length} نتیجه`);
        const valid = res.results.filter(r => r && r.name1 && !r.is_adv && Number(r.price) > 0 && r.random_key);
        const evaluated = valid.map(r => ({ r, ev: torob.evalCand(prod, r) })), ok = evaluated.filter(x => x.ev.ok);
        rejected += evaluated.length - ok.length;
        for (const x of evaluated.filter(x => !x.ev.ok && x.ev.flags.includes('model-mismatch')).slice(0, 3)) nearMiss.push({ title: x.r.name1 + ' ' + (x.r.name2 || ''), reason: x.ev.reasons[0] });
        if (ok.length) { const rank = { high: 0, medium: 1, low: 2 }; ok.sort((a, b) => rank[a.ev.level] - rank[b.ev.level] || b.ev.score - a.ev.score || Number(a.r.price) - Number(b.r.price)); found = { ok, searchId: res.searchId, q: qs[i] }; }
      }
      if (!found) return { status: 'no-match', offers: [], note: 'محصول مطابقی در ترب با اطمینان کافی پیدا نشد (' + tried.length + ' جست‌وجو)', nearMiss: nearMiss.slice(0, 3), rejected, tried, candidates: [], query: tried[0] || '' };
      const pick = (pickKey && found.ok.find(x => x.r.random_key === pickKey)) || found.ok[0], base = pick.r;
      const baseTitle = base.name1 + ' ' + (base.name2 || '');
      Log.info('torob', `محصول انتخاب‌شده: ${baseTitle} [${pick.ev.level} ${pick.ev.score}]`);
      const offers = await torob.sellers(prod, base, pick.ev, found.searchId);
      const candidates = found.ok.slice(0, 6).map(x => ({ key: x.r.random_key, title: x.r.name1 + ' ' + (x.r.name2 || ''), price: Number(x.r.price), level: x.ev.level }));
      return { status: offers.length ? 'ok' : 'empty', offers, note: baseTitle, nearMiss: nearMiss.slice(0, 3), rejected, tried, candidates, chosenKey: base.random_key, query: found.q };
    }
  };

  // Search the same product at each marketplace, but only accept explicit model/brand matches.
  // These public search endpoints are not contractual APIs and can change without notice.
  const EMALLS_REF = 'https://emalls.ir/';
  const BASALAM_API = 'https://services.basalam.com/web/v1/search/product/search';
  const SNAPP_API = 'https://apix.snappshop.ir/';
  const SNAPP_CITIES = {
    tehran: { label: 'تهران', lat: 35.6892, lng: 51.3890 },
    mashhad: { label: 'مشهد', lat: 36.2972, lng: 59.6067 },
    isfahan: { label: 'اصفهان', lat: 32.6546, lng: 51.6680 },
    shiraz: { label: 'شیراز', lat: 29.5918, lng: 52.5837 }
  };
  const searchTerms = (prod, override) => override ? [String(override).trim()].filter(Boolean) : torob.queries(prod).slice(0, 2);
  const parsePrice = value => {
    const price = Number(U.digits(String(value ?? '')).replace(/\D/g, ''));
    return Number.isFinite(price) && price > 0 ? price : 0;
  };
  function safeMarketplaceUrl(raw, allowedHosts = []) {
    try {
      const url = new URL(String(raw || ''));
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      return url.protocol === 'https:' && allowedHosts.includes(host) ? url.href : '';
    } catch { return ''; }
  }
  function strictMatch(prod, title) {
    const titles = [...new Set([prod.title, ...(prod.altTitles || [])].filter(Boolean))];
    const aliases = [...new Set([
      ...(Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases]),
      prod.brand, prod.brandEn, ...titles.flatMap(Match.brandFamilies)
    ].filter(Boolean))];
    const matches = titles.map(source => Match.evaluate(source, title, { strict: true, brandAliases: aliases }));
    return matches.sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score)[0] || Match.evaluate(prod.title || '', title, { strict: true, brandAliases: aliases });
  }
  function mapMarketOffer(prod, row, { sourceId, title, price, seller, sellerUrl, allowedHosts, priceFactor = 1, dataSource, exclude } = {}) {
    const name = String(title || '').trim(), url = safeMarketplaceUrl(sellerUrl, allowedHosts);
    if (!name || !url || (exclude && exclude(row, url))) return null;
    const amount = parsePrice(price) * priceFactor, ev = strictMatch(prod, name);
    if (!(amount > 0) || !ev.ok || ev.score < 0.65) return null;
    const storeName = String(seller || '').trim();
    const sellerKey = Extract.matchKnownSite(url) || Extract.matchKnownSite(storeName);
    return Model.offer({ sourceId, productId: prod.id, seller: storeName || sourceId, sellerKey: sellerKey || '', sellerUrl: url, price: amount,
      ts: Date.now(), dataSource, matchConfidence: ev.score, matchLevel: ev.level, matchTitle: name, flags: ev.flags });
  }
  function marketResult(offers, tried, rejected, nearMiss = [], note = '') {
    const unique = new Map();
    for (const offer of offers) {
      const key = `${offer.sellerKey || offer.seller}|${offer.price}|${offer.sellerUrl}`;
      if (!unique.has(key)) unique.set(key, offer);
    }
    const list = [...unique.values()];
    return { status: list.length ? 'ok' : 'no-match', offers: list, note: note || (list.length ? `${list.length} نتیجهٔ همسان` : 'نتیجهٔ همسان با برند و کد مدل پیدا نشد'), tried, rejected, nearMiss: nearMiss.slice(0, 3) };
  }
  function reverseEmallsLink(value) {
    try {
      const url = new URL(String(value || '').split('').reverse().join(''));
      return url.protocol === 'https:' && url.hostname === 'click.emalls.ir' ? url.href : '';
    } catch { return ''; }
  }
  function excludedBasalamProduct(row, url) {
    const id = String(row?.id || '');
    return id === '25406964' || isExcludedTorobSellerPage(url);
  }
  const emalls = {
    id: 'emalls', label: 'ایمالز', icon: 'emalls', kind: 'offers', implemented: true, hosts: ['emalls.ir'],
    note: 'جست‌وجوی زندهٔ ایمالز؛ تطبیق برند و مدل پیش از نمایش قیمت',
    async search(q) {
      const body = new URLSearchParams({ findstr: q, entekhab: 'listitemv2', pagenum: '1' });
      return Net.json('https://emalls.ir/swservice/site_search', { method: 'POST', body: body.toString(), referer: EMALLS_REF, timeout: 18000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } });
    },
    async fetch(prod, { query } = {}) {
      const tried = [], offers = [], nearMiss = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await emalls.search(q), rows = Array.isArray(result?.lstsearchresualt) ? result.lstsearchresualt : [];
        for (const row of rows) {
          const name = row?.title || '', link = reverseEmallsLink(row?.buyLink);
          const seller = String(row?.buyTitle || '').replace(/^خرید[\u200c\u200e\s]*از[\u200c\u200e\s]*/u, '').trim();
          const offer = mapMarketOffer(prod, row, { sourceId: 'emalls', title: name, price: row?.price, seller, sellerUrl: link, allowedHosts: ['click.emalls.ir'], dataSource: 'emalls:site_search/listitemv2', exclude: item => item?.agahi || item?.used === true });
          if (offer) offers.push(offer); else { rejected++; if (name && nearMiss.length < 3) nearMiss.push({ title: name, reason: 'تطبیق برند، مدل یا لینک خرید کافی نبود' }); }
        }
      }
      return marketResult(offers, tried, rejected, nearMiss);
    }
  };
  const basalam = {
    id: 'basalam', label: 'باسلام', icon: 'basalam', kind: 'offers', implemented: true, hosts: ['services.basalam.com'],
    note: 'جست‌وجوی زندهٔ باسلام؛ مبلغ ریالی به تومان تبدیل می‌شود',
    async search(q) {
      const url = new URL(BASALAM_API); url.search = new URLSearchParams({ q, sort: 'rank', from: '0', size: '30' }).toString();
      return Net.json(url.href, { referer: 'https://basalam.com/', timeout: 18000 });
    },
    async fetch(prod, { query } = {}) {
      const tried = [], offers = [], nearMiss = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await basalam.search(q), rows = Array.isArray(result?.products) ? result.products : [];
        for (const row of rows) {
          const slug = String(row?.vendor?.identifier || '').trim(), id = String(row?.id || '').trim();
          const url = slug && id ? `https://basalam.com/${encodeURIComponent(slug)}/product/${encodeURIComponent(id)}` : '';
          const offer = mapMarketOffer(prod, row, { sourceId: 'basalam', title: row?.name, price: row?.price, priceFactor: 0.1,
            seller: row?.vendor?.name, sellerUrl: url, allowedHosts: ['basalam.com'], dataSource: 'basalam:guest-product-search', exclude: excludedBasalamProduct });
          if (offer && row?.IsSaleable !== false && row?.status?.title !== 'ناموجود') offers.push(offer);
          else { rejected++; if (row?.name && nearMiss.length < 3) nearMiss.push({ title: row.name, reason: 'تطبیق برند/مدل، موجودی یا لینک کافی نبود' }); }
        }
      }
      return marketResult(offers, tried, rejected, nearMiss);
    }
  };
  const snappshop = {
    id: 'snappshop', label: 'اسنپ‌شاپ', icon: 'snappshop', kind: 'offers', implemented: true, hosts: ['apix.snappshop.ir'], cities: SNAPP_CITIES,
    note: 'قیمت اسنپ‌شاپ بر اساس شهر انتخابی محاسبه می‌شود',
    async fetch(prod, { query } = {}) {
      const city = SNAPP_CITIES[Store.get().settings.snappCity] || SNAPP_CITIES.tehran;
      const coordinates = `lat=${encodeURIComponent(city.lat)}&lng=${encodeURIComponent(city.lng)}`;
      const tokenData = await Net.json(`${SNAPP_API}guest/v2/token?${coordinates}`, { timeout: 15000 });
      const token = tokenData?.data?.token || tokenData?.token;
      if (!token) throw new Error('توکن مهمان اسنپ‌شاپ در پاسخ پیدا نشد');
      const tried = [], offers = [], nearMiss = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await Net.json(`${SNAPP_API}search/v1?${coordinates}`, { method: 'POST', timeout: 18000,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ render: 4, query: q }) });
        const rows = (result?.data?.structure || []).flatMap(section => Array.isArray(section?.items) ? section.items : []);
        for (const row of rows) {
          const url = row?.href ? new URL(row.href, 'https://snappshop.ir/').href : '';
          const rawPrice = row?.price?.discounted_price || row?.price?.price;
          const offer = mapMarketOffer(prod, row, { sourceId: 'snappshop', title: row?.title, price: rawPrice,
            seller: 'اسنپ‌شاپ', sellerUrl: url, allowedHosts: ['snappshop.ir'], dataSource: 'snappshop:search/v1',
            exclude: item => item?.is_ads || item?.is_fake });
          if (offer) offers.push(offer);
          else { rejected++; if (row?.title && nearMiss.length < 3) nearMiss.push({ title: row.title, reason: 'آگهی یا تطبیق برند/مدل کافی نبود' }); }
        }
      }
      return marketResult(offers, tried, rejected, nearMiss, offers.length ? `قیمت اسنپ‌شاپ · ${city.label}` : `برای این شهر (${city.label}) نتیجهٔ همسان با برند و کد مدل پیدا نشد`);
    }
  };

  // ---------- Digikala official data ----------
  const dk = {
    // Live product record: exact variant price / pre-discount price / seller / warranty / Digikala's own 30-day low
    parseProduct(json, variantId) {
      const p = json?.data?.product; if (!p) return null;
      const vs = Array.isArray(p.variants) ? p.variants : [];
      const toT = r => (r == null ? null : Math.round(Number(r) / 10));
      const mk = v => { const pr = v.price || {}; return { variantId: String(v.id), title: (v.themes || []).map(t => t.value && t.value.title).filter(Boolean).join(' / '), price: toT(pr.selling_price), rrp: pr.discount_percent ? toT(pr.rrp_price) : null, discountPct: pr.discount_percent || 0, seller: v.seller?.title || '', warranty: v.warranty?.title_fa || '' }; };
      const all = vs.map(mk).filter(x => x.price > 0).sort((a, b) => a.price - b.price);
      const chosen = (variantId && all.find(x => x.variantId === String(variantId))) || null;
      return { title: p.title_fa || '', titleEn: p.title_en || '', brand: p.brand?.title_fa || '', brandEn: p.brand?.title_en || '', variants: all, chosen, exact: !!chosen, lowest30dOfficial: toT(p.properties?.min_price_in_last_month) };
    },
    async product(pid, variantId) {
      const json = await Net.json(`https://api.digikala.com/product/v1/products/${pid}/`, DK_OPTS);
      return dk.parseProduct(json, variantId);
    },
    // Price chart: rial -> toman, Jalali day -> UTC time. Missing days stay missing (no interpolation).
    parseChart(json) {
      const d = json?.data; if (!d || !Array.isArray(d.price_chart)) return null;
      const variants = d.price_chart.map((c, i) => {
        const pts = (c.history || []).map(h => {
          const t = U.jalaliToTime(h.day); if (t == null) return null;
          const sp = Number(h.selling_price);
          return Model.point({ t, day: h.day, price: sp > 0 ? Math.round(sp / 10) : null, rrp: Number(h.rrp_price) > 0 ? Math.round(Number(h.rrp_price) / 10) : null,
            seller: h.seller || '', warranty: h.product_warranty || '', marketable: !!h.is_marketable && sp > 0, source: 'digikala:price-chart' });
        }).filter(Boolean).sort((a, b) => a.t - b.t);
        return { id: String(c.id ?? i), title: c.title || '', points: pts };
      });
      const all = variants.flatMap(v => v.points), ts = all.map(p => p.t);
      return { today: d.today || '', selectionTitle: d.chart_selection_title || '', variants, range: ts.length ? { from: Math.min(...ts), to: Math.max(...ts), days: Math.round((Math.max(...ts) - Math.min(...ts)) / U.DAY) + 1 } : null };
    },
    async chart(pid) {
      const json = await Net.json(`https://api.digikala.com/v1/product/${pid}/price-chart/`, DK_OPTS);
      const c = dk.parseChart(json); if (!c) throw new Error('ساختار پاسخ نمودار قیمت شناخته نشد');
      return c;
    },
    // pick the chart variant that matches the colour selected on the page
    pickVariant(chart, color) {
      if (!chart || !chart.variants.length) return null;
      const colors = (Array.isArray(color) ? color : [color]).map(U.compact).filter(Boolean);
      for (const c of colors) {
        const m = chart.variants.find(v => U.compact(v.title) === c);
        if (m) return { variant: m, exact: true };
      }
      for (const c of colors) {
        const m = chart.variants.find(v => {
          const title = U.compact(v.title);
          return title.length >= 2 && (c.includes(title) || title.includes(c));
        });
        if (m) return { variant: m, exact: false };
      }
      const live = chart.variants.filter(v => v.points.some(p => p.marketable));
      const best = (live.length ? live : chart.variants).slice().sort((a, b) => b.points.length - a.points.length)[0];
      return { variant: best, exact: chart.variants.length === 1 };
    }
  };

  const registry = { torob, emalls, basalam, snappshop };
  return { registry, torob, emalls, basalam, snappshop, dk };
})();
