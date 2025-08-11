export type AudioCore = {
  ctx: AudioContext | null;
  enabled: boolean;
  unlock: () => void;
  beep: (freq?: number, ms?: number) => void;
  setEnabled: (on: boolean) => void;
};

export function makeAudio(): AudioCore {
  let ctx: AudioContext | null = null;
  let enabledFlag = false;

  function ensureCtx() {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  function unlock() {
    const c = ensureCtx();
    try { if (c && c.state === "suspended") c.resume(); } catch {}
  }

  function setEnabled(on: boolean) {
    enabledFlag = !!on;
    if (enabledFlag) unlock();
  }

  function beep(freq = 880, ms = 80) {
    if (!enabledFlag) return;
    const c = ensureCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g).connect(c.destination);
    const t = c.currentTime;
    try {
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    } catch {
      g.gain.value = 0.1;
      setTimeout(() => { g.gain.value = 0.0001; }, ms);
    }
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  }

  // return live getters so external reads see updated values
  const api: Partial<AudioCore> = { unlock, beep, setEnabled };
  Object.defineProperty(api, "enabled", { get: () => enabledFlag });
  Object.defineProperty(api, "ctx", { get: () => ctx });
  return api as AudioCore;
}
