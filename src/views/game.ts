// Placeholder. Phaser scene arrives in Slice 5. Lazy loaded already via router.
export default function GameView(): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = `
    <div class="card">
      <h2>Mini Game</h2>
      <p class="placeholder">Micro game loads here later. Tap to fetch treats for Mochi.</p>
    </div>
  `;
  return el;
}
