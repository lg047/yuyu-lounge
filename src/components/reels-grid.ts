// src/components/reels-grid.ts
type ReelItem = {
  src: string;
  poster?: string;
  title?: string;
};

type ReelsGridProps = {
  items: ReelItem[];
  batchSize?: number;
  videoVolume?: number;   // set once on first play
  thumbWidth?: number;    // px, used for responsive min size
};

function derivePoster(src: string): { primary: string; fallback: string } {
  // Replace the final ".mp4" with ".jpg" then ".webp" as fallback.
  const base = src.replace(/\.mp4(\?.*)?$/i, "");
  return {
    primary: `${base}.jpg`,
    fallback: `${base}.webp`,
  };
}

function makeSpinner(): HTMLElement {
  const s = document.createElement("div");
  s.className = "reels-spinner";
  s.setAttribute("aria-hidden", "true");
  return s;
}

function makePosterImage(item: ReelItem): HTMLImageElement {
  const img = new Image();
  const { primary, fallback } = derivePoster(item.src);
  img.loading = "lazy";
  img.decoding = "async";
  img.alt = item.title ?? "video poster";
  img.className = "reels-poster";

  // Select poster URL or derive with fallback
  const chosen = item.poster ?? primary;
  img.src = chosen;

  img.onerror = () => {
    if (img.src !== fallback && !item.poster) {
      img.src = fallback;
    } else {
      // give up: allow patterned background to show
      img.remove();
    }
  };

  return img;
}

function createVideoNode(src: string, controls = true): HTMLVideoElement {
  const v = document.createElement("video");
  v.src = src;
  v.controls = controls;
  v.preload = "auto";
  v.playsInline = true;
  v.setAttribute("playsinline", "true");
  v.setAttribute("webkit-playsinline", "true");
  v.className = "reels-video";
  return v;
}

export default function ReelsGrid(props: ReelsGridProps): HTMLElement {
  const { items, batchSize = 24, videoVolume = 0.25, thumbWidth = 240 } = props;

  const root = document.createElement("div");
  root.className = "reels-grid";
  root.style.setProperty("--reels-thumb-w", `${thumbWidth}px`);

  const grid = document.createElement("div");
  grid.className = "reels-grid-inner";
  root.appendChild(grid);

  // Sentinel for batch loading
  const sentinel = document.createElement("div");
  sentinel.className = "reels-sentinel";
  root.appendChild(sentinel);

  let rendered = 0;
  const volumeSet = new WeakSet<HTMLVideoElement>();

  function attachVideoEvents(v: HTMLVideoElement, spinner: HTMLElement) {
    const show = () => spinner.classList.add("show");
    const hide = () => spinner.classList.remove("show");

    v.addEventListener("waiting", show);
    v.addEventListener("seeking", show);
    v.addEventListener("canplay", hide);
    v.addEventListener("playing", hide);
    v.addEventListener("pause", hide);
    v.addEventListener("ended", hide);

    // First play: set volume once
    const onFirstPlay = () => {
      if (!volumeSet.has(v)) {
        try {
          v.volume = Math.max(0, Math.min(1, videoVolume));
        } catch (_) {
          /* ignore */
        }
        volumeSet.add(v);
      }
      v.removeEventListener("play", onFirstPlay);
    };
    v.addEventListener("play", onFirstPlay);
  }

  function createCard(item: ReelItem): HTMLElement {
    const card = document.createElement("article");
    card.className = "reels-card";
    // Reserve aspect ratio to avoid layout shift; Reels are usually 9:16
    card.style.aspectRatio = "9 / 16";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reels-thumb";
    btn.title = item.title ?? "Play";
    btn.setAttribute("aria-label", item.title ? `Play ${item.title}` : "Play");

    const posterImg = makePosterImage(item);
    if (posterImg) btn.appendChild(posterImg);

    const spinner = makeSpinner();
    btn.appendChild(spinner);

    // Click swaps to <video>
    btn.addEventListener("click", async () => {
      // Create video only on demand
      const v = createVideoNode(item.src, true);
      attachVideoEvents(v, spinner);

      // Start spinner until canplay/playing
      spinner.classList.add("show");

      // Replace button with video without changing layout
      btn.replaceWith(v);

      try {
        // iOS may require a user gesture; this is inside a click handler
        await v.play();
      } catch {
        // If autoplay with sound is blocked, user can press play
        // Spinner remains until canplay/playing; hide on pause error as well
        spinner.classList.remove("show");
      }
    });

    card.appendChild(btn);
    return card;
  }

  function renderNextBatch() {
    const target = Math.min(items.length, rendered + batchSize);
    for (; rendered < target; rendered++) {
      const node = createCard(items[rendered]);
      grid.appendChild(node);
    }
  }

  // Initial batch
  renderNextBatch();

  // IO for infinite scroll
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          renderNextBatch();
          // If all rendered, stop observing
          if (rendered >= items.length) {
            io.disconnect();
            sentinel.remove();
          }
        }
      }
    },
    { root: null, rootMargin: "1200px 0px", threshold: 0 }
  );
  io.observe(sentinel);

  return root;
}
