# Brainrot Arena

A daily survival brawler in the browser. Every day (UTC) generates one new arena of rooms and corridors, and everyone plays the same one. Waves of shouting brainrot characters keep spawning faster and bigger until they get you; your survival time is your score.

**Play:** https://eor2001.github.io/brainrot-arena/

## How to play

- **Goal:** survive as long as you can. There's no timer and no win screen.
- **Move** `WASD` / arrow keys · **Aim** mouse · **Attack** click (hold to keep attacking) · **Dash** `Space` · **Kamehameha** `1` · **Zoom** scroll · **Pause** `Esc`
- On phones: left stick to move, SLAP auto-aims, DASH, and KA when the Kamehameha is ready.
- Dashing with a melee weapon slashes everything along the dash.
- Every kill charges KI. At 25, press `1` for a 10-second Kamehameha beam.

## What's in it

- Active ragdoll physics (Verlet, 15 particles per character): slaps launch enemies, they bounce off walls, knock each other over and get back up.
- Weapons: bare hands, Wet Fish, Frying Pan, La Chancla, Mega Glove, Samurai Sword, Rizz Pistol, Skibidi Shotgun, Gyatt Gatling, plus Aura Juice heals.
- Enemies: Skibidi Toilet Guy, Fanum Taxman, Tralalero Tralala, Sigma, Tung Tung Tung Sahur, Gyatt Brute, Sanic, Spoderman, Bombardiro Crocodilo, Ballerina Cappuccina, Chimpanzini Bananini, Brr Brr Patapim, Ugandan Knuckles packs, Chad (who goes Super Saiyan) and the Ohio Final Boss.
- Synthesized sound effects, a procedural phonk loop, and enemies that shout their lines through the browser's speech synthesis.

## Leaderboard

The shared daily leaderboard runs on the claude.ai artifact version of the game. The GitHub Pages build keeps your best times on your own device.

## Run locally

It's static files with ES modules (three.js from a CDN), so serve the folder over HTTP:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Code

- `index.html` – markup, styles, HUD and menus
- `js/main.js` – game loop, player, enemies, weapons, spawning, HUD
- `js/ragdoll.js` – Verlet ragdoll physics and pose helpers
- `js/chars.js` – enemy roster, weapons and the instanced character renderer
- `js/level.js` – daily level generation, collision, pathfinding and meshes
- `js/audio.js` – synthesized SFX, music and speech
- `js/fx.js` – particles, rings, pop-up text and speech bubbles
- `js/board.js` – daily leaderboard (shared on claude.ai, local otherwise)
