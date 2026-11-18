// Sunshore City — combat. Bullets, enemy gunmen, punches and pickups.
// Bullets are simple tracers with a short life; gunmen stand their ground
// and fire back, so a shootout is about cover, range and ammo, not reflexes.
import { scarePeds } from './pedestrians.js';
import { wantedFor } from './police.js';
import { dist, clamp } from './utils.js';

export function fireBullet(state, x, y, angle, from, damage) {
  state.bullets.push({
    x, y, angle, speed: 780, life: 0.9, from, damage,
  });
}
export function spawnEnemy(state, x, y, hp) {
  state.enemies.push({ x, y, angle: 0, hp: hp || 60, cooldown: 1 + Math.random(), alive: true });
}
export function spawnPickup(state, kind, x, y) {
  state.pickups.push({ kind, x, y, bob: Math.random() * 6 });
}
export function updateBullets(state, dt, audio) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && b.from === 'player') {
      for (const e of state.enemies) {
        if (e.alive && dist(b.x, b.y, e.x, e.y) < 18) {
          e.hp -= b.damage; dead = true;
          if (e.hp <= 0) {
            e.alive = false;
            p.cash += 25;
            state.message = 'Gunman down. +$25';
            spawnPickup(state, Math.random() < 0.5 ? 'ammo' : 'health', e.x, e.y);
          }
          break;
        }
      }
      if (!dead) for (const cop of state.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 26) { cop.health -= b.damage; dead = true; break; }
      }
    }
    if (!dead && b.from === 'enemy') {
      const t = p.inCar ? p.car : p;
      if (t && dist(b.x, b.y, t.x, t.y) < (p.inCar ? 26 : 14)) {
        hurtPlayer(state, b.damage, audio);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
  state.enemies = state.enemies.filter((e) => e.alive);
}
export function updateEnemies(state, dt, audio) {
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.cooldown -= dt;
    if (d < 420 && e.cooldown <= 0) {
      e.cooldown = 1.1 + Math.random() * 0.7;
      fireBullet(state, e.x + Math.cos(e.angle) * 18, e.y + Math.sin(e.angle) * 18, e.angle, 'enemy', 9);
      audio.shoot();
      scarePeds(state, e.x, e.y, 260);
    }
  }
}
export function hurtPlayer(state, amount, audio) {
  const p = state.player;
  if (p.inCar && p.car) { p.car.health = Math.max(0, p.car.health - amount); return; }
  p.hp = clamp(p.hp - amount, 0, 100);
  if (p.hp <= 0) {
    p.hp = 50; p.cash = Math.max(0, p.cash - 150);
    p.wanted = 0; p.x = 750; p.y = 1450; // dumped at the safehouse clinic
    state.cops.length = 0;
    state.cars = state.cars.filter((c) => c.driver !== 'police');
    state.message = 'Wasted! Luz patched you up. -$150';
    audio.busted();
  }
}
export function tryPunch(state, audio) {
  const p = state.player;
  if (p.punchTimer > 0 || p.inCar) return;
  p.punchTimer = 0.38;
  audio.punch();
  const px = p.x + Math.cos(p.angle) * 30;
  const py = p.y + Math.sin(p.angle) * 30;
  for (const e of state.enemies) {
    if (e.alive && dist(px, py, e.x, e.y) < 30) {
      e.hp -= 12;
      if (e.hp <= 0) { e.alive = false; p.cash += 25; }
    }
  }
  for (const ped of state.peds) {
    if (dist(px, py, ped.x, ped.y) < 26) {
      scarePeds(state, p.x, p.y, 200);
      wantedFor(state, 1);
      state.message = 'You punched a pedestrian! The cops noticed.';
      break;
    }
  }
}
export function updatePickups(state, audio) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    pk.bob += 0.1;
    if (dist(pk.x, pk.y, p.x, p.y) < 30 && !p.inCar) {
      if (pk.kind === 'ammo') { p.ammo = Math.min(120, p.ammo + 24); state.message = 'Picked up ammo +24'; }
      else if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); state.message = 'Health +40'; }
      else if (pk.kind === 'cash') { p.cash += 50; state.message = 'Found $50'; }
      audio.pickup();
      state.pickups.splice(i, 1);
    }
  }
}
