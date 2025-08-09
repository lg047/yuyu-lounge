const n=["AAPL","MSFT","NVDA"];function p(){const e=window.__ENV||{},c=!!(e.WORKER_BASE&&e.STOCKS_ROUTE),t=document.createElement("section");t.innerHTML=`
    <div class="card">
      <h2>Happy Stocks</h2>
      <p>Enter tickers. We compute friendly optimistic metrics. No charts yet.</p>
      ${c?'<p class="badge">Proxy ready</p>':'<p class="placeholder">Proxy URL missing. Add WORKER_BASE in <code>public/env.js</code>.</p>'}
      <form id="stocksForm" style="margin-top:10px;">
        <input id="tickersInput" placeholder="e.g. ${n.join(", ")}"
               style="width:100%; padding:10px; border-radius:10px; border:1px solid rgba(0,0,0,0.1);" />
        <button style="margin-top:10px;" class="install" type="submit">Save</button>
      </form>
      <div id="stocksList" style="margin-top:10px;"></div>
    </div>
  `;const o=t.querySelector("#tickersInput"),s=t.querySelector("#stocksList"),i=localStorage.getItem("roo.tickers");return o.value=i?JSON.parse(i).join(", "):n.join(", "),s.textContent="Saved locally. Fetch logic arrives in Slice 3.",t.querySelector("form").addEventListener("submit",a=>{a.preventDefault();const r=o.value.split(",").map(l=>l.trim().toUpperCase()).filter(Boolean);localStorage.setItem("roo.tickers",JSON.stringify(r)),s.textContent=`Saved: ${r.join(", ")}`}),t}export{p as default};
