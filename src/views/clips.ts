// src/views/clips.ts
// Viewer + tile grid. Tiles are muted previews without controls.
// Clicking a tile loads the main viewer above and starts playback.

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

function wireAutoplay(video: HTMLVideoElement) {
  video.muted = true;
  video.playsInline = true;
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (e.isIntersecting) void video.play();
        else video.pause();
      }
    },
    { threshold: 0.6 }
  );
  io.observe(video);
}

export default function ClipsView(): HTMLElement {
  const root = document.createElement("section");
  root.className = "clips-view";

  const title = document.createElement("h2");
  title.textContent = "Clips";
  title.style.marginBottom = "10px";

  // Main viewer
  const viewer = document.createElement("video");
  viewer.className = "clip-viewer";
  viewer.controls = true;
  viewer.playsInline = true;

  // Grid container
  const grid = document.createElement("div");
  grid.className = "clips-grid";

  // Status
  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";

  root.appendChild(title);
  root.appendChild(viewer);
  root.appendChild(status);
  root.appendChild(grid);

  // Load and render
  loadClips()
    .then(urls => {
      status.remove();

      const list = shuffle(urls);
      if (list.length) viewer.src = list[0];

      for (const url of list) {
        const tile = document.createElement("button");
        tile.className = "clip-tile";
        tile.type = "button";
        tile.setAttribute("aria-label", "Play clip");

        // Muted preview video inside tile
        const v = document.createElement("video");
        v.src = url;
        v.loop = true;
        v.preload = "metadata";
        v.style.display = "block";
        wireAutoplay(v);

        // Play badge
        const badge = document.createElement("span");
        badge.className = "play-badge";
        badge.textContent = "Play";

        tile.appendChild(v);
        tile.appendChild(badge);

        tile.addEventListener("click", () => {
          if (viewer.src !== url) viewer.src = url;
          viewer.play().catch(() => {});
          viewer.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
