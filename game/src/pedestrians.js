// Sunshore City — pedestrians. They walk the sidewalks, cross at corners,
// chat in small groups, and run from gunfire, crashes and police chases.
// A fleeing crowd is the city's fastest way to say "something just happened".
import { ROADS_X, ROADS_Y, ROAD_W, nearestRoadPoint, hitsBuilding } from './city.js';
import { clamp, dist } from './utils.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#fd9644', '#ecf0f1', '#1abc9c'];
export function spawnPedestrians(state, rng, count) {
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(200, 3200); const y = rng.range(200, 2400);
    const near = nearestRoadPoint(x, y);
    const px = near.x + (rng.chance(0.5) ? 1 : -1) * (ROAD_W / 2 + rng.range(8, 26));
    const py = near.y + rng.range(-160, 160);
    state.peds.push({
      x: clamp(px, 90, 3310), y: clamp(py, 90, 2510),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(45, 85),
      shirt: rng.pick(SHIRTS), flee: 0, tx: px, ty: py, pause: rng.range(0, 3),
    });
  }
}
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.flee = 2.5 + Math.random() * 1.5;
      const a = Math.atan2(ped.y - y, ped.x - x);
      ped.tx = clamp(ped.x + Math.cos(a) * 260, 90, 3310);
      ped.ty = clamp(ped.y + Math.sin(a) * 260, 90, 2510);
    }
  }
}
export function updatePedestrians(state, dt) {
  for (const ped of state.peds) {
    if (ped.pause > 0) { ped.pause -= dt; continue; }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 12) {
      // Reached the corner: pick a new stroll target along the sidewalk.
      const near = nearestRoadPoint(ped.x, ped.y);
      ped.tx = clamp(near.x + (Math.random() < 0.5 ? 1 : -1) * (ROAD_W / 2 + 14), 90, 3310);
      ped.ty = clamp(near.y + (Math.random() < 0.5 ? -1 : 1) * Math.random() * 320, 90, 2510);
      ped.pause = Math.random() * 2.5;
      continue;
    }
    const speed = ped.flee > 0 ? 190 : ped.speed;
    if (ped.flee > 0) ped.flee -= dt;
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * speed * dt;
    const ny = ped.y + Math.sin(a) * speed * dt;
    if (!hitsBuilding(state.city.buildings, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
    else { ped.tx = ped.x; ped.ty = ped.y; }
    ped.x = clamp(ped.x, 90, 3310); ped.y = clamp(ped.y, 90, 2510);
  }
}
