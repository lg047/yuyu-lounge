// src/views/reels.ts

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
  player.style.display = "none"; // hidden until first frame

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

  function sizeOverlayVideo() {
    const vw = player.videoWidth || 0;
    const vh = player.videoHeight || 0;
    if (!vw || !vh) return;

    const maxW = Math.min(window.innerWidth * 0.95, window.innerHeight * 0.95 * (vw / vh));
    const maxH = Math.min(window.innerHeight * 0.95, window.innerWidth * 0.95 * (vh / vw));

    // Choose the limiting side to avoid bars inside the element
    let w = maxW;
    let h = (w * vh) / vw;
    if (h > window.innerHeight * 0.95) {
      h = maxH;
      w = (h * vw) / vh;
    }

    player.style.width = `${w}px`;
    player.style.height = `${h}px`;
  }

  function openOverlay(index: number) {
    if (index < 0 || index >= list.length) return;
    current = index;
    const url = list[current];

    overlaySpinner.classList.add("show");
    player.style.display = "none";

    player.src = url;

    const onReady = () => {
      sizeOverlayVideo();
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

    player.play().catch(() => {
      const tapToPlay = () => {
        player.play().finally(() => player.removeEventListener("click", tapToPlay));
      };
      player.addEventListener("click", tapToPlay, { once: true });
    });

    // Resize with viewport changes
    const onResize = () => sizeOverlayVideo();
    window.addEventListener("resize", onResize, { passive: true, once: true });
  }

  function closeOverlay() {
    overlay.classList.remove("is-visible");
    backdrop.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("clip-open");
    player.pause();
    player.removeAttribute("src");
    player.load();
    current = -1;
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

  // Sentinel at the very end of the grid
  const sentinel = document.createElement("div");
  sentinel.style.width = "1px";
  sentinel.style.height = "1px";
  grid.appendChild(sentinel);

  async function loadTile(index: number): Promise<HTMLButtonElement> {
    const url = list[index];

    // Preload off DOM to avoid black
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
      grid.insertBefore(tile, sentinel); // keep sentinel last
    }

    batchInProgress = false;
  }

  async function topUpUntilScrollable() {
    // Keep filling until page is comfortably scrollable
    let safety = 0;
    while (safety++ < 20) {
      const docH = document.documentElement.scrollHeight;
      const winH = window.innerHeight;
      const scrollable = docH > winH * 1.2;
      if (scrollable || loadingIndex >= list.length) break;
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

  // Scroll fallback in case IO misses on some browsers
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(async () => {
      const bottom = window.scrollY + window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      if (docH - bottom < 1200) {
        await renderBatch();
      }
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

/* Minimal CSS injection for centring and spinner */
const style = document.createElement("style");
style.textContent = `
.clip-tile { position: relative; }
.clip-overlay, .clip-overlay-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}
.clip-preview { object-fit: cover; object-position: center; }
.clip-overlay-player { display: block; background: #000; }
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
