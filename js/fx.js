// Impact sparks, shock rings, comic pop-text and speech bubbles.
import * as THREE from 'three';

const _v = new THREE.Vector3();
export function project(camera, x, y, z, w, h) {
  _v.set(x, y, z).project(camera);
  return { x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h, on: _v.z < 1 && _v.z > -1 };
}

export class FX {
  constructor(scene, layer) {
    this.layer = layer;
    this.max = 500;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sparks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, this.max);
    this.sparks.frustumCulled = false;
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < this.max; i++) this.sparks.setColorAt(i, c.setRGB(1, 1, 1));
    this.sparks.count = 0;
    scene.add(this.sparks);
    this.ps = []; // {x,y,z,vx,vy,vz,life,max,size,r,g,b,grav}
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, r0: 0, r1: 1, a: 1 });
    }
    this.tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 300);
    this.tracers.frustumCulled = false;
    this.tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 300; i++) this.tracers.setColorAt(i, c);
    this.tracers.count = 0;
    scene.add(this.tracers);
    this.bubbles = [];
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('div'); el.className = 'bubble'; el.hidden = true; layer.appendChild(el);
      this.bubbles.push({ el, target: null, t: 0, dur: 0 });
    }
    this.texts = [];
    this.m4 = new THREE.Matrix4();
  }
  burst(x, y, z, n, color, speed = 6, size = 0.08, up = 3, grav = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      if (this.ps.length >= this.max) this.ps.shift();
      const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, sp = speed * (0.4 + Math.random() * 0.8);
      const ce = Math.sqrt(1 - e * e);
      const life = 0.35 + Math.random() * 0.45;
      this.ps.push({ x, y, z, vx: Math.cos(a) * ce * sp, vy: e * sp * 0.6 + up, vz: Math.sin(a) * ce * sp, life, max: life,
        size: size * (0.6 + Math.random() * 0.8), r: c.r * 2.2, g: c.g * 2.2, b: c.b * 2.2, grav });
    }
  }
  ring(x, y, z, color, r1 = 2.5, dur = 0.4, a = 0.9, r0 = 0.2) {
    const R = this.rings.find(r => !r.m.visible) || this.rings[0];
    R.m.visible = true; R.m.position.set(x, y, z); R.t = 0; R.dur = dur; R.r0 = r0; R.r1 = r1; R.a = a;
    R.m.material.color.set(color).multiplyScalar(2);
    return R;
  }
  text(sx, sy, str, cls = '', rot = (Math.random() - 0.5) * 24) {
    if (this.texts.length > 26) { const old = this.texts.shift(); old.remove(); }
    const el = document.createElement('div');
    el.className = 'ftext ' + cls;
    el.textContent = str;
    el.style.left = sx + 'px'; el.style.top = sy + 'px';
    el.style.setProperty('--rot', rot + 'deg');
    this.layer.appendChild(el);
    this.texts.push(el);
    el.addEventListener('animationend', () => { el.remove(); const i = this.texts.indexOf(el); if (i >= 0) this.texts.splice(i, 1); });
  }
  bubble(target, str, dur = 2, cls = '') {
    let B = this.bubbles.find(b => b.target === target) || this.bubbles.find(b => !b.target);
    if (!B) B = this.bubbles.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
    B.target = target; B.t = 0; B.dur = dur;
    B.el.textContent = str;
    B.el.className = 'bubble ' + cls;
    B.el.style.setProperty('--tilt', ((Math.random() - 0.5) * 8).toFixed(1) + 'deg');
    B.el.hidden = false;
    return B;
  }
  drop(target) { for (const B of this.bubbles) if (B.target === target) { B.target = null; B.el.hidden = true; } }
  // Bullets drawn as glowing streaks trailing behind their heads.
  setTracers(list) {
    const A = this.tracers.instanceMatrix.array, C = this.tracers.instanceColor.array;
    let n = 0;
    for (const t of list) {
      if (n >= 300) break;
      const len = Math.max(0.25, Math.min(1.8, t.travelled + 0.25)), w = 0.055;
      const o = n * 16;
      A[o] = t.dz * w; A[o + 1] = 0; A[o + 2] = -t.dx * w; A[o + 3] = 0;
      A[o + 4] = 0; A[o + 5] = w; A[o + 6] = 0; A[o + 7] = 0;
      A[o + 8] = t.dx * len; A[o + 9] = 0; A[o + 10] = t.dz * len; A[o + 11] = 0;
      A[o + 12] = t.x - t.dx * len / 2; A[o + 13] = t.y; A[o + 14] = t.z - t.dz * len / 2; A[o + 15] = 1;
      C[n * 3] = t.col.r; C[n * 3 + 1] = t.col.g; C[n * 3 + 2] = t.col.b;
      n++;
    }
    this.tracers.count = n;
    this.tracers.instanceMatrix.needsUpdate = true; this.tracers.instanceColor.needsUpdate = true;
  }
  clearBubbles() { for (const B of this.bubbles) { B.target = null; B.el.hidden = true; } }
  isTalking(target) { return this.bubbles.some(b => b.target === target); }
  update(dt, camera, w, h, headOf) {
    const g = -14;
    const A = this.sparks.instanceMatrix.array, C = this.sparks.instanceColor.array;
    let n = 0;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.ps.splice(i, 1); continue; }
      p.vy += g * p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
      const s = p.size * Math.min(1, p.life / p.max * 1.6);
      const o = n * 16;
      A[o] = s; A[o + 1] = 0; A[o + 2] = 0; A[o + 3] = 0; A[o + 4] = 0; A[o + 5] = s; A[o + 6] = 0; A[o + 7] = 0;
      A[o + 8] = 0; A[o + 9] = 0; A[o + 10] = s; A[o + 11] = 0; A[o + 12] = p.x; A[o + 13] = p.y; A[o + 14] = p.z; A[o + 15] = 1;
      C[n * 3] = p.r; C[n * 3 + 1] = p.g; C[n * 3 + 2] = p.b;
      n++;
    }
    this.sparks.count = n;
    this.sparks.instanceMatrix.needsUpdate = true; this.sparks.instanceColor.needsUpdate = true;
    for (const R of this.rings) {
      if (!R.m.visible) continue;
      R.t += dt; const u = R.t / R.dur;
      if (u >= 1) { R.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - u, 3), r = R.r0 + (R.r1 - R.r0) * e;
      R.m.scale.set(r, 1, r); R.m.material.opacity = R.a * (1 - u);
    }
    for (const B of this.bubbles) {
      if (!B.target) continue;
      B.t += dt;
      const hp = headOf(B.target);
      if (B.t > B.dur || !hp) { B.target = null; B.el.hidden = true; continue; }
      const p = project(camera, hp.x, hp.y + 0.55, hp.z, w, h);
      if (!p.on || p.x < -100 || p.y < -60 || p.x > w + 100 || p.y > h + 60) { B.el.style.visibility = 'hidden'; continue; }
      B.el.style.visibility = 'visible';
      B.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) rotate(var(--tilt))`;
    }
  }
}
