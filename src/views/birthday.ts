// src/views/birthday.ts
export default function BirthdayView(): HTMLElement {
  const root = document.createElement("div");
  root.className = "birthday-view";
  root.setAttribute("data-view", "birthday");

  // inline styles so you do not need to touch global CSS
  const style = document.createElement("style");
  style.textContent = `
    .birthday-view {
      min-height: 100vh;
      box-sizing: border-box;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 20% 10%, rgba(255, 235, 245, 0.9), transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(230, 255, 250, 0.9), transparent 50%),
        radial-gradient(circle at 30% 80%, rgba(255, 245, 230, 0.9), transparent 50%),
        var(--bg, #ffd1e8);
      overflow: hidden;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      text-align: center;
    }
    .b-card {
      position: relative;
      width: min(900px, 92vw);
      border-radius: 24px;
      padding: 28px 24px 36px;
      background: rgba(255,255,255,0.70);
      backdrop-filter: blur(6px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.12), inset 0 0 0 2px rgba(255,255,255,0.65);
    }
    .b-title {
      font-size: clamp(28px, 6vw, 56px);
      margin: 6px 0 12px;
      line-height: 1.1;
    }
    .b-sub {
      font-size: clamp(16px, 3.4vw, 22px);
      opacity: 0.9;
      margin: 0 0 16px;
    }
    .emoji-row {
      font-size: clamp(20px, 5vw, 40px);
      line-height: 1.2;
      margin: 8px 0;
      user-select: none;
    }
    .balloons {
      position: absolute;
      inset: -20px -10px -20px -10px;
      pointer-events: none;
      overflow: hidden;
    }
    .balloon {
      position: absolute;
      bottom: -120px;
      font-size: clamp(24px, 6vw, 48px);
      animation: rise 12s linear infinite;
      filter: drop-shadow(0 6px 6px rgba(0,0,0,0.15));
    }
    @keyframes rise {
      0%   { transform: translateY(0)     rotate(0deg);   opacity: 0; }
      5%   { opacity: 1; }
      100% { transform: translateY(-120vh) rotate(15deg); opacity: 1; }
    }
    .sparkle {
      position: absolute;
      inset: 0;
      pointer-events: none;
      mask-image: radial-gradient(circle at center, #000 40%, transparent 75%);
    }
    .b-footer {
      margin-top: 16px;
      font-size: 14px;
      opacity: 0.7;
    }
    .cta {
      margin-top: 14px;
      font-size: 16px;
      padding: 10px 16px;
      border-radius: 12px;
      background: var(--pink-mid, #ff8ec3);
      color: #1b1020;
      border: none;
      cursor: pointer;
    }
    canvas.confetti {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `;
  root.appendChild(style);

  // card
  const card = document.createElement("div");
  card.className = "b-card";

  // content
  card.innerHTML = `
    <div class="emoji-row" aria-hidden="true">
      🎉🎈🎊🥳✨🎁🎂🍰🧁🍓🍾🌟💖🎵🎶
    </div>
    <h1 class="b-title">Happy Birthday, Yuyu! 🎂🎉🎈</h1>
    <p class="b-sub">
      Wishing you a day full of cake, music, and ridiculous amounts of joy
      ✨🎁🥳🧁🍰🎊
    </p>

    <div class="emoji-row" aria-hidden="true">🎂🍰🧁🍓🍫🍬🍭🍮🍧</div>
    <div class="emoji-row" aria-hidden="true">🎈🎈🎈🎈🎈 🎈🎈🎈🎈🎈</div>
    <div class="emoji-row" aria-hidden="true">🎉🎉🎉🎉🎉 🎉🎉🎉🎉🎉</div>

    <button class="cta" type="button">More confetti ✨</button>
    <div class="b-footer">Made with love at Yuyu Lounge 💖</div>

    <div class="balloons" aria-hidden="true"></div>
    <div class="sparkle" aria-hidden="true">✨</div>
  `;
  root.appendChild(card);

  // balloons
  const balloons = card.querySelector(".balloons") as HTMLDivElement;
  const balloonEmoji = "🎈";
  for (let i = 0; i < 22; i++) {
    const b = document.createElement("div");
    b.className = "balloon";
    b.textContent = balloonEmoji;
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDelay = `${Math.random() * 12}s`;
    b.style.filter = `hue-rotate(${Math.floor(Math.random() * 360)}deg) drop-shadow(0 6px 6px rgba(0,0,0,0.15))`;
    balloons.appendChild(b);
  }

  // confetti
  const cleanup = startConfetti(card);
  const btn = card.querySelector(".cta") as HTMLButtonElement;
  btn?.addEventListener("click", () => {
    startConfetti(card, 600, 1400);
  });

  // clean up when leaving the route
  const onHash = () => {
    if (!location.hash.startsWith("#/birthday")) {
      cleanup();
      window.removeEventListener("hashchange", onHash);
    }
  };
  window.addEventListener("hashchange", onHash);

  return root;
}

/** tiny canvas confetti with rectangles */
function startConfetti(container: HTMLElement, n = 350, durationMs = 12000): () => void {
  const c = document.createElement("canvas");
  c.className = "confetti";
  container.appendChild(c);
  const ctx = c.getContext("2d")!;
  let W = 0, H = 0;
  const resize = () => {
    const r = container.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));
    c.width = W;
    c.height = H;
  };
  resize();

  const colors = [
    "#ff4fa3","#ff8ec3","#ffd166","#06d6a0","#118ab2","#ef476f","#caa8ff","#fff6fb"
  ];
  type P = { x:number; y:number; vx:number; vy:number; w:number; h:number; a:number; rot:number; vr:number; col:string; };
  const parts: P[] = Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H,
    vx: -1 + Math.random() * 2,
    vy: 2 + Math.random() * 2.5,
    w: 3 + Math.random() * 6,
    h: 6 + Math.random() * 10,
    a: 0.6 + Math.random() * 0.4,
    rot: Math.random() * Math.PI,
    vr: (-0.05 + Math.random() * 0.1),
    col: colors[(Math.random() * colors.length) | 0],
  }));

  let raf = 0;
  let running = true;
  const g = 0.045;
  const wind = 0.004;

  const draw = () => {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx + wind * (Math.sin(p.y * 0.01));
      p.y += p.vy;
      p.vy += g;
      p.rot += p.vr;

      if (p.y > H + 30) {
        // recycle to top
        p.x = Math.random() * W;
        p.y = -20 - Math.random() * 60;
        p.vy = 2 + Math.random() * 2.5;
      }

      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  const stopAt = Date.now() + durationMs;
  const timer = window.setInterval(() => {
    if (Date.now() >= stopAt) {
      cleanup();
    }
  }, 500);

  function cleanup() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    window.clearInterval(timer);
    c.remove();
  }
  return cleanup;
}
