// Sunshore City — save / load through localStorage. Progress is cash,
// missions finished, cars owned and where Manny stands; nothing else needs
// to survive a visit. A broken save is ignored, never fatal.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.player.cash, ammo: state.player.ammo, hp: state.player.hp,
      x: state.player.x, y: state.player.y,
      missionsDone: state.missionsDone, ownedCars: state.ownedCars,
      missionId: state.mission ? state.mission.id : null,
      clock: state.clock, bestCash: state.bestCash,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch { return null; }
}
export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
