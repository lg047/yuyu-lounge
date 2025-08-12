// src/components/topnav.ts
export default function TopNav(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const items = [
    { label: "Reels", href: "#/reels", id: "nav-reels" },
    { label: "Chat", href: "#/chat", id: "nav-chat" },
    { label: "Arcade", href: "#/game", id: "nav-game" },
    { label: "TV", href: "#/tv", id: "nav-tv" },
  ];

  const nav = document.createElement("nav");
  nav.className = "topnav";

  items.forEach(({ label, href, id }) => {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    link.id = id;
    link.className = "nav-link";
    nav.appendChild(link);
  });

  frag.appendChild(nav);
  return frag;
}
