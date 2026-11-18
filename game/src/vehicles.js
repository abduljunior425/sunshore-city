// Sunshore City — vehicles: five models, traffic that follows the roads and
// stops at lights, parked cars to steal, damage and smoke. A car is one
// object whether Manny, a commuter or a cop drives it.
import { DRIVE } from './config.js';
import { ROADS_X, ROADS_Y, ROAD_W, nearestRoadPoint, onRoad } from './city.js';
import { clamp, angleDiff, wrapAngle, TAU } from './utils.js';

export const MODELS = {
  sedan: { name: 'Sedan', len: 52, wid: 26, top: 520, accel: 1.0, colors: ['#c0392b', '#2e86c1', '#7d3c98', '#b7950b'] },
  taxi: { name: 'Taxi', len: 52, wid: 26, top: 500, accel: 0.95, colors: ['#f4c20d'] },
  van: { name: 'Van', len: 62, wid: 28, top: 420, accel: 0.8, colors: ['#e5e8e8', '#5d6d7e'] },
  sports: { name: 'Sports', len: 54, wid: 26, top: 660, accel: 1.25, colors: ['#e74c3c', '#f39c12', '#16a085'] },
  truck: { name: 'Truck', len: 72, wid: 30, top: 380, accel: 0.7, colors: ['#935116', '#1b4f72'] },
  police: { name: 'Patrol', len: 54, wid: 27, top: 620, accel: 1.15, colors: ['#1a1a2e'] },
};
let nextId = 1;
export function makeCar(model, x, y, angle, driver) {
  const def = MODELS[model];
  return {
    id: nextId += 1, model, name: def.name, x, y, angle, speed: 0,
    len: def.len, wid: def.wid, top: def.top, accelMul: def.accel,
    color: def.colors[Math.floor(Math.random() * def.colors.length)],
    driver: driver || 'traffic', health: 100, smoke: 0, horn: 0,
    targetSpeed: 0, routeAngle: angle, lightWait: 0, stuck: 0,
  };
}
// Parked cars line the streets; these are the ones Manny can steal.
export function spawnParkedCars(state, rng) {
  const spots = [];
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      if (rng.chance(0.45)) spots.push({ x: rx + ROAD_W / 2 + 18, y: ry + rng.range(-140, 140), angle: 0 });
      if (rng.chance(0.45)) spots.push({ x: rx - ROAD_W / 2 - 18, y: ry + rng.range(-140, 140), angle: Math.PI });
    }
  }
  const models = ['sedan', 'sedan', 'taxi', 'van', 'sports', 'truck'];
  for (const s of spots.slice(0, 26)) {
    state.cars.push(makeCar(rng.pick(models), s.x, s.y, s.angle, 'parked'));
  }
  // The sports car M1 needs, parked by the marina.
  const m1 = makeCar('sports', 300 + ROAD_W / 2 + 18, 650, 0, 'parked');
  m1.color = '#e74c3c'; m1.missionCar = true;
  state.cars.push(m1);
}
export function spawnTraffic(state, rng, count) {
  const models = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sports'];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.chance(0.5);
    const x = vertical ? rng.pick(ROADS_X) + rng.pick([-22, 22]) : rng.range(200, 3200);
    const y = vertical ? rng.range(200, 2400) : rng.pick(ROADS_Y) + rng.pick([-22, 22]);
    const angle = vertical ? (x % 2 === 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    const car = makeCar(rng.pick(models), x, y, vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI), 'traffic');
    car.speed = rng.range(120, 220);
    state.cars.push(car);
  }
}
// One physics step for a driven car: throttle, steering, drift, drag.
export function driveCar(car, throttle, steer, dt, handbrake) {
  const top = car.top * (car.health < 40 ? 0.6 : 1);
  if (throttle > 0) car.speed += DRIVE.accel * car.accelMul * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= DRIVE.brake * dt;
    else car.speed -= DRIVE.reverseAccel * dt * -throttle;
  }
  car.speed = clamp(car.speed, -DRIVE.maxReverse, top);
  if (throttle === 0) car.speed *= Math.max(0, 1 - DRIVE.drag * dt);
  if (Math.abs(car.speed) > 5) {
    const steerAmount = steer * DRIVE.steer * clamp(Math.abs(car.speed) / 220, 0.25, 1);
    car.angle += steerAmount * dt * Math.sign(car.speed) * (handbrake ? 1.7 : 1);
  }
  const grip = handbrake ? DRIVE.driftGrip : DRIVE.grip;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // The edge of town stops every car: bounce off the world bounds.
  if (car.x < 60 || car.x > 3340 || car.y < 60 || car.y > 2540) {
    car.x = clamp(car.x, 60, 3340);
    car.y = clamp(car.y, 60, 2540);
    car.speed *= -0.3;
  }
  car.drift = handbrake && Math.abs(car.speed) > 150;
  return grip;
}
export function damageCar(car, amount, state) {
  car.health = Math.max(0, car.health - amount);
  if (car.health < 50) car.smoke = 1;
  if (car.health <= 0 && state) state.message = 'Car wrecked!';
}
// Traffic: follow the road ahead, stop at red lights, slow for the car ahead.
export function updateTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    const aheadX = car.x + Math.cos(car.angle) * 90;
    const aheadY = car.y + Math.sin(car.angle) * 90;
    let want = 190;
    if (!onRoad(aheadX, aheadY)) {
      // Drifted off the road: steer back toward the nearest road point.
      const near = nearestRoadPoint(car.x, car.y);
      car.routeAngle = Math.atan2(near.y - car.y, near.x - car.x);
      want = 140;
    } else {
      // At an intersection the car keeps its lane direction; snap angle to axis.
      const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
      car.routeAngle = vertical ? (Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.cos(car.angle) > 0 ? 0 : Math.PI);
    }
    if (state.lightRed && atIntersection(car)) want = 0;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x; const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && Math.abs(angleDiff(car.angle, Math.atan2(dy, dx))) < 0.9) { want = 0; break; }
    }
    const dd = Math.hypot(p.x - car.x, p.y - car.y);
    if (p.car !== car && dd < 60 && !p.inCar) want = 0; // don't run Manny over at a standstill
    car.angle = wrapAngle(car.angle + clamp(angleDiff(car.angle, car.routeAngle), -1.6 * dt, 1.6 * dt));
    car.speed += clamp(want - car.speed, -500 * dt, 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 80, 3320); car.y = clamp(car.y, 80, 2520);
  }
}
function atIntersection(car) {
  for (const rx of ROADS_X) for (const ry of ROADS_Y) {
    if (Math.abs(car.x - rx) < 70 && Math.abs(car.y - ry) < 70) return true;
  }
  return false;
}
export function nearestCar(state, x, y, maxDist) {
  let best = null; let bd = maxDist;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
