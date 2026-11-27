/* ===== Sources: independent modules. A failing source never disables the others. ===== */
const Sources = (() => {
  const TOROB_REF = 'https://torob.com/';
  const DK_REF = 'https://www.digikala.com/';
  const SEARCH_QUERY_NOISE = new Set(['مخصوص', 'مدل', 'قیمت', 'خرید', 'ارزان', 'ارزانترین', 'اورجینال', 'اصل', 'مناسب', 'و', 'با', 'از', 'برای', 'در', 'به']);
  const TOROB_FREE_SEARCH_PRODUCT_LIMIT = 10;
  const TOROB_FREE_SEARCH_BATCH_SIZE = 4;
  const TOROB_PRODUCT_RECORD_LIMIT = 6;
  // Torob appends VAR-* catalog identifiers to some titles. These identify
  // Torob records, not shopper-facing models or variants, so ignore them in
  // matching, deduplication, and the visible candidate title.
  const candidateTitle = r => [r?.name1, r?.name2].filter(Boolean).join(' ')
    .replace(/\bVAR[\s._-]*\d+\b/gi, ' ').replace(/\s+/g, ' ').trim();
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
      const searchTokens = text => U.tokens(text).filter(token => !/^\d+ch$/i.test(token));
      const prefix = searchTokens(core).filter(x => !codes.includes(x) && !SEARCH_QUERY_NOISE.has(x)).slice(0, 5).join(' ');
      const focused = [prefix, codes.join(' ')].filter(Boolean).join(' ');
      const shortEnglish = en ? Extract.coreTitle(en) : '';
      const aliases = Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases];
      const searchableBrand = [prod.brandEn, ...aliases, prod.brand].find(x => /[a-z]/i.test(String(x || '')));
      const brandCodeQuery = searchableBrand && codeQuery ? `${String(searchableBrand).trim()} ${codeQuery}` : '';
      const candidates = codes.length
        ? [brandCodeQuery, focused, ...(brandCodeQuery ? [] : [codeQuery]), core, shortEnglish]
        : [core, searchTokens(core).slice(0, 5).join(' '), shortEnglish];
      return [...new Set(candidates.map(x => String(x || '').trim()).filter(Boolean))].slice(0, 4);
    },
    candidateTitle,
    candidateProfile(r) {
      const title = torob.candidateTitle(r);
      const normalized = U.normalize(title), codes = Match.modelCodes(title);
      const tokens = [...new Set(normalized.split(' ').filter(token => token && !U.STOP.has(token)))];
      const codeParts = new Set(tokens.filter(token => {
        const part = token.replace(/[^a-z0-9]/g, '');
        return part && codes.some(code => code.includes(part));
      }));
      const colors = [
        ['black', ['مشکی', 'black']], ['white', ['سفید', 'white']],
        ['gray', ['طوسی', 'خاکستری', 'نقره ای', 'gray', 'grey', 'silver']],
        ['red', ['قرمز', 'red']], ['blue', ['آبی', 'blue']],
        ['navy', ['سرمه ای', 'navy']], ['green', ['سبز', 'green']],
        ['olive', ['زیتونی', 'ارتشی', 'olive', 'army green']],
        ['salmon', ['کالباسی', 'مرجانی', 'salmon', 'coral']],
        ['pink', ['صورتی', 'pink']], ['purple', ['بنفش', 'purple']],
        ['gold', ['طلایی', 'gold']], ['brown', ['قهوه ای', 'brown']],
        ['beige', ['کرم', 'بژ', 'beige']]
      ];
      const suffixes = ['pro', 'plus', 'lite', 'max', 'ultra', 'mini', 'neo', 'air', 'se', 'fe', 'پرو', 'پلاس', 'لایت', 'مکس', 'اولترا', 'مینی', 'نیو', 'ایر'];
      const hasPhrase = phrase => (' ' + normalized + ' ').includes(' ' + U.normalize(phrase) + ' ');
      const packageInfo = (() => {
        const text = U.normalize(U.digits(title));
        const packageWords = '(?:^|\\s)(?:بسته|پک|ست|مجموعه|pack|set|bundle)(?=\\s|$)';
        const number = '(\\d+|یک|یکی|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده)';
        const countPatterns = [
          new RegExp(packageWords + '\\s*(?:از\\s*)?' + number + '\\s*(?:عدد(?:ی)?|تایی|pcs?|pieces?)', 'i'),
          new RegExp('(?<![a-z0-9])' + number + '\\s*(?:عدد(?:ی)?|تایی|pcs?|pieces?)(?=\\s|$)', 'i'),
          new RegExp('(?:pack|set)\\s*(?:of\\s*)?' + number + '(?=\\s|$)', 'i')
        ];
        for (const pattern of countPatterns) {
          const match = text.match(pattern);
          if (match) {
            const wordCounts = { یک: 1, یکی: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10 };
            return 'count:' + (wordCounts[match[1]] || Number(match[1]));
          }
        }
        return new RegExp(packageWords, 'i').test(text) ? 'package:unspecified' : '';
      })();
      return {
        title, codes,
        packageInfo,
        tokens: new Set([...tokens.filter(token => !codeParts.has(token)), ...codes]),
        plainTokens: new Set(tokens.filter(token => !codeParts.has(token))),
        colors: new Set(colors.filter(([, aliases]) => aliases.some(hasPhrase)).map(([id]) => id)),
        suffixes: new Set(suffixes.filter(hasPhrase)),
        brands: new Set(Match.brandFamilies(title)),
        types: new Set(Match.productTypes(title)),
        specs: Match.specs(title)
      };
    },
    candidateIdentity(r) {
      // Torob may return the same base product under different random_keys and
      // title word order across the search ladder. Compare normalized token sets
      // so punctuation, duplicate words, and filler such as «مدل» do not create
      // duplicate choices; meaningful color/model/spec tokens remain distinct.
      return [...torob.candidateProfile(r).tokens].sort().join(' ');
    },
    searchIdentity(r) {
      // Search results must retain package counts and other one-digit variants;
      // the strict-comparison identity intentionally ignores some of those.
      const tokens = U.normalize(torob.candidateTitle(r)).split(' ').filter(token => token && !U.STOP.has(token) && !SEARCH_QUERY_NOISE.has(token));
      return [...new Set(tokens)].sort().join(' ');
    },
    sameCandidateProduct(a, b) {
      const x = torob.candidateProfile(a), y = torob.candidateProfile(b);
      const overlaps = (left, right) => [...left].filter(value => right.has(value));
      // A stated bundle/count is part of the product identity. Do not merge a
      // single item with a multi-pack, or an unknown pack with an explicit one.
      if ((x.packageInfo || y.packageInfo) && x.packageInfo !== y.packageInfo) return false;
      if (torob.candidateIdentity(a) === torob.candidateIdentity(b)) return true;
      const compatibleCodes = (left, right) => left === right || (Math.min(left.length, right.length) >= 4 && (left.endsWith(right) || right.endsWith(left)));
      const codeOverlap = x.codes.some(aCode => y.codes.some(bCode => compatibleCodes(aCode, bCode)));
      const exactCodeOverlap = x.codes.some(aCode => y.codes.includes(aCode));
      const brandOverlap = overlaps(x.brands, y.brands).length > 0;
      if (x.codes.length && y.codes.length && !codeOverlap) return false;
      if (x.brands.size && y.brands.size && !brandOverlap) return false;
      if (x.types.size && y.types.size && !overlaps(x.types, y.types).length) return false;
      if ((x.colors.size || y.colors.size) && !overlaps(x.colors, y.colors).length) return false;
      if ((x.suffixes.size || y.suffixes.size) && !overlaps(x.suffixes, y.suffixes).length) return false;
      for (const unit of new Set([...Object.keys(x.specs), ...Object.keys(y.specs)])) {
        const aValues = x.specs[unit], bValues = y.specs[unit];
        if (aValues && bValues && ![...aValues].some(value => bValues.has(value))) return false;
      }

      const shared = overlaps(x.plainTokens, y.plainTokens).length;
      const smaller = Math.min(x.plainTokens.size, y.plainTokens.size);
      const union = new Set([...x.plainTokens, ...y.plainTokens]).size;
      const containment = smaller ? shared / smaller : 0;
      const jaccard = union ? shared / union : 0;
      const sameType = overlaps(x.types, y.types).length > 0;
      const sharedIdentityTerms = overlaps(x.plainTokens, y.plainTokens).filter(token =>
        !Match.brandFamilies(token).length && !SEARCH_QUERY_NOISE.has(token) && !['کد', 'code', 'original', 'genuine'].includes(token));
      // A compatible model code plus matching product type is stronger than
      // small title wording changes between Torob's search queries.
      if (codeOverlap && sameType && shared >= 2) return true;
      // Some categories (for example stationery) are not in the type taxonomy.
      // An exact model code, matching known brand, and one shared product word
      // can merge alternate catalog titles without masking known spec conflicts.
      if (exactCodeOverlap && x.brands.size && y.brands.size && brandOverlap && sharedIdentityTerms.length >= 1) return true;
      // Without that anchor, require near two-way title similarity so unrelated
      // products and vague short titles are not collapsed together.
      return shared >= 3 && containment >= 0.9 && jaccard >= 0.78;
    },
    async search(q) {
      const e = encodeURIComponent(q);
      const r = await Net.json(`https://api.torob.com/v4/base-product/search/?page=0&sort=popularity&size=24&query=${e}&q=${e}&source=next_desktop`, { referer: TOROB_REF, timeout: 15000, anonymous: true });
      return { results: Array.isArray(r.results) ? r.results : [], searchId: r.search_id || r.searchId || '' };
    },
    // Evaluate against every known title of the product (page title + Digikala official titles) and keep the best verdict.
    evalCand(prod, r) {
      const ct = torob.candidateTitle(r);
      // Check model/spec contradictions before token coverage: long page headings may have low overlap.
      const titles = torob.titles(prod);
      const aliases = Array.isArray(prod.brandAliases) ? prod.brandAliases : [prod.brandAliases];
      const brandAliases = [...new Set([...aliases, prod.brand, prod.brandEn, ...titles.flatMap(Match.brandFamilies)].filter(Boolean))];
      const primaryTitle = prod.title || titles[0] || '';
      const primary = Match.evaluate(primaryTitle, ct, { strict: true, brandAliases });
      const hardConflicts = ['model-mismatch', 'spec-mismatch', 'brand-mismatch', 'category-mismatch', 'category-unverified', 'low-context'];
      if (primary.flags.some(flag => hardConflicts.includes(flag))) return primary;
      const alternatives = titles.filter(title => title !== primaryTitle).map(title => Match.evaluate(title, ct, { brandAliases }));
      return [primary, ...alternatives].filter(ev => ev.ok).sort((a, b) => b.score - a.score)[0] || primary;
    },
    async sellers(prod, base, ev, searchId, { freeSearch = false } = {}) {
      const baseTitle = torob.candidateTitle(base);
      const params = new URLSearchParams({ source: 'next_mobile', discover_method: 'direct', prk: base.random_key, list_type: 'products_info' });
      if (searchId) params.set('search_id', searchId);
      const res = await Net.json('https://api.torob.com/v4/base-product/sellers/?' + params, { referer: TOROB_REF, timeout: 15000, anonymous: true });
      const list = res?.results || res?.products_info?.result || [], ts = Date.now();
      const excludedOffer = s => [s.page_url, s.redirect_url, s.product_url, s.url].filter(Boolean).some(isExcludedTorobSellerPage);
      const eligible = list.filter(s => !excludedOffer(s) && s.availability !== false && s.is_price_unreliable !== true), excluded = list.length - eligible.length;
      const mapped = eligible.map(s => {
        const shop = String(s.shop_name || s.domain || s.shop_text || '').replace(/^www\./, '');
        const key = Extract.matchKnownSite(s.domain || shop) || Extract.matchKnownSite(shop);
        const more = s.more_info || {}, badges = Array.isArray(s.badges) ? s.badges.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean) : [];
        const shippingInfo = [...new Set([
          ...(Array.isArray(more.shipping_types) ? more.shipping_types.filter(value => typeof value === 'string') : []),
          ...(more.free_shipping === true ? ['ارسال رایگان'] : []),
          ...(more.same_day_delivery === true ? ['تحویل در همان روز'] : []),
          ...(more.payment_on_delivery === true ? ['پرداخت در محل'] : []),
          ...badges.filter(value => /ارسال|تحویل|پیک|پست|تیپاکس/.test(value))
        ].map(value => value.trim()).filter(Boolean))];
        const warrantyInfo = [...new Set([
          ...[s.warranty, s.warranty_info, s.guarantee_info?.title, s.guarantee_info?.text].filter(value => typeof value === 'string'),
          ...(s.guarantee_info?.status === 'enabled' ? ['وضعیت گارانتی: فعال'] : []),
          ...badges.filter(value => /گارانتی|ضمانت/.test(value))
        ].map(value => value.trim()).filter(Boolean))];
        return Model.offer({ sourceId: 'torob', productId: prod.id, seller: key ? (Extract.KNOWN[key][0] || key) : shop, sellerKey: key || '', sellerUrl: String(s.page_url || s.redirect_url || s.product_url || s.url || ''), price: Number(s.price ?? s.price_value),
          ts, dataSource: 'torob:base-product/sellers', matchConfidence: freeSearch ? null : ev.score, matchLevel: freeSearch ? '' : ev.level, matchTitle: baseTitle, flags: freeSearch ? [] : ev.flags, shippingInfo, warrantyInfo });
      });
      if (excluded) Log.info('torob', `${excluded} صفحهٔ فروش نامرتبط حذف شد`);
      const raw = mapped.filter(o => o.seller && o.price > 0);
      const byS = new Map(), dup = {};
      for (const o of raw) { const k = o.sellerKey || o.seller; dup[k] = (dup[k] || 0) + 1; const cur = byS.get(k); if (!cur || o.price < cur.price) byS.set(k, o); }
      const offers = [...byS.values()].map(o => { const k = o.sellerKey || o.seller; if (dup[k] > 1) o.flags = [...o.flags, 'dedup:' + dup[k]]; return o; });
      Log.info('torob', `${raw.length} فروشنده → ${offers.length} پس از حذف تکراری`);
      return offers;
    },
    async fetch(prod, { query, pickKey, freeSearch = false } = {}) {
      const tried = [], nearMiss = new Map(), rejected = new Set(), byKey = new Map();
      const qs = torob.queries(prod, query);
      const responses = await Promise.all(qs.map(async (q, index) => {
        try { return { q, index, res: await torob.search(q) }; }
        catch (error) { return { q, index, error }; }
      }));
      const rank = { high: 0, medium: 1, low: 2 };
      const compareCandidates = (a, b) => rank[a.ev.level] - rank[b.ev.level] || b.ev.score - a.ev.score || a.queryIndex - b.queryIndex || Number(a.r.price) - Number(b.r.price);
      let firstError = null, successfulSearches = 0;
      for (const item of responses) {
        tried.push(item.q);
        if (item.error) { firstError ||= item.error; Log.warn('torob', 'جست‌وجوی مرحلهٔ ' + (item.index + 1) + ' ناموفق: ' + item.error.message); continue; }
        successfulSearches++;
        const res = item.res;
        Log.info('torob', `«${item.q}» → ${res.results.length} نتیجه`);
        const valid = res.results.filter(r => r && r.name1 && !r.is_adv && Number(r.price) > 0 && r.random_key);
        for (const r of valid) {
          const title = torob.candidateTitle(r);
          const candidate = { r, ev: freeSearch ? freeSearchMatch(query, title) : torob.evalCand(prod, r), searchId: res.searchId, q: item.q, queryIndex: item.index };
          if (!candidate.ev.ok || candidate.ev.level === 'low') {
            rejected.add(r.random_key);
            if (!freeSearch && candidate.ev.flags.some(flag => ['model-mismatch', 'spec-mismatch', 'brand-mismatch', 'category-mismatch', 'category-unverified', 'low-context', 'low-coverage'].includes(flag)) && nearMiss.size < 8 && !nearMiss.has(r.random_key)) nearMiss.set(r.random_key, { title, reason: candidate.ev.reasons[0] });
            continue;
          }
          const current = byKey.get(r.random_key);
          if (!current || compareCandidates(candidate, current) < 0) byKey.set(r.random_key, candidate);
        }
      }
      if (!successfulSearches && firstError) throw firstError;
      const ok = [], searchIdentities = new Set(), productGroups = [];
      for (const candidate of [...byKey.values()].sort(compareCandidates)) {
        if (freeSearch) {
          const identity = torob.searchIdentity(candidate.r) || String(candidate.r.random_key || '');
          if (searchIdentities.has(identity)) continue;
          searchIdentities.add(identity);
          ok.push(candidate);
        } else {
          const group = productGroups.find(current => torob.sameCandidateProduct(current[0].r, candidate.r));
          if (group) group.push(candidate);
          else { productGroups.push([candidate]); ok.push(candidate); }
        }
      }
      const misses = [...nearMiss.values()].slice(0, 3);
      if (!ok.length) return { status: 'no-match', offers: [], note: freeSearch ? `در ترب نتیجه‌ای برای «${query}» پیدا نشد` : 'محصول مطابقی در ترب با اطمینان کافی پیدا نشد (' + tried.length + ' جست‌وجو)', nearMiss: freeSearch ? [] : misses, rejected: rejected.size, tried, candidates: [], query: tried[0] || '' };
      if (freeSearch) {
        // A free-text search can describe several products. Fetch seller lists for
        // a small set of distinct, relevant Torob results instead of comparing
        // only the first result with the product open in the browser.
        const selected = ok.slice(0, TOROB_FREE_SEARCH_PRODUCT_LIMIT), groups = [];
        let successfulSellerLookups = 0, failedSellerLookups = 0, firstSellerError = null;
        for (let i = 0; i < selected.length; i += TOROB_FREE_SEARCH_BATCH_SIZE) {
          const batch = selected.slice(i, i + TOROB_FREE_SEARCH_BATCH_SIZE);
          const results = await Promise.allSettled(batch.map(candidate => torob.sellers(prod, candidate.r, candidate.ev, candidate.searchId, { freeSearch: true })));
          for (const result of results) {
            if (result.status === 'fulfilled') { successfulSellerLookups++; groups.push(result.value); }
            else {
              failedSellerLookups++;
              const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason || 'خطای نامشخص'));
              firstSellerError ||= error;
              Log.warn('torob', 'دریافت فهرست فروشندگان یک نتیجه ناموفق بود: ' + error.message);
            }
          }
        }
        if (!successfulSellerLookups && firstSellerError) throw firstSellerError;
        const unique = new Map();
        for (const offer of groups.flat()) {
          const key = `${offer.sellerKey || offer.seller}|${offer.price}|${offer.sellerUrl}|${U.normalize(offer.matchTitle)}`;
          if (!unique.has(key)) unique.set(key, offer);
        }
        const offers = [...unique.values()];
        const note = `${U.toFa(selected.length)} محصول مرتبط با «${query}» در ترب بررسی شد${failedSellerLookups ? `؛ دریافت قیمت ${U.toFa(failedSellerLookups)} مورد ناموفق بود` : ''}`;
        return { status: offers.length ? 'ok' : 'empty', offers, note, nearMiss: [], rejected: rejected.size, tried, candidates: [], chosenKey: '', query };
      }
      const pick = (pickKey && ok.find(x => x.r.random_key === pickKey)) || ok[0], base = pick.r;
      const selectedGroup = productGroups.find(group => group.some(candidate => candidate.r.random_key === pick.r.random_key)) || [pick];
      const baseTitle = torob.candidateTitle(base);
      Log.info('torob', `محصول انتخاب‌شده: ${baseTitle} [${pick.ev.level} ${pick.ev.score}]`);
      const records = selectedGroup.slice(0, TOROB_PRODUCT_RECORD_LIMIT);
      if (selectedGroup.length > 1) Log.info('torob', `${U.toFa(selectedGroup.length)} رکورد هم‌محصول؛ بررسی ${U.toFa(records.length)} رکورد فروش`);
      if (selectedGroup.length > records.length) Log.warn('torob', `برای جلوگیری از درخواست زیاد، ${U.toFa(selectedGroup.length - records.length)} رکورد هم‌محصول بررسی نشد`);
      const sellerResults = await Promise.allSettled(records.map(candidate => torob.sellers(prod, candidate.r, candidate.ev, candidate.searchId)));
      const sellerErrors = sellerResults.filter(result => result.status === 'rejected');
      const successfulSellerResults = sellerResults.filter(result => result.status === 'fulfilled').map(result => result.value);
      if (!successfulSellerResults.length && sellerErrors.length) throw sellerErrors[0].reason;
      if (sellerErrors.length) Log.warn('torob', `دریافت فهرست فروش ${U.toFa(sellerErrors.length)} رکورد هم‌محصول ناموفق بود`);
      const bySeller = new Map(), sellerCopies = new Map();
      for (const offer of successfulSellerResults.flat()) {
        const key = offer.sellerKey || offer.seller;
        const prior = bySeller.get(key);
        const duplicateFlag = offer.flags.find(flag => /^dedup:\d+$/.test(flag));
        sellerCopies.set(key, (sellerCopies.get(key) || 0) + (duplicateFlag ? Number(duplicateFlag.slice(6)) : 1));
        if (!prior || offer.price < prior.price) bySeller.set(key, offer);
      }
      const offers = [...bySeller.values()].map(offer => {
        const key = offer.sellerKey || offer.seller, count = sellerCopies.get(key) || 1;
        if (count <= 1) return offer;
        return { ...offer, flags: [...offer.flags.filter(flag => !/^dedup:\d+$/.test(flag)), 'dedup:' + count] };
      });
      const candidates = ok.slice(0, 6).map(x => ({ key: x.r.random_key, title: torob.candidateTitle(x.r), price: Number(x.r.price), level: x.ev.level }));
      return { status: offers.length ? 'ok' : 'empty', offers, note: baseTitle, nearMiss: misses, rejected: rejected.size, tried, candidates, chosenKey: base.random_key, query: pick.q };
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
    shiraz: { label: 'شیراز', lat: 29.5918, lng: 52.5837 },
    tabriz: { label: 'تبریز', lat: 38.0800, lng: 46.2919 },
    karaj: { label: 'کرج', lat: 35.8400, lng: 50.9391 },
    qom: { label: 'قم', lat: 34.6416, lng: 50.8746 },
    ahvaz: { label: 'اهواز', lat: 31.3183, lng: 48.6706 },
    kermanshah: { label: 'کرمانشاه', lat: 34.3142, lng: 47.0650 },
    urmia: { label: 'ارومیه', lat: 37.5527, lng: 45.0759 },
    rasht: { label: 'رشت', lat: 37.2808, lng: 49.5832 },
    yazd: { label: 'یزد', lat: 31.8974, lng: 54.3569 },
    kerman: { label: 'کرمان', lat: 30.2839, lng: 57.0834 },
    sari: { label: 'ساری', lat: 36.5633, lng: 53.0601 },
    arak: { label: 'اراک', lat: 34.0917, lng: 49.6892 },
    zahedan: { label: 'زاهدان', lat: 29.4963, lng: 60.8629 },
    bandarAbbas: { label: 'بندرعباس', lat: 27.1865, lng: 56.2808 },
    sanandaj: { label: 'سنندج', lat: 35.3114, lng: 46.9960 },
    zanjan: { label: 'زنجان', lat: 36.6736, lng: 48.4787 }
  };
  const searchTerms = (prod, override) => {
    if (override) return [String(override).trim()].filter(Boolean);
    const codes = [...new Set(torob.titles(prod).flatMap(Match.modelCodes))];
    // A model-only query such as "B60" pollutes marketplace results. Prefer the focused
    // brand/type + model query, then the complete product title as a second pass.
    return torob.queries(prod).filter(q => U.tokens(q).some(token => !codes.includes(token))).slice(0, 2);
  };
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
  function freeSearchMatch(query, title) {
    const queryTokens = U.tokens(query), titleTokens = U.tokens(title);
    if (!queryTokens.length || !titleTokens.length) return { ok: false, score: 0, level: 'low', flags: [], reasons: [] };
    const queryCodes = Match.modelCodes(query), titleCodes = Match.modelCodes(title);
    const codeCompatible = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.endsWith(b) || b.endsWith(a)));
    if (queryCodes.length && !queryCodes.every(a => titleCodes.some(b => codeCompatible(a, b)))) {
      return { ok: false, score: 0, level: 'low', flags: ['model-mismatch'], reasons: ['کد مدل با عبارت جست‌وجو متفاوت است'] };
    }
    const queryBrands = Match.brandFamilies(query), titleBrands = Match.brandFamilies(title);
    if (queryBrands.length && titleBrands.length && !queryBrands.some(brand => titleBrands.includes(brand))) {
      return { ok: false, score: 0, level: 'low', flags: ['brand-mismatch'], reasons: ['برند با عبارت جست‌وجو متفاوت است'] };
    }
    const queryTypes = Match.productTypes(query), titleTypes = Match.productTypes(title);
    if (queryTypes.length && titleTypes.length && !queryTypes.some(type => titleTypes.includes(type))) {
      return { ok: false, score: 0, level: 'low', flags: ['category-mismatch'], reasons: ['نوع کالا با عبارت جست‌وجو متفاوت است'] };
    }
    const querySpecs = Match.specs(query), titleSpecs = Match.specs(title);
    for (const unit of Object.keys(querySpecs)) if (titleSpecs[unit] && ![...querySpecs[unit]].some(value => titleSpecs[unit].has(value))) {
      return { ok: false, score: 0, level: 'low', flags: ['spec-mismatch'], reasons: ['مشخصه با عبارت جست‌وجو متفاوت است'] };
    }
    const hasToken = queryToken => titleTokens.some(titleToken => titleToken === queryToken ||
      (Math.min(queryToken.length, titleToken.length) >= 4 && (queryToken.startsWith(titleToken) || titleToken.startsWith(queryToken))));
    const matched = queryTokens.filter(hasToken).length;
    const required = queryTokens.length <= 2 ? queryTokens.length : Math.max(2, Math.ceil(queryTokens.length * 0.7));
    const score = matched / queryTokens.length;
    return { ok: matched >= required, score, level: matched >= required ? 'high' : 'low', flags: [], reasons: [] };
  }
  function marketMatchReason(prod, title) {
    const ev = strictMatch(prod, title);
    return ev.reasons[0] || (ev.ok ? 'اطمینان تطبیق برای نمایش کافی نبود' : 'تطبیق دقیق مدل یا برند تأیید نشد');
  }
  function mapMarketOffer(prod, row, { sourceId, title, price, seller, sellerUrl, allowedHosts, priceFactor = 1, dataSource, exclude, freeSearch = false, query = '' } = {}) {
    const name = String(title || '').trim(), url = safeMarketplaceUrl(sellerUrl, allowedHosts);
    if (!name || !url || (exclude && exclude(row, url))) return null;
    const amount = parsePrice(price) * priceFactor, ev = freeSearch ? freeSearchMatch(query, name) : strictMatch(prod, name);
    if (!(amount > 0) || !ev.ok || (!freeSearch && ev.score < 0.65)) return null;
    const storeName = String(seller || '').trim();
    const sellerKey = Extract.matchKnownSite(url) || Extract.matchKnownSite(storeName);
    return Model.offer({ sourceId, productId: prod.id, seller: storeName || sourceId, sellerKey: sellerKey || '', sellerUrl: url, price: amount,
      ts: Date.now(), dataSource, matchConfidence: freeSearch ? null : ev.score, matchLevel: freeSearch ? '' : ev.level, matchTitle: name, flags: freeSearch ? [] : ev.flags });
  }
  function marketResult(offers, tried, rejected, nearMiss = [], note = '', error = '') {
    const unique = new Map();
    for (const offer of offers) {
      const key = `${offer.sellerKey || offer.seller}|${offer.price}|${offer.sellerUrl}`;
      if (!unique.has(key)) unique.set(key, offer);
    }
    const list = [...unique.values()];
    return { status: list.length ? 'ok' : (error ? 'error' : 'no-match'), offers: list, note: note || (list.length ? `${list.length} نتیجهٔ همسان` : 'نتیجهٔ همسان با برند و کد مدل پیدا نشد'), error, tried, rejected, nearMiss: nearMiss.slice(0, 3) };
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
      return Net.json('https://emalls.ir/swservice/site_search', { method: 'POST', body: body.toString(), referer: EMALLS_REF, timeout: 18000, anonymous: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } });
    },
    async fetch(prod, { query, freeSearch = false } = {}) {
      const tried = [], offers = [], nearMiss = [], failures = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        let result;
        try { result = await emalls.search(q); }
        catch (e) {
          failures.push(e.message);
          Log.warn('emalls', `عبارت «${q}» ناموفق بود: ${e.message}`);
          continue;
        }
        const rows = Array.isArray(result?.lstsearchresualt) ? result.lstsearchresualt : [];
        for (const row of rows) {
          const name = row?.title || '', link = reverseEmallsLink(row?.buyLink);
          const seller = String(row?.buyTitle || '').replace(/^خرید[\u200c\u200e\s]*از[\u200c\u200e\s]*/u, '').trim();
          const offer = mapMarketOffer(prod, row, { sourceId: 'emalls', title: name, price: row?.price, seller, sellerUrl: link, allowedHosts: ['click.emalls.ir'], dataSource: 'emalls:site_search/listitemv2', exclude: item => item?.agahi || item?.used === true, freeSearch, query });
          if (offer) offers.push(offer); else { rejected++; if (!freeSearch && name && nearMiss.length < 3) nearMiss.push({ title: name, reason: marketMatchReason(prod, name) }); }
        }
      }
      const error = tried.length && failures.length === tried.length ? failures.join('؛ ') : '';
      const note = failures.length
        ? (error ? `تمام جست‌وجوهای ایمالز ناموفق بود: ${error}` : `یک یا چند عبارت ایمالز پاسخ نداد؛ ${offers.length ? `${offers.length} نتیجه از پاسخ‌های موفق` : 'در پاسخ‌های موفق نتیجهٔ همسانی پیدا نشد'}`)
        : '';
      return marketResult(offers, tried, rejected, freeSearch ? [] : nearMiss, note, error);
    }
  };
  const basalam = {
    id: 'basalam', label: 'باسلام', icon: 'basalam', kind: 'offers', implemented: true, hosts: ['services.basalam.com'],
    note: 'جست‌وجوی زندهٔ باسلام؛ مبلغ ریالی به تومان تبدیل می‌شود',
    async search(q) {
      const url = new URL(BASALAM_API); url.search = new URLSearchParams({ q, sort: 'rank', from: '0', size: '30' }).toString();
      return Net.json(url.href, { referer: 'https://basalam.com/', timeout: 18000, anonymous: true });
    },
    async fetch(prod, { query, freeSearch = false } = {}) {
      const tried = [], offers = [], nearMiss = []; let rejected = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await basalam.search(q), rows = Array.isArray(result?.products) ? result.products : [];
        for (const row of rows) {
          const slug = String(row?.vendor?.identifier || '').trim(), id = String(row?.id || '').trim();
          const url = slug && id ? `https://basalam.com/${encodeURIComponent(slug)}/product/${encodeURIComponent(id)}` : '';
          const offer = mapMarketOffer(prod, row, { sourceId: 'basalam', title: row?.name, price: row?.price, priceFactor: 0.1,
            seller: row?.vendor?.name, sellerUrl: url, allowedHosts: ['basalam.com'], dataSource: 'basalam:guest-product-search', exclude: excludedBasalamProduct, freeSearch, query });
          if (offer && row?.IsSaleable !== false && row?.status?.title !== 'ناموجود') offers.push(offer);
          else { rejected++; if (!freeSearch && row?.name && nearMiss.length < 3) nearMiss.push({ title: row.name, reason: marketMatchReason(prod, row.name) }); }
        }
      }
      return marketResult(offers, tried, rejected, freeSearch ? [] : nearMiss, freeSearch && !offers.length ? `در باسلام نتیجه‌ای برای «${query}» پیدا نشد` : '');
    }
  };
  const snappshop = {
    id: 'snappshop', label: 'اسنپ‌شاپ', icon: 'snappshop', kind: 'offers', implemented: true, hosts: ['apix.snappshop.ir'], cities: SNAPP_CITIES,
    note: 'جست‌وجوی زندهٔ قیمت در اسنپ‌شاپ',
    async fetch(prod, { query, cityId, freeSearch = false } = {}) {
      const savedCity = typeof Store !== 'undefined' ? Store.get()?.settings?.snappCity : '';
      const city = SNAPP_CITIES[cityId || savedCity] || SNAPP_CITIES.tehran;
      const coordinates = `lat=${encodeURIComponent(city.lat)}&lng=${encodeURIComponent(city.lng)}`;
      const tokenData = await Net.json(`${SNAPP_API}guest/v2/token?${coordinates}`, { timeout: 15000, anonymous: true });
      const token = tokenData?.data?.token || tokenData?.token;
      if (!token) throw new Error('توکن مهمان اسنپ‌شاپ در پاسخ پیدا نشد');
      const tried = [], offers = [], nearMiss = []; let rejected = 0, loggedOffers = 0;
      for (const q of searchTerms(prod, query)) {
        tried.push(q);
        const result = await Net.json(`${SNAPP_API}search/v1?${coordinates}`, { method: 'POST', timeout: 18000, anonymous: true,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ render: 4, query: q }) });
        const rows = (result?.data?.structure || []).flatMap(section => Array.isArray(section?.items) ? section.items : []);
        for (const row of rows) {
          const url = row?.href ? new URL(row.href, 'https://snappshop.ir/').href : '';
          const rawPrice = row?.price?.discounted_price || row?.price?.price;
          const offer = mapMarketOffer(prod, row, { sourceId: 'snappshop', title: row?.title, price: rawPrice,
            seller: 'اسنپ‌شاپ', sellerUrl: url, allowedHosts: ['snappshop.ir'], dataSource: 'snappshop:search/v1',
            exclude: item => item?.is_ads || item?.is_fake, freeSearch, query });
          if (offer) {
            offers.push(offer);
            if (loggedOffers < 5) {
              loggedOffers++;
              const score = offer.matchConfidence == null ? '' : ' · تطبیق ' + U.toFa(Math.round(offer.matchConfidence * 100)) + '٪';
              Log.info('snappshop', 'پیشنهاد پذیرفته شد: «' + offer.matchTitle + '»' + score);
            }
          }
          else { rejected++; if (!freeSearch && row?.title && nearMiss.length < 3) nearMiss.push({ title: row.title, reason: marketMatchReason(prod, row.title) }); }
        }
      }
      if (rejected && nearMiss.length) Log.info('snappshop', U.toFa(rejected) + ' نتیجه رد شد؛ نمونه: «' + nearMiss[0].title + '» · ' + nearMiss[0].reason);
      return marketResult(offers, tried, rejected, freeSearch ? [] : nearMiss,
        freeSearch ? `قیمت‌های اسنپ‌شاپ · ${city.label}` : offers.length ? `قیمت اسنپ‌شاپ · ${city.label}` : `برای این شهر (${city.label}) نتیجهٔ همسان با برند و کد مدل پیدا نشد`);
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
