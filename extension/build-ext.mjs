import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(root, '..', 'src'), EXT = path.join(root, 'ext-src');
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const bundle = files => files.map(([dir, f]) => `\n// ---- ${path.basename(dir)}/${f} ----\n` + read(dir, f)).join('\n');

const HEADER = `/* تخفیف‌سنج — Chrome/Firefox extension build.
   Original Creator: GHAFEL_com (https://t.me/GHAFEL_com)
   Upgrade & Development: RealMahdi_a (https://t.me/RealMahdi_a)
   Solar icons: 480 Design — CC BY 4.0 — https://github.com/480-Design/Solar-Icon-Set
   License: see LICENSE_FA.md — free to use; redistributing a modified copy that removes or changes this
   attribution is not permitted. */\n`;

const CONTENT = [
  [SRC, '00-network.js'],
  [EXT, '00-shim.js'], [EXT, '01-credit-guard.js'],
  [SRC, '01-util.js'], [SRC, '02-log.js'], [SRC, '05-model.js'], [SRC, '06-extract.js'], [SRC, '07-match.js'],
  [EXT, '02-store-content.js'], [EXT, '03-net-content.js'],
  [SRC, '08-sources.js'], [SRC, '09-analysis.js'], [SRC, '10-app.js'], [EXT, '04-alerts-client.js'],
  [SRC, '12-export.js'], [SRC, '12-icons.js'], [SRC, '13-ui.js'], [EXT, '05-main-ext.js']
];
const BACKGROUND = [
  [SRC, '00-network.js'],
  [EXT, '00-shim.js'], [SRC, '01-util.js'], [SRC, '02-log.js'], [SRC, '05-model.js'], [SRC, '06-extract.js'], [SRC, '07-match.js'],
  [EXT, '11-net-bg.js'], [EXT, '10-store-bg.js'], [SRC, '08-sources.js'], [EXT, '12-alerts-bg.js'], [EXT, '99-background.js']
];

fs.writeFileSync(path.join(root, 'dist', 'content.readable.js'), HEADER + `(function(){\n'use strict';\n${bundle(CONTENT)}\nMain.init();\n})();\n`);
fs.writeFileSync(path.join(root, 'dist', 'background.readable.js'), HEADER + `(function(){\n'use strict';\n${bundle(BACKGROUND)}\n})();\n`);
fs.writeFileSync(path.join(root, 'dist', 'content.test.js'), `(function(){\n'use strict';\n${bundle(CONTENT)}\nreturn {Ext,CreditGuard,U,Log,Model,Extract,Match,Store,Net,Sources,Analysis,App,Alerts,Exporter,UI,Main};\n})()`);
fs.writeFileSync(path.join(root, 'dist', 'background.test.js'), `(function(){\n'use strict';\n${bundle(BACKGROUND.slice(0, -1))}\nreturn {Ext,U,Log,Model,Net,Sources,StoreBG,AlertsBG};\n})()`);

// Minified/mangled build — this is what the manifests load by default. See docs/ANTI_TAMPER_FA.md for what this
// does and does not protect against.
const { minify } = await import('terser');
for (const [src, out] of [['content.readable.js', 'content.js'], ['background.readable.js', 'background.js']]) {
  const code = fs.readFileSync(path.join(root, 'dist', src), 'utf8');
  const r = await minify(code, { mangle: { reserved: ['Ext', 'CreditGuard', 'U', 'Log', 'Model', 'Extract', 'Match', 'Store', 'StoreBG', 'Net', 'Sources', 'Analysis', 'App', 'Alerts', 'AlertsBG', 'Exporter', 'UI', 'Main', 'browser', 'chrome'] }, compress: true, format: { comments: false, preamble: HEADER } });
  if (r.error) throw r.error;
  fs.writeFileSync(path.join(root, 'dist', out), r.code);
}

// Per-browser "Load unpacked" folders — both Chrome and Firefox require the manifest file to be named exactly manifest.json.
for (const b of ['chrome', 'firefox']) {
  const dir = path.join(root, 'build', b); fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(root, `manifest.${b}.json`), path.join(dir, 'manifest.json'));
  for (const f of ['content.js', 'background.js']) fs.copyFileSync(path.join(root, 'dist', f), path.join(dir, f));
  for (const f of ['popup.html', 'popup.js', 'LICENSE_FA.md']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
  fs.copyFileSync(path.join(root, 'docs', 'ANTI_TAMPER_FA.md'), path.join(dir, 'ANTI_TAMPER_FA.md'));
  fs.cpSync(path.join(root, 'icons'), path.join(dir, 'icons'), { recursive: true });
}
console.log('bundled content(' + CONTENT.length + ') + background(' + BACKGROUND.length + ') files, minified, build/chrome + build/firefox ready to load unpacked');


