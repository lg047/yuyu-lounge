function t(){const e=window.__ENV||{},o=document.createElement("section");return o.innerHTML=`
    <div class="card">
      <h2>Settings</h2>
      <p><strong>Worker base</strong>: ${e.WORKER_BASE||"<span class='placeholder'>not set</span>"}</p>
      <ul>
        <li>LLM route: <code>${e.LLM_ROUTE||"/llm"}</code></li>
        <li>oEmbed route: <code>${e.OEMBED_ROUTE||"/oembed"}</code></li>
        <li>Stocks route: <code>${e.STOCKS_ROUTE||"/stocks"}</code></li>
      </ul>
      <p class="placeholder">Edit <code>public/env.js</code> to configure. Keys stay on the server.</p>
    </div>
  `,o}export{t as default};
