// src/views/reels.ts
// Same layout/overlay as before. Adds: batch loading via IntersectionObserver,
// spinner overlay during buffering/seeking, keeps video previews as thumbnails.

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

  const player = document.createElement("video");
  player.className = "clip-overlay-player";
  player.playsInline = true;
  player.muted = false;
  player.loop = true;
  player.preload = "auto";

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

  overlay.appendChild(player);
  overlay.appendChild(closeBtn);
  overlay.appendChild(prevBtn);
  overlay.appendChild(nextBtn);

  let list: string[] = [];
  let current = -1;

  function openOverlay(index: number) {
    if (index < 0 || index >= list.length) return;
    current = index;
    const url = list[current];
    if (player.src !== url) player.src = url;

    document.documentElement.classList.add("clip-open");
    backdrop.classList.add("is-visible");
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");

    player.play().catch(() => {
      const tapToPlay = () => {
        player.play().finally(() => {
          player.removeEventListener("click", tapToPlay);
        });
      };
      player.addEventListener("click", tapToPlay, { once: true });
    });
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

  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    step(-1);
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    step(1);
  });

  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("is-visible")) return;
    if (e.key === "Escape") closeOverlay();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  // Centered grid
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

  // Spinner element
  function makeSpinner(): HTMLElement {
    const s = document.createElement("div");
    s.className = "clip-spinner";
    return s;
  }

  // Batch rendering
  let rendered = 0;
  const batchSize = 24;
  const sentinel = document.createElement("div");
  sentinel.style.width = "1px";
  sentinel.style.height = "1px";
  gridWrap.appendChild(sentinel);

  function renderBatch() {
    const end = Math.min(list.length, rendered + batchSize);
    for (; rendered < end; rendered++) {
      const url = list[rendered];
      const tile = document.createElement("button");
      tile.className = "clip-tile";
      tile.type = "button";
      tile.setAttribute("aria-label", "Open clip");

      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.loop = false;
      v.preload = "metadata";
      v.className = "clip-preview";
      v.addEventListener("loadedmetadata", () => {
        try {
          v.currentTime = Math.min(0.1, (v.duration || 1) * 0.01);
        } catch {}
      });

      const spinner = makeSpinner();
      tile.appendChild(v);
      tile.appendChild(spinner);

      v.addEventListener("waiting", () => spinner.classList.add("show"));
      v.addEventListener("seeking", () => spinner.classList.add("show"));
      v.addEventListener("canplay", () => spinner.classList.remove("show"));
      v.addEventListener("playing", () => spinner.classList.remove("show"));
      v.addEventListener("pause", () => spinner.classList.remove("show"));
      v.addEventListener("ended", () => spinner.classList.remove("show"));

      // openOverlay uses index from current rendered loop
      tile.addEventListener("click", () => openOverlay(rendered));

      grid.appendChild(tile);
    }
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        renderBatch();
        if (rendered >= list.length) {
          io.disconnect();
          sentinel.remove();
        }
      }
    }
  }, { root: null, rootMargin: "1200px 0px" });

  loadClips()
    .then((urls) => {
      status.remove();
      list = shuffle(urls);
      renderBatch();
      io.observe(sentinel);
    })
    .catch((err) => {
      status.textContent = `Failed to load clips: ${
        err instanceof Error ? err.message : String(err)
      }`;
    });

  return root;
}

/* === Spinner CSS appended === */
const style = document.createElement("style");
style.textContent = `
.clip-tile { position: relative; }
.clip-spinner {
  position: absolute;
  width: 32px;
  height: 32px;
  border: 3px solid transparent;
  border-top-color: #7df6ff;
  border-right-color: #ff4f98;
  border-radius: 50%;
  animation: clip-spin 0.9s linear infinite paused;
  opacity: 0;
  pointer-events: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.clip-spinner.show {
  opacity: 1;
  animation-play-state: running;
}
@keyframes clip-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
`;
document.head.appendChild(style);
