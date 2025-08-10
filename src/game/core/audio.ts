export type AudioCore = {
  ctx: AudioContext | null;
  enabled: boolean;
  unlock: () => void;
  beep: (freq?: number, ms?: number) => void;
  setEnabled: (on: boolean) => void;
};

export function makeAudio(): AudioCore {
  let ctx: AudioContext | null = null;
  let enabled = false;

  function unlock() {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) ctx = new AC();
    }
  }

  function setEnabled(on: boolean) {
    enabled = on;
    if (enabled) unlock();
  }

  function beep(freq = 880, ms = 80) {
    if (!enabled || !ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  }

  return { ctx, enabled, unlock, beep, setEnabled };
}
