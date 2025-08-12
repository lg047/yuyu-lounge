// src/views/tv.ts
/* TV page: layered PNGs with a video positioned to the transparent screen hole. */

type Size = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

/** EDIT these to match your PNGs */
const BASE: Size = { w: 1536, h: 1024 }; // natural pixels of living-room.png
const TV: Rect  = { x: 560, y: 304, w: 417, h: 291 }; // top-left and size of hole in BASE pixels
const BASE_URL = (import.meta as any).env.BASE_URL || "/";

export default function mountTV(root: HTMLElement): void {
  // Set nav height before first paint so we do not overlap the topnav
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

  // DOM
  const scene = document.createElement("div");
  scene.className = "scene";

  const vid = document.createElement("video");
  vid.id = "tv";
  vid.src = BASE_URL + "videos/test.mp4";
  vid.muted = true;
  vid.preload = "metadata";
  vid.playsInline = true;
  vid.setAttribute("webkit-playsinline", "true");

  const vhs = new Image();
  vhs.className = "vhs";
  vhs.src = BASE_URL + "assets/room/vhs-filter.png";
  vhs.alt = "";

  const room = new Image();
  room.className = "room";
  room.src = BASE_URL + "assets/room/living-room.png";
  room.alt = "Living room";

  const hit = document.createElement("button");
  hit.className = "hit";
  hit.type = "button";
  hit.ariaLabel = "Open fullscreen";

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Tap to open";

  // Layer order by z-index bottom to top: video, vhs, room, hit, hint
  scene.append(vid, vhs, room, hit, hint);
  root.innerHTML = "";
  root.appendChild(scene);

  // Layout
  const place = () => {
    const box = scene.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    // Cover scaling keeps aspect, fills box, may crop
    const scale = Math.max(box.width / BASE.w, box.height / BASE.h);
    const imgW = BASE.w * scale;
    const imgH = BASE.h * scale;

    // Centered offsets for the cropped side
    const offsetX = Math.round((box.width  - imgW) / 2);
    const offsetY = Math.round((box.height - imgH) / 2);

    const left   = Math.round(offsetX + TV.x * scale);
    const top    = Math.round(offsetY + TV.y * scale);
    const width  = Math.round(TV.w * scale);
    const height = Math.round(TV.h * scale);

    Object.assign(vid.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    Object.assign(hit.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });

    hint.style.left = `${Math.round(left + width / 2 - 40)}px`;
    hint.style.top  = `${Math.round(top + height + 8)}px`;
  };

  // Decode and initial layout
  const ready = async () => {
    try {
      // @ts-expect-error: decode may not exist in some browsers
      if (typeof room.decode === "function") await room.decode();
      else if (!room.complete) await new Promise((r) => room.addEventListener("load", () => r(null), { once: true }));
    } catch {}
    if ((room.naturalWidth && room.naturalWidth !== BASE.w) || (room.naturalHeight && room.naturalHeight !== BASE.h)) {
      console.warn("living-room.png natural size differs from BASE", {
        natural: { w: room.naturalWidth, h: room.naturalHeight },
        BASE,
      });
    }
    place();
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
      setTimeout(() => hint.remove(), 400);
    }
  };

  const enterFullscreen = () => {
    hideHint();
    vid.muted = false;
    vid.controls = true;

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

    if (scene.requestFullscreen) {
      vid.play().catch(() => {});
      scene.requestFullscreen().catch(() => {});
      return;
    }

    vid.play().catch(() => {});
  };

  const exitInline = () => {
    vid.controls = false;
    vid.muted = true;
    vid.play().catch(() => {});
  };

  hit.addEventListener("click", enterFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const full = Boolean(document.fullscreenElement);
    if (!full) exitInline();
  });
  vid.addEventListener("webkitendfullscreen" as any, exitInline);
}
