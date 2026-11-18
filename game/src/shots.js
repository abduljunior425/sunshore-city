// Sunshore City — staged screenshot scenes behind ?shot=cover|onfoot|chase|mission.
// Each scene sets the real game state (a car, a wanted level, a mission) and
// then plays the real rules forward with a scripted autopilot, so the frame
// is what a short game really looks like and the same seed gives the same frame.
import { STEP } from './config.js';
import { startMission } from './missions.js';
import { wantedFor, spawnPolice } from './police.js';
import { makeCar } from './vehicles.js';
import { tryEnterCar } from './player.js';
import { clamp, dist } from './utils.js';
import { SCREEN_PLAY } from './render.js';

// Drive straight down an avenue: full throttle, gentle steering to the road.
function driveAutopilot(state) {
  const idle = { moveX: () => 0, moveY: () => 0, held: { shift: false }, mouse: { down: false, x: 640, y: 360 } };
  const p = state.player;
  if (!p.inCar || !p.car) return idle;
  const car = p.car;
  const wantAngle = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle))
    ? (Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (Math.cos(car.angle) > 0 ? 0 : Math.PI);
  let steer = wantAngle - car.angle;
  while (steer > Math.PI) steer -= Math.PI * 2;
  while (steer < -Math.PI) steer += Math.PI * 2;
  return { moveX: () => Math.max(-1, Math.min(1, steer * 2)), moveY: () => -1, held: { shift: false }, mouse: { down: false, x: 640, y: 360 } };
}

export function stageShot(name, game) {
  game.resetWorld();
  const state = game.state; // captured AFTER the reset, or the scene lands on a discarded state
  const shots = {
    cover: () => {
      // Downtown, Manny driving a sports car through traffic. Start far
      // enough south that the short drive keeps him mid-frame, not at the
      // map edge.
      const car = makeCar('sports', 1650, 1850, -Math.PI / 2, 'player');
      car.color = '#e74c3c'; // Manny's car is always the red one in the frame
      state.cars.push(car);
      state.player.car = car; state.player.inCar = true;
      state.player.x = car.x; state.player.y = car.y;
      state.player.cash = 1240;
      startMission(state, 'm1', null);
      return 3.5;
    },
    onfoot: () => {
      // On foot in Old Town among pedestrians, mission marker ahead.
      state.player.x = 750; state.player.y = 1450;
      state.player.cash = 320;
      startMission(state, 'm2', null);
      state.mission.marker = { x: 750, y: 1250, label: 'Luz' };
      return 4;
    },
    chase: () => {
      // Police chase: 3 stars, two patrol cars closing in downtown.
      const car = makeCar('sports', 1650, 1850, -Math.PI / 2, 'player');
      car.color = '#e74c3c'; // Manny's car is always the red one in the frame
      state.cars.push(car);
      state.player.car = car; state.player.inCar = true;
      state.player.x = car.x; state.player.y = car.y;
      wantedFor(state, 3);
      spawnPolice(state, 2);
      state.player.cash = 860;
      return 4;
    },
    mission: () => {
      // M3 Dockside shootout in progress: gunmen, bullets, objective HUD.
      state.player.x = 2720; state.player.y = 2100;
      state.player.ammo = 48; state.player.cash = 940;
      startMission(state, 'm3', null);
      return 5;
    },
    m1test: () => {
      // Headless end-to-end playthrough of M1 "Wheels" — NOT a submitted
      // shot, a regression harness: walk to the marina sports car, steal
      // it, drive it to Luz Garage, and report whether the mission really
      // completes. Up to 2 attempts: a wrecked car must fail the job
      // cleanly and the retry must respawn a fresh drivable car, or the
      // mission soft-locks. Result lands in window.__m1result and #status.
      const errors = [];
      window.addEventListener('error', (e) => errors.push(String(e.message || e.error || e)));
      const log = [];
      const rec = (ev) => log.push(`${state.elapsed.toFixed(1)}s ${ev}`);
      const silent = { pickup() {}, cash() {}, mission() {}, crash() {}, shoot() {}, siren() {}, busted() {}, engine() {} };
      const idleMouse = { down: false, x: 640, y: 360 };
      const result = { ok: false, attempts: 0, errors, log, stageReached: 0, wantedMax: 0, carHealthEnd: null, cashEnd: null, busted: false, wrecked: false, missionFailed: false, retryRespawned: null, timedOut: false };
      const MAX_STEPS = 120 * 60;
      let steps = 0;
      let lastStage = 0; let lastWanted = 0;
      function runAttempt(n) {
        result.attempts = n;
        // Fresh attempt: Manny back at the spawn corner, heat cleared.
        if (state.player.inCar) { state.player.car.driver = 'parked'; state.player.car = null; state.player.inCar = false; }
        state.player.x = 1650; state.player.y = 1050; state.player.wanted = 0;
        state.cops.length = 0;
        state.cars = state.cars.filter((c) => c.driver !== 'police');
        startMission(state, 'm1', null);
        const mc0 = state.cars.find((c) => c.missionCar);
        rec(`attempt ${n}: missionCar=${mc0 ? `${mc0.x},${mc0.y} hp=${mc0.health}` : 'MISSING'} marker=${state.mission.marker.x},${state.mission.marker.y}`);
        if (n > 1) result.retryRespawned = !!mc0 && mc0.health > 0;
        // Phase 1 — on foot, running along the roads to the marina car.
        const walkWps = [{ x: 750, y: 1050 }, { x: 300, y: 1050 }, { x: 300, y: 650 }, { x: 366, y: 650 }];
        let wp = 0;
        while (steps < MAX_STEPS && !state.player.inCar) {
          const t = walkWps[wp];
          const dx = t.x - state.player.x; const dy = t.y - state.player.y;
          if (Math.hypot(dx, dy) < 24 && wp < walkWps.length - 1) { wp += 1; continue; }
          // Axis-dominant steps stay on the road centreline, clear of blocks.
          const moveX = Math.abs(dx) > 24 ? Math.sign(dx) : 0;
          const moveY = moveX === 0 ? Math.sign(dy) : 0;
          game.stepWorld(STEP, { moveX: () => moveX, moveY: () => moveY, held: { shift: true }, mouse: idleMouse });
          steps += 1;
          if (dist(state.player.x, state.player.y, 366, 650) < 60) {
            tryEnterCar(state, silent);
            rec(`enterCar: inCar=${state.player.inCar} wanted=${state.player.wanted} stage=${state.mission ? state.mission.stage : 'none'}`);
          }
          if (state.busted) { result.busted = true; rec('BUSTED on foot before stealing'); return 'busted'; }
        }
        // Phase 2 — drive the sports car to Luz Garage: full speed on the
        // straights, brake hard before the 90-degree turn at (2550, 650),
        // reverse out if stalled nose-first into a wall.
        const driveWps = [{ x: 1200, y: 650 }, { x: 2100, y: 650 }, { x: 2550, y: 650 }, { x: 2550, y: 1050 }];
        wp = 0;
        let reverseTimer = 0;
        while (steps < MAX_STEPS && !state.missionsDone.includes('m1')) {
          const p = state.player;
          if (!p.inCar || !p.car) { result.wrecked = true; if (!state.mission) result.missionFailed = true; rec('out of car mid-drive (wrecked or busted out)'); return 'wrecked'; }
          if (state.busted) { result.busted = true; rec('BUSTED during the drive'); return 'busted'; }
          if (!state.mission) { result.missionFailed = true; rec('mission ended without completing (failed, retry available)'); return 'failed'; }
          result.stageReached = Math.max(result.stageReached, state.mission.stage);
          if (p.wanted > lastWanted) { lastWanted = p.wanted; result.wantedMax = Math.max(result.wantedMax, p.wanted); rec(`wanted=${p.wanted} cops=${state.cops.length}`); }
          if (state.mission.stage !== lastStage) { lastStage = state.mission.stage; rec(`stage=${lastStage} marker=${state.mission.marker.x},${state.mission.marker.y}`); }
          const t = driveWps[wp];
          const d = dist(p.car.x, p.car.y, t.x, t.y);
          if (d < 70 && wp < driveWps.length - 1) { wp += 1; continue; }
          const wantAngle = Math.atan2(t.y - p.car.y, t.x - p.car.x);
          let steer = wantAngle - p.car.angle;
          while (steer > Math.PI) steer -= Math.PI * 2;
          while (steer < -Math.PI) steer += Math.PI * 2;
          // Stalled and pointing the wrong way: back straight out, then retry.
          if (reverseTimer <= 0 && Math.abs(p.car.speed) < 25 && Math.abs(steer) > 1.0) reverseTimer = 0.8;
          let input;
          if (reverseTimer > 0) {
            reverseTimer -= STEP;
            input = { moveX: () => 0, moveY: () => 1, held: { shift: false }, mouse: idleMouse };
          } else {
            const nearTurn = wp < driveWps.length - 1 && d < 400;
            const throttle = Math.abs(steer) > 0.9 ? 0 : (nearTurn && Math.abs(p.car.speed) > 240 ? 1 : -1);
            input = { moveX: () => clamp(steer * 2, -1, 1), moveY: () => throttle, held: { shift: false }, mouse: idleMouse };
          }
          game.stepWorld(STEP, input);
          steps += 1;
        }
        return state.missionsDone.includes('m1') ? 'completed' : 'timeout';
      }
      let outcome = runAttempt(1);
      if (outcome !== 'completed' && steps < MAX_STEPS) outcome = runAttempt(2);
      result.timedOut = steps >= MAX_STEPS && !state.missionsDone.includes('m1');
      result.ok = state.missionsDone.includes('m1');
      result.carHealthEnd = state.player.car ? Math.round(state.player.car.health) : null;
      result.cashEnd = state.player.cash;
      result.busted = result.busted || state.busted;
      const mcEnd = state.cars.find((c) => c.missionCar);
      rec(`end: ok=${result.ok} outcome=${outcome} steps=${steps} (${(steps / 60).toFixed(1)}s) cash=${result.cashEnd} wanted=${state.player.wanted} carHealth=${result.carHealthEnd} missionCarHealth=${mcEnd ? mcEnd.health : 'gone'} missionActive=${!!state.mission} pos=${Math.round(state.player.x)},${Math.round(state.player.y)}`);
      window.__m1result = result;
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = `M1TEST ${JSON.stringify(result)}`;
      return 0.5;
    },
  };
  const run = shots[name] || shots.cover;
  const seconds = run();
  // Play forward with the autopilot so traffic, peds and cops move into frame.
  for (let i = 0; i < seconds / STEP; i += 1) {
    const fake = driveAutopilot(state);
    game.stepWorld(STEP, fake);
  }
  state.message = name === 'chase' ? 'Lose the cops!' : state.message;
  state.messageTimer = 5;
  return { screen: SCREEN_PLAY };
}
