// Floating overlay player on top of the grid. Tiles below remain scrollable.

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

  // Overlay player (initially hidden)
  const overlay = document.createElement("div");
  overlay.className = "clip-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const player = document.createElement("video");
  player.className = "clip-overlay-player";
  player.playsInline = true;
  player.muted = true;
  player.autoplay = true;
  player.loop = true;
  player.preload = "auto";      // no controls

  const closeBtn = document.createElement("button");
  closeBtn.className = "clip-overlay-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    player.pause();
    player.removeAttribute("src"); // drop buffered data
    player.load();
  });

  overlay.appendChild(player);
  overlay.appendChild(closeBtn);

  // Grid of tiles
  const grid = document.createElement("div");
  grid.className = "clips-grid";

  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";

  root.appendChild(title);
  root.appendChild(status);
  root.appendChild(grid);
  root.appendChild(overlay); // overlay floats; position fixed via CSS

  loadClips()
    .then(urls => {
      status.remove();
      const list = shuffle(urls);

      for (const url of list) {
        const tile = document.createElement("button");
        tile.className = "clip-tile";
        tile.type = "button";
        tile.setAttribute("aria-label", "Play clip");

        const v = document.createElement("video");
        v.src = url;
        v.muted = true;
        v.playsInline = true;
        v.loop = true;
        v.preload = "metadata";
        v.autoplay = true;
        v.className = "clip-preview";

        tile.appendChild(v);

        tile.addEventListener("click", () => {
          if (player.src !== url) player.src = url;
          overlay.classList.add("is-visible");
          overlay.setAttribute("aria-hidden", "false");
          player.play().catch(() => {});
          // Keep page position; overlay is fixed on top
        });

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
