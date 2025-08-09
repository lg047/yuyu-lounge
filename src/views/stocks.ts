const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"]; // can tune later for UK

export default function StocksView(): HTMLElement {
  const env = (window as any).__ENV || {};
  const ok = !!(env.WORKER_BASE && env.STOCKS_ROUTE);

  const el = document.createElement("section");
  el.innerHTML = `
    <div class="card">
      <h2>Happy Stocks</h2>
      <p>Enter tickers. We compute friendly optimistic metrics. No charts yet.</p>
      ${
        ok
          ? `<p class="badge">Proxy ready</p>`
          : `<p class="placeholder">Proxy URL missing. Add WORKER_BASE in <code>public/env.js</code>.</p>`
      }
      <form id="stocksForm" style="margin-top:10px;">
        <input id="tickersInput" placeholder="e.g. ${DEFAULT_TICKERS.join(", ")}"
               style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(0,0,0,0.1);" />
        <button style="margin-top:10px;" class="install" type="submit">Save</button>
      </form>
      <div id="stocksList" style="margin-top:10px;"></div>
    </div>
  `;

  const input = el.querySelector<HTMLInputElement>("#tickersInput")!;
  const list = el.querySelector<HTMLDivElement>("#stocksList")!;
  const saved = localStorage.getItem("roo.tickers");
  input.value = saved ? JSON.parse(saved).join(", ") : DEFAULT_TICKERS.join(", ");
  list.textContent = "Saved locally. Fetch logic arrives in Slice 3.";

  el.querySelector("form")!.addEventListener("submit", e => {
    e.preventDefault();
    const tickers = input.value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    localStorage.setItem("roo.tickers", JSON.stringify(tickers));
    list.textContent = `Saved: ${tickers.join(", ")}`;
  });

  return el;
}
