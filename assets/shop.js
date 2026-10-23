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
  delivery:     { perSqft: [1, 2.5], min: 600 },  // Manitoba delivery
  install:      { perSqft: [7, 14], min: 4000 }   // crew erection
};

// Ready-to-order packages. Prices are computed from PRICING so they never drift.
const PACKAGES = [
  { id: 'garage',  name: 'The Garage',       tag: 'Two-car garage',        w: 20, l: 30, style: 'arch',     endwalls: 2, oh: 1, man: 1, sky: 0, vents: false, insul: false },
  { id: 'shop',    name: 'The Workshop',     tag: 'Shop + storage',         w: 24, l: 40, style: 'straight', endwalls: 2, oh: 1, man: 1, sky: 2, vents: true,  insul: false },
  { id: 'farm',    name: 'The Farm Shop',    tag: 'Equipment + work bay',   w: 30, l: 50, style: 'straight', endwalls: 2, oh: 2, man: 1, sky: 2, vents: true,  insul: false },
  { id: 'machine', name: 'The Machine Shed', tag: 'Combines, trucks, hay',  w: 40, l: 60, style: 'arch',     endwalls: 2, oh: 1, man: 1, sky: 4, vents: true,  insul: false },
  { id: 'big',     name: 'The Big Shop',     tag: 'Commercial / warehouse', w: 50, l: 80, style: 'high',     endwalls: 2, oh: 2, man: 2, sky: 6, vents: true,  insul: false }
];

const WIDTHS = [20, 24, 30, 40, 50, 60];
const LENGTHS = { 20: [20, 60], 24: [24, 80], 30: [30, 100], 40: [40, 120], 50: [50, 150], 60: [60, 200] };

function estimate(c, delivery) {
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
  let extra = [0, 0], extraLabel = 'Pickup in Winnipeg';
  if (delivery === 'deliver') {
    extra = PRICING.delivery.perSqft.map(p => Math.max(PRICING.delivery.min, p * sqft));
    extraLabel = 'Delivery in Manitoba';
  } else if (delivery === 'install') {
    const d = PRICING.delivery.perSqft.map(p => Math.max(PRICING.delivery.min, p * sqft));
    const i = PRICING.install.perSqft.map(p => Math.max(PRICING.install.min, p * sqft));
    extra = sum(d, i);
    extraLabel = 'Delivery + crew install';
  }
  return { sqft, kit, extra, extraLabel, total: sum(kit, extra) };
}

const round = n => Math.round(n / 100) * 100;
const money = n => '$' + round(n).toLocaleString('en-CA');
const range = r => money(r[0]) + ' – ' + money(r[1]);

/* ---------- packages ---------- */
const pkgGrid = document.getElementById('pkgGrid');
PACKAGES.forEach((p, i) => {
  const kit = estimate(p, 'pickup').total;
  const inst = estimate(p, 'install').total;
  const el = document.createElement('article');
  el.className = 'pkg reveal' + (i % 3 ? ' d' + (i % 3) : '');
  el.innerHTML =
    '<div class="pkg-top"><span class="pkg-tag">' + p.tag + '</span><span class="pkg-size">' + p.w + '&times;' + p.l + '</span></div>' +
    '<h3>' + p.name + '</h3>' +
    '<ul class="pkg-spec">' +
      '<li>' + PRICING.style[p.style].name + ' profile &middot; ' + (p.w * p.l).toLocaleString('en-CA') + ' sq ft</li>' +
      '<li>2 steel endwalls, ' + p.oh + ' overhead door' + (p.oh > 1 ? 's' : '') + ', ' + p.man + ' man door' + (p.man > 1 ? 's' : '') + '</li>' +
      (p.sky ? '<li>' + p.sky + ' skylight panels' + (p.vents ? ', ventilation' : '') + '</li>' : '<li>All hardware + instructions</li>') +
    '</ul>' +
    '<div class="pkg-price"><span>Kit, est.</span><b>' + range(kit) + '</b></div>' +
    '<div class="pkg-price alt"><span>Installed, est.</span><b>' + range(inst) + '</b></div>' +
    '<button class="btn sm" type="button" data-pkg="' + p.id + '">Customize &amp; order</button>';
  pkgGrid.appendChild(el);
});
if (window.qpObserveReveals) window.qpObserveReveals(pkgGrid);

/* ---------- configurator ---------- */
const $ = id => document.getElementById(id);
const cfg = { w: 30, l: 40, style: 'straight', endwalls: 2, oh: 1, man: 1, sky: 0, vents: false, insul: false, delivery: 'deliver' };

const wSel = $('cWidth'), lIn = $('cLength'), lOut = $('cLengthOut');
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
  const ribs = [];
  for (let i = 1; i < 6; i++) {
    const t = i / 6, x = x0 + bw * t;
    ribs.push('<line x1="' + x + '" y1="' + base + '" x2="' + x + '" y2="' + (base - 4) + '" class="pv-rib"/>');
  }
  $('preview').innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + PRICING.style[cfg.style].name + ' building, ' + cfg.w + ' feet wide">' +
    '<line x1="10" y1="' + base + '" x2="' + (W - 10) + '" y2="' + base + '" class="pv-ground"/>' +
    '<path d="' + path + '" class="pv-shell' + (cfg.endwalls ? '' : ' open') + '"/>' + doors + ribs.join('') +
    '<text x="' + (W / 2) + '" y="' + (base + 16) + '" class="pv-label">' + cfg.w + ' ft wide &times; ' + cfg.l + ' ft long</text>' +
    '</svg>';
}

function render() {
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
  const max = { oh: 4, man: 4, sky: 12 }[key];
  cfg[key] = Math.max(0, Math.min(max, cfg[key] + +d)); render();
}));
$('cVents').addEventListener('change', e => { cfg.vents = e.target.checked; render(); });
$('cInsul').addEventListener('change', e => { cfg.insul = e.target.checked; render(); });

document.querySelectorAll('[data-pkg]').forEach(b => b.addEventListener('click', () => {
  const p = PACKAGES.find(x => x.id === b.dataset.pkg);
  load({ ...p, delivery: cfg.delivery });
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

form.addEventListener('submit', ev => {
  ev.preventDefault();
  const f = new FormData(form);
  if (f.get('company')) return;
  const allOk = req.map(check).every(Boolean);
  if (!allOk) { $('orderOk').style.display = 'none'; return; }
  const e = estimate(cfg, cfg.delivery);
  const lines = [
    'ORDER REQUEST',
    '',
    'Building: ' + PRICING.style[cfg.style].name + ', ' + cfg.w + ' x ' + cfg.l + ' ft (' + e.sqft + ' sq ft)',
    'Endwalls: ' + (cfg.endwalls === 0 ? 'Open ends' : cfg.endwalls),
    'Overhead doors: ' + (cfg.endwalls ? cfg.oh : 0) + '   Man doors: ' + (cfg.endwalls ? cfg.man : 0),
    'Skylights: ' + cfg.sky + '   Ventilation: ' + (cfg.vents ? 'Yes' : 'No') + '   Insulation: ' + (cfg.insul ? 'Yes' : 'No'),
    'Fulfilment: ' + e.extraLabel,
    'Website estimate: ' + range(e.total) + ' + tax',
    '',
    'Name: ' + f.get('name').trim(),
    'Phone: ' + f.get('phone').trim(),
    'Email: ' + ((f.get('email') || '').trim() || '-'),
    'Site location: ' + f.get('location').trim(),
    'Foundation: ' + f.get('foundation'),
    'Timeline: ' + f.get('timeline'),
    'Notes: ' + ((f.get('notes') || '').trim() || '-')
  ];
  btn.disabled = true; btn.textContent = 'Opening your email...';
  location.href = 'mailto:thequonsetplace@hotmail.com?subject=' +
    encodeURIComponent('Order Request - ' + cfg.w + 'x' + cfg.l + ' ' + PRICING.style[cfg.style].name) +
    '&body=' + encodeURIComponent(lines.join('\n'));
  $('orderOk').style.display = 'block';
  setTimeout(() => { btn.disabled = false; btn.textContent = 'Send Order Request'; }, 2000);
});
