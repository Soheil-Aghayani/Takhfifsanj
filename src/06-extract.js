/* ===== Extract: product name + current price. Faithful port of the verified 8.7 engine (deobfuscated). ===== */
const Extract = (() => {
  const KNOWN = {
    'digikala.com': ['دیجی‌کالا', 'دیجیکالا', 'دیجی کالا'], 'torob.com': ['ترب'], 'emalls.ir': ['ای‌مالز', 'ایمالز', 'امالز'],
    'technolife.com': ['تکنولایف', 'تکنو لایف'], 'basalam.com': ['باسلام'], 'banimode.com': ['بانی‌مد', 'بانی مد'],
    'okala.com': ['اکالا'], 'mobile140.com': ['موبایل ۱۴۰', 'موبایل140'], 'digistyle.com': ['دیجی‌استایل', 'دیجی استایل']
  };
  const BRAND_KEYS = Object.keys(KNOWN).flatMap(k => [U.compact(k.split('.')[0]), ...KNOWN[k].map(U.compact)]).filter(k => k.length >= 4);
  const isStoreName = s => { const c = U.compact(s); return !!c && BRAND_KEYS.some(b => c === b || c.includes(b)); };
  const matchKnownSite = d => {
    const c = U.compact(d); if (!c) return null;
    for (const k of Object.keys(KNOWN)) {
      for (const a of [U.compact(k.split('.')[0]), ...KNOWN[k].map(U.compact)]) {
        if (!a) continue; if (c === a) return k; if (a.length >= 5 && c.includes(a)) return k;
      }
    }
    return null;
  };
  const hasUnit = s => { const t = U.digits(s); return /\d/.test(t) && /گرم|کیلو|میلی|لیتر|عدد|بسته|سانتی|متر|سی.?سی|\b(ml|kg|g|l|gr|cm|mm)\b/i.test(t); };
  const NAME_JUNK = [/^\s*قیمت\s*و\s*خرید\s+/, /^\s*خرید\s+/, /\s*(با|در)\s*قیمت\s*(روز|مناسب|ارزان|عمده)?.*$/, /\s*خرید\s*(آنلاین|اینترنتی|قسطی|اقساطی).*$/, /\s*(ارسال\s*رایگان|تخفیف|گارانتی|اصل|اورجینال).*$/];
  function cleanTitle(raw) {
    const parts = String(raw || '').split(/\s*[|—–]\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean);
    let t = parts.filter((p, i) => i === 0 || (!isStoreName(p) && hasUnit(p))).join(' - ').replace(/\d[\d٬,،\s]*\s*(تومان|تومن|ت)\b.*$/u, '').replace(/\s+/g, ' ').trim();
    for (const r of NAME_JUNK) t = t.replace(r, '').trim();
    return t.slice(0, 120);
  }
  // Product headings often append dimensions, weight, package contents and marketing copy.
  // Keep the first descriptive clause for search/display, but preserve model codes even if
  // the seller placed them after a comma.
  function coreTitle(raw) {
    const full = cleanTitle(raw);
    if (!full) return '';
    const first = full.split(/[,،؛;|—–]/)[0].trim();
    let core = first.length >= 3 ? first : full;
    try {
      for (const code of Match.modelCodes(full)) {
        if (!U.compact(core).includes(U.compact(code))) core += ' ' + code;
      }
    } catch {}
    return core.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function titleFromUrl() {
    try {
      const last = decodeURIComponent(location.pathname).split('/').filter(Boolean).pop() || '';
      const t = last.replace(/^\d+[-_]?/, '').replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
      return /[آ-ی]/.test(t) && t.split(' ').length >= 3 ? t : '';
    } catch { return ''; }
  }

  // ---- strike-through detection ----
  const STRIKE_CLASS = /line-through|strikethrough|(^|[\s_:-])(old|del|strike|discount)(?=$|[\s_:-])/i;
  const isStruck = el => {
    if (STRIKE_CLASS.test(el.className && el.className.toString ? el.className.toString() : '')) return true;
    try { if ((getComputedStyle(el).textDecorationLine || '').includes('line-through')) return true; } catch {}
    return !!el.closest('del, s, strike');
  };
  const struckNumbers = root => { const s = new Set(); root.querySelectorAll('*').forEach(e => { if (isStruck(e)) U.numbersIn(e.textContent).forEach(v => s.add(v)); }); return s; };
  const visibleOnPage = n => { const t = U.digits(document.body.innerText || '').replace(/(\d)[,٬،](?=\d)/g, '$1'); return new RegExp('(?<!\\d)' + n + '(?!\\d)').test(t); };

  // ---- JSON-LD ----
  function jsonLd(root) {
    let found = null;
    root.querySelectorAll('script[type="application/ld+json"]').forEach(sc => {
      if (found) return; let data; try { data = JSON.parse(sc.textContent); } catch { return; }
      (function walk(o) {
        if (!o || typeof o !== 'object' || found) return;
        if (Array.isArray(o)) { o.forEach(walk); return; }
        const ty = o['@type'];
        if (ty === 'Product' || (Array.isArray(ty) && ty.includes('Product'))) {
          let raw = 0, cur = '';
          for (const of of [].concat(o.offers || [])) {
            const x = of && of.offers ? [].concat(of.offers)[0] : of;
            const v = Number(String(x?.price ?? x?.lowPrice ?? '').replace(/[^\d.]/g, ''));
            if (v > 0) { raw = v; cur = String(x.priceCurrency || '').toUpperCase(); break; }
          }
          found = { name: o.name || '', raw: raw || null, cur }; return;
        }
        Object.values(o).forEach(walk);
      })(data);
    });
    return found;
  }
  function reconcileJsonLd(ld, visible) {
    if (!ld || !ld.raw) return null;
    const asToman = ld.cur === 'IRR' ? Math.round(ld.raw / 10) : Math.round(ld.raw), asRaw = Math.round(ld.raw), asDiv = Math.round(ld.raw / 10);
    if (!visible) {
      if (!visibleOnPage(asToman)) {
        if (visibleOnPage(asRaw)) return { price: asRaw, note: ' (واحد JSON-LD اصلاح شد)' };
        if (visibleOnPage(asDiv)) return { price: asDiv, note: ' (واحد JSON-LD اصلاح شد)' };
      }
      return { price: asToman, note: '' };
    }
    const near = v => Math.abs(v - visible) / visible < 0.02;
    if (near(asToman)) return { price: asToman, note: '' };
    if (near(asRaw)) return { price: asRaw, note: ' (واحد JSON-LD اصلاح شد)' };
    if (near(asDiv)) return { price: asDiv, note: ' (واحد JSON-LD اصلاح شد)' };
    return null;
  }

  // ---- DOM price heuristics (same order & thresholds as 8.7) ----
  const SELLER_BLOCK = "[data-testid*='seller'], [class*='seller'], [class*='related'], [class*='similar']";
  const NON_PRICE_CONTEXT = /ارزان|گران|صرفه.?جویی|تخفیف|پیشنهاد|قسط|اقساط|ماه|سود|بخرید|اعتبار|ارسال|تحویل|روز کاری/i;
  const priceRelevantLines = text => String(text || '').split(/\r?\n/).filter(line => !NON_PRICE_CONTEXT.test(line)).join('\n');
  const cartButtons = () => [...document.querySelectorAll('button, a, div, span')].filter(e => {
    if (e.children.length > 4) return false;
    const text = (e.innerText || '').trim();
    return text.length > 0 && text.length < 30 && /افزودن به سبد/.test(text);
  });
  function digikalaBuyBoxPrice() {
    if (location.hostname.toLowerCase().replace(/^www\./, '') !== 'digikala.com') return null;
    for (const button of cartButtons()) {
      let parent = button;
      for (let i = 0; i < 6 && parent; i++, parent = parent.parentElement) {
        if ((parent.innerText || '').length > 500) break;
        const marker = parent.querySelector('[data-testid="price-final"], [data-testid="price-current"]');
        if (!marker) continue;
        const text = marker.innerText || marker.textContent || '';
        const candidates = U.pricesWithCurrency(text + ' تومان');
        const price = candidates[0] || Number(U.digits(text).replace(/\D/g, ''));
        if (price >= 10000) return price;
      }
    }
    return null;
  }
  function buyBarPrice() {
    for (const b of cartButtons()) {
      let p = b.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        const txt = p.innerText || ''; if (txt.length > 500) break;
        // The buy box can include non-price notices (for example, "buy this
        // product 237,000 toman cheaper"). Never let those smaller amounts
        // win merely because this heuristic takes the minimum candidate.
        const relevant = priceRelevantLines(txt), struck = struckNumbers(p);
        const cand = U.numbersIn(relevant).filter(v => v >= 10000 && !struck.has(v));
        if (cand.length) return Math.min(...cand);
      }
    }
    return null;
  }
  // The struck-through "old price" inside the buy box (claimed pre-discount price)
  function claimedOldPrice(current) {
    for (const b of cartButtons()) {
      let p = b.parentElement;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        const txt = p.innerText || ''; if (txt.length > 500) break;
        const s = [...struckNumbers(p)].filter(v => v >= 10000 && (!current || v > current));
        if (s.length) return Math.max(...s);
      }
    }
    return null;
  }
  function testIdPrice() {
    for (const el of document.querySelectorAll('[data-testid="price-final"], [data-testid="price-current"], [data-testid="price"]')) {
      if (el.closest("[data-testid*='seller'], [class*='seller']")) continue;
      const a = U.pricesWithCurrency((el.innerText || el.textContent || '') + ' تومان'); if (a.length) return Math.min(...a);
      const n = Number(U.digits(el.textContent).replace(/\D/g, '')); if (n >= 10000) return n;
    }
    return null;
  }
  function classPrice() {
    const els = [...document.querySelectorAll("[class*='price'], [data-testid*='price'], [id*='price']")].filter(e => {
      if (e.closest(SELLER_BLOCK) || isStruck(e)) return false;
      return /^\d{1,3}(?:[,٬،]\d{3})+$|^\d{5,}$/.test(U.digits(e.textContent).replace(/\s|تومان|ت$/g, '').trim());
    });
    const arr = els.map(e => ({ top: e.getBoundingClientRect().top + window.scrollY, value: Number(U.digits(e.textContent).replace(/\D/g, '')) })).filter(x => x.value >= 10000);
    arr.sort((a, b) => a.top - b.top); return arr.length ? arr[0].value : null;
  }
  function unstruckPrice() {
    const els = [...document.querySelectorAll('p, span, div, strong, b')].filter(e => {
      if (e.children.length !== 0) return false; const t = U.digits(e.textContent).trim();
      if (!/^\d{1,3}(?:[,٬]\d{3})+$/.test(t) || isStruck(e) || e.closest(SELLER_BLOCK)) return false;
      const n = Number(t.replace(/\D/g, '')); return n >= 100000 && n <= 100000000;
    });
    const arr = els.map(e => ({ value: Number(U.digits(e.textContent).replace(/\D/g, '')), score: /font-semibold|font-bold|text-h4|text-xl|text-primary/.test(e.className.toString()) ? 2 : 0 }));
    arr.sort((a, b) => b.score - a.score); return arr.length ? arr[0].value : null;
  }
  function nearBuyButton() {
    const els = [...document.querySelectorAll('button, a, div')].filter(e => { const t = (e.innerText || '').trim(); return t.length > 0 && t.length < 40 && /افزودن به سبد|خرید/.test(t); });
    for (const b of els) {
      let p = b;
      for (let i = 0; i < 8 && p; i++) {
        const t = p.innerText || '';
        if (t.length < 400) { const a = U.pricesWithCurrency(priceRelevantLines(t)); if (a.length) return Math.min(...a); }
        p = p.parentElement;
      }
    }
    return null;
  }

  function selectedColor() {
    const m = U.digits(document.body.innerText || '').match(/رنگ\s*[:：]\s*([^\n\r]{1,30})/); return m ? m[1].trim() : '';
  }
  function digikalaIds() {
    const m = location.pathname.match(/dkp-(\d+)/i); const v = new URLSearchParams(location.search).get('variant_id');
    return m ? { pid: m[1], variantId: v || '' } : null;
  }

  // Main entry: returns Model.product-compatible plain data.
  function product(root = document) {
    const ld = jsonLd(root) || {};
    const meta = sel => root.querySelector(sel)?.getAttribute('content') || '';
    const h1 = root.querySelector('h1')?.textContent?.trim() || '';
    const cands = [h1, ld.name, meta('meta[property="og:title"]'), root.title, titleFromUrl()].map(cleanTitle).filter(c => c && !isStoreName(c) && !/^فروشگاه\s*اینترنتی/.test(c));
    let name = cands[0] || '';
    if (U.tokens(name).length < 3) { const alt = cands.find(c => U.tokens(c).length >= 3); if (alt) name = alt; }
    const nn = U.normalize(name);
    for (const c of cands) { const cn = U.normalize(c); if (nn && cn.length > nn.length && cn.includes(nn) && c.length <= 120) { name = c; break; } }

    let price = null, src = '';
    const buyBoxPrice = digikalaBuyBoxPrice();
    const visible = buyBoxPrice || buyBarPrice(), rec = reconcileJsonLd(ld, visible);
    if (buyBoxPrice) { price = buyBoxPrice; src = 'data-testid'; }
    else if (rec) { price = rec.price; src = 'JSON-LD' + rec.note; }
    if (!price && visible) { price = visible; src = 'نوار خرید'; }
    if (!price) { const v = Number(meta('meta[property="product:price:amount"]').replace(/[^\d]/g, '')); if (v > 0) { price = v; src = 'متای صفحه'; } }
    if (!price) { const v = testIdPrice(); if (v) { price = v; src = 'data-testid'; } }
    if (!price) { const v = classPrice(); if (v) { price = v; src = 'کلاس قیمت'; } }
    if (!price) { const v = unstruckPrice(); if (v) { price = v; src = 'قیمت بدون خط‌خوردگی'; } }
    if (!price) { const v = nearBuyButton(); if (v) { price = v; src = 'نزدیک دکمهٔ خرید'; } }
    const dk = digikalaIds();
    const out = { title: name, price, priceSource: src, oldPrice: price ? claimedOldPrice(price) : null, nameCandidates: cands, color: selectedColor(),
      host: location.hostname.replace(/^www\./, ''), url: location.href, id: dk ? dk.pid : '', variantId: dk ? dk.variantId : '' };
    Log.info('extract', `name="${name}" price=${price || '—'} src=${src || '—'} old=${out.oldPrice || '—'}`);
    return out;
  }
  function looksLikeProductPage() {
    if (/dkp-\d+/i.test(location.pathname)) return true;
    if (document.querySelector('meta[property="og:type"][content*="product"]')) return true;
    if (jsonLd(document)) return true;
    return !!([...document.querySelectorAll('button')].some(b => /افزودن به سبد/.test(b.textContent || '')) && document.querySelector('h1'));
  }
  return { KNOWN, isStoreName, matchKnownSite, cleanTitle, coreTitle, jsonLd, reconcileJsonLd, product, looksLikeProductPage, digikalaIds, selectedColor, buyBarPrice, claimedOldPrice };
})();
