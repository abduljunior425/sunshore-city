// Sunshore City — police. Patrol cars cruise the avenues; when Manny's
// wanted level rises they chase, ram and try to box him in. On foot and
// cornered, they arrest him: busted, fined, respawned at the precinct.
// Break line of sight and stay hidden and the heat cools off.
import { makeCar, driveCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';
import { WANTED } from './config.js';
import { clamp, angleDiff, dist } from './utils.js';

export function wantedFor(state, level) {
  const p = state.player;
  p.wanted = clamp(p.wanted + level, 0, WANTED.max);
  if (p.wanted > 0) state.unseenTimer = 0;
}
export function spawnPolice(state, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const x = clamp(state.player.x + Math.cos(a) * 700, 120, 3280);
    const y = clamp(state.player.y + Math.sin(a) * 700, 120, 2480);
    const near = nearestRoadPoint(x, y);
    const cop = makeCar('police', near.x, near.y, 0, 'police');
    cop.speed = 200;
    state.cops.push(cop);
    state.cars.push(cop);
  }
}
export function desiredCops(wanted) {
  return wanted <= 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
}
export function updatePolice(state, dt, audio) {
  const p = state.player;
  const want = desiredCops(p.wanted);
  if (state.cops.length < want && p.wanted > 0) spawnPolice(state, want - state.cops.length);
  if (p.wanted === 0) {
    // Stand down: patrol cars drift off and despawn.
    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      const cop = state.cops[i];
      if (dist(cop.x, cop.y, p.x, p.y) > 900) {
        state.cops.splice(i, 1);
        const ci = state.cars.indexOf(cop);
        if (ci >= 0) state.cars.splice(ci, 1);
      }
    }
  }
  let anySeen = false;
  for (const cop of state.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < 620) anySeen = true;
    const target = p.inCar ? p.car : p;
    const tx = target.x; const ty = target.y;
    const wantAngle = Math.atan2(ty - cop.y, tx - cop.x);
    const steer = clamp(angleDiff(cop.angle, wantAngle) * 1.4, -1, 1);
    // Ram: full throttle when lined up, brake a touch when about to overshoot.
    const throttle = d > 90 ? 1 : 0.4;
    driveCar(cop, throttle, steer, dt, false);
    cop.speed = clamp(cop.speed, -60, 420 + p.wanted * 28);
    if (d < 46) {
      // Contact: gentle ram damage to Manny's car, or an arrest on foot
      // (only when the patrol car has actually stopped beside him).
      if (p.inCar && p.car) {
        p.car.health -= 9 * dt;
        if (Math.random() < dt * 2) audio.crash();
        if (p.car.health <= 0) { p.car.health = 0; }
      } else if (d < 30 && cop.speed < 120 && (!state.bustGrace || state.bustGrace <= 0)) {
        bustPlayer(state, audio);
        return;
      }
    }
    cop.x = clamp(cop.x, 80, 3320); cop.y = clamp(cop.y, 80, 2480);
  }
  // Escape clock: unseen long enough and the heat fades one star at a time.
  if (p.wanted > 0) {
    if (anySeen) state.unseenTimer = 0;
    else state.unseenTimer += dt;
    const need = p.wanted >= 3 ? WANTED.escapeSecondsHigh : WANTED.escapeSeconds;
    if (state.unseenTimer > need) {
      p.wanted -= 1; state.unseenTimer = 0;
      state.message = p.wanted === 0 ? 'You lost them.' : 'Heat cooling off...';
    }
  }
  if (p.wanted > 0 && Math.random() < dt * 0.25) audio.siren();
}
export function bustPlayer(state, audio) {
  const p = state.player;
  const fine = Math.min(p.cash, WANTED.bustFine);
  p.cash -= fine;
  p.wanted = 0; p.hp = p.hp < 40 ? 60 : p.hp;
  state.cops.length = 0;
  state.cars = state.cars.filter((c) => c.driver !== 'police');
  if (p.car) { p.car.driver = 'parked'; p.car = null; p.inCar = false; }
  // Respawn outside the precinct, downtown.
  p.x = 1200; p.y = 1050; p.angle = 0;
  state.busted = true; state.bustedTimer = 2.2;
  state.message = `BUSTED! Fine $${fine}. Luz bailed you out.`;
  audio.busted();
}
