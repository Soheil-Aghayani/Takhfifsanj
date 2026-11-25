/* ===== Match: product matching with confidence. `baseline` is the exact 8.7 rule; `evaluate` adds model/spec/brand/category checks. ===== */
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
    const numericModel = /(?:مدل|model)\s*[:#-]?\s*(\d{3,6})(?![A-Za-z0-9])/gi;
    while ((m = numericModel.exec(t))) out.add(m[1]);
    return [...out];
  }
  function modelCodeMatch(src, cand) {
    const codes = modelCodes(src), candidateCodes = new Set(modelCodes(cand));
    const compatible = (source, candidate) => source === candidate
      || (/^\d{3,6}$/.test(source) && candidate.endsWith(source))
      || (/^\d{3,6}$/.test(candidate) && source.endsWith(candidate));
    const found = codes.filter(code => [...candidateCodes].some(candidate => compatible(code, candidate)));
    return { codes, found, missing: codes.filter(code => !found.includes(code)) };
  }
  const UNITS = [['gb', /گیگابایت|گیگ|gb/], ['tb', /ترابایت|tb/], ['ml', /میلی ?لیتر|ml/], ['l', /لیتر/], ['kg', /کیلوگرم|کیلو|kg/], ['g', /گرم|gr|(?<![a-z])g(?![a-z])/], ['mah', /mah|میلی ?آمپر/], ['w', /وات|(?<![a-z])w(?![a-z])/], ['inch', /اینچ|inch/], ['cm', /سانتی ?متر|cm/], ['mm', /میلی ?متر|mm/]];
  const BRAND_FAMILIES = [
    ['romoss', ['romoss', 'روموس', 'رومس']], ['baseus', ['baseus', 'باسئوس', 'بیسوس']],
    ['sadoer', ['sadoer', 'سادور', 'سادوئر']],
    ['hiska', ['hiska', 'هیسکا']], ['onikuma', ['onikuma', 'اونیکوما', 'آنیکوما']],
    ['mcdodo', ['mcdodo', 'مک دودو', 'مک‌دودو']], ['anker', ['anker', 'انکر']],
    ['xiaomi', ['xiaomi', 'شیائومی', 'شیاومی']], ['samsung', ['samsung', 'سامسونگ']],
    ['apple', ['apple', 'اپل']], ['huawei', ['huawei', 'هواوی']],
    ['ugreen', ['ugreen', 'یوگرین']], ['ldnio', ['ldnio', 'الدینیو']],
    ['hoco', ['hoco', 'هوکو']], ['borofone', ['borofone', 'بروفون']]
  ];
  const PRODUCT_TYPES = [
    ['headphones', ['هدفون', 'هدست', 'هندزفری', 'ایرفون', 'headphone', 'headphones', 'headset', 'earphone', 'earphones', 'earbud', 'earbuds']],
    ['speakers', ['اسپیکر', 'بلندگو', 'speaker', 'speakers', 'soundbar', 'ساندبار']],
    ['cables', ['کابل', 'cable', 'کابل شارژ', 'کابل تایپ سی', 'usb cable', 'charging cable']],
    ['chargers', ['شارژر', 'charger', 'آداپتور', 'adapter', 'power adapter']],
    ['power-banks', ['پاوربانک', 'پاور بانک', 'power bank', 'powerbank']]
  ];
  const hasPhrase = (raw, phrase) => {
    const text = ' ' + U.normalize(raw) + ' ', normalized = U.normalize(phrase);
    return !!normalized && text.includes(' ' + normalized + ' ');
  };
  function brandFamilies(raw) {
    const text = ' ' + U.normalize(raw) + ' ';
    return BRAND_FAMILIES.filter(([, aliases]) => aliases.some(alias => text.includes(' ' + U.normalize(alias) + ' '))).map(([id]) => id);
  }
  function productTypes(raw) { return PRODUCT_TYPES.filter(([, aliases]) => aliases.some(alias => hasPhrase(raw, alias))).map(([id]) => id); }
  function productTypeMismatch(source, candidate, strict) {
    const expected = productTypes(source), found = productTypes(candidate);
    if (expected.length && found.length && !expected.some(id => found.includes(id)))
      return { ok: false, score: 0, level: 'low', reasons: ['نوع کالای نتیجه با محصول صفحه متفاوت است'], flags: ['category-mismatch'] };
    if (strict && expected.length && !found.length)
      return { ok: false, score: 0, level: 'low', reasons: ['نوع کالای نتیجه برای تأیید تطبیق مشخص نیست'], flags: ['category-unverified'] };
    return null;
  }
  function brandMismatch(brandAliases, candidate, strict) {
    const aliases = [...new Set((Array.isArray(brandAliases) ? brandAliases : [brandAliases]).filter(Boolean).map(U.normalize).filter(x => x.length >= 2))];
    const expected = [...new Set(aliases.flatMap(brandFamilies))];
    const found = brandFamilies(candidate);
    const familyMatch = found.some(id => expected.includes(id));
    const aliasMatch = aliases.some(alias => hasPhrase(candidate, alias));
    if (found.some(id => expected.length && !expected.includes(id)) || (strict && aliases.length && !familyMatch && !aliasMatch))
      return { ok: false, score: 0, level: 'low', reasons: ['برند نتیجه با برند محصول تطبیق ندارد'], flags: ['brand-mismatch'] };
    return null;
  }
  function specs(raw) {
    const t = U.normalize(raw).replace(/(\d)\s+(?=[a-zآ-ی])/g, '$1'), out = {};
    for (const [u, re] of UNITS) {
      const rx = new RegExp('(\\d+)(?:' + re.source + ')', 'g'); let m;
      while ((m = rx.exec(t))) (out[u] ||= new Set()).add(Number(m[1]));
    }
    return out;
  }
  function evaluate(src, cand, { strict = false, brandAliases = [] } = {}) {
    const reasons = [], flags = [];
    const base = baseline(src, cand);
    const st = U.tokens(src), ct = U.tokens(cand), cn = U.normalize(cand), set = new Set(cn.split(' ')), cc = cn.replace(/\s+/g, '');
    const sourceSet = new Set(st), sourceCompact = U.normalize(src).replace(/\s+/g, '');
    const cov = st.length ? st.filter(t => set.has(t) || (t.length >= 4 && cc.includes(t))).length / st.length : 0;
    const precision = ct.length ? ct.filter(t => sourceSet.has(t) || (t.length >= 4 && sourceCompact.includes(t))).length / ct.length : 0;
    const titleFit = cov + precision ? 2 * cov * precision / (cov + precision) : 0;
    const { codes, found, missing } = modelCodeMatch(src, cand);
    const a = specs(src), b = specs(cand);
    const typeConflict = productTypeMismatch(src, cand, strict);
    if (typeConflict) return typeConflict;
    const brandConflict = brandMismatch(brandAliases, cand, strict);
    if (brandConflict) return brandConflict;
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
    if (strict && codes.some(code => /^\d{3}$|^[a-z]\d{2}$/i.test(code)) && cov < 0.8)
      return { ok: false, score: +(cov * 0.4).toFixed(2), level: 'low', reasons: ['کد مدل کوتاه و مشترک است؛ شباهت بقیهٔ عنوان برای تأیید کافی نیست (' + Math.round(cov * 100) + '٪)'], flags: ['low-context'] };
    let model = codes.length ? found.length / codes.length : null;
    if (codes.length && found.length < codes.length) { flags.push('partial-model'); reasons.push('بخشی از کد مدل/ظرفیت تأیید نشد'); }
    // Without a model/capacity code (common for groceries, clothing, cosmetics), word-overlap alone is a weak
    // signal — "same category, different brand" can still clear the 50% baseline. Real data (different brands of
    // sunflower seeds scoring 0.56) showed this matters, so no-code matches need a much higher bar to be accepted.
    if (!codes.length) {
      flags.push('no-model-code');
      if (cov < 0.9 || precision < 0.85) return { ok: false, score: titleFit * 0.4, level: 'low', reasons: ['بدون کد مدل/ظرفیت، شباهت دوطرفهٔ عنوان برای نمایش قیمت کافی نیست'], flags: ['no-model-code', 'low-coverage'] };
      reasons.push('کد مدل لاتین برای تأیید وجود ندارد؛ فقط بر اساس پوشش کلمات نام (' + Math.round(cov * 100) + '٪) پذیرفته شد');
    }
    // A title-only match is useful but cannot carry the same evidence as an explicit model code.
    let score = codes.length ? 0.45 * titleFit + 0.55 * model : Math.min(0.72, titleFit * 0.72);
    if (codes.length && cov < 0.75) { flags.push('low-coverage'); reasons.push('پوشش کلمات نام ' + Math.round(cov * 100) + '٪'); }
    const level = score >= 0.9 ? 'high' : score >= 0.65 ? 'medium' : 'low';
    if (level === 'low') flags.push('suspicious');
    return { ok: true, score: +score.toFixed(2), level, reasons, flags };
  }
  return { baseline, modelCodes, modelCodeMatch, specs, brandFamilies, productTypes, evaluate };
})();
