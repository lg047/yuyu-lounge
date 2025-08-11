// src/lib/bgm.ts
type Opts = {
  src: string;                // e.g. "assets/audio/bgm.mp3"
  store?: { getBool: (k: string, d: boolean)=>boolean; setBool: (k: string, v: boolean)=>void };
  key?: string;               // persistence key
  volume?: number;            // 0..1
};

export type BGM = {
  el: HTMLAudioElement;
  muted: boolean;
  playIfAllowed: () => Promise<void>;
  setMuted: (m: boolean) => void;
  toggle: () => void;
  attachToggleInto: (target: Element) => void; // replaces target with a mute button
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

  // read persisted mute
  let muted = !!opts.store?.getBool(key, false);
  apply();

  // try to start on first gesture
  const unlock = async () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
    if (!muted) await safePlay();
  };
  document.addEventListener("pointerdown", unlock, { once: true, passive: true });
  document.addEventListener("keydown", unlock, { once: true });

  // pause when tab hidden, resume when visible (if not muted)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") el.pause();
    else if (!muted) safePlay();
  });

  async function safePlay() {
    try {
      el.volume = vol;
      if (el.paused) await el.play();
    } catch {
      /* user gesture not granted yet */
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
      // do not await, just attempt
      void safePlay();
    }
  }

  function toggle() { setMuted(!muted); }

  // simple icon button injector
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
      "width:32px;height:32px",
      "border-radius:8px",
      "background:#0a1330",
      "border:2px solid #7ac6ff",
    ].join(";");
    // inline SVG to avoid extra assets
    const svg = () => `
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" style="display:block">
        ${muted
          ? `<path fill="currentColor" d="M3 10v4h3l4 4v-16l-4 4H3zm12.59 2 3.7 3.7-1.41 1.41L14.17 13l-3.7 3.7-1.41-1.41L12.75 12 9.06 8.31l1.41-1.41 3.7 3.7 3.71-3.7 1.41 1.41L15.41 12z"/>`
          : `<path fill="currentColor" d="M3 10v4h3l4 4V6L6 10H3zm11.5-4.5a6.5 6.5 0 0 1 0 13v-2a4.5 4.5 0 0 0 0-9v-2z"/>`}
      </svg>`;
    btn.style.color = "#aeeaff";
    btn.innerHTML = svg();

    btn.onclick = () => {
      toggle();
      btn.title = muted ? "Unmute music" : "Mute music";
      btn.setAttribute("aria-label", btn.title);
      btn.innerHTML = svg();
    };

    target.replaceWith(btn);
  }

  // helper to resolve BASE_URL
  function asset(p: string) {
    const base = (import.meta as any).env.BASE_URL as string;
    return (base.endsWith("/") ? base : base + "/") + p.replace(/^\//, "");
  }

  return { el, get muted(){ return muted; }, playIfAllowed: safePlay, setMuted, toggle, attachToggleInto };
}
