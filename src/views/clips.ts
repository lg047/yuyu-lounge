// Floating player, no autoplay on tiles. Vertical tiles, stronger dimming.

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
  return data.map(String).filter(u => /\.mp4(\?|$)/i.test(u));
}

export default function ClipsView(): HTMLElement {
  const root = document.createElement("section");
  root.className = "clips-view";

  const title = document.createElement("h2");
  title.textContent = "Clips";
  title.style.marginBottom = "10px";

  // Backdrop + overlay player
  const backdrop = document.createElement("div");
  backdrop.className = "clip-backdrop";
  backdrop.addEventListener("click", () => closeOverlay());

  const overlay = document.createElement("div");
  overlay.className = "clip-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const player = document.createElement("video");
  player.className = "clip-overlay-player";
  player.playsInline = true;
  player.muted = true;
  player.loop = true;
  player.preload = "auto";

  const closeBtn = document.createElement("button");
  closeBtn.className = "clip-overlay-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => closeOverlay());

  overlay.appendChild(player);
  overlay.appendChild(closeBtn);

  function openOverlay(url: string) {
    if (player.src !== url) player.src = url;
    document.documentElement.classList.add("clip-open");
    backdrop.classList.add("is-visible");
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    player.play().catch(() => {});
  }

  function closeOverlay() {
    overlay.classList.remove("is-visible");
    backdrop.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("clip-open");
    player.pause();
    player.removeAttribute("src");
    player.load();
  }

  const grid = document.createElement("div");
  grid.className = "clips-grid";

  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";

  root.appendChild(title);
  root.appendChild(status);
  root.appendChild(grid);
  // append backdrop then overlay so overlay sits above it
  root.appendChild(backdrop);
  root.appendChild(overlay);

  loadClips()
    .then(urls => {
      status.remove();
      const list = shuffle(urls);

      for (const url of list) {
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

        tile.appendChild(v);
        tile.addEventListener("click", () => openOverlay(url));
        grid.appendChild(tile);
      }
    })
    .catch(err => {
      status.textContent = `Failed to load clips: ${
        err instanceof Error ? err.message : String(err)
      }`;
    });

  return root;
}
