import fs from 'fs'; import path from 'path';
const dir = 'src', files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const body = files.map(f => `\n// ---- ${f} ----\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const HEADER = `// ==UserScript==
// @name         تخفیف‌سنج
// @namespace    ghafel-com-pro
// @version      15.2.22
// @description  مقایسهٔ قیمت فروشندگان، تاریخچهٔ قیمت دیجی‌کالا، بازرس تخفیف، واچ‌لیست و هشدار قیمت
// @author       GHAFEL_com (Original Creator)
// @contributor  RealMahdi_a (Upgrade & Development)
// @homepageURL  https://aqilistudio.ir/
// @supportURL   https://t.me/RealMahdi_a
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @connect      api.torob.com
// @connect      torob.com
// @connect      api.digikala.com
// @connect      www.digikala.com
// @connect      emalls.ir
// @connect      services.basalam.com
// @connect      apix.snappshop.ir
// @noframes
// @run-at       document-idle
// ==/UserScript==
/* تخفیف‌سنج 15.2.22 — Original Creator: GHAFEL_com (https://t.me/GHAFEL_com) · Upgrade & Development: RealMahdi_a (https://t.me/RealMahdi_a) · Website: https://aqilistudio.ir/
   Built from readable modules in /src. The 8.7 engine logic is preserved in src/06-extract.js (extraction),
   src/07-match.js (baseline rule) and src/08-sources.js (Torob flow). */
`;
const names = 'U,Log,Store,Net,Model,Extract,Match,Sources,Analysis,App,Alerts,Exporter,UI,Main';
fs.writeFileSync('dist/Takhfifsanj_15.user.js', HEADER + `(function () {\n'use strict';\n${body}\n\nMain.init();\n})();\n`);
fs.writeFileSync('dist/ghafel13.test.js', `(function(){\n'use strict';\n${body}\nreturn {${names}};\n})()`);
console.log('built', files.length, 'modules');
