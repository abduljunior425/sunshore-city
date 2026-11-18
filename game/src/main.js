// Sunshore City — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. Screens: title, play, paused, busted. ?seed=N fixes the city;
// ?shot=cover|onfoot|chase|mission stages that scene instead of the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, WORLD, DISTRICTS } from './config.js';
import { makeRng } from './utils.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer, tryEnterCar, tryPunchAction, tryBuy } from './player.js';
import { spawnParkedCars, spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { updatePolice } from './police.js';
import { updateBullets, updateEnemies, updatePickups } from './combat.js';
import { startMission, updateMission, nextMissionId } from './missions.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_MUTE, ACTION_BUY, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

function createState(seedValue) {
  const rng = makeRng(seedValue);
  const city = buildCity(rng);
  const state = {
    seed: seedValue, rng, city, cityDistricts: DISTRICTS,
    player: createPlayer(1650, 1050),
    cars: [], peds: [], cops: [], bullets: [], enemies: [], pickups: [],
    mission: null, missionsDone: [], ownedCars: [],
    clock: 8 * 60, elapsed: 0, lightTimer: 0, lightRed: false,
    message: '', messageTimer: 0, unseenTimer: 0,
    busted: false, bustedTimer: 0, bestCash: 0, camera: { x: 0, y: 0 },
  };
  spawnParkedCars(state, rng);
  spawnTraffic(state, rng, 14);
  spawnPedestrians(state, rng, 26);
  return state;
}

const game = {
  state: createState(seed),
  resetWorld() {
    this.state = createState(this.state.seed);
  },
  stepWorld(dt, input) {
    const state = this.state;
    const p = state.player;
    state.elapsed += dt;
    state.clock = (state.clock + dt * 0.5) % (24 * 60);
    state.lightTimer += dt;
    if (state.lightTimer > 6) { state.lightTimer = 0; state.lightRed = !state.lightRed; }
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.bustedTimer > 0) state.bustedTimer -= dt;
    if (state.bustGrace > 0) state.bustGrace -= dt;
    // Aim follows the mouse.
    const worldMouse = renderer.screenToWorld(input.mouse.x, input.mouse.y);
    p.aimAngle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
    updatePlayer(state, input, dt, audio);
    updateTraffic(state, dt);
    updatePedestrians(state, dt);
    updatePolice(state, dt, audio);
    updateBullets(state, dt, audio);
    updateEnemies(state, dt, audio);
    updatePickups(state, audio);
    updateMission(state, dt, audio);
    audio.music(dt);
    // World bounds: the sea and the edge of town stop everyone.
    p.x = Math.max(40, Math.min(WORLD.width - 40, p.x));
    p.y = Math.max(40, Math.min(WORLD.height - 40, p.y));
  },
};

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  const saved = loadGame();

  function announce(message) { status.textContent = message; }
  function startGame() {
    if (saved && !game.state.missionsDone.length && saved.missionsDone.length) {
      // Restore a previous visit: cash, jobs, position.
      const p = game.state.player;
      p.cash = saved.cash; p.ammo = saved.ammo; p.hp = saved.hp;
      p.x = saved.x; p.y = saved.y;
      game.state.missionsDone = saved.missionsDone || [];
      game.state.clock = saved.clock || 480;
      announce('Save loaded. Welcome back, Manny.');
    }
    game.state.message = 'Manny is out. Press N to take Luz\'s first job.';
    game.state.messageTimer = 6;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Sunshore City.');
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      game.state.message = muted ? 'Sound muted (M to unmute)' : 'Sound on';
      game.state.messageTimer = 2;
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; saveGame(game.state); announce('Paused. Progress saved.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) tryEnterCar(game.state, audio);
    if (actions & ACTION_PUNCH) tryPunchAction(game.state, audio);
    if (actions & ACTION_BUY) tryBuy(game.state, audio);
  }
  // N starts the next job; handled on keydown directly so it works mid-frame.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyN' && !event.repeat && screen === SCREEN_PLAY && !game.state.mission) {
      const next = nextMissionId(game.state);
      if (next) startMission(game.state, next, audio);
    }
    if (event.code === 'KeyN' && !event.repeat && screen === SCREEN_PLAY && game.state.mission) {
      game.state.message = 'Finish the current job first — or lose it by getting busted.';
      game.state.messageTimer = 3;
    }
  });
  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen shows the city alive behind the panel.
      const fake = { moveX: () => 0, moveY: () => 0, held: { shift: false }, mouse: { down: false, x: 0, y: 0 } };
      game.stepWorld(STEP, fake);
      return;
    }
    const fakeInput = input;
    game.stepWorld(STEP, fakeInput);
    if (game.state.busted && game.state.bustedTimer <= 0) {
      game.state.busted = false;
      screen = SCREEN_BUSTED;
      saveGame(game.state);
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game.state, screen);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(game.state);
      announce('Paused.');
    }
  });
  announce('Sunshore City. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
