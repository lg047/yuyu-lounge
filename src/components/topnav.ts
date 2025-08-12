export default function TopNav(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const items = [
    { label: "Reels", href: "#/reels", id: "nav-reels" },
    { label: "Chat", href: "#/chat", id: "nav-chat" },
    { label: "HappyStocks", href: "#/happystocks", id: "nav-stocks" }, // fixed
    { label: "Arcade", href: "#/game", id: "nav-game" },
  ];
// src/components/topnav.ts  (add one link)
  export default function TopNav(): HTMLElement {
    const el = document.createElement("nav");
    el.className = "topnav";
    el.innerHTML = `
      <a href="#/" class="nav-link">Home</a>
      <!-- existing links -->
      <a href="#/tv" class="nav-link">TV</a>
    `;
    return el;
  }

  return frag;
}
