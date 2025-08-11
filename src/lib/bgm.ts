// src/lib/bgm.ts
type Opts = {
  src: string;
  store?: { getBool: (k: string, d: boolean)=>boolean; setBool: (k: string, v: boolean)=>void };
  key?: string;
  volume?: number;
};

export type BGM = {
  el: HTMLAudioElement;
  muted: boolean;
  playIfAllowed: () => Promise<void>;
  setMuted: (m: boolean) => void;
  toggle: () => void;
  attachToggleInto: (target: Element) => void;
};

export function makeBGM(opts: Opts): BGM {
  const key = opts.key ?? "bgm.muted";
  const initKey = key + ".init";
  const vol = Math.max(0, Math.min(1, opts.volume ?? 0.18));

  const el = document.createElement("audio");
  el.src = asset(opts.src);
  el.preload = "auto";
  el.loop = true;
  el.crossOrigin = "anonymous";
  el.setAttribute("playsinline", "true");
  el.style.display = "none";
  document.body.appendChild(el);

  // first visit boot: force unmuted once
  const seen = !!opts.store?.getBool(initKey, false);
  if (!seen) {
    opts.store?.setBool?.(key, false);
    opts.store?.setBool?.(initKey, true);
  }
  let muted = !!opts.store?.getBool(key, false);
  apply();

  // start on first real gesture (capture so nothing can stopPropagation)
  const types = ["pointerdown","pointerup","click","touchstart","touchend","keydown"];
  const onFirstGesture = () => {
    if (!muted) void safePlay();
    cleanupFirstGesture();
  };
  function cleanupFirstGesture() {
    types.forEach(t => {
      document.removeEventListener(t, onFirstGesture, true);
      window.removeEventListener(t, onFirstGesture, true);
    });
  }
  types.forEach(t => {
    document.addEventListener(t, onFirstGesture, { once: true, capture: true, passive: true });
    window.addEventListener(t, onFirstGesture, { once: true, capture: true, passive: true });
  });

  // opportunistic attempt on visible tabs (desktop may allow)
  if (document.visibilityState === "visible" && !muted) void safePlay();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") el.pause();
    else if (!muted) void safePlay();
  });

  async function safePlay() {
    try {
      el.volume = vol;
      if (el.paused) await el.play();
    } catch { /* blocked until a gesture; handled by onFirstGesture */ }
  }

  function setMuted(m: boolean) {
    muted = !!m;
    opts.store?.setBool?.(key, muted);
    apply();
  }

  function apply() {
    if (muted) el.pause();
    else { el.volume = vol; void safePlay(); }
  }

  function toggle() { setMuted(!muted); }

  function attachToggleInto(target: Element) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = muted ? "Unmute music" : "Mute music";
    btn.setAttribute("aria-label", btn.title);
    btn.style.cssText = [
      "all:unset",
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "cursor:pointer",
      "width:36px;height:28px",
      "padding:0 6px",
      "border-radius:9px",
      "background:linear-gradient(180deg,#ff97d2 0%,#ff58ba 100%)",
      "border:1.5px solid rgba(255,255,255,0.85)",
      "box-shadow:0 2px 0 rgba(0,0,0,0.15), inset 0 0 8px rgba(255,255,255,0.25)",
      "color:#fff",
    ].join(";");

    const svgFor = (mutedNow: boolean) => `
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:block">
        <path fill="currentColor" d="M3 10v4h3l4 4V6L6 10H3z"/>
        ${
          mutedNow
            ? `<path d="M12.8 7.8L21 16M21 8l-8.2 8.2" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`
            : `<path fill="currentColor" d="M14 7.3a6.8 6.8 0 0 1 0 9.4v-2.1a4.7 4.7 0 0 0 0-5.2V7.3z"/>`
        }
      </svg>`;
    btn.innerHTML = svgFor(muted);

    btn.onpointerenter = () => { btn.style.filter = "brightness(1.05)"; };
    btn.onpointerleave = () => { btn.style.filter = ""; };

    btn.onclick = async () => {
      const willUnmute = muted;
      toggle();
      if (willUnmute) { await safePlay(); }
      btn.title = muted ? "Unmute music" : "Mute music";
      btn.setAttribute("aria-label", btn.title);
      btn.innerHTML = svgFor(muted);
    };

    target.replaceWith(btn);
  }

  function asset(p: string) {
    const base = (import.meta as any).env.BASE_URL as string;
    return (base.endsWith("/") ? base : base + "/") + p.replace(/^\//, "");
  }

  return {
    el,
    get muted(){ return muted; },
    playIfAllowed: safePlay,
    setMuted,
    toggle,
    attachToggleInto,
  };
}
