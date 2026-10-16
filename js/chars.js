// Character roster (the brainrot cast) and an instanced renderer that draws every ragdoll,
// face, hat and weapon from four primitive meshes.
import * as THREE from 'three';
import { HEAD, CHEST, PELVIS, LSH, RSH, LEL, REL, LHA, RHA, LHIP, RHIP, LKN, RKN, LFT, RFT } from './ragdoll.js';

export const TYPES = {
  skibidi: {
    name: 'Skibidi Toilet Guy', hp: 1, speed: 4.3, scale: 1.0, mass: 1, dmg: 10, windup: 0.45, arms: 'flail', pitch: 1.7, rate: 1.3,
    look: { skin: 0xffd9b8, shirt: 0xf3f5fb, pants: 0x3d7bff, shoe: 0x22252e, hand: 0xffd9b8, extra: 'toilet', head: 1.05 },
    lines: ['SKIBIDI DOP DOP YES YES', 'skibidi skibidi', 'dop dop dop', 'SKIBIDI RIZZ', 'flush flush flush', 'yes yes yes yes'],
    death: ['FLUSHED', 'SKIBIDI DOWN', 'DOP DOP NO'],
  },
  fanum: {
    name: 'Fanum Taxman', hp: 1, speed: 6.1, scale: 0.8, mass: 0.75, dmg: 7, windup: 0.3, arms: 'zombie', pitch: 1.95, rate: 1.55,
    look: { skin: 0xc68a5a, shirt: 0xff8a1f, pants: 0x2b2b33, shoe: 0xf5f5f5, hand: 0xc68a5a, extra: 'cap', extraColor: 0x1f2a44, head: 1.15 },
    lines: ['FANUM TAX!', 'tax tax tax', 'your fries are mine', 'I am taxing you', 'one bite bro', 'TAX SEASON'],
    death: ['TAX REFUND', 'AUDITED', 'UN-TAXED'],
  },
  tralalero: {
    name: 'Tralalero Tralala', hp: 1, speed: 5.0, scale: 1.0, mass: 1, dmg: 10, windup: 0.4, arms: 'flail', pitch: 1.25, rate: 1.25,
    look: { skin: 0x5ab4ff, shirt: 0x5ab4ff, pants: 0x2a6fd1, shoe: 0xf2f6ff, hand: 0x5ab4ff, extra: 'fin', head: 1.1 },
    lines: ['TRALALERO TRALALA', 'tralala tralala', 'shark with sneaker drip', 'tra la la la la', 'TRALALEROOO'],
    death: ['SHARK DOWN', 'TRALA-LOST', 'FISH FOOD'],
  },
  sigma: {
    name: 'Sigma Grindset', hp: 2, speed: 4.0, scale: 1.08, mass: 1.25, dmg: 13, windup: 0.5, arms: 'pockets', pitch: 0.55, rate: 1.0,
    look: { skin: 0xe8c4a0, shirt: 0x1b1d24, pants: 0x14151a, shoe: 0x0a0a0a, hand: 0xe8c4a0, extra: 'shades', tie: 0xff3d5a, head: 1.0 },
    lines: ['what the sigma', 'I am mewing', 'you just got mogged', 'sigma grindset', '4 AM grind', 'you are not him', 'I never blink'],
    death: ['MOGGED', 'BETA NOW', 'GRINDSET OVER'],
  },
  tung: {
    name: 'Tung Tung Tung Sahur', hp: 2, speed: 3.7, scale: 1.18, mass: 1.35, dmg: 17, windup: 0.55, arms: 'bat', pitch: 0.75, rate: 1.1,
    look: { skin: 0xc4925a, shirt: 0xc4925a, pants: 0xa77a45, shoe: 0x6e4b2a, hand: 0xc4925a, extra: 'bat', head: 1.0, torso: 0.85 },
    lines: ['TUNG TUNG TUNG SAHUR', 'tung tung tung', 'SAHUR!', 'wake up for sahur', 'TUNG', 'tung tung tung tung tung'],
    death: ['SPLINTERED', 'NO MORE SAHUR', 'TUNG GONE'],
  },
  brute: {
    name: 'Gyatt Brute', hp: 2, speed: 3.1, scale: 1.38, mass: 2.2, dmg: 22, windup: 0.6, arms: 'wide', pitch: 0.45, rate: 0.9,
    look: { skin: 0xffb38a, shirt: 0x8a5cff, pants: 0x3a2466, shoe: 0x111111, hand: 0xffb38a, extra: 'headband', extraColor: 0xffe14d, head: 0.95, torso: 1.35 },
    lines: ['GYATT', 'GYATTTTT', 'ohio rizz', 'bombastic side eye', 'I am the rizzler', 'level ten gyatt'],
    death: ['NO GYATT', 'RIZZ REVOKED', 'BIG BACK DOWN'],
  },
  sanic: {
    name: 'Sanic', hp: 1, speed: 8.6, scale: 0.95, mass: 0.85, dmg: 9, windup: 0.3, arms: 'naruto', special: 'sprint', lean: 0.38, pitch: 1.4, rate: 1.6,
    look: { skin: 0x2f6bff, shirt: 0x2f6bff, pants: 0x2f6bff, shoe: 0xff2a3d, hand: 0xffffff, extra: 'sanic', belly: 0xf2c99a, eyes: 'big', head: 1.22 },
    lines: ['GOTTA GO FAST', 'gota go fest', 'sanic speed', 'you are too slow', 'SANIC', 'gotta go fast gotta go fast'],
    death: ['TOO SLOW', 'RINGS LOST', 'GOT SLAPPED FAST'],
  },
  spoder: {
    name: 'Spoderman', hp: 2, speed: 4.6, scale: 1.0, mass: 1, dmg: 11, windup: 0.4, arms: 'spoder', special: 'web', pitch: 1.1, rate: 1.25,
    look: { skin: 0xe0202e, shirt: 0xe0202e, pants: 0x1f4bd1, shoe: 0xe0202e, hand: 0xe0202e, extra: 'spoder', eyes: 'mask', head: 1.0 },
    lines: ['spoder man spoder man', 'does whatever a spoder can', 'I AM SPODERMAN', 'my spoder sense is tingling', 'with great power comes great brainrot', 'thwip thwip'],
    death: ['SPODER DOWN', 'NO WAY HOME', 'UN-WEBBED'],
  },
  bombardiro: {
    name: 'Bombardiro Crocodilo', hp: 1, speed: 4.2, scale: 1.05, mass: 1.1, dmg: 0, windup: 9, arms: 'bomb', special: 'bomb', pitch: 0.7, rate: 1.15,
    look: { skin: 0x4f9a3a, shirt: 0x6b7a52, pants: 0x4f9a3a, shoe: 0x2e4a22, hand: 0x4f9a3a, extra: 'croc', head: 1.0 },
    lines: ['BOMBARDIRO CROCODILO', 'bombs away', 'crocodilo incoming', 'KABOOM', 'tactical crocodile'],
    death: ['DEFUSED', 'CROC-BOOM', 'SPLASH DAMAGE'],
  },
  ballerina: {
    name: 'Ballerina Cappuccina', hp: 1, speed: 4.6, scale: 0.92, mass: 0.9, dmg: 9, windup: 0.35, arms: 'ballet', special: 'spin', pitch: 1.9, rate: 1.3,
    look: { skin: 0xffd6c2, shirt: 0xff8ac6, pants: 0xff8ac6, shoe: 0xffffff, hand: 0xffd6c2, extra: 'ballerina', head: 1.05 },
    lines: ['BALLERINA CAPPUCCINA', 'mi mi mi', 'one more espresso', 'cappuccina spin', 'mi mi mi mi mi'],
    death: ['DECAF NOW', 'SPILLED', 'CURTAIN CALL'],
  },
  chimp: {
    name: 'Chimpanzini Bananini', hp: 1, speed: 5.0, scale: 0.78, mass: 0.7, dmg: 8, windup: 0.3, arms: 'monkey', special: 'leap', pitch: 1.8, rate: 1.45,
    look: { skin: 0x7a4a28, shirt: 0xffe14d, pants: 0xffe14d, shoe: 0x7a4a28, hand: 0x7a4a28, extra: 'chimp', face: 0xe8c49a, head: 1.2 },
    lines: ['CHIMPANZINI BANANINI', 'wa wa wa', 'banana banana', 'bananini!', 'ooh ooh aah aah'],
    death: ['PEELED', 'BANANA SPLIT', 'MONKE DOWN'],
  },
  patapim: {
    name: 'Brr Brr Patapim', hp: 2, speed: 3.3, scale: 1.25, mass: 1.7, dmg: 18, windup: 0.6, arms: 'wide', pitch: 0.5, rate: 0.95,
    look: { skin: 0x9a6b3d, shirt: 0x7a5230, pants: 0x7a5230, shoe: 0x4a3018, hand: 0x9a6b3d, extra: 'tree', head: 1.05 },
    lines: ['BRR BRR PATAPIM', 'brr brr', 'patapim!', 'my nose is long', 'the forest is coming'],
    death: ['TIMBER', 'CHOPPED', 'LEAF ME ALONE'],
  },
  knuckles: {
    name: 'Ugandan Knuckles', hp: 1, speed: 5.4, scale: 0.74, mass: 0.75, dmg: 7, windup: 0.32, arms: 'naruto', special: 'pack', lean: 0.25, pitch: 0.45, rate: 0.95,
    look: { skin: 0xd8262e, shirt: 0xd8262e, pants: 0xd8262e, shoe: 0x2f9e4f, hand: 0xffffff, extra: 'knuckles', belly: 0xf3d2a2, eyes: 'big', head: 1.4 },
    lines: ['DO U KNOW DE WAY', 'DE WAY', 'SPIT ON HIM', 'MY QUEEN'],
    death: ['NO KNOW DE WAY', 'LOST DE WAY', 'NOT DE WAY'],
  },
  chad: {
    name: 'Chad', hp: 2, speed: 2.8, scale: 1.25, mass: 2.0, dmg: 15, windup: 0.5, arms: 'chad', special: 'chad', pitch: 0.35, rate: 0.85,
    look: { skin: 0xe8b48a, shirt: 0xf2f2f2, sleeve: 0xe8b48a, pants: 0x2b3a67, shoe: 0xffffff, hand: 0xe8b48a, extra: 'chad', hair: 0xf2d27a, head: 0.95, torso: 1.4, arm: 1.6 },
    lines: ['aura farming', 'you just got mogged', 'I do not even lift', '+1000 aura', 'imagine not being me', 'jawline check', 'yes.'],
    death: ['AURA DEPLETED', 'MOGGED BACK', 'VIRGIN NOW'],
  },
  boss: {
    name: 'Ohio Final Boss', hp: 2, speed: 3.5, scale: 1.85, mass: 4, dmg: 30, windup: 0.7, arms: 'wide', pitch: 0.3, rate: 0.8,
    look: { skin: 0x7cff6b, shirt: 0xff2a4a, pants: 0x221018, shoe: 0x050505, hand: 0x7cff6b, extra: 'crown', head: 1.1, torso: 1.2 },
    lines: ['ONLY IN OHIO', 'I AM THE FINAL BOSS', 'you are cooked', 'minus one thousand aura', 'OHIO HAS FALLEN'],
    death: ['OHIO CLEANSED', 'BOSS SLAPPED', 'FINAL BOSS FINISHED'],
  },
};

export const GENERIC = ['no cap fr fr', "it's giving", "you're cooked", 'skill issue', 'touch grass', 'six seven!', 'six seven six seven',
  'aura farming', 'erm what the sigma', 'goofy ahh', 'caught in 4K', 'L plus ratio', 'delulu is the solulu', 'let him cook',
  "bro thinks he's him", 'chat is this real', 'minus 1000 aura', 'brr brr patapim', 'bombardiro crocodilo', 'chimpanzini bananini',
  'lirili larila', 'cappuccino assassino', 'crash out', 'stop the glazing', 'ohio moment', 'only in ohio', 'bussin', 'sheesh',
  'mewing streak', 'sigma sigma boy', 'unc status', 'rizz me up', 'gyatt dang', 'npc behaviour', 'main character energy'];

export const HIT_LINES = ['NOT THE RIZZ', '-500 AURA', 'MY MEWING STREAK', "I'M COOKED", 'BRO SLAPPED ME IN 4K', 'OHIO MOMENT',
  'that was cap', 'BRUH', 'W SLAP', "RATIO'D", 'MY AURA', 'ow ow ow', 'skill issue (mine)', 'UNC MOMENT', 'BRO??'];

export const KILL_TEXT = ['-1000 AURA', 'COOKED', "RATIO'D", 'SENT TO OHIO', 'DELETED', 'NO RIZZ LEFT'];

export const PLAYER_LOOK = { skin: 0xffd2a8, shirt: 0xffe14d, pants: 0x1b1d24, shoe: 0xff3d7f, hand: 0xffffff, extra: 'headband', extraColor: 0xff3d5a, head: 1.0, hair: 0x2a1a12 };

export const WEAPONS = {
  hand: { name: 'Bare Hand', reach: 1.85, cone: 1.5, power: 1.0, dmg: 1, cd: 0.3, uses: Infinity, max: 3, sfx: 'slap', words: ['SLAP!', 'SMACK!', 'WHAP!', 'THWACK!'] },
  fish: { name: 'Wet Fish', reach: 2.45, cone: 1.8, power: 1.35, dmg: 2, cd: 0.4, uses: 30, max: 5, sfx: 'fish', words: ['SPLAT!', 'SQUELCH!', 'FISHED!'] },
  pan: { name: 'Frying Pan', reach: 2.1, cone: 1.5, power: 2.0, dmg: 2, cd: 0.48, uses: 20, max: 4, sfx: 'bonk', words: ['BONK!', 'CLANG!', 'DONG!'] },
  chancla: { name: 'La Chancla', reach: 1.95, cone: 1.4, power: 1.15, dmg: 1, cd: 0.15, uses: 60, max: 3, sfx: 'crack', words: ['CHANCLA!', 'SNAP!', 'WHIP!'] },
  glove: { name: 'Mega Glove', reach: 3.0, cone: 2.5, power: 1.65, dmg: 2, cd: 0.55, uses: 25, max: 8, sfx: 'mega', words: ['MEGA SLAP!', 'KA-BLAP!', 'OBLITERATED!'] },
  katana: { name: 'Samurai Sword', reach: 2.65, cone: 2.3, power: 1.4, dmg: 2, cd: 0.3, uses: 40, max: 7, sfx: 'slash', words: ['SLICE!', 'SLASH!', 'KATANA!', 'NOTHING PERSONNEL'] },
  // Guns: ammo in `uses`; every bullet ragdolls what it hits.
  pistol: { name: 'Rizz Pistol', gun: true, cd: 0.19, uses: 24, dmg: 1, power: 1.0, pellets: 1, spread: 0.035, speed: 60, range: 30, muzzle: 0.34, kick: 0.12, sfx: 'pistol', tracer: 0xff4fd8 },
  shotgun: { name: 'Skibidi Shotgun', gun: true, twoHand: true, cd: 0.72, uses: 10, dmg: 1, power: 1.25, pellets: 8, spread: 0.42, speed: 50, range: 14, muzzle: 0.88, kick: 0.5, sfx: 'shotgun', tracer: 0xffb03d },
  gatling: { name: 'Gyatt Gatling', gun: true, twoHand: true, cd: 0.065, uses: 90, dmg: 1, power: 0.7, pellets: 1, spread: 0.09, speed: 66, range: 26, muzzle: 0.92, kick: 0.03, noRecoil: true, sfx: 'gatling', tracer: 0x3df2ff },
};
export const MELEE = ['fish', 'pan', 'chancla', 'glove', 'katana'];
export const GUNS = ['pistol', 'shotgun', 'gatling'];
export const ITEM_COLORS = { fish: 0x4fc7a0, pan: 0x8a8f99, chancla: 0xff6ad5, glove: 0xff3d5a, juice: 0x8dff5a, katana: 0xd8e6ff, pistol: 0xff4fd8, shotgun: 0xffb03d, gatling: 0x3df2ff };

// ---------- renderer ----------
const lin = (hex) => new THREE.Color(hex);
export function prepLook(look) {
  const L = {};
  for (const k of ['skin', 'shirt', 'pants', 'shoe', 'hand', 'extraColor', 'tie', 'hair', 'belly', 'face', 'sleeve']) if (look[k] != null) L[k] = lin(look[k]);
  L.extra = look.extra; L.eyes = look.eyes; L.arm = look.arm ?? 1; L.head = look.head ?? 1; L.torso = look.torso ?? 1;
  return L;
}

const C = {
  white: lin(0xffffff), black: lin(0x0b0b10), mouth: lin(0x3a0d16), toilet: lin(0xf6f8ff), wood: lin(0x7a5230), gold: lin(0xffc93d),
  shades: lin(0x050508), fishA: lin(0x4fc7a0), fishB: lin(0xff9a4d), pan: lin(0x2a2c33), panIn: lin(0x51545e), chancla: lin(0xff6ad5),
  strap: lin(0x3df2ff), leaf: lin(0x3fae4a), leaf2: lin(0x2f8a3a), nose: lin(0x8a5a30), coffee: lin(0x5a3418), cup: lin(0xfaf6f0),
  wing: lin(0x8f9aa6), blade: lin(0xe8eef8).multiplyScalar(1.12), guard: lin(0xc9a227), wrap: lin(0x1a1420), wrapB: lin(0xc0182a), ssj: lin(0xffe14d).multiplyScalar(1.15), ssjEye: lin(0x2fd6a0), bomb: lin(0x16151c), fuse: lin(0xff3d2a), tooth: lin(0xffffff), web: lin(0xffffff), glove: lin(0xff3d5a), cuff: lin(0xffffff), juice: lin(0x8dff5a), juiceB: lin(0x1b1d24), steel: lin(0xc9d1de),
  gunDark: lin(0x1d1b26), gunPink: lin(0xff4fd8), gunOrange: lin(0xffb03d), gunCyan: lin(0x3df2ff),
};

export class CharRenderer {
  constructor(scene, max = 150) {
    const grad = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad });
    const tmp = new THREE.Color(1, 1, 1);
    const mk = (geo, n) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.castShadow = true; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < n; i++) m.setColorAt(i, tmp);
      m.count = 0; scene.add(m); return m;
    };
    this.cyl = mk(new THREE.CylinderGeometry(1, 1, 1, 12, 1), max * 14);
    this.ball = mk(new THREE.SphereGeometry(1, 18, 12), max * 32);
    this.cone = mk(new THREE.ConeGeometry(1, 1, 14), max * 6);
    this.box = mk(new THREE.BoxGeometry(1, 1, 1), max * 8);
    this.n = { cyl: 0, ball: 0, cone: 0, box: 0 };
    this.tc = new THREE.Color();
    this.flash = 0;
    this.spin = 0;
  }
  begin() { this.n.cyl = this.n.ball = this.n.cone = this.n.box = 0; }
  end() {
    for (const k of ['cyl', 'ball', 'cone', 'box']) {
      const m = this[k]; m.count = this.n[k];
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    }
  }
  _put(kind, ax, ay, az, bx, by, bz, cx, cy, cz, px, py, pz, col) {
    const m = this[kind], i = this.n[kind];
    if (i >= m.instanceMatrix.count) return;
    this.n[kind] = i + 1;
    const a = m.instanceMatrix.array, o = i * 16;
    a[o] = ax; a[o + 1] = ay; a[o + 2] = az; a[o + 3] = 0;
    a[o + 4] = bx; a[o + 5] = by; a[o + 6] = bz; a[o + 7] = 0;
    a[o + 8] = cx; a[o + 9] = cy; a[o + 10] = cz; a[o + 11] = 0;
    a[o + 12] = px; a[o + 13] = py; a[o + 14] = pz; a[o + 15] = 1;
    let c = col;
    if (this.flash > 0) c = this.tc.copy(col).lerp(C.white, this.flash);
    const ca = m.instanceColor.array, q = i * 3;
    ca[q] = c.r; ca[q + 1] = c.g; ca[q + 2] = c.b;
  }
  // Oriented primitive: axis Y along (b - a).
  _axis(kind, ax, ay, az, bx, by, bz, r, col, rz = r) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-5) return;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    let hx = 0, hy = 1, hz = 0;
    if (Math.abs(uy) > 0.95) { hx = 1; hy = 0; }
    let cx = hy * uz - hz * uy, cy = hz * ux - hx * uz, cz = hx * uy - hy * ux;
    const cn = Math.sqrt(cx * cx + cy * cy + cz * cz); cx /= cn; cy /= cn; cz /= cn;
    const qx = cy * uz - cz * uy, qy = cz * ux - cx * uz, qz = cx * uy - cy * ux;
    this._put(kind, cx * r, cy * r, cz * r, dx, dy, dz, qx * rz, qy * rz, qz * rz, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, col);
  }
  seg(P, a, b, r, col) { this._axis('cyl', P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[b * 3], P[b * 3 + 1], P[b * 3 + 2], r, col); }
  sphere(x, y, z, r, col) { this._put('ball', r, 0, 0, 0, r, 0, 0, 0, r, x, y, z, col); }
  joint(P, j, r, col) { this.sphere(P[j * 3], P[j * 3 + 1], P[j * 3 + 2], r, col); }
  // Primitive placed in a frame F = {X,Y,Z axes, origin O} at local offset with scale.
  inFrame(kind, F, ox, oy, oz, sx, sy, sz, col) {
    const X = F.X, Y = F.Y, Z = F.Z;
    this._put(kind, X[0] * sx, X[1] * sx, X[2] * sx, Y[0] * sy, Y[1] * sy, Y[2] * sy, Z[0] * sz, Z[1] * sz, Z[2] * sz,
      F.O[0] + X[0] * ox + Y[0] * oy + Z[0] * oz, F.O[1] + X[1] * ox + Y[1] * oy + Z[1] * oz, F.O[2] + X[2] * ox + Y[2] * oy + Z[2] * oz, col);
  }

  drawBody(b, L, st) {
    const P = b.p, s = b.s;
    this.flash = st.flash || 0;
    const hr = b.r[HEAD] * 1.0;
    const tr = 0.25 * s * L.torso;
    const head = frame(P, HEAD, CHEST, LSH, RSH, _F1);
    const hips = frame(P, PELVIS, PELVIS, LHIP, RHIP, _F2, CHEST);
    // torso: shirt top, pants bottom
    this.seg(P, PELVIS, CHEST, tr, L.shirt);
    this.joint(P, CHEST, tr, L.shirt);
    this.joint(P, PELVIS, tr * 1.03, L.pants);
    // arms
    const armR = 0.085 * s * L.arm;
    for (const [sh, el, ha] of [[LSH, LEL, LHA], [RSH, REL, RHA]]) {
      const sleeve = L.sleeve || L.shirt;
      this.joint(P, sh, armR * 1.25, sleeve);
      this.seg(P, sh, el, armR, sleeve);
      this.joint(P, el, armR, sleeve);
      this.seg(P, el, ha, armR * 0.88, L.skin);
      this.joint(P, ha, (st.handR && ha === RHA ? st.handR : (st.handR ? st.handR * 0.85 : 0.1 * s)), L.hand);
    }
    // legs
    const legR = 0.105 * s;
    for (const [hp, kn, ft] of [[LHIP, LKN, LFT], [RHIP, RKN, RFT]]) {
      this.seg(P, hp, kn, legR, L.pants);
      this.joint(P, kn, legR * 0.95, L.pants);
      this.seg(P, kn, ft, legR * 0.9, L.pants);
      const F = { X: hips.X, Y: hips.Y, Z: hips.Z, O: [P[ft * 3], P[ft * 3 + 1], P[ft * 3 + 2]] };
      this.inFrame('ball', F, 0, -0.01 * s, 0.06 * s, 0.11 * s, 0.085 * s, 0.19 * s, L.shoe);
    }
    // neck + head
    this.seg(P, CHEST, HEAD, 0.09 * s, L.skin);
    this.joint(P, HEAD, hr, L.skin);
    // face
    const dead = st.dead, dizzy = st.dizzy;
    const big = L.eyes === 'big' ? 1.35 : 1;
    for (const side of [1, -1]) {
      const ex = side * 0.36 * hr * (big > 1 ? 0.8 : 1), ey = 0.12 * hr, ez = 0.86 * hr;
      if (L.eyes === 'mask' && !dead) {
        this.inFrameRot('ball', head, side * 0.36 * hr, 0.16 * hr, 0.88 * hr, 0.36 * hr, 0.24 * hr, 0.1 * hr, side * 0.5, C.black);
        this.inFrameRot('ball', head, side * 0.36 * hr, 0.16 * hr, 0.93 * hr, 0.3 * hr, 0.19 * hr, 0.08 * hr, side * 0.5, C.white);
        continue;
      }
      if (dead) {
        this.inFrameRot('box', head, ex, ey, ez + 0.06 * hr, 0.42 * hr, 0.09 * hr, 0.05 * hr, 0.785, C.black);
        this.inFrameRot('box', head, ex, ey, ez + 0.06 * hr, 0.42 * hr, 0.09 * hr, 0.05 * hr, -0.785, C.black);
      } else {
        this.inFrame('ball', head, ex, ey, ez, 0.26 * hr * big, (st.blink ? 0.05 : 0.27 * big) * hr, 0.16 * hr, C.white);
        let px = -side * 0.07 * hr, py = 0;
        if (dizzy) { px = Math.cos(st.time * 14 + side) * 0.09 * hr; py = Math.sin(st.time * 14 + side) * 0.09 * hr; }
        if (!st.blink) this.inFrame('ball', head, ex + px, ey + py, ez + 0.12 * hr, 0.12 * hr, 0.13 * hr, 0.07 * hr, C.black);
      }
    }
    if (!st.noMouth && L.eyes !== 'mask') {
      const open = st.talk ? 0.05 + Math.abs(Math.sin(st.time * 22)) * 0.2 : (dead ? 0.12 : 0.04);
      this.inFrame('ball', head, 0, -0.33 * hr, 0.84 * hr, 0.3 * hr, open * hr, 0.14 * hr, C.mouth);
    }
    // accessories
    const ex = L.extra;
    if (ex === 'toilet') {
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      this.inFrame('ball', chest, 0, 0.16 * s, 0.02 * s, 0.4 * s, 0.13 * s, 0.4 * s, C.toilet);
      this.inFrame('box', chest, 0, 0.3 * s, -0.33 * s, 0.5 * s, 0.55 * s, 0.2 * s, C.toilet);
      this.inFrame('box', chest, 0, 0.62 * s, -0.33 * s, 0.56 * s, 0.07 * s, 0.24 * s, C.steel);
    } else if (ex === 'cap') {
      this.inFrame('ball', head, 0, 0.42 * hr, -0.02 * hr, 1.03 * hr, 0.62 * hr, 1.03 * hr, L.extraColor);
      this.inFrame('box', head, 0, 0.5 * hr, -1.0 * hr, 0.85 * hr, 0.07 * hr, 0.7 * hr, L.extraColor);
    } else if (ex === 'fin') {
      this.inFrameRot('cone', head, 0, 1.15 * hr, -0.25 * hr, 0.1 * hr, 0.95 * hr, 0.55 * hr, 0, L.shirt, -0.45);
    } else if (ex === 'shades') {
      this.inFrame('box', head, 0, 0.14 * hr, 0.98 * hr, 1.35 * hr, 0.3 * hr, 0.06 * hr, C.shades);
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      this.inFrame('box', chest, 0, -0.18 * s, tr * 0.96, 0.08 * s, 0.32 * s, 0.03 * s, L.tie);
      this.inFrame('ball', head, 0, 0.62 * hr, -0.1 * hr, 0.95 * hr, 0.42 * hr, 0.92 * hr, C.black);
    } else if (ex === 'bat') {
      const hx = P[RHA * 3], hy = P[RHA * 3 + 1], hz = P[RHA * 3 + 2];
      let dx = hx - P[REL * 3], dy = hy - P[REL * 3 + 1], dz = hz - P[REL * 3 + 2];
      const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
      this._axis('cyl', hx - dx * 0.1 * s, hy - dy * 0.1 * s, hz - dz * 0.1 * s, hx + dx * 0.95 * s, hy + dy * 0.95 * s, hz + dz * 0.95 * s, 0.07 * s, C.wood);
      this.sphere(hx + dx * 0.95 * s, hy + dy * 0.95 * s, hz + dz * 0.95 * s, 0.075 * s, C.wood);
    } else if (ex === 'headband') {
      this.inFrame('cyl', head, 0, 0.42 * hr, 0, 0.93 * hr, 0.18 * hr, 0.93 * hr, L.extraColor);
      if (L.hair) this.inFrame('ball', head, 0, 0.55 * hr, -0.12 * hr, 0.92 * hr, 0.55 * hr, 0.9 * hr, L.hair);
    } else if (ex === 'sanic') {
      this.inFrame('ball', head, 0, -0.3 * hr, 0.72 * hr, 0.55 * hr, 0.36 * hr, 0.4 * hr, L.belly);
      for (const [x, y, rot, tilt] of [[0, 0.4, 0, -1.15], [0.38, 0.1, 0.5, -1.45], [-0.38, 0.1, -0.5, -1.45], [0, -0.2, 0, -1.75], [0.25, -0.35, 0.4, -1.85], [-0.25, -0.35, -0.4, -1.85]]) {
        this.inFrameRot('cone', head, x * hr, y * hr, -0.75 * hr, 0.28 * hr, 1.0 * hr, 0.28 * hr, rot, L.skin, tilt);
      }
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      this.inFrame('ball', chest, 0, -0.18 * s, tr * 0.55, tr * 0.8, tr * 1.1, tr * 0.6, L.belly);
    } else if (ex === 'knuckles') {
      // big tan muzzle, white chest crescent, droopy dreads
      this.inFrame('ball', head, 0, -0.38 * hr, 0.55 * hr, 0.72 * hr, 0.42 * hr, 0.55 * hr, L.belly);
      for (const [x, y, rot, tilt] of [[0.42, 0.15, 0.6, -2.3], [-0.42, 0.15, -0.6, -2.3], [0.2, -0.15, 0.3, -2.6], [-0.2, -0.15, -0.3, -2.6]]) {
        this.inFrameRot('cone', head, x * hr, y * hr, -0.55 * hr, 0.26 * hr, 1.0 * hr, 0.26 * hr, rot, L.skin, tilt);
      }
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      this.inFrame('ball', chest, 0, 0.0, tr * 0.7, tr * 0.9, tr * 0.45, tr * 0.45, C.white);
    } else if (ex === 'chad') {
      // swoopy blond hair, square jaw, heavy brows, tank top straps
      if (st.ssj) {
        // Super Saiyan: glowing gold spikes straight up
        this.inFrame('ball', head, 0, 0.5 * hr, 0, 1.02 * hr, 0.6 * hr, 1.02 * hr, C.ssj);
        for (const [x, y, z, rot, tilt, h] of [[0, 0.95, 0, 0, 0, 1.5], [0.45, 0.8, 0.05, -0.55, 0, 1.2], [-0.45, 0.8, 0.05, 0.55, 0, 1.2],
          [0.25, 0.85, -0.4, -0.3, -0.5, 1.2], [-0.25, 0.85, -0.4, 0.3, -0.5, 1.2], [0, 0.7, -0.6, 0, -0.9, 1.1]]) {
          this.inFrameRot('cone', head, x * hr, (y + h * 0.35) * hr, z * hr, 0.32 * hr, h * hr, 0.32 * hr, rot, C.ssj, tilt);
        }
      } else {
        this.inFrame('ball', head, 0, 0.55 * hr, 0.1 * hr, 1.0 * hr, 0.55 * hr, 1.05 * hr, L.hair);
        this.inFrame('ball', head, 0.25 * hr, 0.72 * hr, 0.55 * hr, 0.55 * hr, 0.32 * hr, 0.5 * hr, L.hair);
      }
      this.inFrame('box', head, 0, -0.55 * hr, 0.35 * hr, 1.35 * hr, 0.55 * hr, 0.9 * hr, L.skin);
      for (const sd of [1, -1]) this.inFrame('box', head, sd * 0.36 * hr, 0.38 * hr, 0.9 * hr, 0.36 * hr, 0.08 * hr, 0.06 * hr, st.ssj ? C.ssj : L.hair);
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      for (const sd of [1, -1]) this.inFrame('ball', chest, sd * 0.13 * s, 0.02 * s, tr * 0.72, tr * 0.42, tr * 0.32, tr * 0.32, L.shirt);
    } else if (ex === 'spoder') {
      // web lines on the mask
      for (const rot of [0, 0.6, Math.PI / 2, -0.6]) this.inFrameRot('cyl', head, 0, 0, 0, 1.015 * hr, 0.03 * hr, 1.015 * hr, rot, C.black);
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      this.inFrame('ball', chest, 0, 0.0, tr * 0.92, 0.08 * s, 0.11 * s, 0.03 * s, C.black);
    } else if (ex === 'croc') {
      this.inFrame('ball', head, 0, -0.12 * hr, 1.0 * hr, 0.52 * hr, 0.3 * hr, 0.8 * hr, L.skin);
      for (const sd of [1, -1]) {
        this.inFrame('box', head, sd * 0.4 * hr, -0.26 * hr, 1.05 * hr, 0.07 * hr, 0.1 * hr, 0.07 * hr, C.tooth);
        this.inFrame('box', head, sd * 0.36 * hr, -0.26 * hr, 1.4 * hr, 0.07 * hr, 0.1 * hr, 0.07 * hr, C.tooth);
        this.inFrame('ball', head, sd * 0.14 * hr, 0.02 * hr, 1.72 * hr, 0.06 * hr, 0.05 * hr, 0.05 * hr, C.black);
      }
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      for (const sd of [1, -1]) this.inFrame('box', chest, sd * 0.62 * s, 0.02 * s, -0.12 * s, 0.8 * s, 0.05 * s, 0.34 * s, C.wing);
      const lit = st.fuse != null && Math.floor(st.time * 14) % 2 === 0;
      this.inFrame('ball', chest, 0, -0.32 * s, tr + 0.14 * s, 0.22 * s, 0.22 * s, 0.22 * s, lit ? C.fuse : C.bomb);
      this.inFrame('cyl', chest, 0, -0.06 * s, tr + 0.16 * s, 0.03 * s, 0.12 * s, 0.03 * s, C.wood);
      if (st.fuse != null) this.inFrame('ball', chest, 0, 0.02 * s, tr + 0.16 * s, 0.06 * s, 0.06 * s, 0.06 * s, C.fuse);
    } else if (ex === 'ballerina') {
      this.inFrame('cyl', hips, 0, 0.02 * s, 0, 0.52 * s, 0.07 * s, 0.52 * s, L.shirt);
      this.inFrame('cyl', hips, 0, 0.09 * s, 0, 0.42 * s, 0.06 * s, 0.42 * s, C.white);
      this.inFrame('cyl', head, 0, 0.92 * hr, 0, 0.6 * hr, 0.55 * hr, 0.6 * hr, C.cup);
      this.inFrame('cyl', head, 0, 1.2 * hr, 0, 0.54 * hr, 0.03 * hr, 0.54 * hr, C.coffee);
      this.inFrame('ball', head, 0.66 * hr, 0.92 * hr, 0, 0.1 * hr, 0.2 * hr, 0.07 * hr, C.cup);
    } else if (ex === 'chimp') {
      this.inFrame('ball', head, 0, -0.3 * hr, 0.55 * hr, 0.62 * hr, 0.45 * hr, 0.48 * hr, L.face);
      for (const sd of [1, -1]) {
        this.inFrame('ball', head, sd * 0.98 * hr, 0.12 * hr, -0.05 * hr, 0.3 * hr, 0.34 * hr, 0.12 * hr, L.skin);
        this.inFrame('ball', head, sd * 1.0 * hr, 0.12 * hr, 0.0, 0.2 * hr, 0.24 * hr, 0.08 * hr, L.face);
      }
      const chest = frame(P, CHEST, PELVIS, LSH, RSH, _F3);
      for (const rot of [-0.7, 0, 0.7]) this.inFrameRot('cone', chest, Math.sin(rot) * 0.22 * s, 0.22 * s, -Math.cos(rot) * 0.05 * s, 0.14 * s, 0.4 * s, 0.05 * s, -rot, L.shirt, -0.3);
    } else if (ex === 'tree') {
      this.inFrame('ball', head, 0, 0.95 * hr, -0.1 * hr, 0.85 * hr, 0.7 * hr, 0.85 * hr, C.leaf);
      this.inFrame('ball', head, 0.55 * hr, 0.65 * hr, -0.2 * hr, 0.6 * hr, 0.55 * hr, 0.6 * hr, C.leaf2);
      this.inFrame('ball', head, -0.55 * hr, 0.7 * hr, -0.25 * hr, 0.62 * hr, 0.55 * hr, 0.6 * hr, C.leaf2);
      this.inFrameRot('cone', head, 0, -0.08 * hr, 1.35 * hr, 0.2 * hr, 1.1 * hr, 0.2 * hr, 0, C.nose, Math.PI / 2);
    } else if (ex === 'crown') {
      this.inFrame('cyl', head, 0, 0.78 * hr, 0, 0.62 * hr, 0.22 * hr, 0.62 * hr, C.gold);
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2;
        this.inFrame('cone', head, Math.cos(a) * 0.5 * hr, 1.05 * hr, Math.sin(a) * 0.5 * hr, 0.14 * hr, 0.4 * hr, 0.14 * hr, C.gold);
      }
    }
    if (st.weapon) this.drawWeapon(st.weapon, P, s, head);
    this.flash = 0;
  }

  inFrameRot(kind, F, ox, oy, oz, sx, sy, sz, rot, col, tilt = 0) {
    // rotate the X/Y axes within the frame's XY plane by rot; tilt rotates Y toward -Z.
    const c = Math.cos(rot), sn = Math.sin(rot);
    const X = [F.X[0] * c + F.Y[0] * sn, F.X[1] * c + F.Y[1] * sn, F.X[2] * c + F.Y[2] * sn];
    let Y = [F.Y[0] * c - F.X[0] * sn, F.Y[1] * c - F.X[1] * sn, F.Y[2] * c - F.X[2] * sn];
    let Z = F.Z;
    if (tilt) {
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const Y2 = [Y[0] * ct + Z[0] * st, Y[1] * ct + Z[1] * st, Y[2] * ct + Z[2] * st];
      Z = [Z[0] * ct - Y[0] * st, Z[1] * ct - Y[1] * st, Z[2] * ct - Y[2] * st];
      Y = Y2;
    }
    this.inFrame(kind, { X, Y, Z, O: F.O }, 0, 0, 0, sx, sy, sz, col);
    // offset applied in original frame
    const m = this[kind], i = this.n[kind] - 1, a = m.instanceMatrix.array, o = i * 16;
    a[o + 12] += F.X[0] * ox + F.Y[0] * oy + F.Z[0] * oz;
    a[o + 13] += F.X[1] * ox + F.Y[1] * oy + F.Z[1] * oz;
    a[o + 14] += F.X[2] * ox + F.Y[2] * oy + F.Z[2] * oz;
  }

  // Weapons held in the right hand, pointing along the forearm.
  drawWeapon(kind, P, s, head) {
    const hx = P[RHA * 3], hy = P[RHA * 3 + 1], hz = P[RHA * 3 + 2];
    let dx = hx - P[REL * 3], dy = hy - P[REL * 3 + 1], dz = hz - P[REL * 3 + 2];
    const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
    this.drawItem(kind, hx, hy, hz, dx, dy, dz, head.Y, s);
  }
  drawItem(kind, hx, hy, hz, dx, dy, dz, up, s = 1) {
    // Build a frame: Z along the item, Y roughly "up", X = Y × Z.
    let ux = up[0], uy = up[1], uz = up[2];
    const dp = ux * dx + uy * dy + uz * dz; ux -= dx * dp; uy -= dy * dp; uz -= dz * dp;
    let un = Math.hypot(ux, uy, uz); if (un < 1e-3) { ux = 0; uy = 1; uz = 0; un = 1; }
    ux /= un; uy /= un; uz /= un;
    const xx = uy * dz - uz * dy, xy = uz * dx - ux * dz, xz = ux * dy - uy * dx;
    const F = { X: [xx, xy, xz], Y: [ux, uy, uz], Z: [dx, dy, dz], O: [hx, hy, hz] };
    if (kind === 'fish') {
      this.inFrame('ball', F, 0, 0, 0.4 * s, 0.13 * s, 0.22 * s, 0.4 * s, C.fishA);
      this.inFrame('ball', F, 0, 0.02 * s, 0.4 * s, 0.135 * s, 0.07 * s, 0.34 * s, C.fishB);
      this.inFrame('ball', F, 0, 0.2 * s, 0.4 * s, 0.03 * s, 0.09 * s, 0.18 * s, C.fishB);
      this.inFrameRot('cone', { ...F, O: [hx + dx * 0.86 * s, hy + dy * 0.86 * s, hz + dz * 0.86 * s] }, 0, 0, 0, 0.04 * s, 0.22 * s, 0.3 * s, 0, C.fishB, -Math.PI / 2);
      for (const sd of [1, -1]) {
        this.inFrame('ball', F, sd * 0.1 * s, 0.07 * s, 0.1 * s, 0.05 * s, 0.05 * s, 0.05 * s, C.white);
        this.inFrame('ball', F, sd * 0.13 * s, 0.07 * s, 0.1 * s, 0.03 * s, 0.03 * s, 0.03 * s, C.black);
      }
    } else if (kind === 'pan') {
      this._axis('cyl', hx - dx * 0.06, hy - dy * 0.06, hz - dz * 0.06, hx + dx * 0.4 * s, hy + dy * 0.4 * s, hz + dz * 0.4 * s, 0.035 * s, C.black);
      const cx = hx + dx * 0.68 * s, cy = hy + dy * 0.68 * s, cz = hz + dz * 0.68 * s;
      this._axis('cyl', cx - xx * 0.03, cy - xy * 0.03, cz - xz * 0.03, cx + xx * 0.03, cy + xy * 0.03, cz + xz * 0.03, 0.3 * s, C.pan);
      this._axis('cyl', cx + xx * 0.02, cy + xy * 0.02, cz + xz * 0.02, cx + xx * 0.04, cy + xy * 0.04, cz + xz * 0.04, 0.24 * s, C.panIn);
    } else if (kind === 'chancla') {
      this.inFrame('ball', F, 0, 0, 0.26 * s, 0.035 * s, 0.13 * s, 0.28 * s, C.chancla);
      this.inFrame('box', F, 0, 0, 0.2 * s, 0.07 * s, 0.2 * s, 0.03 * s, C.strap);
    } else if (kind === 'glove') {
      this.inFrame('ball', F, 0, 0, 0.12 * s, 0.32 * s, 0.32 * s, 0.32 * s, C.glove);
      this.inFrame('cyl', F, 0, 0, -0.12 * s, 0.2 * s, 0.14 * s, 0.2 * s, C.cuff);
      this.inFrame('ball', F, 0.2 * s, 0.18 * s, 0.1 * s, 0.13 * s, 0.13 * s, 0.13 * s, C.glove);
    } else if (kind === 'katana') {
      const at = (x, y, z) => [hx + xx * x + ux * y + dx * z, hy + xy * x + uy * y + dy * z, hz + xz * x + uz * y + dz * z];
      // wrapped grip, gold tsuba, long slightly-flat blade
      const g0 = at(0, 0, -0.16 * s), g1 = at(0, 0, 0.12 * s);
      this._axis('cyl', g0[0], g0[1], g0[2], g1[0], g1[1], g1[2], 0.038 * s, C.wrap);
      for (const z of [-0.1, 0, 0.08]) { const a = at(0, 0, z * s), b = at(0, 0, (z + 0.02) * s); this._axis('cyl', a[0], a[1], a[2], b[0], b[1], b[2], 0.042 * s, C.wrapB); }
      const t0 = at(0, 0, 0.12 * s), t1 = at(0, 0, 0.15 * s);
      this._axis('cyl', t0[0], t0[1], t0[2], t1[0], t1[1], t1[2], 0.09 * s, C.guard);
      this.inFrame('box', F, 0, 0.012 * s, 0.68 * s, 0.022 * s, 0.07 * s, 1.06 * s, C.blade);
      this.inFrameRot('cone', { ...F, O: at(0, 0.012 * s, 1.27 * s) }, 0, 0, 0, 0.022 * s, 0.14 * s, 0.07 * s, 0, C.blade, Math.PI / 2);
    } else if (kind === 'pistol' || kind === 'shotgun' || kind === 'gatling') {
      const at = (x, y, z) => [hx + xx * x + ux * y + dx * z, hy + xy * x + uy * y + dy * z, hz + xz * x + uz * y + dz * z];
      const rod = (x, y, z0, z1, r, col) => { const a = at(x, y, z0), b = at(x, y, z1); this._axis('cyl', a[0], a[1], a[2], b[0], b[1], b[2], r, col); };
      if (kind === 'pistol') {
        rod(0, 0.04 * s, -0.04 * s, 0.3 * s, 0.045 * s, C.gunPink);
        this.inFrame('box', F, 0, 0.07 * s, 0.1 * s, 0.075 * s, 0.05 * s, 0.3 * s, C.gunDark);
        this.inFrame('box', F, 0, -0.08 * s, -0.02 * s, 0.06 * s, 0.17 * s, 0.08 * s, C.gunDark);
        rod(0, 0.04 * s, 0.3 * s, 0.34 * s, 0.03 * s, C.steel);
      } else if (kind === 'shotgun') {
        for (const sd of [1, -1]) rod(sd * 0.036 * s, 0.03 * s, 0.05 * s, 0.86 * s, 0.032 * s, C.steel);
        this.inFrame('box', F, 0, 0.01 * s, 0.05 * s, 0.11 * s, 0.11 * s, 0.32 * s, C.gunDark);
        this.inFrame('box', F, 0, -0.05 * s, -0.24 * s, 0.08 * s, 0.14 * s, 0.32 * s, C.wood);
        rod(0, -0.04 * s, 0.34 * s, 0.6 * s, 0.05 * s, C.wood);
        rod(0, 0.03 * s, 0.8 * s, 0.85 * s, 0.085 * s, C.gunOrange);
      } else {
        rod(0, 0, -0.22 * s, 0.24 * s, 0.13 * s, C.gunDark);
        for (let k = 0; k < 6; k++) {
          const a = this.spin + k * Math.PI / 3;
          rod(Math.cos(a) * 0.07 * s, Math.sin(a) * 0.07 * s, 0.15 * s, 0.92 * s, 0.024 * s, C.steel);
        }
        rod(0, 0, 0.82 * s, 0.86 * s, 0.105 * s, C.gunCyan);
        rod(0, 0, 0.24 * s, 0.3 * s, 0.11 * s, C.gunCyan);
        this.inFrame('box', F, 0, 0.17 * s, -0.02 * s, 0.05 * s, 0.07 * s, 0.22 * s, C.gunDark);
      }
    } else if (kind === 'juice') {
      this._axis('cyl', hx, hy - 0.24 * s, hz, hx, hy + 0.24 * s, hz, 0.15 * s, C.juice);
      this._axis('cyl', hx, hy + 0.24 * s, hz, hx, hy + 0.28 * s, hz, 0.13 * s, C.steel);
      this._axis('cyl', hx, hy - 0.06 * s, hz, hx, hy + 0.08 * s, hz, 0.155 * s, C.juiceB);
    }
  }
}

const _F1 = { X: [0, 0, 0], Y: [0, 0, 0], Z: [0, 0, 0], O: [0, 0, 0] };
const _F2 = { X: [0, 0, 0], Y: [0, 0, 0], Z: [0, 0, 0], O: [0, 0, 0] };
const _F3 = { X: [0, 0, 0], Y: [0, 0, 0], Z: [0, 0, 0], O: [0, 0, 0] };
// Frame at particle o: Y = from `base` to `top` (or o - from), X = L - R, Z = X × Y (forward).
function frame(P, o, from, l, r, F, upTo) {
  let yx, yy, yz;
  if (upTo != null) { yx = P[upTo * 3] - P[o * 3]; yy = P[upTo * 3 + 1] - P[o * 3 + 1]; yz = P[upTo * 3 + 2] - P[o * 3 + 2]; }
  else { yx = P[o * 3] - P[from * 3]; yy = P[o * 3 + 1] - P[from * 3 + 1]; yz = P[o * 3 + 2] - P[from * 3 + 2]; }
  let n = Math.hypot(yx, yy, yz) || 1; yx /= n; yy /= n; yz /= n;
  let xx = P[l * 3] - P[r * 3], xy = P[l * 3 + 1] - P[r * 3 + 1], xz = P[l * 3 + 2] - P[r * 3 + 2];
  // forward = X × Y
  let zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
  n = Math.hypot(zx, zy, zz) || 1; zx /= n; zy /= n; zz /= n;
  // X = Y × Z (orthonormal)
  xx = yy * zz - yz * zy; xy = yz * zx - yx * zz; xz = yx * zy - yy * zx;
  F.X[0] = xx; F.X[1] = xy; F.X[2] = xz; F.Y[0] = yx; F.Y[1] = yy; F.Y[2] = yz; F.Z[0] = zx; F.Z[1] = zy; F.Z[2] = zz;
  F.O[0] = P[o * 3]; F.O[1] = P[o * 3 + 1]; F.O[2] = P[o * 3 + 2];
  return F;
}
