/* ===== CreditGuard: tamper-evident attribution check (deterrent, not an unbreakable lock — see docs/ANTI_TAMPER_FA.md) ===== */
const CreditGuard = (() => {
  const CREDITS = 'Original Creator: GHAFEL_com (https://t.me/GHAFEL_com) | Upgrade & Development: RealMahdi_a (https://t.me/RealMahdi_a)';
  const EXPECTED_HASH = '4efb3f26b39fa183f67c13c9c1b60732b6d35f406fab238ae6ebd3640e7b767e';
  let ok = null;
  async function verify() {
    if (ok !== null) return ok;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(CREDITS));
      const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      ok = hex === EXPECTED_HASH;
    } catch { ok = true; }
    if (!ok) Log.error('credit-guard', 'متن اعتبار سازنده تغییر کرده یا حذف شده است');
    return ok;
  }
  return { CREDITS, verify, isOk: () => ok };
})();
