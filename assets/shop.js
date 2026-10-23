/*
 * Quonset Place shop: kit packages + configurator + order request.
 *
 * JAY: every price on the shop page comes from PRICING below.
 * Change a number here and the whole page updates. All figures are CAD,
 * before GST/PST, foundation not included. Shown to customers as an
 * estimated range; the final price is confirmed in writing before any deposit.
 */
const PRICING = {
  // kit shell cost per sq ft of floor area, [low, high]
  style: {
    arch:     { name: 'Full Arch',       perSqft: [22, 30] },
    straight: { name: 'Straight-Wall',   perSqft: [27, 36] },
    high:     { name: 'High-Clearance',  perSqft: [32, 42] }
  },
  smallBuildingSqft: 800,        // under this size, steel costs more per sq ft
  smallBuildingFactor: 1.2,
  endwall:      [1800, 3500],    // each steel endwall
  overheadDoor: [3000, 5500],    // each overhead door, framed in
  manDoor:      [600, 1100],     // each steel man door
  skylight:     [250, 450],      // each skylight panel
  vents:        [600, 1200],     // ridge vent / louver package
  insulation:   [5, 9],          // per sq ft of floor, spray foam on the shell
  delivery:     { perSqft: [1, 2.5], min: 600 },  // base delivery cost (Manitoba)
  // delivery multiplier by province, from our Winnipeg base
  regions: {
    MB: { name: 'Manitoba', mult: 1 },
    SK: { name: 'Saskatchewan', mult: 1.4 },
    ON: { name: 'Ontario', mult: 1.8 },
    AB: { name: 'Alberta', mult: 1.9 },
    BC: { name: 'British Columbia', mult: 2.6 },
    QC: { name: 'Quebec', mult: 2.4 },
    NB: { name: 'New Brunswick', mult: 2.9 },
    NS: { name: 'Nova Scotia', mult: 3.1 },
    PE: { name: 'Prince Edward Island', mult: 3.2 },
    NL: { name: 'Newfoundland and Labrador', mult: 3.8 },
    YT: { name: 'Yukon', mult: 3.8 },
    NT: { name: 'Northwest Territories', mult: 4.2 },
    NU: { name: 'Nunavut', mult: 6 }
  },
  install:      { perSqft: [7, 14], min: 4000 }   // crew erection
};

// Ready-to-order packages. Prices are computed from PRICING so they never drift.
const PACKAGES = [
  { id: 'garage', img: 'hero.jpg', pos: '70% 60%',  name: 'The Garage',       tag: 'Two-car garage',        w: 20, l: 30, style: 'arch',     endwalls: 2, oh: 1, man: 1, sky: 0, vents: false, insul: false },
  { id: 'shop', img: 'interior.jpg', pos: '50% 50%',    name: 'The Workshop',     tag: 'Shop + storage',         w: 24, l: 40, style: 'straight', endwalls: 2, oh: 1, man: 1, sky: 2, vents: true,  insul: false },
  { id: 'farm', img: 'build.jpg', pos: '80% 50%',    name: 'The Farm Shop',    tag: 'Equipment + work bay',   w: 30, l: 50, style: 'straight', endwalls: 2, oh: 2, man: 1, sky: 2, vents: true,  insul: false },
  { id: 'machine', img: 'hero.jpg', pos: '40% 55%', name: 'The Machine Shed', tag: 'Combines, trucks, hay',  w: 40, l: 60, style: 'arch',     endwalls: 2, oh: 1, man: 1, sky: 4, vents: true,  insul: false },
  { id: 'big', img: 'interior.jpg', pos: '30% 40%',     name: 'The Big Shop',     tag: 'Commercial / warehouse', w: 50, l: 80, style: 'high',     endwalls: 2, oh: 2, man: 2, sky: 6, vents: true,  insul: false }
];

const WIDTHS = [20, 24, 30, 40, 50, 60];
const LENGTHS = { 20: [20, 60], 24: [24, 80], 30: [30, 100], 40: [40, 120], 50: [50, 150], 60: [60, 200] };

function estimate(c, delivery) {
  const reg = PRICING.regions[c.region || 'MB'] || PRICING.regions.MB;
  const sqft = c.w * c.l;
  const s = PRICING.style[c.style];
  const f = sqft < PRICING.smallBuildingSqft ? PRICING.smallBuildingFactor : 1;
  const add = (r, n) => [r[0] * n, r[1] * n];
  const sum = (...rs) => rs.reduce((a, r) => [a[0] + r[0], a[1] + r[1]], [0, 0]);
  const shell = [s.perSqft[0] * sqft * f, s.perSqft[1] * sqft * f];
  const kit = sum(
    shell,
    add(PRICING.endwall, c.endwalls),
    add(PRICING.overheadDoor, c.endwalls ? c.oh : 0),
    add(PRICING.manDoor, c.endwalls ? c.man : 0),
    add(PRICING.skylight, c.sky),
    c.vents ? PRICING.vents : [0, 0],
    c.insul ? add(PRICING.insulation, sqft) : [0, 0]
  );
  let extra = [0, 0], extraLabel = '';
  if (delivery !== 'install') {
    extra = PRICING.delivery.perSqft.map(p => Math.max(PRICING.delivery.min, p * sqft) * reg.mult);
    extraLabel = 'Delivery to ' + reg.name;
  } else if (delivery === 'install') {
    const d = PRICING.delivery.perSqft.map(p => Math.max(PRICING.delivery.min, p * sqft) * reg.mult);
    const i = PRICING.install.perSqft.map(p => Math.max(PRICING.install.min, p * sqft));
    extra = sum(d, i);
    extraLabel = 'Delivery to ' + reg.name + ' + install';
  }
  return { sqft, kit, extra, extraLabel, total: sum(kit, extra) };
}

const round = n => Math.round(n / 100) * 100;
const money = n => '$' + round(n).toLocaleString('en-CA');
const range = r => money(r[0]) + ' – ' + money(r[1]);

/* ---------- door layout (shared with the 3D model) ----------
 * Places overhead and man doors where they physically fit:
 * endwalls first (alternating front/back), then the sidewalls of
 * straight-wall and high-clearance buildings. Doors shrink to fit under
 * the arch; anything that still doesn't fit is dropped and reported.
 */
function doorLayout(c) {
  // overhead doors take the front walls first; drop overhead doors only if
  // that's what it takes to keep the man doors the customer asked for
  for (let k = c.oh; k >= 0; k--) {
    const r = layoutOnce({ ...c, oh: k });
    if (r.fitMan >= c.man) return r;
  }
  return layoutOnce(c);
}
function layoutOnce(c) {
  const half = c.w / 2;
  const wall = c.style === 'arch' ? 0 : c.style === 'straight' ? 10 : 16;
  const rise = c.style === 'arch' ? half : Math.max(8, c.w * 0.3);
  const heightAt = x => wall + rise * Math.sqrt(Math.max(0, 1 - (x / half) ** 2));
  const GAP = 2, EDGE = 2;
  const ohW = c.w >= 40 ? 14 : c.w >= 30 ? 12 : 10;
  const ohH = Math.min(14, wall + rise - 2);   // trimmed per door to clear the arch
  const ends = c.endwalls === 2 ? ['front', 'back'] : c.endwalls === 1 ? ['front'] : [];
  const walls = { front: [], back: [] };
  const side = [];
  const sideOK = wall >= 10 && c.endwalls > 0;
  const sideLen = c.l - 8;

  // lay out a list of openings centered on an endwall; returns positioned list or null
  function fit(list) {
    if (!list.length) return [];
    const total = list.reduce((a, o) => a + o.w, 0) + GAP * (list.length - 1);
    if (total > c.w - EDGE * 2) return null;
    let x = -total / 2;
    const out = [];
    for (const o of list) {
      const cx = x + o.w / 2;
      const clear = Math.min(heightAt(Math.abs(cx) - o.w / 2 < 0 ? 0 : Math.abs(cx) - o.w / 2), heightAt(Math.abs(cx) + o.w / 2)) - 1;
      const h = Math.min(o.h, clear);
      if (h < o.min) return null;
      out.push({ ...o, x: cx, h });
      x += o.w + GAP;
    }
    // matching heights for doors of the same kind on one wall
    ['oh', 'man'].forEach(k => {
      const hs = out.filter(o => o.kind === k).map(o => o.h);
      if (hs.length) { const m = Math.min(...hs); out.forEach(o => { if (o.kind === k) o.h = m; }); }
    });
    return out;
  }
  function sideFits(list) {
    const total = list.reduce((a, o) => a + o.w, 0) + 4 * (list.length - 1);
    return total <= sideLen;
  }
  // big doors in the middle, man doors to the outside
  const order = l => [...l.filter(o => o.kind === 'man').slice(0, Math.ceil(l.filter(o => o.kind === 'man').length / 2)),
                      ...l.filter(o => o.kind === 'oh'),
                      ...l.filter(o => o.kind === 'man').slice(Math.ceil(l.filter(o => o.kind === 'man').length / 2))];
  const raw = { front: [], back: [] };
  let placedOH = 0, placedMan = 0;

  function place(o) {
    // try each endwall, least-loaded first
    // man doors go beside the front overhead door when they fit; overhead doors spread across ends
    const tries = o.kind === 'man' ? ends.slice() : ends.slice().sort((a, b) => raw[a].length - raw[b].length);
    for (const e of tries) {
      const next = order([...raw[e], o]);
      const f = fit(next);
      if (f) { raw[e] = next; walls[e] = f; return true; }
    }
    if (sideOK) {
      const sh = o.kind === 'oh' ? Math.min(o.h, wall - 1) : Math.min(7, wall - 1);
      const so = { ...o, h: sh };
      if (sideFits([...side, so])) { side.push(so); return true; }
    }
    return false;
  }
  for (let i = 0; i < c.oh; i++) if (place({ kind: 'oh', w: ohW, h: ohH, min: 7 })) placedOH++; else break;
  for (let i = 0; i < c.man; i++) if (place({ kind: 'man', w: 3, h: 7, min: 6.8 })) placedMan++; else break;

  // spread sidewall doors evenly along the length
  const sTotal = side.reduce((a, o) => a + o.w, 0);
  const sGap = side.length ? (c.l - sTotal) / (side.length + 1) : 0;
  let z = -c.l / 2 + sGap;
  side.forEach(o => { o.z = z + o.w / 2; z += o.w + sGap; });
  return { walls, side, fitOH: placedOH, fitMan: placedMan };
}
window.qpDoorLayout = doorLayout;

/* ---------- packages ---------- */
const pkgGrid = document.getElementById('pkgGrid');
PACKAGES.forEach((p, i) => {
  const kit = estimate(p, 'deliver').total;
  const inst = estimate(p, 'install').total;
  const el = document.createElement('article');
  el.className = 'pkg reveal' + (i % 3 ? ' d' + (i % 3) : '');
  el.innerHTML =
    '<figure class="pkg-img"><img id="pkgImg-' + p.id + '" src="assets/' + p.img + '" alt="Example of a ' + PRICING.style[p.style].name + ' steel Quonset" loading="lazy" decoding="async" width="1920" height="1280" style="object-position:' + p.pos + '"><figcaption>Example build</figcaption></figure>' +
    '<div class="pkg-top"><span class="pkg-tag">' + p.tag + '</span><span class="pkg-size">' + p.w + '&times;' + p.l + '</span></div>' +
    '<h3>' + p.name + '</h3>' +
    '<ul class="pkg-spec">' +
      '<li>' + PRICING.style[p.style].name + ' profile &middot; ' + (p.w * p.l).toLocaleString('en-CA') + ' sq ft</li>' +
      '<li>2 steel endwalls, ' + p.oh + ' overhead door' + (p.oh > 1 ? 's' : '') + ', ' + p.man + ' man door' + (p.man > 1 ? 's' : '') + '</li>' +
      (p.sky ? '<li>' + p.sky + ' skylight panels' + (p.vents ? ', ventilation' : '') + '</li>' : '<li>All hardware + instructions</li>') +
    '</ul>' +
    '<div class="pkg-price"><span>Kit delivered, est.</span><b>' + range(kit) + '</b></div>' +
    '<div class="pkg-price alt"><span>Installed, est.</span><b>' + range(inst) + '</b></div>' +
    '<button class="btn sm" type="button" data-pkg="' + p.id + '">Customize &amp; order</button>';
  pkgGrid.appendChild(el);
});
if (window.qpObserveReveals) window.qpObserveReveals(pkgGrid);
window.qpPackages = PACKAGES;
if (window.qp3d && window.qp3d.snapshots) window.qp3d.snapshots(PACKAGES);

/* ---------- configurator ---------- */
const $ = id => document.getElementById(id);
const cfg = { w: 30, l: 40, style: 'straight', endwalls: 2, oh: 1, man: 1, sky: 0, vents: false, insul: false, delivery: 'deliver', region: 'MB' };

const wSel = $('cWidth'), lIn = $('cLength'), lOut = $('cLengthOut'), rSel = $('cRegion');
Object.entries(PRICING.regions).forEach(([k, r]) => { const o = document.createElement('option'); o.value = k; o.textContent = r.name; rSel.appendChild(o); });
rSel.addEventListener('change', () => { cfg.region = rSel.value; render(); });
WIDTHS.forEach(w => { const o = document.createElement('option'); o.value = w; o.textContent = w + ' ft'; wSel.appendChild(o); });

function syncLengthBounds() {
  const [min, max] = LENGTHS[cfg.w];
  lIn.min = min; lIn.max = max; lIn.step = 2;
  cfg.l = Math.min(max, Math.max(min, cfg.l));
  lIn.value = cfg.l;
}

function setSeg(name, val) {
  document.querySelectorAll('[data-seg="' + name + '"] button').forEach(b => {
    const on = b.dataset.val === String(val);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function drawPreview() {
  window.qpCfg = cfg;
  if (window.qp3d) { window.qp3d.update(cfg); return; }
  // front elevation of the chosen profile, scaled to width
  const W = 300, H = 170, base = 150;
  const scale = 240 / 60;                    // 60 ft fills the frame
  const bw = cfg.w * scale, x0 = (W - bw) / 2, x1 = x0 + bw;
  const wall = cfg.style === 'arch' ? 0 : (cfg.style === 'straight' ? 10 : 16) * scale * 0.55;
  const rise = cfg.style === 'arch' ? bw / 2 : bw * 0.32;
  const top = base - wall - rise;
  const path = 'M' + x0 + ' ' + base + ' L' + x0 + ' ' + (base - wall) +
    ' Q' + x0 + ' ' + top + ' ' + (W / 2) + ' ' + top +
    ' Q' + x1 + ' ' + top + ' ' + x1 + ' ' + (base - wall) + ' L' + x1 + ' ' + base + ' Z';
  let doors = '';
  if (cfg.endwalls) {
    const dw = Math.min(12 * scale, bw * 0.38), dh = Math.min(12 * scale, (base - top) * 0.62);
    if (cfg.oh) doors += '<rect x="' + (W / 2 - dw / 2) + '" y="' + (base - dh) + '" width="' + dw + '" height="' + dh + '" class="pv-door"/>';
    if (cfg.man) doors += '<rect x="' + (x0 + bw * 0.1) + '" y="' + (base - 7 * scale * 0.9) + '" width="' + (3 * scale) + '" height="' + (7 * scale * 0.9) + '" class="pv-man"/>';
  }
  $('preview').innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + PRICING.style[cfg.style].name + ' building, ' + cfg.w + ' feet wide">' +
    '<defs>' +
      '<linearGradient id="pvSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fbde6"/><stop offset="1" stop-color="#dcebf5"/></linearGradient>' +
      '<linearGradient id="pvSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d969d"/><stop offset=".35" stop-color="#e3e8eb"/><stop offset=".6" stop-color="#bcc4c9"/><stop offset="1" stop-color="#7e878e"/></linearGradient>' +
      '<pattern id="pvCorr" width="4" height="6" patternUnits="userSpaceOnUse"><rect width="2" height="6" fill="rgba(0,0,0,.10)"/></pattern>' +
      '<clipPath id="pvClip"><path d="' + path + '"/></clipPath>' +
    '</defs>' +
    '<rect width="' + W + '" height="' + base + '" fill="url(#pvSky)"/>' +
    '<rect y="' + base + '" width="' + W + '" height="' + (H - base) + '" fill="#6d8a4a"/>' +
    '<rect y="' + base + '" width="' + W + '" height="3" fill="#5a733c"/>' +
    '<path d="' + path + '" fill="url(#pvSteel)"' + (cfg.endwalls ? '' : ' fill-opacity=".55"') + ' stroke="#5f676d" stroke-width="1.2"/>' +
    '<rect x="' + x0 + '" y="' + top + '" width="' + bw + '" height="' + (base - top) + '" fill="url(#pvCorr)" clip-path="url(#pvClip)"/>' +
    doors +
    '<text x="' + (W / 2) + '" y="' + (base + 15) + '" class="pv-label">' + cfg.w + ' ft wide &times; ' + cfg.l + ' ft long</text>' +
    '</svg>';
}

function render() {
  // keep door counts to what physically fits this building
  const lay = doorLayout(cfg);
  const wantOH = cfg.oh, wantMan = cfg.man;
  if (cfg.endwalls) { cfg.oh = lay.fitOH; cfg.man = lay.fitMan; }
  const note = $('doorNote');
  if (note) {
    const capped = cfg.endwalls && (wantOH > cfg.oh || wantMan > cfg.man);
    note.hidden = !capped;
    if (capped) note.textContent = 'That is the most doors that fit this size' +
      (cfg.style === 'arch' ? '. Go wider, add the second endwall, or pick Straight-Wall to put doors on the sides.' : '. Go longer or wider for more.');
  }
  lOut.textContent = cfg.l + ' ft';
  $('cOH').textContent = cfg.oh; $('cMan').textContent = cfg.man; $('cSky').textContent = cfg.sky;
  document.querySelectorAll('.door-only').forEach(el => el.classList.toggle('disabled', !cfg.endwalls));
  const e = estimate(cfg, cfg.delivery);
  $('sumSize').textContent = cfg.w + ' × ' + cfg.l + ' ft (' + e.sqft.toLocaleString('en-CA') + ' sq ft)';
  $('sumStyle').textContent = PRICING.style[cfg.style].name;
  $('sumKit').textContent = range(e.kit);
  $('sumExtraLabel').textContent = e.extraLabel;
  $('sumExtra').textContent = e.extra[1] ? range(e.extra) : 'Included';
  $('sumTotal').textContent = range(e.total);
  $('sumPerSqft').textContent = '≈ $' + Math.round(e.total[0] / e.sqft) + '–$' + Math.round(e.total[1] / e.sqft) + ' per sq ft';
  drawPreview();
}

function load(c) {
  Object.assign(cfg, c);
  wSel.value = cfg.w;
  rSel.value = cfg.region;
  syncLengthBounds();
  setSeg('style', cfg.style); setSeg('endwalls', cfg.endwalls); setSeg('delivery', cfg.delivery);
  $('cVents').checked = cfg.vents; $('cInsul').checked = cfg.insul;
  render();
}

wSel.addEventListener('change', () => { cfg.w = +wSel.value; syncLengthBounds(); render(); });
lIn.addEventListener('input', () => { cfg.l = +lIn.value; render(); });
document.querySelectorAll('[data-seg] button').forEach(b => b.addEventListener('click', () => {
  const name = b.closest('[data-seg]').dataset.seg;
  cfg[name] = name === 'endwalls' ? +b.dataset.val : b.dataset.val;
  setSeg(name, cfg[name]); render();
}));
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
  const [key, d] = b.dataset.step.split(':');
  const max = { oh: 8, man: 4, sky: 12 }[key];
  cfg[key] = Math.max(0, Math.min(max, cfg[key] + +d)); render();
}));
$('cVents').addEventListener('change', e => { cfg.vents = e.target.checked; render(); });
$('cInsul').addEventListener('change', e => { cfg.insul = e.target.checked; render(); });

document.querySelectorAll('[data-pkg]').forEach(b => b.addEventListener('click', () => {
  const p = PACKAGES.find(x => x.id === b.dataset.pkg);
  load({ ...p, delivery: cfg.delivery, region: cfg.region });
  $('configure').scrollIntoView({ behavior: 'smooth' });
}));

load(cfg);

/* ---------- order request ---------- */
const form = $('orderForm'), btn = $('orderBtn');
function check(el) {
  const v = (el.value || '').trim();
  let ok = true;
  if (el.id === 'oName') ok = v.length >= 2;
  if (el.id === 'oPhone') ok = (v.match(/\d/g) || []).length >= 7;
  if (el.id === 'oEmail') ok = v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (el.id === 'oLoc') ok = v.length >= 2;
  el.closest('.field').classList.toggle('invalid', !ok);
  el.setAttribute('aria-invalid', String(!ok));
  return ok;
}
const req = ['oName', 'oPhone', 'oEmail', 'oLoc'].map($);
req.forEach(el => el.addEventListener('input', () => check(el)));

function orderLines() {
  const f = new FormData(form);
  const e = estimate(cfg, cfg.delivery);
  return {
    f, e,
    lines: [
      'ORDER REQUEST',
      '',
      'Building: ' + PRICING.style[cfg.style].name + ', ' + cfg.w + ' x ' + cfg.l + ' ft (' + e.sqft + ' sq ft)',
      'Endwalls: ' + (cfg.endwalls === 0 ? 'Open ends' : cfg.endwalls),
      'Overhead doors: ' + (cfg.endwalls ? cfg.oh : 0) + '   Man doors: ' + (cfg.endwalls ? cfg.man : 0),
      'Skylights: ' + cfg.sky + '   Ventilation: ' + (cfg.vents ? 'Yes' : 'No') + '   Insulation: ' + (cfg.insul ? 'Yes' : 'No'),
      'Deliver to: ' + PRICING.regions[cfg.region].name,
      'Fulfilment: ' + e.extraLabel,
      'Website estimate: ' + range(e.total) + ' + tax',
      '',
      'Name: ' + (f.get('name') || '').trim(),
      'Phone: ' + (f.get('phone') || '').trim(),
      'Email: ' + ((f.get('email') || '').trim() || '-'),
      'Site location: ' + (f.get('location') || '').trim(),
      'Foundation: ' + f.get('foundation'),
      'Timeline: ' + f.get('timeline'),
      'Notes: ' + ((f.get('notes') || '').trim() || '-')
    ]
  };
}

form.addEventListener('submit', async ev => {
  ev.preventDefault();
  if (new FormData(form).get('company')) return;
  const allOk = req.map(check).every(Boolean);
  if (!allOk) { $('orderOk').style.display = 'none'; return; }
  const { f, lines } = orderLines();
  btn.disabled = true; btn.textContent = 'Sending...';
  const how = await window.qpSend(
    'Order Request - ' + cfg.w + 'x' + cfg.l + ' ' + PRICING.style[cfg.style].name + ' to ' + PRICING.regions[cfg.region].name,
    lines,
    { name: (f.get('name') || '').trim(), phone: (f.get('phone') || '').trim(), email: (f.get('email') || '').trim() || undefined }
  );
  const ok = $('orderOk');
  ok.textContent = how === 'sent'
    ? 'Order sent. We will call or email you with a firm price, usually within one business day.'
    : 'Your email app should open with the order filled in. Hit send, or use Text it instead.';
  ok.style.display = 'block';
  ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
  btn.disabled = false; btn.textContent = 'Send Order Request';
  if (how === 'sent') form.reset();
});

$('orderSms').addEventListener('click', ev => {
  const { lines } = orderLines();
  ev.currentTarget.href = window.qpSmsLink(lines.filter(Boolean).join('\n'));
});
