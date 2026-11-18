// Sunshore City — shared tuning constants. One place for every number the
// rest of the game balances against, so a tweak here retunes the whole city.
export const WORLD = { width: 3400, height: 2600 };
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };
export const SAVE_KEY = 'sunshore-city-save-v1';
export const PLAYER = {
  walkSpeed: 170, runSpeed: 265, radius: 13, maxHp: 100,
  punchDamage: 12, punchRange: 36, punchCooldown: 0.38,
  pistolDamage: 34, pistolCooldown: 0.22, startAmmo: 24, maxAmmo: 120,
};
export const DRIVE = {
  accel: 430, brake: 640, reverseAccel: 270, maxSpeed: 540,
  maxReverse: 180, steer: 2.7, grip: 3.4, driftGrip: 1.5, drag: 0.5,
};
export const WANTED = {
  steal: 1, assault: 1, kill: 2, max: 5,
  escapeSeconds: 9, escapeSecondsHigh: 16, bustFine: 250,
};
export const ECONOMY = {
  startCash: 120, ammoPrice: 40, ammoAmount: 24, healthPrice: 60,
  carPrices: { sedan: 400, taxi: 450, van: 650, sports: 1400, truck: 900 },
};
export const MISSION_REWARDS = { m1: 300, m2: 450, m3: 600, m4: 500, m5: 1500 };
export const DISTRICTS = [
  { name: 'Downtown', x: 900, y: 200, w: 1500, h: 900, ground: '#d9b380', accent: '#8f7fb8' },
  { name: 'Marina', x: 0, y: 200, w: 900, h: 1100, ground: '#c9d8a8', accent: '#4f9db8' },
  { name: 'Old Town', x: 0, y: 1300, w: 1300, h: 1100, ground: '#cbb28a', accent: '#b8703f' },
  { name: 'Hills', x: 1300, y: 1300, w: 1100, h: 1100, ground: '#a8c98f', accent: '#5f8f4f' },
  { name: 'Docks', x: 2400, y: 1300, w: 1000, h: 1100, ground: '#9aa0a8', accent: '#c86f2f' },
];
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const PALETTE = {
  backdrop: '#101820', sky: '#f7c873', road: '#3d4450', roadLine: '#e8d27a',
  sidewalk: '#b9a98c', text: '#fff7e6', muted: '#ffe9b8', panel: '#1d2733',
  player: '#ff5a3c', police: '#2f6fd0', star: '#ffd94a', hp: '#58d68d',
};
