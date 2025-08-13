// src/views/tv.ts

import CATALOG, { Channel, Episode } from "../data/tv.catalog";
import { loadResume, saveResume } from "../lib/tv.store";

type Size = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

const BASE: Size = { w: 1536, h: 1024 };
const TV: Rect  = { x: 560, y: 380, w: 417, h: 291 };
const BASE_URL = (import.meta as any).env.BASE_URL || "/";

// warm off-white that matches the palette
const BTN_TINT = "#e6d8c6";

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
  scene.style.position = "relative";
  scene.style.width = "100%";
  scene.style.height = "100%";

  const wrap = document.createElement("div");
  wrap.className = "tv-wrap";
  wrap.style.position = "absolute";
  wrap.style.overflow = "hidden";
  wrap.style.zIndex = "1";

  const vid = document.createElement("video");
  vid.id = "tv";
  vid.autoplay = true;
  vid.preload = "auto";
  vid.playsInline = true;
  vid.setAttribute("webkit-playsinline", "true");
  vid.controls = false;
  vid.style.width = "100%";
  vid.style.height = "100%";
  vid.style.display = "block";
  wrap.appendChild(vid);

  // enable inline audio after first gesture
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

  // BGM suppression
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
        vid.style.pointerEvents = "auto";
      } else {
        vid.style.pointerEvents = "";
      }
    });
    // iOS inline fullscreen
    // @ts-ignore
    video.addEventListener("webkitbeginfullscreen", () => { suppress(true); pauseBgm(); }, true);
    // @ts-ignore
    video.addEventListener("webkitendfullscreen", () => {}, true);
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
  vhs.style.position = "absolute";
  vhs.style.zIndex = "2";

  const room = new Image();
  room.className = "room";
  room.src = BASE_URL + "assets/room/living-room3.png";
  room.alt = "Living room";
  room.style.position = "absolute";
  room.style.zIndex = "3";

  const hit = document.createElement("button");
  hit.className = "hit";
  hit.type = "button";
  hit.ariaLabel = "Open fullscreen";
  hit.style.position = "absolute";
  hit.style.zIndex = "4";

  // order: wrap(video) < vhs < room < hit
  scene.append(wrap, vhs, room, hit);
  root.innerHTML = "";
  root.appendChild(scene);

  // controls inside scene, absolute
  const controls = document.createElement("div");
  controls.className = "tv-controls";
  controls.style.position = "absolute";
  controls.style.margin = "0";
  controls.style.zIndex = "6";
  controls.style.display = "grid";
  controls.style.gridTemplateColumns = "1fr";
  controls.style.rowGap = "18px"; // equal spacing rows

  const row1 = document.createElement("div");
  row1.style.display = "grid";
  row1.style.gridTemplateColumns = "1fr 1fr 1fr";
  row1.style.columnGap = "10px";

  const row2 = document.createElement("div"); // Select show button row
  row2.style.display = "grid";
  row2.style.gridTemplateColumns = "1fr";

  const epTitle = document.createElement("div"); // small episode title under Select show
  epTitle.style.textAlign = "center";
  epTitle.style.fontFamily = "'VT323', monospace";
  epTitle.style.fontSize = "14px";
  epTitle.style.color = BTN_TINT;
  epTitle.style.opacity = "0.95";

  const btnPrev = mkBtn("Previous ep");
  const btnPlay = mkBtn("Play");
  const btnNext = mkBtn("Next ep");
  row1.append(btnPrev, btnPlay, btnNext);

  const btnSelect = mkBtn("Select show");
  row2.append(btnSelect);

  controls.append(row1, row2, epTitle); // equal gaps above and below Select row
  scene.appendChild(controls);

  // --- Overlay for selecting show (covers) ---
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.backdropFilter = "blur(2px)";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "999";

  const chooser = document.createElement("div");
  chooser.style.display = "grid";
  chooser.style.gridTemplateColumns = "repeat(3, 150px)";
  chooser.style.gap = "20px";
  chooser.style.alignItems = "start";

  const tilePooh = mkCoverTile(
    "pooh",
    "Winnie the Pooh",
    BASE_URL + "assets/tv/covers/winnie-the-pooh-cover.png"
  );
  const tileLilo = mkCoverTile(
    "lilo",
    "Lilo & Stitch",
    BASE_URL + "assets/tv/covers/lilo-and-stitch-cover.png"
  );
  const tileDuck = mkCoverTile(
    "ducktales",
    "DuckTales",
    BASE_URL + "assets/tv/covers/ducktales-cover.png"
  );
  chooser.append(tilePooh, tileLilo, tileDuck);
  overlay.appendChild(chooser);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideOverlay();
  });
  window.addEventListener("keydown", (e) => {
    if (overlay.style.display !== "none" && e.key === "Escape") hideOverlay();
  });

  function showOverlay() { overlay.style.display = "flex"; }
  function hideOverlay() { overlay.style.display = "none"; }

  btnSelect.addEventListener("click", showOverlay);

  // ---- styles/helpers ----
  function mkBtn(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.padding = "6px 10px";
    b.style.borderRadius = "0";
    b.style.border = `2px solid ${BTN_TINT}`;
    b.style.background = "transparent";
    b.style.color = BTN_TINT;
    b.style.fontFamily = "'VT323', monospace";
    b.style.fontSize = "18px";
    b.style.letterSpacing = "0.5px";
    b.style.cursor = "pointer";
    return b;
  }

  function mkCoverTile(
    id: "pooh" | "lilo" | "ducktales",
    label: string,
    src: string
  ): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.channel = id;
    b.style.all = "unset";
    b.style.cursor = "pointer";
    b.style.display = "grid";
    b.style.gridTemplateRows = "auto 1fr";
    b.style.border = "1px solid #0003";
    b.style.borderRadius = "0";
    b.style.overflow = "hidden";
    b.style.background = "transparent";

    const img = new Image();
    img.src = src;
    img.alt = label;
    img.loading = "lazy";
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.display = "block";

    const cap = document.createElement("div");
    cap.textContent = label;
    cap.style.textAlign = "center";
    cap.style.fontSize = "14px";
    cap.style.fontFamily = "'VT323', monospace";
    cap.style.padding = "4px 6px";
    cap.style.color = BTN_TINT;

    b.append(img, cap);

    b.addEventListener("click", () => {
      channelIndex = CATALOG.findIndex((c) => c.id === id);
      epIndex = loadResume(id)?.epIndex ?? 0;
      loadEpisode(true).catch(console.error);
      updateChannelTiles();
      hideOverlay();
    });

    return b;
  }

  // layout
  const place = () => {
    const box = scene.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    const scale = Math.max(box.width / BASE.w, box.height / BASE.h);
    const imgW = Math.round(BASE.w * scale);
    const imgH = Math.round(BASE.h * scale);
    const offsetX = Math.round((box.width  - imgW) / 2);
    const offsetY = Math.round((box.height - imgH) / 2);

    // size and place the room and vhs images
    Object.assign(vhs.style,  { left: `${offsetX}px`, top: `${offsetY}px`, width: `${imgW}px`, height: `${imgH}px` });
    Object.assign(room.style, { left: `${offsetX}px`, top: `${offsetY}px`, width: `${imgW}px`, height: `${imgH}px` });

    // TV window coords
    const left   = Math.round(offsetX + TV.x * scale);
    const top    = Math.round(offsetY + TV.y * scale);
    const width  = Math.round(TV.w * scale);
    const height = Math.round(TV.h * scale);

    Object.assign(wrap.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    Object.assign(hit.style,  { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });

    // controls: halfway to bottom, slightly lower on desktop
    const tvBottom = top + height;
    const halfway  = tvBottom + (box.height - tvBottom) * 0.5;
    const isDesktop = matchMedia("(pointer: fine)").matches && window.innerWidth >= 900;
    const extra = isDesktop ? 28 : 0;
    const ctrlTop  = Math.min(Math.round(halfway + extra), box.height - 140);
    Object.assign(controls.style, { left: `${left}px`, top: `${ctrlTop}px`, width: `${width}px` });
  };

  const ready = async () => {
    try {
      // @ts-expect-error
      if (typeof room.decode === "function") await room.decode();
      else if (!room.complete) await new Promise((r) => room.addEventListener("load", () => r(null), { once: true }));
    } catch {}
    place();
    initPlayer();
  };
  ready();

  const ro = new ResizeObserver(place);
  ro.observe(scene);
  window.addEventListener("resize", place);
  window.addEventListener("orientationchange", place);

  // fullscreen
  const enterFullscreen = () => {
    const w = window as any;
    w.__suppressBGMResume = true;
    try { (w.__bgm?.el as HTMLAudioElement | undefined)?.pause?.(); } catch {}

    vid.muted = false;
    vid.controls = true;

    hit.dataset.prevDisplay = hit.style.display || "";
    hit.style.display = "none";
    hit.style.pointerEvents = "none";
    vid.style.pointerEvents = "auto";

    const playSoon = () => setTimeout(() => { vid.play().catch(() => {}); }, 0);

    const anyVid = vid as any;
    if (typeof anyVid.webkitEnterFullscreen === "function") {
      vid.addEventListener("webkitbeginfullscreen" as any, playSoon, { once: true });
      try { anyVid.webkitEnterFullscreen(); } catch {}
      return;
    }

    const onFs = () => {
      if (document.fullscreenElement) playSoon();
      document.removeEventListener("fullscreenchange", onFs);
    };
    document.addEventListener("fullscreenchange", onFs, { once: true });

    if (vid.requestFullscreen) {
      vid.requestFullscreen().catch(() => {});
      return;
    }
    if ((scene as any).requestFullscreen) {
      (scene as any).requestFullscreen().catch(() => {});
      return;
    }
    playSoon();
  };

  const exitInline = () => {
    vid.controls = false;
    hit.style.display = hit.dataset.prevDisplay ?? "";
    hit.style.pointerEvents = "";
    vid.style.pointerEvents = "";
  };

  hit.addEventListener("click", enterFullscreen);
  document.addEventListener("fullscreenchange", () => {
    const full = Boolean(document.fullscreenElement);
    if (!full) exitInline();
  });
  vid.addEventListener("webkitendfullscreen" as any, exitInline);

  // player state
  let hls: any | null = null;
  let channelIndex = 0;
  let epIndex = 0;
  let saveTick = 0;

  function canNativeHls(video: HTMLVideoElement): boolean {
    return !!(video.canPlayType("application/vnd.apple.mpegurl") || video.canPlayType("application/x-mpegURL"));
  }

  async function setSrc(url: string) {
    if (hls) {
      try { hls.destroy?.(); } catch {}
      hls = null;
    }
    if (canNativeHls(vid)) {
      vid.src = url;
      vid.load();
    } else {
      const mod = await import("https://cdn.jsdelivr.net/npm/hls.js@1.5.8/+esm");
      const Hls = (mod as any).default;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.attachMedia(vid);
        hls.loadSource(url);
      } else {
        vid.src = url;
        vid.load();
      }
    }
  }

  function currentChannel(): Channel { return CATALOG[channelIndex]; }
  function currentEpisode(): Episode | null {
    const ch = currentChannel();
    if (!ch.episodes.length) return null;
    return ch.episodes[Math.max(0, Math.min(epIndex, ch.episodes.length - 1))];
  }

  function setEpisodeLabel() {
    const ep = currentEpisode();
    epTitle.textContent = ep ? ep.title : "No episode";
  }

  async function loadEpisode(seekFromResume = true) {
    const ep = currentEpisode();
    if (!ep) return;
    await setSrc(ep.url);
    if (seekFromResume) {
      const res = loadResume(currentChannel().id);
      if (res && res.epIndex === epIndex && Number.isFinite(res.tSec)) {
        const t = Math.max(0, Math.min(res.tSec, (vid.duration || res.tSec)));
        try { vid.currentTime = t; } catch {}
      }
    }
    vid.play().catch(() => {});
    updatePlayButton();
    updateChannelTiles();
    setEpisodeLabel();
  }

  function updatePlayButton() {
    btnPlay.textContent = vid.paused ? "Play" : "Pause";
  }
  function updateChannelTiles() {
    [tilePooh, tileLilo, tileDuck].forEach((b) => b.classList.remove("active"));
    const id = currentChannel().id;
    if (id === "pooh") tilePooh.classList.add("active");
    if (id === "lilo") tileLilo.classList.add("active");
    if (id === "ducktales") tileDuck.classList.add("active");
  }

  function initPlayer() {
    const ch0 = CATALOG[0];
    const r = loadResume(ch0.id);
    channelIndex = 0;
    epIndex = Math.max(0, Math.min(r?.epIndex ?? 0, ch0.episodes.length - 1));
    loadEpisode(true).catch(console.error);
  }

  // persistence
  vid.addEventListener("timeupdate", () => {
    const now = Date.now();
    if (now - saveTick < 1000) return;
    saveTick = now;
    const ep = currentEpisode();
    if (!ep) return;
    saveResume(currentChannel().id, epIndex, vid.currentTime || 0);
  });
  ["pause", "ended"].forEach(evt => {
    vid.addEventListener(evt, () => {
      const ep = currentEpisode(); if (!ep) return;
      saveResume(currentChannel().id, epIndex, vid.currentTime || 0);
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      const ep = currentEpisode(); if (!ep) return;
      saveResume(currentChannel().id, epIndex, vid.currentTime || 0);
      try { vid.pause(); } catch {}
    }
  });

  // controls wiring
  btnPlay.addEventListener("click", () => {
    if (vid.paused) {
      try { hls?.startLoad?.(); } catch {}
      vid.play().catch(() => {});
    } else {
      vid.pause();
      try { hls?.stopLoad?.(); } catch {}
    }
    updatePlayButton();
  });

  btnPrev.addEventListener("click", () => {
    const goStart = vid.currentTime > 3;
    if (goStart) { vid.currentTime = 0; return; }
    if (epIndex > 0) { epIndex -= 1; loadEpisode(false).catch(console.error); }
  });
  btnNext.addEventListener("click", () => {
    const ch = currentChannel();
    if (epIndex < ch.episodes.length - 1) { epIndex += 1; loadEpisode(false).catch(console.error); }
  });

  vid.addEventListener("play", updatePlayButton);
  vid.addEventListener("pause", updatePlayButton);
}
