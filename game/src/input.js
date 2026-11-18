// Sunshore City — keyboard and mouse. Held keys give movement and driving
// axes; one-shot presses (enter car, punch, pause, mute, buy) are queued as
// bit flags and taken once by the loop, so a press between frames is never
// lost or counted twice. Mouse aim is read in screen space and converted by
// the renderer in main.js.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_BUY = 32;
export const ACTION_SHOOT = 64;

const MOVE = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, shift: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    const dir = MOVE[event.code];
    if (dir) { held[dir] = true; event.preventDefault(); return; }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { held.shift = true; return; }
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyB') actions |= ACTION_BUY;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const dir = MOVE[event.code];
    if (dir) held[dir] = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.shift = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.shift = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  return {
    held, mouse,
    moveX() { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    moveY() { return (held.down ? 1 : 0) - (held.up ? 1 : 0); },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
