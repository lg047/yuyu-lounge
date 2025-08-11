export default function TopNav(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const items = [
    { label: "Reels", href: "#/reels", id: "nav-reels" },
    { label: "Chat", href: "#/chat", id: "nav-chat" },
    { label: "HappyStocks", href: "#/happystocks", id: "nav-stocks" }, // fixed
    { label: "Arcade", href: "#/game", id: "nav-game" },
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
