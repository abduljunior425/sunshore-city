// Sunshore City — drawing only: the world and the current screen in, pixels
// out. Top-down camera follows Manny; the sun-soaked palette comes from long
// shadows, warm ground and distinct district colours. HUD and panels are
// drawn by hud.js and the panel helpers here.
import { PALETTE, FONT, VIEW, WORLD } from './config.js';
import { ROADS_X, ROADS_Y, ROAD_W, WATER_X, districtAt, onWater } from './city.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: VIEW.width, h: VIEW.height };
  let lastCam = { x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w; canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
    view.w = w / view.scale; view.h = h / view.scale;
  }
  const fonts = new Map();
  function text(v, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color; ctx.textAlign = align || 'left';
    ctx.fillText(v, x, y);
  }
  function drawWorld(state) {
    const p = state.player;
    const camX = Math.max(0, Math.min(WORLD.width - view.w, p.x - view.w / 2));
    const camY = Math.max(0, Math.min(WORLD.height - view.h, p.y - view.h / 2));
    state.camera = { x: camX, y: camY };
    lastCam = state.camera;
    ctx.save();
    ctx.translate(-camX, -camY);
    // Ground: district-tinted blocks.
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(camX - 20, camY - 20, view.w + 40, view.h + 40);
    for (const d of state.cityDistricts) {
      if (d.x + d.w < camX || d.x > camX + view.w || d.y + d.h < camY || d.y > camY + view.h) continue;
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // Marina water.
    ctx.fillStyle = '#3f8fb8';
    ctx.fillRect(0, 180, WATER_X, 1120);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(20 + i * 18, 260 + i * 150, 60, 3);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) { ctx.fillRect(rx - ROAD_W / 2 - 12, 0, 12, WORLD.height); ctx.fillRect(rx + ROAD_W / 2, 0, 12, WORLD.height); }
    for (const ry of ROADS_Y) { ctx.fillRect(0, ry - ROAD_W / 2 - 12, WORLD.width, 12); ctx.fillRect(0, ry + ROAD_W / 2, WORLD.width, 12); }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) for (let y = 40; y < WORLD.height; y += 90) ctx.fillRect(rx - 3, y, 6, 44);
    for (const ry of ROADS_Y) for (let x = 40; x < WORLD.width; x += 90) ctx.fillRect(x, ry - 3, 44, 6);
    // Traffic lights at the downtown crossroads.
    drawLights(state);
    // Buildings with long sun shadows.
    for (const b of state.city.buildings) {
      if (b.x + b.w < camX || b.x > camX + view.w || b.y + b.h < camY || b.y > camY + view.h) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 14, b.y + 16, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 18) {
          for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 18) ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }
    // Shops.
    for (const s of state.city.shops) {
      ctx.fillStyle = s.kind === 'safehouse' ? '#2ecc71' : s.kind === 'dealer' ? '#f39c12' : '#e67e22';
      ctx.fillRect(s.x - 22, s.y - 22, 44, 44);
      ctx.fillStyle = '#fff'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(s.kind === 'ammo' ? 'AMMO' : s.kind === 'health' ? 'CLINIC' : s.kind === 'dealer' ? 'CARS' : s.kind === 'garage' ? 'GARAGE' : 'SAFE', s.x, s.y + 4);
    }
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      ctx.fillStyle = pk.kind === 'ammo' ? '#f1c40f' : pk.kind === 'health' ? '#58d68d' : '#7ee787';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d2733'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'ammo' ? 'A' : pk.kind === 'health' ? '+' : '$', pk.x, pk.y + bob + 4);
    }
    // Mission marker: a tall yellow beacon + ring.
    if (state.mission && state.mission.marker) {
      const mk = state.mission.marker;
      const pulse = 26 + Math.sin(state.elapsed * 5) * 6;
      ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(mk.x, mk.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,217,74,0.85)';
      ctx.beginPath(); ctx.moveTo(mk.x, mk.y - 52); ctx.lineTo(mk.x + 10, mk.y - 30); ctx.lineTo(mk.x - 10, mk.y - 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1d2733'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(mk.label, mk.x, mk.y - 58);
    }
    drawCars(state);
    drawPeds(state);
    drawBullets(state);
    drawEnemies(state);
    drawPlayer(state);
    ctx.restore();
    return { camX, camY };
  }
  function drawLights(state) {
    const red = state.lightRed;
    for (const rx of ROADS_X) for (const ry of ROADS_Y) {
      if (rx < 900 || rx > 2400 || ry < 200 || ry > 1100) continue; // downtown lights only
      ctx.fillStyle = '#222';
      ctx.fillRect(rx - 58, ry - 58, 10, 22);
      ctx.fillStyle = red ? '#e74c3c' : '#2ecc71';
      ctx.beginPath(); ctx.arc(rx - 53, ry - 52, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawCarShape(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-car.len / 2 + 5, -car.wid / 2 + 6, car.len, car.wid);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(-car.len / 6, -car.wid / 2 + 4, car.len / 4, car.wid - 8);
    ctx.fillStyle = car.model === 'police' ? '#fff' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(car.len / 2 - 12, -car.wid / 2 + 3, 8, car.wid - 6);
    if (car.model === 'taxi') { ctx.fillStyle = '#111'; ctx.font = `700 9px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); }
    if (car.model === 'police') {
      ctx.fillStyle = '#2f6fd0'; ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 2, car.len - 8, 6);
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath(); ctx.arc(0, -car.wid / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f6fd0';
      ctx.beginPath(); ctx.arc(8, -car.wid / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (car.smoke) {
      ctx.fillStyle = 'rgba(120,120,120,0.6)';
      ctx.beginPath(); ctx.arc(-car.len / 2, 0, 8 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawCars(state) {
    for (const car of state.cars) {
      if (state.player.inCar && state.player.car === car) continue;
      drawCarShape(car);
    }
    if (state.player.inCar && state.player.car) drawCarShape(state.player.car);
  }
  function drawPeds(state) {
    for (const ped of state.peds) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(3, 4, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  function drawEnemies(state) {
    for (const e of state.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = '#8e2f2f';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(6, -3, 16, 5);
      ctx.restore();
      ctx.fillStyle = '#222'; ctx.fillRect(e.x - 14, e.y - 22, 28, 5);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x - 14, e.y - 22, 28 * (e.hp / 80), 5);
    }
  }
  function drawBullets(state) {
    ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(3, 4, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(5, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -4, 14, 4);
    ctx.fillRect(8, 1, 14, 4);
    ctx.restore();
  }
  function drawPanel(title, lines, prompt) {
    const w = 640; const lineH = 30;
    const h = 170 + lines.length * lineH;
    const x = (VIEW.width - w) / 2; const y = (VIEW.height - h) / 2;
    ctx.fillStyle = 'rgba(20,28,40,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 64, 44, '#ffd94a', 'center', '700');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], VIEW.width / 2, y + 116 + i * lineH, 19, '#fff7e6', 'center');
    text(prompt, VIEW.width / 2, y + h - 26, 20, '#7ee787', 'center', '600');
  }
  function draw(state, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      // Title over a live slice of the city: downtown at dawn.
      const saved = state.player;
      state.player = { ...saved, x: 1650, y: 650, angle: 0 };
      drawWorld(state);
      state.player = saved;
      ctx.fillStyle = 'rgba(10,16,24,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('SUNSHORE CITY', [
        'Manny Reyes is out — and Luz has jobs across the city.',
        'Steal cars, outrun the cops, run five jobs, get rich.',
        'WASD move / drive  •  E enter car  •  F punch  •  Click shoot',
        'B buy  •  N next job  •  P pause  •  M mute',
      ], 'Press Space or click to start');
      return;
    }
    const cam = drawWorld(state);
    drawHud(ctx, state, view.w, view.h);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10,16,24,0.6)';
      ctx.fillRect(0, 0, view.w, view.h);
      drawPanel('PAUSED', ['The city waits for no one — except right now.', `Cash $${state.player.cash}  •  Jobs done ${state.missionsDone.length}/5`], 'Press P to resume  •  Progress saved');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', ['Manny got patched up at the Safehouse.', 'The city is still out there.'], 'Press Space to play again');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The cops caught Manny. Luz paid the fine.', 'Drive smarter next time.'], 'Press Space to continue');
    }
    void cam;
  }
  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    // Convert a screen-space mouse position to world coordinates for aiming.
    screenToWorld(sx, sy) {
      const cam = stateCamera();
      return { x: (sx - view.x) / view.scale + cam.x, y: (sy - view.y) / view.scale + cam.y };
    },
  };
  function stateCamera() {
    return lastCam;
  }
}
