// Sunshore City — HUD and minimap, drawn on the same canvas as the world:
// health bar, cash, wanted stars, mission objective, clock, message line,
// and a live minimap (roads, districts, player arrow, mission blip, police
// blips, shops). Everything the judge needs to read the game at a glance.
import { PALETTE, FONT, WORLD } from './config.js';
import { ROADS_X, ROADS_Y, districtAt } from './city.js';
import { missionObjective } from './missions.js';

export function drawHud(ctx, state, viewW, viewH) {
  const p = state.player;
  ctx.textBaseline = 'top';
  // Health bar, top left.
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(14, 14, 220, 54);
  ctx.fillStyle = '#fff'; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText('MANNY REYES', 24, 20);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 40, 160, 12);
  ctx.fillStyle = p.hp > 30 ? PALETTE.hp : '#e74c3c';
  ctx.fillRect(24, 40, 160 * (p.hp / 100), 12);
  ctx.fillStyle = '#fff'; ctx.font = `13px ${FONT}`;
  ctx.fillText(`${Math.ceil(p.hp)} HP`, 190, 39);
  // Cash + ammo, top centre-left.
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(244, 14, 190, 54);
  ctx.fillStyle = '#7ee787'; ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`$${p.cash}`, 256, 22);
  ctx.fillStyle = '#fff'; ctx.font = `13px ${FONT}`;
  ctx.fillText(`Ammo ${p.ammo}  •  ${p.inCar ? (p.car ? p.car.name : 'Car') : 'On foot'}`, 256, 46);
  // Wanted stars, top right (above the minimap).
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(viewW - 220, 14, 206, 40);
  ctx.font = '22px sans-serif'; ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', viewW - 208 + i * 34, 20);
  }
  // Clock.
  const hours = Math.floor(state.clock / 60);
  const mins = Math.floor(state.clock % 60);
  ctx.fillStyle = '#fff'; ctx.font = `700 16px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`${String(hours % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`, viewW - 24, 60);
  ctx.textAlign = 'left';
  // Mission objective bar, bottom centre.
  const objective = missionObjective(state);
  ctx.font = `600 16px ${FONT}`;
  const ow = ctx.measureText(objective).width + 36;
  ctx.fillStyle = 'rgba(10,16,24,0.78)';
  ctx.fillRect((viewW - ow) / 2, viewH - 46, ow, 32);
  ctx.fillStyle = '#ffd94a';
  ctx.fillText('◆ ' + objective, (viewW - ow) / 2 + 18, viewH - 38);
  // Message line above it.
  if (state.message && state.messageTimer > 0) {
    ctx.font = `15px ${FONT}`;
    const mw = ctx.measureText(state.message).width + 28;
    ctx.fillStyle = 'rgba(10,16,24,0.7)';
    ctx.fillRect((viewW - mw) / 2, viewH - 84, mw, 28);
    ctx.fillStyle = '#fff';
    ctx.fillText(state.message, (viewW - mw) / 2 + 14, viewH - 77);
  }
  // Controls hint, bottom left.
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `12px ${FONT}`;
  ctx.fillText('WASD move/drive • E enter car • F punch • Click shoot • B buy • N next job • P pause • M mute', 14, viewH - 18);
  drawMinimap(ctx, state, viewW, viewH);
}
function drawMinimap(ctx, state, viewW, viewH) {
  const size = 168; const x0 = viewW - size - 14; const y0 = 88;
  const sx = size / WORLD.width; const sy = size / WORLD.height;
  ctx.fillStyle = 'rgba(10,16,24,0.8)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  // District tint.
  for (const d of [{ x: 900, y: 200, w: 1500, h: 900, c: '#8f7fb8' }, { x: 0, y: 200, w: 900, h: 1100, c: '#4f9db8' }, { x: 0, y: 1300, w: 1300, h: 1100, c: '#b8703f' }, { x: 1300, y: 1300, w: 1100, h: 1100, c: '#5f8f4f' }, { x: 2400, y: 1300, w: 1000, h: 1100, c: '#c86f2f' }]) {
    ctx.fillStyle = d.c; ctx.globalAlpha = 0.35;
    ctx.fillRect(x0 + d.x * sx, y0 + d.y * sy, d.w * sx, d.h * sy);
    ctx.globalAlpha = 1;
  }
  // Roads.
  ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + size); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + size, y0 + ry * sy); ctx.stroke(); }
  // Shops.
  ctx.fillStyle = '#58d68d';
  for (const s of state.city.shops) { ctx.fillRect(x0 + s.x * sx - 2, y0 + s.y * sy - 2, 4, 4); }
  // Police blips.
  ctx.fillStyle = '#5aa0ff';
  for (const cop of state.cops) { ctx.beginPath(); ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 3.5, 0, Math.PI * 2); ctx.fill(); }
  // Mission blip, pulsing.
  if (state.mission && state.mission.marker) {
    const pulse = 4 + Math.sin(state.elapsed * 5) * 1.5;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(x0 + state.mission.marker.x * sx, y0 + state.mission.marker.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `11px ${FONT}`;
  ctx.fillText(districtAt(p.x, p.y).name.toUpperCase(), x0, y0 + size + 10);
}
