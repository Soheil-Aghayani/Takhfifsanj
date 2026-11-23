/* ===== Match: product matching with confidence. `baseline` is the exact 8.7 rule; `evaluate` adds model/spec checks. ===== */
const Match = (() => {
  // 8.7 rule (kept byte-for-byte in behaviour, verified by differential test).
  function baseline(src, cand) {
    const st = U.tokens(src); if (!st.length) return false;
    const cn = U.normalize(cand), set = new Set(cn.split(' ')), cc = cn.replace(/\s+/g, '');
    const hit = st.filter(t => set.has(t) || (t.length >= 4 && cc.includes(t))).length;
    if (hit / st.length < 0.5) return false;
    return st.filter(t => /\d/.test(t) && /[a-z]/.test(t)).every(t => cc.includes(t));
  }
  // Model codes: Latin letters + digits ("YRB/22" -> yrb22, "A07" -> a07, "64GB" -> 64gb).
  function modelCodes(raw) {
    const t = U.digits(raw).replace(/[ـ]/g, '');
    const out = new Set();
    const re = /[A-Za-z]+[A-Za-z0-9]*?[\s\/\-_.]?\d+[A-Za-z0-9]*|\d+[\s]?[A-Za-z]+[A-Za-z0-9]*/g; let m;
    while ((m = re.exec(t))) { const c = m[0].toLowerCase().replace(/[^a-z0-9]/g, ''); if (c.length >= 3 && /[a-z]/.test(c) && /\d/.test(c)) out.add(c); }
    return [...out];
  }
  function modelCodeMatch(src, cand) {
    const codes = modelCodes(src), candidateCodes = new Set(modelCodes(cand));
    const found = codes.filter(code => candidateCodes.has(code));
    return { codes, found, missing: codes.filter(code => !candidateCodes.has(code)) };
  }
  const UNITS = [['gb', /گیگابایت|گیگ|gb/], ['tb', /ترابایت|tb/], ['ml', /میلی ?لیتر|ml/], ['l', /لیتر/], ['kg', /کیلوگرم|کیلو|kg/], ['g', /گرم|gr|(?<![a-z])g(?![a-z])/], ['mah', /mah|میلی ?آمپر/], ['w', /وات|(?<![a-z])w(?![a-z])/], ['inch', /اینچ|inch/], ['cm', /سانتی ?متر|cm/], ['mm', /میلی ?متر|mm/]];
  function specs(raw) {
    const t = U.normalize(raw).replace(/(\d)\s+(?=[a-zآ-ی])/g, '$1'), out = {};
    for (const [u, re] of UNITS) {
      const rx = new RegExp('(\\d+)(?:' + re.source + ')', 'g'); let m;
      while ((m = rx.exec(t))) (out[u] ||= new Set()).add(Number(m[1]));
    }
    return out;
  }
  function evaluate(src, cand, { strict = false } = {}) {
    const reasons = [], flags = [];
    const base = baseline(src, cand);
    const st = U.tokens(src), cn = U.normalize(cand), set = new Set(cn.split(' ')), cc = cn.replace(/\s+/g, '');
    const cov = st.length ? st.filter(t => set.has(t) || (t.length >= 4 && cc.includes(t))).length / st.length : 0;
    const { codes, found, missing } = modelCodeMatch(src, cand);
    const a = specs(src), b = specs(cand);
    const mismatch = () => {
      if (codes.length && (strict ? missing.length > 0 : found.length === 0))
        return { ok: false, score: 0, level: 'low', reasons: ['کد مدل مبدا (' + (strict ? missing : codes).join('، ') + ') در نتیجه نیست'], flags: ['model-mismatch'] };
      for (const u of Object.keys(a)) if (b[u] && ![...a[u]].some(v => b[u].has(v)))
        return { ok: false, score: 0, level: 'low', reasons: ['مشخصه ' + u + ' متفاوت است'], flags: ['spec-mismatch'] };
      return null;
    };
    const conflict = mismatch();
    if (strict && conflict) return conflict;
    if (!base) return { ok: false, score: cov * 0.4, level: 'low', reasons: ['عدم تطبیق پایه (نام/توکن‌ها)'], flags: ['base-mismatch'] };
    if (conflict) return conflict;
    let model = codes.length ? found.length / codes.length : null;
    if (codes.length && found.length < codes.length) { flags.push('partial-model'); reasons.push('بخشی از کد مدل/ظرفیت تأیید نشد'); }
    // Without a model/capacity code (common for groceries, clothing, cosmetics), word-overlap alone is a weak
    // signal — "same category, different brand" can still clear the 50% baseline. Real data (different brands of
    // sunflower seeds scoring 0.56) showed this matters, so no-code matches need a much higher bar to be accepted.
    if (!codes.length) {
      flags.push('no-model-code');
      if (cov < 0.75) return { ok: false, score: cov * 0.4, level: 'low', reasons: ['بدون کد مدل/ظرفیت، پوشش کلمات نام کافی نیست (' + Math.round(cov * 100) + '٪ < ۷۵٪) — احتمال برند یا محصول متفاوت'], flags: ['no-model-code', 'low-coverage'] };
      reasons.push('کد مدل لاتین برای تأیید وجود ندارد؛ فقط بر اساس پوشش کلمات نام (' + Math.round(cov * 100) + '٪) پذیرفته شد');
    }
    let score = codes.length ? 0.35 * cov + 0.65 * model : Math.min(0.85, cov);
    if (codes.length && cov < 0.75) { flags.push('low-coverage'); reasons.push('پوشش کلمات نام ' + Math.round(cov * 100) + '٪'); }
    const level = score >= 0.85 ? 'high' : score >= 0.65 ? 'medium' : 'low';
    if (level === 'low') flags.push('suspicious');
    return { ok: true, score: +score.toFixed(2), level, reasons, flags };
  }
  return { baseline, modelCodes, modelCodeMatch, specs, evaluate };
})();
