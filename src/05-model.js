/* ===== Model: the standard data records shared by every module ===== */
const Model = (() => {
  const now = () => Date.now();
  const safeHttpUrl = value => {
    try {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const url = new URL(raw, 'https://torob.com/');
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  // A product as seen on the current page.
  function product(o) {
    return {
      id: o.id || '',                 // Product ID (store-specific, e.g. Digikala dkp number)
      key: o.key || '',               // host:id
      host: o.host || '',
      title: o.title || '',           // Product title
      url: o.url || '',               // Source URL
      price: o.price ?? null,         // Current price (toman)
      currency: 'IRT',                // Currency: always toman internally
      priceSource: o.priceSource || '',
      priceTs: o.priceTs || now(),
      oldPrice: o.oldPrice ?? null,   // struck-through / pre-discount price shown by the store
      variantId: o.variantId || '', variantTitle: o.variantTitle || o.color || '',
      seller: o.seller || '', warranty: o.warranty || '',
      nameCandidates: o.nameCandidates || []
    };
  }
  // One seller price from any source.
  function offer(o) {
    return {
      sourceId: o.sourceId,               // data source module
      productId: o.productId || '',
      seller: o.seller || '',             // Seller name
      sellerKey: o.sellerKey || '',       // known-store host key when recognised
      sellerUrl: safeHttpUrl(o.sellerUrl), // External seller links must be ordinary HTTP(S) URLs.
      price: o.price,                     // Seller price (toman)
      currency: 'IRT',
      shippingCost: o.shippingCost ?? null, // null = unknown (never guessed)
      ts: o.ts || now(),                  // Timestamp
      dataSource: o.dataSource || o.sourceId, // Data source (endpoint family)
      matchConfidence: o.matchConfidence ?? null, // Match confidence 0..1
      matchLevel: o.matchLevel || '',     // high | medium | low
      matchTitle: o.matchTitle || '',
      flags: o.flags || []
    };
  }
  // One historical price point supplied by a store.
  function point(o) {
    return { t: o.t, day: o.day || '', price: o.price, rrp: o.rrp ?? null, seller: o.seller || '', warranty: o.warranty || '',
      marketable: o.marketable !== false, source: o.source, kind: o.kind || 'selling_price', currency: 'IRT' };
  }
  return { product, offer, point };
})();
