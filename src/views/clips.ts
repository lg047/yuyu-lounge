// src/views/reels.ts
// Lightbox video covers viewport. BGM pauses while a reel plays, resumes on stop/close.
// Grid: progressive append.

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadClips(): Promise<string[]> {
  const base = import.meta.env.BASE_URL || "/";
  const res = await fetch(`${base}clips.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${base}clips.json failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("clips.json is not an array");
  return data.map(String).filter((u) => /\.mp4(\?|$)/i.test(u));
}

export default function ReelsView(): HTMLElement {
  const root = document.createElement("section");
  root.className = "clips-view";

  // Backdrop and overlay
  const backdrop = document.createElement("div");
  backdrop.className = "clip-backdrop";
  backdrop.addEventListener("click", () => closeOverlay());

  const overlay = document.createElement("div");
  overlay.className = "clip-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const overlayWrap = document.createElement("div");
  overlayWrap.className = "clip-overlay-wrap";
  overlay.appendChild(overlayWrap);

  const player = document.createElement("video");
  player.className = "clip-overlay-player";
  player.playsInline = true;
  player.muted = false;
  player.loop = true;
  player.preload = "auto";
  player.style.display = "none";

  const overlaySpinner = document.createElement("div");
  overlaySpinner.className = "clip-spinner";

  overlayWrap.appendChild(player);
  overlayWrap.appendChild(overlaySpinner);

  const closeBtn = document.createElement("button");
  closeBtn.className = "clip-overlay-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => closeOverlay());

  const prevBtn = document.createElement("button");
  prevBtn.className = "clip-nav clip-nav-prev";
  prevBtn.type = "button";
  prevBtn.setAttribute("aria-label", "Previous");
  prevBtn.textContent = "‹";

  const nextBtn = document.createElement("button");
  nextBtn.className = "clip-nav clip-nav-next";
  nextBtn.type = "button";
  nextBtn.setAttribute("aria-label", "Next");
  nextBtn.textContent = "›";

  overlay.appendChild(closeBtn);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);

  let list: string[] = [];
  let current = -1;

  // Site BGM handle
  const bgm: any = (window as any).__bgm || null;

  // Cover viewport
  function sizeOverlayToVideo() {
    overlayWrap.style.width = "100vw";
    overlayWrap.style.height = "100vh";
    player.style.width = "100%";
    player.style.height = "100%";
    player.style.objectFit = "cover";
    player.style.objectPosition = "center";
  }

  // BGM control handlers bound to this player
  const pauseBGM = () => { try { bgm?.pause?.(); } catch {} };
  const resumeBGM = () => { try { if (bgm && !bgm.muted) bgm.playIfAllowed?.(); } catch {} };

  function bindAudioBridging() {
    player.addEventListener("play", pauseBGM);
    player.addEventListener("playing", pauseBGM);
    player.addEventListener("pause", resumeBGM);
    player.addEventListener("ended", resumeBGM);
    player.addEventListener("emptied", resumeBGM);
  }
  function unbindAudioBridging() {
    player.removeEventListener("play", pauseBGM);
    player.removeEventListener("playing", pauseBGM);
    player.removeEventListener("pause", resumeBGM);
    player.removeEventListener("ended", resumeBGM);
    player.removeEventListener("emptied", resumeBGM);
  }

  function openOverlay(index: number) {
    if (index < 0 || index >= list.length) return;
    current = index;
    const url = list[current];

    overlaySpinner.classList.add("show");
    player.style.display = "none";
    player.src = url;

    const onReady = () => {
      sizeOverlayToVideo();
      overlaySpinner.classList.remove("show");
      player.style.display = "";
      player.removeEventListener("loadedmetadata", onReady);
      player.removeEventListener("canplay", onReady);
    };
    player.addEventListener("loadedmetadata", onReady, { once: true });
    player.addEventListener("canplay", onReady, { once: true });

    document.documentElement.classList.add("clip-open");
    backdrop.classList.add("is-visible");
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");

    if (!overlayWrap.contains(player)) overlayWrap.appendChild(player);

    // Ensure bridging is active for this player
    bindAudioBridging();

    // Try to play immediately, else wait for click
    player.muted = false;
    player.play().catch(() => {
      const tapToPlay = () => {
        player.muted = false;
        player.play().catch(() => {});
        overlay.removeEventListener("click", tapToPlay);
      };
      overlay.addEventListener("click", tapToPlay, { once: true });
    });

    const onResize = () => sizeOverlayToVideo();
    window.addEventListener("resize", onResize, { passive: true });
    overlay.addEventListener("transitionend", function cleanup() {
      if (!overlay.classList.contains("is-visible")) {
        window.removeEventListener("resize", onResize);
        overlay.removeEventListener("transitionend", cleanup);
      }
    });
  }

  function closeOverlay() {
    overlay.classList.remove("is-visible");
    backdrop.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("clip-open");

    // Stop video and detach handlers
    player.pause();
    unbindAudioBridging();
    player.removeAttribute("src");
    player.load();
    current = -1;

    // Resume BGM
    resumeBGM();
  }

  function step(delta: number) {
    if (current < 0) return;
    const next = (current + delta + list.length) % list.length;
    openOverlay(next);
  }

  prevBtn.addEventListener("click", (e) => { e.stopPropagation(); step(-1); });
  nextBtn.addEventListener("click", (e) => { e.stopPropagation(); step(1); });

  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("is-visible")) return;
    if (e.key === "Escape") closeOverlay();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  // Grid
  const gridWrap = document.createElement("div");
  gridWrap.className = "clips-grid-wrap";

  const grid = document.createElement("div");
  grid.className = "clips-grid";

  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";

  root.appendChild(status);
  gridWrap.appendChild(grid);
  root.appendChild(gridWrap);
  root.appendChild(backdrop);
  root.appendChild(overlay);

  function makeSpinner(): HTMLElement {
    const s = document.createElement("div");
    s.className = "clip-spinner";
    return s;
  }

  let loadingIndex = 0;
  let batchInProgress = false;
  const batchSize = 12;

  // Sentinel stays last
  const sentinel = document.createElement("div");
  sentinel.style.width = "1px";
  sentinel.style.height = "1px";
  grid.appendChild(sentinel);

  async function loadTile(index: number): Promise<HTMLButtonElement> {
    const url = list[index];

    // Preload off DOM so first frame is ready
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    v.loop = false;
    v.preload = "metadata";
    v.className = "clip-preview";
    v.style.objectFit = "cover";
    v.style.objectPosition = "center";

    await new Promise<void>((resolve) => {
      v.addEventListener("loadedmetadata", () => {
        try { v.currentTime = Math.min(0.1, (v.duration || 1) * 0.01); } catch {}
      });
      v.addEventListener("canplay", () => resolve(), { once: true });
    });

    const tile = document.createElement("button");
    tile.className = "clip-tile";
    tile.type = "button";
    tile.setAttribute("aria-label", "Open clip");

    const spinner = makeSpinner();
    tile.appendChild(v);
    tile.appendChild(spinner);

    // Spinner only during buffering after click
    v.addEventListener("waiting", () => spinner.classList.add("show"));
    v.addEventListener("seeking", () => spinner.classList.add("show"));
    v.addEventListener("canplay", () => spinner.classList.remove("show"));
    v.addEventListener("playing", () => spinner.classList.remove("show"));
    v.addEventListener("pause", () => spinner.classList.remove("show"));
    v.addEventListener("ended", () => spinner.classList.remove("show"));

    tile.addEventListener("click", () => openOverlay(index));

    return tile;
  }

  async function renderBatch() {
    if (batchInProgress || loadingIndex >= list.length) return;
    batchInProgress = true;

    const end = Math.min(list.length, loadingIndex + batchSize);
    for (; loadingIndex < end; loadingIndex++) {
      const tile = await loadTile(loadingIndex);
      grid.insertBefore(tile, sentinel);
    }

    batchInProgress = false;
  }

  async function topUpUntilScrollable() {
    let guard = 0;
    while (guard++ < 20) {
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      if (docH > winH * 1.2 || loadingIndex >= list.length) break;
      await renderBatch();
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          renderBatch().then(topUpUntilScrollable);
          if (loadingIndex >= list.length) {
            io.disconnect();
            sentinel.remove();
          }
        }
      }
    },
    { root: null, rootMargin: "1000px 0px" }
  );

  // Scroll fallback
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(async () => {
      const bottom = window.scrollY + window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      if (docH - bottom < 1200) await renderBatch();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  loadClips()
    .then((urls) => {
      status.remove();
      list = shuffle(urls);
      renderBatch().then(topUpUntilScrollable);
      io.observe(sentinel);
    })
    .catch((err) => {
      status.textContent = `Failed to load clips: ${err instanceof Error ? err.message : String(err)}`;
    });

  return root;
}

/* Minimal CSS injection */
const style = document.createElement("style");
style.textContent = `
.clip-tile { position: relative; }
.clip-overlay, .clip-overlay-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.clip-overlay-wrap {
  width: 100vw;
  height: 100vh;
  padding: 0;
  margin: 0;
  background: black;
}
.clip-overlay, .clip-overlay-wrap { overflow: hidden; }
.clip-preview { object-fit: cover; object-position: center; }
.clip-overlay-player {
  display: block;
  background: transparent;
  width: 100%;
  height: 100%;
}
.clip-spinner {
  position: absolute;
  width: 32px; height: 32px;
  border: 3px solid transparent;
  border-top-color: #7df6ff;
  border-right-color: #ff4f98;
  border-radius: 50%;
  animation: clip-spin 0.9s linear infinite paused;
  opacity: 0; pointer-events: none;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}
.clip-spinner.show { opacity: 1; animation-play-state: running; }
@keyframes clip-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
`;
document.head.appendChild(style);
