/* ===== Net: the ONLY place that does network I/O (via GM_xmlhttpRequest), with an allow-list ===== */
const Net = (() => {
  const ALLOWED = NETWORK_ALLOWED_HOSTS;
  const allowed = url => { try { const h = new URL(url).hostname; return ALLOWED.includes(h); } catch { return false; } };

  function gmRequest(url, { accept = 'application/json', referer, headers = {}, timeout = 15000, anonymous = true, method = 'GET', body } = {}) {
    return new Promise((resolve, reject) => {
      if (!allowed(url)) return reject(new Error('دامنهٔ مجاز نیست: ' + (() => { try { return new URL(url).hostname; } catch { return url; } })()));
      const gm = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : (typeof GM !== 'undefined' && GM.xmlHttpRequest);
      if (!gm) return reject(new Error('GM_xmlhttpRequest در دسترس نیست (مجوز @grant را بررسی کنید)'));
      const t0 = Date.now();
      gm({
        method: String(method || 'GET').toUpperCase(), url, timeout, anonymous,
        ...(body == null ? {} : { data: body }),
        headers: { Accept: accept, 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8', ...(referer ? { Referer: referer } : {}), ...headers },
        onload: r => {
          const ms = Date.now() - t0, u = new URL(url);
          Log.info('net', `${r.status} ${u.hostname}${u.pathname} (${ms}ms)`);
          if (r.status === 200) resolve(r.responseText || '');
          else {
            const e = new Error('HTTP ' + r.status); e.status = r.status;
            const m = /retry-after:\s*(\d+)/i.exec(r.responseHeaders || ''); if (m) e.retryAfterMs = Math.min(600000, Math.max(1000, +m[1] * 1000));
            reject(e);
          }
        },
        onerror: e => { const d = e ? JSON.stringify({ error: e.error, status: e.status, finalUrl: e.finalUrl }) : ''; Log.warn('net', 'onerror ' + new URL(url).hostname + ' ' + d); reject(new Error('خطای شبکه' + (e && e.error ? ` (${e.error})` : ' (GM_xmlhttpRequest بدون جزئیات؛ مجوز @connect یا کوکی/VPN را بررسی کنید)'))); },
        ontimeout: () => reject(new Error('timeout'))
      });
    });
  }
  // Page-context fetch: only useful when the page itself is on the target's site (CORS allows www.digikala.com -> api.digikala.com).
  async function pageFetch(url, { accept = 'application/json', timeout = 15000, method = 'GET', body, headers = {}, referer } = {}) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null; const tm = ctl && setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { method: String(method || 'GET').toUpperCase(), ...(body == null ? {} : { body }), credentials: 'include', headers: { Accept: accept, ...headers }, ...(referer ? { referrer: referer, referrerPolicy: 'unsafe-url' } : {}), signal: ctl && ctl.signal });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return await r.text();
    } finally { if (tm) clearTimeout(tm); }
  }
  async function request(url, opts = {}) {
    try { return await gmRequest(url, opts); }
    catch (e) {
      if (!opts.pageFetchFallback || e.status) throw e;
      Log.warn('net', 'GM ناموفق بود، تلاش با fetch صفحه: ' + e.message);
      try { const t = await pageFetch(url, opts); Log.info('net', 'fetch صفحه موفق بود'); return t; }
      catch (e2) { throw new Error(e.message + ' | fetch صفحه: ' + e2.message); }
    }
  }
  async function json(url, opts) {
    const txt = await request(url, opts);
    try { return JSON.parse(txt); } catch { throw new Error('پاسخ JSON معتبر نیست'); }
  }
  return { request, json, allowed, ALLOWED };
})();
