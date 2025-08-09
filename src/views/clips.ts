// src/views/clips.ts
// Full-width main viewer at top, tiles below. No controls, no scrub bar.

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

  // Main viewer
  const viewerWrapper = document.createElement("div");
  viewerWrapper.className = "clip-viewer-wrapper";

  const viewer = document.createElement("video");
  viewer.className = "clip-viewer";
  viewer.playsInline = true;
  viewer.muted = true;
  viewer.autoplay = true;
  viewer.loop = true;
  viewer.preload = "auto";

  viewerWrapper.appendChild(viewer);

  // Grid container
  const grid = document.createElement("div");
  grid.className = "clips-grid";

  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";

  root.appendChild(title);
  root.appendChild(viewerWrapper);
  root.appendChild(status);
  root.appendChild(grid);

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
          viewer.src = url;
          viewer.play().catch(() => {});
          window.scrollTo({ top: 0, behavior: "smooth" });
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
