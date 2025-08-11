// src/views/clips.ts
// Reels grid with your existing layout aesthetics:
// - Centered grid wrapper classes preserved: .clips-grid-wrap, .clips-grid
// - Square tiles: override component card aspect ratio to 1:1
// - Posters only at first paint, video created on click (handled by ReelsGrid)

import ReelsGrid from "../components/reels-grid";

type ClipItem = {
  src: string;
  poster?: string;
  title?: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const base = (import.meta as any).env.BASE_URL || "/";
const asset = (p: string) => {
  const root = base.endsWith("/") ? base : base + "/";
  return root + p.replace(/^\//, "");
};

async function loadClips(): Promise<ClipItem[]> {
  const url = asset("clips.json");
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("clips.json is not an array");

  // Accept ["...mp4", ...] or [{src, poster?, title?}, ...]
  const items = (data as any[]).map((it) => {
    if (typeof it === "string") return { src: it } as ClipItem;
    if (it && typeof it.src === "string") {
      return { src: it.src, poster: it.poster, title: it.title } as ClipItem;
    }
    return null;
  }).filter(Boolean) as ClipItem[];

  // Keep your previous randomised presentation
  return shuffle(items);
}

export default async function ClipsView(): Promise<HTMLElement> {
  const root = document.createElement("section");
  root.className = "clips-view";

  // Optional status text while loading, same minimal style
  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";
  root.appendChild(status);

  // Layout wrappers from your original view
  const gridWrap = document.createElement("div");
  gridWrap.className = "clips-grid-wrap";

  const gridHost = document.createElement("div");
  gridHost.className = "clips-grid";

  gridWrap.appendChild(gridHost);
  root.appendChild(gridWrap);

  try {
    const items = await loadClips();

    // Build the lightweight grid
    const reels = ReelsGrid({
      items,
      batchSize: 24,
      videoVolume: 0.25,
      thumbWidth: 240,
    });

    // Apply your grid class to the component’s inner grid for spacing and centering
    const inner = reels.querySelector(".reels-grid-inner");
    if (inner) inner.classList.add("clips-grid");

    // Force square tiles to match your centered square aesthetic
    reels.querySelectorAll<HTMLElement>(".reels-card").forEach((card) => {
      card.style.aspectRatio = "1 / 1";
    });

    // Replace host with the component
    gridHost.replaceWith(reels);

    // Done
    status.remove();
  } catch (err) {
    status.textContent = `Failed to load clips: ${
      err instanceof Error ? err.message : String(err)
    }`;
  }

  return root;
}
