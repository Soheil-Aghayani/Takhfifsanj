/* ===== Net (content-script build): page CSP can block cross-origin fetch, so requests are relayed to the background,
   which fetches using its host_permissions (not subject to the page's CSP). Same allow-list enforced on both ends. ===== */
const Net = (() => {
  const ALLOWED = NETWORK_ALLOWED_HOSTS;
  const allowed = url => { try { return ALLOWED.includes(new URL(url).hostname); } catch { return false; } };
  async function request(url, opts = {}) {
    if (!allowed(url)) throw new Error('دامنهٔ مجاز نیست: ' + (() => { try { return new URL(url).hostname; } catch { return url; } })());
    const t0 = Date.now();
    const r = await Ext.runtime.sendMessage({ type: 'ghafel:net', url, opts: { accept: opts.accept, referer: opts.referer, timeout: opts.timeout, method: opts.method, body: opts.body, headers: opts.headers, anonymous: opts.anonymous } });
    if (!r) throw new Error('پاسخی از background دریافت نشد (افزونه را بازخوانی/ری‌استارت کنید)');
    const u = new URL(url);
    if (r.error) { Log.warn('net', `${r.status || 'ERR'} ${u.hostname}${u.pathname} (${Date.now() - t0}ms) ${r.error}`); const e = new Error(r.error); e.status = r.status; if (r.retryAfterMs) e.retryAfterMs = r.retryAfterMs; throw e; }
    Log.info('net', `${r.status} ${u.hostname}${u.pathname} (${Date.now() - t0}ms)`);
    return r.text || '';
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
