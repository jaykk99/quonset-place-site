#!/usr/bin/env node
/*
 * Site health checks for quonset-place-site.
 * Zero dependencies. Run: node tests/site-check.js   (or: npm test)
 * Exit 0 = all green, exit 1 = failures listed below.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://quonset-place.onrender.com';
const EXPECTED_EMAIL = 'thequonsetplace@hotmail.com';

const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

// --- 1. Every page: core head tags -----------------------------------------
pages.forEach(page => {
  const html = read(page);
  ok(/<html[^>]*lang="en"/.test(html), `${page}: <html lang="en">`);
  ok(/<title>[^<]{10,}<\/title>/.test(html), `${page}: <title> present and non-trivial`);
  ok(/<meta name="description" content="[^"]{40,}"/.test(html), `${page}: meta description >= 40 chars`);
  ok(html.includes(`<link rel="canonical" href="${SITE}/`),
    `${page}: canonical absolute URL under ${SITE}/`);
  ok(html.includes('<meta property="og:url"'), `${page}: og:url`);
  ok(html.includes('<meta property="og:title"'), `${page}: og:title`);
  ok(html.includes('<meta property="og:description"'), `${page}: og:description`);
  ok(html.includes('<meta property="og:image"'), `${page}: og:image`);
  ok(html.includes('<meta name="twitter:card"'), `${page}: twitter:card`);
  ok(html.includes('<link rel="icon"'), `${page}: favicon`);
  ok(html.includes('<a class="skip"'), `${page}: skip link (a11y)`);
  ok(/<nav[^>]*id="nav"/.test(html), `${page}: nav#nav present`);
  ok(/<footer/.test(html), `${page}: footer present`);
});

// --- 2. JSON-LD blocks parse ----------------------------------------------
pages.forEach(page => {
  const html = read(page);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  blocks.forEach((m, i) => {
    try { JSON.parse(m[1]); }
    catch (e) { failures.push(`${page}: JSON-LD block ${i} does not parse: ${e.message}`); }
  });
});

// --- 3. Internal links + anchors resolve ----------------------------------
const idsByPage = {};
pages.forEach(page => {
  const html = read(page);
  idsByPage[page] = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
});
pages.forEach(page => {
  const html = read(page);
  const hrefs = [...html.matchAll(/ (?:href|src)="([^"]+)"/g)].map(m => m[1]);
  hrefs.forEach(href => {
    if (/^(https?:|mailto:|tel:|sms:|data:|#)/.test(href)) {
      if (href.startsWith('#')) {
        const id = href.slice(1);
        if (id) ok(idsByPage[page].has(id), `${page}: anchor #${id} has no matching id on page`);
      }
      return;
    }
    // relative link: file#anchor?
    const [file, anchor] = href.split('#');
    const target = path.normalize(path.join(ROOT, file || page));
    ok(target.startsWith(ROOT), `${page}: link "${href}" escapes site root`);
    ok(fs.existsSync(target), `${page}: link "${href}" target does not exist`);
    if (anchor && fs.existsSync(target)) {
      const targetPage = path.basename(file || page);
      if (idsByPage[targetPage]) {
        ok(idsByPage[targetPage].has(anchor), `${page}: link "${href}" anchor #${anchor} missing in ${targetPage}`);
      }
    }
  });
});

// --- 4. Images: every referenced image file exists and is a real JPEG -----
pages.forEach(page => {
  const html = read(page);
  const imgs = [...html.matchAll(/<(?:img|link)[^>]*(?:src|href)="([^"]+\.(?:jpe?g|png|webp|gif|svg))"/g)].map(m => m[1]);
  imgs.forEach(src => {
    const p = path.join(ROOT, src);
    ok(fs.existsSync(p), `${page}: image "${src}" missing`);
    if (fs.existsSync(p) && /\.(jpe?g)$/i.test(src)) {
      const head = fs.readFileSync(p).slice(0, 3);
      ok(head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF,
        `${page}: image "${src}" is not a valid JPEG`);
    }
  });
});

// --- 5. sitemap.xml covers exactly the public pages -------------------------
{
  const sm = read('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const publicPages = pages.filter(p => p !== '404.html');
  ok(locs.length === publicPages.length,
    `sitemap: lists ${locs.length} urls, site has ${publicPages.length} public pages`);
  publicPages.forEach(page => {
    const expected = page === 'index.html' ? `${SITE}/` : `${SITE}/${page}`;
    ok(locs.includes(expected), `sitemap: missing ${expected}`);
  });
  pages.forEach(page => {
    if (page === '404.html') return;
    const html = read(page);
    const m = html.match(/<link rel="canonical" href="([^"]+)"/);
    ok(m && locs.includes(m[1]), `${page}: canonical ${m && m[1]} not in sitemap`);
  });
}

// --- 6. robots.txt -----------------------------------------------------------
{
  const robots = read('robots.txt');
  ok(/^User-agent: \*/m.test(robots), 'robots.txt: User-agent: *');
  ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt: sitemap line');
}

// --- 7. No placeholder contact details ---------------------------------------
{
  const all = pages.map(read).join('\n');
  ok(!/204-555-\d{4}/.test(all), 'no 204-555-xxxx placeholder phone numbers');
  ok(!/555-01\d\d/.test(all), 'no 555-01xx placeholder numbers');
  ok(!/example\.com/.test(all), 'no example.com placeholders');
  ok(all.includes(EXPECTED_EMAIL), `site mentions ${EXPECTED_EMAIL}`);
  const mailtos = [...all.matchAll(/mailto:([^"?]+)/g)].map(m => m[1]);
  mailtos.forEach(m => ok(m === EXPECTED_EMAIL, `mailto:${m} should be ${EXPECTED_EMAIL}`));
}

// --- 8. Nav consistency across pages -----------------------------------------
{
  const navHrefs = pages.map(page => {
    const html = read(page);
    const nav = (html.match(/<div class="nav-links" id="navLinks">([\s\S]*?)<\/div>/) || [])[1] || '';
    return [...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  });
  // normalize index anchors: index.html#x and #x point at the same place
  const norm = h => h.replace(/^index\.html/, '');
  const base = navHrefs[0].map(norm).sort().join('|');
  pages.forEach((page, i) => {
    const cur = navHrefs[i].map(norm).sort().join('|');
    ok(cur === base, `${page}: nav links differ from ${pages[0]} (got: ${navHrefs[i].join(', ')})`);
  });
}

// --- 9. 404 page is noindex ---------------------------------------------------
{
  const html = read('404.html');
  ok(/<meta name="robots" content="noindex/.test(html), '404.html: noindex robots meta');
}

// --- 10. Shared JS parses -----------------------------------------------------
{
  const { execSync } = require('child_process');
  try {
    ['site.js', 'shop.js'].forEach(f => execSync('node --check ' + path.join(ROOT, 'assets', f), { stdio: 'pipe' }));
  } catch (e) {
    failures.push('assets/site.js: syntax check failed');
  }
}

// --- report ------------------------------------------------------------------
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s)\n`);
  failures.forEach(f => console.log(' - ' + f));
  process.exit(1);
}
console.log(`OK: all site checks passed (${pages.length} pages: ${pages.join(', ')})`);
