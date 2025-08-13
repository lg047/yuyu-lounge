// src/views/tv.ts
/* TV page: layered PNGs with a video positioned to the transparent screen hole. */

type Size = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

/** EDIT these to match your PNGs */
const BASE: Size = { w: 1536, h: 1024 };
const TV: Rect  = { x: 560, y: 380, w: 417, h: 291 };
const BASE_URL = (import.meta as any).env.BASE_URL || "/";

export default function mountTV(root: HTMLElement): void {
  const setNavH = () => {
    const nav = document.querySelector<HTMLElement>(".topnav");
    if (nav) {
      const h = Math.ceil(nav.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--topnav-h", `${h}px`);
    }
  };
  setNavH();
  window.addEventListener("resize", setNavH);

  root.classList.add("tv");

  const scene = document.createElement("div");
  scene.className = "scene";

  const wrap = document.createElement("div");
  wrap.className = "tv-wrap";

  const vid = document.createElement("video");
  vid.id = "tv";
  vid.src = BASE_URL + "videos/test2.mp4";
  vid.autoplay = true;
  vid.preload = "auto";
  vid.playsInline = true;
  vid.setAttribute("webkit-playsinline", "true");
  vid.load();

  // Allow inline audio after first user gesture
  const onFirstGesture = () => {
    vid.muted = false;
    vid.play().catch(() => {});
    scene.removeEventListener("pointerdown", onFirstGesture, true);
    scene.removeEventListener("click", onFirstGesture, true);
    window.removeEventListener("keydown", onFirstGesture, true);
  };
  scene.addEventListener("pointerdown", onFirstGesture, true);
  scene.addEventListener("click", onFirstGesture, true);
  window.addEventListener("keydown", onFirstGesture, true);

  // Suppress or resume BGM during video activity
  (function suppressBgmWhileVideoActive(video: HTMLVideoElement) {
    const w = window as any;
    const bgm = w.__bgm?.el as HTMLAudioElement | undefined;
    function suppress(on: boolean) { w.__suppressBGMResume = on; }
    function pauseBgm() { try { bgm?.pause?.(); } catch {} }
    function maybeUnsuppress() {
      const inFs = !!document.fullscreenElement;
      const onTv = (location.hash.replace(/^#/, "") || "/reels") === "/tv";
      if (!inFs && video.paused && onTv) suppress(false);
    }
    video.addEventListener("play", () => { suppress(true); pauseBgm(); }, true);
    video.addEventListener("playing", () => { suppress(true); pauseBgm(); }, true);
    ["pause", "ended", "emptied"].forEach(evt => {
      video.addEventListener(evt, () => { maybeUnsuppress(); }, true);
    });
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        suppress(true);
        pauseBgm();
        // NEW: ensure clicks go to the fullscreen video
        vid.style.pointerEvents = "auto";
      } else {
        setTimeout(() => { maybeUnsuppress(); }, 0);
        // NEW: restore pointer behavior after exiting
        vid.style.pointerEvents = "";
      }
    });
    // iOS Safari inline fullscreen
    // @ts-ignore
    video.addEventListener("webkitbeginfullscreen", () => { suppress(true); pauseBgm(); }, true);
    // @ts-ignore
    video.addEventListener("webkitendfullscreen", () => { setTimeout(() => { maybeUnsuppress(); }, 0); }, true);
    // Leaving TV page
    window.addEventListener("hashchange", () => {
      const path = (location.hash || "#/reels").replace(/^#/, "");
      if (path !== "/tv") {
        suppress(false);
        try { video.pause(); } catch {}
        setTimeout(() => {
          if (!(window as any).__suppressBGMResume) {
            try { (w.__bgm?.playIfAllowed as any)?.(); } catch {}
          }
        }, 0);
      }
    });
  })(vid);

  const vhs = new Image();
  vhs.className = "vhs";
  vhs.src = BASE_URL + "assets/room/vhs-filter2.png";
  vhs.alt = "";

  const room = new Image();
  room.className = "room";
  room.src = BASE_URL + "assets/room/living-room3.png";
  room.alt = "Living room";

  const hit = document.createElement("button");
  hit.className = "hit";
  hit.type = "button";
  hit.ariaLabel = "Open fullscreen";

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Tap to open";

  // Layer order bottom→top: wrap(video), vhs, room, hit, hint
  wrap.appendChild(vid);
  scene.append(wrap, vhs, room, hit, hint);
  root.innerHTML = "";
  root.appendChild(scene);

  // Layout
  const place = () => {
    const box = scene.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const scale = Math.max(box.width / BASE.w, box.height / BASE.h);
    const imgW = BASE.w * scale;
    const imgH = BASE.h * scale;
    const offsetX = Math.round((box.width  - imgW) / 2);
    const offsetY = Math.round((box.height - imgH) / 2);
    const left   = Math.round(offsetX + TV.x * scale);
    const top    = Math.round(offsetY + TV.y * scale);
    const width  = Math.round(TV.w * scale);
    const height = Math.round(TV.h * scale);
    Object.assign(wrap.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    Object.assign(hit.style,  { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    hint.style.left = `${Math.round(left + width / 2 - 40)}px`;
    hint.style.top  = `${Math.round(top + height + 8)}px`;
  };

  // Decode and initial layout
  const ready = async () => {
    try {
      // @ts-expect-error
      if (typeof room.decode === "function") await room.decode();
      else if (!room.complete) await new Promise((r) => room.addEventListener("load", () => r(null), { once: true }));
    } catch {}
    if ((room.naturalWidth && room.naturalWidth !== BASE.w) || (room.naturalHeight && room.naturalHeight !== BASE.h)) {
      console.warn("living-room3.png natural size differs from BASE", {
        natural: { w: room.naturalWidth, h: room.naturalHeight },
        BASE,
      });
    }
    place();
    vid.play().catch(() => {});
  };
  ready();

  const ro = new ResizeObserver(place);
  ro.observe(scene);
  window.addEventListener("resize", place);
  window.addEventListener("orientationchange", place);

  // Fullscreen control
  let hinted = false;
  const hideHint = () => {
    if (!hinted) {
      hinted = true;
      hint.classList.add("hide");
      setTimeout(() => hint.remove(), 400);
    }
  };

  const enterFullscreen = () => {
    // stop bgm before any fullscreen or play
    const w = window as any;
    w.__suppressBGMResume = true;
    try { (w.__bgm?.el as HTMLAudioElement | undefined)?.pause?.(); } catch {}

    hideHint();
    vid.muted = false;
    vid.controls = true;

    // NEW: disable the overlay while in fullscreen so it cannot intercept clicks
    hit.dataset.prevDisplay = hit.style.display || "";
    hit.style.display = "none";
    hit.style.pointerEvents = "none";
    vid.style.pointerEvents = "auto";

    const anyVid = vid as any;
    if (typeof anyVid.webkitEnterFullscreen === "function") {
      vid.play().catch(() => {});
      try { anyVid.webkitEnterFullscreen(); } catch {}
      return;
    }
    if (vid.requestFullscreen) {
      vid.play().catch(() => {});
      vid.requestFullscreen().catch(() => {});
      return;
    }
    if ((scene as any).requestFullscreen) {
      vid.play().catch(() => {});
      (scene as any).requestFullscreen().catch(() => {});
      return;
    }
    vid.play().catch(() => {});
  };

  const exitInline = () => {
    vid.controls = false;
    // restore overlay so users can tap to enter fullscreen again
    hit.style.display = hit.dataset.prevDisplay ?? "";
    hit.style.pointerEvents = "";
    vid.style.pointerEvents = "";
    vid.play().catch(() => {});
  };

  hit.addEventListener("click", enterFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const full = Boolean(document.fullscreenElement);
    if (!full) exitInline();
  });
  vid.addEventListener("webkitendfullscreen" as any, exitInline);
}
