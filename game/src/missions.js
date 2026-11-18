// Sunshore City — the story. Five short jobs from Luz the fixer, each a
// small state machine: a marker on the map, an objective line on the HUD,
// a payout at the end. Finishing one unlocks the next; all five pay cash
// Manny can spend on cars, ammo and health.
import { MISSION_REWARDS } from './config.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { wantedFor } from './police.js';
import { makeCar } from './vehicles.js';
import { dist } from './utils.js';

export const MISSION_DEFS = [
  { id: 'm1', title: 'Wheels', brief: 'Steal the red sports car by the Marina and deliver it to Luz Garage.' },
  { id: 'm2', title: 'The Pickup', brief: 'Grab the package at the Docks and drive it to the Safehouse before the timer runs out.' },
  { id: 'm3', title: 'Dockside', brief: 'On foot at the Docks: clear the gunmen and grab the crate.' },
  { id: 'm4', title: 'Getaway', brief: 'The cops are on you. Lose 3 stars, then reach the Safehouse.' },
  { id: 'm5', title: 'The Big One', brief: 'Hit the Downtown bank vault, grab the cash, and escape a 4-star chase to the Safehouse.' },
];
function def(id) { return MISSION_DEFS.find((m) => m.id === id); }

export function startMission(state, id, audio) {
  const d = def(id);
  const m = { id, title: d.title, brief: d.brief, stage: 0, timer: 0, marker: null, done: false };
  if (id === 'm1') {
    m.marker = { x: 366, y: 650, label: 'Sports car' };
    // The marina car IS the job, so starting the job must guarantee a
    // drivable one: a previous attempt may have left it a wreck, and a
    // wrecked mission car can never be delivered. Replace it, don't reuse it.
    const old = state.cars.find((c) => c.missionCar);
    if (!old || old.health <= 0) {
      if (old) state.cars.splice(state.cars.indexOf(old), 1);
      const car = makeCar('sports', 366, 650, 0, 'parked');
      car.color = '#e74c3c'; car.missionCar = true;
      state.cars.push(car);
    }
  }
  if (id === 'm2') { m.marker = { x: 2900, y: 1850, label: 'Package' }; m.timer = 75; }
  if (id === 'm3') {
    m.marker = { x: 2900, y: 2150, label: 'Crate' };
    spawnEnemy(state, 2850, 2100, 60); spawnEnemy(state, 2950, 2200, 60); spawnEnemy(state, 2800, 2200, 80);
    spawnPickup(state, 'ammo', 2750, 2150);
  }
  if (id === 'm4') { wantedFor(state, 3); m.marker = { x: 750, y: 1450, label: 'Safehouse' }; }
  if (id === 'm5') {
    m.marker = { x: 1650, y: 650, label: 'Bank vault' };
    spawnEnemy(state, 1600, 600, 60); spawnEnemy(state, 1700, 700, 60);
    spawnPickup(state, 'ammo', 1550, 650);
  }
  state.mission = m;
  state.message = `New job — ${d.title}: ${d.brief}`;
  if (audio) audio.mission();
}
export function missionObjective(state) {
  const m = state.mission;
  if (!m) {
    const next = nextMissionId(state);
    return next ? `Next job: ${def(next).title} — press N to start` : 'All jobs done. Sunshore City is yours, Manny.';
  }
  if (m.id === 'm1') return m.stage === 0 ? 'Steal the red sports car (Marina)' : 'Deliver it to Luz Garage (Downtown)';
  if (m.id === 'm2') return m.stage === 0 ? 'Pick up the package at the Docks' : `Deliver the package — ${Math.ceil(m.timer)}s left`;
  if (m.id === 'm3') return state.enemies.length > 0 ? `Clear the gunmen (${state.enemies.length} left)` : 'Grab the crate';
  if (m.id === 'm4') return state.player.wanted > 0 ? `Lose the cops — ${state.player.wanted} stars` : 'Reach the Safehouse';
  if (m.id === 'm5') return m.stage === 0 ? 'Reach the bank vault (Downtown)' : m.stage === 1 ? `Grab the cash (${state.enemies.length} guards left)` : 'Escape to the Safehouse — 4 stars!';
  return m.brief;
}
export function nextMissionId(state) {
  for (const d of MISSION_DEFS) if (!state.missionsDone.includes(d.id)) return d.id;
  return null;
}
function completeMission(state, audio) {
  const m = state.mission;
  const reward = MISSION_REWARDS[m.id];
  state.player.cash += reward;
  state.missionsDone.push(m.id);
  state.bestCash = Math.max(state.bestCash || 0, state.player.cash);
  state.message = `Job done: ${m.title} — +$${reward}!`;
  state.mission = null;
  if (audio) audio.cash();
}
export function updateMission(state, dt, audio) {
  const m = state.mission;
  if (!m) return;
  const p = state.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      state.message = 'Too slow — the job fell through. Press N to try again.';
      state.mission = null;
      return;
    }
  }
  if (m.id === 'm1') {
    // A wrecked mission car can never be delivered: fail the job cleanly
    // so N can start it again (startMission respawns the car) instead of
    // leaving an uncompletable objective on the HUD forever.
    const mc = state.cars.find((c) => c.missionCar);
    if (mc && mc.health <= 0) {
      state.message = 'The sports car is wrecked — the job fell through. Press N to try again.';
      state.mission = null;
      return;
    }
    if (m.stage === 0 && p.inCar && p.car && p.car.missionCar) { m.stage = 1; m.marker = { x: 2550, y: 1050, label: 'Luz Garage' }; state.message = 'Got it! Now deliver it to Luz Garage.'; }
    else if (m.stage === 1 && p.inCar && dist(p.x, p.y, 2550, 1050) < 90) completeMission(state, audio);
  }
  if (m.id === 'm2') {
    if (m.stage === 0 && dist(p.x, p.y, 2900, 1850) < 70) {
      m.stage = 1; m.marker = { x: 750, y: 1450, label: 'Safehouse' }; m.timer = 75;
      state.message = 'Package grabbed! Drive it to the Safehouse — fast.';
      wantedFor(state, 1);
    } else if (m.stage === 1 && dist(p.x, p.y, 750, 1450) < 90) completeMission(state, audio);
  }
  if (m.id === 'm3') {
    if (state.enemies.length === 0 && dist(p.x, p.y, 2900, 2150) < 70) completeMission(state, audio);
  }
  if (m.id === 'm4') {
    if (p.wanted === 0 && dist(p.x, p.y, 750, 1450) < 90) completeMission(state, audio);
  }
  if (m.id === 'm5') {
    if (m.stage === 0 && dist(p.x, p.y, 1650, 650) < 80) {
      m.stage = 1; m.marker = { x: 1650, y: 650, label: 'Vault cash' };
      state.message = 'Inside! Grab the vault cash — the guards are coming.';
      wantedFor(state, 2);
    } else if (m.stage === 1 && state.enemies.length === 0 && dist(p.x, p.y, 1650, 650) < 80) {
      m.stage = 2; m.marker = { x: 750, y: 1450, label: 'Safehouse' };
      p.cash += 200; state.message = 'Vault cash grabbed! Now lose the heat and reach the Safehouse.';
      wantedFor(state, 2);
    } else if (m.stage === 2 && dist(p.x, p.y, 750, 1450) < 90) completeMission(state, audio);
  }
}
