// src/lib/loader.ts
let fakeTimer: number | null = null;

function els() {
  const loader = document.getElementById("loading-screen") as HTMLDivElement | null;
  const msgEl = loader?.querySelector<HTMLDivElement>(".loading-text") ?? null;
  const fill  = loader?.querySelector<HTMLDivElement>(".loading-bar-fill") ?? null;
  const app   = document.getElementById("app") as HTMLDivElement | null;
  return { loader, msgEl, fill, app };
}

export function showLoader(message = "Loading…", opts: { hideApp?: boolean } = {}): void {
  const { loader, msgEl, fill, app } = els();
  if (!loader || !fill) return;

  // Temporarily disable CSS transition so bar snaps to 0%
  fill.style.transition = "none";
  fill.style.width = "0%";

  loader.style.display = "flex";
  loader.style.opacity = "1";
  loader.style.pointerEvents = "auto";

  if (opts.hideApp && app) app.style.visibility = "hidden";
  if (msgEl) msgEl.textContent = message;

  // Force reflow to apply width before re-enabling transition
  void fill.offsetWidth;
  fill.style.transition = ""; // restore to CSS default

  if (fakeTimer) window.clearInterval(fakeTimer);
  let progress = 0;
  fakeTimer = window.setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 95);
    fill.style.width = `${progress}%`;
  }, 200);
}


export function hideLoader(): void {
  const { loader, fill, app } = els();
  if (!loader || !fill) return;

  if (fakeTimer) {
    window.clearInterval(fakeTimer);
    fakeTimer = null;
  }
  fill.style.width = "100%";

  window.setTimeout(() => {
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    loader.style.display = "none";
    if (app) app.style.visibility = "visible";
  }, 400);
}

export function messageForPath(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("/tv")) return "Loading your living room...";
  if (p.includes("/arcade")) return "Loading arcade...";
  if (p.includes("/chat")) return "Loading chat...";
  if (p.includes("/reels") || p.includes("/clips")) return "Loading reels...";
  return "Loading…";
}
