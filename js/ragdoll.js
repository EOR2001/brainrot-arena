// Verlet "active ragdoll". Every character is always a 15-particle ragdoll; while alive a PD
// controller pulls each particle toward an animated pose. A slap drops the drive to zero, so
// the body flies, tumbles and bounces for real, then (if it survives) ramps the drive back up
// and springs to its feet.

export const HEAD = 0, CHEST = 1, PELVIS = 2, LSH = 3, RSH = 4, LEL = 5, REL = 6, LHA = 7, RHA = 8,
  LHIP = 9, RHIP = 10, LKN = 11, RKN = 12, LFT = 13, RFT = 14;
export const NP = 15;

// Rest pose, facing +z, character's left = +x, feet on y = 0.
export const REST = new Float32Array([
  0, 1.86, 0.03,
  0, 1.42, 0.11,
  0, 0.98, 0.0,
  0.27, 1.44, -0.02, -0.27, 1.44, -0.02,
  0.34, 1.14, 0.02, -0.34, 1.14, 0.02,
  0.38, 0.86, 0.08, -0.38, 0.86, 0.08,
  0.13, 0.92, 0.0, -0.13, 0.92, 0.0,
  0.14, 0.51, 0.04, -0.14, 0.51, 0.04,
  0.14, 0.10, 0.0, -0.14, 0.10, 0.0,
]);
const RAD = [0.32, 0.25, 0.23, 0.1, 0.1, 0.085, 0.085, 0.1, 0.1, 0.11, 0.11, 0.1, 0.1, 0.11, 0.11];
const MASS = [1.4, 2.2, 2.2, 0.6, 0.6, 0.45, 0.45, 0.35, 0.35, 0.9, 0.9, 0.7, 0.7, 0.6, 0.6];
// [a, b, stiffness, minFraction] — minFraction > 0 makes it a "no closer than" joint limit.
const LINKS = [
  [HEAD, CHEST, 1, 0], [HEAD, LSH, 0.22, 0], [HEAD, RSH, 0.22, 0],
  [CHEST, PELVIS, 1, 0], [CHEST, LSH, 1, 0], [CHEST, RSH, 1, 0], [LSH, RSH, 1, 0], [LSH, PELVIS, 1, 0], [RSH, PELVIS, 1, 0],
  [LHIP, PELVIS, 1, 0], [RHIP, PELVIS, 1, 0], [LHIP, RHIP, 1, 0], [LHIP, CHEST, 1, 0], [RHIP, CHEST, 1, 0], [LHIP, LSH, 1, 0], [RHIP, RSH, 1, 0],
  [LSH, LEL, 1, 0], [LEL, LHA, 1, 0], [RSH, REL, 1, 0], [REL, RHA, 1, 0],
  [LHIP, LKN, 1, 0], [LKN, LFT, 1, 0], [RHIP, RKN, 1, 0], [RKN, RFT, 1, 0],
  [LSH, LHA, 1, 0.42], [RSH, RHA, 1, 0.42], [LHIP, LFT, 1, 0.55], [RHIP, RFT, 1, 0.55], [HEAD, PELVIS, 1, 0.9], [LFT, RFT, 0.6, 0.45],
  [LKN, CHEST, 1, 0.5], [RKN, CHEST, 1, 0.5],
];
const KEY = [HEAD, CHEST, PELVIS];
const GRAV = -16; // a bit heavier than Earth: snappier arcs, reads better from above

export class Body {
  constructor(scale = 1, massMul = 1, headMul = 1) {
    this.s = scale;
    this.p = new Float32Array(NP * 3);
    this.o = new Float32Array(NP * 3);
    this.t = new Float32Array(NP * 3);
    this.to = new Float32Array(NP * 3);
    this.local = new Float32Array(NP * 3);
    this.r = new Float32Array(NP);
    this.im = new Float32Array(NP);
    for (let i = 0; i < NP; i++) {
      this.r[i] = RAD[i] * scale * (i === HEAD ? headMul : 1);
      this.im[i] = 1 / (MASS[i] * massMul * scale * scale);
    }
    const L = [];
    for (const [a, b, st, frac] of LINKS) {
      const d = Math.hypot(REST[a * 3] - REST[b * 3], REST[a * 3 + 1] - REST[b * 3 + 1], REST[a * 3 + 2] - REST[b * 3 + 2]) * scale;
      L.push(a, b, st, frac ? d * frac : d, frac ? 1 : 0);
    }
    this.links = new Float32Array(L);
    this.drive = 1;     // 0 = full ragdoll, 1 = fully animated
    this.kp = 0.3; this.kd = 0.45;
    this.x = 0; this.z = 0; this.h = 0; this.y = 0; // y = root lift, for leaps
    this.freshTargets = true;
    this.ground = true;  // collide with floor
    this.walls = true;
    this.owner = null;
  }
  resetPose() { const s = this.s; for (let i = 0; i < NP * 3; i++) this.local[i] = REST[i] * s; }
  set(j, x, y, z) { const s = this.s, L = this.local; L[j * 3] = x * s; L[j * 3 + 1] = y * s; L[j * 3 + 2] = z * s; }
  add(j, x, y, z) { const s = this.s, L = this.local; L[j * 3] += x * s; L[j * 3 + 1] += y * s; L[j * 3 + 2] += z * s; }
  computeTargets() {
    const c = Math.cos(this.h), sn = Math.sin(this.h), L = this.local, t = this.t, to = this.to;
    for (let i = 0; i < NP; i++) {
      const k = i * 3, lx = L[k], ly = L[k + 1], lz = L[k + 2];
      to[k] = t[k]; to[k + 1] = t[k + 1]; to[k + 2] = t[k + 2];
      t[k] = this.x + lx * c + lz * sn;
      t[k + 1] = ly + this.y;
      t[k + 2] = this.z - lx * sn + lz * c;
    }
    if (this.freshTargets) { to.set(t); this.freshTargets = false; }
  }
  place(x, z, h) {
    this.x = x; this.z = z; this.h = h;
    this.resetPose(); this.freshTargets = true; this.computeTargets();
    this.p.set(this.t); this.o.set(this.t);
  }
  // Add a velocity (m/s) to particle i.
  kick(i, vx, vy, vz, dt) { const k = i * 3; this.o[k] -= vx * dt; this.o[k + 1] -= vy * dt; this.o[k + 2] -= vz * dt; }
  kickAll(vx, vy, vz, dt) { for (let i = 0; i < NP; i++) this.kick(i, vx, vy, vz, dt); }
  speed(i, dt) { const k = i * 3; return Math.hypot(this.p[k] - this.o[k], this.p[k + 1] - this.o[k + 1], this.p[k + 2] - this.o[k + 2]) / dt; }
  vel(i, dt, out) { const k = i * 3; out.x = (this.p[k] - this.o[k]) / dt; out.y = (this.p[k + 1] - this.o[k + 1]) / dt; out.z = (this.p[k + 2] - this.o[k + 2]) / dt; return out; }
  // Average speed of the core — used to decide when a ragdoll has settled.
  coreSpeed(dt) { return (this.speed(PELVIS, dt) + this.speed(CHEST, dt) + this.speed(HEAD, dt)) / 3; }
}

// --- pose helpers (all in unscaled local units) ---
export function poseWalk(b, ph, amt, lean = 0) {
  const s = b.s, L = b.local;
  const sw = Math.sin(ph) * 0.34 * amt, lift = Math.max(0, Math.cos(ph)) * 0.17 * amt;
  const lift2 = Math.max(0, -Math.cos(ph)) * 0.17 * amt;
  L[LFT * 3 + 2] += sw * s; L[LFT * 3 + 1] += lift * s;
  L[LKN * 3 + 2] += (sw * 0.5 + lift * 0.9) * s; L[LKN * 3 + 1] += lift * 0.35 * s;
  L[RFT * 3 + 2] -= sw * s; L[RFT * 3 + 1] += lift2 * s;
  L[RKN * 3 + 2] += (-sw * 0.5 + lift2 * 0.9) * s; L[RKN * 3 + 1] += lift2 * 0.35 * s;
  const bob = Math.abs(Math.sin(ph)) * 0.05 * amt * s;
  for (const j of [HEAD, CHEST, PELVIS, LSH, RSH, LEL, REL, LHA, RHA, LHIP, RHIP]) L[j * 3 + 1] += bob;
  for (const [j, k] of [[HEAD, 1], [CHEST, 0.7], [LSH, 0.7], [RSH, 0.7], [LEL, 0.5], [REL, 0.5], [LHA, 0.4], [RHA, 0.4]]) L[j * 3 + 2] += lean * k * s;
  // arms counter-swing
  L[LHA * 3 + 2] -= sw * 0.7 * s; L[LEL * 3 + 2] -= sw * 0.35 * s;
  L[RHA * 3 + 2] += sw * 0.7 * s; L[REL * 3 + 2] += sw * 0.35 * s;
  // hip sway
  L[PELVIS * 3] += Math.sin(ph) * 0.03 * amt * s;
}

// --- simulation ---
const ITER = 5;
export function stepWorld(bodies, h, n, col, onImpact) {
  const invN = 1 / n;
  for (let step = 0; step < n; step++) {
    const a = (step + 1) * invN;
    for (const b of bodies) integrate(b, h, a, invN);
    for (let it = 0; it < ITER; it++) for (const b of bodies) solve(b);
    for (const b of bodies) collide(b, h, col, onImpact);
  }
}

function integrate(b, h, a, invN) {
  const p = b.p, o = b.o, g = GRAV * h * h * (b.gravMul ?? 1);
  const damp = b.drive > 0.5 ? 0.985 : 0.996;
  for (let k = 0; k < NP * 3; k += 3) {
    const vx = (p[k] - o[k]) * damp, vy = (p[k + 1] - o[k + 1]) * damp, vz = (p[k + 2] - o[k + 2]) * damp;
    o[k] = p[k]; o[k + 1] = p[k + 1]; o[k + 2] = p[k + 2];
    p[k] += vx; p[k + 1] += vy + g; p[k + 2] += vz;
  }
  if (b.drive <= 0.001) return;
  const t = b.t, to = b.to;
  for (let i = 0; i < NP; i++) {
    const k = i * 3;
    const foot = i === LFT || i === RFT;
    const kp = Math.min(1, b.kp * b.drive * (foot ? 1.5 : 1)), kd = b.kd * b.drive;
    for (let c = 0; c < 3; c++) {
      const tv = (t[k + c] - to[k + c]) * invN;
      const tx = to[k + c] + (t[k + c] - to[k + c]) * a;
      let v = p[k + c] - o[k + c];
      v += (tv - v) * kd;
      const np = p[k + c] + (tx - p[k + c]) * kp;
      p[k + c] = np; o[k + c] = np - v;
    }
  }
}

function solve(b) {
  const p = b.p, im = b.im, L = b.links;
  for (let q = 0; q < L.length; q += 5) {
    const a = L[q] * 3, c = L[q + 1] * 3, st = L[q + 2], d = L[q + 3], lim = L[q + 4];
    const dx = p[c] - p[a], dy = p[c + 1] - p[a + 1], dz = p[c + 2] - p[a + 2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6 || (lim && len >= d)) continue;
    const wa = im[L[q]], wc = im[L[q + 1]], w = wa + wc;
    const f = (len - d) / len * st / w;
    p[a] += dx * f * wa; p[a + 1] += dy * f * wa; p[a + 2] += dz * f * wa;
    p[c] -= dx * f * wc; p[c + 1] -= dy * f * wc; p[c + 2] -= dz * f * wc;
  }
}

function collide(b, h, col, onImpact) {
  const p = b.p, o = b.o, r = b.r;
  const fr = b.drive > 0.5 ? 0 : 0.11;
  for (let i = 0; i < NP; i++) {
    const k = i * 3, ri = r[i];
    if (b.ground && p[k + 1] < ri) {
      const vy = p[k + 1] - o[k + 1];
      p[k + 1] = ri;
      o[k + 1] = vy < -0.02 ? ri + vy * 0.32 : ri;
      if (fr) { o[k] = p[k] - (p[k] - o[k]) * (1 - fr); o[k + 2] = p[k + 2] - (p[k + 2] - o[k + 2]) * (1 - fr); }
      if (vy < -0.06 && onImpact && i <= PELVIS) onImpact(b, i, -vy / h, 0);
    }
    if (!b.walls) continue;
    const res = col.circle(p[k], p[k + 2], ri);
    if (res.hit) {
      const vx = p[k] - o[k], vz = p[k + 2] - o[k + 2];
      p[k] = res.x; p[k + 2] = res.z;
      const vn = vx * res.nx + vz * res.nz;
      let nvx = vx, nvz = vz;
      if (vn < 0) {
        nvx = vx - 1.45 * vn * res.nx; nvz = vz - 1.45 * vn * res.nz;
        nvx *= 0.85; nvz *= 0.85;
        if (onImpact && -vn / h > 4 && i <= PELVIS) onImpact(b, i, -vn / h, 1);
      }
      o[k] = p[k] - nvx; o[k + 2] = p[k + 2] - nvz;
    }
  }
}

// Body-vs-body: core spheres push each other apart. Fast flying ragdolls report the hit.
export function collideBodies(bodies, h, onHit) {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const A = bodies[i];
    if (!A.walls) continue;
    for (let j = i + 1; j < n; j++) {
      const B = bodies[j];
      if (!B.walls) continue;
      const dx0 = A.p[PELVIS * 3] - B.p[PELVIS * 3], dz0 = A.p[PELVIS * 3 + 2] - B.p[PELVIS * 3 + 2];
      const reach = 1.7 * (A.s + B.s);
      if (dx0 * dx0 + dz0 * dz0 > reach * reach) continue;
      for (const ka of KEY) for (const kb of KEY) {
        const a = ka * 3, c = kb * 3;
        const dx = B.p[c] - A.p[a], dy = B.p[c + 1] - A.p[a + 1], dz = B.p[c + 2] - A.p[a + 2];
        const rr = A.r[ka] + B.r[kb], dd = dx * dx + dy * dy + dz * dz;
        if (dd >= rr * rr || dd < 1e-8) continue;
        const d = Math.sqrt(dd), pen = Math.min(rr - d, 0.12);
        const wa = A.im[ka], wb = B.im[kb], w = wa + wb;
        const ux = dx / d, uy = dy / d, uz = dz / d;
        A.p[a] -= ux * pen * wa / w; A.p[a + 1] -= uy * pen * wa / w; A.p[a + 2] -= uz * pen * wa / w;
        B.p[c] += ux * pen * wb / w; B.p[c + 1] += uy * pen * wb / w; B.p[c + 2] += uz * pen * wb / w;
        if (onHit) {
          const sa = A.speed(ka, h), sb = B.speed(kb, h);
          if (sa > 5.5) onHit(A, B, sa, ka);
          if (sb > 5.5) onHit(B, A, sb, kb);
        }
      }
    }
  }
}
