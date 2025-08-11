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
  const vol = Math.max(0, Math.min(1, opts.volume ?? 0.18));

  const el = document.createElement("audio");
  el.src = asset(opts.src);
  el.preload = "auto";
  el.loop = true;
  el.crossOrigin = "anonymous";
  el.setAttribute("playsinline", "true");
  el.style.display = "none";
  document.body.appendChild(el);

  let muted = !!opts.store?.getBool(key, false);
  apply();

  // start once after the first gesture, if not muted
  const unlock = async () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
    if (!muted) await safePlay();
  };
  document.addEventListener("pointerdown", unlock, { once: true, passive: true });
  document.addEventListener("keydown", unlock, { once: true });

  // pause on hidden, resume on visible if not muted
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") el.pause();
    else if (!muted) void safePlay();
  });

  async function safePlay() {
    try {
      el.volume = vol;
      if (el.paused) await el.play();
    } catch {
      // still blocked until a gesture, ok
    }
  }

  function setMuted(m: boolean) {
    muted = !!m;
    opts.store?.setBool?.(key, muted);
    apply();
  }

  function apply() {
    if (muted) {
      el.pause();
    } else {
      el.volume = vol;
      void safePlay();
    }
  }

  function toggle() { setMuted(!muted); }

  function attachToggleInto(target: Element) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = muted ? "Unmute music" : "Mute music";
    btn.setAttribute("aria-label", btn.title);
    // Y2K pink pill to match your nav
    btn.style.cssText = [
      "all:unset",
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "cursor:pointer",
      "width:34px;height:28px",
      "padding:0 6px",
      "border-radius:9px",
      "background:linear-gradient(180deg,#ff93d0 0%,#ff58ba 100%)",
      "border:1.5px solid rgba(255,255,255,0.75)",
      "box-shadow:0 2px 0 rgba(0,0,0,0.15), inset 0 0 8px rgba(255,255,255,0.25)",
      "color:#fff",
    ].join(";");

    const svgFor = (mutedNow: boolean) => `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="display:block">
        ${mutedNow
          ? `<path fill="currentColor" d="M3 10v4h3l4 4V6L6 10H3zm12.59 2 3.7 3.7-1.41 1.41L14.17 13l-3.7 3.7-1.41-1.41L12.75 12 9.06 8.31l1.41-1.41 3.7 3.7 3.71-3.7 1.41 1.41L15.41 12z"/>`
          : `<path fill="currentColor" d="M3 10v4h3l4 4V6L6 10H3zm10-4.5a6.5 6.5 0 0 1 0 13v-2a4.5 4.5 0 0 0 0-9v-2z"/>`}
      </svg>`;
    btn.innerHTML = svgFor(muted);

    btn.onpointerenter = () => { btn.style.filter = "brightness(1.05)"; };
    btn.onpointerleave = () => { btn.style.filter = ""; };

    btn.onclick = async () => {
      const willUnmute = muted; // current state
      toggle();
      // if we just unmuted, try to start immediately under this gesture
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
