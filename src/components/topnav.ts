export default function TopNav(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const items = [
    { label: "Reels", href: "#/reels", id: "nav-reels" },
    { label: "Roo Chat", href: "#/chat", id: "nav-chat" },
    { label: "Happy Stocks", href: "#/stocks", id: "nav-stocks" },
    { label: "Mini Game", href: "#/game", id: "nav-game" },
    { label: "Settings", href: "#/settings", id: "nav-settings" }
  ];
  for (const { label, href, id } of items) {
    const a = document.createElement("a");
    a.id = id;
    a.href = href;
    a.textContent = label;
    a.addEventListener("click", () => a.blur());
    frag.appendChild(a);
  }
  return frag;
}
