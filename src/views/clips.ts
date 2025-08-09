export default function ClipsView(): HTMLElement {
  const env = (window as any).__ENV || {};
  const ok = !!(env.WORKER_BASE && env.OEMBED_ROUTE);
  const el = document.createElement("section");
  el.innerHTML = `
    <div class="card">
      <h2>Clips</h2>
      ${
        ok
          ? `<p>Proxy set. Curated Instagram oEmbed will load here in Slice 2.</p>`
          : `<p class="placeholder">Proxy URL missing. Add WORKER_BASE in <code>public/env.js</code> then reload.</p>`
      }
    </div>
  `;
  return el;
}
