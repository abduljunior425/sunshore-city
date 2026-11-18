// Sunshore City — Manny Reyes on foot and behind the wheel. Walking, running,
// entering and stealing cars, driving with drift, shooting where the mouse
// points. The player object is the one thing every other system reads.
import { PLAYER, DRIVE, ECONOMY } from './config.js';
import { driveCar, nearestCar, damageCar } from './vehicles.js';
import { hitsBuilding, nearestShop, onWater } from './city.js';
import { fireBullet, tryPunch } from './combat.js';
import { wantedFor } from './police.js';
import { clamp, dist } from './utils.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER.maxHp, cash: ECONOMY.startCash,
    ammo: PLAYER.startAmmo, wanted: 0, inCar: false, car: null,
    punchTimer: 0, shootTimer: 0, aimAngle: 0, running: false,
  };
}
export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.inCar && p.car) { updateDriving(state, input, dt, audio); return; }
  // On foot: WASD, Shift to run. Face the movement, or the mouse when aiming.
  const mx = input.moveX(); const my = input.moveY();
  const mag = Math.hypot(mx, my);
  p.running = input.held.shift && mag > 0;
  const speed = p.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (mag > 0) {
    const nx = p.x + (mx / mag) * speed * dt;
    const ny = p.y + (my / mag) * speed * dt;
    if (!hitsBuilding(state.city.buildings, nx, p.y, PLAYER.radius) && !onWater(nx, p.y)) p.x = nx;
    if (!hitsBuilding(state.city.buildings, p.x, ny, PLAYER.radius) && !onWater(p.x, ny)) p.y = ny;
    p.angle = Math.atan2(my, mx);
  }
  p.x = clamp(p.x, 40, 3360); p.y = clamp(p.y, 40, 2560);
  // Mouse aim: the aim angle is set by main.js from screen space each frame.
  if (input.mouse.down && p.shootTimer <= 0 && p.ammo > 0) shoot(state, audio);
  if (input.mouse.down) p.angle = p.aimAngle;
}
function updateDriving(state, input, dt, audio) {
  const p = state.player; const car = p.car;
  const throttle = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -1 : 0;
  const steer = input.moveX();
  const handbrake = input.held.shift;
  const before = { x: car.x, y: car.y };
  driveCar(car, throttle, steer, dt, handbrake);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // Collisions with buildings: bounce back, take damage, make smoke.
  const hit = hitsBuilding(state.city.buildings, car.x, car.y, car.len / 2);
  if (hit || onWater(car.x, car.y)) {
    car.x = before.x; car.y = before.y;
    if (Math.abs(car.speed) > 120) {
      damageCar(car, 12, state);
      audio.crash();
      state.message = 'You hit a wall!';
    }
    car.speed *= -0.25;
  }
  // Bumping traffic cars: slow both, small damage, peds scatter.
  for (const other of state.cars) {
    if (other === car || other.driver === 'police') continue;
    if (dist(car.x, car.y, other.x, other.y) < 46 && Math.abs(car.speed) > 60) {
      damageCar(car, 6, state);
      other.speed = car.speed * 0.4;
      audio.crash();
    }
  }
  if (car.health <= 0) {
    state.message = 'Your car is wrecked — get out!';
    exitCar(state);
  }
  if (Math.abs(car.speed) > 200 && Math.random() < dt * 4) audio.engine(Math.abs(car.speed) / 600);
}
export function shoot(state, audio) {
  const p = state.player;
  if (p.ammo <= 0) { state.message = 'Out of ammo — buy more at Ammo Mart (B)'; return; }
  p.ammo -= 1; p.shootTimer = PLAYER.pistolCooldown;
  fireBullet(state, p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20, p.aimAngle, 'player', PLAYER.pistolDamage);
  audio.shoot();
  // Firing in the open draws the law.
  if (state.player.wanted < 1) wantedFor(state, 1);
}
export function tryEnterCar(state, audio) {
  const p = state.player;
  if (p.inCar) { exitCar(state); return; }
  const car = nearestCar(state, p.x, p.y, 70);
  if (!car) { state.message = 'No car nearby. Walk up to one and press E.'; return; }
  p.car = car; p.inCar = true; p.x = car.x; p.y = car.y;
  if (car.driver === 'parked') {
    car.driver = 'player';
    wantedFor(state, 1);
    state.message = `Stole a ${car.name}! The cops noticed.`;
    audio.pickup();
  } else if (car.driver === 'traffic') {
    car.driver = 'player';
    wantedFor(state, 1);
    state.message = `Carjacked a ${car.name}!`;
    audio.pickup();
  } else {
    car.driver = 'player';
  }
  if (state.mission) state.mission.onEnterCar?.(state, car);
}
export function exitCar(state) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = 'parked'; car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.car = null; p.inCar = false;
  state.bustGrace = 2; // a wrecked car does not mean an instant arrest
}
export function tryPunchAction(state, audio) { tryPunch(state, audio); }
export function tryBuy(state, audio) {
  const p = state.player;
  const shop = nearestShop(state.city.shops, p.x, p.y, 90);
  if (!shop) { state.message = 'No shop nearby. Look for the shop markers on the minimap.'; return; }
  if (shop.kind === 'ammo') {
    if (p.cash < ECONOMY.ammoPrice) { state.message = 'Not enough cash for ammo.'; return; }
    p.cash -= ECONOMY.ammoPrice; p.ammo = Math.min(120, p.ammo + ECONOMY.ammoAmount);
    state.message = `Bought ammo +${ECONOMY.ammoAmount} (-$${ECONOMY.ammoPrice})`;
    audio.cash();
  } else if (shop.kind === 'health') {
    if (p.cash < ECONOMY.healthPrice) { state.message = 'Not enough cash for a patch-up.'; return; }
    p.cash -= ECONOMY.healthPrice; p.hp = 100;
    state.message = `Patched up to full health (-$${ECONOMY.healthPrice})`;
    audio.cash();
  } else if (shop.kind === 'dealer') {
    const model = 'sports';
    const price = ECONOMY.carPrices[model];
    if (p.cash < price) { state.message = `A sports car costs $${price}. Earn mission cash first.`; return; }
    p.cash -= price; state.ownedCars.push(model);
    state.message = `Bought a sports car! It is parked outside the dealer.`;
    audio.cash();
  } else {
    state.message = `${shop.name} — nothing to buy here, but it is a good place to be.`;
  }
}
