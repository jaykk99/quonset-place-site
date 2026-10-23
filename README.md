# Quonset Place

Live: **https://jaykk99.github.io/quonset-place-site/**

Business website for **Quonset Place**, custom metal Quonset steel buildings in Manitoba. Garages, workshops, barns and storage, built full-service or as DIY kits. Quote requests go to thequonsetplace@hotmail.com or by phone at 204-972-0325.

## Stack

Plain static HTML/CSS/JS. Shared stylesheet in `assets/styles.css`, shared nav/reveal JS in `assets/site.js`, page-specific scripts inline. Local images in `assets/`, including a generated `og-image.jpg` (1200x630) for social cards. No build step.

## Pages

- `index.html` — home: hero, services, uses, why Quonsets, process, service areas, gallery, FAQ, jobs, quote form
- `shop.html` — buy page: ready-to-order kit packages, live build & price configurator, order request (mailto, nothing charged online). **All prices live in the `PRICING` object at the top of `assets/shop.js`**. The builder's live 3D model is `assets/quonset3d.js` (three.js from jsDelivr, falls back to a flat drawing if WebGL is unavailable); it also renders the 3D pictures on the kit cards. Door placement (`doorLayout` in shop.js) caps doors at what physically fits. Forms send through FormSubmit to thequonsetplace@hotmail.com (falls back to mailto) and offer a "Text it instead" button
- `builds.html` — building styles, common sizes, options, foundations
- `compare.html` — honest Quonset vs pole barn vs wood-frame vs shipping container comparison, FAQ with FAQPage schema
- `jobs.html` — hiring page: crew worker ($25/hr) and quoter roles, how applying works
- `404.html` — not-found page (noindex), full site nav and footer

## Tests

Zero-dependency Node health check (`tests/site-check.js`, `npm test`):

- Every page has title, meta description, canonical, OG/Twitter tags, favicon, skip link, nav, footer
- JSON-LD blocks parse; internal links and anchors resolve; referenced images exist and are real JPEGs
- sitemap.xml covers exactly the public pages; robots.txt references the sitemap
- No placeholder contact details; all mailto links use thequonsetplace@hotmail.com
- Nav link sets are identical across pages; 404 is noindex; `assets/site.js` passes `node --check`

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Deployed via GitHub Pages on pushes to `main`.
