// Sunshore City — the map: roads, districts, buildings, shops and the
// waterfront. The city is a grid of avenues and streets; buildings fill the
// blocks between them, each block coloured by its district. Everything the
// game needs to know about "where can I drive / walk" comes from here.
import { WORLD, DISTRICTS } from './config.js';
import { clamp } from './utils.js';

export const ROADS_X = [300, 750, 1200, 1650, 2100, 2550, 2900];
export const ROADS_Y = [250, 650, 1050, 1450, 1850, 2150];
export const ROAD_W = 96;
export const WATER_X = 130; // the marina bay, west edge

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
export function onWater(x, y) { return x < WATER_X && y > 180 && y < 1300; }
// Nearest point on the road network (traffic and the autopilot snap to it).
export function nearestRoadPoint(x, y) {
  let bx = x; let by = y; let best = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; bx = rx; by = y; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best) { best = d; bx = x; by = ry; }
  }
  return { x: clamp(bx, 60, WORLD.width - 60), y: clamp(by, 60, WORLD.height - 60) };
}
// Is this spot inside a building? Buildings are solid for cars and people.
export function buildCity(rng) {
  const buildings = [];
  const shops = [];
  const palette = ['#7a6a9e', '#9e7a5a', '#5a8a7a', '#a85a5a', '#6a7a9e', '#8a9e5a', '#b08a3f'];
  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      const tall = d.name === 'Downtown';
      const n = tall ? 2 : rng.int(1, 2);
      for (let b = 0; b < n; b += 1) {
        const w = tall ? rng.range(70, 130) : rng.range(60, 110);
        const h = tall ? rng.range(70, 130) : rng.range(55, 95);
        const bx = n === 1 ? cx - w / 2 : x0 + 10 + b * ((x1 - x0 - w - 20) / Math.max(1, n - 1 || 1));
        const by = n === 1 ? cy - h / 2 : y0 + 12 + rng.range(0, Math.max(0, y1 - y0 - h - 24));
        buildings.push({
          x: bx, y: by, w, h, color: rng.pick(palette),
          roof: rng.pick(['#5a4a6a', '#6a5a4a', '#4a6a5a', '#7a5a3a']),
          tall, district: d.name,
        });
      }
    }
  }
  // Shops: ammo + health on main streets, car dealer downtown, garage for M1.
  shops.push({ kind: 'ammo', name: 'Ammo Mart', x: 1200, y: 650, price: 40 });
  shops.push({ kind: 'health', name: 'Sun Clinic', x: 1650, y: 1050, price: 60 });
  shops.push({ kind: 'ammo', name: 'Ammo Mart', x: 750, y: 1850, price: 40 });
  shops.push({ kind: 'dealer', name: 'Reyes Motors', x: 2100, y: 650, price: 0 });
  shops.push({ kind: 'garage', name: 'Luz Garage', x: 2550, y: 1050, price: 0 });
  shops.push({ kind: 'safehouse', name: 'Safehouse', x: 750, y: 1450, price: 0 });
  return { buildings, shops };
}
export function hitsBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function nearestShop(shops, x, y, maxDist) {
  let best = null; let bd = maxDist;
  for (const s of shops) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
