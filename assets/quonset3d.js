// Live 3D Quonset preview for the shop configurator.
// Loaded as an ES module; shop.js calls window.qp3d.update(cfg) whenever the build changes.
// If WebGL or the three.js CDN is unavailable, shop.js keeps its flat SVG preview.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('preview');
if (host) init();

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  } catch (e) { return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xcfe2ee, 250, 700);

  const camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.5, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 25;
  controls.maxDistance = 600;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; controls.userMoved = true; });

  // light
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b7a4a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-120, 160, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 500 });
  scene.add(sun);

  // ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(900, 64),
    new THREE.MeshStandardMaterial({ color: 0x6f8c45, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 1 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.05;
  pad.receiveShadow = true;
  scene.add(pad);

  // materials
  const corrugation = corrugationTexture();
  const steel = new THREE.MeshStandardMaterial({
    color: 0xdfe5e9, metalness: 0.35, roughness: 0.42,
    map: corrugation.map, bumpMap: corrugation.bump, bumpScale: 0.6, side: THREE.DoubleSide
  });
  const endSteel = new THREE.MeshStandardMaterial({ color: 0xd2d8dc, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xeef1f3, metalness: 0.3, roughness: 0.5 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3c4246, metalness: 0.4, roughness: 0.6 });
  const skyMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.75, roughness: 0.2, side: THREE.DoubleSide });

  let building = new THREE.Group();
  scene.add(building);

  // ---- geometry helpers ----
  // Cross-section profile: points (x, y) from left base, up and over, to right base.
  function profile(cfg, n = 48) {
    const half = cfg.w / 2;
    const wall = cfg.style === 'arch' ? 0 : cfg.style === 'straight' ? 10 : 16;
    const rise = cfg.style === 'arch' ? half : Math.max(8, cfg.w * 0.3);
    const pts = [];
    if (wall) pts.push(new THREE.Vector2(-half, 0));
    for (let i = 0; i <= n; i++) {
      const a = Math.PI - (i / n) * Math.PI;           // 180° → 0°
      pts.push(new THREE.Vector2(half * Math.cos(a), wall + rise * Math.sin(a)));
    }
    if (wall) pts.push(new THREE.Vector2(half, 0));
    return { pts, wall, rise, height: wall + rise };
  }

  function shellGeometry(pts, length) {
    // ribbon along z, corrugations run around the arch
    const segZ = Math.max(8, Math.round(length / 2));
    const pos = [], uv = [], idx = [];
    let along = [0];
    for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = along[along.length - 1];
    for (let j = 0; j <= segZ; j++) {
      const z = -length / 2 + (j / segZ) * length;
      for (let i = 0; i < pts.length; i++) {
        pos.push(pts[i].x, pts[i].y, z);
        uv.push(along[i] / 6, (z + length / 2) / 3);     // two ridges per 3 ft of length
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

  function build(cfg) {
    scene.remove(building);
    building.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    building = new THREE.Group();

    const { pts, height } = profile(cfg);
    const L = cfg.l;

    const shell = new THREE.Mesh(shellGeometry(pts, L), steel);
    shell.castShadow = true; shell.receiveShadow = true;
    building.add(shell);

    // ribs at each end + base rails
    const edge = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, p.y, 0)));
    [-L / 2, L / 2].forEach(z => {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, p.y, z))), 64, 0.35, 6), trimMat);
      tube.castShadow = true;
      building.add(tube);
    });
    edge.dispose();
    [-cfg.w / 2, cfg.w / 2].forEach(x => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, L), trimMat);
      rail.position.set(x, 0.4, 0);
      building.add(rail);
    });

    // endwalls
    const shape = new THREE.Shape(pts);
    const ends = cfg.endwalls === 2 ? [L / 2, -L / 2] : cfg.endwalls === 1 ? [L / 2] : [];
    ends.forEach((z, k) => {
      const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape, 48), endSteel);
      wall.position.z = z;
      wall.castShadow = true; wall.receiveShadow = true;
      building.add(wall);

      // overhead doors split across the two ends, man doors on the front
      const front = k === 0;
      const sign = front ? 1 : -1;
      const ohCount = cfg.endwalls === 2 ? (front ? Math.ceil(cfg.oh / 2) : Math.floor(cfg.oh / 2)) : cfg.oh;
      const doorW = Math.min(14, cfg.w * 0.42), doorH = Math.min(14, height * 0.62);
      const slots = Math.max(1, ohCount);
      for (let d = 0; d < ohCount && d < 3; d++) {
        const dw = slots > 1 ? Math.min(doorW, (cfg.w * 0.7) / slots - 1) : doorW;
        const x = slots > 1 ? (-cfg.w * 0.35) + (cfg.w * 0.7) * ((d + 0.5) / slots) : 0;
        const dh = slots > 1 ? Math.min(doorH, height * 0.5) : doorH;
        building.add(overheadDoor(dw, dh, x, z + sign * 0.15, sign));
      }
      if (front) {
        for (let m = 0; m < Math.min(cfg.man, 2); m++) {
          const x = (m === 0 ? -1 : 1) * (cfg.w / 2 - Math.max(3.5, cfg.w * 0.12));
          if (cfg.style === 'arch' && Math.abs(x) > cfg.w / 2 - 3) continue;
          const door = new THREE.Mesh(new THREE.BoxGeometry(3, 7, 0.3), doorMat);
          door.position.set(x, 3.5, z + 0.2);
          building.add(door);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), trimMat);
          knob.position.set(x + 1, 3.4, z + 0.45);
          building.add(knob);
        }
      }
    });

    // skylight panels laid on the roof, alternating sides
    for (let s = 0; s < cfg.sky; s++) {
      const i = Math.floor(pts.length * (s % 2 ? 0.62 : 0.38));
      const p = pts[i], q = pts[i + 1];
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const zPos = -L / 2 + L * ((Math.floor(s / 2) + 0.5) / Math.ceil(cfg.sky / 2));
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(6, cfg.w * 0.2), Math.min(8, L / Math.ceil(cfg.sky / 2) - 2)), skyMat);
      panel.position.set(p.x, p.y + 0.12, zPos);
      panel.rotation.set(-Math.PI / 2, 0, 0);
      panel.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), ang);
      building.add(panel);
    }

    // vents on the ridge
    if (cfg.vents) {
      const n = Math.max(2, Math.round(L / 20));
      for (let v = 0; v < n; v++) {
        const vent = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 1.6, 16), trimMat);
        vent.position.set(0, height + 0.8, -L / 2 + L * ((v + 0.5) / n));
        vent.castShadow = true;
        building.add(vent);
      }
    }

    scene.add(building);
    pad.scale.set(cfg.w + 12, cfg.l + 16, 1);

    // frame the camera on the building
    const span = Math.max(cfg.w, cfg.l, height * 2);
    controls.target.set(0, height * 0.4, 0);
    if (!controls.userMoved) {
      camera.position.set(span * 1.05, span * 0.55 + height * 0.5, span * 1.25);
    }
    controls.minDistance = span * 0.6;
    controls.maxDistance = span * 4;
  }

  function overheadDoor(w, h, x, z, sign) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), doorMat);
    panel.position.set(x, h / 2, z);
    panel.castShadow = true;
    g.add(panel);
    const rows = 4;
    for (let r = 1; r < rows; r++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.12, 0.05), trimMat);
      line.position.set(x, (h / rows) * r, z + sign * 0.18);
      g.add(line);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.5, 0.4), trimMat);
    frame.position.set(x, h + 0.25, z);
    g.add(frame);
    return g;
  }

  // ---- sizing / loop ----
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
    renderer.render(scene, camera);
  });

  let last = '';
  window.qp3d = {
    update(cfg) {
      const key = JSON.stringify([cfg.w, cfg.l, cfg.style, cfg.endwalls, cfg.oh, cfg.man, cfg.sky, cfg.vents]);
      label.textContent = cfg.w + ' ft wide × ' + cfg.l + ' ft long';
      if (key === last) return;
      last = key;
      build(cfg);
    }
  };
  if (window.qpCfg) window.qp3d.update(window.qpCfg);
}

// ---- procedural textures ----
function corrugationTexture() {
  // ridges vary along the building's length (texture v), so each ridge follows the arch
  const make = (fn) => {
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
