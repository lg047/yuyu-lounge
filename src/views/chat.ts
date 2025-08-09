// Roo Chat view placeholder. Real chat wires to Worker later.
const POM_NAME = "Mochi"; // chubby white pom with tongue out

export default function ChatView(): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = `
    <div class="card">
      <h2>Roo Chat</h2>
      <p class="placeholder">Chat connects to your Worker later. Short British replies. Safe.</p>
      <p class="badge">Roo is curious, upbeat, gentle.</p>
      <p>Say hello to ${POM_NAME} while I set things up.</p>
      <img alt="${POM_NAME}" style="width:96px; aspect-ratio:1; border-radius:14px;"
           src="/yuyu-lounge/icons/icon.svg"/>
    </div>
  `;
  return el;
}
