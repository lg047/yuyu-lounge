// src/views/happystocks.ts
// HappyStocks view. Vanilla TS. LocalStorage only. Offline safe with cache. iOS friendly height var.

type PortfolioItem = {
  symbol: string;
  name: string;
  qty: number;
  avgCost?: number;
  currency?: string;
};

type Series = {
  dates: number[];        // ms epoch for each daily point
  closes: number[];       // close price aligned with dates
  currency?: string;
  shortName?: string;
};

type CacheRecord = {
  ts: number;             // ms epoch when saved
  source: "yahoo" | "manual";
  data: Series;
};

const LS_PORTFOLIO = "happy:portfolio";
const PRICE_PREFIX = "happy:prices:";

export default function mountHappyStocks(root: HTMLElement) {
  // iOS friendly vh
  const setVh = () => {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
  };
  setVh();
  window.addEventListener("resize", setVh);
  window.addEventListener("orientationchange", setVh);

  root.innerHTML = ""; // clear

  const page = el("div", "happy page");
  const header = el("header", "happy-header");
  header.innerHTML = `
    <h1>HappyStocks <span class="shine">☆</span></h1>
    <p class="tag">Turn every market day into a win. Be cute. Be patient.</p>
  `;

  // Add form
  const form = el("form", "happy-form") as HTMLFormElement;
  form.innerHTML = `
    <label class="stack">
      <span>Ticker</span>
      <input type="text" name="symbol" placeholder="AAPL or ^GSPC" autocomplete="off" inputmode="latin" />
    </label>
    <label class="stack">
      <span>Qty</span>
      <input type="number" name="qty" step="0.0001" min="0" placeholder="1.0" />
    </label>
    <label class="stack">
      <span>Avg cost (optional)</span>
      <input type="number" name="avgCost" step="0.0001" min="0" placeholder="leave blank" />
    </label>
    <button type="submit" class="happy-btn">Add</button>
  `;

  const note = el("div", "happy-note"); // inline errors
  const spinner = el("div", "happy-spinner hidden");
  spinner.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;

  // Summary and list
  const summary = el("section", "happy-summary");
  const list = el("section", "happy-list");

  page.append(header, form, note, spinner, summary, list);
  root.appendChild(page);

  // Form handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    let raw = String(f.get("symbol") || "").trim().toUpperCase();
    const qty = Number(String(f.get("qty") || "0").trim());
    const avgCostRaw = String(f.get("avgCost") || "").trim();
    const avgCost = avgCostRaw === "" ? undefined : Number(avgCostRaw);

    if (!raw) return warn("Enter a ticker like AAPL or ^GSPC");
    if (!(qty > 0)) return warn("Qty must be greater than 0");

    showSpinner();
    try {
      // Try fetch name and currency via series meta
      const series = await getSeries(raw).catch(() => null);
      const name = series?.shortName || raw;
      const currency = series?.currency;

      const p = loadPortfolio();
      if (p.find((x) => x.symbol === raw)) {
        hideSpinner();
        return warn("Already in portfolio");
      }
      p.push({ symbol: raw, name, qty, avgCost, currency });
      savePortfolio(p);
      // Render row immediately using cached or fetched data
      await renderAll();
      (form.elements.namedItem("symbol") as HTMLInputElement).value = "";
      (form.elements.namedItem("qty") as HTMLInputElement).value = "";
      (form.elements.namedItem("avgCost") as HTMLInputElement).value = "";
      note.textContent = "";
    } finally {
      hideSpinner();
    }
  });

  // Initial render
  renderAll();

  // Helpers in scope
  function warn(msg: string) {
    note.textContent = msg;
  }
  function showSpinner() {
    spinner.classList.remove("hidden");
  }
  function hideSpinner() {
    spinner.classList.add("hidden");
  }

  async function renderAll() {
    const portfolio = loadPortfolio();
    list.innerHTML = "";
    summary.innerHTML = "";

    if (portfolio.length === 0) {
      summary.innerHTML = `<div class="card empty">Add your first holding to start the positivity</div>`;
      return;
    }

    // Load all series, prefer cache first so offline shows quickly, then refresh
    const rows: Array<{
      item: PortfolioItem;
      series: Series | null;
      lastPrice: number | null;
      cacheSource: "yahoo" | "manual" | "none";
    }> = [];

    for (const item of portfolio) {
      const cached = loadPriceCache(item.symbol);
      let s = cached?.data || null;
      let last = s && s.closes.length ? s.closes[s.closes.length - 1] : null;
      const src = cached?.source || "none";
      rows.push({ item, series: s, lastPrice: last, cacheSource: src });
    }

    // First paint from cache
    for (const r of rows) {
      renderRow(r);
    }
    renderSummary(rows);

    // Background refresh per symbol
    for (const r of rows) {
      try {
        const fresh = await getSeries(r.item.symbol);
        r.series = fresh;
        r.lastPrice = fresh.closes.length ? fresh.closes[fresh.closes.length - 1] : null;
        r.cacheSource = "yahoo";
        // Update card
        updateRow(r.item.symbol, r);
        renderSummary(rows);
      } catch {
        // Keep cached or manual flow
        if (!r.series) {
          // No cache. Ask manual once.
          const manual = await manualPriceFlow(r.item.symbol);
          if (manual) {
            r.series = manual;
            r.lastPrice = manual.closes[manual.closes.length - 1];
            r.cacheSource = "manual";
            updateRow(r.item.symbol, r);
            renderSummary(rows);
          }
        }
      }
    }
  }

  function renderSummary(rows: Array<{ item: PortfolioItem; series: Series | null; lastPrice: number | null; cacheSource: string }>) {
    // Value weights for combined metrics
    const weights: number[] = [];
    const closesMap: Record<string, number[]> = {};
    const lastMap: Record<string, number> = {};
    const items = rows.map((r) => r.item);

    rows.forEach((r) => {
      if (r.series && r.series.closes.length && r.lastPrice && r.item.qty > 0) {
        const value = r.item.qty * r.lastPrice;
        weights.push(value);
        closesMap[r.item.symbol] = r.series.closes.slice(-90);
        lastMap[r.item.symbol] = r.lastPrice;
      }
    });

    const totalValue = weights.reduce((a, b) => a + b, 0) || 1;

    // Weighted combine helpers
    const wavg = (vals: number[]) => {
      if (vals.length === 0 || weights.length === 0) return 0;
      let s = 0;
      for (let i = 0; i < vals.length; i++) s += vals[i] * (weights[i] || 0);
      return s / totalValue;
    };

    // Build virtual arrays aligned by index of holdings
    const greenRatios: number[] = [];
    const headrooms: number[] = [];
    const calmScores: number[] = [];
    const momentumUps: number[] = [];

    const streaks: number[] = [];

    const pnlPoss: number[] = [];

    const dcaPos: number[] = [];

    const syms = Object.keys(closesMap);
    syms.forEach((sym, idx) => {
      const closes = closesMap[sym];
      const last = lastMap[sym];
      greenRatios.push(num(greenRatio(closes)));
      headrooms.push(num(headroom(closes)));
      calmScores.push(num(calmness(closes)));
      momentumUps.push(num(momentumUp(closes)));
      streaks.push(bestStreakDays(closes));
      const it = rows.find((r) => r.item.symbol === sym)!.item;
      pnlPoss.push(num(Math.max(0, happyReturnPct(it.qty, it.avgCost, last))));
      dcaPos.push(num(Math.max(0, dcaPct(closes))));
    });

    const sumEl = el("div", "card summary-card");
    sumEl.innerHTML = `
      <h3>Portfolio glow</h3>
      <ul class="metrics">
        <li><span>Days your patience won</span><b>${fmtPct(wavg(greenRatios))}</b></li>
        <li><span>Headroom to next badge</span><b>${fmtPct(wavg(headrooms))}</b></li>
        <li><span>Best streak</span><b>${Math.max(...streaks, 0)} days in flow</b></li>
        <li><span>Happy return</span><b>${fmtPct(wavg(pnlPoss))}</b></li>
        <li><span>Calmness score</span><b>${fmtPct(wavg(calmScores))}</b></li>
        <li><span>DCA wizard</span><b>${wavg(dcaPos) > 0 ? fmtPct(wavg(dcaPos)) : "Projection ready"}</b></li>
        <li><span>Momentum sprinkle</span><b>${wavg(momentumUps) > 0 ? fmtPct(wavg(momentumUps)) : "Stable base"}</b></li>
      </ul>
    `;
    summary.innerHTML = "";
    summary.appendChild(sumEl);
  }

  function renderRow(r: { item: PortfolioItem; series: Series | null; lastPrice: number | null; cacheSource: string }) {
    const rowId = `row-${r.item.symbol}`;
    let card = document.getElementById(rowId) as HTMLDivElement | null;
    if (!card) {
      card = el("div", "card row") as HTMLDivElement;
      card.id = rowId;
      list.appendChild(card);
    }
    card.innerHTML = rowInnerHTML(r);
    // Sparkline
    const cvs = card.querySelector("canvas") as HTMLCanvasElement | null;
    if (cvs && r.series) drawSparkline(cvs, r.series.closes.slice(-90));
    // Delete
    const del = card.querySelector("button.del") as HTMLButtonElement | null;
    if (del) {
      del.onclick = () => {
        const p = loadPortfolio().filter((x) => x.symbol !== r.item.symbol);
        savePortfolio(p);
        card?.remove();
        // Refresh summary
        const rowsNow = Array.from(list.querySelectorAll(".row")).map(() => null); // ignore
        renderAll(); // simpler
      };
    }
  }

  function updateRow(symbol: string, r: { item: PortfolioItem; series: Series | null; lastPrice: number | null; cacheSource: string }) {
    const card = document.getElementById(`row-${symbol}`) as HTMLDivElement | null;
    if (!card) return;
    card.innerHTML = rowInnerHTML(r);
    const cvs = card.querySelector("canvas") as HTMLCanvasElement | null;
    if (cvs && r.series) drawSparkline(cvs, r.series.closes.slice(-90));
    const del = card.querySelector("button.del") as HTMLButtonElement | null;
    if (del) {
      del.onclick = () => {
        const p = loadPortfolio().filter((x) => x.symbol !== r.item.symbol);
        savePortfolio(p);
        card?.remove();
        renderAll();
      };
    }
  }

  function rowInnerHTML(r: { item: PortfolioItem; series: Series | null; lastPrice: number | null; cacheSource: string }) {
    const s = r.series;
    const closes = s?.closes || [];
    const last = r.lastPrice || 0;
    const name = r.item.name || r.item.symbol;
    const cur = r.item.currency || s?.currency || "";
    const qty = r.item.qty || 0;
    const pnlPct = Math.max(0, happyReturnPct(qty, r.item.avgCost, last));

    const M = buildMetrics(closes, qty, r.item.avgCost, last);

    const cacheTag = r.cacheSource === "manual" ? `<span class="chip manual">manual</span>` :
                     r.cacheSource === "yahoo" ? `<span class="chip">live</span>` : `<span class="chip off">cache</span>`;

    return `
      <div class="row-head">
        <div class="id">
          <b class="sym">${r.item.symbol}</b>
          <span class="nm">${esc(name)}</span>
          ${cacheTag}
        </div>
        <div class="price">
          ${last ? `<b>${fmtPrice(last, cur)}</b>` : `<i>price soon</i>`}
          ${qty ? `<span class="sub">${qty} units</span>` : ``}
        </div>
      </div>
      <div class="row-body">
        <canvas class="spark" width="80" height="20"></canvas>
        <ul class="metrics">
          <li><span>${M.green.label}</span><b>${M.green.value}</b></li>
          <li><span>${M.headroom.label}</span><b>${M.headroom.value}</b></li>
          <li><span>${M.streak.label}</span><b>${M.streak.value}</b></li>
          <li><span>${M.happy.label}</span><b>${M.happy.value}</b></li>
          <li><span>${M.calm.label}</span><b>${M.calm.value}</b></li>
          <li><span>${M.dca.label}</span><b>${M.dca.value}</b></li>
          <li><span>${M.momo.label}</span><b>${M.momo.value}</b></li>
        </ul>
        <div class="actions">
          <button class="del" title="Delete">✕</button>
        </div>
      </div>
    `;
  }

  // Storage
  function loadPortfolio(): PortfolioItem[] {
    try {
      const s = localStorage.getItem(LS_PORTFOLIO);
      if (!s) return [];
      const arr = JSON.parse(s);
      if (!Array.isArray(arr)) return [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  }
  function savePortfolio(p: PortfolioItem[]) {
    localStorage.setItem(LS_PORTFOLIO, JSON.stringify(p));
  }

  // Price cache
  function loadPriceCache(symbol: string): CacheRecord | null {
    try {
      const raw = localStorage.getItem(PRICE_PREFIX + symbol);
      if (!raw) return null;
      return JSON.parse(raw) as CacheRecord;
    } catch {
      return null;
    }
  }
  function savePriceCache(symbol: string, rec: CacheRecord) {
    localStorage.setItem(PRICE_PREFIX + symbol, JSON.stringify(rec));
  }

  // Yahoo series
  async function getSeries(symbol: string): Promise<Series> {
    const enc = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?range=1y&interval=1d`;
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    const j = await res.json();
    const result = j?.chart?.result?.[0];
    if (!result) throw new Error("no result");
    const ts: number[] = (result.timestamp || []).map((t: number) => t * 1000);
    const close: number[] = result.indicators?.quote?.[0]?.close || [];
    const shortName: string | undefined = result.meta?.shortName;
    const currency: string | undefined = result.meta?.currency;
    // Clean NaNs
    const dates: number[] = [];
    const closes: number[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = close[i];
      if (typeof c === "number" && isFinite(c)) {
        dates.push(ts[i]);
        closes.push(c);
      }
    }
    if (!closes.length) throw new Error("empty series");
    const data: Series = { dates, closes, currency, shortName };
    savePriceCache(symbol, { ts: Date.now(), source: "yahoo", data });
    return data;
  }

  async function manualPriceFlow(symbol: string): Promise<Series | null> {
    const modal = buildManualModal(symbol);
    page.appendChild(modal.wrap);
    const result = await modal.promise;
    modal.cleanup();
    if (!result) return null;
    // Build 30 flat points ending now
    const now = Date.now();
    const n = 30;
    const dates = Array.from({ length: n }, (_, i) => now - (n - 1 - i) * 86400000);
    const closes = Array(n).fill(result.price);
    const data: Series = { dates, closes, currency: result.currency || undefined, shortName: symbol };
    savePriceCache(symbol, { ts: Date.now(), source: "manual", data });
    return data;
  }

  function buildManualModal(symbol: string) {
    const wrap = el("div", "happy-modal-wrap");
    const box = el("div", "happy-modal");
    box.innerHTML = `
      <h4>Enter price for ${esc(symbol)}</h4>
      <label class="stack">
        <span>Price</span>
        <input type="number" step="0.0001" min="0" placeholder="123.45" />
      </label>
      <label class="stack">
        <span>Currency (optional)</span>
        <input type="text" maxlength="8" placeholder="USD or GBP" />
      </label>
      <div class="row gap">
        <button class="happy-btn">Save</button>
        <button class="happy-btn ghost">Cancel</button>
      </div>
    `;
    wrap.appendChild(box);

    let ok!: (v: { price: number; currency?: string } | null) => void;
    const promise = new Promise<{ price: number; currency?: string } | null>((res) => (ok = res));

    const priceEl = box.querySelector("input[type=number]") as HTMLInputElement;
    const curEl = box.querySelector("input[type=text]") as HTMLInputElement;
    const saveBtn = box.querySelector(".happy-btn") as HTMLButtonElement;
    const cancelBtn = box.querySelector(".ghost") as HTMLButtonElement;

    const done = () => {
      wrap.remove();
    };

    saveBtn.onclick = () => {
      const v = Number(priceEl.value);
      if (!(v > 0)) return;
      ok({ price: v, currency: curEl.value.trim() || undefined });
      done();
    };
    cancelBtn.onclick = () => {
      ok(null);
      done();
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) {
        ok(null);
        done();
      }
    });
    return { wrap, promise, cleanup: done };
  }

  // Positivity engine
  function buildMetrics(closes: number[], qty: number, avgCost: number | undefined, last: number) {
    const green = computeGreenRatio(closes);
    const headroomM = computeHeadroom(closes);
    const streak = computeBestStreak(closes);
    const happy = computeHappyReturn(qty, avgCost, last);
    const calm = computeCalmness(closes);
    const dca = computeDCA(closes);
    const momo = computeMomentum(closes);
    return { green, headroom: headroomM, streak, happy, calm, dca, momo };
  }

  function computeGreenRatio(closes: number[]) {
    const r = greenRatio(closes);
    return { label: "Days your patience won", value: fmtPct(r) };
  }
  function computeHeadroom(closes: number[]) {
    const r = headroom(closes);
    return { label: "Headroom to next badge", value: fmtPct(r) };
  }
  function computeBestStreak(closes: number[]) {
    const d = bestStreakDays(closes);
    return { label: "Best streak", value: `${d} days in flow` };
  }
  function computeHappyReturn(qty: number, avgCost: number | undefined, last: number) {
    const r = Math.max(0, happyReturnPct(qty, avgCost, last));
    return { label: "Happy return", value: fmtPct(r) };
  }
  function computeCalmness(closes: number[]) {
    const r = calmness(closes);
    return { label: "Calmness score", value: fmtPct(r) };
  }
  function computeDCA(closes: number[]) {
    const r = dcaPct(closes);
    return { label: "DCA wizard", value: r > 0 ? fmtPct(r) : "Projection ready" };
  }
  function computeMomentum(closes: number[]) {
    const r = momentumUp(closes);
    return { label: "Momentum sprinkle", value: r > 0 ? fmtPct(r) : "Stable base" };
  }

  // Metric math
  function greenRatio(closes: number[]) {
    if (closes.length < 2) return 0;
    let up = 0, n = 0;
    for (let i = 1; i < Math.min(closes.length, 90); i++) {
      if (closes[i] != null && closes[i - 1] != null) {
        if (closes[i] > closes[i - 1]) up++;
        n++;
      }
    }
    return clamp((up / Math.max(1, n)) * 100, 0, 100);
  }
  function headroom(closes: number[]) {
    if (!closes.length) return 0;
    const last = closes[closes.length - 1];
    const maxC = Math.max(...closes);
    if (maxC <= 0) return 0;
    const gap = Math.max(0, maxC - last);
    return clamp((gap / maxC) * 100, 0, 100);
  }
  function bestStreakDays(closes: number[]) {
    if (closes.length < 2) return 0;
    let best = 0, cur = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }
  function happyReturnPct(qty: number, avgCost: number | undefined, last: number) {
    if (!(qty > 0) || !(avgCost && avgCost > 0) || !(last > 0)) return 0;
    const cost = qty * avgCost;
    const val = qty * last;
    const pct = ((val - cost) / cost) * 100;
    return pct;
  }
  function calmness(closes: number[]) {
    if (closes.length < 2) return 100;
    const rets: number[] = [];
    for (let i = 1; i < Math.min(closes.length, 90); i++) {
      const a = closes[i - 1], b = closes[i];
      if (a > 0 && b > 0) rets.push((b - a) / a);
    }
    if (!rets.length) return 100;
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const v = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length;
    const sd = Math.sqrt(v);
    // Map sd to 0..100. 3 percent daily sd -> 0. tiny sd -> near 100
    const score = 100 * (1 - clamp(sd / 0.03, 0, 1));
    return clamp(score, 0, 100);
  }
  function dcaPct(closes: number[]) {
    if (closes.length < 30) return 0;
    // last 26 weeks, take one point per 7 days index
    const sample: number[] = [];
    for (let i = Math.max(0, closes.length - 26 * 5); i < closes.length; i += 5) {
      if (typeof closes[i] === "number") sample.push(closes[i]);
    }
    if (sample.length < 4) return 0;
    const pay = sample.length; // invest 1 unit each time
    const units = sample.reduce((u, p) => (p > 0 ? u + 1 / p : u), 0);
    const avg = pay / Math.max(1e-9, units);
    const last = closes[closes.length - 1];
    if (!(last > 0 && avg > 0)) return 0;
    const pct = ((last - avg) / avg) * 100;
    return pct;
  }
  function momentumUp(closes: number[]) {
    if (closes.length < 6) return 0;
    const tail = closes.slice(-5);
    const a = tail[0], b = tail[tail.length - 1];
    if (!(a > 0)) return 0;
    const pct = ((b - a) / a) * 100;
    return Math.max(0, pct);
  }

  // Sparkline
  function drawSparkline(cvs: HTMLCanvasElement, data: number[]) {
    const cssW = 80, cssH = 20;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    cvs.style.width = cssW + "px";
    cvs.style.height = cssH + "px";
    cvs.width = cssW * dpr;
    cvs.height = cssH * dpr;
    const ctx = cvs.getContext("2d");
    if (!ctx || data.length < 2) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const n = data.length;
    const pad = 1 * dpr;

    ctx.lineWidth = 1 * dpr;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.strokeStyle = getComputedStyle(cvs).getPropertyValue("--happy-ink").trim() || "#fff";

    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = pad + ((cvs.width - 2 * pad) * i) / (n - 1);
      const y = pad + (cvs.height - 2 * pad) * (1 - (data[i] - min) / range);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // DOM util
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    return x;
  }
  function esc(s: string) {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  }
  function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
  }
  function fmtPct(v: number) {
    if (!isFinite(v)) return "0%";
    return `${Math.round(v)}%`;
  }
  function fmtPrice(v: number, cur?: string) {
    const s = v >= 100 ? v.toFixed(2) : v >= 10 ? v.toFixed(3) : v.toFixed(4);
    return cur ? `${s} ${cur}` : s;
  }
  function num(v: number) {
    return isFinite(v) ? v : 0;
  }
}
