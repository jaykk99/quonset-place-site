// 3D Quonset models for the shop page.
// - Live, spinnable model in the Build & Price tool (shop.js calls window.qp3d.update(cfg)).
// - Rendered 3D pictures of each ready-to-order kit for the package cards.
// Door placement comes from window.qpDoorLayout (shop.js) so the model, the
// price and the order always agree. Without WebGL or the three.js CDN, the page
// keeps its flat drawing and photos.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('preview');

// ---------- shared materials ----------
const corrugation = corrugationTexture();
const MAT = {
  steel: new THREE.MeshStandardMaterial({
    color: 0xdfe5e9, metalness: 0.35, roughness: 0.42,
    map: corrugation.map, bumpMap: corrugation.bump, bumpScale: 0.6, side: THREE.DoubleSide
  }),
  end: new THREE.MeshStandardMaterial({ color: 0xd2d8dc, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }),
  door: new THREE.MeshStandardMaterial({ color: 0xf1f3f5, metalness: 0.25, roughness: 0.5 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x3c4246, metalness: 0.4, roughness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.75, roughness: 0.2, side: THREE.DoubleSide }),
  pad: new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x6f8c45, roughness: 1 })
};

function makeRenderer(opts = {}) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, ...opts });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

// A scene with sky, sun, grass and a gravel pad; the building gets swapped in.
function makeStage() {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xcfe2ee, 250, 700);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b7a4a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-120, 160, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 500 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 64), MAT.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT.pad);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.05;
  pad.receiveShadow = true;
  scene.add(pad);
  let building = null;
  return {
    scene,
    set(cfg) {
      if (building) { scene.remove(building); disposeTree(building); }
      const b = makeBuilding(cfg);
      building = b.group;
      scene.add(building);
      pad.scale.set(cfg.w + 12, cfg.l + 16, 1);
      return b;
    }
  };
}

function disposeTree(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }

// ---------- the building ----------
function profile(cfg, n = 48) {
  const half = cfg.w / 2;
  const wall = cfg.style === 'arch' ? 0 : cfg.style === 'straight' ? 10 : 16;
  const rise = cfg.style === 'arch' ? half : Math.max(8, cfg.w * 0.3);
  const pts = [];
  if (wall) pts.push(new THREE.Vector2(-half, 0));
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push(new THREE.Vector2(half * Math.cos(a), wall + rise * Math.sin(a)));
  }
  if (wall) pts.push(new THREE.Vector2(half, 0));
  return { pts, wall, height: wall + rise };
}

function shellGeometry(pts, length) {
  const segZ = Math.max(8, Math.round(length / 2));
  const pos = [], uv = [], idx = [];
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + pts[i].distanceTo(pts[i - 1]));
  for (let j = 0; j <= segZ; j++) {
    const z = -length / 2 + (j / segZ) * length;
    for (let i = 0; i < pts.length; i++) {
      pos.push(pts[i].x, pts[i].y, z);
      uv.push(along[i] / 6, (z + length / 2) / 3);
    }
  }
  const row = pts.length;
  for (let j = 0; j < segZ; j++) for (let i = 0; i < row - 1; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function overheadDoor(w, h) {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), MAT.door);
  panel.position.y = h / 2;
  panel.castShadow = true;
  g.add(panel);
  const rows = Math.max(3, Math.round(h / 2.2));
  for (let r = 1; r < rows; r++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.1, 0.05), MAT.trim);
    line.position.set(0, (h / rows) * r, 0.18);
    g.add(line);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.45, 0.4), MAT.trim);
  head.position.y = h + 0.22;
  g.add(head);
  [-1, 1].forEach(s => {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.4), MAT.trim);
    jamb.position.set(s * (w / 2 + 0.2), h / 2, 0);
    g.add(jamb);
  });
  return g;
}

function manDoor(w, h) {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), MAT.door);
  panel.position.y = h / 2;
  g.add(panel);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.3, 0.2), MAT.trim);
  frame.position.set(0, (h + 0.3) / 2, -0.05);
  g.add(frame);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), MAT.trim);
  knob.position.set(w / 2 - 0.5, h * 0.48, 0.25);
  g.add(knob);
  return g;
}

function makeBuilding(cfg) {
  const group = new THREE.Group();
  const { pts, wall, height } = profile(cfg);
  const L = cfg.l, half = cfg.w / 2;

  const shell = new THREE.Mesh(shellGeometry(pts, L), MAT.steel);
  shell.castShadow = true; shell.receiveShadow = true;
  group.add(shell);

  [-L / 2, L / 2].forEach(z => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, p.y, z)));
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.35, 6), MAT.trim);
    rib.castShadow = true;
    group.add(rib);
  });
  [-half, half].forEach(x => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, L), MAT.trim);
    rail.position.set(x, 0.4, 0);
    group.add(rail);
  });

  // endwalls
  const shape = new THREE.Shape(pts);
  const ends = cfg.endwalls === 2 ? ['front', 'back'] : cfg.endwalls === 1 ? ['front'] : [];
  ends.forEach(e => {
    const z = e === 'front' ? L / 2 : -L / 2;
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), MAT.end);
    w.position.z = z;
    w.castShadow = true; w.receiveShadow = true;
    group.add(w);
  });

  // doors, placed by the shared layout so nothing overlaps or pokes through the arch
  const lay = window.qpDoorLayout ? window.qpDoorLayout(cfg) : { walls: { front: [], back: [] }, side: [] };
  ends.forEach(e => {
    const front = e === 'front';
    const z = front ? L / 2 + 0.16 : -L / 2 - 0.16;
    (lay.walls[e] || []).forEach(o => {
      const d = o.kind === 'oh' ? overheadDoor(o.w, o.h) : manDoor(o.w, o.h);
      d.position.set(front ? o.x : -o.x, 0, z);
      if (!front) d.rotation.y = Math.PI;
      group.add(d);
    });
  });
  if (wall) {
    lay.side.forEach(o => {
      const d = o.kind === 'oh' ? overheadDoor(o.w, o.h) : manDoor(o.w, o.h);
      d.position.set(half + 0.16, 0, o.z);
      d.rotation.y = Math.PI / 2;
      group.add(d);
    });
  }

  // skylight panels along both sides of the roof
  const perSide = Math.ceil(cfg.sky / 2);
  for (let s = 0; s < cfg.sky; s++) {
    const i = Math.floor(pts.length * (s % 2 ? 0.64 : 0.36));
    const p = pts[i], q = pts[i + 1];
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    const slot = Math.floor(s / 2);
    const zPos = -L / 2 + L * ((slot + 0.5) / perSide);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(6, cfg.w * 0.2), Math.max(3, Math.min(8, L / perSide - 3))), MAT.glass);
    panel.position.set(p.x, p.y + 0.15, zPos);
    panel.rotation.set(-Math.PI / 2, 0, 0);
    panel.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), ang);
    group.add(panel);
  }

  if (cfg.vents) {
    const n = Math.max(2, Math.round(L / 20));
    for (let v = 0; v < n; v++) {
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 1.6, 16), MAT.trim);
      vent.position.set(0, height + 0.8, -L / 2 + L * ((v + 0.5) / n));
      vent.castShadow = true;
      group.add(vent);
    }
  }
  return { group, height };
}

function framePos(cfg, height) {
  const span = Math.max(cfg.w, cfg.l, height * 2);
  return { span, pos: new THREE.Vector3(span * 1.05, span * 0.55 + height * 0.5, span * 1.25), target: new THREE.Vector3(0, height * 0.4, 0) };
}

// ---------- live configurator model ----------
function initLive() {
  if (!host) return null;
  let renderer;
  try { renderer = makeRenderer(); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const stage = makeStage();
  const camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.5, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  let userMoved = false;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; userMoved = true; });

  host.innerHTML = '';
  host.classList.add('is-3d');
  host.appendChild(renderer.domElement);
  const hint = document.createElement('div');
  hint.className = 'pv-hint';
  hint.textContent = 'Drag to spin · pinch to zoom';
  host.appendChild(hint);
  const label = document.createElement('div');
  label.className = 'pv-dim';
  host.appendChild(label);

  function resize() {
    const w = host.clientWidth, h = Math.round(w * 0.66);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    renderer.render(stage.scene, camera);
  });

  let last = '';
  return function update(cfg) {
    label.textContent = cfg.w + ' ft wide × ' + cfg.l + ' ft long';
    const key = JSON.stringify([cfg.w, cfg.l, cfg.style, cfg.endwalls, cfg.oh, cfg.man, cfg.sky, cfg.vents]);
    if (key === last) return;
    last = key;
    const { height } = stage.set(cfg);
    const f = framePos(cfg, height);
    controls.target.copy(f.target);
    if (!userMoved) camera.position.copy(f.pos);
    controls.minDistance = f.span * 0.6;
    controls.maxDistance = f.span * 4;
  };
}

// ---------- 3D pictures for the kit cards ----------
function renderSnapshots(packages) {
  if (!packages || !packages.length) return;
  let renderer;
  try { renderer = makeRenderer(); } catch (e) { return; }
  const W = 800, H = 500;
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const stage = makeStage();
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 2000);
  packages.forEach(p => {
    const img = document.getElementById('pkgImg-' + p.id);
    if (!img) return;
    const { height } = stage.set(p);
    const f = framePos(p, height);
    camera.position.copy(f.pos).multiplyScalar(1.12);
    camera.lookAt(f.target);
    renderer.render(stage.scene, camera);
    img.src = renderer.domElement.toDataURL('image/jpeg', 0.86);
    img.style.objectPosition = '50% 50%';
    img.alt = '3D model of ' + p.name + ', ' + p.w + ' by ' + p.l + ' ft';
    const cap = img.parentElement && img.parentElement.querySelector('figcaption');
    if (cap) cap.textContent = '3D model · ' + p.w + '×' + p.l;
  });
  renderer.dispose();
  renderer.forceContextLoss();
}

const liveUpdate = initLive();
window.qp3d = {
  update(cfg) { if (liveUpdate) liveUpdate(cfg); },
  snapshots: renderSnapshots
};
if (window.qpCfg) window.qp3d.update(window.qpCfg);
if (window.qpPackages) renderSnapshots(window.qpPackages);

// ---------- procedural textures ----------
function corrugationTexture() {
  // ridges vary along the building's length (texture v), so each ridge follows the arch
  const make = fn => {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const x = c.getContext('2d');
    for (let i = 0; i < 256; i++) { x.fillStyle = fn(0.5 + 0.5 * Math.sin((i / 256) * Math.PI * 2 * 2)); x.fillRect(0, i, 8, 1); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  const map = make(v => { const s = Math.round(170 + v * 70); return `rgb(${s},${s + 3},${s + 6})`; });
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = make(v => { const h = Math.round(v * 255); return `rgb(${h},${h},${h})`; });
  return { map, bump };
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#5f97cf');
  g.addColorStop(0.6, '#a9cbe6');
  g.addColorStop(1, '#e4eef4');
  x.fillStyle = g;
  x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
