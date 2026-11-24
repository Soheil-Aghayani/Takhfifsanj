# Takhfifsanj UI preferences

Check these preferences before making UI changes. The user's latest explicit correction takes precedence.

- In the top tab bar, inactive tabs show only their Solar icon. The active tab shows only its text label; hide its icon.
- Keep the five tabs in their existing order and evenly distributed. Give the active text enough room to remain readable without crowding the other tabs.
- Keep footer credit/link chips out of both the injected panel and the extension toolbar popup. Preserve legal attribution in the license and source metadata; do not restore website, RealMahdi_a, or GHAFEL_com links in the UI unless the user asks.
- Preserve previously removed UI elements and maintain visible spacing between cards and boxes.
- Keep diagnostics as a separate option inside Settings. Do not put a diagnostics button or dock in the tab header.
- Avoid duplicated code and keep icons consistent with the Solar icon family.
- Keep marketplace logos distinct for Torob, Emalls, Basalam, and SnappShop, with aligned sizing; do not replace them with a generic globe icon.
- Keep Black Friday labels and badges out of the product title and extension description.
- Use toggle switches for boolean settings. Group rejected product matches in a closed accordion; keep cards visibly separated.
- Preserve the Watchlist's named collections and per-collection Solar icon choice; keep its sections and product cards clearly spaced.
- Keep tab transitions smooth and morph-shaped without cloning old panel content or overlapping boxes.
- Keep cards and controls visibly separated; preserve the five evenly distributed tabs, showing only an icon on inactive tabs and only a readable text label on the active tab.
- For visible toman amounts, use the supplied local `toman` SVG icon instead of appending the word «تومان». Keep the word in explanatory prose and input labels when it provides context; keep amount labels accessible to screen readers.
- For editable toman prices, display Persian digits grouped every three digits. Use a text input with a numeric mobile keyboard instead of a native number input, so browser spinner arrows do not appear. Make save controls visibly show the Solar Check icon and give clear save feedback.
- Display product-match scores as a number and percent only; do not describe the heuristic as a probability or show a confidence label.
- Only show seller shipping or warranty chips when the source provides details; make each chip open its details. Never show a deduplication chip to shoppers.
- For Torob, reject explicit brand, product-type, model, or specification conflicts against the current page title before ranking alternatives. Require two-way title similarity when no model code is available.

## Product behavior and release requirements

- Keep visible amounts in toman paired with the supplied toman SVG; retain accessible labels and use «تومان» in explanatory prose or input labels where needed.
- Editable prices use Persian digits with three-digit grouping, text inputs with a numeric mobile keyboard, and clear Solar Check save feedback.
- Keep product matching strict: reject Torob brand, type, model, and spec conflicts; for products without model codes, require title similarity in both directions. Show match scores only as numeric percentages.
- Keep comparison cards in two rows: seller, price difference, and available delivery details with only a link icon on row one; marketplace, match score, and price with the toman icon on row two. Show shipping and warranty only when the source supplies them, with details available on click.
- Keep the requested header layout and remove the specified old-price, 30-day-low, source-label, and caveat text. Do not bring back “تطبیق مطمئن” or other removed controls.
- Settings must retain the Emalls logo, expanded SnappShop city choices, Persian alert interval, diagnostics option, About section, and icon-only contact links using `soheyl.aghayani@gmail.com` and `https://t.me/env_soh`.
- Price alerts must use a fresh response from a supported source. Never notify from `lastPrice` or another cached value after a live fetch fails. Continue adding cross-store live checks as source adapters become available.
- Add Tapsi Shop and Digikala Shop as separate providers, each with its own enable switch, distinct logo, and clear error state.
- Build a product-match quality loop: show the brand/model/variant used for a match, make wrong-product reporting easy, and retain correct/incorrect examples for regression checks. Keep examples local until the configured server endpoint is available; then upload only match-feedback fields needed to learn, not unrelated browsing history. Do not assume the referenced `api-anything` repository supplies a free API key; verify what it actually provides before use.
- Show delivery, warranty, stock, city, and checked-at time only when the marketplace provides those details. Never imply data the source did not return.
- Keep visual regression references for each of the five tabs and both panel sizes; inspect tab labels, card spacing, and overlap before release.
- Keep the requested roadmap active: compare different models, basket totals, shopping notes, after-purchase records, variant restock alerts, image search, unit/bundle calculations, accessory compatibility, Android barcode shopping, currency/metals pricing, review insights, return-policy explanations, checkout surprise detection, installment and loyalty calculations, voice shopping, seller history, and fake-urgency warnings.
- Every extension code update requires a version bump, Chrome and Firefox packages, a pushed GitHub commit, and a published GitHub release with both packages attached. Do not claim live-browser verification unless it was actually performed.
