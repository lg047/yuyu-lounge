// src/views/tv.ts
/* TV page: layered PNGs with a video positioned to the transparent screen hole. */

type Size = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

/** EDIT these to match your PNGs */
const BASE: Size = { w: 1536, h: 1024 }; // natural pixels of living-room.png
const TV: Rect  = { x: 560,  y: 304,  w: 417,  h: 291  }; // top-left and size of hole in BASE pixels

export default function mountTV(root: HTMLElement): void {
  root.classList.add("tv");

  // DOM
  const scene = document.createElement("div");
  scene.className = "scene";

  const vid = document.createElement("video");
  vid.id = "tv";
  vid.src = "/videos/test.mp4";
  vid.muted = true;
  vid.preload = "metadata";
  vid.playsInline = true; // iOS inline
  vid.setAttribute("webkit-playsinline", "true");

  const vhs = new Image();
  vhs.className = "vhs";
  vhs.src = "/assets/room/vhs-filter.png";
  vhs.alt = "";

  const room = new Image();
  room.className = "room";
  room.src = "/assets/room/living-room.png";
  room.alt = "Living room";

  const hit = document.createElement("button");
  hit.className = "hit";
  hit.type = "button";
  hit.ariaLabel = "Open fullscreen";

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Tap to open";

  // Layer order by z-index (bottom to top): video, vhs, room, hit, hint
  scene.append(vid, vhs, room, hit, hint);
  root.innerHTML = "";
  root.appendChild(scene);

  // Layout
  const place = () => {
    // Size of displayed room image
    const rect = room.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = rect.width / BASE.w;
    const scaleY = rect.height / BASE.h;

    const left   = Math.round(TV.x * scaleX);
    const top    = Math.round(TV.y * scaleY);
    const width  = Math.round(TV.w * scaleX);
    const height = Math.round(TV.h * scaleY);

    // Position within .scene
    Object.assign(vid.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    Object.assign(hit.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    // Hint sits just below the screen window
    hint.style.left = `${Math.round(left + width / 2 - 40)}px`;
    hint.style.top  = `${Math.round(top + height + 8)}px`;
  };

  // Decode and initial layout
  const ready = async () => {
    try {
      // Prefer decode for exact sizing
      // Safari supports HTMLImageElement.decode in modern versions
      // Fallback to load
      // @ts-expect-error: decode may not exist
      if (typeof room.decode === "function") await room.decode();
      else if (!room.complete) await new Promise((r) => room.addEventListener("load", () => r(null), { once: true }));
    } catch {
      /* ignore */
    }
    if ((room.naturalWidth && room.naturalWidth !== BASE.w) || (room.naturalHeight && room.naturalHeight !== BASE.h)) {
      console.warn("living-room.png natural size differs from BASE", {
        natural: { w: room.naturalWidth, h: room.naturalHeight },
        BASE,
      });
    }
    place();
    // Autoplay muted inline for the idle look
    vid.play().catch(() => {});
  };
  ready();

  // Keep aligned on resize and orientation changes
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
      // Remove node later
      setTimeout(() => hint.remove(), 400);
    }
  };

  const enterFullscreen = () => {
    hideHint();
    vid.muted = false;
    vid.controls = true;

    // iOS path
    const anyVid = vid as any;
    if (typeof anyVid.webkitEnterFullscreen === "function") {
      vid.play().catch(() => {});
      try {
        anyVid.webkitEnterFullscreen();
      } catch {/* ignore */}
      return;
    }

    // Modern browsers
    if (vid.requestFullscreen) {
      vid.play().catch(() => {});
      vid.requestFullscreen().catch(() => {});
      return;
    }

    // Last fallback
    if (scene.requestFullscreen) {
      vid.play().catch(() => {});
      scene.requestFullscreen().catch(() => {});
      return;
    }

    // No fullscreen API, still unmute and show controls
    vid.play().catch(() => {});
  };

  const exitInline = () => {
    vid.controls = false;
    vid.muted = true;
    vid.play().catch(() => {});
  };

  hit.addEventListener("click", enterFullscreen);
  // Exit listeners
  document.addEventListener("fullscreenchange", () => {
    const full = Boolean(document.fullscreenElement);
    if (!full) exitInline();
  });
  // iOS exit
  vid.addEventListener("webkitendfullscreen" as any, exitInline);

  // Clean up if your router supports unmounting
  // (not strictly required, safe to leave running)
}
