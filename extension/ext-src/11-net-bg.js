/* ===== Net (background): direct fetch, exempt from any page's CSP; still enforces the same host allow-list. ===== */
const Net = (() => {
  const ALLOWED = NETWORK_ALLOWED_HOSTS;
  const allowed = url => { try { return ALLOWED.includes(new URL(url).hostname); } catch { return false; } };
  async function request(url, { accept = 'application/json', referer, timeout = 15000, method = 'GET', body, headers = {}, anonymous = false } = {}) {
    if (!allowed(url)) { const e = new Error('دامنهٔ مجاز نیست'); throw e; }
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { method: String(method || 'GET').toUpperCase(), ...(body == null ? {} : { body }), credentials: anonymous ? 'omit' : 'include', referrer: referer, referrerPolicy: referer ? 'unsafe-url' : 'strict-origin-when-cross-origin', headers: { Accept: accept, 'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8', ...headers, ...(referer ? { Referer: referer } : {}) }, signal: ctl.signal });
      if (!r.ok) {
        const e = new Error('HTTP ' + r.status); e.status = r.status;
        const ra = r.headers.get('Retry-After'); if (ra) { const n = Number(ra); e.retryAfterMs = Number.isFinite(n) ? Math.min(600000, Math.max(1000, n * 1000)) : (Date.parse(ra) ? Math.max(1000, Date.parse(ra) - Date.now()) : undefined); }
        throw e;
      }
      return await r.text();
    } finally { clearTimeout(tm); }
  }
  async function json(url, opts) {
    const t = await request(url, opts);
    try { return JSON.parse(t); } catch {
      const raw = String(t || '').replace(/^\uFEFF/, '').trimStart();
      const host = new URL(url).hostname;
      const reason = !raw ? 'پاسخ خالی بود' : /^</.test(raw) ? 'پاسخ HTML به‌جای JSON بود؛ احتمالاً صفحهٔ ضدربات یا خطای سرویس' : 'پاسخ ساختار JSON نداشت';
      throw new Error(`${host}: ${reason}`);
    }
  }
  return { request, json, allowed, ALLOWED };
})();
