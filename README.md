# Quonset Place

Live: **https://jaykk99.github.io/quonset-place-site/**

Business website for **Quonset Place**, custom metal Quonset steel buildings in Manitoba. Garages, workshops, barns and storage, built full-service or as DIY kits. Quote requests go to thequonsetplace@hotmail.com or by phone at 204-972-0325.

## Stack

Plain static HTML/CSS/JS. Shared stylesheet in `assets/styles.css`, shared nav/reveal JS in `assets/site.js`, page-specific scripts inline. Local images in `assets/`, including a generated `og-image.jpg` (1200x630) for social cards. No build step.

## Pages

- `index.html` — home: hero, services, uses, why Quonsets, process, service areas, gallery, FAQ, jobs, quote form
- `builds.html` — building styles, common sizes, options, foundations
- `404.html` — not-found page (noindex)

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Deployed via GitHub Pages on pushes to `main`.
