// Slice 2 – Instagram feed via oEmbed proxy

const PLACEHOLDER_URLS = [
  "https://www.instagram.com/reel/DM-wYaNuJd1/?utm_source=ig_web_copy_link&igsh=MWU2d2V0eXc2ZHA5NA==",
  "https://www.instagram.com/reel/DMiW4HHOeSW/?utm_source=ig_web_copy_link&igsh=MW55anU2em55dWVnaw==",
  "https://www.instagram.com/reel/DMh0GoFJdAO/?utm_source=ig_web_copy_link&igsh=NnFmaW1ueno2M212",
  "https://www.instagram.com/reel/DKwioczJn5p/?utm_source=ig_web_copy_link&igsh=bnJodnl0Nnhoa2Vt",
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
  const env = (window as any).__ENV || {};
  const ok = !!(env.WORKER_BASE && env.OEMBED_ROUTE);

  const el = document.createElement("section");
  el.innerHTML = `<h2 style="margin-bottom:10px;">Clips</h2>`;

  if (!ok) {
    const card = document.createElement("div");
    card.className = "card placeholder";
    card.innerHTML = `
      <p>Proxy URL missing. Add <code>WORKER_BASE</code> and <code>OEMBED_ROUTE</code> in <code>public/env.js</code>, then reload.</p>
    `;
    el.appendChild(card);
    return el;
  }

  const shuffled = shuffle(PLACEHOLDER_URLS);

  shuffled.forEach((url) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "14px";
    card.innerHTML = `<p class="placeholder">Loading clip...</p>`;
    el.appendChild(card);

    // Lazy-load each embed
    fetch(`${env.WORKER_BASE}${env.OEMBED_ROUTE}?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.html) {
          card.innerHTML = data.html;
          // Ensure Instagram embed script runs
          if (typeof window.instgrm === "undefined") {
            const s = document.createElement("script");
            s.src = "https://www.instagram.com/embed.js";
            s.async = true;
            document.body.appendChild(s);
          } else {
            window.instgrm.Embeds.process();
          }
        } else {
          card.innerHTML = `<p class="placeholder">Failed to load clip.</p>`;
        }
      })
      .catch(() => {
        card.innerHTML = `<p class="placeholder">Error fetching clip.</p>`;
      });
  });

  return el;
}
