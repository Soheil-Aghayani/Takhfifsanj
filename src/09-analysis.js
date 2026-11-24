/* ===== Analysis: discount inspector and buying advisor based on real price history. ===== */
const Analysis = (() => {
  const valid = pts => (Array.isArray(pts) ? pts : [])
    .filter(p => p && p.marketable && Number.isFinite(p.t) && Number.isFinite(p.price) && p.price > 0)
    .sort((a, b) => a.t - b.t);
  const lastN = (pts, days, end) => pts.filter(p => p.t > end - days * U.DAY);
  function stats(pts) {
    const s = valid(pts); if (!s.length) return null;
    const prices = s.map(p => p.price), first = s[0], last = s[s.length - 1];
    const span = Math.round((last.t - first.t) / U.DAY) + 1;
    const minP = s.reduce((a, b) => (b.price < a.price ? b : a)), maxP = s.reduce((a, b) => (b.price > a.price ? b : a));
    // Lowest price that held on two consecutive recorded days (ignores 1-day dips).
    let held = null; for (let i = 1; i < s.length; i++) { const m = Math.max(s[i - 1].price, s[i].price); if (held == null || m < held) held = m; }
    const sellers = new Set(s.map(p => p.seller).filter(Boolean));
    return { count: s.length, span, from: first.t, to: last.t, min: minP.price, minT: minP.t, max: maxP.price, maxT: maxP.t, median: U.median(prices), first: first.price, last: last.price, heldLow: held, sellers: sellers.size, missingDays: Math.max(0, span - s.length) };
  }
  const confidenceOf = st => !st ? 'none' : (st.span >= 60 && st.count >= 45) ? 'high' : (st.span >= 21 && st.count >= 15) ? 'medium' : 'low';

  // Campaign price inspector. It reports changes in recorded prices, not proof of a seller's intent.
  // Verdicts: 'confirmed' | 'rise-signal' | 'insufficient'.
  function inspect(pts, ctx = {}) {
    const s = valid(pts), st = stats(s), res = { verdict: 'insufficient', confidence: confidenceOf(st), reasons: [], signals: [], numbers: {}, stats: st };
    if (!st) { res.reasons.push('هیچ نقطهٔ تاریخی معتبر (قابل‌فروش) وجود ندارد.'); return res; }
    const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
    const ageMs = Math.max(0, now - st.to);
    const ageDays = Math.floor(ageMs / U.DAY);
    res.numbers = { latest: st.to, ageDays, current: Number.isFinite(ctx.currentPrice) && ctx.currentPrice > 0 ? ctx.currentPrice : st.last };

    // Do not compare today's page price with an old chart: that can make a routine
    // price change look like a current campaign discount.
    const variantCount = Number(ctx.variantCount) || 0;
    if (variantCount > 1 && !ctx.variantVerified) {
      res.detail = 'variant-ambiguous'; res.confidence = 'low';
      res.reasons.push('رنگ/واریانت تاریخچه با اطمینان به محصول صفحه وصل نشده است. در تب تاریخچه واریانت درست را انتخاب و دوباره بررسی کنید.');
      return res;
    }
    const maxAgeDays = Number.isFinite(ctx.maxAgeDays) ? ctx.maxAgeDays : 7;
    if (ageMs > maxAgeDays * U.DAY) {
      res.detail = 'stale'; res.confidence = 'low';
      res.reasons.push(`آخرین قیمت قابل‌فروش حدود ${U.toFa(Math.ceil(ageMs / U.DAY))} روز پیش ثبت شده؛ برای مقایسه با قیمت فعلی، تاریخچهٔ تازه‌تری لازم است.`);
      return res;
    }
    if (st.count < 10 || st.span < 21) { res.reasons.push(`داده برای نتیجه‌گیری کافی نیست: ${U.toFa(st.count)} نقطه در بازهٔ ${U.toFa(st.span)} روز (حداقل ۱۰ نقطه و ۲۱ روز لازم است).`); return res; }
    const end = st.to, cut = end - 14 * U.DAY;
    const prior = s.filter(p => p.t <= cut), recent = s.filter(p => p.t > cut);
    if (prior.length < 5) { res.reasons.push('برای ساخت «قیمت پایه»، دادهٔ کافی قبل از ۱۴ روز اخیر وجود ندارد.'); return res; }
    const baseline = U.median(prior.map(p => p.price));
    const current = Number.isFinite(ctx.currentPrice) && ctx.currentPrice > 0 ? ctx.currentPrice : st.last;
    const lastPt = s[s.length - 1];
    const oldCandidate = Number.isFinite(ctx.claimedOld) && ctx.claimedOld > 0
      ? ctx.claimedOld
      : (lastPt.rrp && lastPt.rrp > lastPt.price ? lastPt.rrp : null);
    const claimedOld = oldCandidate > current ? oldCandidate : null;
    const realDrop = (baseline - current) / baseline;
    const claimedPct = claimedOld ? (claimedOld - current) / claimedOld : null;
    res.numbers = {
      baseline, current, claimedOld,
      realDropPct: realDrop * 100,
      claimedPct: claimedPct == null ? null : claimedPct * 100,
      min: st.min, max: st.max, latest: st.to, ageDays, baselinePoints: prior.length
    };

    const peak = recent.filter(p => p.t < end - 2 * U.DAY).reduce((a, b) => (!a || b.price > a.price ? b : a), null);
    if (peak && peak.price >= baseline * 1.08 && current <= peak.price * 0.95)
      res.signals.push({ code: 'pre-rise', text: `قیمت در ${U.faDate(peak.t)} به ${U.fmt(peak.price)} تومان رسیده (${U.fmtPct((peak.price / baseline - 1) * 100)} بالاتر از قیمت پایه) و سپس پایین آمده.` });
    if (claimedOld && claimedOld >= baseline * 1.08)
      res.signals.push({ code: 'inflated-reference', text: `«قیمت قبل از تخفیف» (${U.fmt(claimedOld)}) از قیمت پایهٔ واقعی (${U.fmt(baseline)}) ${U.fmtPct((claimedOld / baseline - 1) * 100)} بالاتر است.` });
    if (claimedPct != null && claimedPct - realDrop > 0.10)
      res.signals.push({ code: 'claim-gap', text: `تخفیف ادعایی ${U.fmtPct(claimedPct * 100)} است اما نسبت به قیمت پایه فقط ${U.fmtPct(Math.max(0, realDrop) * 100)} کاهش دیده می‌شود.` });

    if (res.signals.length) { res.verdict = 'rise-signal'; res.reasons.push('نشانه‌هایی از افزایش قیمت یا مرجع قیمتی بالاتر پیش از تخفیف دیده می‌شود؛ این به‌تنهایی اثبات تخلف نیست (ممکن است تغییر فروشنده، موجودی یا گارانتی باشد).'); }
    else if (realDrop >= 0.05) { res.verdict = 'confirmed'; res.reasons.push(`قیمت فعلی ${U.fmtPct(realDrop * 100)} پایین‌تر از میانهٔ ${U.toFa(prior.length)} نقطهٔ تاریخیِ پیش از ۱۴ روز اخیر است؛ این فقط کاهش ثبت‌شده را نشان می‌دهد و به‌تنهایی اثبات تخلف یا اعتبار یک کمپین نیست.`); }
    else { res.verdict = 'insufficient'; res.detail = 'no-drop'; res.reasons.push('داده کافی است اما کاهش معناداری (≥۵٪) نسبت به قیمت پایه دیده نمی‌شود؛ تخفیف تأییدشده‌ای وجود ندارد.'); }
    if (st.sellers > 1) res.reasons.push(`برندهٔ «خرید» در این بازه ${U.toFa(st.sellers)} فروشندهٔ مختلف بوده؛ قیمت روزانه ممکن است بین فروشنده‌ها جابه‌جا شده باشد.`);
    if (st.span < 90) res.reasons.push(`بازهٔ واقعی داده ${U.toFa(st.span)} روز است (کمتر از ۹۰ روز).`);
    if (st.missingDays > 0) res.reasons.push(`${U.toFa(st.missingDays)} روز در بازه داده‌ای ثبت نشده است (درون‌یابی نشده).`);
    return res;
  }

  // Buying advisor. Only data that exists; unknown stays unknown.
  function advise({ current, offers = [], hostKey = '', st = null, insp = null }) {
    const points = [], caveats = []; let tone = 'neutral', headline = 'اطلاعات کافی برای توصیهٔ قطعی نیست';
    if (!(current > 0)) return { tone, headline: 'قیمت فعلی پیدا نشد', points, caveats: ['ابتدا قیمت را دستی ثبت کنید.'] };
    const trusted = offers.filter(o => o.matchLevel !== 'low' && o.sellerKey !== hostKey);
    const best = trusted.slice().sort((a, b) => a.price - b.price)[0];
    let cheaper = false;
    if (best) {
      const diff = (current - best.price) / current;
      if (diff >= 0.02) { cheaper = true; points.push({ k: 'good', text: `${best.seller} حدود ${U.fmtPct(diff * 100)} (${U.fmt(current - best.price)} تومان) ارزان‌تر است.` }); }
      else points.push({ k: 'ok', text: 'قیمت این صفحه با ارزان‌ترین فروشندهٔ تطبیق‌یافته برابر یا کمتر است.' });
    }
    let histGood = null;
    if (st && st.count >= 10) {
      if (current <= st.min * 1.03) { histGood = true; points.push({ k: 'good', text: `قیمت نزدیک کمترین قیمت ثبت‌شده (${U.fmt(st.min)}) در ${U.toFa(st.span)} روز اخیر است.` }); }
      else if (current >= st.median * 1.1) { histGood = false; points.push({ k: 'warn', text: `قیمت ${U.fmtPct((current / st.median - 1) * 100)} بالاتر از میانهٔ ${U.toFa(st.span)} روز اخیر (${U.fmt(st.median)}) است.` }); }
      else points.push({ k: 'ok', text: `قیمت در محدودهٔ معمول ${U.toFa(st.span)} روز اخیر است (کمینه ${U.fmt(st.min)}، میانه ${U.fmt(st.median)}).` });
    }
    if (insp && insp.verdict === 'rise-signal') { points.push({ k: 'warn', text: 'نشانهٔ افزایش قیمت پیش از تخفیف دیده می‌شود؛ تخفیف ادعایی را با احتیاط ببینید.' }); }
    if (cheaper) { tone = 'warn'; headline = 'فروشندهٔ ارزان‌تری وجود دارد'; }
    else if (histGood === true) { tone = 'good'; headline = 'از نظر قیمت، زمان نسبتاً مناسبی است'; }
    else if (histGood === false) { tone = 'warn'; headline = 'قیمت فعلی از حد معمول بالاتر است'; }
    else if (best) { tone = 'good'; headline = 'قیمت این صفحه رقابتی است'; }
    return { tone, headline, points, caveats };
  }
  return { valid, stats, inspect, advise, confidenceOf };
})();
