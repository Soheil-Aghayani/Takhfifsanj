/* ===== Log: ring buffer so every error is visible in the Diagnostics tab ===== */
const Log = (() => {
  const buf = []; const MAX = 200; const subs = new Set();
  function add(level, scope, msg, extra) {
    const e = { t: Date.now(), level, scope, msg: String(msg), extra };
    buf.push(e); if (buf.length > MAX) buf.shift();
    try {
      const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      write('[GHAFEL13]', scope, msg, extra ?? '');
    } catch {}
    subs.forEach(f => { try { f(e); } catch {} });
  }
  return { info: (s, m, x) => add('info', s, m, x), warn: (s, m, x) => add('warn', s, m, x), error: (s, m, x) => add('error', s, m, x), all: () => buf.slice(), on: f => subs.add(f) };
})();
