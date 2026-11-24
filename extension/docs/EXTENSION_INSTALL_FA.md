# نصب افزونه (Chrome / Firefox) — بدون Tampermonkey

## Chrome, Edge, Brave (و هر Chromium دیگر)
1. فایل `extension/releases/Takhfifsanj_15.2.33_Chrome.zip` را از مخزن دانلود و Extract کن. برای ساخت از سورس، در ریشهٔ مخزن `npm run build` را اجرا کن.
2. `chrome://extensions` را باز کن و **Developer mode** را روشن کن.
3. **Load unpacked** را بزن و پوشهٔ Extractشده‌ای را انتخاب کن که فایل `manifest.json` مستقیماً داخلش است؛ هنگام ساخت از سورس، همان `extension/build/chrome` را انتخاب کن. پوشهٔ `extension` یا ریشهٔ پروژه را انتخاب نکن.
4. صفحهٔ جزئیات افزونه باید نسخهٔ **15.2.33** را نشان دهد. اگر هنوز نسخهٔ قبلی را می‌بینی، Reload همان افزونه را بزن و صفحهٔ محصول را هم تازه‌سازی کن.
5. آیکون افزونه را به نوار ابزار پین کن. صفحهٔ یک محصول دیجی‌کالا را باز کن.

## Firefox
**نکتهٔ مهم و صادقانه:** Firefox برای نصب دائمی، افزونه را باید Mozilla امضا کند (حتی برای نصب شخصی و self-distributed، مگر از کانال Developer/Nightly استفاده کنی). دو راه داری:

- **نصب موقت (برای تست، در هر ری‌استارت Firefox باید دوباره بارگذاری شود):**
  1. `about:debugging#/runtime/this-firefox` را باز کن.
  2. **Load Temporary Add-on…** و فایل `manifest.json` داخل `extension/build/firefox` را انتخاب کن.
- **نصب دائمی (خودت امضا کن، رایگان):**
  1. حساب رایگان در https://addons.mozilla.org بساز.
  2. فایل `extension/releases/Takhfifsanj_15.2.33_Firefox.zip` را آپلود و امضا کن.
  3. در «Developer Hub» به‌صورت **Unlisted** آپلود و امضا کن؛ فایل `.xpi` امضاشده را دانلود و نصب کن. این بار دیگر دائمی می‌ماند.
  من این مرحله را برایت انجام نداده‌ام چون به حساب AMO شخص نیاز دارد و من از این محیط به آن سایت دسترسی ندارم.

## ساختار پوشهٔ تحویلی
دو پوشهٔ آمادهٔ نصب ساخته می‌شود: `extension/build/chrome` و `extension/build/firefox`. هرکدام مستقیماً `manifest.json` دارند و برای همان مرورگر مستقل‌اند. در Chrome، خود `extension/build/chrome` را انتخاب کن.

## چرا دو manifest جدا؟

## تفاوت با نسخهٔ Tampermonkey
- **هشدار قیمت واقعاً در پس‌زمینه کار می‌کند**، حتی اگر هیچ تب دیجی‌کالایی باز نباشد (با `chrome.alarms`؛ در Tampermonkey این محدودیت وجود داشت).
- دسترسی شبکه به میزبان‌های لازم برای ترب، دیجی‌کالا، ایمالز، باسلام و اسنپ‌شاپ محدود است (`host_permissions`)، دقیقاً مانند فهرست محدود `@connect` در نسخهٔ اسکریپت.
- کد توزیعی (`content.js`, `background.js`) فشرده/درهم‌سازی‌شده است؛ نسخهٔ خوانا در `content.readable.js`/`background.readable.js` و پوشه‌های `src/`+`ext-src/` است.
