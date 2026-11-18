// Sunshore City — all sound is synthesised with WebAudio: no audio files,
// no network. Engine hum, sirens, gunshots, pickups and a lazy sun-soaked
// bass loop. Audio starts only after the first user gesture (browser rule).
export function createAudio() {
  let ctx = null; let master = null; let muted = false;
  let musicTimer = 0; let musicStep = 0;
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 49];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = low || 900;
    const gain = ctx.createGain(); gain.gain.value = vol || 0.3;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t);
  }
  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    get muted() { return muted; },
    shoot() { noise(0.12, 0.5, 2400); tone(180, 0.09, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.35, 500); },
    pickup() { tone(660, 0.1, 'sine', 0.25); tone(990, 0.14, 'sine', 0.22); },
    cash() { tone(880, 0.08, 'sine', 0.25); tone(1174, 0.1, 'sine', 0.25); tone(1568, 0.16, 'sine', 0.22); },
    crash() { noise(0.3, 0.5, 400); tone(90, 0.25, 'sawtooth', 0.3, 40); },
    siren() { tone(720, 0.5, 'sine', 0.1, 980); },
    busted() { tone(440, 0.3, 'sawtooth', 0.25, 220); tone(330, 0.5, 'sawtooth', 0.25, 165); },
    mission() { tone(523, 0.12, 'sine', 0.25); tone(659, 0.12, 'sine', 0.25); tone(784, 0.22, 'sine', 0.25); },
    engine(speed01) {
      if (!ensure() || muted) return;
      tone(50 + speed01 * 90, 0.08, 'sawtooth', 0.05);
    },
    music(dt) {
      if (!ensure() || muted) return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer = 0.24;
      const f = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (f) tone(f, 0.22, 'triangle', 0.14);
      if (musicStep % 4 === 1) tone(220, 0.1, 'sine', 0.05);
    },
  };
}
