// Instagram feed without API.
// Just paste public post URLs into CLIPS and they will embed.
// Order is randomised each load.

const CLIPS: string[] = [
  "https://www.instagram.com/reel/DM-wYaNuJd1/?utm_source=ig_web_copy_link&igsh=MWU2d2V0eXc2ZHA5NA==",
  "https://www.instagram.com/reel/DMiW4HHOeSW/?utm_source=ig_web_copy_link&igsh=MW55anU2em55dWVnaw==",
  "https://www.instagram.com/reel/DMh0GoFJdAO/?utm_source=ig_web_copy_link&igsh=NnFmaW1ueno2M212",
  "https://www.instagram.com/reel/DKwioczJn5p/?utm_source=ig_web_copy_link&igsh=bnJodnl0Nnhoa2Vt"
];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ClipsView(): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = `<h2 style="margin-bottom:10px;">Clips</h2>`;

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gap = "14px";
  grid.style.gridTemplateColumns = "1fr";
  const mq = window.matchMedia("(min-width: 640px)");
  const setCols = () => grid.style.gridTemplateColumns = mq.matches ? "1fr 1fr" : "1fr";
  setCols(); mq.addEventListener("change", setCols);

  el.appendChild(grid);

  const shuffled = shuffle(CLIPS);

  shuffled.forEach(url => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14" style="background:#fff; min-height:200px; border-radius:12px;"></blockquote>
    `;
    grid.appendChild(card);
  });

  // Load Instagram embed.js script
  const ensureScript = () => {
    if (typeof (window as any).instgrm === "undefined") {
      const s = document.createElement("script");
      s.src = "https://www.instagram.com/embed.js";
      s.async = true;
      document.body.appendChild(s);
    } else {
      (window as any).instgrm.Embeds.process();
    }
  };
  setTimeout(ensureScript, 0);

  return el;
}
