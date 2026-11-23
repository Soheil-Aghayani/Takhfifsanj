/* ===== UI: ONE Shadow-DOM panel. Reads only from App.state. ===== */
const UI = (() => {
  const HOST_ID = 'ghafel-pro-host';
  const ICONS = SolarIcons;
  const CSS = `
:host{all:initial;direction:rtl;font-family:Vazirmatn,"Noto Sans Arabic",Tahoma,system-ui,"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.55;position:fixed;z-index:2147483646}
*{box-sizing:border-box;font-family:inherit}
.dark{--bg:#0e1014;--panel:#15181e;--card:#1d222a;--ink:#f3f4f6;--mut:#a7abb4;--acc:#d4aa45;--acc2:#f0c65a;--on-acc:#15171b;--warn:#edbd58;--bad:#ed7777;--good:#78c99a;--good-soft:rgba(120,201,154,.1);--warn-soft:rgba(237,189,88,.11);--line:#343943;--shadow:0 16px 46px rgba(0,0,0,.52);--chart-official:#9a8ef0;--chart-label:#a7abb4;--chart-local:#f0c65a;--chart-min:#78c99a;--scroll-thumb:rgba(167,171,180,.48);--scroll-hover:rgba(240,198,90,.78)}
.light{--bg:#fbf8ef;--panel:#fff;--card:#f7efd8;--ink:#201c10;--mut:#8a7a4e;--acc:#b8860b;--acc2:#8a6d00;--warn:#b45309;--bad:#dc2626;--line:#e8dcb5;--shadow:0 12px 40px rgba(120,96,20,.22);--chart-official:#8b5cf6;--chart-label:#a9a6d6;--chart-local:#fbbf24;--chart-min:#34d399;--scroll-thumb:rgba(138,122,78,.42);--scroll-hover:rgba(184,134,11,.72)}
.wrap{color:var(--ink)}
#pill{all:unset;cursor:pointer;display:inline-flex;gap:7px;align-items:center;padding:9px 16px;border-radius:999px;background:linear-gradient(135deg,#1a1a1a,#000);border:1px solid #d4af37;color:#f1c94e;font-weight:700;box-shadow:var(--shadow);user-select:none;font-family:inherit;font-size:13px}
.icon{display:inline-block;width:16px;height:16px;flex:0 0 auto;vertical-align:middle}.icon-sm{width:14px;height:14px}
#pill:hover{filter:brightness(1.1)}
#panel{position:relative;display:none;width:min(420px,calc(100vw - 20px));height:84vh;max-height:84vh;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}
#panel.open{display:flex}
#panel.wide{width:min(560px,calc(100vw - 20px))}
header,.hero,.tabs{flex-shrink:0}
.tb{width:100%;border-collapse:collapse;font-size:12px}.tb td{padding:5px 3px;border-bottom:1px solid var(--line);vertical-align:middle}.tb tr.best td{background:rgba(52,211,153,.08)}.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:4px}.dot.high{background:var(--acc2)}.dot.medium{background:var(--warn)}.dot.low{background:var(--bad)}
input[type=text]{min-width:0}#q{flex:1}
.tabs{position:relative;z-index:2;background:var(--panel)}
.body{min-height:0;overscroll-behavior:contain}
#panel.compact .meta{display:none}#panel.compact .price{font-size:16px;margin:0}#panel.compact .name{-webkit-line-clamp:1;font-size:12px}#panel.compact .hero{padding:6px 14px}
#pill{touch-action:none}header{touch-action:none}
header{cursor:move;padding:12px 14px 10px;background:linear-gradient(135deg,rgba(212,175,55,.18),rgba(0,0,0,.25));border-bottom:1px solid var(--line);position:relative}
.bf-badge{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;background:linear-gradient(135deg,#d4af37,#f1c94e);color:#111;font-size:10px;font-weight:800;vertical-align:middle}
.brand{font-weight:800;font-size:15px;letter-spacing:.2px}.brand b{color:var(--acc2)}
.x{all:unset;cursor:pointer;position:absolute;left:10px;top:10px;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;color:var(--mut)}.x .icon{width:15px;height:15px}.x:hover{background:var(--card);color:var(--ink)}
.x2{left:40px}.x3{left:70px}
.hero{padding:10px 14px;border-bottom:1px solid var(--line)}
.name{font-weight:700;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.price{font-size:24px;font-weight:800;color:var(--acc2);margin:2px 0}.price small{font-size:12px;color:var(--mut);font-weight:400}
.meta{font-size:11px;color:var(--mut)}.meta s{opacity:.8}
.tabs{display:flex;gap:3px;padding:6px 8px;overflow-x:auto;border-bottom:1px solid var(--line);scrollbar-width:none}
.tab{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;padding:5px 9px;border-radius:9px;color:var(--mut);font-size:11.5px;font-family:inherit}
.tab.on{background:var(--acc);color:#fff;font-weight:700}
.body{padding:12px 14px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) var(--panel);scrollbar-gutter:stable;overscroll-behavior:contain}
.body::-webkit-scrollbar{width:7px}
.body::-webkit-scrollbar-track{background:var(--panel);border-radius:999px}
.body::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:2px solid var(--panel);border-radius:999px;min-height:32px}
.body::-webkit-scrollbar-thumb:hover{background:var(--scroll-hover);border-width:1px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:9px}
.card-title{display:flex;align-items:center;gap:7px}
details.card summary{cursor:pointer;list-style:none}details.card summary::-webkit-details-marker{display:none}details.card[open] summary{margin-bottom:5px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.btn{all:unset;cursor:pointer;padding:7px 12px;border-radius:10px;background:linear-gradient(135deg,var(--acc2),var(--acc));color:#fff;font-weight:700;font-size:12px;text-align:center;font-family:inherit;box-shadow:0 2px 6px rgba(0,0,0,.12);transition:filter .14s ease,transform .14s ease,box-shadow .14s ease}
.btn:hover:not([disabled]){filter:brightness(1.07);transform:translateY(-1px);box-shadow:0 4px 10px rgba(0,0,0,.18)}.btn:active:not([disabled]){transform:translateY(0);box-shadow:none}
.btn.sec{background:var(--card);color:var(--ink);border:1px solid var(--line)}.btn.bad{background:var(--bad);color:#fff}.btn[disabled]{opacity:.5;cursor:default}
.btn.icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}.btn.icon-btn .icon{width:15px;height:15px}
.btns{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
.setting-hint{display:flex;align-items:center;gap:6px;margin-top:7px;color:var(--mut);font-size:11px}.setting-hint kbd{padding:1px 6px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--ink);font:inherit;direction:ltr}
.chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:10.5px;border:1px solid var(--line);color:var(--mut)}
.chip.good{color:var(--acc2);border-color:var(--acc2)}.chip.warn{color:var(--warn);border-color:var(--warn)}.chip.bad{color:var(--bad);border-color:var(--bad)}
.muted{color:var(--mut);font-size:11.5px}.good{color:var(--acc2)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.offer{display:flex;justify-content:space-between;gap:8px;align-items:center}.offer.best{border-color:var(--acc2);box-shadow:0 0 0 1px var(--acc2) inset}
.offer a{color:var(--acc);text-decoration:none;font-size:11px}
.pv{font-weight:800;font-size:15px;white-space:nowrap}
select,input[type=number],input[type=text]{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:5px 8px;font-family:inherit;font-size:12px}
input[type=number]{width:130px}
label.ck{display:flex;gap:6px;align-items:center;margin:5px 0;font-size:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:7px 9px}.m span{display:block;color:var(--mut);font-size:10.5px}.m b{font-size:13px}
.banner{background:rgba(251,191,36,.12);border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:7px 10px;margin-bottom:9px;font-size:11.5px}
.verdict{border-radius:12px;padding:10px 12px;margin-bottom:9px;font-weight:700;border:1px solid}
.v-confirmed{background:rgba(52,211,153,.1);border-color:var(--acc2);color:var(--acc2)}.v-rise-signal{background:rgba(251,191,36,.1);border-color:var(--warn);color:var(--warn)}.v-insufficient{background:rgba(169,166,214,.08);border-color:var(--line);color:var(--mut)}
ul{margin:4px 0 0;padding:0 16px}li{margin:3px 0}
.log{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;color:var(--mut)}.log .e{color:var(--bad)}.log .w{color:var(--warn)}
svg text{font-family:inherit}
:focus-visible{outline:2px solid var(--acc2);outline-offset:2px}
.dark #pill{background:linear-gradient(145deg,#20242c,#0c0e12);border-color:#d4aa45;color:#f0c65a}
.dark header{background:linear-gradient(135deg,rgba(240,198,90,.13),rgba(18,20,25,.12))}
.dark .bf-badge{background:linear-gradient(135deg,#f0c65a,#d4aa45);color:#17191d;letter-spacing:.35px}
.dark .tab.on,.dark .btn:not(.sec):not(.bad){background:var(--acc2);color:var(--on-acc)}
.dark .btn.bad{color:#231516}
.dark .good,.dark .chip.good{color:var(--good)}
.dark .chip.good{border-color:var(--good)}
.dark .tb tr.best td{background:var(--good-soft)}
.dark .v-confirmed{background:var(--good-soft);border-color:var(--good);color:var(--good)}
.dark .v-rise-signal{background:var(--warn-soft);border-color:var(--warn);color:var(--warn)}
.dark .v-insufficient{background:rgba(167,171,180,.08);border-color:var(--line);color:var(--mut)}
`;
  let host, root, S;
  const $ = s => root.querySelector(s);
  const icon = (name, size = 16, extraClass = '') => `<svg class="icon${extraClass ? ' ' + extraClass : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  const iconText = (name, text) => `${icon(name)}<span>${text}</span>`;

  const LV = { high: ['اطمینان بالا', 'good'], medium: ['اطمینان متوسط', 'warn'], low: ['مشکوک', 'bad'] };
  const STATUS = { ok: ['فعال', 'good'], loading: ['در حال دریافت…', ''], empty: ['بدون نتیجه', 'warn'], 'no-match': ['تطبیقی پیدا نشد', 'warn'], error: ['خطا', 'bad'], unavailable: ['در دسترس نیست', ''], off: ['خاموش', ''] };

  function chart(storePts, localPts, rangeDays) {
    const W = 340, H = 150, pl = 8, pr = 8, pt = 10, pb = 22;
    const all = [...storePts, ...localPts.map(x => ({ t: x.t, price: x.p }))].filter(p => p.price > 0);
    if (all.length < 2) return '<div class="muted" style="padding:14px 0;text-align:center">نقطهٔ کافی برای رسم نمودار وجود ندارد.</div>';
    const end = Math.max(...all.map(p => p.t)), from = end - rangeDays * U.DAY;
    const sp = storePts.filter(p => p.t >= from && p.price > 0), lp = localPts.filter(p => p.t >= from);
    const vals = [...sp.map(p => p.price), ...lp.map(p => p.p)]; if (vals.length < 2) return '<div class="muted" style="padding:14px 0;text-align:center">در این بازه داده‌ای نیست.</div>';
    const mn = Math.min(...vals), mx = Math.max(...vals), pad = (mx - mn) * 0.08 || mx * 0.05;
    const x = t => pl + (t - from) / (end - from || 1) * (W - pl - pr), y = v => pt + (1 - (v - (mn - pad)) / ((mx + pad) - (mn - pad))) * (H - pt - pb);
    // break the line at gaps larger than 2 days (no interpolation across missing data)
    let d = '', prev = null; for (const p of sp) { d += (prev && p.t - prev.t <= 2.5 * U.DAY ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.price).toFixed(1) + ' '; prev = p; }
    const dots = lp.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.p).toFixed(1)}" r="2.8" fill="var(--chart-local)"/>`).join('');
    const minP = sp.length ? sp.reduce((a, b) => b.price < a.price ? b : a) : null;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="direction:ltr"><path d="${d}" fill="none" stroke="var(--chart-official)" stroke-width="2.2" stroke-linejoin="round"/>${dots}
      ${minP ? `<circle cx="${x(minP.t).toFixed(1)}" cy="${y(minP.price).toFixed(1)}" r="4" fill="var(--chart-min)"/>` : ''}
      <text x="${pl}" y="${H - 6}" font-size="9.5" fill="var(--chart-label)">${U.faDate(from)}</text><text x="${W - pr}" y="${H - 6}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.faDate(end)}</text>
      <text x="${W - pr}" y="${pt + 2}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.fmt(mx)}</text><text x="${W - pr}" y="${H - pb - 3}" font-size="9.5" fill="var(--chart-label)" text-anchor="end">${U.fmt(mn)}</text></svg>`;
  }

  // ----- tabs -----
  function tabCompare() {
    const p = S.product || {}, srcs = S.sources; let h = '';
    h += `<div class="btns"><button class="btn icon-btn" data-act="compare" ${S.running ? 'disabled' : ''}>${iconText('search', S.running ? 'در حال جست‌وجو…' : 'مقایسه قیمت')}</button><button class="btn sec icon-btn" data-act="reread">${iconText('refresh', 'بازخوانی')}</button><button class="btn sec icon-btn" data-act="manual">${iconText('wallet', 'قیمت دستی')}</button></div>`;
    h += `<div class="row" style="margin-bottom:8px;gap:6px"><input type="text" id="q" aria-label="جست‌وجوی دستی در ترب" placeholder="جست‌وجوی دستی در ترب" value="${U.esc(S.manualQuery || '')}"><button class="btn sec icon-btn" data-act="manualSearch">${iconText('search', 'جست‌وجو')}</button></div>`;
    const chips = Object.keys(Sources.registry).map(id => { const r = Sources.registry[id], st = srcs[id] || { status: Store.get().settings.sources[id] && r.implemented ? 'idle' : (r.implemented ? 'off' : 'unavailable') }; const [lbl, cl] = STATUS[st.status] || ['آماده', '']; return `<span class="chip ${cl}" title="${U.esc(st.error || st.note || r.note)}">${U.esc(r.label)}: ${lbl}${st.count ? ' · ' + U.toFa(st.count) : ''}</span>`; }).join(' ');
    h += `<div style="margin-bottom:9px">${chips}</div>`;
    const tr = srcs.torob; if (tr && tr.candidates && tr.candidates.length > 1) h += `<div class="card"><div class="muted" style="margin-bottom:4px">محصول تطبیق‌یافته در ترب — اگر رنگ/مدل دیگری مدنظر است تغییر دهید</div><select data-sel="cand" style="width:100%">${tr.candidates.map(c => `<option value="${U.esc(c.key)}" ${c.key === tr.chosenKey ? 'selected' : ''}>${U.esc(c.title.slice(0, 60))} · ${U.fmt(c.price)}</option>`).join('')}</select></div>`;
    if (tr && tr.tried && tr.tried.length > 1) h += `<div class="muted" style="margin-bottom:6px">جست‌وجوی چندمرحله‌ای: ${U.toFa(tr.tried.length)} عبارت امتحان شد؛ عبارت موفق: «${U.esc(tr.query)}»</div>`;
    for (const id of Object.keys(srcs)) { const st = srcs[id]; if (st.error) h += `<div class="banner">خطای ${U.esc(Sources.registry[id].label)}: ${U.esc(st.error)} — سایر منابع و موتور اصلی فعال می‌مانند.</div>`; }
    let offers = S.offers.slice();
    if (S.trustedOnly) offers = offers.filter(o => o.matchLevel !== 'low');
    offers.sort((a, b) => S.sort === 'name' ? a.seller.localeCompare(b.seller, 'fa') : S.sort === 'desc' ? b.price - a.price : a.price - b.price);
    if (S.offers.length) {
      h += `<div class="row" style="margin-bottom:6px"><select data-sel="sort"><option value="price" ${S.sort === 'price' ? 'selected' : ''}>ارزان‌ترین</option><option value="desc" ${S.sort === 'desc' ? 'selected' : ''}>گران‌ترین</option><option value="name" ${S.sort === 'name' ? 'selected' : ''}>نام فروشنده</option></select><label class="ck"><input type="checkbox" data-ck="trusted" ${S.trustedOnly ? 'checked' : ''}>فقط تطبیق قابل‌اتکا</label><button class="btn sec" data-act="toggleTable">${S.table ? 'نمای کارتی' : 'نمای جدول'}</button></div>`;
      const a = App.advice();
      h += `<div class="card"><b class="${a.tone === 'good' ? 'good' : a.tone === 'warn' ? 'warn' : ''}">مشاور خرید: ${U.esc(a.headline)}</b><ul>${a.points.map(x => `<li class="${x.k === 'good' ? 'good' : x.k === 'warn' ? 'warn' : ''}">${U.esc(x.text)}</li>`).join('')}</ul><div class="muted" style="margin-top:6px">${a.caveats.map(U.esc).join('<br>')}</div></div>`;
      const bestPrice = Math.min(...S.offers.filter(o => o.matchLevel !== 'low').map(o => o.price));
      const shown = S.showAll ? offers : offers.slice(0, 5);
      if (S.table) {
        h += '<table class="tb">' + shown.map(o => { const diff = p.price ? (o.price - p.price) / p.price * 100 : null; return `<tr class="${o.price === bestPrice && o.matchLevel !== 'low' ? 'best' : ''}"><td><span class="dot ${o.matchLevel}" title="${(LV[o.matchLevel] || [''])[0]}"></span>${U.esc(o.seller)}</td><td><b>${U.fmt(o.price)}</b></td><td class="${diff != null && diff < -0.5 ? 'good' : diff > 0.5 ? 'bad' : 'muted'}">${diff == null ? '' : (diff < 0 ? '−' : diff > 0 ? '+' : '') + U.fmtPct(Math.abs(diff))}</td><td>${o.sellerUrl ? `<a style="color:var(--acc)" href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده" aria-label="بازکردن صفحهٔ فروشنده">${icon('link', 14, 'icon-sm')}</a>` : ''}</td></tr>`; }).join('') + '</table>';
      }
      else for (const o of shown) {
        const diff = p.price ? (o.price - p.price) / p.price * 100 : null, lv = LV[o.matchLevel] || ['', ''];
        const dd = diff == null ? '' : Math.abs(diff) < 0.5 ? '<span class="muted">هم‌قیمت با این صفحه</span>' : diff < 0 ? `<span class="good">${U.fmtPct(-diff)} ارزان‌تر · صرفه‌جویی ${U.fmt(p.price - o.price)}</span>` : `<span class="bad">${U.fmtPct(diff)} گران‌تر</span>`;
        h += `<div class="card offer ${o.price === bestPrice && o.matchLevel !== 'low' ? 'best' : ''}"><div><b>${U.esc(o.seller)}</b> ${o.price === bestPrice && o.matchLevel !== 'low' ? '<span class="chip good">ارزان‌ترین</span>' : ''}<br>${dd}<br><span class="chip ${lv[1]}" title="${U.esc((o.flags || []).join(' | '))}">${lv[0]} · ${U.toFa(Math.round((o.matchConfidence || 0) * 100))}٪</span> <span class="chip">ارسال: نامشخص</span> ${o.flags.some(f => f.startsWith('dedup')) ? '<span class="chip">تکراری‌ها حذف شد</span>' : ''}<div class="muted">${U.esc(o.sourceId)} · ${new Date(o.ts).toLocaleTimeString('fa-IR')}</div></div><div style="text-align:left"><div class="pv">${U.fmt(o.price)} <small class="muted">تومان</small></div>${o.sellerUrl ? `<a href="${U.esc(o.sellerUrl)}" target="_blank" rel="noopener noreferrer" title="بازکردن صفحهٔ فروشنده">${icon('link', 14, 'icon-sm')} فروشگاه</a>` : ''}</div></div>`;
      }
      if (offers.length > 5) h += `<div class="btns"><button class="btn sec" data-act="toggleAll">${S.showAll ? 'نمایش کمتر' : 'نمایش همهٔ ' + U.toFa(offers.length) + ' مورد'}</button></div>`;
    } else if (!S.running && Object.keys(srcs).length) h += '<div class="card muted">هیچ فروشندهٔ دیگری با تطبیق قابل‌اتکا یافت نشد. هیچ قیمت حدسی نمایش داده نمی‌شود.</div>';
    for (const id of Object.keys(srcs)) { const nm = srcs[id].nearMiss; if (nm && nm.length) h += `<div class="card muted"><b>نتایج ردشده (مدل متفاوت):</b><ul>${nm.map(n => `<li>${U.esc(n.title)} — ${U.esc(n.reason)}</li>`).join('')}</ul></div>`; }
    if (!S.offers.length && !Object.keys(srcs).length) h += '<div class="card muted">برای دریافت قیمت فروشندگان «شروع مقایسه» را بزنید.</div>';
    return h;
  }

  function tabHistory() {
    let h = '';
    if (!S.product || !S.product.id) return '<div class="card muted">تاریخچهٔ رسمی فقط برای صفحات دیجی‌کالا (dkp) در دسترس است. نقاط ثبت‌شدهٔ محلی در واچ‌لیست/خروجی قابل‌مشاهده‌اند.</div>' + localOnly();
    const cooldown = Math.max(0, Math.ceil((S.historyCooldownUntil - Date.now()) / 1000));
    const loc = App.localHistoryPoints();
    const officialValid = Analysis.valid(App.historyPoints());
    const combined = App.combinedHistoryPoints();
    const rangeEnd = combined.length ? Math.max(...combined.map(p => p.t)) : Date.now();
    const stats = Analysis.stats(combined.filter(p => p.t >= rangeEnd - S.range * U.DAY));
    h += `<div class="btns"><button class="btn sec" data-act="reloadHistory" ${S.chartLoading || cooldown > 0 ? 'disabled' : ''}>${S.chartLoading ? 'در حال دریافت…' : cooldown > 0 ? `منتظر بمانید (${U.toFa(cooldown)} ثانیه)` : 'دریافت دوباره'}</button>${[7, 30, 90].map(d => `<button class="btn ${S.range === d ? '' : 'sec'}" data-range="${d}">${U.toFa(d)} روز</button>`).join('')}</div>`;
    if (S.chartError) h += `<div class="banner">${U.esc(S.chartError)}${cooldown > 0 ? ' — برای جلوگیری از محدودیت بیشتر، تا پایان شمارش معکوس دوباره تلاش نمی‌شود، حتی با کلیک دستی.' : ''}</div>`;
    if (cooldown > 0 && !S.chartLoading) scheduleCountdownTick();
    if (S.chart) {
      const c = S.chart, v = App.selectedVariant();
      if (c.variants.length > 1) h += `<div style="margin-bottom:6px"><select data-sel="variant">${c.variants.map((x, i) => `<option value="${i}" ${i === S.variantIdx ? 'selected' : ''}>${U.esc(x.title || 'واریانت ' + (i + 1))}</option>`).join('')}</select> <span class="chip ${S.variantManual ? 'warn' : S.variantExact ? 'good' : 'warn'}">${S.variantManual ? 'انتخاب دستی؛ با رنگ صفحه تطبیق دهید' : S.variantExact ? 'مطابق رنگ صفحه' : 'رنگ دقیق مشخص نشد'}</span></div>`;
      h += `<div class="card">${chart(officialValid, loc, S.range)}<div class="muted">خط بنفش: تاریخچهٔ رسمی · نقطه‌های طلایی: ثبت محلی همین محصول و رنگ · نقطهٔ سبز: کمینه</div></div>`;
      if (stats) h += `<div class="grid2"><div class="m"><span>کمترین قیمت در بازهٔ انتخابی</span><b>${U.fmt(stats.min)}</b></div><div class="m"><span>بیشترین قیمت</span><b>${U.fmt(stats.max)}</b></div><div class="m"><span>میانه</span><b>${U.fmt(stats.median)}</b></div><div class="m"><span>بازهٔ دارای داده</span><b>${U.toFa(stats.span)} روز · ${U.toFa(stats.count)} روز</b></div></div><div class="muted" style="margin-top:6px">نقطه‌های رسمی: ${U.toFa(officialValid.length)} · ثبت‌های محلی: ${U.toFa(loc.length)} · دادهٔ رسمی ممکن است فقط حدود یک ماه را پوشش دهد؛ سابقهٔ محلی از این پس به‌مرور کامل‌تر می‌شود. روزهای خالی درون‌یابی نمی‌شوند.</div>`;
      else h += '<div class="card muted">این واریانت نقطهٔ قابل‌فروش ندارد.</div>';
    } else {
      if (loc.length) h += `<div class="card">${chart([], loc, S.range)}<div class="muted">این‌ها قیمت‌هایی هستند که افزونه برای همین محصول/واریانت ثبت کرده است.</div></div>`;
      if (!S.chartError && !S.chartLoading) h += '<div class="card muted">تاریخچهٔ رسمی هنوز دریافت نشده.</div>';
    }
    if (S.dk && S.dk.lowest30dOfficial) h += `<div class="card"><span class="muted">کمترین قیمت اعلامی دیجی‌کالا در ۳۰ روز اخیر</span><div class="pv">${U.fmt(S.dk.lowest30dOfficial)} تومان</div></div>`;
    return h;
  }
  const localOnly = () => { const p = Store.get().products[S.key], local = App.localHistoryPoints(); if (!p || !local.length) return ''; return `<div class="card"><b>نقاط ثبت‌شدهٔ محلی</b>${chart([], local, 365)}</div>`; };

  function tabInspector() {
    const points = App.combinedHistoryPoints();
    if (!points.length) return '<div class="card muted">هنوز نقطهٔ تاریخیِ قابل‌فروش برای بررسی نداریم. تب «تاریخچه» را باز کنید؛ اگر دریافت رسمی خطا داد، ثبت‌های محلی بعد از بازدیدهای بعدی به‌مرور جمع می‌شوند.</div>';
    const r = App.inspector(), T = {
      confirmed: 'کاهش قیمت نسبت به سابقه دیده شد',
      'rise-signal': 'نشانهٔ افزایش قیمت یا مرجع بالاتر دیده شد',
      insufficient: r.detail === 'no-drop' ? 'کاهش معناداری نسبت به سابقه دیده نشد' : 'برای نتیجه‌گیری داده کافی نیست'
    };
    const cf = { high: 'بالا', medium: 'متوسط', low: 'پایین', none: 'ندارد' }[r.confidence];
    let h = `<div class="verdict v-${r.verdict}">${T[r.verdict]}<div class="muted" style="font-weight:400">میزان اطمینان تحلیل: ${cf}</div></div>`;
    if (S.chart && S.chart.variants.length > 1) h += `<div class="card"><label class="muted">واریانت تاریخچه را با رنگ همین صفحه تطبیق دهید</label><div style="margin-top:5px"><select data-sel="variant">${S.chart.variants.map((x, i) => `<option value="${i}" ${i === S.variantIdx ? 'selected' : ''}>${U.esc(x.title || 'واریانت ' + (i + 1))}</option>`).join('')}</select> <span class="chip ${S.variantManual ? 'warn' : S.variantExact ? 'good' : 'warn'}">${S.variantManual ? 'انتخاب دستی' : S.variantExact ? 'تطبیق خودکار' : 'تطبیق نامطمئن'}</span></div></div>`;
    const n = r.numbers;
    if (n && n.baseline) h += `<div class="grid2"><div class="m"><span>قیمت پایه · میانهٔ داده‌های پیش از ۱۴ روز اخیر</span><b>${U.fmt(n.baseline)}</b></div><div class="m"><span>${S.product?.price > 0 ? 'قیمت فعلی صفحه' : 'آخرین قیمت ثبت‌شده'}</span><b>${U.fmt(n.current)}</b></div><div class="m"><span>تغییر نسبت به پایه</span><b>${U.fmtPct(n.realDropPct)}</b></div><div class="m"><span>تخفیف ادعایی</span><b>${n.claimedPct == null ? '—' : U.fmtPct(n.claimedPct)}</b></div><div class="m"><span>کمترین قیمت دوره</span><b>${U.fmt(n.min)}</b></div><div class="m"><span>بیشترین قیمت دوره</span><b>${U.fmt(n.max)}</b></div></div><div class="muted" style="margin-top:6px">آخرین نقطه: ${U.faDate(n.latest)} · ${U.toFa(n.ageDays)} روز پیش · ${U.toFa(n.baselinePoints || 0)} نقطه برای پایه</div>`;
    if (r.signals.length) h += `<div class="card"><b class="warn">نشانه‌ها</b><ul>${r.signals.map(s => `<li>${U.esc(s.text)}</li>`).join('')}</ul></div>`;
    h += `<details class="card muted"><summary class="card-title">${icon('shield')}روش و محدودیت‌ها</summary><ul><li>قیمت پایه، میانهٔ قیمت‌های قابل‌فروشِ ثبت‌شده تا ۱۴ روز پیش از آخرین داده است؛ حداقل ۱۰ نقطه در ۲۱ روز و ۵ نقطه برای پایه لازم است.</li><li>بازرس جهش بیش از ۸٪ پیش از دورهٔ اخیر و اختلاف مرجع/تخفیف ادعایی را علامت می‌زند. این‌ها نشانه‌اند، نه اثبات تخلف.</li><li>قیمت فروشنده، موجودی یا گارانتی ممکن است عوض شده باشد؛ دادهٔ قدیمی یا واریانت نامطمئن نتیجهٔ قطعی نمی‌دهد.</li></ul></details>`;
    if (r.reasons.length) h += `<div class="card muted"><ul>${r.reasons.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul></div>`;
    return h;
  }

  function tabWatch() {
    const db = Store.get(), cur = S.key && db.products[S.key]; let h = '';
    if (cur) h += `<div class="card"><label class="ck" title="پیگیری این محصول در واچ‌لیست"><input type="checkbox" data-ck="watch" ${cur.watch ? 'checked' : ''}>${icon('heart')}<span>پیگیری این محصول</span></label><div class="row" style="margin-top:6px"><span class="muted">قیمت هدف (تومان)</span><span><input type="number" id="tgt" aria-label="قیمت هدف به تومان" min="0" value="${cur.target || ''}"> <button class="btn icon-btn" data-act="setTarget">${iconText('check', 'ثبت')}</button></span></div></div>`;
    const list = Object.values(db.products).filter(p => p.watch);
    h += list.length ? list.map(p => { const first = p.local[0], ch = first && p.lastPrice ? (p.lastPrice - first.p) / first.p * 100 : null; const hit = p.target > 0 && p.lastPrice <= p.target;
      return `<div class="card"><div class="row"><b style="font-size:12px">${U.esc((p.title || p.key).slice(0, 60))}</b><button class="btn sec icon-btn" data-rm="${U.esc(p.key)}" aria-label="حذف از واچ‌لیست">${iconText('trash', 'حذف')}</button></div><div class="row"><span class="pv">${U.fmt(p.lastPrice)}</span><span class="${hit ? 'good' : 'muted'}">${p.target ? 'هدف ' + U.fmt(p.target) + (hit ? ' ' + icon('check', 13, 'icon-sm') + 'رسیده' : '') : 'بدون هدف'}</span></div><div class="muted">${p.lastTs ? new Date(p.lastTs).toLocaleString('fa-IR') : '—'} · ${U.esc(p.lastSource || '')}${ch != null ? ' · تغییر ' + U.fmtPct(ch) : ''} · <a style="color:var(--acc)" href="${U.esc(p.url)}" target="_blank" rel="noopener">بازکردن</a></div></div>`; }).join('') : '<div class="card muted">واچ‌لیست خالی است.</div>';
    h += `<div class="btns"><button class="btn sec icon-btn" data-act="checkNow">${iconText('refresh', 'بررسی اکنون')}</button></div><div class="muted" title="هشدار فقط وقتی بررسی می‌شود که حداقل یک تب با این افزونه باز باشد. برای دیجی‌کالا، قیمت زندهٔ واریانت مشخص بررسی می‌شود؛ برای سایت‌های دیگر، آخرین قیمت ثبت‌شده ملاک است.">${icon('bell', 14, 'icon-sm')} هشدارها</div>`;
    return h;
  }

  function tabSettings() {
    const st = Store.get().settings; let h = '';
    h += `<div class="card"><label class="ck" title="تغییر بین تم روشن و تیره"><input type="checkbox" data-set="theme">${icon('sun')}<span>تم روشن</span></label><label class="ck" title="چسبیدن پنل به لبه‌های صفحه هنگام جابه‌جایی"><input type="checkbox" data-set="snap" ${st.snap ? 'checked' : ''}>${icon('pin')}<span>چسبیدن به لبه‌ها</span></label><label class="ck" title="پنل فقط در صفحهٔ محصول نمایش داده شود"><input type="checkbox" data-set="productPageOnly" ${st.productPageOnly ? 'checked' : ''}>${icon('search')}<span>فقط صفحهٔ محصول</span></label></div>`;
    h += `<div class="card"><b class="card-title">${iconText('tag', 'منابع قیمت')}</b>${Object.values(Sources.registry).map(r => `<label class="ck" title="${U.esc(r.note)}"><input type="checkbox" data-src="${r.id}" ${st.sources[r.id] ? 'checked' : ''} ${r.implemented ? '' : 'disabled'}>${U.esc(r.label)} ${r.implemented ? '' : '<span class="chip">پیاده‌سازی نشده</span>'}</label>`).join('')}<div class="setting-hint" title="مجوزهای شبکه فقط: ${U.esc(Net.ALLOWED.join('، '))}"><kbd>Alt+Shift+G</kbd><span>باز/بستن پنل</span></div></div>`;
    h += `<div class="card"><b class="card-title">${iconText('bell', 'هشدار قیمت')}</b><label class="ck"><input type="checkbox" data-set="alertsEnabled" ${st.alerts.enabled ? 'checked' : ''}>${icon('bell')}<span>فعال</span></label><div class="row"><span class="muted">${iconText('clock', 'بررسی هر (دقیقه)')}</span><input type="number" id="ival" aria-label="فاصلهٔ بررسی هشدار به دقیقه، حداقل ۱۵" min="15" value="${st.alerts.intervalMin}" style="width:80px"></div><div class="muted" style="margin-top:4px">حداقل ۱۵ دقیقه</div></div>`;
    h += `<div class="card"><b class="card-title">${iconText('file', 'داده‌ها')}</b><div class="btns"><button class="btn sec icon-btn" data-act="expCsv">${iconText('download', 'خروجی CSV')}</button><button class="btn sec icon-btn" data-act="expJson">${iconText('download', 'خروجی JSON')}</button><button class="btn sec icon-btn" data-act="impCsv">${iconText('upload', 'ورود CSV')}</button><button class="btn bad icon-btn" data-act="clearProd" title="پاک‌کردن تاریخچهٔ محلی این محصول">${iconText('trash', 'حذف محصول')}</button><button class="btn bad icon-btn" data-act="clearAll" title="پاک‌کردن همهٔ داده‌ها و تنظیمات">${iconText('trash', 'حذف همه')}</button></div><input type="file" id="file" accept=".csv" style="display:none"></div>`;
    return h;
  }

  function tabLog() {
    const legacy = ['ghpro12-host', 'ghafel-pc-btn', 'ghafel-pc-panel'].filter(id => document.getElementById(id));
    let h = legacy.length ? `<div class="banner">نسخه‌های قدیمی هم‌زمان فعال‌اند (${legacy.join('، ')}). در Tampermonkey آن‌ها را غیرفعال کنید تا فقط یک پنل بماند.</div>` : '';
    h += `<div class="card muted">نسخه ۱۵.۲.۴ (Black Friday) · محصول: ${U.esc(S.key)} · منبع قیمت: ${U.esc((S.product || {}).priceSource || '—')}${(S.product || {}).priceNote ? ' · ' + U.esc(S.product.priceNote) : ''}</div>`;
    h += `<div class="card log">${Log.all().slice(-60).reverse().map(e => `<div class="${e.level === 'error' ? 'e' : e.level === 'warn' ? 'w' : ''}">${new Date(e.t).toLocaleTimeString('en-GB')} [${U.esc(e.scope)}] ${U.esc(e.msg)}</div>`).join('') || 'بدون رویداد'}</div>`;
    return h;
  }

  const TABS = [['compare', 'compare', 'مقایسه', 'مقایسهٔ قیمت'], ['history', 'history', 'تاریخچه', 'تاریخچهٔ قیمت'], ['inspect', 'search', 'بازرس', 'بازرس تخفیف'], ['watch', 'heart', 'واچ‌لیست', 'واچ‌لیست قیمت'], ['settings', 'settings', 'تنظیمات', 'تنظیمات افزونه'], ['log', 'bug', 'عیب‌یابی', 'گزارش و عیب‌یابی']];
  let countdownTimer = null;
  function scheduleCountdownTick() { if (countdownTimer) return; countdownTimer = setTimeout(() => { countdownTimer = null; if (S.tab === 'history') render(); }, 1000); }
  function render() {
    if (!root) return; const st = Store.get().settings, p = S.product || {};
    const pn = $('#panel'); if (!pn) return;
    pn.classList.toggle('wide', !!st.wide);
    const wideLabel = st.wide ? 'باریک‌کردن پنل' : 'عریض‌کردن پنل'; $('#wide').title = wideLabel; $('#wide').setAttribute('aria-label', wideLabel);
    pn.style.width = pn.style.height = pn.style.maxHeight = '';
    $('.wrap').className = 'wrap ' + (st.theme === 'light' ? 'light' : 'dark');
    $('#name').textContent = Extract.coreTitle(p.title) || p.title || 'نام محصول شناسایی نشد';
    $('#name').setAttribute('title', p.title || '');
    $('#price').innerHTML = p.price ? `${U.fmt(p.price)} <small>تومان · ${U.esc(p.priceSource || '')}</small>` : '<span class="warn" style="font-size:16px">قیمت شناسایی نشد — «ثبت دستی قیمت»</span>';
    const dk = S.dk && S.dk.chosen;
    $('#meta').innerHTML = [p.oldPrice ? `قبل از تخفیف: <s>${U.fmt(p.oldPrice)}</s>` : '', p.seller ? 'فروشنده: ' + U.esc(p.seller) : '', p.warranty ? 'گارانتی: ' + U.esc(p.warranty) : '', dk && S.dk.lowest30dOfficial ? 'کمینهٔ ۳۰روزهٔ اعلامی دیجی‌کالا: ' + U.fmt(S.dk.lowest30dOfficial) : ''].filter(Boolean).join(' · ');
    $('#tabs').innerHTML = TABS.map(([k, ico, l, title]) => {
      const active = S.tab === k;
      return `<button type="button" id="tab-${k}" role="tab" aria-selected="${active}" aria-label="${U.esc(title)}" title="${U.esc(title)}" class="tab ${active ? 'on' : ''}" data-tab="${k}">${active ? `<span>${l}</span>` : icon(ico)}</button>`;
    }).join('');
    const body = { compare: tabCompare, history: tabHistory, inspect: tabInspector, watch: tabWatch, settings: tabSettings, log: tabLog }[S.tab]();
    $('#body').setAttribute('aria-labelledby', `tab-${S.tab}`);
    const keep = $('#body').scrollTop;
    const tamper = (typeof CreditGuard !== 'undefined' && CreditGuard.isOk() === false)
      ? '<div class="banner" style="background:rgba(248,113,113,.15);border-color:var(--bad);color:var(--bad)"><b>این نسخه تغییر داده شده و اعتبار سازندگان حذف/تغییر کرده است.</b> نسخهٔ اصلی: <a style="color:inherit" href="https://t.me/RealMahdi_a" target="_blank" rel="noopener noreferrer">t.me/RealMahdi_a</a></div>' : '';
    $('#body').innerHTML = tamper + (S.banner ? `<div class="banner">${U.esc(S.banner)}</div>` : '') + body;
    $('#body').scrollTop = keep;
    const th = $('[data-set="theme"]'); if (th) th.checked = st.theme === 'light';
  }

  function applyPos() {
    const pos = Store.get().settings.pos || { right: 16, bottom: 16 };
    const vw = innerWidth, vh = innerHeight; const r = host.getBoundingClientRect();
    let { left, top } = pos.left != null ? pos : { left: vw - (r.width || 150) - pos.right, top: vh - (r.height || 40) - pos.bottom };
    left = Math.min(Math.max(4, left), Math.max(4, vw - (r.width || 150) - 4)); top = Math.min(Math.max(4, top), Math.max(4, vh - (r.height || 40) - 4));
    host.style.left = left + 'px'; host.style.top = top + 'px'; host.style.right = 'auto'; host.style.bottom = 'auto';
  }
  function setOpen(o) {
    const st = Store.get().settings; st.open = o; Store.save();
    $('#panel').classList.toggle('open', o); $('#pill').style.display = o ? 'none' : 'inline-flex';
    $('#pill').setAttribute('aria-expanded', String(o));
    if (o) { App.refreshProduct(); } requestAnimationFrame(applyPos);
  }

  function snapToEdges() {
    if (!Store.get().settings.snap) return; const r = host.getBoundingClientRect(), M = 8, T = 24, vw = innerWidth, vh = innerHeight;
    let l = r.left, t = r.top;
    if (l < T) l = M; else if (vw - r.right < T) l = vw - r.width - M;
    if (t < T) t = M; else if (vh - r.bottom < T) t = vh - r.height - M;
    host.style.left = Math.max(0, l) + 'px'; host.style.top = Math.max(0, t) + 'px';
  }
  function bind() {
    const hdr = $('header'), pill = $('#pill');
    function makeDraggable(el, { ignore, onTap }) {
      let drag = null, suppressClick = false;
      el.addEventListener('pointerdown', e => { if (ignore && e.target.closest(ignore)) return; suppressClick = false; const r = host.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false }; try { el.setPointerCapture(e.pointerId); } catch {} });
      el.addEventListener('pointermove', e => {
        if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return; drag.moved = true;
        const r = host.getBoundingClientRect(), w = r.width || 150, h = r.height || 40;
        host.style.left = Math.min(Math.max(0, e.clientX - drag.dx), Math.max(0, innerWidth - w)) + 'px'; host.style.top = Math.min(Math.max(0, e.clientY - drag.dy), Math.max(0, innerHeight - h)) + 'px'; host.style.right = host.style.bottom = 'auto';
      });
      el.addEventListener('pointerup', () => {
        if (!drag) return; const d = drag; drag = null;
        if (d.moved) { suppressClick = true; snapToEdges(); const r = host.getBoundingClientRect(); Store.get().settings.pos = { left: r.left, top: r.top }; Store.save(); }
      });
      el.addEventListener('pointercancel', () => { drag = null; suppressClick = false; });
      if (onTap) el.addEventListener('click', e => {
        if (suppressClick && e.detail > 0) { suppressClick = false; e.preventDefault(); return; }
        suppressClick = false; onTap();
      });
    }
    makeDraggable(hdr, { ignore: '.x' }); makeDraggable(pill, { onTap: () => setOpen(true) });
    $('#wide').onclick = () => { const st = Store.get().settings; st.wide = !st.wide; Store.save(); render(); requestAnimationFrame(applyPos); };
    $('#body').addEventListener('scroll', () => { const t = $('#body').scrollTop, pn = $('#panel'); if (t > 60) pn.classList.add('compact'); else if (t < 8) pn.classList.remove('compact'); });
    $('#min').onclick = () => setOpen(false); $('#close').onclick = () => { Store.get().settings.open = false; Store.save(); host.style.display = 'none'; };
    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-tab],[data-act],[data-range],[data-rm]'); if (!t) return; const db = Store.get();
      if (t.dataset.tab) { S.tab = t.dataset.tab; db.settings.tab = S.tab; Store.save(); if (S.tab === 'history' && !S.chart && !S.chartLoading) App.loadHistory(); return render(); }
      if (t.dataset.range) { S.range = +t.dataset.range; return render(); }
      if (t.dataset.rm) { const p = db.products[t.dataset.rm]; if (p) p.watch = false; Store.save(); return render(); }
      const a = t.dataset.act;
      if (a === 'compare') App.runCompare();
      else if (a === 'toggleTable') { S.table = !S.table; db.settings.table = S.table; Store.save(); render(); }
      else if (a === 'manualSearch') { S.manualQuery = ($('#q').value || '').trim(); App.runCompare(S.manualQuery ? { query: S.manualQuery } : {}); }
      else if (a === 'toggleAll') { S.showAll = !S.showAll; render(); }
      else if (a === 'reread') App.refreshProduct();
      else if (a === 'manual') { const v = Number(U.digits(prompt('قیمت فعلی محصول (تومان):', '') || '').replace(/\D/g, '')); if (v > 0) App.setManualPrice(v); }
      else if (a === 'reloadHistory') App.loadHistory();
      else if (a === 'setTarget') { const v = Number(U.digits($('#tgt').value).replace(/\D/g, '')); const p = Store.touchProduct(S.key); p.target = v > 0 ? v : null; if (v > 0) p.watch = true; Store.save(); render(); }
      else if (a === 'checkNow') { const r = await Alerts.checkAll(true); S.banner = `بررسی انجام شد: ${U.toFa(r.checked)} محصول، ${U.toFa(r.fired)} هشدار`; render(); }
      else if (a === 'expCsv') Exporter.download(`ghafel-${S.key.replace(/[^\w.-]+/g, '_')}.csv`, Exporter.csvFor(S.key, Analysis.valid(App.historyPoints())));
      else if (a === 'expJson') Exporter.download('ghafel-pro13-export.json', Exporter.jsonAll({ chart: S.chart }), 'application/json');
      else if (a === 'impCsv') $('#file').click();
      else if (a === 'clearProd') { if (confirm('تاریخچهٔ محلی این محصول پاک شود؟')) { Store.touchProduct(S.key).local = []; Store.save(); render(); } }
      else if (a === 'clearAll') { if (confirm('همهٔ داده‌ها و تنظیمات افزونه پاک شود؟')) { Store.reset(); render(); } }
    });
    root.addEventListener('input', e => { if (e.target.id === 'q') S.manualQuery = e.target.value; });
    root.addEventListener('keydown', e => { if (e.target.id === 'q' && e.key === 'Enter') { e.preventDefault(); S.manualQuery = e.target.value.trim(); App.runCompare(S.manualQuery ? { query: S.manualQuery } : {}); } });
    root.addEventListener('change', e => {
      const t = e.target, st = Store.get().settings;
      if (t.dataset.sel === 'cand') { App.pickCandidate(t.value); return; }
      else if (t.dataset.sel === 'sort') S.sort = t.value; else if (t.dataset.sel === 'variant') { S.variantIdx = +t.value; S.variantManual = true; }
      else if (t.dataset.ck === 'trusted') S.trustedOnly = t.checked;
      else if (t.dataset.ck === 'watch') { Store.touchProduct(S.key).watch = t.checked; Store.save(); }
      else if (t.dataset.set === 'theme') { st.theme = t.checked ? 'light' : 'dark'; Store.save(); }
      else if (t.dataset.set === 'snap') { st.snap = t.checked; Store.save(); }
      else if (t.dataset.set === 'productPageOnly') { st.productPageOnly = t.checked; Store.save(); }
      else if (t.dataset.set === 'alertsEnabled') { st.alerts.enabled = t.checked; Store.save(); }
      else if (t.dataset.src) { st.sources[t.dataset.src] = t.checked; Store.save(); }
      else if (t.id === 'ival') { st.alerts.intervalMin = Math.max(15, Number(U.digits(t.value)) || 60); Store.save(); }
      else if (t.id === 'file' && t.files[0]) { t.files[0].text().then(tx => { try { const n = Exporter.importLocal(S.key, Exporter.parseCsv(tx)); S.banner = `${U.toFa(n)} نقطه وارد شد (به‌عنوان دادهٔ محلی)`; } catch (er) { S.banner = 'ورود CSV ناموفق: ' + er.message; } render(); }); return; }
      render();
    });
  }

  function mount() {
    if (document.getElementById(HOST_ID)) return;           // the single-panel guarantee
    S = App.state; S.tab = Store.get().settings.tab || 'compare'; S.table = !!Store.get().settings.table; host = document.createElement('div'); host.id = HOST_ID; document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="wrap dark"><button type="button" id="pill" aria-label="بازکردن پنل تخفیف‌سنج" aria-expanded="false" title="تخفیف‌سنج — بکشید تا جابه‌جا شود (Alt+Shift+G)">${icon('tag')}<span>تخفیف‌سنج</span></button>
      <section id="panel"><header><div class="brand"><span class="bf-badge">Black Friday</span>تخفیف‌سنج</div><button type="button" class="x x3" id="wide" title="عریض‌کردن پنل" aria-label="عریض‌کردن پنل">${icon('expand')}</button><button type="button" class="x x2" id="min" title="جمع‌کردن پنل" aria-label="جمع‌کردن پنل">${icon('minus')}</button><button type="button" class="x" id="close" title="بستن پنل" aria-label="بستن پنل">${icon('close')}</button></header>
      <div class="hero"><div class="name" id="name"></div><div class="price" id="price"></div><div class="meta" id="meta"></div></div>
      <nav class="tabs" id="tabs" role="tablist" aria-label="بخش‌های تخفیف‌سنج"></nav><div class="body" id="body" role="tabpanel"></div></section></div>`;
    bind(); App.on(render); render(); requestAnimationFrame(applyPos);
    addEventListener('resize', applyPos);
    if (Store.get().settings.open) setOpen(true);
  }
  const toggle = () => {
    if (!host) return false;
    if (host.style.display === 'none') { host.style.display = ''; setOpen(true); return true; }
    setOpen(!$('#panel').classList.contains('open')); return true;
  };
  const unmount = () => { const h = document.getElementById(HOST_ID); if (h) h.remove(); host = root = null; };
  return { mount, unmount, render, setOpen, toggle, HOST_ID };
})();
