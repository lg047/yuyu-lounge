export default function SettingsView(): HTMLElement {
  const env = (window as any).__ENV || {};
  const el = document.createElement("section");
  el.innerHTML = `
    <div class="card">
      <h2>Settings</h2>
      <p><strong>Worker base</strong>: ${env.WORKER_BASE || "<span class='placeholder'>not set</span>"}</p>
      <ul>
        <li>LLM route: <code>${env.LLM_ROUTE || "/llm"}</code></li>
        <li>oEmbed route: <code>${env.OEMBED_ROUTE || "/oembed"}</code></li>
        <li>Stocks route: <code>${env.STOCKS_ROUTE || "/stocks"}</code></li>
      </ul>
      <p class="placeholder">Edit <code>public/env.js</code> to configure. Keys stay on the server.</p>
    </div>
  `;
  return el;
}
