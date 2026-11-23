/* ===== Export / import (CSV + JSON) ===== */
const Exporter = (() => {
  const q = v => {
    let s = String(v ?? '');
    // Keep spreadsheet programs from evaluating page-supplied text as a formula.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function csvFor(key, chartPoints) {
    const p = Store.get().products[key]; const rows = [['product_key', 'title', 'date_iso', 'price_toman', 'kind', 'source']];
    for (const x of (chartPoints || [])) rows.push([key, p?.title || '', U.isoDay(x.t), x.price ?? '', 'store', x.source]);
    for (const x of (p?.local || [])) rows.push([key, p?.title || '', new Date(x.t).toISOString(), x.p, 'local', x.src || 'local']);
    return rows.map(r => r.map(q).join(',')).join('\n');
  }
  const jsonAll = extra => JSON.stringify({ app: 'تخفیف‌سنج 15.2.5', exportedAt: new Date().toISOString(), db: Store.get(), ...extra }, null, 2);
  function parseCsv(text) {
    const out = []; const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean); if (!lines.length) return out;
    const head = lines[0].toLowerCase().split(',').map(s => s.trim().replace(/"/g, ''));
    const ci = n => head.indexOf(n), di = ci('date_iso') >= 0 ? ci('date_iso') : ci('date'), pi = ci('price_toman'), si = ci('source'), ki = ci('kind');
    if (di < 0 || pi < 0) throw new Error('ستون‌های date/date_iso و price_toman لازم است');
    for (const ln of lines.slice(1)) {
      const c = ln.split(','); const t = Date.parse(c[di]); const price = Number(U.digits(c[pi]).replace(/\D/g, ''));
      if (!isFinite(t) || !(price > 0)) continue; if (ki >= 0 && c[ki] === 'store') continue; // store data is re-fetched, never imported as local
      out.push({ t, p: price, src: 'imported:' + (c[si] || 'csv') });
    }
    return out;
  }
  function importLocal(key, rows) {
    const p = Store.touchProduct(key); const have = new Set(p.local.map(x => x.t + ':' + x.p)); let n = 0;
    for (const r of rows) if (!have.has(r.t + ':' + r.p)) { p.local.push(r); n++; }
    p.local.sort((a, b) => a.t - b.t); Store.save(); return n;
  }
  function download(name, text, mime) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: (mime || 'text/csv') + ';charset=utf-8' }));
    a.download = name; document.documentElement.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  return { csvFor, jsonAll, parseCsv, importLocal, download };
})();
