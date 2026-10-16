// Daily level: rooms + corridors on a tile grid, plus collision, navigation and the meshes.
import * as THREE from 'three';
import { RNG } from './rng.js';

export const T = 2;          // tile size in metres
export const WALL_H = 2.1;   // wall height

const THEMES = [
  { name: 'Ohio Backrooms', bg: 0x0b0905, floorA: 0x9a8a4c, floorB: 0x8c7d43, corridor: 0x6a5f34, wall: 0x3b331c, wallTop: 0xd7c26e, neon1: 0xffe14d, neon2: 0xff8a3d },
  { name: 'Skibidi Sewers', bg: 0x030f0c, floorA: 0x1f5245, floorB: 0x1a473c, corridor: 0x14352e, wall: 0x0c221d, wallTop: 0x36866f, neon1: 0x3dffb5, neon2: 0x3df2ff },
  { name: 'Vaporwave Mall', bg: 0x0c0517, floorA: 0x41297a, floorB: 0x37226a, corridor: 0x281a4a, wall: 0x1b1033, wallTop: 0x8455e0, neon1: 0xff4fd8, neon2: 0x3df2ff },
  { name: 'Sigma Grindset HQ', bg: 0x04060c, floorA: 0x2b3245, floorB: 0x252b3c, corridor: 0x1c2130, wall: 0x11141d, wallTop: 0x56628a, neon1: 0x5ea0ff, neon2: 0xf2f6ff },
  { name: 'Gyatt Gym', bg: 0x110306, floorA: 0x632330, floorB: 0x561e2a, corridor: 0x3d1520, wall: 0x230a11, wallTop: 0xb8425a, neon1: 0xff3d5a, neon2: 0xffb03d },
  { name: 'Rizz Lounge', bg: 0x0a0310, floorA: 0x4a1e46, floorB: 0x3f1a3c, corridor: 0x2e122c, wall: 0x1b0a1a, wallTop: 0xa8459c, neon1: 0xff6ad5, neon2: 0xffe14d },
  { name: 'Fanum Food Court', bg: 0x0d0702, floorA: 0x7a4a22, floorB: 0x6b401d, corridor: 0x4c2e15, wall: 0x2a190b, wallTop: 0xd88a3f, neon1: 0xff9a2f, neon2: 0x8dff5a },
  { name: 'Toilet Dimension', bg: 0x070a12, floorA: 0xc9d1de, floorB: 0xb7c0cf, corridor: 0x8d97a8, wall: 0x3a4152, wallTop: 0xe6ecf5, neon1: 0x3df2ff, neon2: 0x5ea0ff },
];

export function generateLevel(seed) {
  const rng = new RNG(seed);
  const W = 46, H = 46;
  const grid = new Uint8Array(W * H).fill(1);
  const roomId = new Int16Array(W * H).fill(-1);
  const theme = rng.pick(THEMES);
  const rooms = [];
  const target = rng.int(10, 14);
  for (let a = 0; a < 600 && rooms.length < target; a++) {
    const w = rng.int(5, 11), h = rng.int(5, 11);
    const x = rng.int(1, W - w - 2), y = rng.int(1, H - h - 2);
    if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }
  rooms.forEach((r, k) => {
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { grid[j * W + i] = 0; roomId[j * W + i] = k; }
  });

  // Connect: minimum spanning tree plus a few loops so you can kite enemies around.
  const d2 = (a, b) => (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
  const edges = [];
  const inTree = new Set([0]);
  while (inTree.size < rooms.length) {
    let best = null, bd = Infinity;
    for (const i of inTree) for (let j = 0; j < rooms.length; j++) {
      if (inTree.has(j)) continue;
      const dd = d2(rooms[i], rooms[j]);
      if (dd < bd) { bd = dd; best = [i, j]; }
    }
    edges.push(best); inTree.add(best[1]);
  }
  const extra = rng.int(3, 5);
  for (let k = 0, tries = 0; k < extra && tries < 80; tries++) {
    const i = rng.int(0, rooms.length - 1), j = rng.int(0, rooms.length - 1);
    if (i === j || d2(rooms[i], rooms[j]) > 22 * 22) continue;
    if (edges.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) continue;
    edges.push([i, j]); k++;
  }
  const carve = (i, j) => { if (i > 0 && j > 0 && i < W - 1 && j < H - 1) grid[j * W + i] = 0; };
  for (const [a, b] of edges) {
    const A = rooms[a], B = rooms[b];
    const cw = rng.chance(0.55) ? 2 : 3;
    const off = -Math.floor((cw - 1) / 2);
    const hFirst = rng.chance(0.5);
    const mx = hFirst ? B.cx : A.cx, my = hFirst ? A.cy : B.cy;
    const line = (x0, y0, x1, y1) => {
      const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
      let x = x0, y = y0;
      for (;;) {
        for (let t = 0; t < cw; t++) for (let u = 0; u < cw; u++) carve(x + off + t, y + off + u);
        if (x === x1 && y === y1) break;
        x += sx; y += sy;
      }
    };
    line(A.cx, A.cy, mx, my);
    line(mx, my, B.cx, B.cy);
  }

  // Start room: the one nearest the middle of the map.
  let start = 0, sd = Infinity;
  rooms.forEach((r, k) => { const dd = (r.cx - W / 2) ** 2 + (r.cy - H / 2) ** 2; if (dd < sd) { sd = dd; start = k; } });

  // Pillars in big rooms give cover and something to bounce bodies off.
  rooms.forEach((r, k) => {
    if (k === start || r.w < 8 || r.h < 8 || !rng.chance(0.75)) return;
    const style = rng.int(0, 2);
    const put = (i, j) => { grid[j * W + i] = 1; grid[j * W + i + 1] = 1; grid[(j + 1) * W + i] = 1; grid[(j + 1) * W + i + 1] = 1; };
    if (style === 0) put(r.cx - 1, r.cy - 1);
    else {
      const qx = Math.floor(r.w / 4), qy = Math.floor(r.h / 4);
      put(r.x + qx, r.y + qy); put(r.x + r.w - qx - 2, r.y + qy);
      put(r.x + qx, r.y + r.h - qy - 2); put(r.x + r.w - qx - 2, r.y + r.h - qy - 2);
    }
  });

  // Flood fill from the start; anything unreachable becomes wall.
  const seen = new Uint8Array(W * H);
  const sIdx = rooms[start].cy * W + rooms[start].cx;
  const stack = [sIdx]; seen[sIdx] = 1;
  while (stack.length) {
    const c = stack.pop(); const i = c % W, j = (c / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (j + dj) * W + i + di;
      if (!grid[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
  }
  const floorCells = [];
  for (let c = 0; c < W * H; c++) {
    if (!grid[c] && !seen[c]) grid[c] = 1;
    if (!grid[c]) floorCells.push(c); else roomId[c] = -1;
  }

  // Pickup spots: one per room (two in the biggest), on open floor away from walls.
  const spots = [];
  rooms.forEach((r, k) => {
    const n = r.w * r.h > 70 ? 2 : 1;
    for (let q = 0; q < n; q++) {
      for (let tries = 0; tries < 30; tries++) {
        const i = rng.int(r.x + 1, r.x + r.w - 2), j = rng.int(r.y + 1, r.y + r.h - 2);
        if (k === start && Math.abs(i - r.cx) + Math.abs(j - r.cy) < 2) continue;
        let ok = true;
        for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) if (grid[(j + dj) * W + i + di]) { ok = false; break; }
        if (ok && !spots.some(s => Math.abs(s.i - i) + Math.abs(s.j - j) < 3)) { spots.push({ i, j, room: k }); break; }
      }
    }
  });
  const melee = ['fish', 'pan', 'chancla', 'glove', 'katana'];
  const weapons = [...melee, 'pistol', 'shotgun', 'gatling'];
  spots.forEach((s, n) => {
    s.item = s.room === start ? 'pistol' : (rng.chance(0.28) ? 'juice' : weapons[(n + rng.int(0, 6)) % weapons.length]);
  });
  // Every map gets at least one of each gun.
  for (const g of ['pistol', 'shotgun', 'gatling']) {
    if (spots.some(s => s.item === g)) continue;
    const free = spots.filter(s => s.room !== start && s.item !== 'juice' && !['pistol', 'shotgun', 'gatling'].includes(s.item));
    if (free.length) free[rng.int(0, free.length - 1)].item = g;
  }

  // Glowing floor patterns per room.
  const glow = new Uint8Array(W * H);
  rooms.forEach(r => {
    const style = rng.int(0, 3);
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      const c = j * W + i; if (grid[c]) continue;
      const ring = (i === r.x + 1 || i === r.x + r.w - 2 || j === r.y + 1 || j === r.y + r.h - 2) && i > r.x && i < r.x + r.w - 1 && j > r.y && j < r.y + r.h - 1;
      if (style === 0 && ring) glow[c] = 1;
      if (style === 1 && (i + j) % 4 === 0) glow[c] = 1;
      if (style === 2 && (Math.abs(i - r.cx) <= 0 || Math.abs(j - r.cy) <= 0)) glow[c] = 1;
      if (style === 3 && Math.abs(i - r.cx) <= 1 && Math.abs(j - r.cy) <= 1) glow[c] = 1;
    }
  });

  return { W, H, grid, roomId, rooms, start, spots, floorCells, glow, theme,
    startPos: { x: (rooms[start].cx + 0.5) * T, z: (rooms[start].cy + 0.5) * T } };
}

// ---------- collision ----------
export function makeCollider(level) {
  const { W, H, grid } = level;
  const solid = (i, j) => i < 0 || j < 0 || i >= W || j >= H || grid[j * W + i] === 1;
  const out = { x: 0, z: 0, nx: 0, nz: 0, hit: false };
  function circle(x, z, r) {
    out.hit = false; out.nx = 0; out.nz = 0;
    let i = Math.floor(x / T), j = Math.floor(z / T);
    if (solid(i, j)) {
      // Deep inside a wall: pop out through the nearest open face.
      const fx = x - i * T, fz = z - j * T;
      let best = Infinity, bx = x, bz = z, nx = 0, nz = 0;
      if (!solid(i - 1, j) && fx < best) { best = fx; bx = i * T - 0.01; bz = z; nx = -1; nz = 0; }
      if (!solid(i + 1, j) && T - fx < best) { best = T - fx; bx = (i + 1) * T + 0.01; bz = z; nx = 1; nz = 0; }
      if (!solid(i, j - 1) && fz < best) { best = fz; bx = x; bz = j * T - 0.01; nx = 0; nz = -1; }
      if (!solid(i, j + 1) && T - fz < best) { best = T - fz; bx = x; bz = (j + 1) * T + 0.01; nx = 0; nz = 1; }
      if (best < Infinity) { x = bx; z = bz; out.nx = nx; out.nz = nz; out.hit = true; i = Math.floor(x / T); j = Math.floor(z / T); }
    }
    const fx = x - i * T, fz = z - j * T;
    if (fx < r && solid(i - 1, j)) { x = i * T + r; out.nx = 1; out.hit = true; }
    else if (fx > T - r && solid(i + 1, j)) { x = (i + 1) * T - r; out.nx = -1; out.hit = true; }
    if (fz < r && solid(i, j - 1)) { z = j * T + r; out.nz = 1; out.hit = true; }
    else if (fz > T - r && solid(i, j + 1)) { z = (j + 1) * T - r; out.nz = -1; out.hit = true; }
    for (let di = -1; di <= 1; di += 2) for (let dj = -1; dj <= 1; dj += 2) {
      if (!solid(i + di, j + dj) || solid(i + di, j) || solid(i, j + dj)) continue;
      const cx = di < 0 ? i * T : (i + 1) * T, cz = dj < 0 ? j * T : (j + 1) * T;
      const dx = x - cx, dz = z - cz, dd = dx * dx + dz * dz;
      if (dd < r * r && dd > 1e-8) {
        const d = Math.sqrt(dd); x = cx + dx / d * r; z = cz + dz / d * r;
        out.nx = dx / d; out.nz = dz / d; out.hit = true;
      }
    }
    out.x = x; out.z = z;
    return out;
  }
  function solidAt(x, z) { return solid(Math.floor(x / T), Math.floor(z / T)); }
  function los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.5);
    for (let k = 1; k < n; k++) if (solidAt(x0 + dx * k / n, z0 + dz * k / n)) return false;
    return true;
  }
  return { circle, solid, solidAt, los };
}

// ---------- navigation: BFS flow field toward the player ----------
export function makeNav(level) {
  const { W, H, grid } = level;
  const dist = new Int16Array(W * H);
  const q = new Int32Array(W * H);
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const free = (i, j) => i >= 0 && j >= 0 && i < W && j < H && grid[j * W + i] === 0;
  function compute(x, z) {
    dist.fill(-1);
    let si = Math.floor(x / T), sj = Math.floor(z / T);
    if (!free(si, sj)) return;
    let h = 0, t = 0;
    q[t++] = sj * W + si; dist[sj * W + si] = 0;
    while (h < t) {
      const c = q[h++], i = c % W, j = (c / W) | 0, dc = dist[c];
      for (const [di, dj] of N8) {
        const ni = i + di, nj = j + dj;
        if (!free(ni, nj)) continue;
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
        const n = nj * W + ni;
        if (dist[n] < 0) { dist[n] = dc + 1; q[t++] = n; }
      }
    }
  }
  const out = { x: 0, z: 0, ok: false };
  function next(x, z) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    out.ok = false;
    if (!free(i, j)) return out;
    let best = dist[j * W + i], bi = i, bj = j;
    if (best < 0) return out;
    for (const [di, dj] of N8) {
      const ni = i + di, nj = j + dj;
      if (!free(ni, nj)) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
      const d = dist[nj * W + ni];
      if (d >= 0 && d < best) { best = d; bi = ni; bj = nj; }
    }
    out.x = (bi + 0.5) * T; out.z = (bj + 0.5) * T; out.ok = true;
    return out;
  }
  const at = (x, z) => { const i = Math.floor(x / T), j = Math.floor(z / T); return free(i, j) ? dist[j * W + i] : -1; };
  return { compute, next, at, dist };
}

// ---------- meshes ----------
export function buildLevelMeshes(scene, level) {
  const { W, H, grid, roomId, glow, theme } = level;
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const cA = new THREE.Color(theme.floorA), cB = new THREE.Color(theme.floorB), cC = new THREE.Color(theme.corridor);
  const n1 = new THREE.Color(theme.neon1), n2 = new THREE.Color(theme.neon2);

  const floors = [], walls = [], glows = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i;
    if (!grid[c]) { floors.push(c); if (glow[c]) glows.push(c); continue; }
    let edge = false;
    for (let dj = -1; dj <= 1 && !edge; dj++) for (let di = -1; di <= 1; di++) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < W && nj < H && !grid[nj * W + ni]) { edge = true; break; }
    }
    if (edge) walls.push(c);
  }

  // Grout under the tiles glows faintly, so the floor reads as a lit grid.
  const groutMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.neon2).multiplyScalar(0.22) });
  const grout = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 0.04, T), groutMat, floors.length);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.08 });
  const floorMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(T * 0.93, 0.12, T * 0.93), floorMat, floors.length);
  floorMesh.receiveShadow = true;
  const tint = (k) => (k % 2 ? n1 : n2);
  floors.forEach((c, n) => {
    const i = c % W, j = (c / W) | 0, x = (i + 0.5) * T, z = (j + 0.5) * T;
    m4.makeTranslation(x, -0.06, z); floorMesh.setMatrixAt(n, m4);
    m4.makeTranslation(x, -0.1, z); grout.setMatrixAt(n, m4);
    const r = roomId[c];
    if (r >= 0) col.copy((i + j) % 2 ? cA : cB).lerp(tint(r), 0.07);
    else col.copy(cC);
    col.multiplyScalar(0.94 + ((i * 7 + j * 13) % 9) * 0.012);
    floorMesh.setColorAt(n, col);
  });
  group.add(grout, floorMesh);

  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const glowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(T * 0.62, 0.02, T * 0.62), glowMat, Math.max(1, glows.length));
  glows.forEach((c, n) => {
    const i = c % W, j = (c / W) | 0;
    m4.makeTranslation((i + 0.5) * T, 0.005, (j + 0.5) * T); glowMesh.setMatrixAt(n, m4);
    glowMesh.setColorAt(n, col.copy(tint(roomId[c] >= 0 ? roomId[c] + 1 : 0)).multiplyScalar(0.55));
  });
  glowMesh.count = glows.length;
  group.add(glowMesh);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(T, WALL_H, T), wallMat, walls.length);
  wallMesh.castShadow = true; wallMesh.receiveShadow = true;
  const capCol = new THREE.Color(theme.wall).lerp(new THREE.Color(theme.wallTop), 0.4);
  const capMat = new THREE.MeshStandardMaterial({ color: capCol, roughness: 0.7 });
  const capMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 0.08, T), capMat, walls.length);
  const wc = new THREE.Color(theme.wall);
  const trims = [];
  walls.forEach((c, n) => {
    const i = c % W, j = (c / W) | 0, x = (i + 0.5) * T, z = (j + 0.5) * T;
    m4.makeTranslation(x, WALL_H / 2, z); wallMesh.setMatrixAt(n, m4);
    wallMesh.setColorAt(n, col.copy(wc).multiplyScalar(0.9 + ((i * 5 + j * 3) % 5) * 0.05));
    m4.makeTranslation(x, WALL_H + 0.04, z); capMesh.setMatrixAt(n, m4);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < W && nj < H && !grid[nj * W + ni]) trims.push([x, z, di, dj]);
    }
  });
  group.add(wallMesh, capMesh);

  const trimTop = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: n1.clone().multiplyScalar(3.2) }), trims.length);
  const trimBot = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: n2.clone().multiplyScalar(1.6) }), trims.length);
  const s = new THREE.Vector3(), p = new THREE.Vector3(), qn = new THREE.Quaternion();
  trims.forEach(([x, z, di, dj], n) => {
    const along = di !== 0 ? [0.09, T + 0.02] : [T + 0.02, 0.09];
    p.set(x + di * (T / 2 - 0.045), WALL_H + 0.1, z + dj * (T / 2 - 0.045));
    s.set(along[0], 0.06, along[1]); m4.compose(p, qn, s); trimTop.setMatrixAt(n, m4);
    p.set(x + di * (T / 2 + 0.015), 0.07, z + dj * (T / 2 + 0.015));
    s.set(di !== 0 ? 0.03 : T, 0.05, di !== 0 ? T : 0.03); m4.compose(p, qn, s); trimBot.setMatrixAt(n, m4);
  });
  group.add(trimTop, trimBot);

  scene.add(group);
  return { group, glowMat, groutMat, trimTopMat: trimTop.material };
}
