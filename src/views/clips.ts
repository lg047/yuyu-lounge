// clips.ts
// Fetch MP4 URLs from /clips.json and render a responsive video grid.

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadClips(): Promise<string[]> {
  // Resolve to correct base path in dev and production (GitHub Pages)
  const base = import.meta.env.BASE_URL || "/";
  const res = await fetch(`${base}clips.json`, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`fetch ${base}clips.json failed: ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("clips.json is not an array");
  }
  return (data as unknown[])
    .map(String)
    .filter(u => /\.mp4(\?|$)/i.test(u));
}


function makeGrid(): HTMLDivElement {
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gap = "14px";
  grid.style.gridTemplateColumns = "1fr";
  const mq = window.matchMedia("(min-width: 640px)");
  const setCols = () => {
    grid.style.gridTemplateColumns = mq.matches ? "1fr 1fr" : "1fr";
  };
  setCols();
  mq.addEventListener("change", setCols);
  return grid;
}

function wireAutoplay(video: HTMLVideoElement) {
  video.muted = true;
  video.playsInline = true;
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          void video.play();
        } else {
          video.pause();
        }
      }
    },
    { threshold: 0.6 }
  );
  io.observe(video);
}

export default function ClipsView(): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = `<h2 style="margin-bottom:10px;">Clips</h2>`;

  const status = document.createElement("div");
  status.textContent = "Loading…";
  status.style.opacity = "0.7";

  const grid = makeGrid();
  el.appendChild(status);
  el.appendChild(grid);

  loadClips()
    .then(urls => {
      status.remove();
      const shuffled = shuffle(urls);
      shuffled.forEach(url => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.borderRadius = "12px";
        card.style.overflow = "hidden";
        card.style.background = "#000";

        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.loop = true;
        video.preload = "metadata";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.display = "block";
        video.setAttribute("aria-label", "Clip");

        wireAutoplay(video);

        card.appendChild(video);
        grid.appendChild(card);
      });
    })
    .catch(err => {
      status.textContent = `Failed to load clips: ${
        err instanceof Error ? err.message : String(err)
      }`;
    });

  return el;
}
