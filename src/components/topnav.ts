// src/components/topnav.ts
export default function TopNav(): DocumentFragment {
  const frag = document.createDocumentFragment();

  type Item = { label: string; href: string; id: string };
  const items: Item[] = [
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
    a.setAttribute("role", "link");
    a.addEventListener("click", () => a.blur());
    frag.appendChild(a);
  }

  return frag;
}
