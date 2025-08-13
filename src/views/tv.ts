// src/views/tv.ts

import CATALOG, { Channel, Episode } from "../data/tv.catalog";
import { loadResume, saveResume } from "../lib/tv.store";

type Size = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

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

  // inline audio after first gesture
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
        // do not unsuppress on fullscreen exit
        vid.style.pointerEvents = "";
      }
    });
    // iOS inline fullscreen
    // @ts-ignore
    video.addEventListener("webkitbeginfullscreen", () => { suppress(true); pauseBgm(); }, true);
    // @ts-ignore
    video.addEventListener("webkitendfullscreen", () => {
      // do not unsuppress here
    }, true);
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

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Tap to open";
  hint.style.position = "absolute";
  hint.style.zIndex = "5";

  // order: wrap(video) < vhs < room < hit < hint
  scene.append(wrap, vhs, room, hit, hint);
  root.innerHTML = "";
  root.appendChild(scene);

  // controls inside scene, absolute under TV
  const controls = document.createElement("div");
  controls.className = "tv-controls";
  controls.style.position = "absolute";
  controls.style.margin = "0";
  controls.style.zIndex = "6";
  controls.style.display = "grid";
  controls.style.gridTemplateColumns = "1fr";
  controls.style.gap = "8px";

  const row1 = document.createElement("div");
  row1.style.display = "grid";
  row1.style.gridTemplateColumns = "1fr 1fr 1fr";
  row1.style.gap = "6px";

  const row2 = document.createElement("div");
  row2.style.display = "grid";
  row2.style.gridTemplateColumns = "1fr 1fr 1fr";
  row2.style.gap = "6px";

  const btnPrev = mkBtn("Previous ep");
  const btnPlay = mkBtn("Play");
  const btnNext = mkBtn("Next ep");
  row1.append(btnPrev, btnPlay, btnNext);

  const btnPooh = mkBtn("Winnie");
  const btnLilo = mkBtn("Lilo & Stitch");
  const btnDuck = mkBtn("DuckTales");
  row2.append(btnPooh, btnLilo, btnDuck);

  controls.append(row1, row2);
  scene.appendChild(controls);

  function mkBtn(label: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.padding = "10px 12px";
    b.style.borderRadius = "12px";
    b.style.border = "1px solid #0003";
    b.style.fontFamily = "inherit";
    b.style.cursor = "pointer";
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

    hint.style.left = `${Math.round(left + width / 2 - 40)}px`;
    hint.style.top  = `${Math.round(top + height + 8)}px`;

    const ctrlTop = Math.round(top + height + 8);
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
  let hinted = false;
  const hideHint = () => {
    if (!hinted) {
      hinted = true;
      hint.classList.add("hide");
      setTimeout(() => hint.remove(), 400);
    }
  };

  const enterFullscreen = () => {
    const w = window as any;
    w.__suppressBGMResume = true;
    try { (w.__bgm?.el as HTMLAudioElement | undefined)?.pause?.(); } catch {}

    hideHint();
    vid.muted = false;
    vid.controls = true;

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
    updateChannelButtons();
  }

  function updatePlayButton() {
    btnPlay.textContent = vid.paused ? "Play" : "Pause";
  }
  function updateChannelButtons() {
    [btnPooh, btnLilo, btnDuck].forEach((b) => b.classList.remove("active"));
    const id = currentChannel().id;
    if (id === "pooh") btnPooh.classList.add("active");
    if (id === "lilo") btnLilo.classList.add("active");
    if (id === "ducktales") btnDuck.classList.add("active");
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
    if (vid.paused) vid.play().catch(() => {}); else vid.pause();
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
  btnPooh.addEventListener("click", () => {
    channelIndex = CATALOG.findIndex(c => c.id === "pooh");
    epIndex = loadResume("pooh")?.epIndex ?? 0;
    loadEpisode(true).catch(console.error);
  });
  btnLilo.addEventListener("click", () => {
    channelIndex = CATALOG.findIndex(c => c.id === "lilo");
    epIndex = loadResume("lilo")?.epIndex ?? 0;
    loadEpisode(true).catch(console.error);
  });
  btnDuck.addEventListener("click", () => {
    channelIndex = CATALOG.findIndex(c => c.id === "ducktales");
    epIndex = loadResume("ducktales")?.epIndex ?? 0;
    loadEpisode(true).catch(console.error);
  });

  vid.addEventListener("play", updatePlayButton);
  vid.addEventListener("pause", updatePlayButton);

  function mkSpan(text: string) { const s = document.createElement("span"); s.textContent = text; return s; }
}
