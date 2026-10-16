import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RNG, hashSeed, todayKey, dayNumber, msUntilTomorrowUTC } from './rng.js';
import { T, generateLevel, makeCollider, makeNav, buildLevelMeshes } from './level.js';
import { Body, stepWorld, collideBodies, poseWalk, HEAD, CHEST, PELVIS, LSH, RSH, LEL, REL, LHA, RHA, LFT, RFT, LKN, RKN, NP } from './ragdoll.js';
import { TYPES, GENERIC, HIT_LINES, KILL_TEXT, PLAYER_LOOK, WEAPONS, ITEM_COLORS, MELEE, GUNS, CharRenderer, prepLook } from './chars.js';
import * as SFX from './audio.js';
import { FX, project } from './fx.js';
import { Board, cleanTag } from './board.js';

const $ = (s) => document.querySelector(s);
const DAY = todayKey();
const DAYNUM = dayNumber(DAY);
const SEED = hashSeed('slaprot:' + DAY);
const level = generateLevel(SEED);
const theme = level.theme;
const col = makeCollider(level);
const nav = makeNav(level);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
document.documentElement.style.setProperty('--accent', hex(theme.neon1));
document.documentElement.style.setProperty('--accent2', hex(theme.neon2));

// ---------- renderer ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(DPR);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
scene.background = new THREE.Color(theme.bg);
scene.fog = new THREE.Fog(theme.bg, 30, 64);
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 220);
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0xe6ecff, new THREE.Color(theme.bg).lerp(new THREE.Color(theme.neon2), 0.25), 0.85));
const sun = new THREE.DirectionalLight(0xfff2e0, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const plight = new THREE.PointLight(theme.neon1, 7, 11, 1.4);
scene.add(plight);
const boomLight = new THREE.PointLight(0xff9a3d, 0, 16, 1.3);
scene.add(boomLight);
// Kamehameha beam: a white-hot core inside a cyan glow, an impact ball at the far end, and a charging orb.
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const beamMat = (c, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.15), transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const beamOuter = new THREE.Mesh(beamGeo, beamMat(0x2f8fff, 0.35));
const beamCore = new THREE.Mesh(beamGeo, beamMat(0xd8fbff, 0.8));
const orbGeo = new THREE.SphereGeometry(1, 24, 16);
const beamEnd = new THREE.Mesh(orbGeo, beamMat(0x5fd0ff, 0.5));
const beamOrb = new THREE.Mesh(orbGeo, beamMat(0xbff6ff, 0.7));
for (const m of [beamOuter, beamCore, beamEnd, beamOrb]) { m.visible = false; m.frustumCulled = false; scene.add(m); }
const kameLight = new THREE.PointLight(0x5fd0ff, 0, 22, 1.2);
scene.add(kameLight);
const ssjLight = new THREE.PointLight(0xffd23d, 0, 9, 1.3);
scene.add(ssjLight);

const LV = buildLevelMeshes(scene, level);
const cr = new CharRenderer(scene, 150);
const fx = new FX(scene, $('#fx'));
const board = new Board(DAY);

// pickup pads + labels
const padGeo = new THREE.RingGeometry(0.62, 0.82, 44).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(0.62, 44).rotateX(-Math.PI / 2);
const pickups = level.spots.map((s) => {
  const ring = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
  const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
  const x = (s.i + 0.5) * T, z = (s.j + 0.5) * T;
  ring.position.set(x, 0.03, z); disc.position.set(x, 0.025, z);
  scene.add(ring, disc);
  const label = document.createElement('div'); label.className = 'plabel'; label.hidden = true; $('#fx').appendChild(label);
  const pk = { x, z, item: s.item, base: s.item, active: true, respawn: 0, ring, disc, label };
  tintPad(pk);
  return pk;
});
function tintPad(pk) {
  const c = new THREE.Color(ITEM_COLORS[pk.item]);
  pk.ring.material.color.copy(c).multiplyScalar(2.2);
  pk.disc.material.color.copy(c);
  pk.label.textContent = pk.item === 'juice' ? 'AURA JUICE' : WEAPONS[pk.item].name.toUpperCase();
}

const LOOKS = Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, prepLook(t.look)]));
const PLOOK = prepLook(PLAYER_LOOK);

// ---------- state ----------
const PH = 1 / 120;
let bodies = [], enemies = [], pending = [], bullets = [], eshots = [];
const WEB_COL = new THREE.Color(0xffffff).multiplyScalar(2.2);
const KI_MAX = 25;        // kills needed to charge a Kamehameha
const KAME_DUR = 10;      // seconds, charge-up included
const KAME_CHARGE = 1.1;  // "ka... me... ha... me..." before the beam fires
let boomT = 0;
const TRACER = Object.fromEntries(GUNS.map(k => [k, new THREE.Color(WEAPONS[k].tracer).multiplyScalar(3)]));
let muzzleFlash = 0;
let player = null;
let G = null;
let mode = 'menu';         // menu | play | dying | over | paused
let animT = 0, acc = 0, hitstop = 0, shake = 0;
const camTarget = new THREE.Vector3(level.startPos.x, 0, level.startPos.z);
const camPos = new THREE.Vector3();
let menuAngle = 0;
let camZoom = 1;
addEventListener('wheel', (e) => { if (mode === 'play') camZoom = Math.max(0.75, Math.min(1.6, camZoom + Math.sign(e.deltaY) * 0.07)); }, { passive: true });

function resetWorld() {
  bodies = []; enemies = []; pending = []; bullets = []; eshots = [];
  fx.clearBubbles();
  for (const pk of pickups) { pk.item = pk.base; pk.active = true; pk.respawn = 0; tintPad(pk); pk.ring.visible = pk.disc.visible = true; }
}

function makePlayer() {
  const b = new Body(1, 1.3, 1);
  b.place(level.startPos.x, level.startPos.z, Math.PI);
  b.kp = 0.45; b.kd = 0.55;
  const p = { kind: 'player', body: b, hp: 100, max: 100, vx: 0, vz: 0, ph: 0, slapT: -1, slapDur: 0.24, side: 1, hitDone: false, cd: 0,
    weapon: 'hand', uses: Infinity, dashT: 0, dashCd: 0, dashX: 0, dashZ: 0, inv: 0, flash: 0, alive: true, wobble: 0, aimX: 0, aimZ: -1, recoil: 0, spin: 0 };
  b.owner = p; bodies.push(b);
  return p;
}

let eid = 0;
function makeEnemy(key, x, z) {
  const ty = TYPES[key];
  const b = new Body(ty.scale, ty.mass, ty.look.head ?? 1);
  b.place(x, z, Math.random() * Math.PI * 2);
  const drop = 2.6 + Math.random() * 1.2;
  for (let i = 0; i < NP; i++) { b.p[i * 3 + 1] += drop; b.o[i * 3 + 1] += drop; }
  b.drive = 0;
  // a little spin on the way down
  b.kick(HEAD, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3, PH);
  const e = { id: ++eid, kind: 'enemy', key, ty, look: LOOKS[key], body: b, hp: ty.hp, state: 'down', st: 0.35, vx: 0, vz: 0,
    ph: Math.random() * 6, atk: -1, atkCd: 0.6 + Math.random(), flash: 0, lastSlap: -9, bumpCd: 0, dead: false, deadT: 0, sink: false,
    riseT: 0, talkUntil: 0, wob: Math.random() * 10, blinkT: 1 + Math.random() * 3, losT: Math.random() * 0.3, los: false, landed: false,
    leap: null, leapCd: 1.2 + Math.random() * 1.5, webCd: 1.5 + Math.random() * 2, webT: -1, fuse: null, exploded: false };
  b.owner = e;
  bodies.push(b); enemies.push(e);
  return e;
}

// ---------- input ----------
const keys = new Set();
const input = { slap: false, holdSlap: false, dash: false, mx: innerWidth / 2, my: innerHeight / 2, mouseSeen: false };
const touch = { on: false, sx: 0, sy: 0, x: 0, y: 0, id: null, slapHeld: false };
addEventListener('keydown', (e) => {
  if (!$('#help').hidden) { if (e.code === 'Escape' || e.code === 'Enter') { closeHelp(); e.preventDefault(); } return; }
  if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') startRun(); return; }
  keys.add(e.code);
  if (mode === 'play') {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { input.dash = true; e.preventDefault(); }
    if (e.code === 'KeyJ' || e.code === 'KeyK' || e.code === 'Enter') input.slap = true;
    if (e.code === 'Digit1' || e.code === 'Numpad1') input.kame = true;
    if (e.code === 'Escape' || e.code === 'KeyP') setPaused(true);
  } else if (mode === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(false);
  else if ((mode === 'over' || mode === 'menu') && (e.code === 'Enter' || (mode === 'over' && e.code === 'KeyR'))) startRun();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); input.holdSlap = false; if (mode === 'play') setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setPaused(true); });
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { input.mx = e.clientX; input.my = e.clientY; input.mouseSeen = true; } });
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  input.mx = e.clientX; input.my = e.clientY; input.mouseSeen = true;
  if (mode !== 'play') return;
  if (e.button === 0) { input.slap = true; input.holdSlap = true; }
  if (e.button === 2) input.dash = true;
});
addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) input.holdSlap = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const stick = $('#stick'), knob = $('#knob');
stick.addEventListener('pointerdown', (e) => {
  touch.on = true; touch.id = e.pointerId; const r = stick.getBoundingClientRect();
  touch.sx = r.left + r.width / 2; touch.sy = r.top + r.height / 2; touch.x = e.clientX; touch.y = e.clientY;
  stick.setPointerCapture(e.pointerId); e.preventDefault();
});
stick.addEventListener('pointermove', (e) => { if (touch.on && e.pointerId === touch.id) { touch.x = e.clientX; touch.y = e.clientY; } });
const endStick = (e) => { if (e.pointerId === touch.id) { touch.on = false; knob.style.transform = ''; } };
stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
$('#tSlap').addEventListener('pointerdown', (e) => { e.preventDefault(); input.slap = true; touch.slapHeld = true; });
$('#tSlap').addEventListener('pointerup', () => { touch.slapHeld = false; });
$('#tSlap').addEventListener('pointercancel', () => { touch.slapHeld = false; });
$('#tDash').addEventListener('pointerdown', (e) => { e.preventDefault(); input.dash = true; });
$('#tKame').addEventListener('pointerdown', (e) => { e.preventDefault(); input.kame = true; });

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2), ndc = new THREE.Vector2(), hitV = new THREE.Vector3();
function mouseAim() {
  ndc.set(input.mx / innerWidth * 2 - 1, -(input.my / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hitV);
}

// ---------- run flow ----------
function startRun() {
  if (mode === 'play' || mode === 'dying') return;
  SFX.initAudio();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  board.setTag($('#tag').value);
  resetWorld();
  player = makePlayer();
  G = { packs: {}, packSeq: 0, ki: 0, lastHow: 'slap', time: 0, kills: 0, aura: 0, combo: 0, lastKill: -9, spawnT: 1.2, nextWave: 45, wave: 0, nextBoss: 150, shoutT: 1.5,
    rng: new RNG(SEED ^ 0x9e3779b9), lastThud: 0, deathT: 0, best: board.myBest(), firstBlood: false, strikes: 0 };
  // a welcoming committee
  for (let k = 0; k < 3; k++) queueSpawn('skibidi', 0.4 + k * 0.5);
  camTarget.set(player.body.x, 0, player.body.z);
  mode = 'play';
  showScreen(null);
  $('#hud').hidden = false;
  $('#touch').hidden = !isTouch;
  scene.fog.near = 30; scene.fog.far = 64;
  banner('SURVIVE', 'slap the brainrot back to Ohio');
  SFX.setIntensity(0);
}

function setPaused(p) {
  if (p && mode === 'play') { mode = 'paused'; showScreen('#pause'); SFX.hush(); }
  else if (!p && mode === 'paused') { mode = 'play'; showScreen(null); }
}
$('#pauseBtn').addEventListener('click', () => setPaused(true));
$('#resume').addEventListener('click', () => setPaused(false));
$('#quit').addEventListener('click', () => { mode = 'play'; showScreen(null); killPlayer(0, 0); });
$('#play').addEventListener('click', startRun);
// How to play: opens from the menu or pause screen, and once automatically on a first visit.
function openHelp() { $('#help').hidden = false; $('#help').scrollTop = 0; $('#helpClose').focus({ preventScroll: true }); }
function closeHelp() { $('#help').hidden = true; try { localStorage.setItem('slaprot.helpSeen', '1'); } catch {} }
$('#helpBtn').addEventListener('click', openHelp);
$('#helpBtn2').addEventListener('click', openHelp);
$('#helpClose').addEventListener('click', closeHelp);
$('#help').addEventListener('click', (e) => { if (e.target.id === 'help') closeHelp(); });
try { if (!localStorage.getItem('slaprot.helpSeen')) openHelp(); } catch {}
$('#retry').addEventListener('click', startRun);
$('#toMenu').addEventListener('click', () => { mode = 'menu'; showScreen('#menu'); $('#hud').hidden = true; $('#touch').hidden = true; renderBoards(); });

function showScreen(sel) {
  for (const id of ['#menu', '#over', '#pause']) $(id).hidden = id !== sel;
}

async function endRun() {
  mode = 'over';
  $('#hud').hidden = true; $('#touch').hidden = true;
  const t = G.time;
  $('#oTime').textContent = fmtTime(t, true);
  $('#oKills').textContent = G.kills;
  $('#oRank').textContent = '…';
  $('#oBest').hidden = true;
  $('#oNote').textContent = '';
  showScreen('#over');
  const res = await board.submit(t, G.kills);
  $('#oBest').hidden = !res.improved;
  $('#oRank').textContent = board.online ? '#' + board.rankOf(Math.max(t, board.myBest())) : '-';
  $('#oNote').textContent = boardNote(res);
  renderBoards();
}

function boardNote(res) {
  const best = board.myBest();
  const runs = board.myRuns();
  let s = `Your best today: ${fmtTime(best, true)} across ${runs} run${runs === 1 ? '' : 's'}.`;
  if (board.status === 'local') s += ' Scores are saved on this device only here. Open the published game to compete on the shared board.';
  else if (board.status === 'readonly' || (res && res.error)) s += ' You can see the board but your account can\'t post to it. Ask the owner for Contributor access.';
  return s;
}

// ---------- spawning ----------
function pickType(t) {
  const w = {
    skibidi: 10,
    fanum: t > 12 ? 3 + t / 25 : 0,
    tralalero: t > 20 ? 5 : 0,
    sigma: t > 30 ? 3 + t / 35 : 0,
    tung: t > 55 ? 2.5 + t / 45 : 0,
    brute: t > 85 ? 1.5 + t / 60 : 0,
    ballerina: t > 15 ? 3 : 0,
    chimp: t > 25 ? 3 + t / 60 : 0,
    bombardiro: t > 35 ? 2 + t / 80 : 0,
    sanic: t > 40 ? 2 + t / 70 : 0,
    spoder: t > 50 ? 2 + t / 60 : 0,
    patapim: t > 75 ? 1.5 + t / 70 : 0,
    knuckles: t > 30 ? 1.3 + t / 150 : 0,
    chad: t > 45 && enemies.filter(e => e.key === 'chad' && !e.dead).length < 3 ? 1.2 + t / 120 : 0,
  };
  let sum = 0; for (const k in w) sum += w[k];
  let r = G.rng.next() * sum;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'skibidi';
}
function queueSpawn(key, delay = 0) {
  const px = player.body.x, pz = player.body.z;
  let x = 0, z = 0, ok = false;
  for (let tries = 0; tries < 50 && !ok; tries++) {
    const c = level.floorCells[Math.floor(G.rng.next() * level.floorCells.length)];
    x = (c % level.W + 0.5) * T; z = (((c / level.W) | 0) + 0.5) * T;
    const d = nav.at(x, z);
    const near = tries < 30 ? 7 : 4;
    if (d < near || d > 30) continue;
    if (Math.hypot(x - px, z - pz) < (tries < 30 ? 11 : 7)) continue;
    ok = true;
  }
  if (!ok) return;
  x += (G.rng.next() - 0.5) * 0.8; z += (G.rng.next() - 0.5) * 0.8;
  const big = key === 'boss' || key === 'brute' || key === 'knuckles';
  if (key === 'knuckles') {
    // Ugandan Knuckles only travel in packs of 3-6.
    const n = 3 + Math.floor(G.rng.next() * 4), pack = ++G.packSeq;
    G.packs[pack] = { t: 1.2 + G.rng.next() };
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, r = k ? 0.9 : 0;
      let px2 = x + Math.cos(a) * r, pz2 = z + Math.sin(a) * r;
      if (col.solidAt(px2, pz2)) { px2 = x; pz2 = z; }
      pending.push({ key, x: px2, z: pz2, t: 0.75 + delay + k * 0.07, ring: null, delay, pack });
    }
  } else pending.push({ key, x, z, t: 0.75 + delay, ring: null, delay });
  if (!delay) portal(x, z, big);
}
function portal(x, z, big) {
  fx.ring(x, 0.06, z, theme.neon1, 0.25, 0.75, 0.95, big ? 2.4 : 1.5);
  fx.ring(x, 0.06, z, theme.neon2, big ? 2.2 : 1.4, 0.75, 0.5, 0.2);
  if (Math.hypot(x - player.body.x, z - player.body.z) < 22) SFX.play('spawn', 0.8);
}
function updateSpawns(dt) {
  const t = G.time;
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i];
    p.t -= dt;
    if (p.delay && p.t <= 0.75) { p.delay = 0; portal(p.x, p.z, p.key === 'boss'); }
    if (p.t <= 0) {
      pending.splice(i, 1);
      const e = makeEnemy(p.key, p.x, p.z);
      if (p.pack) e.pack = p.pack;
      if (p.key === 'boss') { fx.bubble(e, 'I AM THE FINAL BOSS', 2.5, 'boss'); e.talkUntil = animT + 2.5; SFX.speak('I am the final boss of Ohio', 0.2, 0.8, true); }
    }
  }
  const alive = enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
  const maxAlive = Math.min(85, 5 + Math.floor(t * 0.32));
  const interval = Math.max(0.24, 1.9 / (1 + t / 40));
  G.spawnT -= dt;
  if (G.spawnT <= 0 && alive + pending.length < maxAlive) {
    G.spawnT = interval * (0.7 + G.rng.next() * 0.6);
    queueSpawn(pickType(t));
  }
  if (t >= G.nextWave) {
    G.wave++; G.nextWave += 45;
    const subs = ['the skibidi horde approaches', 'sigma males incoming', 'fanum tax season', 'ohio has breached containment',
      'brainrot levels critical', 'your aura is in danger', 'they will not stop yapping', 'the group chat has arrived'];
    banner('WAVE ' + G.wave, subs[(G.wave - 1) % subs.length]);
    SFX.play('wave');
    const n = 5 + G.wave * 2;
    for (let k = 0; k < n; k++) queueSpawn(pickType(t + 20), k * 0.12);
  }
  if (t >= G.nextBoss) {
    G.nextBoss += 120;
    banner('OHIO FINAL BOSS', 'has entered the chat');
    SFX.play('wave');
    queueSpawn('boss', 0.3);
  }
  SFX.setIntensity(t < 15 ? 0 : t < 40 ? 1 : t < 90 ? 2 : 3);
}

// ---------- player ----------
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
function angTo(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, k); }

function updatePlayer(dt) {
  const P = player, b = P.body;
  P.cd -= dt; P.dashCd -= dt; P.inv -= dt; P.flash = Math.max(0, P.flash - dt * 6);
  if (!P.alive) { b.x = b.p[PELVIS * 3]; b.z = b.p[PELVIS * 3 + 2]; return; }
  // move
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (touch.on) {
    let dx = touch.x - touch.sx, dy = touch.y - touch.sy; const d = Math.hypot(dx, dy), R = 50;
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (d > 8) { mx = dx / R; mz = dy / R; }
  }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  P.webbed = Math.max(0, (P.webbed || 0) - dt);
  const speed = 6.4 * (P.webbed > 0 ? 0.42 : 1) * (P.kame ? 0.5 : 1);
  if (P.webbed > 0 && Math.random() < dt * 5) fx.ring(b.x, 0.05, b.z, 0xffffff, 1.0, 0.35, 0.7, 0.4);
  if (input.dash && P.dashCd <= 0) {
    let dx = mx, dz = mz;
    if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(b.h); dz = Math.cos(b.h); }
    const dl = Math.hypot(dx, dz); P.dashX = dx / dl; P.dashZ = dz / dl;
    P.dashT = 0.2; P.dashCd = 1.1; P.inv = Math.max(P.inv, 0.3); P.webbed = 0;
    SFX.play('dash');
    fx.burst(b.x, 0.3, b.z, 10, theme.neon2, 3, 0.07, 1, 0.3);
    // melee weapons swing through the dash and slap everything along the way
    if (!WEAPONS[P.weapon].gun && !P.kame) {
      P.dashHits = new Set(); P.dashWore = false;
      P.side = P.weapon === 'hand' ? -P.side : 1;
      P.slapT = 0; P.slapDur = 0.24; P.hitDone = true; P.cd = Math.max(P.cd, 0.2);
      SFX.play('whoosh', 1.4);
    } else P.dashHits = null;
  }
  input.dash = false;
  if (P.dashT > 0 && P.dashHits) dashSlap();
  let tvx = mx * speed, tvz = mz * speed;
  if (P.slapT >= 0) { tvx *= 0.75; tvz *= 0.75; }
  if (P.dashT > 0) { P.dashT -= dt; tvx = P.dashX * 17; tvz = P.dashZ * 17; if (Math.random() < 0.6) fx.burst(b.x, 0.9, b.z, 1, theme.neon2, 0.5, 0.12, 0.5, 0); }
  const k = Math.min(1, dt * (P.dashT > 0 ? 30 : 14));
  P.vx += (tvx - P.vx) * k; P.vz += (tvz - P.vz) * k;
  // crowd pressure (dash slips through)
  if (P.dashT <= 0) {
    for (const e of enemies) {
      if (e.dead || e.state === 'down') continue;
      const dx = b.x - e.body.x, dz = b.z - e.body.z, d = Math.hypot(dx, dz), R = 0.45 + 0.38 * e.ty.scale;
      if (d < R && d > 1e-3) { const push = (R - d) / d * (e.ty.mass > 1.5 ? 0.7 : 0.4); b.x += dx * push; b.z += dz * push; }
    }
  }
  b.x += P.vx * dt; b.z += P.vz * dt;
  const r = col.circle(b.x, b.z, 0.36); b.x = r.x; b.z = r.z;

  // aim
  if (input.mouseSeen && !isTouch) {
    const a = mouseAim();
    if (a) { const dx = a.x - b.x, dz = a.z - b.z; if (Math.hypot(dx, dz) > 0.3) { P.aimX = dx; P.aimZ = dz; } }
  } else {
    const tgt = nearestEnemy(b.x, b.z, WEAPONS[P.weapon].gun ? 13 : 5.5);
    if (tgt) { P.aimX = tgt.body.x - b.x; P.aimZ = tgt.body.z - b.z; }
    else if (ml > 0.2) { P.aimX = mx; P.aimZ = mz; }
  }
  b.h = angTo(b.h, Math.atan2(P.aimX, P.aimZ), dt * (P.kame ? 4.5 : 22));

  // slap
  const wantAttack = input.slap || input.holdSlap || touch.slapHeld;
  if (input.kame && !P.kame && G.ki >= KI_MAX) startKame();
  input.kame = false;
  if (P.kame) updateKame(dt);
  else if (WEAPONS[P.weapon].gun) { if (wantAttack && P.cd <= 0) fireGun(); }
  else if (wantAttack && P.cd <= 0) startSlap();
  P.recoil = Math.max(0, P.recoil - dt * 9);
  input.slap = false;
  if (P.slapT >= 0 && P.weapon === 'katana' && P.slapT > 0.3 && P.slapT < 0.68) {
    // white slash trail off the blade tip
    const hx = b.p[RHA * 3], hy = b.p[RHA * 3 + 1], hz = b.p[RHA * 3 + 2];
    let ax = hx - b.p[REL * 3], ay = hy - b.p[REL * 3 + 1], az = hz - b.p[REL * 3 + 2];
    const al = Math.hypot(ax, ay, az) || 1;
    for (let k = 0; k < 3; k++) { const d = (0.55 + k * 0.3) / al; fx.burst(hx + ax * d, hy + ay * d, hz + az * d, 1, 0xdfe9ff, 0.3, 0.06, 0, 0); }
  }
  if (P.slapT >= 0) {
    P.slapT += dt / P.slapDur;
    if (!P.hitDone && P.slapT >= 0.42) { P.hitDone = true; slapHits(); }
    if (P.slapT >= 1) P.slapT = -1;
  }

  // pose
  const sp = Math.hypot(P.vx, P.vz);
  P.ph += sp * dt * 2.3;
  b.resetPose();
  // which way are we moving relative to facing? walk cycle runs backwards when backpedalling
  const fwd = (P.vx * Math.sin(b.h) + P.vz * Math.cos(b.h)) / (sp || 1);
  poseWalk(b, fwd < -0.3 ? -P.ph : P.ph, Math.min(1, sp / 5), 0.06 * Math.min(1, sp / 5));
  // guard
  const wpn = WEAPONS[P.weapon];
  if (P.kame) poseKame(b, P.kame);
  else if (wpn.gun) poseGun(b, wpn, P.recoil);
  else {
    b.set(LHA, 0.28, 1.32, 0.34); b.set(LEL, 0.38, 1.12, 0.1);
    b.set(RHA, -0.28, 1.32, 0.34); b.set(REL, -0.38, 1.12, 0.1);
    if (P.slapT >= 0) poseSlap(b, P.slapT, P.side, wpn);
  }
  if (P.dashT > 0) { b.add(HEAD, 0, -0.08, 0.25); b.add(CHEST, 0, -0.05, 0.18); }
  b.drive = Math.min(1, b.drive + dt * 3);
}

// Arms out, gun level; two-handed guns get a supporting left hand. Recoil snaps the arms back.
function poseGun(b, w, rc) {
  const k = rc * (w.twoHand ? 0.22 : 0.14);
  b.set(RHA, -0.13, 1.36 + rc * 0.04, 0.6 - k); b.set(REL, -0.15, 1.33, 0.3 - k * 0.6);
  if (w.twoHand) { b.set(LHA, -0.04, 1.33, 0.86 - k); b.set(LEL, 0.24, 1.22, 0.42 - k * 0.6); }
  else { b.set(LHA, 0.3, 1.2, 0.2); b.set(LEL, 0.38, 1.1, 0.02); }
  b.add(HEAD, 0, 0, 0.04 - k * 0.3); b.add(CHEST, 0, 0, -k * 0.4);
  b.add(RSH, 0, 0, 0.06); b.add(LSH, 0, 0, w.twoHand ? 0.1 : -0.04);
}

function fireGun() {
  const P = player, b = P.body, w = WEAPONS[P.weapon];
  P.cd = w.cd; P.recoil = w.noRecoil ? 0 : 1;
  const fx0 = Math.sin(b.h), fz0 = Math.cos(b.h);
  // Bullets leave from the actual barrel tip: the hand plus the gun's length along the forearm.
  const hx = b.p[RHA * 3], hy = b.p[RHA * 3 + 1], hz = b.p[RHA * 3 + 2];
  let ax = hx - b.p[REL * 3], ay = hy - b.p[REL * 3 + 1], az = hz - b.p[REL * 3 + 2];
  const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
  const mx = hx + ax * w.muzzle, my = hy + ay * w.muzzle + 0.02, mz = hz + az * w.muzzle;
  // the muzzle can poke through a wall when hugging it; fire from the body instead
  const ox = col.los(b.x, b.z, mx, mz) ? mx : b.x, oz = col.los(b.x, b.z, mx, mz) ? mz : b.z;
  for (let k = 0; k < w.pellets; k++) {
    const a = b.h + (Math.random() - 0.5) * w.spread;
    bullets.push({ x: ox, y: my + (Math.random() - 0.5) * 0.06, z: oz, dx: Math.sin(a), dz: Math.cos(a), left: w.range, travelled: 0, w, col: TRACER[P.weapon] });
  }
  if (P.weapon === 'gatling') P.spin += 0.9;
  if (w.noRecoil) {
    // rapid fire: a small flicker at the barrel, so the gun and tracers stay readable
    muzzleFlash = Math.max(muzzleFlash, 0.3);
    if (Math.random() < 0.5) fx.burst(mx, my, mz, 1, 0xffffff, 1.2, 0.07, 0.1, 0);
  } else {
    muzzleFlash = 1;
    fx.burst(mx, my, mz, w.pellets > 1 ? 14 : 5, w.tracer, w.pellets > 1 ? 6 : 3.5, 0.06, 0.4, 0.2);
    fx.burst(mx, my, mz, 3, 0xffffff, 2, 0.09, 0.2, 0);
  }
  shake = Math.min(1.2, shake + w.kick);
  if (!w.noRecoil) { P.vx -= fx0 * w.kick * 9; P.vz -= fz0 * w.kick * 9; }
  SFX.play(w.sfx);
  if (--P.uses <= 0) {
    const s2 = project(camera, b.x, 2.6, b.z, innerWidth, innerHeight);
    fx.text(s2.x, s2.y, 'OUT OF AMMO', 'item');
    SFX.play('empty');
    P.weapon = 'hand'; P.uses = Infinity; P.cd = 0.25;
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const B = bullets[i], w = B.w;
    const step = Math.min(w.speed * dt, B.left);
    const sx = B.dx * step, sz = B.dz * step;
    // nearest enemy sphere along this segment
    let bestT = Infinity, bestE = null, bestJ = CHEST;
    for (const e of enemies) {
      if (e.dead || e.sink) continue;
      const eb = e.body;
      const qx = eb.x - B.x, qz = eb.z - B.z;
      if (qx * qx + qz * qz > (step + 2.5) * (step + 2.5)) continue;
      for (const j of [HEAD, CHEST, PELVIS]) {
        const cx = B.x - eb.p[j * 3], cy = B.y - eb.p[j * 3 + 1], cz = B.z - eb.p[j * 3 + 2];
        const r = eb.r[j] + 0.1;
        const a = sx * sx + sz * sz, bq = cx * sx + cz * sz, cq = cx * cx + cy * cy + cz * cz - r * r;
        const disc = bq * bq - a * cq;
        if (disc < 0) continue;
        let t = (-bq - Math.sqrt(disc)) / a;
        if (t < 0) { if (cq < 0) t = 0; else continue; }
        if (t <= 1 && t < bestT) { bestT = t; bestE = e; bestJ = j; }
      }
    }
    // first wall along the segment
    let wallT = Infinity;
    const n = Math.max(1, Math.ceil(step / 0.3));
    for (let k = 1; k <= n; k++) if (col.solidAt(B.x + sx * k / n, B.z + sz * k / n)) { wallT = (k - 0.5) / n; break; }
    if (bestE && bestT <= wallT) {
      const hx = B.x + sx * bestT, hz = B.z + sz * bestT;
      B.x = hx; B.z = hz;
      shootHit(bestE, bestJ, B.dx, B.dz, w, hx, B.y, hz);
      bullets.splice(i, 1); continue;
    }
    if (wallT <= 1) {
      const hx = B.x + sx * wallT, hz = B.z + sz * wallT;
      fx.burst(hx - B.dx * 0.1, B.y, hz - B.dz * 0.1, 5, w.tracer, 3, 0.05, 1, 0.6);
      if (Math.random() < 0.3) SFX.play('ricochet', 0.6);
      bullets.splice(i, 1); continue;
    }
    B.x += sx; B.z += sz; B.left -= step; B.travelled += step;
    if (B.left <= 0) bullets.splice(i, 1);
  }
}

function shootHit(e, j, dx, dz, w, hx, hy, hz) {
  const b = e.body;
  const sc = w.power / Math.pow(e.ty.mass, 0.6);
  b.drive = 0;
  b.kick(j, dx * sc * 15, 2.2 * sc, dz * sc * 15, PH);
  b.kick(CHEST, dx * sc * 7, 2.6 * sc, dz * sc * 7, PH);
  b.kick(PELVIS, dx * sc * 4, 1.5 * sc, dz * sc * 4, PH);
  if (j === HEAD) for (const q of [LSH, RSH]) b.kick(q, dx * sc * 6, 1, dz * sc * 6, PH);
  fx.burst(hx, hy, hz, 7, w.tracer, 5, 0.06, 1.5);
  fx.burst(hx, hy, hz, 3, 0xffffff, 3, 0.05, 1);
  e.lastSlap = G.time; e.chain = 1; e.flash = 1;
  if (j === HEAD && animT - (G.lastHeadshot || -1) > 0.5) {
    G.lastHeadshot = animT;
    const s = project(camera, hx, hy + 0.5, hz, innerWidth, innerHeight);
    fx.text(s.x, s.y, 'HEADSHOT!', 'strike');
  }
  SFX.play('thud', 0.5);
  e.hp -= w.dmg;
  if (e.hp <= 0) killEnemy(e, 'shot');
  else {
    knock(e, 0.9 + Math.random() * 0.4);
    if (Math.random() < 0.12) shout(e, SHOT_LINES[Math.floor(Math.random() * SHOT_LINES.length)], 1.2, 'hit', true);
  }
}

// ---------- Kamehameha ----------
function kiReady() {
  banner('KAMEHAMEHA READY', isTouch ? 'tap KA to unleash it' : 'press 1 to unleash it');
  SFX.play('heal');
}
function startKame() {
  const P = player;
  G.ki = 0;
  P.kame = { t: 0, L: 0, x: 0, z: 0, fired: false };
  P.slapT = -1;
  SFX.play('kameCharge');
  SFX.speak('ka me ha me haaaaaa', 1.1, 0.85, true);
  banner('KA... ME... HA... ME...', '');
}
function updateKame(dt) {
  const P = player, K = P.kame, b = P.body;
  K.t += dt;
  P.inv = Math.max(P.inv, 0.15);
  if (K.t >= KAME_DUR) { endKame(); return; }
  if (K.t < KAME_CHARGE) return;
  if (!K.fired) { K.fired = true; banner('HAAAAAAA!', 'kamehameha'); shake = Math.min(1.6, shake + 0.9); SFX.play('boom'); }
  // beam runs from between the hands to the first wall
  const dx = Math.sin(b.h), dz = Math.cos(b.h);
  const hx = (b.p[LHA * 3] + b.p[RHA * 3]) / 2, hz = (b.p[LHA * 3 + 2] + b.p[RHA * 3 + 2]) / 2;
  let L = 0;
  while (L < 34) { L += 0.25; if (col.solidAt(hx + dx * L, hz + dz * L)) break; }
  K.L = L; K.x = hx; K.z = hz; K.y = (b.p[LHA * 3 + 1] + b.p[RHA * 3 + 1]) / 2;
  shake = Math.max(shake, 0.22);
  if (Math.random() < 0.6) fx.burst(hx + dx * L, 1.2, hz + dz * L, 3, 0x7fe9ff, 6, 0.1, 2);
  for (const e of enemies) {
    if (e.sink || (e.beamCd || 0) > 0) continue;
    const eb = e.body;
    const cx = eb.p[CHEST * 3] - hx, cz = eb.p[CHEST * 3 + 2] - hz;
    const along = cx * dx + cz * dz;
    if (along < -0.3 || along > L) continue;
    if (Math.abs(cx * dz - cz * dx) > 0.95 + eb.r[CHEST]) continue;
    e.beamCd = 0.25;
    const k = 1 / Math.pow(e.ty.mass, 0.4);
    eb.drive = 0;
    eb.kickAll(dx * 15 * k, 4.5 * k, dz * 15 * k, PH);
    eb.kick(HEAD, dx * 6 * k, 3, dz * 6 * k, PH);
    e.lastSlap = G.time; e.chain = 1; e.flash = 1; e.leap = null; eb.y = 0;
    fx.burst(eb.p[CHEST * 3], eb.p[CHEST * 3 + 1], eb.p[CHEST * 3 + 2], 6, 0x7fe9ff, 5, 0.08, 2);
    if (!e.dead) { e.hp -= 2; if (e.hp <= 0) killEnemy(e, 'beam'); else knock(e, 1.2); }
  }
}
function endKame() {
  player.kame = null;
  player.cd = 0.2;
}
function poseKame(b, K) {
  if (K.t < KAME_CHARGE) {
    // cupped hands pulled back to the right hip, knees bent
    const u = ease(Math.min(1, K.t / 0.3));
    b.set(LHA, lerp(0.28, -0.3, u), lerp(1.32, 1.02, u), lerp(0.34, -0.12, u)); b.set(LEL, 0.1, 1.15, -0.25);
    b.set(RHA, lerp(-0.28, -0.42, u), lerp(1.32, 1.06, u), lerp(0.34, -0.18, u)); b.set(REL, -0.48, 1.2, -0.2);
    for (const j of [HEAD, CHEST, LSH, RSH, LEL, REL, LHA, RHA, PELVIS]) b.add(j, 0, -0.1 * u, 0);
    b.add(LSH, 0, 0, 0.08 * u); b.add(RSH, 0, 0, -0.1 * u);
  } else {
    // arms thrust straight out, palms together
    b.set(LHA, 0.07, 1.34, 0.72); b.set(LEL, 0.24, 1.32, 0.36);
    b.set(RHA, -0.07, 1.34, 0.72); b.set(REL, -0.24, 1.32, 0.36);
    b.add(HEAD, 0, -0.02, 0.06); b.add(LFT, 0, 0, 0.18); b.add(RFT, 0, 0, -0.22);
  }
}

function poseSlap(b, u, side, w) {
  let th, ext;
  if (u < 0.32) { const k = u / 0.32; th = lerp(-0.4, -2.0, ease(k)); ext = 0.58; }
  else if (u < 0.62) { const k = (u - 0.32) / 0.3; th = lerp(-2.0, 1.05, k * k * (2.2 - 1.2 * k)); ext = 0.66 + 0.2 * Math.sin(k * Math.PI); }
  else { const k = (u - 0.62) / 0.38; th = lerp(1.05, -0.4, ease(k)); ext = 0.58; }
  th *= side;
  const R = side === 1 ? RHA : LHA, E = side === 1 ? REL : LEL, S = side === 1 ? RSH : LSH, O = side === 1 ? LSH : RSH;
  const sx = side === 1 ? -0.1 : 0.1;
  const reachVis = w === WEAPONS.hand || w === WEAPONS.glove ? 1 : 0.85;
  const hx = sx + Math.sin(th) * ext * reachVis, hz = Math.cos(th) * ext * reachVis + 0.05;
  b.set(R, hx, 1.52, hz);
  b.set(E, sx * 2.6 + Math.sin(th) * ext * 0.45, 1.3, Math.cos(th) * ext * 0.4 - 0.05);
  const tw = Math.sin(th) * 0.13 * side;
  b.add(S, 0, 0.03, tw); b.add(O, 0, 0, -tw);
  b.add(HEAD, -Math.sin(th) * 0.04, 0, 0.03);
}

function startSlap() {
  const P = player, w = WEAPONS[P.weapon];
  P.cd = w.cd; P.slapT = 0; P.slapDur = Math.min(0.26, w.cd * 0.85 + 0.03); P.hitDone = false;
  P.side = P.weapon === 'hand' ? -P.side : 1;
  if (P.weapon !== 'hand') P.side = 1;
  SFX.play('whoosh', P.weapon === 'glove' ? 1.6 : 1);
}

function nearestEnemy(x, z, maxD) {
  let best = null, bd = maxD;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.body.x - x, e.body.z - z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const _v1 = { x: 0, y: 0, z: 0 };
function slapHits() {
  const P = player, b = P.body, w = WEAPONS[P.weapon];
  const fx0 = Math.sin(b.h), fz0 = Math.cos(b.h);
  const lx = Math.cos(b.h) * P.side, lz = -Math.sin(b.h) * P.side; // swing pushes toward this side
  const ox = b.x, oz = b.z;
  const cands = [];
  for (const e of enemies) {
    if (e.sink) continue;
    const eb = e.body;
    let best = 1e9, bj = CHEST;
    for (const j of [HEAD, CHEST, PELVIS]) {
      const dx = eb.p[j * 3] - ox, dz = eb.p[j * 3 + 2] - oz;
      const d = Math.hypot(dx, dz) - eb.r[j];
      if (d < best) { best = d; bj = j; }
    }
    if (best > w.reach) continue;
    const dx = eb.p[bj * 3] - ox, dz = eb.p[bj * 3 + 2] - oz, dl = Math.hypot(dx, dz) || 1;
    const dot = (dx * fx0 + dz * fz0) / dl;
    if (dl > 0.8 && dot < Math.cos(w.cone / 2)) continue;
    cands.push({ e, d: best + (e.dead ? 3 : 0) + (e.state === 'down' ? 1 : 0) });
  }
  if (!cands.length) return;
  cands.sort((a, b2) => a.d - b2.d);
  const hits = cands.slice(0, w.max);
  let liveHits = 0;
  for (const { e } of hits) { if (!e.dead) liveHits++; applySlap(e, fx0, fz0, lx, lz, w); }
  // feedback scaled to what we actually hit
  const big = w.power >= 1.6;
  hitstop = Math.max(hitstop, liveHits ? (big ? 0.11 : 0.075) : 0.03);
  shake = Math.min(1.2, shake + (liveHits ? 0.28 + 0.12 * w.power : 0.1));
  SFX.play(w.sfx, Math.min(1.3, 0.8 + liveHits * 0.15));
  const first = hits[0].e.body;
  const hx = first.p[HEAD * 3], hy = first.p[HEAD * 3 + 1], hz = first.p[HEAD * 3 + 2];
  const sp = project(camera, hx, hy + 0.3, hz, innerWidth, innerHeight);
  fx.text(sp.x, sp.y, w.words[Math.floor(Math.random() * w.words.length)], liveHits > 2 || big ? 'big' : '');
  fx.ring(hx, hy, hz, theme.neon1, big ? 2.6 : 1.6, 0.3, 0.9, 0.2);
  if (liveHits) wearWeapon();
}

// One use off the held melee weapon; breaks it back to bare hands when it runs out.
function wearWeapon() {
  const P = player, b = P.body;
  if (P.weapon === 'hand' || WEAPONS[P.weapon].gun) return;
  P.uses -= 1;
  if (P.uses > 0) return;
  const name = { fish: 'THE FISH ROTTED', pan: 'PAN SNAPPED', chancla: 'CHANCLA LOST', glove: 'GLOVE POPPED', katana: 'KATANA SHATTERED' }[P.weapon];
  const s2 = project(camera, b.x, 2.6, b.z, innerWidth, innerHeight);
  fx.text(s2.x, s2.y, name, 'item');
  fx.burst(b.p[RHA * 3], b.p[RHA * 3 + 1], b.p[RHA * 3 + 2], 18, ITEM_COLORS[P.weapon], 5, 0.09);
  SFX.play('break');
  P.weapon = 'hand'; P.uses = Infinity;
}

// Dash attack: anything the dash passes gets slapped out of the way, once per dash.
function dashSlap() {
  const P = player, b = P.body, w = WEAPONS[P.weapon];
  if (w.gun) { P.dashHits = null; return; }
  const dx = P.dashX, dz = P.dashZ, px = -dz, pz = dx;
  const reach = 0.75 + w.reach * 0.45;
  let hits = 0, live = 0, first = null;
  for (const e of enemies) {
    if (e.sink || P.dashHits.has(e)) continue;
    const eb = e.body;
    const ox = eb.p[CHEST * 3] - b.x, oz = eb.p[CHEST * 3 + 2] - b.z;
    const along = ox * dx + oz * dz, side = ox * px + oz * pz;
    if (along < -0.4 || along > reach + 0.6 || Math.abs(side) > reach) continue;
    P.dashHits.add(e);
    const sgn = side >= 0 ? 1 : -1;
    // forward momentum from the dash plus a sideways shove off the dash line
    applySlap(e, dx * 1.25, dz * 1.25, px * sgn * 0.9, pz * sgn * 0.9, w);
    hits++; if (!e.dead || e.hp <= 0) live++;
    if (!first) first = e;
  }
  if (!hits) return;
  hitstop = Math.max(hitstop, 0.05);
  shake = Math.min(1.2, shake + 0.2 + 0.1 * hits);
  SFX.play(w.sfx, Math.min(1.3, 0.8 + hits * 0.15));
  const fb = first.body;
  const sp = project(camera, fb.p[HEAD * 3], fb.p[HEAD * 3 + 1] + 0.3, fb.p[HEAD * 3 + 2], innerWidth, innerHeight);
  fx.text(sp.x, sp.y, hits > 1 ? 'DRIVE-BY ' + w.words[0] : 'DASH ' + w.words[0], hits > 2 ? 'big' : '');
  if (!P.dashWore) { P.dashWore = true; wearWeapon(); }
}

function applySlap(e, fx0, fz0, lx, lz, w) {
  const b = e.body;
  let dx = fx0 * 0.75 + lx * 0.8, dz = fz0 * 0.75 + lz * 0.8;
  const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
  const sc = w.power / Math.pow(e.ty.mass, 0.6) * (e.dead ? 0.8 : 1);
  const sp = 16 * sc;
  const up = 4.2 * sc;
  b.drive = 0;
  b.kick(HEAD, dx * sp * 1.35, up * 1.2, dz * sp * 1.35, PH);
  b.kick(CHEST, dx * sp * 0.8, up * 1.3, dz * sp * 0.8, PH);
  b.kick(PELVIS, dx * sp * 0.45, up * 1.1, dz * sp * 0.45, PH);
  for (const j of [LSH, RSH, LEL, REL, LHA, RHA]) b.kick(j, dx * sp * 0.7, up, dz * sp * 0.7, PH);
  // legs swing out from under them -> cartwheels
  for (const j of [LKN, RKN, LFT, RFT]) b.kick(j, -dx * sp * 0.15, up * 1.6 + 2, -dz * sp * 0.15, PH);
  const hx = b.p[HEAD * 3], hy = b.p[HEAD * 3 + 1], hz = b.p[HEAD * 3 + 2];
  fx.burst(hx, hy, hz, 12, theme.neon1, 7 * Math.min(1.5, w.power), 0.07);
  fx.burst(hx, hy, hz, 6, 0xffffff, 5, 0.05);
  e.lastSlap = G.time; e.chain = 0;
  e.flash = 1;
  if (e.dead) return;
  e.hp -= w.dmg;
  if (e.hp <= 0) killEnemy(e, 'slap');
  else {
    knock(e, 1.0 + Math.random() * 0.4);
    if (Math.random() < 0.25) shout(e, HIT_LINES[Math.floor(Math.random() * HIT_LINES.length)], 1.3, 'hit', true);
  }
}

function knock(e, dur) {
  e.chad = null; e.farming = false; e.auraT = 0;
  e.leap = null; e.body.y = 0; e.webT = -1;
  e.state = 'down'; e.st = dur; e.atk = -1; e.body.drive = 0; e.landed = true;
}

function killEnemy(e, how) {
  e.leap = null; e.body.y = 0; e.webT = -1;
  if (e.ty.special === 'bomb' && e.fuse == null && !e.exploded) { e.fuse = 0.55; SFX.play('fuse'); }
  e.dead = true; e.state = 'dead'; e.atk = -1; e.body.drive = 0; e.deadT = 0;
  G.kills++;
  if (G.time - G.lastKill < 1.8) G.combo++; else G.combo = 1;
  G.lastKill = G.time; G.lastHow = how;
  if (how !== 'beam' && G.ki < KI_MAX) { G.ki++; if (G.ki === KI_MAX) kiReady(); }
  G.aura += 100 * G.combo + (how === 'bowl' ? 150 : 0) + (e.key === 'boss' ? 5000 : 0);
  const b = e.body;
  const s = project(camera, b.p[HEAD * 3], b.p[HEAD * 3 + 1] + 0.9, b.p[HEAD * 3 + 2], innerWidth, innerHeight);
  const pool = Math.random() < 0.5 ? e.ty.death : KILL_TEXT;
  if (G.combo < 3 && Math.random() < 0.35) setTimeout(() => fx.text(s.x, s.y - 24, pool[Math.floor(Math.random() * pool.length)], 'kill'), 90);
  if (G.combo >= 3) showCombo(G.combo);
  if (e.key === 'boss') { banner(how === 'slap' ? 'BOSS SLAPPED' : how === 'beam' ? 'BOSS VAPORIZED' : 'BOSS DESTROYED', '+5000 aura'); shake = 1.5; }
  if (!G.firstBlood) { G.firstBlood = true; }
  fx.drop(e);
}

// Combo callouts match how the kills happened: slaps, guns, explosions or the beam.
const SHOT_LINES = ['I GOT SHOT IN 4K', 'BRO IS STRAPPED', 'MY AURA', 'NOT THE RIZZ', '-500 AURA', 'BRUH', 'OHIO MOMENT', 'ow ow ow', 'BRO??', 'that was cap', 'CALL THE MODS'];
const COMBO_NAMES = {
  slap: { 2: 'DOUBLE SLAP', 3: 'TRIPLE SLAP', 4: 'QUAD SLAP', 5: 'SLAPTASTIC', 6: 'SLAP-A-LANCHE', 8: 'SIGMA SLAPPER', 11: 'AURA OVERLOAD', 15: 'OHIO FINAL SLAPPER' },
  shot: { 2: 'DOUBLE TAP', 3: 'TRIPLE TAP', 4: 'QUAD KILL', 5: 'BULLET HELL', 6: 'SPRAY AND PRAY', 8: 'SIGMA SHOOTER', 11: 'AURA OVERLOAD', 15: 'OHIO FINAL SHOOTER' },
  boom: { 2: 'DOUBLE BOOM', 3: 'TRIPLE BOOM', 4: 'MEGA BOOM', 5: 'CROCODILO CHAOS', 8: 'NUCLEAR AURA', 15: 'OHIO IS GONE' },
  bowl: { 2: 'DOUBLE STRIKE', 3: 'TRIPLE STRIKE', 4: 'NPC PILEUP', 5: 'BOWLING NIGHT', 8: 'PERFECT GAME', 15: 'OHIO BOWLING LEAGUE' },
  beam: { 2: 'KAMEHAME-DOUBLE', 3: 'OVER 9000', 5: 'SUPER SAIYAN', 8: 'ULTRA INSTINCT', 12: 'PLANET DESTROYER' },
};
function showCombo(n) {
  const names = COMBO_NAMES[G.lastHow] || COMBO_NAMES.slap;
  let name = 'COMBO'; for (const k of Object.keys(names).map(Number)) if (n >= k) name = names[k];
  const el = $('#combo');
  el.textContent = `${name} x${n}`;
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  SFX.play('combo', n);
}

let bannerTimer = 0;
function banner(title, sub) {
  const el = $('#banner');
  el.querySelector('b').textContent = title; el.querySelector('small').textContent = sub;
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.hidden = true; }, 2700);
}

function hurtPlayer(dmg, e) {
  const P = player;
  if (P.inv > 0 || !P.alive) return;
  P.hp -= dmg; P.inv = 0.55; P.flash = 1;
  shake = Math.min(1.4, shake + 0.45);
  hitstop = Math.max(hitstop, 0.05);
  SFX.play('hurt');
  vignette = 1;
  const b = P.body;
  let dx = b.x - e.body.x, dz = b.z - e.body.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  P.vx += dx * 9; P.vz += dz * 9;
  b.drive = 0.35;
  b.kick(HEAD, dx * 6, 1, dz * 6, PH); b.kick(CHEST, dx * 3, 0, dz * 3, PH);
  fx.burst(b.p[HEAD * 3], b.p[HEAD * 3 + 1], b.p[HEAD * 3 + 2], 10, 0xff2a3d, 5, 0.07);
  if (P.hp <= 0) killPlayer(dx, dz);
}

function killPlayer(dx, dz) {
  const P = player;
  if (!P.alive) return;
  P.alive = false; P.hp = 0;
  const b = P.body; b.drive = 0;
  b.kickAll(dx * 6, 5, dz * 6, PH); b.kick(HEAD, dx * 8, 3, dz * 8, PH);
  P.kame = null;
  mode = 'dying'; G.deathT = 0;
  SFX.hush(); SFX.play('death');
  banner('COOKED', `survived ${fmtTime(G.time, true)}`);
  // the brainrot celebrates
  let n = 0;
  for (const e of enemies) if (!e.dead && n < 3 && Math.hypot(e.body.x - b.x, e.body.z - b.z) < 14) { shout(e, ['GG EZ', 'YOU GOT COOKED', 'L + RATIO', 'SKILL ISSUE'][n], 2.5, '', n === 0); n++; }
}

function shout(e, line, dur = 2.2, cls = '', voice = false) {
  fx.bubble(e, line, dur, e.key === 'boss' ? 'boss' : cls);
  e.talkUntil = animT + Math.min(dur, 1.6);
  if (e.pack && !voice) return;
  if (voice || Math.random() < 0.9) SFX.speak(line, e.ty.pitch, e.ty.rate, cls === 'hit');
}

// ---------- enemies ----------
function updateEnemies(dt) {
  const P = player, pb = P.body;
  const speedMul = 1 + Math.min(0.3, G.time / 500);
  let deadCount = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i], b = e.body;
    e.flash = Math.max(0, e.flash - dt * 7);
    e.bumpCd -= dt; e.beamCd = (e.beamCd || 0) - dt;
    e.blinkT -= dt; if (e.blinkT < -0.12) e.blinkT = 1.5 + Math.random() * 3;
    if (b.x < -T || b.z < -T || b.x > (level.W + 1) * T || b.z > (level.H + 1) * T) { enemies.splice(i, 1); bodies.splice(bodies.indexOf(b), 1); continue; }
    if (e.fuse != null) { e.fuse -= dt; if (e.fuse <= 0) { e.fuse = null; explode(e); } }
    if (e.ssj && !e.dead) {
      const pc = b.p;
      if (Math.random() < 0.3) fx.burst(pc[PELVIS * 3] + (Math.random() - 0.5) * 1.4, pc[PELVIS * 3 + 1] + (Math.random() - 0.3) * 1.6, pc[PELVIS * 3 + 2] + (Math.random() - 0.5) * 1.4, 1, 0xb08a1a, 0.3, 0.045, 2.5, -0.05);
      if (Math.random() < 0.08) fx.burst(pc[HEAD * 3], pc[HEAD * 3 + 1], pc[HEAD * 3 + 2], 3, 0x7fe9ff, 7, 0.04, 1, 0);
    }
    if (e.dead) {
      e.deadT += dt;
      b.x = b.p[PELVIS * 3]; b.z = b.p[PELVIS * 3 + 2];
      if (!e.sink) deadCount++;
      if (e.sink && b.p[PELVIS * 3 + 1] < -3) { enemies.splice(i, 1); bodies.splice(bodies.indexOf(b), 1); continue; }
      if (!e.sink && e.deadT > 9) startSink(e);
      continue;
    }
    if (e.state === 'down') {
      b.x = b.p[PELVIS * 3]; b.z = b.p[PELVIS * 3 + 2];
      e.st -= dt;
      const settled = b.coreSpeed(PH) < 3.5 && b.p[PELVIS * 3 + 1] < 0.9 * b.s + 0.3;
      if (e.st <= 0 && (settled || e.st < -2.5)) {
        // get up where we landed
        e.state = 'rise'; e.riseT = 0;
        const r = col.circle(b.x, b.z, 0.32 * b.s); b.x = r.x; b.z = r.z;
        b.h = Math.atan2(pb.x - b.x, pb.z - b.z);
        b.freshTargets = true;
        e.vx = e.vz = 0;
      }
      continue;
    }
    if (e.state === 'rise') {
      e.riseT += dt;
      b.drive = ease(Math.min(1, e.riseT / 0.45));
      if (e.riseT >= 0.45) { e.state = 'alive'; b.drive = 1; }
    }
    // chase
    let dx = pb.x - b.x, dz = pb.z - b.z;
    const dist = Math.hypot(dx, dz) || 1;
    e.losT -= dt;
    if (e.losT <= 0) { e.losT = 0.25; e.los = dist < 14 && col.los(b.x, b.z, pb.x, pb.z); }
    let tx = dx / dist, tz = dz / dist;
    if (!e.los && dist > 2.5) {
      const n = nav.next(b.x, b.z);
      if (n.ok) { const nx = n.x - b.x, nz = n.z - b.z, nl = Math.hypot(nx, nz); if (nl > 0.05) { tx = nx / nl; tz = nz / nl; } }
    }
    if (!P.alive) { tx = -tx * 0.2; tz = -tz * 0.2; }
    // special moves
    const spc = e.ty.special;
    if (e.leap) { updateLeap(e, dt); continue; }
    if (P.alive && e.state === 'alive') {
      if (spc === 'leap') { e.leapCd -= dt; if (e.leapCd <= 0 && dist > 2.2 && dist < 7 && e.los) { startLeap(e, pb); continue; } }
      if (spc === 'web') {
        e.webCd -= dt;
        if (e.webT >= 0) { e.webT += dt; if (e.webT >= 0.38) { e.webT = -1; shootWeb(e); } }
        else if (e.webCd <= 0 && dist > 3.5 && dist < 12 && e.los) { e.webT = 0; e.webCd = 3 + Math.random() * 1.8; }
      }
      if (spc === 'bomb' && e.fuse == null && dist < 1.7) { e.fuse = 0.75; shout(e, 'BOMBARDIRO!', 1, 'hit', true); SFX.play('fuse'); }
      if (spc === 'chad' && updateChad(e, dt, dist)) continue;
      if (spc === 'sprint' && Math.random() < 0.35) fx.burst(b.x - e.vx * 0.05, 0.5 + Math.random(), b.z - e.vz * 0.05, 1, 0x5ea0ff, 0.4, 0.07, 0.2, 0);
    }
    // separation
    let sx = 0, sz = 0;
    for (const o of enemies) {
      if (o === e || o.dead || o.state === 'down') continue;
      const ox = b.x - o.body.x, oz = b.z - o.body.z, R = 0.42 * (b.s + o.body.s);
      const dd = ox * ox + oz * oz;
      if (dd < R * R && dd > 1e-6) { const d = Math.sqrt(dd); sx += ox / d * (R - d) / R; sz += oz / d * (R - d) / R; }
    }
    const atkR = 0.85 + 0.42 * b.s;
    let spd = e.ty.speed * speedMul * (e.state === 'rise' ? 0 : 1);
    if (e.atk >= 0) spd *= 0.2;
    if (e.webT >= 0 || e.fuse != null) spd *= 0.1;
    if (e.farming) spd = 0;
    if (dist < atkR * 0.7) spd *= 0.2;
    const k = Math.min(1, dt * 7);
    e.vx += (tx * spd + sx * 4 - e.vx) * k; e.vz += (tz * spd + sz * 4 - e.vz) * k;
    b.x += e.vx * dt; b.z += e.vz * dt;
    const r = col.circle(b.x, b.z, 0.3 * b.s); b.x = r.x; b.z = r.z;
    const face = dist < 7 || e.farming ? Math.atan2(dx, dz) : Math.atan2(e.vx, e.vz);
    if (spc === 'spin' && e.state === 'alive' && e.atk < 0) b.h += dt * 11;
    else b.h = angTo(b.h, face, dt * 9);
    // attack
    e.atkCd -= dt;
    if (P.alive && e.state === 'alive' && spc !== 'bomb' && e.atk < 0 && e.atkCd <= 0 && dist < atkR) e.atk = 0;
    if (e.atk >= 0) {
      e.atk += dt;
      if (e.atk >= e.ty.windup) {
        if (dist < atkR + 0.45) hurtPlayer(e.ty.dmg, e);
        e.atk = -1; e.atkCd = 0.8 + Math.random() * 0.6;
      }
    }
    // pose
    const sp = Math.hypot(e.vx, e.vz);
    e.ph += sp * dt * 2.5 / b.s;
    b.resetPose();
    poseWalk(b, e.ph, Math.min(1, sp / 3), (e.ty.lean ?? 0.1) * Math.min(1, sp / 4));
    poseArms(e, b);
  }
  // keep the corpse pile from growing forever
  if (deadCount > 28) {
    let oldest = null;
    for (const e of enemies) if (e.dead && !e.sink && (!oldest || e.deadT > oldest.deadT)) oldest = e;
    if (oldest) startSink(oldest);
  }
}
function startLeap(e, pb) {
  const b = e.body, d = Math.hypot(pb.x - b.x, pb.z - b.z) || 1;
  e.leap = { t: 0, dur: 0.42 + d * 0.05, x0: b.x, z0: b.z, x1: pb.x - (pb.x - b.x) / d * 0.5 + player.vx * 0.2, z1: pb.z - (pb.z - b.z) / d * 0.5 + player.vz * 0.2 };
  e.leapCd = 2.2 + Math.random() * 1.5;
  SFX.play('whoosh', 1.2);
  if (Math.random() < 0.5) shout(e, ['WA WA WA', 'BANANINI!', 'OOH AAH'][Math.floor(Math.random() * 3)], 1, 'hit');
}
function updateLeap(e, dt) {
  const L = e.leap, b = e.body;
  L.t += dt;
  const u = Math.min(1, L.t / L.dur);
  b.x = L.x0 + (L.x1 - L.x0) * u; b.z = L.z0 + (L.z1 - L.z0) * u;
  const r = col.circle(b.x, b.z, 0.3 * b.s); b.x = r.x; b.z = r.z;
  b.y = Math.sin(Math.PI * u) * 1.7;
  b.h = angTo(b.h, Math.atan2(L.x1 - L.x0, L.z1 - L.z0), dt * 12);
  b.resetPose();
  b.set(LHA, 0.32, 2.05, 0.3); b.set(RHA, -0.32, 2.05, 0.3); b.set(LEL, 0.38, 1.75, 0.15); b.set(REL, -0.38, 1.75, 0.15);
  b.add(LKN, 0, 0.25, 0.25); b.add(RKN, 0, 0.25, 0.25); b.add(LFT, 0, 0.32, 0.05); b.add(RFT, 0, 0.32, 0.05);
  if (u >= 1) {
    e.leap = null; b.y = 0;
    fx.burst(b.x, 0.1, b.z, 8, 0xffffff, 3, 0.06, 1);
    fx.ring(b.x, 0.05, b.z, 0xffe14d, 1.4, 0.3, 0.8, 0.2);
    const pb = player.body;
    if (player.alive && Math.hypot(pb.x - b.x, pb.z - b.z) < 0.9 + 0.42 * b.s) hurtPlayer(e.ty.dmg, e);
  }
}
function shootWeb(e) {
  const b = e.body, pb = player.body;
  const hx = b.p[RHA * 3], hz = b.p[RHA * 3 + 2];
  const d = Math.hypot(pb.x - hx, pb.z - hz) || 1, lead = d / 16 * 0.6;
  let dx = pb.x + player.vx * lead - hx, dz = pb.z + player.vz * lead - hz;
  const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  eshots.push({ x: hx, y: 1.25, z: hz, dx, dz, left: 14, travelled: 0, col: WEB_COL, speed: 16 });
  SFX.play('web', 0.8);
}
function updateEnemyShots(dt) {
  const P = player, pb = P.body;
  for (let i = eshots.length - 1; i >= 0; i--) {
    const S = eshots[i];
    const step = S.speed * dt;
    S.x += S.dx * step; S.z += S.dz * step; S.left -= step; S.travelled += step;
    if (col.solidAt(S.x, S.z) || S.left <= 0) { fx.burst(S.x, S.y, S.z, 6, 0xffffff, 2, 0.05, 0.5, 0.5); eshots.splice(i, 1); continue; }
    if (P.alive && P.dashT <= 0 && Math.hypot(S.x - pb.x, S.z - pb.z) < 0.6) {
      eshots.splice(i, 1);
      P.webbed = 1.8;
      fx.burst(pb.x, 1.2, pb.z, 14, 0xffffff, 3, 0.07, 0.5, 0.5);
      const s2 = project(camera, pb.x, 2.5, pb.z, innerWidth, innerHeight);
      fx.text(s2.x, s2.y, 'WEBBED!', 'kill');
      SFX.play('web', 1.2);
    }
  }
}
function explode(e) {
  if (e.exploded) return;
  e.exploded = true;
  const b = e.body, x = b.p[CHEST * 3], y = b.p[CHEST * 3 + 1], z = b.p[CHEST * 3 + 2];
  const R = 3.4;
  fx.ring(x, 0.08, z, 0xff9a2f, R * 1.4, 0.5, 1, 0.3);
  fx.ring(x, 0.1, z, 0xffffff, R, 0.3, 0.9, 0.2);
  fx.burst(x, y, z, 40, 0xff9a2f, 12, 0.12, 4);
  fx.burst(x, y, z, 24, 0xffe14d, 8, 0.1, 3);
  fx.burst(x, y, z, 14, 0x2a2a2a, 4, 0.18, 2, 0.3);
  boomT = 1; boomLight.position.set(x, 2.5, z);
  const pb = player.body, pd = Math.hypot(pb.x - x, pb.z - z);
  shake = Math.min(1.8, shake + Math.max(0.3, 1.3 - pd / 15));
  hitstop = Math.max(hitstop, 0.06);
  SFX.play('boom');
  const s = project(camera, x, y + 1, z, innerWidth, innerHeight);
  fx.text(s.x, s.y, 'KABOOM!', 'big');
  if (player.alive && pd < R) {
    const dmg = Math.round(8 + 26 * (1 - pd / R));
    const inv = player.inv; player.inv = 0;
    if (inv <= 0 || player.dashT <= 0) hurtPlayer(dmg, e); else player.inv = inv;
  }
  for (const o of enemies) {
    if (o.sink) continue;
    const ob = o.body;
    const dx = ob.p[CHEST * 3] - x, dz = ob.p[CHEST * 3 + 2] - z, d = Math.hypot(dx, dz);
    if (d > R) continue;
    const k = 1 - d / R, sp = 8 + 14 * k, ux = d > 0.05 ? dx / d : Math.random() - 0.5, uz = d > 0.05 ? dz / d : Math.random() - 0.5;
    ob.drive = 0;
    ob.kickAll(ux * sp, 6 + 7 * k, uz * sp, PH);
    ob.kick(HEAD, ux * sp * 0.5, 3, uz * sp * 0.5, PH);
    if (o === e) continue;
    o.lastSlap = G.time; o.chain = 1; o.flash = 1; o.leap = null; ob.y = 0;
    if (!o.dead) { o.hp -= 2; if (o.hp <= 0) killEnemy(o, 'boom'); else knock(o, 1.4); }
  }
  if (!e.dead) { e.dead = true; e.state = 'dead'; e.atk = -1; e.deadT = 0; b.drive = 0; fx.drop(e); }
}

// ---------- Chad: aura farm -> flex -> mog charge ----------
const AURA_NEEDED = 3.2, FLEX_TIME = 0.85, CHARGE_SPEED = 13, CHARGE_TIME = 1.5, TRANSFORM_TIME = 1.4;
function updateChad(e, dt, dist) {
  const b = e.body, pb = player.body;
  e.chad = e.chad || { phase: 'farm', t: 0 };
  const C = e.chad;
  if (e.ssj && C.phase === 'farm') e.farming = false;
  if (C.phase === 'farm') {
    e.farming = e.los && dist < 15 && dist > 2.4;
    if (!e.farming) { e.auraT = Math.max(0, (e.auraT || 0) - dt); return false; }
    e.auraT = (e.auraT || 0) + dt;
    const need = e.ssj ? AURA_NEEDED / 2 : AURA_NEEDED;
    const k = Math.min(1, e.auraT / need);
    if (Math.random() < 0.15 + k * 0.3) fx.burst(b.x + (Math.random() - 0.5) * 1.6, 0.2 + Math.random() * 1.5, b.z + (Math.random() - 0.5) * 1.6, 1, 0xb08a1a, 0.3, 0.045 + k * 0.03, 1.6 + k * 2, -0.05);
    C.ringT = (C.ringT || 0) - dt;
    if (C.ringT <= 0) { C.ringT = 0.45 - k * 0.2; fx.ring(b.x, 0.06, b.z, 0xffd23d, 0.9 + k * 1.6, 0.5, 0.5 + k * 0.4, 0.3); }
    if (Math.random() < dt * 0.12) { const s2 = project(camera, b.x, 3.2 * b.s, b.z, innerWidth, innerHeight); fx.text(s2.x, s2.y, '+1000 AURA', 'heal'); }
    if (e.auraT >= need && !e.ssj) {
      // first full aura bar: go Super Saiyan
      C.phase = 'transform'; C.t = 0; e.farming = true;
      shout(e, 'AAAAAAAAAAAAAH', TRANSFORM_TIME, 'boss', true);
      SFX.play('kameCharge');
      return true;
    }
    if (e.auraT >= need) {
      C.phase = 'flex'; C.t = 0; e.farming = true;
      shout(e, 'MOG CHARGE', 1.4, 'hit', true);
      fx.ring(b.x, 0.06, b.z, 0xffd23d, 3.2, 0.5, 1, 0.4);
      SFX.play('wave');
    }
    return false;
  }
  e.farming = false;
  const sp = Math.hypot(e.vx, e.vz);
  if (C.phase === 'transform') {
    C.t += dt;
    const u = Math.min(1, C.t / TRANSFORM_TIME);
    b.h = angTo(b.h, Math.atan2(pb.x - b.x, pb.z - b.z), dt * 6);
    b.resetPose(); poseWalk(b, 0, 0, 0);
    // powering up: crouched, fists clenched at the sides, head thrown back, shaking
    const q = Math.sin(animT * 70) * 0.03 * u;
    b.set(LHA, 0.42 + q, 1.05, 0.12); b.set(LEL, 0.62, 1.25, -0.1);
    b.set(RHA, -0.42 - q, 1.05, 0.12); b.set(REL, -0.62, 1.25, -0.1);
    for (const j of [HEAD, CHEST, LSH, RSH, LEL, REL, LHA, RHA, PELVIS]) b.add(j, q, -0.12 * u, 0);
    b.add(HEAD, 0, 0.04, -0.12 * u);
    shake = Math.max(shake, 0.25 * u);
    if (Math.random() < 0.7) fx.burst(b.x + (Math.random() - 0.5) * 1.8, 0.1 + Math.random() * 2.5 * b.s, b.z + (Math.random() - 0.5) * 1.8, 1, 0xb08a1a, 0.5, 0.05 + u * 0.03, 3 + u * 3, -0.05);
    if (Math.random() < 0.3) fx.burst(b.x + (Math.random() - 0.5), 1 + Math.random() * 1.5, b.z + (Math.random() - 0.5), 2, 0x7fe9ff, 6, 0.05, 1, 0);
    C.ringT = (C.ringT || 0) - dt;
    if (C.ringT <= 0) { C.ringT = 0.18; fx.ring(b.x, 0.06, b.z, 0xffd23d, 1.5 + u * 2.5, 0.35, 0.8, 0.3); }
    if (C.t >= TRANSFORM_TIME) {
      e.ssj = true;
      fx.ring(b.x, 0.08, b.z, 0xffe14d, 6, 0.6, 1, 0.5);
      fx.ring(b.x, 0.1, b.z, 0xffffff, 4, 0.4, 0.9, 0.3);
      fx.burst(b.x, 1.6 * b.s, b.z, 40, 0xffd23d, 12, 0.12, 4);
      shake = Math.min(1.6, shake + 0.9); hitstop = Math.max(hitstop, 0.08);
      SFX.play('boom');
      const s2 = project(camera, b.x, 3.4 * b.s, b.z, innerWidth, innerHeight);
      fx.text(s2.x, s2.y, 'SUPER SAIYAN CHAD', 'big');
      C.phase = 'flex'; C.t = 0;
    }
    return true;
  }
  if (C.phase === 'flex') {
    C.t += dt;
    b.h = angTo(b.h, Math.atan2(pb.x - b.x, pb.z - b.z), dt * 10);
    b.resetPose(); poseWalk(b, e.ph, 0, 0);
    // double biceps
    const shake2 = Math.sin(animT * 60) * 0.02;
    b.set(LEL, 0.62, 1.48, 0.0); b.set(LHA, 0.5 + shake2, 1.88, 0.06);
    b.set(REL, -0.62, 1.48, 0.0); b.set(RHA, -0.5 - shake2, 1.88, 0.06);
    b.add(CHEST, 0, 0.04, 0.06); b.add(HEAD, 0, 0.03, -0.04);
    if (Math.random() < 0.2) fx.burst(b.x, 1.5 * b.s, b.z, 1, 0xb08a1a, 3, 0.05, 2);
    if (C.t >= FLEX_TIME) {
      const dx = pb.x - b.x, dz = pb.z - b.z, d = Math.hypot(dx, dz) || 1;
      C.phase = 'charge'; C.t = 0; C.dx = dx / d; C.dz = dz / d; C.hit = new Set();
      b.h = Math.atan2(C.dx, C.dz);
      SFX.play('dash'); SFX.play('whoosh', 2);
      shake = Math.min(1.2, shake + 0.25);
    }
    return true;
  }
  // charge: straight line, flattens whatever is in the way
  C.t += dt;
  const cs = e.ssj ? CHARGE_SPEED * 1.25 : CHARGE_SPEED;
  e.vx = C.dx * cs; e.vz = C.dz * cs;
  b.x += e.vx * dt; b.z += e.vz * dt;
  const r = col.circle(b.x, b.z, 0.32 * b.s); b.x = r.x; b.z = r.z;
  e.ph += cs * dt * 2.5 / b.s;
  b.resetPose(); poseWalk(b, e.ph, 1.2, 0.4);
  b.set(LHA, 0.3, 1.25, 0.55); b.set(RHA, -0.3, 1.25, 0.55); b.set(LEL, 0.5, 1.3, 0.2); b.set(REL, -0.5, 1.3, 0.2);
  if (Math.random() < 0.7) fx.burst(b.x, 0.15, b.z, 1, 0xffd23d, 1, 0.08, 0.5, 0);
  const end = () => { e.chad = { phase: 'farm', t: 0 }; e.auraT = 0; e.vx *= 0.2; e.vz *= 0.2; };
  // player
  if (player.alive && Math.hypot(pb.x - b.x, pb.z - b.z) < 0.55 + 0.45 * b.s) {
    const hadInv = player.inv > 0;
    hurtPlayer(e.ssj ? 34 : 26, e);
    if (!hadInv) { player.vx += C.dx * 16; player.vz += C.dz * 16; pb.kickAll(C.dx * 8, 4, C.dz * 8, PH); }
    const s2 = project(camera, pb.x, 2.6, pb.z, innerWidth, innerHeight);
    fx.text(s2.x, s2.y, 'MOGGED!', 'big');
    end(); return true;
  }
  // other brainrot get bowled over
  for (const o of enemies) {
    if (o === e || o.dead || o.state === 'down' || C.hit.has(o)) continue;
    const ob = o.body;
    if (Math.hypot(ob.x - b.x, ob.z - b.z) > 0.45 * (b.s + ob.s) + 0.2) continue;
    C.hit.add(o);
    const side = (Math.random() < 0.5 ? 1 : -1) * 5;
    ob.drive = 0; ob.kickAll(C.dx * 10 - C.dz * side, 6, C.dz * 10 + C.dx * side, PH);
    o.lastSlap = G.time; o.chain = 1; o.flash = 1; o.leap = null; ob.y = 0;
    o.hp -= 1; if (o.hp <= 0) killEnemy(o, 'bowl'); else knock(o, 1.2);
    SFX.play('thud', 0.7);
  }
  if (r.hit) {
    // face-first into the wall
    SFX.play('bonk'); shake = Math.min(1.2, shake + 0.35);
    const s2 = project(camera, b.x, 2.8, b.z, innerWidth, innerHeight);
    fx.text(s2.x, s2.y, 'BONK', 'strike');
    fx.burst(b.p[HEAD * 3], b.p[HEAD * 3 + 1], b.p[HEAD * 3 + 2], 12, 0xffd23d, 5, 0.08);
    knock(e, 1.8);
    b.kickAll(-C.dx * 6, 4, -C.dz * 6, PH);
    return true;
  }
  if (C.t >= CHARGE_TIME) end();
  return true;
}

function startSink(e) { e.sink = true; e.body.ground = false; e.body.walls = false; e.body.gravMul = 0.25; }

function poseArms(e, b) {
  const t = animT * 1 + e.wob, st = e.ty.arms;
  if (e.atk >= 0) {
    const k = e.atk / e.ty.windup;
    if (k < 0.72) { const u = ease(k / 0.72); b.set(LHA, 0.2, lerp(1.2, 2.3, u), lerp(0.4, -0.05, u)); b.set(RHA, -0.2, lerp(1.2, 2.3, u), lerp(0.4, -0.05, u)); b.set(LEL, 0.32, lerp(1.2, 1.9, u), 0.05); b.set(REL, -0.32, lerp(1.2, 1.9, u), 0.05); b.add(HEAD, 0, 0, -0.06); }
    else { const u = ease((k - 0.72) / 0.28); b.set(LHA, 0.2, lerp(2.3, 1.0, u), lerp(-0.05, 0.85, u)); b.set(RHA, -0.2, lerp(2.3, 1.0, u), lerp(-0.05, 0.85, u)); b.set(LEL, 0.3, 1.5, 0.45); b.set(REL, -0.3, 1.5, 0.45); b.add(HEAD, 0, -0.05, 0.15); b.add(CHEST, 0, -0.04, 0.12); }
    return;
  }
  if (e.webT >= 0) {
    b.set(RHA, -0.12, 1.6, 0.78); b.set(REL, -0.24, 1.52, 0.42);
    b.set(LHA, 0.3, 1.25, 0.25); b.set(LEL, 0.4, 1.15, 0.05);
    return;
  }
  if (e.fuse != null) {
    b.set(LHA, 0.5, 1.9, 0.1); b.set(RHA, -0.5, 1.9, 0.1); b.set(LEL, 0.45, 1.6, 0); b.set(REL, -0.45, 1.6, 0);
    b.add(HEAD, Math.sin(t * 40) * 0.05, 0, 0);
    return;
  }
  if (st === 'chad') {
    if (e.farming) {
      // hands on hips, chest out, slow confident sway
      b.set(LHA, 0.36, 1.0, 0.0); b.set(LEL, 0.58, 1.18, -0.06);
      b.set(RHA, -0.36, 1.0, 0.0); b.set(REL, -0.58, 1.18, -0.06);
      b.add(CHEST, 0, 0.03, 0.05); b.add(HEAD, Math.sin(t * 1.5) * 0.03, 0.03, -0.03);
    } else {
      b.set(LHA, 0.55, 1.05 + Math.sin(t * 5) * 0.08, 0.15); b.set(LEL, 0.6, 1.25, 0.0);
      b.set(RHA, -0.55, 1.05 - Math.sin(t * 5) * 0.08, 0.15); b.set(REL, -0.6, 1.25, 0.0);
    }
    return;
  }
  if (st === 'naruto') {
    b.set(LHA, 0.3, 1.05, -0.62); b.set(LEL, 0.36, 1.2, -0.3);
    b.set(RHA, -0.3, 1.05, -0.62); b.set(REL, -0.36, 1.2, -0.3);
  } else if (st === 'spoder') {
    b.set(LHA, 0.32, 1.35, 0.42); b.set(LEL, 0.44, 1.2, 0.15);
    b.set(RHA, -0.32, 1.35, 0.42); b.set(REL, -0.44, 1.2, 0.15);
    b.add(HEAD, 0, -0.04, 0.08); b.add(PELVIS, 0, -0.08, 0);
  } else if (st === 'bomb') {
    b.set(LHA, 0.16, 1.08, 0.42); b.set(LEL, 0.36, 1.2, 0.12);
    b.set(RHA, -0.16, 1.08, 0.42); b.set(REL, -0.36, 1.2, 0.12);
  } else if (st === 'ballet') {
    b.set(LHA, 0.75, 1.5 + Math.sin(t * 4) * 0.1, 0.05); b.set(LEL, 0.52, 1.5, 0.02);
    b.set(RHA, -0.75, 1.5 - Math.sin(t * 4) * 0.1, 0.05); b.set(REL, -0.52, 1.5, 0.02);
    b.set(RFT, -0.08, 0.5, 0.05); b.set(RKN, -0.2, 0.62, 0.2);
  } else if (st === 'monkey') {
    b.set(LHA, 0.36, 0.55 + Math.sin(t * 8) * 0.12, 0.35); b.set(LEL, 0.42, 0.95, 0.15);
    b.set(RHA, -0.36, 0.55 - Math.sin(t * 8) * 0.12, 0.35); b.set(REL, -0.42, 0.95, 0.15);
    b.add(HEAD, 0, -0.05, 0.12); b.add(CHEST, 0, -0.05, 0.1);
  } else if (st === 'zombie') {
    b.set(LHA, 0.22, 1.42 + Math.sin(t * 6) * 0.06, 0.62); b.set(LEL, 0.3, 1.42, 0.3);
    b.set(RHA, -0.22, 1.42 + Math.sin(t * 6 + 2) * 0.06, 0.62); b.set(REL, -0.3, 1.42, 0.3);
  } else if (st === 'flail') {
    b.set(LHA, 0.55, 1.55 + Math.sin(t * 13) * 0.4, 0.15); b.set(LEL, 0.45, 1.35 + Math.sin(t * 13) * 0.15, 0.05);
    b.set(RHA, -0.55, 1.55 + Math.sin(t * 13 + 3) * 0.4, 0.15); b.set(REL, -0.45, 1.35 + Math.sin(t * 13 + 3) * 0.15, 0.05);
    b.add(HEAD, Math.sin(t * 9) * 0.07, 0, 0);
  } else if (st === 'pockets') {
    b.set(LHA, 0.24, 0.97, -0.02); b.set(LEL, 0.38, 1.17, -0.1);
    b.set(RHA, -0.24, 0.97, -0.02); b.set(REL, -0.38, 1.17, -0.1);
    b.add(HEAD, 0, 0.02, -0.03);
  } else if (st === 'bat') {
    b.set(RHA, -0.28, 1.75 + Math.sin(t * 7) * 0.08, 0.12); b.set(REL, -0.44, 1.5, -0.02);
    b.set(LHA, 0.22, 1.42, 0.58); b.set(LEL, 0.3, 1.42, 0.28);
  } else if (st === 'wide') {
    b.set(LHA, 0.68, 1.25 + Math.sin(t * 5) * 0.12, 0.3); b.set(LEL, 0.52, 1.32, 0.05);
    b.set(RHA, -0.68, 1.25 + Math.sin(t * 5 + 3) * 0.12, 0.3); b.set(REL, -0.52, 1.32, 0.05);
  }
}

// ---------- physics callbacks ----------
const _vel = { x: 0, y: 0, z: 0 };
function onImpact(b, i, speed, kind) {
  const e = b.owner;
  if (!e || mode === 'menu') return;
  if (speed < 6) return;
  const x = b.p[i * 3], y = b.p[i * 3 + 1], z = b.p[i * 3 + 2];
  const near = player ? Math.hypot(x - player.body.x, z - player.body.z) : 99;
  if (animT - G.lastThud > 0.05 && near < 20) {
    G.lastThud = animT;
    SFX.play('thud', Math.min(1, speed / 18) * (1 - near / 24));
    fx.burst(x, y, z, Math.min(10, Math.floor(speed / 2.5)), kind ? theme.neon2 : 0xffffff, speed * 0.25, 0.05, 1.5);
  }
  if (kind === 1 && speed > 11 && e.kind === 'enemy' && G.time - e.lastSlap < 1.2 && !e.wallSlam) {
    e.wallSlam = true;
    G.aura += 50;
    shake = Math.min(1.2, shake + 0.15);
    const s = project(camera, x, y + 0.5, z, innerWidth, innerHeight);
    if (Math.random() < 0.25) fx.text(s.x, s.y, 'WALL SLAM!', 'strike');
  }
  if (kind === 0 && e.kind === 'enemy') e.wallSlam = false;
}

function onBodyHit(A, B, speed, part) {
  const ea = A.owner, eb = B.owner;
  if (!ea || !eb || ea.kind !== 'enemy' || eb.kind !== 'enemy' || !G) return;
  if (ea.state !== 'down' && ea.state !== 'dead') return;
  if (G.time - ea.lastSlap > 1.4 || (ea.chain || 0) >= 2 || speed < 7) return;
  if (eb.dead || eb.state === 'down' || eb.bumpCd > 0) return;
  eb.bumpCd = 0.6;
  A.vel(part, PH, _vel);
  const k = 0.55 / Math.pow(eb.ty.mass, 0.5);
  B.drive = 0;
  B.kick(HEAD, _vel.x * k * 1.2, 3 + Math.abs(_vel.y) * 0.3, _vel.z * k * 1.2, PH);
  B.kick(CHEST, _vel.x * k, 3, _vel.z * k, PH);
  B.kick(PELVIS, _vel.x * k * 0.6, 2, _vel.z * k * 0.6, PH);
  eb.lastSlap = G.time; eb.flash = 1; eb.chain = (ea.chain || 0) + 1;
  eb.hp -= 1;
  G.strikes++;
  if (animT - (G.lastStrikeText || -1) > 0.35) {
    G.lastStrikeText = animT;
    const s = project(camera, B.p[HEAD * 3], B.p[HEAD * 3 + 1] + 0.4, B.p[HEAD * 3 + 2], innerWidth, innerHeight);
    fx.text(s.x, s.y, ['STRIKE!', 'BOWLED!', 'COLLATERAL!', 'NPC PILEUP!'][Math.floor(Math.random() * 4)], 'strike');
  }
  SFX.play('slap', 0.6);
  fx.burst(B.p[CHEST * 3], B.p[CHEST * 3 + 1], B.p[CHEST * 3 + 2], 10, theme.neon2, 6, 0.07);
  if (eb.hp <= 0) killEnemy(eb, 'bowl'); else knock(eb, 1.1);
}

// ---------- pickups ----------
function updatePickups(dt) {
  const P = player, b = P.body;
  for (const pk of pickups) {
    if (!pk.active) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        pk.active = true;
        const pool = [...MELEE, ...GUNS];
        pk.item = pk.base === 'juice' ? 'juice' : pool[Math.floor(G.rng.next() * pool.length)];
        tintPad(pk); pk.ring.visible = pk.disc.visible = true;
        fx.ring(pk.x, 0.05, pk.z, ITEM_COLORS[pk.item], 1.6, 0.5, 0.9, 0.3);
      }
      continue;
    }
    if (!P.alive) continue;
    if (Math.hypot(b.x - pk.x, b.z - pk.z) < 1.05) {
      if (pk.item === 'juice') {
        if (P.hp >= P.max) continue;
        P.hp = Math.min(P.max, P.hp + 35);
        SFX.play('heal');
        const s = project(camera, b.x, 2.4, b.z, innerWidth, innerHeight);
        fx.text(s.x, s.y, '+35 AURA JUICE', 'heal');
      } else {
        P.weapon = pk.item; P.uses = WEAPONS[pk.item].uses; P.cd = 0; P.slapT = -1;
        if (WEAPONS[pk.item].gun) {
          const near = enemies.filter(e => !e.dead && e.state === 'alive' && Math.hypot(e.body.x - b.x, e.body.z - b.z) < 12);
          if (near.length) shout(near[Math.floor(Math.random() * near.length)], ['BRO IS STRAPPED', 'CHAT HE HAS A GUN', 'THAT IS NOT VERY SIGMA', 'NAH THIS IS CRAZY', 'OHIO GUN LAWS'][Math.floor(Math.random() * 5)], 2, '', true);
        }
        SFX.play('pickup');
        const s = project(camera, b.x, 2.4, b.z, innerWidth, innerHeight);
        fx.text(s.x, s.y, WEAPONS[pk.item].name.toUpperCase() + '!', 'item');
      }
      fx.burst(pk.x, 1, pk.z, 16, ITEM_COLORS[pk.item], 4, 0.08);
      pk.active = false; pk.respawn = 22; pk.ring.visible = pk.disc.visible = false; pk.label.hidden = true;
    }
  }
}

// ---------- chatter ----------
// Knuckles packs chant together: every member shows the same bubble at once.
function updatePacks(dt) {
  const pb = player.body;
  for (const id in G.packs) {
    const pk = G.packs[id];
    pk.t -= dt;
    if (pk.t > 0) continue;
    pk.t = 2.4 + Math.random() * 1.8;
    const mem = enemies.filter(e => e.pack == id && !e.dead);
    if (!mem.length && !pending.some(p => p.pack == id)) { delete G.packs[id]; continue; }
    const up = mem.filter(e => e.state === 'alive');
    if (!up.length || !up.some(e => Math.hypot(e.body.x - pb.x, e.body.z - pb.z) < 18)) continue;
    const r = Math.random();
    const line = r < 0.7 ? 'DO U KNOW DE WAY' : r < 0.82 ? 'SPIT ON HIM' : r < 0.92 ? 'DE WAY' : 'MY QUEEN';
    for (const e of up.slice(0, 3)) shout(e, line, 1.7, '', false);
    SFX.speak(line === 'DO U KNOW DE WAY' ? 'do you know da way' : line.toLowerCase(), 0.4, 0.95, true);
  }
}

function updateChatter(dt) {
  if (player.alive) updatePacks(dt);
  G.shoutT -= dt;
  if (G.shoutT > 0 || !player.alive) return;
  const pb = player.body;
  const cands = enemies.filter(e => !e.dead && e.state === 'alive' && !e.pack && !fx.isTalking(e) && Math.hypot(e.body.x - pb.x, e.body.z - pb.z) < 15);
  G.shoutT = cands.length > 8 ? 1.3 + Math.random() * 0.9 : 1.8 + Math.random() * 1.4;
  if (!cands.length) return;
  const e = cands[Math.floor(Math.random() * cands.length)];
  const line = Math.random() < 0.55 ? e.ty.lines[Math.floor(Math.random() * e.ty.lines.length)] : GENERIC[Math.floor(Math.random() * GENERIC.length)];
  shout(e, line, 2.2);
}

// ---------- HUD ----------
let vignette = 0;
const mini = $('#mini'), mctx = mini.getContext('2d');
const miniBase = document.createElement('canvas');
miniBase.width = miniBase.height = 300;
{
  const c = miniBase.getContext('2d'), s = 300 / Math.max(level.W, level.H);
  c.fillStyle = hex(theme.neon2) + '30';
  for (const cell of level.floorCells) { const i = cell % level.W, j = (cell / level.W) | 0; c.fillRect(i * s, j * s, s + 0.5, s + 0.5); }
  c.fillStyle = hex(theme.neon1) + '55';
  for (const cell of level.floorCells) if (level.roomId[cell] < 0) { const i = cell % level.W, j = (cell / level.W) | 0; c.fillRect(i * s, j * s, s + 0.5, s + 0.5); }
}
function drawMini() {
  const s = 300 / (Math.max(level.W, level.H) * T);
  mctx.clearRect(0, 0, 300, 300);
  mctx.drawImage(miniBase, 0, 0);
  for (const pk of pickups) if (pk.active) { mctx.fillStyle = hex(ITEM_COLORS[pk.item]); mctx.fillRect(pk.x * s - 4, pk.z * s - 4, 8, 8); }
  for (const p of pending) { mctx.strokeStyle = hex(theme.neon1); mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(p.x * s, p.z * s, 5, 0, 7); mctx.stroke(); }
  for (const e of enemies) {
    if (e.dead) continue;
    mctx.fillStyle = e.key === 'boss' ? '#ffffff' : '#ff3d5a';
    const r = e.key === 'boss' ? 7 : 3.5 * e.ty.scale;
    mctx.beginPath(); mctx.arc(e.body.x * s, e.body.z * s, r, 0, 7); mctx.fill();
  }
  const pb = player.body;
  mctx.fillStyle = '#ffe14d'; mctx.strokeStyle = '#0c0a12'; mctx.lineWidth = 3;
  mctx.beginPath();
  const a = pb.h, px = pb.x * s, pz = pb.z * s;
  mctx.moveTo(px + Math.sin(a) * 10, pz + Math.cos(a) * 10);
  mctx.lineTo(px + Math.sin(a + 2.5) * 7, pz + Math.cos(a + 2.5) * 7);
  mctx.lineTo(px + Math.sin(a - 2.5) * 7, pz + Math.cos(a - 2.5) * 7);
  mctx.closePath(); mctx.stroke(); mctx.fill();
}
function fmtTime(t, short = false) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
  return short ? `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}<span>.${String(cs).padStart(2, '0')}</span>`;
}
let hudFrame = 0;
function updateHUD() {
  const P = player;
  $('#clock').innerHTML = fmtTime(G.time);
  if (hudFrame++ % 3) return;
  $('#kills').textContent = G.kills;
  $('#aura').textContent = G.aura.toLocaleString();
  $('#hpFill').style.transform = `scaleX(${Math.max(0, P.hp) / P.max})`;
  $('#hpText').textContent = Math.max(0, Math.ceil(P.hp));
  $('#hp').classList.toggle('low', P.hp <= 30);
  const w = WEAPONS[P.weapon];
  $('#wName').textContent = w.gun ? `${w.name} · ${P.uses}` : w.name;
  $('#wUses').style.transform = `scaleX(${P.weapon === 'hand' ? 1 : P.uses / w.uses})`;
  $('#dash').style.setProperty('--p', `${Math.round((1 - Math.max(0, P.dashCd) / 1.1) * 100)}%`);
  const best = Math.max(G.best, 0);
  $('#lvlBest').textContent = best > 0 ? (G.time > best ? 'new personal best!' : `your best ${fmtTime(best, true)}`) : 'first run today';
  const ki = G.ki / KI_MAX, P2 = player;
  $('#kiFill').style.transform = `scaleX(${P2.kame ? 1 - P2.kame.t / KAME_DUR : ki})`;
  $('#ki').classList.toggle('ready', ki >= 1 && !P2.kame);
  $('#ki').classList.toggle('active', !!P2.kame);
  $('#kiText').textContent = P2.kame ? `KAMEHAMEHA ${Math.ceil(KAME_DUR - P2.kame.t)}s` : ki >= 1 ? (isTouch ? 'TAP KA' : 'PRESS 1 · KAMEHAMEHA') : `KI ${G.ki}/${KI_MAX}`;
  $('#tKame').hidden = !(ki >= 1 && !P2.kame);
  drawMini();
}

// ---------- boards ----------
function renderBoard(el, statusEl) {
  el.textContent = '';
  const rows = board.topRows(10);
  statusEl.textContent = board.status === 'online' ? 'LIVE' : board.status === 'readonly' ? 'VIEW ONLY' : 'THIS DEVICE';
  statusEl.className = 'status-pill ' + (board.status === 'online' ? 'online' : board.status === 'readonly' ? 'readonly' : 'local');
  const add = (rank, name, kills, time, me) => {
    const li = document.createElement('li'); if (me) li.className = 'me';
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = rank;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = name;
    const kl = document.createElement('span'); kl.className = 'kl'; kl.textContent = kills + ' cooked';
    const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = fmtTime(time, true);
    li.append(rk, nm, kl, tm); el.appendChild(li);
  };
  if (board.online) {
    rows.forEach((r, i) => add(i + 1, board.nameFor(r), r.kills || 0, r.best || 0, board.isMe(r)));
    const mineIn = rows.some(r => board.isMe(r));
    const myBest = board.myBest();
    if (!mineIn && myBest > 0 && board.canWrite) add('#' + board.rankOf(myBest), board.tag || 'You', board.local.kills || 0, myBest, true);
    if (!rows.length) {
      const li = document.createElement('li'); li.className = 'empty';
      li.textContent = 'Nobody has survived today\'s arena yet. Set the first time and everyone else has to beat it.';
      el.appendChild(li);
    }
  } else {
    const best = board.local.best || 0;
    if (best > 0) add(1, board.tag || 'You', board.local.kills || 0, best, true);
    else {
      const li = document.createElement('li'); li.className = 'empty';
      li.textContent = 'No runs yet today. Your best time will show up here.';
      el.appendChild(li);
    }
  }
}
function renderBoards() {
  renderBoard($('#board'), $('#boardStatus'));
  renderBoard($('#board2'), $('#boardStatus2'));
  const n = $('#boardNote');
  if (board.status === 'local') n.textContent = 'Shared daily board loads when this game is opened from its claude.ai link. Here, times stay on this device.';
  else if (board.status === 'readonly') n.textContent = 'You can watch the board, but posting needs a signed-in account with Contributor access.';
  else n.textContent = `Everyone plays the same arena today. Board resets at 00:00 UTC.`;
}
board.onChange(() => { renderBoards(); if (G) G.best = Math.max(G.best, board.myBest()); });

// ---------- menu ----------
$('#dayNum').textContent = DAYNUM;
$('#dayDate').textContent = new Date(DAY + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
$('#arenaName').textContent = `${theme.name} #${DAYNUM}`;
$('#lvlName').textContent = `${theme.name.toUpperCase()} #${DAYNUM}`;
$('#tag').value = board.tag;
$('#tag').addEventListener('change', () => { $('#tag').value = cleanTag($('#tag').value); board.setTag($('#tag').value); renderBoards(); });
function tickCountdown() {
  const ms = msUntilTomorrowUTC(), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  $('#countdown').textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
tickCountdown(); setInterval(tickCountdown, 1000);
const SETK = 'slaprot.settings';
try { Object.assign(SFX.settings, JSON.parse(localStorage.getItem(SETK)) || {}); } catch {}
for (const [id, key] of [['#tgSound', 'sound'], ['#tgMusic', 'music'], ['#tgVoices', 'voices']]) {
  const btn = $(id);
  btn.setAttribute('aria-pressed', String(SFX.settings[key]));
  btn.addEventListener('click', () => {
    SFX.settings[key] = !SFX.settings[key];
    btn.setAttribute('aria-pressed', String(SFX.settings[key]));
    SFX.initAudio(); SFX.applySettings();
    try { localStorage.setItem(SETK, JSON.stringify(SFX.settings)); } catch {}
  });
}
renderBoards();
board.init();

// Menu ambience: a few brainrot wander the arena while the camera orbits.
const demo = [];
function setupDemo() {
  const rng = new RNG(SEED);
  for (let k = 0; k < 10; k++) {
    const r = level.rooms[rng.int(0, level.rooms.length - 1)];
    const key = rng.pick(['skibidi', 'fanum', 'tralalero', 'sigma', 'tung', 'brute', 'sanic', 'spoder', 'bombardiro', 'ballerina', 'chimp', 'patapim', 'knuckles', 'chad']);
    const ty = TYPES[key];
    const b = new Body(ty.scale, ty.mass, ty.look.head ?? 1);
    const x = (r.cx + 0.5) * T + rng.range(-2, 2), z = (r.cy + 0.5) * T + rng.range(-2, 2);
    b.place(x, z, rng.range(0, 6.28));
    demo.push({ key, ty, look: LOOKS[key], body: b, ph: rng.range(0, 6), wob: rng.range(0, 9), tx: x, tz: z, t: 0 });
  }
}
setupDemo();
function updateDemo(dt) {
  for (const d of demo) {
    const b = d.body;
    d.t -= dt;
    if (d.t <= 0) {
      d.t = 2 + Math.random() * 3;
      const a = Math.random() * 6.28;
      d.tx = b.x + Math.cos(a) * 4; d.tz = b.z + Math.sin(a) * 4;
    }
    let dx = d.tx - b.x, dz = d.tz - b.z; const dl = Math.hypot(dx, dz);
    const sp = dl > 0.3 ? 1.8 : 0;
    if (dl > 0.3) { b.x += dx / dl * sp * dt; b.z += dz / dl * sp * dt; b.h = angTo(b.h, Math.atan2(dx, dz), dt * 4); }
    const r = col.circle(b.x, b.z, 0.3 * b.s); b.x = r.x; b.z = r.z;
    d.ph += sp * dt * 2.5;
    b.resetPose(); poseWalk(b, d.ph, sp / 3, 0.05);
    poseArms({ atk: -1, ty: d.ty, wob: d.wob }, b);
    b.computeTargets();
  }
}

// ---------- main loop ----------
let last = performance.now();
const camOff = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
  SFX.decayBeat(dt);
  if (mode === 'paused') { render(dt); return; }
  let sim = dt;
  if (hitstop > 0) { hitstop -= dt; sim = dt * 0.06; }
  if (mode === 'dying') { G.deathT += dt; sim *= G.deathT < 1.4 ? 0.3 : 1; if (G.deathT > 2.2) endRun(); }
  animT += sim;

  if (mode === 'play' || mode === 'dying' || mode === 'over') {
    if (mode === 'play') G.time += dt;
    if (mode !== 'over') {
      updatePlayer(sim);
      updateEnemies(sim);
      updatePickups(sim);
      updateBullets(sim);
      updateEnemyShots(sim);
      if (mode === 'play') { updateSpawns(sim); updateChatter(sim); }
      nav.computeTimer = (nav.computeTimer || 0) - sim;
      if (nav.computeTimer <= 0) { nav.computeTimer = 0.2; nav.compute(player.body.x, player.body.z); }
    }
    stepPhysics(sim, bodies);
  } else if (mode === 'menu') {
    updateDemo(dt);
    stepPhysics(dt, demo.map(d => d.body));
  }
  render(dt);
}

function stepPhysics(sim, list) {
  acc += sim;
  let n = Math.floor(acc / PH);
  if (n > 5) { n = 5; acc = 0; } else acc -= n * PH;
  if (n <= 0) return;
  for (const b of list) if (b.drive > 0) b.computeTargets(); else b.freshTargets = true;
  stepWorld(list, PH, n, col, onImpact);
  collideBodies(list, PH, onBodyHit);
}

function render(dt) {
  // camera
  const w = innerWidth, h = innerHeight, portrait = h > w;
  if (mode === 'menu') {
    menuAngle += dt * 0.07;
    const cx = level.W * T / 2, cz = level.H * T / 2;
    camTarget.set(cx, 0, cz);
    camera.position.set(cx + Math.sin(menuAngle) * 34, 38, cz + Math.cos(menuAngle) * 34);
    camera.lookAt(camTarget);
    scene.fog.near = 40; scene.fog.far = 110;
  } else if (player) {
    const pb = player.body;
    const al = Math.hypot(player.aimX, player.aimZ) || 1;
    const lead = player.alive ? 1.6 : 0;
    const tx = pb.x + player.aimX / al * lead, tz = pb.z + player.aimZ / al * lead;
    const k = Math.min(1, dt * 6);
    camTarget.x += (tx - camTarget.x) * k; camTarget.z += (tz - camTarget.z) * k;
    const dist = portrait ? 1.35 : 1;
    const zoom = mode === 'dying' ? Math.max(0.72, 1 - G.deathT * 0.25) : 1;
    camOff.set(0, 14.5 * dist * zoom * camZoom, 8.6 * dist * zoom * camZoom);
    shake = Math.max(0, shake - dt * 3.2);
    const sx = (Math.random() - 0.5) * shake * 0.7, sz = (Math.random() - 0.5) * shake * 0.7;
    camera.position.set(camTarget.x + camOff.x + sx, camOff.y + sx * 0.5, camTarget.z + camOff.z + sz);
    camera.lookAt(camTarget.x + sx * 0.4, 0, camTarget.z + sz * 0.4);
  }
  sun.position.set(camTarget.x + 7, 24, camTarget.z + 9);
  sun.target.position.set(camTarget.x, 0, camTarget.z);
  if (player && mode !== 'menu') plight.position.set(player.body.x, 4.2, player.body.z);
  else plight.position.set(camTarget.x, 6, camTarget.z);
  muzzleFlash = Math.max(0, muzzleFlash - dt * 14);
  plight.intensity = 7 + muzzleFlash * 45;
  fx.setTracers(mode === 'play' || mode === 'dying' || mode === 'paused' ? bullets.concat(eshots) : []);
  drawKame();
  {
    // the nearest Super Saiyan Chad lights up the floor around him
    let best = null, bd = 22;
    if (player && mode !== 'menu') for (const e of enemies) if (e.ssj && !e.dead) { const d = Math.hypot(e.body.x - player.body.x, e.body.z - player.body.z); if (d < bd) { bd = d; best = e; } }
    ssjLight.intensity = best ? 2.5 + Math.sin(animT * 30) * 0.6 : 0;
    if (best) ssjLight.position.set(best.body.x, 0.35, best.body.z + 0.6);
  }
  boomT = Math.max(0, boomT - dt * 3);
  boomLight.intensity = boomT * 90;

  // beat-synced glow
  const bt = SFX.beat;
  LV.glowMat.opacity = 0.45 + bt * 0.5;
  bloom.strength = 0.55 + bt * 0.1 + (hitstop > 0 ? 0.3 : 0);

  // characters
  cr.begin();
  if (mode === 'menu') {
    for (const d of demo) cr.drawBody(d.body, d.look, { time: animT + d.wob, talk: false });
  } else {
    for (const e of enemies) {
      cr.drawBody(e.body, e.look, { flash: e.flash, dead: e.dead, dizzy: e.state === 'down' || e.state === 'rise', talk: animT < e.talkUntil,
        time: animT + e.wob, blink: e.blinkT < 0 && !e.dead, fuse: e.fuse, ssj: e.ssj && !e.dead });
    }
    if (player) {
      const P = player;
      const inv = P.inv > 0 && P.alive && Math.floor(animT * 20) % 2 === 0;
      cr.spin = P.spin;
      cr.drawBody(P.body, PLOOK, { flash: Math.max(P.flash, inv ? 0.35 : 0, P.webbed > 0 ? 0.3 : 0), dead: !P.alive, time: animT, weapon: P.weapon !== 'hand' ? P.weapon : null,
        handR: P.weapon === 'hand' ? 0.13 : 0.11, talk: false });
    }
  }
  // pickups
  for (const pk of pickups) {
    if (!pk.active) continue;
    const a = animT * 1.8 + pk.x;
    const y = 1.05 + Math.sin(animT * 3 + pk.z) * 0.12;
    if (pk.item === 'juice') cr.drawItem('juice', pk.x, y, pk.z, 0, 0, 1, [0, 1, 0], 1.3);
    else {
      const dx = Math.cos(a), dz = Math.sin(a);
      cr.drawItem(pk.item, pk.x - dx * 0.5, y, pk.z - dz * 0.5, dx, 0.25, dz, [0, 1, 0], 1.25);
    }
    pk.ring.rotation.y = a; const s = 1 + bt * 0.12; pk.ring.scale.set(s, 1, s);
  }
  cr.end();

  if (player && mode !== 'menu') {
    const pb = player.body;
    fx.avoid = project(camera, pb.p[CHEST * 3], pb.p[CHEST * 3 + 1], pb.p[CHEST * 3 + 2], w, h);
    fx.focus = { x: pb.x, z: pb.z };
  } else { fx.avoid = null; fx.focus = null; }
  fx.update(mode === 'paused' ? 0 : dt * (hitstop > 0 ? 0.3 : 1), camera, w, h, (t) => (t.body && enemies.includes(t) ? { x: t.body.p[0], y: t.body.p[1], z: t.body.p[2] } : null));

  // pickup labels
  for (const pk of pickups) {
    const show = pk.active && player && mode !== 'menu' && Math.hypot(player.body.x - pk.x, player.body.z - pk.z) < 8;
    if (!show) { if (!pk.label.hidden) pk.label.hidden = true; continue; }
    const s = project(camera, pk.x, 2.0, pk.z, w, h);
    pk.label.hidden = false;
    pk.label.style.transform = `translate(${s.x.toFixed(0)}px, ${s.y.toFixed(0)}px) translate(-50%, -100%)`;
  }

  if (mode === 'play' || mode === 'dying') updateHUD();
  vignette = Math.max(0, vignette - dt * 2.2);
  const low = player && player.alive && mode !== 'menu' && player.hp <= 30 ? 0.35 + Math.sin(animT * 6) * 0.15 : 0;
  $('#vignette').style.opacity = Math.max(vignette, low).toFixed(3);

  composer.render();
}

function drawKame() {
  const K = player && player.alive && mode !== 'menu' && mode !== 'over' ? player.kame : null;
  const firing = K && K.t >= KAME_CHARGE;
  beamOuter.visible = beamCore.visible = beamEnd.visible = !!firing;
  beamOrb.visible = !!K && !firing;
  kameLight.intensity = K ? (firing ? 16 : 8 * Math.min(1, K.t / KAME_CHARGE)) : 0;
  SFX.setBeam(firing && mode === 'play' ? 1 : 0);
  if (!K) return;
  const b = player.body;
  if (!firing) {
    const hx = (b.p[LHA * 3] + b.p[RHA * 3]) / 2, hy = (b.p[LHA * 3 + 1] + b.p[RHA * 3 + 1]) / 2, hz = (b.p[LHA * 3 + 2] + b.p[RHA * 3 + 2]) / 2;
    const r = 0.08 + 0.3 * Math.min(1, K.t / KAME_CHARGE) + Math.sin(animT * 50) * 0.02;
    beamOrb.position.set(hx, hy, hz); beamOrb.scale.setScalar(r);
    kameLight.position.set(hx, hy + 0.5, hz);
    if (Math.random() < 0.5) fx.burst(hx + (Math.random() - 0.5) * 2, hy + (Math.random() - 0.5), hz + (Math.random() - 0.5) * 2, 1, 0x7fe9ff, 0.5, 0.05, 0, 0);
    return;
  }
  const wob = 1 + Math.sin(animT * 45) * 0.08;
  const fade = Math.min(1, (KAME_DUR - K.t) / 0.4);
  for (const [m, r] of [[beamOuter, 0.62], [beamCore, 0.24]]) {
    m.position.set(K.x, K.y, K.z); m.rotation.set(0, b.h, 0);
    m.scale.set(r * wob * fade, r * wob * fade, K.L);
  }
  beamEnd.position.set(K.x + Math.sin(b.h) * K.L, K.y, K.z + Math.cos(b.h) * K.L);
  beamEnd.scale.setScalar(0.8 * wob * fade);
  beamOrb.visible = true; beamOrb.position.set(K.x, K.y, K.z); beamOrb.scale.setScalar(0.32 * wob * fade);
  kameLight.position.set(K.x + Math.sin(b.h) * K.L * 0.4, 2.5, K.z + Math.cos(b.h) * K.L * 0.4);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = h > w ? 52 : 40;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
nav.compute(level.startPos.x, level.startPos.z);
requestAnimationFrame(frame);



