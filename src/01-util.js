/* ===== U: utilities (digits, normalisation, price parsing, Jalali dates) ===== */
const U = (() => {
  const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  const STOP = new Set(['با','و','در','از','برای','خرید','قیمت','مدل','اصل','جدید','تومان','ریال','the','and','for','new']);

  const digits = s => String(s ?? '').replace(/[۰-۹]/g, c => FA.indexOf(c)).replace(/[٠-٩]/g, c => AR.indexOf(c));
  // Same normalisation as the verified 8.7 engine.
  const normalize = s => digits(s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u0652\u0640\u200c\u200e\u200f]/g, ' ').replace(/[^a-zA-Z0-9آ-ی]+/g, ' ').toLowerCase().trim();
  const compact = s => normalize(s).replace(/\s+/g, '');
  const tokens = s => normalize(s).split(' ').filter(t => t.length > 1 && !STOP.has(t));

  const toFa = s => String(s).replace(/\d/g, d => FA[d]);
  const fmt = n => (n == null || !isFinite(n)) ? '—' : Math.round(n).toLocaleString('fa-IR');
  const fmtPct = n => (n == null || !isFinite(n)) ? '—' : toFa((Math.abs(n) < 10 ? n.toFixed(1) : Math.round(n)).toString()) + '٪';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const DAY = 86400000;

  // Numbers followed by a currency word (toman / rial). Rial is converted to toman.
  function pricesWithCurrency(text) {
    const t = digits(text).replace(/[\u200c\u200e\u200f\u00a0]/g, '').replace(/[٬،]/g, ',');
    const re = /(\d{1,3}(?:,\d{3})+|\d{5,})\s*(تومان|تومن|ریال|ت)(?![آ-ی])/g, out = []; let m;
    while ((m = re.exec(t))) {
      const v = Number(m[1].replace(/\D/g, ''));
      if (v >= 1000) out.push(m[2] === 'ریال' ? Math.round(v / 10) : v);
    }
    return out;
  }
  // Bare numbers formatted like prices.
  function numbersIn(text) {
    const t = digits(text).replace(/[\u200c\u200e\u200f\u00a0]/g, '').replace(/[٬،]/g, ',');
    const re = /(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d{5,})(?![\d,])/g, out = []; let m;
    while ((m = re.exec(t))) out.push(Number(m[1].replace(/\D/g, '')));
    return out;
  }

  // ---- Jalali -> Gregorian (jalaali-js algorithm; verified against jdatetime in tests) ----
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    const bl = BREAKS.length, gy = jy + 621; let leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('bad jalali year ' + jy);
    for (i = 1; i < bl; i++) { jm = BREAKS[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ++;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    return { gy, march: 20 + leapJ - leapG };
  }
  const g2d = (gy, gm, gd) => { const d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  function d2g(jdn) {
    let j = 4 * jdn + 139361631; j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1;
    return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd };
  }
  // "1405/07/07" -> UTC ms (12:00 UTC of that Gregorian day) or null
  function jalaliToTime(str) {
    const m = digits(str).match(/^\s*(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\s*$/); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3]; if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    try { const g = d2g(j2d(jy, jm, jd)); return Date.UTC(g.gy, g.gm - 1, g.gd, 12); } catch { return null; }
  }
  const isoDay = t => new Date(t).toISOString().slice(0, 10);
  const faDate = t => { try { return new Date(t).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }); } catch { return isoDay(t); } };

  return { DAY, STOP, digits, normalize, compact, tokens, toFa, fmt, fmtPct, esc, sleep, median, pricesWithCurrency, numbersIn, jalaliToTime, isoDay, faDate };
})();
